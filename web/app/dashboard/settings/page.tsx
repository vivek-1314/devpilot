"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { QualityError, setRepoEnabled } from "@/lib/quality";
import { Badge, Btn, Card, Field, PageHeader, ProgressBar, Reveal, Segmented, Switch } from "../_components/ui";

type Tab = "account" | "github" | "workspace" | "preferences" | "usage";

type Profile = { username: string | null; email: string | null; avatar_url: string | null };
type Installation = { id: number; account_login: string; account_type: string; created_at: string };
type Repo = {
  id: number;
  installation_id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  language: string | null;
  analyze_enabled: boolean;
  analysis_status: string;
};
type Prefs = { email_failed_prs: boolean; email_high_findings: boolean; weekly_summary: boolean };
type UsageCounts = { analyses: number; agentRuns: number; repos: number };

// Free plan limits shown on the Usage tab. The repo limit is enforced by the database
// (enforce_repo_limit in migration 001); keep REPO_LIMIT in sync with it.
const REPO_LIMIT = 2;
const LIMITS = { analyses: 100, agentRuns: 20 };

const DEFAULT_PREFS: Prefs = { email_failed_prs: true, email_high_findings: true, weekly_summary: false };

type Data = {
  loading: boolean;
  userId: string | null;
  profile: Profile | null;
  installations: Installation[];
  repos: Repo[];
  prefs: Prefs;
  usage: UsageCounts;
};

function useSettingsData() {
  const [data, setData] = useState<Data>({
    loading: true,
    userId: null,
    profile: null,
    installations: [],
    repos: [],
    prefs: DEFAULT_PREFS,
    usage: { analyses: 0, agentRuns: 0, repos: 0 },
  });

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setData((d) => ({ ...d, loading: false }));
      return;
    }

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const since = monthStart.toISOString();

    // Row-level security makes each query return only this user's data.
    const [p, i, r, pr, sc, ag] = await Promise.all([
      supabase.from("profiles").select("username, email, avatar_url").eq("id", user.id).maybeSingle(),
      supabase.from("installations").select("id, account_login, account_type, created_at"),
      supabase
        .from("repositories")
        .select("id, installation_id, name, full_name, private, default_branch, language, analyze_enabled, analysis_status")
        .order("full_name"),
      supabase
        .from("user_preferences")
        .select("email_failed_prs, email_high_findings, weekly_summary")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.from("scans").select("id", { count: "exact", head: true }).gte("created_at", since),
      supabase.from("agent_runs").select("id", { count: "exact", head: true }).gte("created_at", since),
    ]);

    const repos = (r.data ?? []) as Repo[];
    setData({
      loading: false,
      userId: user.id,
      profile: (p.data as Profile | null) ?? null,
      installations: (i.data ?? []) as Installation[],
      repos,
      prefs: (pr.data as Prefs | null) ?? DEFAULT_PREFS,
      usage: { analyses: sc.count ?? 0, agentRuns: ag.count ?? 0, repos: repos.filter((x) => x.analyze_enabled).length },
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { data, setData, reload: load };
}

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div className="min-w-0">
        <p className="truncate text-sm">{title}</p>
        {hint && <p className="mt-0.5 text-xs text-white/40">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Loading() {
  return <Card className="max-w-xl p-5 text-sm text-white/40">Loading…</Card>;
}

function NotConnected() {
  return (
    <Card className="max-w-xl space-y-4 p-5">
      <div>
        <p className="text-sm">GitHub is not connected yet</p>
        <p className="mt-1 text-xs text-white/40">Choose which repositories DevPilot may read. This takes about a minute.</p>
      </div>
      <Btn onClick={() => window.location.assign("/api/github/install")}>Connect GitHub</Btn>
    </Card>
  );
}

function manageUrl(i: Installation) {
  return i.account_type === "Organization"
    ? `https://github.com/organizations/${i.account_login}/settings/installations/${i.id}`
    : `https://github.com/settings/installations/${i.id}`;
}

/* ---------- Account ---------- */
function Account({ profile }: { profile: Profile | null }) {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await createClient().auth.signOut();
    window.location.assign("/");
  }

  if (!profile) return <Loading />;

  return (
    <Card className="max-w-xl space-y-4 p-5">
      <div className="flex items-center gap-3">
        {profile.avatar_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar_url} alt="" className="h-10 w-10 rounded-full border border-white/10" />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm">{profile.username ?? "GitHub user"}</p>
          <p className="text-xs text-white/40">Signed in with GitHub</p>
        </div>
      </div>
      <Field label="GitHub username" defaultValue={profile.username ?? ""} readOnly />
      <Field label="Email" type="email" defaultValue={profile.email ?? ""} readOnly />
      <Btn variant="ghost" onClick={signOut} disabled={busy}>
        {busy ? "Signing out…" : "Sign out"}
      </Btn>
    </Card>
  );
}

/* ---------- GitHub ---------- */
function GitHub({
  data,
  setRepos,
  reload,
}: {
  data: Data;
  setRepos: (fn: (r: Repo[]) => Repo[]) => void;
  reload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [limit, setLimit] = useState(REPO_LIMIT);
  const [pending, setPending] = useState<Set<number>>(new Set()); // repos with a save in flight
  const { installations, repos, profile } = data;
  const enabledCount = repos.filter((r) => r.analyze_enabled).length;

  if (installations.length === 0) return <NotConnected />;

  const mark = (id: number, on: boolean) =>
    setPending((p) => {
      const n = new Set(p);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  // The backend is the authority: it checks you own the repo and enforces the plan limit.
  // The switch moves right away and snaps back if the server says no.
  async function toggle(repo: Repo, value: boolean) {
    if (pending.has(repo.id)) return;
    setError("");

    if (value && enabledCount >= limit) {
      setError(`Your plan includes ${limit} repositories. Turn one off to turn another on.`);
      return;
    }

    const set = (on: boolean) => setRepos((list) => list.map((r) => (r.id === repo.id ? { ...r, analyze_enabled: on } : r)));
    mark(repo.id, true);
    set(value);
    try {
      const res = await setRepoEnabled(repo.id, value);
      setLimit(res.limit);
      set(res.enabled);
    } catch (e) {
      set(!value);
      setError(e instanceof QualityError ? e.message : "Could not save that change. Try again.");
    } finally {
      mark(repo.id, false);
    }
  }

  async function disconnect() {
    const ok = window.confirm(
      "Disconnect GitHub? DevPilot will lose access to your repositories and its saved results for them will be deleted."
    );
    if (!ok) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/github/disconnect", { method: "POST" });
    if (res.ok) {
      await reload();
    } else {
      setError("Could not disconnect. Try again.");
    }
    setBusy(false);
  }

  return (
    <div className="max-w-xl space-y-4">
      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm">Signed in as {profile?.username ?? "GitHub user"}</p>
            <p className="mt-0.5 text-xs text-white/40">
              DevPilot GitHub App is installed on {installations.map((i) => i.account_login).join(", ")}
            </p>
          </div>
          <Badge tone="plasma">Connected</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {installations.map((i) => (
            <a
              key={i.id}
              href={manageUrl(i)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-white/15 px-3 py-2 text-xs text-white/75 transition-colors hover:border-white/40 hover:text-white"
            >
              Manage {i.account_login} on GitHub
            </a>
          ))}
        </div>
      </Card>

      <Card className="px-5">
        <div className="flex items-baseline justify-between gap-4 pt-4">
          <p className="text-sm font-medium">Repositories</p>
          <p aria-live="polite" className="text-xs text-white/50">
            <span className={enabledCount >= limit ? "text-[#FF7A52]" : "text-white/70"}>{enabledCount}</span> of {limit} enabled
          </p>
        </div>
        <p className="mt-1 text-xs text-white/40">
          GitHub decides which repositories DevPilot can read. These switches choose which of them DevPilot indexes and scans. Your plan allows {limit}.
        </p>
        {repos.length === 0 ? (
          <p className="py-6 text-sm text-white/40">No repositories were shared with DevPilot.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {repos.map((r) => (
              <li key={r.id} className={pending.has(r.id) ? "opacity-60 transition-opacity" : "transition-opacity"}>
                <Row
                  title={r.full_name}
                  hint={[r.private ? "Private" : "Public", r.language, `branch ${r.default_branch}`].filter(Boolean).join(" · ")}
                >
                  <Switch
                    label={`Analyze ${r.full_name}`}
                    checked={r.analyze_enabled}
                    onChange={(v) => toggle(r, v)}
                  />
                </Row>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex items-center gap-3">
        <Btn variant="ghost" className="hover:border-[#FF4D1C]/50 hover:text-[#FF7A52]" onClick={disconnect} disabled={busy}>
          {busy ? "Disconnecting…" : "Disconnect GitHub"}
        </Btn>
        <span role="alert" aria-live="polite" className="text-xs text-[#FF7A52]">
          {error}
        </span>
      </div>
    </div>
  );
}

/* ---------- Workspace ---------- */
function Workspace({ data }: { data: Data }) {
  const { installations, repos } = data;
  if (installations.length === 0) return <NotConnected />;

  return (
    <div className="max-w-xl space-y-4">
      {installations.map((i) => {
        const mine = repos.filter((r) => r.installation_id === i.id);
        return (
          <Card key={i.id} className="space-y-4 p-5">
            <Field label="Workspace" defaultValue={i.account_login} readOnly />
            <Field label="Account type" defaultValue={i.account_type} readOnly />
            <Field
              label="Connected on"
              defaultValue={new Date(i.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
              readOnly
            />
            <Field label="Repositories" defaultValue={String(mine.length)} readOnly />
          </Card>
        );
      })}
    </div>
  );
}

/* ---------- Preferences ---------- */
function Preferences({
  userId,
  prefs,
  setPrefs,
}: {
  userId: string | null;
  prefs: Prefs;
  setPrefs: (p: Prefs) => void;
}) {
  const [msg, setMsg] = useState("");

  async function set(key: keyof Prefs, value: boolean) {
    if (!userId) return;
    const previous = prefs;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    const { error } = await createClient()
      .from("user_preferences")
      .upsert({ user_id: userId, ...next, updated_at: new Date().toISOString() });
    if (error) {
      setPrefs(previous);
      setMsg("Could not save");
    } else {
      setMsg("Saved");
      window.setTimeout(() => setMsg(""), 1500);
    }
  }

  return (
    <div className="max-w-xl space-y-2">
      <Card className="divide-y divide-white/[0.06] px-5">
        <Row title="Email me when a pull request fails" hint="Sent once per failed run">
          <Switch label="Email on failed pull requests" checked={prefs.email_failed_prs} onChange={(v) => set("email_failed_prs", v)} />
        </Row>
        <Row title="Email me about new high severity findings">
          <Switch label="Email on high severity findings" checked={prefs.email_high_findings} onChange={(v) => set("email_high_findings", v)} />
        </Row>
        <Row title="Weekly summary" hint="Every Monday morning">
          <Switch label="Weekly summary" checked={prefs.weekly_summary} onChange={(v) => set("weekly_summary", v)} />
        </Row>
      </Card>
      <p aria-live="polite" className="h-4 text-xs text-[#7D9CFF]">
        {msg}
      </p>
    </div>
  );
}

/* ---------- Usage ---------- */
function Usage({ usage }: { usage: UsageCounts }) {
  const rows = [
    { label: "Analyses this month", used: usage.analyses, max: LIMITS.analyses },
    { label: "Agent runs this month", used: usage.agentRuns, max: LIMITS.agentRuns },
    { label: "Enabled repositories", used: usage.repos, max: REPO_LIMIT },
  ];
  return (
    <Card className="max-w-xl space-y-6 p-5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-2 flex items-baseline justify-between text-sm">
            <span className="text-white/75">{r.label}</span>
            <span className="text-xs text-white/45">
              {r.used} of {r.max}
            </span>
          </div>
          <ProgressBar value={Math.min(100, (r.used / r.max) * 100)} />
        </div>
      ))}
    </Card>
  );
}

/* ---------- Page ---------- */
export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("account");
  const { data, setData, reload } = useSettingsData();

  // Enabled repos change on the GitHub tab, so the Usage tab counts them from the live list.
  const usage = { ...data.usage, repos: data.repos.filter((r) => r.analyze_enabled).length };

  return (
    <div className="space-y-6">
      <Reveal>
        <PageHeader title="Settings" desc="Your account, GitHub connection, workspace, preferences and usage." />
      </Reveal>

      <Reveal delay={80}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { id: "account", label: "Account" },
            { id: "github", label: "GitHub" },
            { id: "workspace", label: "Workspace" },
            { id: "preferences", label: "Preferences" },
            { id: "usage", label: "Usage" },
          ]}
        />
      </Reveal>

      <div key={tab} className="dp-rise">
        {data.loading ? (
          <Loading />
        ) : (
          <>
            {tab === "account" && <Account profile={data.profile} />}
            {tab === "github" && (
              <GitHub
                data={data}
                setRepos={(fn) => setData((d) => ({ ...d, repos: fn(d.repos) }))}
                reload={reload}
              />
            )}
            {tab === "workspace" && <Workspace data={data} />}
            {tab === "preferences" && (
              <Preferences
                userId={data.userId}
                prefs={data.prefs}
                setPrefs={(p) => setData((d) => ({ ...d, prefs: p }))}
              />
            )}
            {tab === "usage" && <Usage usage={usage} />}
          </>
        )}
      </div>
    </div>
  );
}