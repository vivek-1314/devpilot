import Link from "next/link";
import { Bars, Card, PageHeader, Reveal, SevBadge, Stat, btnPrimary } from "./_components/ui";
import { EVENTS, FINDINGS, PRS, REPOS } from "./_components/data";

const ACTIVITY = [4, 7, 5, 9, 6, 3, 8, 12, 9, 7, 10, 14, 11, 8];

export default function OverviewPage() {
  const attention = FINDINGS.filter((f) => f.sev !== "low");
  const agentEvents = EVENTS.filter((e) => e.kind === "agent").slice(0, 3);

  return (
    <div className="space-y-6">
      <Reveal>
        <PageHeader
          title="Overview"
          desc="Where your repositories stand today."
          action={
            <Link href="/dashboard/repositories" className={btnPrimary}>
              Add repository
            </Link>
          }
        />
      </Reveal>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Repositories" value={REPOS.length} hint={`${REPOS.filter((r) => r.status === "analyzing").length} analyzing`} delay={60} />
        <Stat label="Open pull requests" value={PRS.filter((p) => p.state !== "merged").length} hint="1 failed checks" delay={120} />
        <Stat label="Open findings" value={FINDINGS.length} hint={`${attention.length} need attention`} tone="ember" delay={180} />
        <Stat label="Agent tasks" value={1} hint="Waiting for your approval" tone="ember" delay={240} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Reveal delay={300} className="lg:col-span-2">
          <Card className="h-full p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-medium">Repository activity</h2>
              <span className="text-xs text-white/40">Last 14 days</span>
            </div>
            <div className="mt-6">
              <Bars values={ACTIVITY} />
            </div>
          </Card>
        </Reveal>

        <Reveal delay={360}>
          <Card className="h-full">
            <div className="flex items-baseline justify-between px-5 pt-5">
              <h2 className="text-sm font-medium">Needs attention</h2>
              <Link href="/dashboard/quality-security" className="text-xs text-[#FF7A52] hover:underline">
                View all
              </Link>
            </div>
            <ul className="mt-3 divide-y divide-white/[0.06]">
              {attention.map((f) => (
                <li key={f.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-mono text-xs text-white/70">
                      {f.file}:{f.line}
                    </p>
                    <SevBadge sev={f.sev} />
                  </div>
                  <p className="mt-1 text-sm text-white/55">{f.msg}</p>
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
      </div>

      <Reveal delay={420}>
        <Card>
          <div className="flex items-baseline justify-between px-5 pt-5">
            <h2 className="text-sm font-medium">Latest from the agent</h2>
            <Link href="/dashboard/ai-agent" className="text-xs text-[#FF7A52] hover:underline">
              Open agent
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-white/[0.06]">
            {agentEvents.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <span className="text-white/75">{e.text}</span>
                <span className="shrink-0 text-xs text-white/40">
                  {e.repo} · {e.day}, {e.time}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </Reveal>
    </div>
  );
}