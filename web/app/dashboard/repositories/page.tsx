"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { Badge, Btn, Card, Empty, PageHeader, Reveal, cx } from "../_components/ui";

type Repo = {
  id: number;
  installation_id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  language: string | null;
  analysis_status: "pending" | "running" | "completed" | "failed";
  last_analyzed_at: string | null;
  analyze_enabled: boolean;
};
type Installation = { id: number; account_login: string; account_type: string };

function manageUrl(i: Installation) {
  return i.account_type === "Organization"
    ? `https://github.com/organizations/${i.account_login}/settings/installations/${i.id}`
    : `https://github.com/settings/installations/${i.id}`;
}

function ago(iso: string | null) {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return `${Math.round(hrs / 24)} d ago`;
}

function countBy(rows: { repo_id: number }[] | null) {
  const m = new Map<number, number>();
  (rows ?? []).forEach((r) => m.set(r.repo_id, (m.get(r.repo_id) ?? 0) + 1));
  return m;
}

function StatusBadge({ r }: { r: Repo }) {
  if (!r.analyze_enabled) return <Badge>Paused</Badge>;
  if (r.analysis_status === "running") {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-white/60">
        <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF4D1C]" />
        Analyzing…
      </span>
    );
  }
  if (r.analysis_status === "completed") return <Badge tone="plasma">Analyzed {ago(r.last_analyzed_at)}</Badge>;
  if (r.analysis_status === "failed") return <Badge>Analysis failed</Badge>;
  return <Badge>Not analyzed yet</Badge>;
}

export default function RepositoriesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [installs, setInstalls] = useState<Installation[]>([]);
  const [openPrs, setOpenPrs] = useState<Map<number, number>>(new Map());
  const [findings, setFindings] = useState<Map<number, number>>(new Map());
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    // Row-level security returns only the repos this user is allowed to see.
    const [r, i, pr, f] = await Promise.all([
      supabase
        .from("repositories")
        .select("id, installation_id, name, full_name, private, default_branch, language, analysis_status, last_analyzed_at, analyze_enabled")
        .order("full_name"),
      supabase.from("installations").select("id, account_login, account_type"),
      supabase.from("pull_requests").select("repo_id").eq("state", "open"),
      supabase.from("findings").select("repo_id").eq("status", "open"),
    ]);

    if (r.error) {
      console.error("repositories query failed:", r.error.message);
      setError(r.error.message);
    } else {
      const list = (r.data ?? []) as Repo[];
      setRepos(list);
      setOpen((cur) => cur ?? list[0]?.id ?? null);
    }
    setInstalls((i.data ?? []) as Installation[]);
    setOpenPrs(countBy(pr.data));
    setFindings(countBy(f.data));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleAnalysis(repo: Repo) {
    const value = !repo.analyze_enabled;
    setRepos((rs) => rs.map((x) => (x.id === repo.id ? { ...x, analyze_enabled: value } : x)));
    const { error: err } = await createClient().from("repositories").update({ analyze_enabled: value }).eq("id", repo.id);
    if (err) {
      setRepos((rs) => rs.map((x) => (x.id === repo.id ? { ...x, analyze_enabled: !value } : x)));
      setError("Could not save that change. Try again.");
    }
  }

  const connected = installs.length > 0;

  return (
    <div className="space-y-6">
      <Reveal>
        <PageHeader
          title="Repositories"
          desc="The repositories DevPilot can read, and how far along their analysis is."
          action={
            connected ? (
              <Btn variant={adding ? "ghost" : "primary"} onClick={() => setAdding((a) => !a)} aria-expanded={adding}>
                {adding ? "Close" : "Add repository"}
              </Btn>
            ) : undefined
          }
        />
      </Reveal>

      {/* add panel: GitHub decides which repos we can read, so adding happens on GitHub */}
      <div className={cx("grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]", adding ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="min-h-0 overflow-hidden">
          <Card className="space-y-4 p-5">
            <p className="text-sm text-white/55">
              DevPilot can only read the repositories you share with it on GitHub. Pick more there, press Save, and you will
              come back here with the new list.
            </p>
            <div className="flex flex-wrap gap-2">
              {installs.map((i) => (
                <a
                  key={i.id}
                  href={manageUrl(i)}
                  tabIndex={adding ? 0 : -1}
                  className="rounded-md border border-white/15 px-3 py-2 text-xs text-white/75 transition-colors hover:border-white/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Choose repositories for {i.account_login}
                </a>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {error && <p className="text-xs text-[#FF7A52]">Something went wrong: {error}</p>}

      <Reveal delay={100}>
        <Card className="overflow-hidden">
          {loading ? (
            <Empty>Loading repositories…</Empty>
          ) : !connected ? (
            <div className="space-y-4 p-5">
              <p className="text-sm text-white/55">GitHub is not connected yet. Choose which repositories DevPilot may read.</p>
              <Btn onClick={() => window.location.assign("/api/github/install")}>Connect GitHub</Btn>
            </div>
          ) : repos.length === 0 ? (
            <Empty>No repositories were shared with DevPilot. Use “Add repository” to pick some on GitHub.</Empty>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {repos.map((r) => {
                const on = open === r.id;
                const analyzed = r.analysis_status === "completed";
                const nFindings = findings.get(r.id) ?? 0;
                const nPrs = openPrs.get(r.id) ?? 0;
                const install = installs.find((i) => i.id === r.installation_id);
                return (
                  <li key={r.id} className="dp-fade">
                    <button
                      type="button"
                      aria-expanded={on}
                      onClick={() => setOpen(on ? null : r.id)}
                      className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.full_name}</p>
                        <p className="mt-0.5 text-xs text-white/40">{r.language ?? "Language not detected"}</p>
                      </div>

                      <div className="hidden w-44 sm:block">
                        <StatusBadge r={r} />
                      </div>

                      <span className="w-20 text-right text-xs text-white/50">
                        {analyzed ? `${nFindings} ${nFindings === 1 ? "finding" : "findings"}` : "—"}
                      </span>

                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={cx("h-4 w-4 text-white/40 transition-transform duration-300", on && "rotate-180")} aria-hidden>
                        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>

                    <div className={cx("grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]", on ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                      <div className="min-h-0 overflow-hidden">
                        <div className="space-y-4 px-5 pb-5">
                          <dl className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <dt className="text-xs text-white/40">Visibility</dt>
                              <dd className="mt-1">{r.private ? "Private" : "Public"}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-white/40">Open pull requests</dt>
                              <dd className="mt-1">{nPrs > 0 ? nPrs : "—"}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-white/40">Default branch</dt>
                              <dd className="mt-1 font-mono text-xs">{r.default_branch}</dd>
                            </div>
                          </dl>

                          {r.language && (
                            <div className="flex flex-wrap gap-2">
                              <Badge>{r.language}</Badge>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2">
                            <Btn variant="ghost" className="py-1.5" disabled title="Scanners arrive in the next phase">
                              Analyze again
                            </Btn>
                            <Btn variant="ghost" className="py-1.5" onClick={() => toggleAnalysis(r)}>
                              {r.analyze_enabled ? "Pause analysis" : "Resume analysis"}
                            </Btn>
                            {install && (
                              <a
                                href={manageUrl(install)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center rounded-md border border-white/15 px-3 py-1.5 text-sm text-white/75 transition-colors hover:border-[#FF4D1C]/50 hover:text-[#FF7A52]"
                              >
                                Remove on GitHub
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </Reveal>
    </div>
  );
}