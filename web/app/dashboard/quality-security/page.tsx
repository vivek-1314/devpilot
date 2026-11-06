"use client";

import { useEffect, useRef, useState } from "react";
import { FINDINGS, SCANS, type Tool } from "../_components/data";
import { Badge, Btn, Card, Empty, PageHeader, Reveal, Segmented, SevBadge, cx } from "../_components/ui";

type Filter = "all" | Tool;

export default function QualitySecurityPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [scans, setScans] = useState(SCANS);
  const [scanning, setScanning] = useState(false);
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const list = FINDINGS.filter((f) => filter === "all" || f.tool === filter);
  const openCount = FINDINGS.filter((f) => !resolved.has(f.id)).length;

  const toggle = (id: string) =>
    setResolved((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const runScan = () => {
    setScanning(true);
    timer.current = window.setTimeout(() => {
      setScans((s) => [
        { id: `s${Date.now()}`, when: "Just now", repo: "acme/api", result: `${openCount} ${openCount === 1 ? "finding" : "findings"}` },
        ...s,
      ]);
      setScanning(false);
    }, 2200);
  };

  return (
    <div className="space-y-6">
      <Reveal>
        <PageHeader
          title="Quality & security"
          desc="What Ruff, Bandit and Gitleaks found. Results say what the checks found, nothing more."
          action={
            <Btn onClick={runScan} disabled={scanning}>
              {scanning ? "Scanning…" : "Run scan"}
            </Btn>
          }
        />
      </Reveal>

      {/* scan sweep */}
      <div aria-hidden className={cx("h-px overflow-hidden bg-white/10 transition-opacity duration-300", scanning ? "opacity-100" : "opacity-0")}>
        <div className="dp-sweep h-full w-1/4 bg-[#FF4D1C] shadow-[0_0_10px_rgba(255,77,28,0.9)]" />
      </div>

      <Reveal delay={80}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { id: "all", label: "All" },
              { id: "Ruff", label: "Ruff" },
              { id: "Bandit", label: "Bandit" },
              { id: "Gitleaks", label: "Gitleaks" },
            ]}
          />
          <p aria-live="polite" className="text-sm text-white/50">
            <span className="text-[#FF7A52]">{openCount} open</span> · {resolved.size} resolved
          </p>
        </div>
      </Reveal>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Reveal delay={140}>
          <Card className="overflow-hidden">
            {list.length === 0 ? (
              <Empty>No findings from this tool.</Empty>
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

        <Reveal delay={200}>
          <Card className="self-start">
            <h2 className="px-5 pt-5 text-sm font-medium">Scan history</h2>
            <ul className="mt-3 divide-y divide-white/[0.06]">
              {scans.map((s) => (
                <li key={s.id} className="dp-fade flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="text-white/80">{s.when}</p>
                    <p className="text-xs text-white/40">{s.repo}</p>
                  </div>
                  <span className="shrink-0 text-xs text-white/55">{s.result}</span>
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}