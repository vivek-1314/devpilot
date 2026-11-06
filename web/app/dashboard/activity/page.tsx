"use client";

import { useState } from "react";
import { EVENTS, type EventKind } from "../_components/data";
import { Card, Empty, PageHeader, Reveal, Segmented, cx } from "../_components/ui";

type Filter = "all" | EventKind;

const DOT: Record<EventKind, string> = {
  repo: "bg-white/60",
  analysis: "bg-[#4F7BFF] shadow-[0_0_8px_rgba(79,123,255,0.8)]",
  agent: "bg-[#FF4D1C] shadow-[0_0_8px_rgba(255,77,28,0.8)]",
};

export default function ActivityPage() {
  const [filter, setFilter] = useState<Filter>("all");

  const list = EVENTS.filter((e) => filter === "all" || e.kind === filter);
  const days = Array.from(new Set(list.map((e) => e.day)));

  return (
    <div className="space-y-6">
      <Reveal>
        <PageHeader title="Activity" desc="Repository events, analysis history and what the agent has done, newest first." />
      </Reveal>

      <Reveal delay={80}>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { id: "all", label: "All" },
            { id: "repo", label: "Repository" },
            { id: "analysis", label: "Analysis" },
            { id: "agent", label: "Agent" },
          ]}
        />
      </Reveal>

      <Reveal delay={140}>
        <Card className="p-5 sm:p-6">
          {list.length === 0 ? (
            <Empty>Nothing here yet.</Empty>
          ) : (
            <div key={filter} className="space-y-8">
              {days.map((day) => (
                <section key={day} aria-label={day}>
                  <h2 className="text-xs text-white/40">{day}</h2>
                  <ol className="relative mt-4 space-y-5 border-l border-white/10 pl-6">
                    {list
                      .filter((e) => e.day === day)
                      .map((e, i) => (
                        <li key={e.id} className="dp-rise relative" style={{ animationDelay: `${i * 70}ms` }}>
                          <span aria-hidden className={cx("absolute -left-[28.5px] top-1.5 h-2 w-2 rounded-full", DOT[e.kind])} />
                          <p className="text-sm text-white/85">{e.text}</p>
                          <p className="mt-0.5 text-xs text-white/40">
                            {e.repo} · {e.time}
                          </p>
                        </li>
                      ))}
                  </ol>
                </section>
              ))}
            </div>
          )}
        </Card>
      </Reveal>
    </div>
  );
}