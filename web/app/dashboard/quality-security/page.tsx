"use client";

import { Badge, Btn, Card, Empty, PageHeader, Reveal, Segmented, SevBadge, cx } from "../_components/ui";
import { QualityError, runQualityScan, TOOL_DESC, TOOL_NAMES, type ToolName, type UiFinding } from "../../../lib/quality";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type Repo = { id: number; full_name: string };

type Filter = "all" | ToolName;

type ToolState = {
  state: "idle" | "running" | "done" | "error";
  at?: string; // time of last successful run
  count?: number;
  error?: string;
};

type HistoryItem = { id: string; when: string; repo: string; tool: ToolName; result: string };

const idle = (): Record<ToolName, ToolState> => ({
  Ruff: { state: "idle" },
  Bandit: { state: "idle" },
  Gitleaks: { state: "idle" },
  ESLint: { state: "idle" },
});

const clock = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function QualitySecurityPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [findings, setFindings] = useState<Record<ToolName, UiFinding[]>>({ Ruff: [], Bandit: [], Gitleaks: [], ESLint: [] });
  const [status, setStatus] = useState(idle);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // TODO: replace these two inputs with your real repository selector.
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [reposError, setReposError] = useState<string | null>(null);
  const [repoId, setRepoId] = useState<number | null>(null);
  const [ref, setRef] = useState("");

  const repoName = repos?.find((r) => r.id === repoId)?.full_name ?? `Repo ${repoId}`;

  const loadRepos = useCallback(async () => {
    // Row-level security returns only the repositories this user may see.
    const { data, error } = await createClient().from("repositories").select("id, full_name").order("full_name");
    if (error) return setReposError(error.message);
    const list = (data ?? []) as Repo[];
    setRepos(list);
    setRepoId((cur) => cur ?? list[0]?.id ?? null);
  }, []);

  useEffect(() => {
    loadRepos();
  }, [loadRepos]);

  // Switching repo clears old results so findings from two repos never mix.
  const changeRepo = (id: number) => {
    setRepoId(id);
    setFindings({ Ruff: [], Bandit: [], Gitleaks: [], ESLint: [] });
    setStatus(idle());
    setResolved(new Set());
  };

  const anyRunning = TOOL_NAMES.some((t) => status[t].state === "running");

  const all = TOOL_NAMES.flatMap((t) => findings[t]);
  const list = all.filter((f) => filter === "all" || f.tool === filter);
  const openCount = all.filter((f) => !resolved.has(f.id)).length;
  const hasRun = TOOL_NAMES.some((t) => status[t].at);

  const toggle = (id: string) =>
    setResolved((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const patch = (tool: ToolName, p: ToolState) => setStatus((s) => ({ ...s, [tool]: p }));

  const runTool = async (tool: ToolName) => {
    if (repoId === null || status[tool].state === "running") return;
    patch(tool, { ...status[tool], state: "running", error: undefined });

    try {
      const result = await runQualityScan(tool, repoId, ref.trim() || undefined);
      setFindings((f) => ({ ...f, [tool]: result })); // replaces only this tool's findings
      patch(tool, { state: "done", at: clock(), count: result.length });
      setHistory((h) => [
        {
          id: `${tool}-${Date.now()}`,
          when: "Just now",
          repo: `${repoName}${ref.trim() ? ` @ ${ref.trim()}` : ""}`,
          tool,
          result: `${result.length} ${result.length === 1 ? "finding" : "findings"}`,
        },
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
                {repos?.length === 0 && <option>No repositories</option>}
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
          {repos?.length === 0 && <p className="pb-2 text-xs text-white/40">No repositories are connected to your account yet.</p>}
        </div>
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
                  {s.state === "idle" && <p className="text-white/40">Not run yet.</p>}
                  {running && <p className="text-[#FF7A52]">Cloning and scanning…</p>}
                  {s.state === "done" && (
                    <p className="text-white/60">
                      {s.count} {s.count === 1 ? "finding" : "findings"} · checked at {s.at}
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
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[{ id: "all", label: "All" }, ...TOOL_NAMES.map((t) => ({ id: t, label: t }))]}
          />
          <p aria-live="polite" className="text-sm text-white/50">
            <span className="text-[#FF7A52]">{openCount} open</span> · {resolved.size} resolved
          </p>
        </div>
      </Reveal>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Reveal delay={180}>
          <Card className="overflow-hidden">
            {list.length === 0 ? (
              <Empty>
                {hasRun ? "No findings from this tool." : "Run a check to see findings here."}
              </Empty>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {list.map((f) => {
                  const done = resolved.has(f.id);
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
                      <Btn variant="ghost" className="shrink-0 py-1.5" onClick={() => toggle(f.id)}>
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
              <Empty>No scans yet in this session.</Empty>
            ) : (
              <ul className="mt-3 divide-y divide-white/[0.06]">
                {history.map((s) => (
                  <li key={s.id} className="dp-fade flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="text-white/80">
                        {s.tool} · {s.when}
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