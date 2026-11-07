"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/browser";
import { Badge, Btn, Card, Empty, PageHeader, Reveal, Segmented, cx } from "../_components/ui";

/* =====================================================================
   Types. These mirror what load_graph() returns from FastAPI.
   ===================================================================== */

type Id = string | number;
type Kind = "file" | "class" | "function" | "method";
type Tab = "graph" | "search" | "brain";

type CNode = {
  id: Id;
  kind: Kind;
  name: string;
  qualified_name: string;
  path: string;
  language: string | null;
  start_line: number | null;
  end_line: number | null;
  signature: string | null;
  external_imports?: string[] | null;
};
// kind "imports": file -> file (or package). kind "calls": file -> function/class in another file.
type CEdge = { id: Id; from_node_id: Id; to_node_id: Id | null; target_name: string | null; kind: string };
type Graph = { nodes: CNode[]; edges: CEdge[] };
type Repo = { id: number; full_name: string; language: string | null; index_status: string | null; last_indexed_at: string | null };

const MAX_RESULTS = 100;

/* =====================================================================
   Data access. The browser only talks to Next routes; those add the
   internal key and check repo access before calling FastAPI.
   ===================================================================== */

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Request failed.");
  return body as T;
}

const repoUrl = (id: number, part: "graph" | "index") => `/api/code-intelligence?op=${part}&repo=${id}`;

function useGraph(repoId: number | null) {
  const [state, setState] = useState<{ status: "idle" | "loading" | "ready" | "error"; graph?: Graph; error?: string }>({ status: "idle" });
  const run = useRef(0);

  const load = useCallback(async () => {
    if (repoId == null) return;
    const mine = ++run.current;
    setState((s) => ({ status: "loading", graph: s.graph }));
    try {
      const graph = await api<Graph>(repoUrl(repoId, "graph"));
      if (mine === run.current) setState({ status: "ready", graph });
    } catch (e) {
      if (mine === run.current) setState({ status: "error", error: (e as Error).message });
    }
  }, [repoId]);

  useEffect(() => {
    setState({ status: "idle" });
    load();
  }, [load]);

  return { ...state, reload: load };
}

/* =====================================================================
   Graph model: everything the three tabs need, derived once per load.
   ===================================================================== */

function push<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const a = m.get(k);
  if (a) a.push(v);
  else m.set(k, [v]);
}

function ago(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs} h ago` : `${Math.round(hrs / 24)} d ago`;
}

const base = (p: string) => p.split("/").pop() ?? p;
const label = (n: CNode) => (n.kind === "file" ? base(n.path) : n.name);
/** "src/lib/api.ts" -> "src/lib" ; "page.tsx" -> "" */
const dirOf = (p: string) => p.slice(0, Math.max(0, p.lastIndexOf("/")));
/** "src/lib/api.ts" -> ["src", "src/lib"] */
function ancestorsOf(path: string) {
  const parts = path.split("/");
  parts.pop();
  const out: string[] = [];
  let d = "";
  for (const s of parts) {
    d = d ? `${d}/${s}` : s;
    out.push(d);
  }
  return out;
}

function buildModel(g: Graph) {
  const files = g.nodes.filter((n) => n.kind === "file");
  const symbols = g.nodes.filter((n) => n.kind !== "file");
  const fileById = new Map(files.map((f) => [f.id, f]));
  const fileByPath = new Map(files.map((f) => [f.path, f]));
  const symbolById = new Map(symbols.map((s) => [s.id, s]));
  const imports = new Map<Id, Id[]>();
  const importedBy = new Map<Id, Id[]>();
  const packages = new Map<Id, Set<string>>();
  const symbolsByPath = new Map<string, CNode[]>();
  /** "fromFileId>toFileId" -> names of the functions/classes the first file uses from the second */
  const calls = new Map<string, Set<string>>();
  const seen = new Set<string>();

  for (const e of g.edges) {
    if (e.kind === "calls") {
      const sym = e.to_node_id != null ? symbolById.get(e.to_node_id) : undefined;
      const target = sym ? fileByPath.get(sym.path) : undefined;
      if (!sym || !target || !fileById.has(e.from_node_id)) continue;
      const key = `${e.from_node_id}>${target.id}`;
      (calls.get(key) ?? calls.set(key, new Set()).get(key)!).add(sym.name);
      continue;
    }
    if (e.to_node_id != null) {
      if (!fileById.has(e.from_node_id) || !fileById.has(e.to_node_id)) continue;
      const key = `${e.from_node_id}>${e.to_node_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      push(imports, e.from_node_id, e.to_node_id);
      push(importedBy, e.to_node_id, e.from_node_id);
    } else if (e.target_name) {
      (packages.get(e.from_node_id) ?? packages.set(e.from_node_id, new Set()).get(e.from_node_id)!).add(e.target_name);
    }
  }
  for (const f of files) for (const p of f.external_imports ?? []) (packages.get(f.id) ?? packages.set(f.id, new Set()).get(f.id)!).add(p);
  for (const s of symbols) push(symbolsByPath, s.path, s);
  for (const list of symbolsByPath.values()) list.sort((a, b) => (a.start_line ?? 0) - (b.start_line ?? 0));

  // Folders come straight from file paths, so no backend change is needed for them.
  const dirs = new Set<string>();
  const fileCount = new Map<string, number>(); // folder -> files inside it (any depth)
  for (const f of files) {
    for (const d of ancestorsOf(f.path)) {
      dirs.add(d);
      fileCount.set(d, (fileCount.get(d) ?? 0) + 1);
    }
  }

  // One color per top-level folder so each area of the repo is easy to tell apart.
  const tops = new Map<string, number>();
  for (const d of [...dirs].filter((d) => !d.includes("/")).sort()) tops.set(d, tops.size);

  const degree = (id: Id) => (imports.get(id)?.length ?? 0) + (importedBy.get(id)?.length ?? 0);
  const ranked = [...files].sort((a, b) => degree(b.id) - degree(a.id));
  const counts = { files: files.length, symbols: symbols.length, imports: seen.size, packages: new Set([...packages.values()].flatMap((s) => [...s])).size };

  return { files, symbols, fileById, fileByPath, imports, importedBy, packages, symbolsByPath, calls, dirs, fileCount, tops, degree, ranked, counts, all: g.nodes };
}
type Model = ReturnType<typeof buildModel>;

/* =====================================================================
   Look and feel. One accent (indigo) for selection and interaction.
   Folder hues are chosen to stay away from indigo/violet so a selected
   file never blends into its folder color.
   ===================================================================== */

const ACCENT = "#818CF8";
const SURFACE = "#0a0a0f";
const FONT_MONO = '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, monospace';
const FONT_SANS = 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

// cyan, emerald, amber, pink, lime, coral, teal, yellow
const PALETTE = [190, 152, 38, 332, 100, 12, 172, 58];
function colorOf(model: Model, pathOrDir: string, isDir: boolean) {
  const top = !isDir && !pathOrDir.includes("/") ? null : pathOrDir.split("/")[0];
  const i = top == null ? undefined : model.tops.get(top);
  return i == null ? "#a1a1aa" : `hsl(${PALETTE[i % PALETTE.length]}, 62%, 66%)`;
}

/** Files that would be affected if `id` changed: everything that imports it, directly or through other files. */
function impactOf(model: Model, id: Id | null) {
  const hit = new Map<Id, number>(); // file id -> hops away
  if (id == null) return hit;
  let frontier: Id[] = [id];
  for (let depth = 1; frontier.length; depth++) {
    const next: Id[] = [];
    for (const cur of frontier) {
      for (const parent of model.importedBy.get(cur) ?? []) {
        if (parent === id || hit.has(parent)) continue;
        hit.set(parent, depth);
        next.push(parent);
      }
    }
    frontier = next;
  }
  return hit;
}

/* =====================================================================
   Folder view: which folders are open, and what the graph draws for that.
   An open folder is a box around its children. A closed folder is one
   node that stands in for every file inside it.
   ===================================================================== */

/** Small repos start fully open. Big ones start with only top-level folders open. */
function initialOpen(model: Model) {
  if (model.files.length <= 80) return new Set(model.dirs);
  return new Set([...model.dirs].filter((d) => !d.includes("/")));
}

/** The graph node that stands for this file right now: the file itself, or the first closed folder above it. */
function repFor(f: CNode, open: Set<string>) {
  for (const d of ancestorsOf(f.path)) if (!open.has(d)) return `d:${d}`;
  return `f:${f.id}`;
}

function buildElements(model: Model, open: Set<string>) {
  const nodes: any[] = [];
  const edges: any[] = [];

  for (const d of model.dirs) {
    const parent = dirOf(d);
    const anc = ancestorsOf(d + "/x"); // folders from the top down to d itself
    if (!anc.slice(0, -1).every((a) => open.has(a))) continue; // hidden inside a closed folder
    const n = model.fileCount.get(d) ?? 0;
    nodes.push({
      group: "nodes",
      data: {
        id: `d:${d}`,
        kind: "folder",
        dir: d,
        open: open.has(d),
        label: open.has(d) ? base(d) : `${base(d)} · ${n}`,
        color: colorOf(model, d, true),
        path: d,
        n,
        ...(parent ? { parent: `d:${parent}` } : {}),
      },
    });
  }

  for (const f of model.files) {
    const dir = dirOf(f.path);
    if (!ancestorsOf(f.path).every((a) => open.has(a))) continue;
    nodes.push({
      group: "nodes",
      data: { id: `f:${f.id}`, kind: "file", fid: f.id, label: base(f.path), deg: model.degree(f.id), color: colorOf(model, f.path, false), path: f.path, ...(dir ? { parent: `d:${dir}` } : {}) },
    });
  }

  const agg = new Map<string, { source: string; target: string; count: number; why: Set<string> }>();
  for (const [from, tos] of model.imports) {
    const a = model.fileById.get(from)!;
    for (const to of tos) {
      const b = model.fileById.get(to)!;
      const s = repFor(a, open);
      const t = repFor(b, open);
      if (s === t) continue;
      const key = `${s}>${t}`;
      const cur = agg.get(key) ?? agg.set(key, { source: s, target: t, count: 0, why: new Set() }).get(key)!;
      cur.count++;
      for (const name of model.calls.get(`${from}>${to}`) ?? []) cur.why.add(name);
    }
  }
  for (const [key, e] of agg) {
    const names = [...e.why];
    const text = names.join(", ");
    edges.push({
      group: "edges",
      data: { id: key, source: e.source, target: e.target, count: e.count, why: text.length > 70 ? text.slice(0, 68) + "…" : text, full: text },
    });
  }
  return [...nodes, ...edges];
}

/* =====================================================================
   Small shared UI
   ===================================================================== */

const inputCls =
  "rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white/90 outline-none transition-all placeholder:text-white/30 focus:border-[#818CF8]/70 focus:bg-white/[0.06] focus:ring-4 focus:ring-[#818CF8]/10";

const sectionCls = "mt-6 text-[11px] font-medium uppercase tracking-[0.14em] text-white/40";

function Chip({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "rounded-full border px-3 py-1 text-xs font-medium transition-all hover:border-[#818CF8]/60 hover:text-white",
        active ? "border-[#818CF8]/60 bg-[#818CF8]/15 text-white" : "border-white/10 bg-white/[0.03] text-white/65",
      )}
    >
      {children}
    </button>
  );
}

function Stat({ value, name }: { value: number; name: string }) {
  return (
    <div>
      <p className="text-2xl font-semibold tabular-nums tracking-tight text-white">{value.toLocaleString()}</p>
      <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-white/40">{name}</p>
    </div>
  );
}

/* =====================================================================
   Feature 1: code graph (folders, files, and why files are connected)
   ===================================================================== */

const toolBtn =
  "rounded-lg border border-white/10 bg-[#0a0a0f]/80 px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur transition-all hover:border-[#818CF8]/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#818CF8]";

// Cytoscape styles. Colors are plain strings because the canvas cannot read Tailwind classes.
const GRAPH_STYLE: any[] = [
  { selector: "node", style: { label: "data(label)", color: "rgba(244,244,247,0.85)", "font-size": 11, "font-family": FONT_MONO, "font-weight": 500, "text-valign": "bottom", "text-margin-y": 6, "text-wrap": "ellipsis", "text-max-width": "120px", "text-outline-color": SURFACE, "text-outline-width": 3, "min-zoomed-font-size": 8 } },
  { selector: 'node[kind="file"]', style: { "background-color": "data(color)", "background-opacity": 1, width: "mapData(deg, 0, 15, 14, 34)", height: "mapData(deg, 0, 15, 14, 34)", "border-width": 2, "border-color": SURFACE } },
  { selector: 'node[kind="folder"]', style: { shape: "round-rectangle", "background-color": "data(color)", "background-opacity": 0.05, "border-width": 1.5, "border-color": "data(color)", "border-opacity": 0.35, "text-valign": "top", "text-margin-y": -7, padding: "24px", "font-family": FONT_SANS, "font-size": 12, "font-weight": 600, color: "data(color)", "text-max-width": "200px" } },
  { selector: 'node[kind="folder"][!open]', style: { width: 56, height: 34, padding: "0px", "background-opacity": 0.2, "border-opacity": 0.85, "text-valign": "bottom", "text-margin-y": 7 } },
  { selector: "edge", style: { width: "mapData(count, 1, 8, 1.2, 3.5)", "line-color": "rgba(255,255,255,0.16)", "target-arrow-color": "rgba(255,255,255,0.32)", "target-arrow-shape": "triangle", "arrow-scale": 0.9, "curve-style": "bezier", "control-point-step-size": 36, "overlay-padding": "5px", "overlay-opacity": 0 } },
  { selector: ".dim", style: { opacity: 0.15 } },
  { selector: ".peek", style: { opacity: 1 } },
  { selector: "edge.peek", style: { "line-color": "rgba(255,255,255,0.75)", "target-arrow-color": "rgba(255,255,255,0.9)", "z-index": 15 } },
  { selector: "node.hot", style: { "border-color": ACCENT, "border-width": 3, "border-opacity": 1 } },
  { selector: "node.sel", style: { "background-color": ACCENT, "border-color": "#ffffff", "border-width": 2.5, "border-opacity": 1, color: "#ffffff", "overlay-color": ACCENT, "overlay-opacity": 0.2, "overlay-padding": "10px" } },
  { selector: "edge.hot", style: { "line-color": ACCENT, "target-arrow-color": ACCENT, width: 2.2, "z-index": 10 } },
  { selector: "edge.direct", style: { width: 2.6, "z-index": 20 } },
];

let fcoseRegistered = false;

function Details({ model, node, impact, setSel, className }: { model: Model; node: CNode | undefined; impact: Map<Id, number>; setSel: (id: Id) => void; className?: string }) {
  if (!node) {
    return (
      <Card className={cx("p-6", className)}>
        <p className="text-sm leading-relaxed text-white/50">Select a file to see what it imports, what depends on it, and which functions connect them.</p>
      </Card>
    );
  }
  const imports = model.imports.get(node.id) ?? [];
  const importedBy = model.importedBy.get(node.id) ?? [];
  const pkgs = [...(model.packages.get(node.id) ?? [])].sort();
  const symbols = model.symbolsByPath.get(node.path) ?? [];

  const rows = (ids: Id[], dir: "out" | "in") =>
    ids.length === 0 ? (
      <span className="text-sm text-white/35">None</span>
    ) : (
      <ul className="space-y-2">
        {ids.map((id) => {
          const f = model.fileById.get(id);
          if (!f) return null;
          const names = [...(model.calls.get(dir === "out" ? `${node.id}>${id}` : `${id}>${node.id}`) ?? [])];
          return (
            <li key={id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Chip title={f.path} onClick={() => setSel(id)}>
                {base(f.path)}
              </Chip>
              {names.length > 0 && <span className="font-mono text-xs text-[#818CF8]/80">via {names.join(", ")}</span>}
            </li>
          );
        })}
      </ul>
    );

  return (
    <Card key={String(node.id)} className={cx("dp-fade p-6", className)}>
      <h2 className="text-xl font-semibold tracking-tight text-white">{base(node.path)}</h2>
      <p className="mt-1.5 break-all font-mono text-xs text-white/45">{node.path}</p>

      <p className="mt-5 rounded-lg border border-[#818CF8]/25 bg-[#818CF8]/[0.08] px-3.5 py-2.5 text-sm leading-relaxed text-white/75">
        {impact.size === 0 ? "No other file depends on this one." : <>Changing this file can affect <span className="font-semibold text-white">{impact.size}</span> other {impact.size === 1 ? "file" : "files"}.</>}
      </p>

      <h3 className={sectionCls}>Imports</h3>
      <div className="mt-2.5">{rows(imports, "out")}</div>
      <h3 className={sectionCls}>Imported by</h3>
      <div className="mt-2.5">{rows(importedBy, "in")}</div>
      <h3 className={sectionCls}>Packages</h3>
      <div className="mt-2.5">
        {pkgs.length === 0 ? <span className="text-sm text-white/35">None</span> : <div className="flex flex-wrap gap-2">{pkgs.map((p) => <Badge key={p}>{p}</Badge>)}</div>}
      </div>
      <h3 className={sectionCls}>Defined here</h3>
      <div className="mt-2.5">
        {symbols.length === 0 ? (
          <span className="text-sm text-white/35">No functions or classes found.</span>
        ) : (
          <ul className="space-y-2">
            {symbols.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-white/90">{s.name}</span>
                <Badge>{s.kind}</Badge>
                <span className="shrink-0 font-mono text-xs tabular-nums text-white/35">L{s.start_line}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function GraphView({ model, sel, setSel }: { model: Model; sel: Id | null; setSel: (id: Id) => void }) {
  const [open, setOpen] = useState<Set<string>>(() => initialOpen(model));
  const [full, setFull] = useState(false);
  const [cy, setCy] = useState<any>(null);
  const [tip, setTip] = useState<{ x: number; y: number; title: string; body?: string } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const node = sel != null ? model.fileById.get(sel) : undefined;
  const impact = useMemo(() => impactOf(model, sel), [model, sel]);

  // New graph: reset which folders are open.
  useEffect(() => {
    setOpen(initialOpen(model));
  }, [model]);

  // Selecting a file also opens the folders above it, so it is visible.
  const select = useCallback(
    (id: Id) => {
      setSel(id);
      const f = model.fileById.get(id);
      if (!f) return;
      const need = ancestorsOf(f.path);
      setOpen((o) => (need.every((d) => o.has(d)) ? o : new Set([...o, ...need])));
    },
    [model, setSel],
  );
  const toggle = useCallback((dir: string) => {
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(dir)) n.delete(dir);
      else n.add(dir);
      return n;
    });
  }, []);
  const act = useRef({ select, toggle });
  act.current = { select, toggle };

  // Create the Cytoscape instance. It is created again when full screen toggles,
  // because the full-screen view lives in a portal and its container is a new element.
  useEffect(() => {
    let dead = false;
    let inst: any = null;
    (async () => {
      const [{ default: cytoscape }, { default: fcose }] = await Promise.all([import("cytoscape"), import("cytoscape-fcose")]);
      if (dead || !boxRef.current) return;
      if (!fcoseRegistered) {
        cytoscape.use(fcose as any);
        fcoseRegistered = true;
      }
      inst = cytoscape({ container: boxRef.current, elements: [], style: GRAPH_STYLE, wheelSensitivity: 0.25, minZoom: 0.08, maxZoom: 4 });
      inst.on("tap", "node", (evt: any) => {
        const n = evt.target;
        const d = n.data();
        if (d.kind === "file") return act.current.select(d.fid);
        // An open folder is a big box: only its title strip closes it, so clicks inside the box do nothing.
        if (n.isParent()) {
          const bb = n.boundingBox();
          if (evt.position.y - bb.y1 > 30) return;
        }
        act.current.toggle(d.dir);
      });
      const el = boxRef.current;
      const tipFor = (evt: any) => {
        const t = evt.target;
        const d = t.data();
        const pos = evt.renderedPosition ?? { x: 0, y: 0 };
        if (t.isEdge()) {
          const body = d.full ? `uses ${d.full}` : d.count > 1 ? `${d.count} imports` : "imports";
          return { x: pos.x, y: pos.y, title: `${t.source().data("label")} → ${t.target().data("label")}`, body };
        }
        if (d.kind === "folder") return { x: pos.x, y: pos.y, title: d.path, body: `${d.n} files. Click the title to ${d.open ? "close" : "open"} it.` };
        return { x: pos.x, y: pos.y, title: d.label, body: d.path };
      };
      inst.on("mouseover", "node, edge", (evt: any) => {
        el.style.cursor = "pointer";
        setTip(tipFor(evt));
        const t = evt.target;
        if (t.isEdge()) t.addClass("peek");
        else if (!t.isParent()) t.closedNeighborhood().addClass("peek");
      });
      inst.on("mousemove", "node, edge", (evt: any) => setTip(tipFor(evt)));
      inst.on("mouseout", "node, edge", () => {
        el.style.cursor = "";
        setTip(null);
        inst.elements().removeClass("peek");
      });
      inst.on("viewport", () => setTip(null));
      setCy(inst);
    })();
    return () => {
      dead = true;
      inst?.destroy();
      setCy(null);
    };
  }, [full]);

  // What to draw for the current set of open folders.
  const elements = useMemo(() => buildElements(model, open), [model, open]);

  useEffect(() => {
    if (!cy) return;
    cy.batch(() => {
      cy.elements().remove();
      cy.add(elements);
    });
    cy.layout({
      name: "fcose",
      quality: cy.nodes().length > 300 ? "default" : "proof",
      randomize: false,
      animate: "end",
      animationDuration: 450,
      fit: true,
      padding: 40,
      nodeDimensionsIncludeLabels: true,
      packComponents: true,
      tile: true, // lines up files that have no connections instead of scattering them
      tilingPaddingVertical: 14,
      tilingPaddingHorizontal: 14,
      nodeRepulsion: () => 12000,
      idealEdgeLength: () => 110,
      edgeElasticity: () => 0.35,
      nestingFactor: 0.12,
      gravity: 0.25,
      gravityCompound: 1.2,
      numIter: 2500,
    }).run();
  }, [cy, elements]);

  // Highlight the selected file and everything that depends on it.
  const selRep = node ? repFor(node, open) : null;
  const hotNodes = useMemo(() => {
    const s = new Set<string>();
    if (!node) return s;
    s.add(repFor(node, open));
    for (const id of impact.keys()) {
      const f = model.fileById.get(id);
      if (f) s.add(repFor(f, open));
    }
    return s;
  }, [model, node, impact, open]);

  useEffect(() => {
    if (!cy) return;
    cy.batch(() => {
      cy.elements().removeClass("sel hot dim direct");
      if (!selRep) return;
      cy.nodes().not(":parent").addClass("dim");
      cy.edges().addClass("dim");
      cy.nodes().forEach((n: any) => {
        if (hotNodes.has(n.id())) n.removeClass("dim").addClass(n.id() === selRep ? "sel" : "hot");
      });
      cy.edges().forEach((e: any) => {
        const s = e.source().id();
        const t = e.target().id();
        if (!hotNodes.has(s) || !hotNodes.has(t)) return;
        e.removeClass("dim").addClass("hot");
        if (s === selRep || t === selRep) e.addClass("direct"); // only the selected file's own edges show their function names
      });
    });
  }, [cy, elements, selRep, hotNodes]);

  // Full screen: Escape closes it, and the page behind stops scrolling.
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [full]);

  const zoomBy = (f: number) => cy?.zoom({ level: cy.zoom() * f, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });

  const content = (
    <div
      className={cx(full ? "fixed inset-0 z-50 flex bg-[#0a0a0f]" : "grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]")}
      role={full ? "dialog" : undefined}
      aria-modal={full || undefined}
      aria-label={full ? "Dependency graph, full screen" : undefined}
    >
      <Card className={cx("relative overflow-hidden", full ? "min-w-0 flex-1 rounded-none border-0" : "h-[34rem]")}>
        <div
          ref={boxRef}
          className="absolute inset-0"
          style={{
            backgroundColor: SURFACE,
            backgroundImage: "radial-gradient(ellipse at 50% 0%, rgba(129,140,248,0.08), transparent 60%), radial-gradient(rgba(255,255,255,0.055) 1px, transparent 1px)",
            backgroundSize: "100% 100%, 24px 24px",
          }}
        />
        {tip && (
          <div className="pointer-events-none absolute z-10 max-w-xs rounded-lg border border-white/10 bg-[#14141c]/95 px-3 py-2 text-xs shadow-xl shadow-black/40 backdrop-blur" style={{ left: tip.x + 14, top: tip.y + 14 }}>
            <p className="break-all font-mono font-medium text-white">{tip.title}</p>
            {tip.body && <p className="mt-1 break-words text-white/55">{tip.body}</p>}
          </div>
        )}

        <div className="absolute right-3 top-3 flex flex-wrap justify-end gap-2">
          <button type="button" className={toolBtn} onClick={() => zoomBy(1.3)} aria-label="Zoom in">+</button>
          <button type="button" className={toolBtn} onClick={() => zoomBy(1 / 1.3)} aria-label="Zoom out">−</button>
          <button type="button" className={toolBtn} onClick={() => cy?.fit(undefined, 30)}>Fit</button>
          <button type="button" className={toolBtn} onClick={() => setOpen(new Set(model.dirs))}>Open all folders</button>
          <button type="button" className={toolBtn} onClick={() => setOpen(new Set())}>Close all folders</button>
          <button type="button" className={toolBtn} onClick={() => setFull((f) => !f)} aria-pressed={full}>{full ? "Exit full screen" : "Full screen"}</button>
        </div>

        <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/45">
          <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#818CF8]" /> Selected</span>
          <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full border-2 border-[#818CF8]" /> Depends on it</span>
          <span>Each folder has its own color. Hover a file or arrow to see why it is connected. Click a folder title to open or close it.</span>
        </div>
      </Card>

      <Details
        model={model}
        node={node}
        impact={impact}
        setSel={select}
        className={full ? "hidden w-96 shrink-0 overflow-y-auto rounded-none border-0 border-l border-white/10 md:block" : "self-start"}
      />
    </div>
  );

  // Full screen is rendered in a portal on <body>. The page body sits inside an animated
  // wrapper (dp-rise); a transform on any ancestor makes `position: fixed` relative to that
  // ancestor instead of the viewport, which is what broke full screen before.
  if (full) {
    return (
      <>
        <div className="h-[34rem]" aria-hidden />
        {createPortal(content, document.body)}
      </>
    );
  }
  return content;
}

/* =====================================================================
   Feature 2: searchable index over every file, class, function, method
   ===================================================================== */

const KIND_FILTERS: { id: Kind | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "function", label: "Functions" },
  { id: "class", label: "Classes" },
  { id: "method", label: "Methods" },
  { id: "file", label: "Files" },
];

function rank(n: CNode, t: string) {
  const name = n.name.toLowerCase();
  if (name === t) return 0;
  if (name.startsWith(t)) return 1;
  if (name.includes(t)) return 2;
  if (n.path.toLowerCase().includes(t)) return 3;
  return 4;
}

function SearchView({ model, onOpen }: { model: Model; onOpen: (n: CNode) => void }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<Kind | "all">("all");
  const deferred = useDeferredValue(q);

  const haystack = useMemo(() => model.all.map((n) => ({ n, text: `${n.name} ${n.qualified_name} ${n.path}`.toLowerCase() })), [model]);
  const countByKind = useMemo(() => {
    const c: Record<string, number> = { all: model.all.length };
    for (const n of model.all) c[n.kind] = (c[n.kind] ?? 0) + 1;
    return c;
  }, [model]);

  const results = useMemo(() => {
    const tokens = deferred.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const pool = haystack.filter(({ n, text }) => (kind === "all" || n.kind === kind) && tokens.every((t) => text.includes(t)));
    if (tokens.length === 0) return pool.map((p) => p.n);
    return pool.sort((a, b) => rank(a.n, tokens[0]) - rank(b.n, tokens[0]) || a.n.name.localeCompare(b.n.name)).map((p) => p.n);
  }, [haystack, deferred, kind]);

  return (
    <Card className="overflow-hidden">
      <div className="space-y-3 border-b border-white/[0.06] p-5">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search functions, classes, methods and files" aria-label="Search the code index" className={cx(inputCls, "w-full")} />
        <div className="flex flex-wrap gap-2">
          {KIND_FILTERS.map((k) => (
            <Chip key={k.id} active={kind === k.id} onClick={() => setKind(k.id)}>
              {k.label} <span className="tabular-nums text-white/40">{countByKind[k.id] ?? 0}</span>
            </Chip>
          ))}
        </div>
      </div>
      {results.length === 0 ? (
        <Empty>{q.trim() ? <>Nothing matches “{q.trim()}”.</> : "Nothing indexed for this filter."}</Empty>
      ) : (
        <>
          <ul className="divide-y divide-white/[0.06]" aria-live="polite">
            {results.slice(0, MAX_RESULTS).map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => onOpen(n)} className="block w-full px-5 py-3.5 text-left transition-colors hover:bg-[#818CF8]/[0.06] focus-visible:bg-[#818CF8]/[0.08] focus-visible:outline-none">
                  <span className="flex items-center gap-3">
                    <span className="min-w-0 truncate font-mono text-sm font-medium text-white">{label(n)}</span>
                    <Badge>{n.kind}</Badge>
                    <span className="min-w-0 flex-1 truncate text-right font-mono text-xs text-white/40">
                      {n.path}
                      {n.kind !== "file" && n.start_line ? `:${n.start_line}` : ""}
                    </span>
                  </span>
                  {n.signature && n.kind !== "file" && <span className="mt-1.5 block truncate font-mono text-xs text-[#818CF8]/70">{n.signature}</span>}
                </button>
              </li>
            ))}
          </ul>
          <p className="border-t border-white/[0.06] px-5 py-3 text-xs text-white/40">
            {results.length > MAX_RESULTS ? `Showing ${MAX_RESULTS} of ${results.length.toLocaleString()}. Keep typing to narrow it down.` : `${results.length.toLocaleString()} ${results.length === 1 ? "result" : "results"}`}
          </p>
        </>
      )}
    </Card>
  );
}

/* =====================================================================
   Feature 3: repository brain (chat). The graph and index it will sit on
   are ready; the summaries and the LLM endpoint are not built yet.
   ===================================================================== */

function BrainView({ model }: { model: Model }) {
  const steps = [
    { done: true, title: "Code graph", note: `${model.counts.files} files, ${model.counts.symbols} functions and classes, ${model.counts.imports} imports` },
    { done: true, title: "Search index", note: "Every file and symbol can be looked up by name or path" },
    { done: false, title: "Repository summary", note: "A short description of each file and of the whole repository" },
    { done: false, title: "Chat", note: "Ask questions and get answers that point to the files used" },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <Card className="self-start p-6">
        <h2 className="text-xl font-semibold tracking-tight text-white">Repository brain</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-white/50">Builds on the code graph so an assistant can answer questions about this repository.</p>
        <ul className="mt-5 space-y-4">
          {steps.map((s) => (
            <li key={s.title} className="flex gap-3">
              <span aria-hidden className={cx("mt-1.5 size-2.5 shrink-0 rounded-full", s.done ? "bg-[#818CF8] shadow-[0_0_10px_rgba(129,140,248,0.7)]" : "border border-white/25")} />
              <div>
                <p className="text-sm font-medium text-white">
                  {s.title} <span className="sr-only">{s.done ? "ready" : "not built yet"}</span>
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-white/45">{s.note}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5">
        <div className="flex gap-2">
          <input disabled placeholder="Ask anything about this repository" aria-label="Ask about the repository" className={cx(inputCls, "min-w-0 flex-1 cursor-not-allowed opacity-50")} />
          <Btn onClick={() => { }} disabled>
            Ask
          </Btn>
        </div>
        <p className="mt-3 text-sm text-white/45">Chat turns on once repository summaries are generated.</p>
      </Card>
    </div>
  );
}

/* =====================================================================
   Page
   ===================================================================== */

function useElapsed(running: boolean) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!running) {
      setSecs(0);
      return;
    }
    const start = Date.now();
    const t = setInterval(() => setSecs(Math.floor((Date.now() - start) / 1000)), 500);
    return () => clearInterval(t);
  }, [running]);
  return secs;
}

const fmt = (s: number) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`);

function Spinner() {
  return <span aria-hidden className="inline-block size-3.5 animate-spin rounded-full border-2 border-white/25 border-t-[#818CF8]" />;
}

// The backend doesn't report progress, so these stages are estimates based on elapsed time.
const stageFor = (s: number) => (s < 6 ? "Cloning the repository" : s < 20 ? "Parsing code and building the graph" : "Saving the graph and code");

export default function CodeIntelligencePage() {
  const [tab, setTab] = useState<Tab>("graph");
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [reposError, setReposError] = useState<string | null>(null);
  const [repoId, setRepoId] = useState<number | null>(null);
  const [sel, setSel] = useState<Id | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const { status, graph, error, reload } = useGraph(repoId);
  const secs = useElapsed(indexing);

  const loadRepos = useCallback(async () => {
    // Row-level security returns only the repositories this user may see.
    const { data, error } = await createClient()
      .from("repositories")
      .select("id, full_name, language, index_status, last_indexed_at")
      .order("full_name");
    if (error) {
      setReposError(error.message);
      return;
    }
    const list = (data ?? []) as Repo[];
    setRepos(list);
    setRepoId((cur) => cur ?? list[0]?.id ?? null);
  }, []);
  useEffect(() => {
    loadRepos();
  }, [loadRepos]);

  const model = useMemo(() => (graph ? buildModel(graph) : null), [graph]);
  useEffect(() => {
    setSel(model?.ranked[0]?.id ?? null);
  }, [model]);

  const repo = repos?.find((r) => r.id === repoId);
  const indexed = !!model && model.all.length > 0;

  /** Feature 1 trigger: run the pipeline (clone, parse, save), then reload the graph. */
  const generate = async () => {
    if (repoId == null || indexing) return;
    setIndexing(true);
    setNotice(null);
    try {
      const r = await api<{ commit: string; nodes: number; edges: number }>(repoUrl(repoId, "index"), { method: "POST" });
      setNotice(
        r.nodes === 0
          ? { ok: false, text: `Indexed commit ${r.commit.slice(0, 7)}, but no supported code files were found in this repository.` }
          : { ok: true, text: `Re-indexed at commit ${r.commit.slice(0, 7)}: ${r.nodes} nodes, ${r.edges} edges.` },
      );
      await Promise.all([reload(), loadRepos()]);
      setTab("graph");
    } catch (e) {
      setNotice({ ok: false, text: (e as Error).message });
    } finally {
      setIndexing(false);
    }
  };

  /** Opening any search result lands on its file in the graph. */
  const openNode = (n: CNode) => {
    const f = model?.fileByPath.get(n.path);
    if (f) {
      setSel(f.id);
      setTab("graph");
    }
  };

  const generateButton = (
    <Btn
      variant={indexed ? "ghost" : "primary"}
      onClick={generate}
      disabled={repoId == null || indexing}
      title="Clones the latest commit and rebuilds the saved graph. You don't need this just to view the graph."
    >
      {indexing ? (
        <span className="inline-flex items-center gap-2">
          <Spinner /> Indexing · {fmt(secs)}
        </span>
      ) : indexed ? "Re-index" : "Index repository"}
    </Btn>
  );

  let body: React.ReactNode;
  if (tab === "brain" && model && indexed) body = <BrainView model={model} />;
  else if (reposError) body = <Empty>{reposError}</Empty>;
  else if (repos && repos.length === 0) body = <Empty>No repositories are connected to your account yet.</Empty>;
  else if (status === "error") body = <Empty><span className="block">{error}</span><span className="mt-2 block text-white/40">You can still use the button at the top right to index the repository.</span> <button type="button" onClick={reload} className="mt-2 text-[#818CF8] underline underline-offset-2 hover:text-white">Try again</button></Empty>;
  else if (!model || (status === "loading" && !graph) || !repos) body = <Empty>Loading</Empty>;
  else if (!indexed)
    body = (
      <Empty>
        <span className="block">This repository has not been indexed yet.</span>
        <span className="mt-4 block">{generateButton}</span>
      </Empty>
    );
  else if (tab === "graph" && model.files.length === 0) body = <Empty>No code files were found in this repository.</Empty>;
  else if (tab === "graph") body = <GraphView model={model} sel={sel} setSel={setSel} />;
  else if (tab === "search") body = <SearchView model={model} onOpen={openNode} />;
  else body = null;

  return (
    <div className="space-y-6" style={{ fontFamily: FONT_SANS }}>
      <Reveal>
        <PageHeader title="Code intelligence" desc="See how a repository fits together, find any function or file, and ask questions about the code." action={repoId != null ? generateButton : undefined} />
      </Reveal>

      <Reveal delay={80}>
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={repoId ?? ""}
              onChange={(e) => { setRepoId(Number(e.target.value)); setNotice(null); }}
              disabled={!repos || repos.length === 0}
              aria-label="Repository"
              className={cx(inputCls, "min-w-[14rem] font-mono text-[13px]")}
            >
              {!repos && <option>Loading repositories</option>}
              {repos?.length === 0 && <option>No repositories</option>}
              {repos?.map((r) => (
                <option key={r.id} value={r.id}>{r.full_name}</option>
              ))}
            </select>
            <span className="text-xs text-white/40" aria-live="polite">
              {indexing ? `${stageFor(secs)}. This can take a minute.` : repo?.last_indexed_at ? `Showing the graph saved ${ago(repo.last_indexed_at)}. Re-index to pick up new commits.` : ""}
            </span>
          </div>
          {indexed && model && (
            <div className="mt-5 flex flex-wrap gap-x-10 gap-y-4 border-t border-white/[0.06] pt-5">
              <Stat value={model.counts.files} name="files" />
              <Stat value={model.counts.symbols} name="functions and classes" />
              <Stat value={model.counts.imports} name="imports between files" />
              <Stat value={model.counts.packages} name="packages used" />
            </div>
          )}
          {notice && <p role="status" className={cx("mt-4 text-sm", notice.ok ? "text-emerald-300" : "text-rose-400")}>{notice.text}</p>}
        </Card>
      </Reveal>

      <Reveal delay={120}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { id: "graph", label: "Graph" },
            { id: "search", label: "Search" },
            { id: "brain", label: "Brain" },
          ]}
        />
      </Reveal>

      <div key={tab} className="dp-rise">{body}</div>
    </div>
  );
}