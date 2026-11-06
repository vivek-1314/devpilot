"use client";

import { useEffect, useState } from "react";
import { FAILED_RUNS } from "../_components/data";
import { Badge, Btn, Card, PageHeader, Reveal, cx } from "../_components/ui";

interface Task {
  id: string;
  run: string;
  step: number; // completed steps, 0 to 4
  approved: boolean;
}

const STEPS = ["Read the logs and diff", "Find the likely cause", "Draft a patch", "Verify in a sandbox"];

const run = (id: string) => FAILED_RUNS.find((r) => r.id === id)!;

export default function AiAgentPage() {
  const [tasks, setTasks] = useState<Task[]>([
    { id: "t1", run: "r480", step: 4, approved: false },
    { id: "t2", run: "r477", step: 4, approved: true },
  ]);
  const [selId, setSelId] = useState("t1");
  const [pick, setPick] = useState("");

  const free = FAILED_RUNS.filter((r) => !tasks.some((t) => t.run === r.id));
  const runId = free.find((r) => r.id === pick)?.id ?? free[0]?.id;
  const busy = tasks.some((t) => t.step < 4);
  const sel = tasks.find((t) => t.id === selId) ?? tasks[0];
  const r = sel ? run(sel.run) : null;

  /* demo: running tasks advance one step at a time */
  useEffect(() => {
    if (!busy) return;
    const id = window.setInterval(() => {
      setTasks((ts) => ts.map((t) => (t.step < 4 ? { ...t, step: t.step + 1 } : t)));
    }, 1100);
    return () => window.clearInterval(id);
  }, [busy]);

  const start = () => {
    if (!runId) return;
    const id = `t${Date.now()}`;
    setTasks((ts) => [{ id, run: runId, step: 0, approved: false }, ...ts]);
    setSelId(id);
  };

  const approve = (id: string) => setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, approved: true } : t)));

  const status = (t: Task) =>
    t.step < 4 ? <Badge tone="plasma">Working</Badge> : t.approved ? <Badge>Done</Badge> : <Badge tone="ember">Needs approval</Badge>;

  return (
    <div className="space-y-6">
      <Reveal>
        <PageHeader title="AI agent" desc="Investigates a failed run, drafts a fix and tests it in a sandbox. Nothing opens until you approve." />
      </Reveal>

      {/* new investigation */}
      <Reveal delay={80}>
        <Card className="flex flex-wrap items-center gap-3 p-4">
          <label className="text-sm text-white/55" htmlFor="run">
            Investigate
          </label>
          <select
            id="run"
            value={runId ?? ""}
            onChange={(e) => setPick(e.target.value)}
            disabled={free.length === 0}
            className="min-w-0 flex-1 rounded-md border border-white/10 bg-[#0e0b0b] px-3 py-2 text-sm outline-none transition-colors focus:border-[#FF4D1C]/60 sm:max-w-sm"
          >
            {free.length === 0 && <option>No failed runs left</option>}
            {free.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
          <Btn onClick={start} disabled={!runId}>
            Start
          </Btn>
        </Card>
      </Reveal>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {/* tasks */}
        <Reveal delay={140}>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-white/[0.06]">
              {tasks.map((t) => {
                const on = sel?.id === t.id;
                return (
                  <li key={t.id} className="dp-fade">
                    <button
                      type="button"
                      aria-current={on}
                      onClick={() => setSelId(t.id)}
                      className={cx(
                        "relative flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white",
                        on ? "bg-[#FF4D1C]/[0.06]" : "hover:bg-white/[0.02]"
                      )}
                    >
                      <span aria-hidden className={cx("absolute inset-y-3 left-0 w-0.5 rounded-full bg-[#FF4D1C] transition-opacity duration-300", on ? "opacity-100" : "opacity-0")} />
                      <span className="min-w-0 truncate text-sm">{run(t.run).label}</span>
                      {status(t)}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </Reveal>

        {/* detail */}
        <Reveal delay={200}>
          {sel && r && (
            <Card key={sel.id} className="dp-fade p-5">
              <h2 className="text-lg">{r.label}</h2>

              {/* steps */}
              <ol className="mt-5 space-y-3">
                {STEPS.map((s, i) => {
                  const done = sel.step > i;
                  const current = sel.step === i;
                  return (
                    <li key={s} className="flex items-center gap-3 text-sm">
                      <span
                        aria-hidden
                        className={cx(
                          "flex h-5 w-5 items-center justify-center rounded-full border text-[10px] transition-all duration-500",
                          done ? "border-[#4F7BFF] bg-[#4F7BFF] text-white" : current ? "dp-ping border-[#4F7BFF] text-[#7D9CFF]" : "border-white/15 text-transparent"
                        )}
                      >
                        {done ? "✓" : "•"}
                      </span>
                      <span className={cx("transition-colors duration-500", done ? "text-white/85" : current ? "text-white" : "text-white/35")}>{s}</span>
                    </li>
                  );
                })}
              </ol>

              {/* cause */}
              {sel.step >= 2 && (
                <div className="dp-rise mt-6">
                  <h3 className="text-sm font-medium">Likely cause</h3>
                  <p className="mt-2 text-sm leading-6 text-white/65">{r.cause} This is a likely cause, not a verdict.</p>
                </div>
              )}

              {/* patch */}
              {sel.step >= 3 && (
                <div className="dp-rise mt-6">
                  <h3 className="text-sm font-medium">
                    Proposed patch <span className="ml-1 font-mono text-xs font-normal text-white/40">{r.file}</span>
                  </h3>
                  <div className="mt-2 overflow-x-auto rounded-lg border border-white/10 py-2 font-mono text-xs leading-6">
                    {r.diff.map((l, i) => (
                      <div
                        key={i}
                        className={cx(
                          "whitespace-pre px-4",
                          l.k === "del" && "bg-[#FF4D1C]/15 text-[#FF7A52]",
                          l.k === "add" && "bg-[#4F7BFF]/15 text-[#7D9CFF]",
                          l.k === "ctx" && "text-white/45"
                        )}
                      >
                        {l.k === "del" ? "- " : l.k === "add" ? "+ " : "  "}
                        {l.t}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* verification and approval */}
              {sel.step >= 4 && (
                <div className="dp-rise mt-6">
                  <p className="text-sm text-[#7D9CFF]">Sandbox: {r.verify}</p>
                  <div className="mt-4">
                    {sel.approved ? (
                      <p className="text-sm text-white/55">Pull request opened after your approval.</p>
                    ) : (
                      <Btn onClick={() => approve(sel.id)}>Approve and open pull request</Btn>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )}
        </Reveal>
      </div>
    </div>
  );
}