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
  external_imports?: string[] | null; // present once external imports move to jsonb
};
type CEdge = { id: Id; from_node_id: Id; to_node_id: Id | null; target_name: string | null; kind: string };
type Graph = { nodes: CNode[]; edges: CEdge[] };
type Repo = { id: number; full_name: string; language: string | null; index_status: string | null; last_indexed_at: string | null };

const MAX_FILES_DRAWN = 150;
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

function buildModel(g: Graph) {
  const files = g.nodes.filter((n) => n.kind === "file");
  const symbols = g.nodes.filter((n) => n.kind !== "file");
  const fileById = new Map(files.map((f) => [f.id, f]));
  const fileByPath = new Map(files.map((f) => [f.path, f]));
  const imports = new Map<Id, Id[]>();
  const importedBy = new Map<Id, Id[]>();
  const packages = new Map<Id, Set<string>>();
  const symbolsByPath = new Map<string, CNode[]>();
  const seen = new Set<string>();

  for (const e of g.edges) {
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

  const degree = (id: Id) => (imports.get(id)?.length ?? 0) + (importedBy.get(id)?.length ?? 0);
  const ranked = [...files].sort((a, b) => degree(b.id) - degree(a.id));
  const visible = ranked.slice(0, MAX_FILES_DRAWN);
  const visibleIds = new Set(visible.map((f) => f.id));
  const links: [Id, Id][] = [];
  for (const [from, tos] of imports) for (const to of tos) if (visibleIds.has(from) && visibleIds.has(to)) links.push([from, to]);

  const counts = { files: files.length, symbols: symbols.length, imports: seen.size, packages: new Set([...packages.values()].flatMap((s) => [...s])).size };

  return { files, symbols, fileById, fileByPath, imports, importedBy, packages, symbolsByPath, ranked, visible, links, counts, all: g.nodes };
}
type Model = ReturnType<typeof buildModel>;

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

/** Fruchterman-Reingold, fixed iterations, deterministic start. */
function layout(ids: Id[], links: [Id, Id][], w: number, h: number) {
  const n = ids.length;
  const pad = 44;
  const idx = new Map(ids.map((id, i) => [id, i]));
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const r0 = Math.min(w, h) * 0.38;
  ids.forEach((_, i) => {
    const a = (i / Math.max(n, 1)) * Math.PI * 2;
    x[i] = w / 2 + Math.cos(a) * r0;
    y[i] = h / 2 + Math.sin(a) * r0;
  });
  if (n > 1) {
    const k = Math.sqrt((w * h) / n) * 0.85;
    const edges = links.map(([a, b]) => [idx.get(a)!, idx.get(b)!] as const);
    const dx = new Float64Array(n);
    const dy = new Float64Array(n);
    const iters = 250;
    for (let it = 0; it < iters; it++) {
      const t = (w / 8) * (1 - it / iters) + 0.5;
      dx.fill(0);
      dy.fill(0);
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const ex = x[i] - x[j];
          const ey = y[i] - y[j];
          const d = Math.max(Math.hypot(ex, ey), 0.01);
          const f = (k * k) / (d * d);
          dx[i] += ex * f; dy[i] += ey * f; dx[j] -= ex * f; dy[j] -= ey * f;
        }
        dx[i] += (w / 2 - x[i]) * 0.02;
        dy[i] += (h / 2 - y[i]) * 0.02;
      }
      for (const [a, b] of edges) {
        const ex = x[a] - x[b];
        const ey = y[a] - y[b];
        const f = Math.max(Math.hypot(ex, ey), 0.01) / k;
        dx[a] -= ex * f; dy[a] -= ey * f; dx[b] += ex * f; dy[b] += ey * f;
      }
      for (let i = 0; i < n; i++) {
        const d = Math.max(Math.hypot(dx[i], dy[i]), 0.01);
        const m = Math.min(d, t);
        x[i] = Math.min(w - pad, Math.max(pad, x[i] + (dx[i] / d) * m));
        y[i] = Math.min(h - pad, Math.max(pad, y[i] + (dy[i] / d) * m));
      }
    }
  }
  return new Map(ids.map((id, i) => [id, { x: x[i], y: y[i] }]));
}

/* =====================================================================
   Small shared UI
   ===================================================================== */

const inputCls =
  "rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm outline-none transition-colors placeholder:text-white/30 focus:border-[#FF4D1C]/60";

function Chip({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:border-[#FF4D1C]/50 hover:text-white",
        active ? "border-[#FF4D1C]/60 text-white" : "border-white/10 text-white/70",
      )}
    >
      {children}
    </button>
  );
}

function Stat({ value, name }: { value: number; name: string }) {
  return (
    <div>
      <p className="text-xl tabular-nums">{value.toLocaleString()}</p>
      <p className="text-xs text-white/40">{name}</p>
    </div>
  );
}

/* =====================================================================
   Feature 1: code graph (drag, zoom, full screen, and trace what a change touches)
   ===================================================================== */

type P = { x: number; y: number };
type View = { k: number; tx: number; ty: number };

const LW = 1000; // logical size the automatic layout is computed in
const LH = 700;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const short = (s: string) => (s.length > 24 ? s.slice(0, 22) + "…" : s);

/** Zoom by factor f while keeping the point (cx, cy) fixed on screen. */
function zoomAt(v: View, f: number, cx: number, cy: number): View {
  const k = clamp(v.k * f, 0.4, 5);
  const r = k / v.k;
  return { k, tx: cx - (cx - v.tx) * r, ty: cy - (cy - v.ty) * r };
}

const toolBtn =
  "rounded-md border border-white/10 bg-black/50 px-2.5 py-1 text-xs text-white/75 backdrop-blur transition-colors hover:border-[#FF4D1C]/50 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white";

function Details({ model, node, impact, setSel, className }: { model: Model; node: CNode | undefined; impact: Map<Id, number>; setSel: (id: Id) => void; className?: string }) {
  if (!node) {
    return (
      <Card className={cx("p-5", className)}>
        <p className="text-sm text-white/50">Select a file to see what it imports and what depends on it.</p>
      </Card>
    );
  }
  const imports = model.imports.get(node.id) ?? [];
  const importedBy = model.importedBy.get(node.id) ?? [];
  const pkgs = [...(model.packages.get(node.id) ?? [])].sort();
  const symbols = model.symbolsByPath.get(node.path) ?? [];

  const chips = (ids: Id[]) =>
    ids.length === 0 ? (
      <span className="text-sm text-white/40">None</span>
    ) : (
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => {
          const f = model.fileById.get(id);
          return f ? (
            <Chip key={id} title={f.path} onClick={() => setSel(id)}>
              {base(f.path)}
            </Chip>
          ) : null;
        })}
      </div>
    );

  return (
    <Card key={String(node.id)} className={cx("dp-fade p-5", className)}>
      <h2 className="text-lg">{base(node.path)}</h2>
      <p className="mt-1 break-all font-mono text-xs text-white/50">{node.path}</p>

      <p className="mt-4 rounded-md border border-white/10 px-3 py-2 text-sm text-white/70">
        {impact.size === 0 ? "No other file depends on this one." : <>Changing this file can affect <span className="text-white">{impact.size}</span> other {impact.size === 1 ? "file" : "files"}.</>}
      </p>

      <h3 className="mt-5 text-sm font-medium">Imports</h3>
      <div className="mt-2">{chips(imports)}</div>
      <h3 className="mt-5 text-sm font-medium">Imported by</h3>
      <div className="mt-2">{chips(importedBy)}</div>
      <h3 className="mt-5 text-sm font-medium">Packages</h3>
      <div className="mt-2">
        {pkgs.length === 0 ? <span className="text-sm text-white/40">None</span> : <div className="flex flex-wrap gap-2">{pkgs.map((p) => <Badge key={p}>{p}</Badge>)}</div>}
      </div>
      <h3 className="mt-5 text-sm font-medium">Defined here</h3>
      <div className="mt-2">
        {symbols.length === 0 ? (
          <span className="text-sm text-white/40">No functions or classes found.</span>
        ) : (
          <ul className="space-y-1.5">
            {symbols.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-mono">{s.name}</span>
                <Badge>{s.kind}</Badge>
                <span className="shrink-0 font-mono text-xs text-white/40">{s.start_line}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function GraphView({ model, sel, setSel }: { model: Model; sel: Id | null; setSel: (id: Id) => void }) {
  // Automatic layout, stored as 0..1 fractions so it stretches to any canvas size.
  const auto = useMemo(() => {
    const raw = layout(model.visible.map((f) => f.id), model.links, LW, LH);
    const m = new Map<Id, P>();
    raw.forEach((p, id) => m.set(id, { x: p.x / LW, y: p.y / LH }));
    return m;
  }, [model]);

  const [moved, setMoved] = useState<Map<Id, P>>(() => new Map()); // nodes the user dragged
  const [view, setView] = useState<View>({ k: 1, tx: 0, ty: 0 });
  const [full, setFull] = useState(false);
  const [hover, setHover] = useState<Id | null>(null);
  const [size, setSize] = useState({ w: 700, h: 544 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ kind: "node" | "pan"; id?: Id; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);

  const node = sel != null ? model.fileById.get(sel) : undefined;
  const impact = useMemo(() => impactOf(model, sel), [model, sel]);

  // New graph: forget dragged positions and zoom.
  useEffect(() => {
    setMoved(new Map());
    setView({ k: 1, tx: 0, ty: 0 });
  }, [model]);

  // Keep the drawing the same size as its box. Re-attaches when full screen toggles,
  // because the full-screen view lives in a portal and its DOM nodes are new.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.max(240, e.contentRect.width), h: Math.max(240, e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [full]);

  // Wheel zoom needs a non-passive listener so the page does not scroll too.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      setView((v) => zoomAt(v, Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [full]);

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

  // Where each node is on screen right now.
  const screen = useMemo(() => {
    const m = new Map<Id, P>();
    for (const f of model.visible) {
      const p = moved.get(f.id) ?? auto.get(f.id)!;
      m.set(f.id, { x: p.x * size.w * view.k + view.tx, y: p.y * size.h * view.k + view.ty });
    }
    return m;
  }, [model, auto, moved, size, view]);

  const degree = (id: Id) => (model.imports.get(id)?.length ?? 0) + (model.importedBy.get(id)?.length ?? 0);
  const radius = (id: Id) => 5 + Math.min(5, degree(id) * 0.5) + (id === sel ? 3 : 0);

  // Labels: most important first, and a label is skipped if it would sit on top of one already placed.
  const labels = useMemo(() => {
    const near = new Set<Id>(sel != null ? [...(model.imports.get(sel) ?? []), ...(model.importedBy.get(sel) ?? [])] : []);
    const prio = (id: Id) => (id === sel ? 1e9 : id === hover ? 1e9 - 1 : near.has(id) ? 1e6 : impact.has(id) ? 1e5 : 0) + degree(id);
    const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
    const shown = new Set<Id>();
    for (const f of [...model.visible].sort((a, b) => prio(b.id) - prio(a.id))) {
      const p = screen.get(f.id)!;
      if (p.x < -40 || p.x > size.w + 40 || p.y < -20 || p.y > size.h + 20) continue;
      const bw = short(base(f.path)).length * 6.6 + 10;
      const box = { x0: p.x - bw / 2, x1: p.x + bw / 2, y0: p.y + 8, y1: p.y + 26 };
      const must = f.id === sel || f.id === hover;
      if (!must && placed.some((o) => box.x0 < o.x1 && box.x1 > o.x0 && box.y0 < o.y1 && box.y1 > o.y0)) continue;
      placed.push(box);
      shown.add(f.id);
    }
    return shown;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, screen, sel, hover, impact, size]);

  const inChain = (id: Id) => id === sel || impact.has(id);
  const zoomBy = (f: number) => setView((v) => zoomAt(v, f, size.w / 2, size.h / 2));

  const content = (
    <div
      className={cx(full ? "fixed inset-0 z-50 flex bg-[#0b0b0c]" : "grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]")}
      role={full ? "dialog" : undefined}
      aria-modal={full || undefined}
      aria-label={full ? "Dependency graph, full screen" : undefined}
    >
      <Card className={cx("relative overflow-hidden", full ? "min-w-0 flex-1 rounded-none border-0" : "h-[34rem]")}>
        <div ref={wrapRef} className="absolute inset-0">
          <svg ref={svgRef} width={size.w} height={size.h} className="block touch-none select-none" role="group" aria-label="Dependency graph. Select a file to see what depends on it.">
            <defs>
              <marker id="dp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0 0L10 5L0 10z" className="fill-white/35" />
              </marker>
              <marker id="dp-arrow-hot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0 0L10 5L0 10z" className="fill-[#FF4D1C]" />
              </marker>
            </defs>

            {/* background: drag to pan */}
            <rect
              width={size.w}
              height={size.h}
              fill="transparent"
              className="cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { kind: "pan", sx: e.clientX, sy: e.clientY, ox: view.tx, oy: view.ty, moved: false };
              }}
              onPointerMove={(e) => {
                const d = drag.current;
                if (!d || d.kind !== "pan") return;
                setView((v) => ({ ...v, tx: d.ox + e.clientX - d.sx, ty: d.oy + e.clientY - d.sy }));
              }}
              onPointerUp={() => (drag.current = null)}
            />

            {model.links.map(([a, b]) => {
              const pa = screen.get(a)!;
              const pb = screen.get(b)!;
              const hot = inChain(a) && inChain(b);
              const dx = pb.x - pa.x;
              const dy = pb.y - pa.y;
              const len = Math.hypot(dx, dy) || 1;
              const trim = radius(b) + 3;
              return (
                <line
                  key={`${a}>${b}`}
                  x1={pa.x} y1={pa.y}
                  x2={pb.x - (dx / len) * trim} y2={pb.y - (dy / len) * trim}
                  strokeWidth={hot ? 1.6 : 1}
                  markerEnd={`url(#${hot ? "dp-arrow-hot" : "dp-arrow"})`}
                  pointerEvents="none"
                  className={hot ? "stroke-[#FF4D1C]" : "stroke-white/20"}
                />
              );
            })}

            {model.visible.map((f) => {
              const p = screen.get(f.id)!;
              const on = f.id === sel;
              const affected = impact.has(f.id);
              const r = radius(f.id);
              return (
                <g
                  key={f.id}
                  role="button"
                  tabIndex={0}
                  aria-label={f.path}
                  aria-pressed={on}
                  className="cursor-pointer outline-none [&:focus-visible>circle:first-child]:stroke-white"
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSel(f.id))}
                  onPointerEnter={() => setHover(f.id)}
                  onPointerLeave={() => setHover(null)}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    drag.current = { kind: "node", id: f.id, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y, moved: false };
                  }}
                  onPointerMove={(e) => {
                    const d = drag.current;
                    if (!d || d.kind !== "node" || d.id !== f.id) return;
                    const dx = e.clientX - d.sx;
                    const dy = e.clientY - d.sy;
                    if (!d.moved && Math.hypot(dx, dy) < 4) return; // a click, not a drag
                    d.moved = true;
                    const nx = (d.ox + dx - view.tx) / (size.w * view.k);
                    const ny = (d.oy + dy - view.ty) / (size.h * view.k);
                    setMoved((m) => new Map(m).set(f.id, { x: nx, y: ny }));
                  }}
                  onPointerUp={() => {
                    const d = drag.current;
                    drag.current = null;
                    if (d && !d.moved) setSel(f.id);
                  }}
                >
                  <circle
                    cx={p.x} cy={p.y} r={r}
                    strokeWidth={2} stroke="transparent"
                    className={on ? "fill-[#FF4D1C]" : affected ? "fill-[#FF4D1C]/60" : "fill-white/75 hover:fill-white"}
                  />
                  {on && <circle cx={p.x} cy={p.y} r={r + 8} className="fill-[#FF4D1C]/10" pointerEvents="none" />}
                  {labels.has(f.id) && (
                    <text
                      x={p.x} y={p.y + r + 11}
                      textAnchor="middle" fontSize={11}
                      stroke="#0b0b0c" strokeWidth={3} strokeLinejoin="round" paintOrder="stroke"
                      pointerEvents="none"
                      className={cx("font-mono", on || affected || f.id === hover ? "fill-white" : "fill-white/60")}
                    >
                      {short(base(f.path))}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="absolute right-3 top-3 flex flex-wrap justify-end gap-2">
          <button type="button" className={toolBtn} onClick={() => zoomBy(1.3)} aria-label="Zoom in">+</button>
          <button type="button" className={toolBtn} onClick={() => zoomBy(1 / 1.3)} aria-label="Zoom out">−</button>
          <button type="button" className={toolBtn} onClick={() => setView({ k: 1, tx: 0, ty: 0 })}>Fit</button>
          <button type="button" className={toolBtn} onClick={() => { setMoved(new Map()); setView({ k: 1, tx: 0, ty: 0 }); }}>Reset layout</button>
          <button type="button" className={toolBtn} onClick={() => setFull((f) => !f)} aria-pressed={full}>{full ? "Exit full screen" : "Full screen"}</button>
        </div>

        <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/45">
          <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#FF4D1C]" /> Selected</span>
          <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#FF4D1C]/60" /> Depends on it</span>
          <span>Drag a file to move it. Scroll to zoom. Drag the background to pan.</span>
          {model.files.length > model.visible.length && <span>Showing the {model.visible.length} most connected of {model.files.length} files.</span>}
        </div>
      </Card>

      <Details
        model={model}
        node={node}
        impact={impact}
        setSel={setSel}
        className={full ? "hidden w-80 shrink-0 overflow-y-auto rounded-none border-0 border-l border-white/10 md:block" : "self-start"}
      />
    </div>
  );

  // Full screen is rendered in a portal on <body>. The page body is wrapped in an animated
  // element (dp-rise); a transform on any ancestor turns `position: fixed` into "fixed relative
  // to that ancestor", which is what broke the full-screen view. A portal avoids it entirely.
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
      <div className="space-y-3 border-b border-white/[0.06] p-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search functions, classes, methods and files" aria-label="Search the code index" className={cx(inputCls, "w-full")} />
        <div className="flex flex-wrap gap-2">
          {KIND_FILTERS.map((k) => (
            <Chip key={k.id} active={kind === k.id} onClick={() => setKind(k.id)}>
              {k.label} {countByKind[k.id] ?? 0}
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
                <button type="button" onClick={() => onOpen(n)} className="block w-full px-5 py-3 text-left transition-colors hover:bg-white/[0.02] focus-visible:bg-white/[0.04] focus-visible:outline-none">
                  <span className="flex items-center gap-3">
                    <span className="min-w-0 truncate font-mono text-sm">{label(n)}</span>
                    <Badge>{n.kind}</Badge>
                    <span className="min-w-0 flex-1 truncate text-right font-mono text-xs text-white/45">
                      {n.path}
                      {n.kind !== "file" && n.start_line ? `:${n.start_line}` : ""}
                    </span>
                  </span>
                  {n.signature && n.kind !== "file" && <span className="mt-1 block truncate font-mono text-xs text-white/35">{n.signature}</span>}
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
      <Card className="self-start p-5">
        <h2 className="text-lg">Repository brain</h2>
        <p className="mt-1 text-sm text-white/50">Builds on the code graph so an assistant can answer questions about this repository.</p>
        <ul className="mt-4 space-y-3">
          {steps.map((s) => (
            <li key={s.title} className="flex gap-3">
              <span aria-hidden className={cx("mt-1.5 size-2 shrink-0 rounded-full", s.done ? "bg-[#FF4D1C]" : "border border-white/25")} />
              <div>
                <p className="text-sm">
                  {s.title} <span className="sr-only">{s.done ? "ready" : "not built yet"}</span>
                </p>
                <p className="text-xs text-white/45">{s.note}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-4">
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

export default function CodeIntelligencePage() {
  const [tab, setTab] = useState<Tab>("graph");
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [reposError, setReposError] = useState<string | null>(null);
  const [repoId, setRepoId] = useState<number | null>(null);
  const [sel, setSel] = useState<Id | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const { status, graph, error, reload } = useGraph(repoId);

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
      {indexing ? "Indexing" : indexed ? "Re-index" : "Index repository"}
    </Btn>
  );

  let body: React.ReactNode;
  if (tab === "brain" && model && indexed) body = <BrainView model={model} />;
  else if (reposError) body = <Empty>{reposError}</Empty>;
  else if (repos && repos.length === 0) body = <Empty>No repositories are connected to your account yet.</Empty>;
  else if (status === "error") body = <Empty><span className="block">{error}</span><span className="mt-2 block text-white/40">You can still use the button at the top right to index the repository.</span> <button type="button" onClick={reload} className="mt-2 underline underline-offset-2">Try again</button></Empty>;
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
    <div className="space-y-6">
      <Reveal>
        <PageHeader title="Code intelligence" desc="See how a repository fits together, find any function or file, and ask questions about the code." action={repoId != null ? generateButton : undefined} />
      </Reveal>

      <Reveal delay={80}>
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={repoId ?? ""}
              onChange={(e) => { setRepoId(Number(e.target.value)); setNotice(null); }}
              disabled={!repos || repos.length === 0}
              aria-label="Repository"
              className={cx(inputCls, "min-w-[14rem]")}
            >
              {!repos && <option>Loading repositories</option>}
              {repos?.length === 0 && <option>No repositories</option>}
              {repos?.map((r) => (
                <option key={r.id} value={r.id}>{r.full_name}</option>
              ))}
            </select>
            <span className="text-xs text-white/40" aria-live="polite">
              {indexing ? "Cloning and parsing the repository. This can take a minute." : repo?.last_indexed_at ? `Showing the graph saved ${ago(repo.last_indexed_at)}. Re-index to pick up new commits.` : ""}
            </span>
          </div>
          {indexed && model && (
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/[0.06] pt-4">
              <Stat value={model.counts.files} name="files" />
              <Stat value={model.counts.symbols} name="functions and classes" />
              <Stat value={model.counts.imports} name="imports between files" />
              <Stat value={model.counts.packages} name="packages used" />
            </div>
          )}
          {notice && <p role="status" className={cx("mt-3 text-sm", notice.ok ? "text-white/70" : "text-[#FF4D1C]")}>{notice.text}</p>}
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