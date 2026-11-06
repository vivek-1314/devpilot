"use client";

import { useState } from "react";
import { PRS, type PrChecks, type PrState } from "../_components/data";
import { Badge, Card, Empty, PageHeader, Reveal, Segmented, cx } from "../_components/ui";

type Filter = "all" | PrState;

const CHECK_BADGE: Record<PrChecks, { tone: "plasma" | "ember" | "amber"; label: string }> = {
  passed: { tone: "plasma", label: "Checks passed" },
  failed: { tone: "ember", label: "Checks failed" },
  flagged: { tone: "amber", label: "Has findings" },
};

export default function PullRequestsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [sel, setSel] = useState(PRS[0].n);

  const list = PRS.filter((p) => filter === "all" || p.state === filter);
  const pr = list.find((p) => p.n === sel) ?? list[0];

  return (
    <div className="space-y-6">
      <Reveal>
        <PageHeader title="Pull requests" desc="Every pull request, what changed, what the checks found, and an AI review." />
      </Reveal>

      <Reveal delay={80}>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { id: "all", label: "All" },
            { id: "open", label: "Open" },
            { id: "failed", label: "Failed" },
            { id: "merged", label: "Merged" },
          ]}
        />
      </Reveal>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* list */}
        <Reveal delay={140}>
          <Card className="overflow-hidden">
            {list.length === 0 ? (
              <Empty>No pull requests match this filter.</Empty>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {list.map((p) => {
                  const on = pr?.n === p.n;
                  const b = CHECK_BADGE[p.checks];
                  return (
                    <li key={p.n} className="dp-fade">
                      <button
                        type="button"
                        aria-current={on}
                        onClick={() => setSel(p.n)}
                        className={cx(
                          "relative flex w-full items-center gap-4 px-5 py-4 text-left transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white",
                          on ? "bg-[#FF4D1C]/[0.06]" : "hover:bg-white/[0.02]"
                        )}
                      >
                        <span aria-hidden className={cx("absolute inset-y-3 left-0 w-0.5 rounded-full bg-[#FF4D1C] transition-opacity duration-300", on ? "opacity-100" : "opacity-0")} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">
                            <span className="mr-2 font-mono text-xs text-white/35">#{p.n}</span>
                            {p.title}
                          </p>
                          <p className="mt-0.5 text-xs text-white/40">
                            {p.repo} · {p.author}
                          </p>
                        </div>
                        {p.state === "merged" ? <Badge>Merged</Badge> : <Badge tone={b.tone}>{b.label}</Badge>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </Reveal>

        {/* detail */}
        <Reveal delay={200}>
          <div className="lg:sticky lg:top-20">
            {pr ? (
              <Card key={pr.n} className="dp-fade p-5">
                <p className="font-mono text-xs text-white/40">
                  #{pr.n} · {pr.repo}
                </p>
                <h2 className="mt-1 text-lg">{pr.title}</h2>

                <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-lg bg-white/[0.03] p-3">
                    <dt className="text-xs text-white/40">Files</dt>
                    <dd className="mt-1">{pr.files}</dd>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] p-3">
                    <dt className="text-xs text-white/40">Added</dt>
                    <dd className="mt-1 text-[#7D9CFF]">+{pr.add}</dd>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] p-3">
                    <dt className="text-xs text-white/40">Removed</dt>
                    <dd className="mt-1 text-[#FF7A52]">−{pr.del}</dd>
                  </div>
                </dl>

                <h3 className="mt-6 text-sm font-medium">AI review</h3>
                <p className="mt-2 text-sm leading-6 text-white/65">{pr.review}</p>

                <h3 className="mt-6 text-sm font-medium">Findings</h3>
                {pr.findings.length === 0 ? (
                  <p className="mt-2 text-sm text-white/45">Nothing found by the checks.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {pr.findings.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-white/70">
                        <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF4D1C]" />
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ) : (
              <Card>
                <Empty>Select a pull request to see its details.</Empty>
              </Card>
            )}
          </div>
        </Reveal>
      </div>
    </div>
  );
}