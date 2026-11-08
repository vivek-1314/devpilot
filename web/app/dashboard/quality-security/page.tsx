"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { Badge, Btn, Card, Empty, PageHeader, Reveal, Segmented, SevBadge, cx } from "../_components/ui";
import {
  QualityError,
  fetchRepoState,
  runQualityScan,
  saveFindingState,
  TOOL_DESC,
  TOOL_NAMES,
  type FindingStatus,
  type ToolName,
  type UiFinding,
} from "@/lib/quality";

type Filter = "all" | ToolName;
type Repo = { id: number; full_name: string };

type ToolState = {
  state: "idle" | "running" | "done" | "error";
  at?: string; // when the saved scan ran
  count?: number;
  ref?: string | null;
  source?: string;
  error?: string;
};

type HistoryItem = { id: string; ts: string; repo: string; tool: ToolName; result: string };

const idle = (): Record<ToolName, ToolState> => ({
  Ruff: { state: "idle" },
  Bandit: { state: "idle" },
  Gitleaks: { state: "idle" },
  ESLint: { state: "idle" },
});
const noFindings = (): Record<ToolName, UiFinding[]> => ({ Ruff: [], Bandit: [], Gitleaks: [], ESLint: [] });

const stamp = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const plural = (n: number) => `${n} ${n === 1 ? "finding" : "findings"}`;
const SOURCE: Record<string, string> = { manual: "manual", pr: "pull request", push: "push" };

export default function QualitySecurityPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [findings, setFindings] = useState(noFindings);
  const [status, setStatus] = useState(idle);
  const [states, setStates] = useState<Record<string, FindingStatus>>({});
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [reposError, setReposError] = useState<string | null>(null);
  const [repoId, setRepoId] = useState<number | null>(null);
  const [ref, setRef] = useState("");
  const [loadingSaved, setLoadingSaved] = useState(false);
  const loadRun = useRef(0);

  const repoName = repos?.find((r) => r.id === repoId)?.full_name ?? `Repo ${repoId}`;
  const anyRunning = TOOL_NAMES.some((t) => status[t].state === "running");

  // Only repos the user switched on are scannable (and count toward the plan limit).
  const loadRepos = useCallback(async () => {
    const { data, error } = await createClient().from("repositories").select("id, full_name").eq("analyze_enabled", true).order("full_name");
    if (error) return setReposError(error.message);
    const list = (data ?? []) as Repo[];
    setRepos(list);
    setRepoId((cur) => cur ?? list[0]?.id ?? null);
  }, []);
  useEffect(() => {
    void loadRepos();
  }, [loadRepos]);

  // Show what we already know about this repo: the last saved scan per tool.
  useEffect(() => {
    if (repoId == null) return;
    const mine = ++loadRun.current;
    setLoadingSaved(true);
    setNotice(null);
    fetchRepoState(repoId)
      .then(({ scans, states: saved }) => {
        if (mine !== loadRun.current) return;
        const f = noFindings();
        const s = idle();
        const hist: HistoryItem[] = [];
        for (const t of TOOL_NAMES) {
          const sc = scans[t];
          if (!sc) continue;
          f[t] = sc.findings;
          s[t] = { state: "done", at: stamp(sc.at), count: sc.count, ref: sc.ref, source: sc.source };
          hist.push({ id: `${t}-${sc.at}`, ts: sc.at, repo: repoName, tool: t, result: plural(sc.count) });
        }
        hist.sort((a, b) => b.ts.localeCompare(a.ts));
        setFindings(f);
        setStatus(s);
        setStates(saved);
        setHistory(hist);
      })
      .catch((e) => mine === loadRun.current && setNotice(e instanceof QualityError ? e.message : "Could not load saved results."))
      .finally(() => mine === loadRun.current && setLoadingSaved(false));
    // repoName only labels history rows; re-running on its change would refetch needlessly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoId]);

  const changeRepo = (id: number) => {
    setRepoId(id);
    setFindings(noFindings());
    setStatus(idle());
    setStates({});
    setHistory([]);
  };

  const all = TOOL_NAMES.flatMap((t) => findings[t]);
  const list = all.filter((f) => filter === "all" || f.tool === filter);
  const resolvedCount = all.filter((f) => states[f.fp]).length;
  const openCount = all.length - resolvedCount;
  const hasRun = TOOL_NAMES.some((t) => status[t].at);

  const toggle = async (fp: string) => {
    if (repoId == null) return;
    const next: "open" | FindingStatus = states[fp] ? "open" : "resolved";
    const before = states;
    setStates((s) => {
      const n = { ...s };
      if (next === "open") delete n[fp];
      else n[fp] = "resolved";
      return n;
    });
    try {
      await saveFindingState(repoId, fp, next);
    } catch {
      setStates(before);
      setNotice("Could not save that change. Try again.");
    }
  };

  const runTool = async (tool: ToolName) => {
    if (repoId == null || status[tool].state === "running") return;
    setNotice(null);
    setStatus((s) => ({ ...s, [tool]: { ...s[tool], state: "running", error: undefined } }));
    try {
      const result = await runQualityScan(tool, repoId, ref.trim() || undefined);
      const now = new Date().toISOString();
      setFindings((f) => ({ ...f, [tool]: result })); // replaces only this tool's findings
      setStatus((s) => ({ ...s, [tool]: { state: "done", at: stamp(now), count: result.length, ref: ref.trim() || null, source: "manual" } }));
      setHistory((h) => [
        { id: `${tool}-${now}`, ts: now, repo: `${repoName}${ref.trim() ? ` @ ${ref.trim()}` : ""}`, tool, result: plural(result.length) },
        ...h,
      ]);
    } catch (e) {
      const msg = e instanceof QualityError ? e.message : "The check failed. Try again.";
      setStatus((s) => ({ ...s, [tool]: { ...s[tool], state: "error", error: msg } }));
    }
  };

  const runAll = () => TOOL_NAMES.forEach((t) => void runTool(t));

  return (
    <div className="space-y-6">
      <Reveal>
        <PageHeader
          title="Quality & security"
          desc="What Ruff, Bandit, Gitleaks and ESLint found. Results say what the checks found, nothing more."
          action={
            <Btn onClick={runAll} disabled={anyRunning || repoId === null}>
              {anyRunning ? "Scanning…" : "Run all checks"}
            </Btn>
          }
        />
      </Reveal>

      {/* scan sweep */}
      <div aria-hidden className={cx("h-px overflow-hidden bg-white/10 transition-opacity duration-300", anyRunning ? "opacity-100" : "opacity-0")}>
        <div className="dp-sweep h-full w-1/4 bg-[#FF4D1C] shadow-[0_0_10px_rgba(255,77,28,0.9)]" />
      </div>

      {/* target */}
      <Reveal delay={60}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-xs text-white/50">
            Repository
            <div className="relative mt-1">
              <select
                value={repoId ?? ""}
                onChange={(e) => changeRepo(Number(e.target.value))}
                disabled={!repos || repos.length === 0 || anyRunning}
                className="w-64 appearance-none rounded-lg border border-[#FF4D1C]/30 bg-[#FF4D1C]/[0.06] py-2 pl-3 pr-9 font-mono text-sm text-white outline-none transition-colors hover:border-[#FF4D1C]/60 focus-visible:border-[#FF4D1C] focus-visible:ring-4 focus-visible:ring-[#FF4D1C]/10 disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-[#0a0a0f]"
              >
                {!repos && <option>Loading repositories</option>}
                {repos?.length === 0 && <option>No enabled repositories</option>}
                {repos?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.full_name}
                  </option>
                ))}
              </select>
              <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 fill-none stroke-[#FF7A52]" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 8l5 5 5-5" />
              </svg>
            </div>
          </label>

          <label className="block text-xs text-white/50">
            Branch (optional)
            <input
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="default branch"
              className="mt-1 block w-48 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-sm text-white outline-none focus-visible:border-[#FF4D1C]"
            />
          </label>

          {reposError && <p className="pb-2 text-xs text-[#FF7A52]">{reposError}</p>}
          {repos?.length === 0 && <p className="pb-2 text-xs text-white/40">Enable a repository on the Repositories page to scan it.</p>}
        </div>
        {notice && (
          <p role="status" className="mt-3 text-xs text-[#FF7A52]">
            {notice}
          </p>
        )}
      </Reveal>

      {/* one card per tool, each with its own manual check */}
      <Reveal delay={100}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {TOOL_NAMES.map((tool) => {
            const s = status[tool];
            const running = s.state === "running";
            return (
              <Card key={tool} className="flex flex-col gap-3 p-5">
                <div>
                  <h2 className="text-sm font-medium">{tool}</h2>
                  <p className="mt-0.5 text-xs text-white/45">{TOOL_DESC[tool]}</p>
                </div>

                <div aria-live="polite" className="min-h-[2.5rem] text-xs">
                  {s.state === "idle" && <p className="text-white/40">{loadingSaved ? "Loading last result…" : "Not run yet."}</p>}
                  {running && <p className="text-[#FF7A52]">Cloning and scanning…</p>}
                  {s.state === "done" && (
                    <p className="text-white/60">
                      {plural(s.count ?? 0)} · {s.at}
                      {s.ref ? ` · ${s.ref}` : ""}
                      {s.source && s.source !== "manual" ? ` · ${SOURCE[s.source] ?? s.source}` : ""}
                    </p>
                  )}
                  {s.state === "error" && <p className="text-[#FF7A52]">{s.error}</p>}
                </div>

                <Btn variant="ghost" className="mt-auto" onClick={() => void runTool(tool)} disabled={running || repoId === null}>
                  {running ? "Checking…" : s.state === "idle" ? "Run check" : "Check again"}
                </Btn>
              </Card>
            );
          })}
        </div>
      </Reveal>

      <Reveal delay={140}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Segmented value={filter} onChange={setFilter} options={[{ id: "all", label: "All" }, ...TOOL_NAMES.map((t) => ({ id: t, label: t }))]} />
          <p aria-live="polite" className="text-sm text-white/50">
            <span className="text-[#FF7A52]">{openCount} open</span> · {resolvedCount} resolved
          </p>
        </div>
      </Reveal>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Reveal delay={180}>
          <Card className="overflow-hidden">
            {list.length === 0 ? (
              <Empty>{hasRun ? "No findings from this tool." : "Run a check to see findings here."}</Empty>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {list.map((f) => {
                  const done = !!states[f.fp];
                  return (
                    <li key={f.id} className={cx("dp-fade flex items-center gap-4 px-5 py-4 transition-opacity duration-300", done && "opacity-45")}>
                      <div className="min-w-0 flex-1">
                        <p className={cx("text-sm", done && "line-through")}>{f.msg}</p>
                        <p className="mt-1 truncate font-mono text-xs text-white/40">
                          {f.file}:{f.line}
                          {f.rule ? ` · ${f.rule}` : ""}
                        </p>
                      </div>
                      <div className="hidden shrink-0 items-center gap-2 sm:flex">
                        <Badge>{f.tool}</Badge>
                        <SevBadge sev={f.sev} />
                      </div>
                      <Btn variant="ghost" className="shrink-0 py-1.5" onClick={() => void toggle(f.fp)}>
                        {done ? "Reopen" : "Resolve"}
                      </Btn>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </Reveal>

        <Reveal delay={220}>
          <Card className="self-start">
            <h2 className="px-5 pt-5 text-sm font-medium">Scan history</h2>
            {history.length === 0 ? (
              <Empty>No scans yet for this repository.</Empty>
            ) : (
              <ul className="mt-3 divide-y divide-white/[0.06]">
                {history.map((s) => (
                  <li key={s.id} className="dp-fade flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="text-white/80">
                        {s.tool} · {stamp(s.ts)}
                      </p>
                      <p className="truncate text-xs text-white/40">{s.repo}</p>
                    </div>
                    <span className="shrink-0 text-xs text-white/55">{s.result}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Reveal>
      </div>
    </div>
  );
}