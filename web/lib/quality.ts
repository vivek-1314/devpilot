import type { ComponentProps } from "react";
import type { SevBadge } from "@/app/dashboard/_components/ui";

export const TOOL_SLUG = {
  Ruff: "ruff",
  Bandit: "bandit",
  Gitleaks: "gitleaks",
  ESLint: "eslint",
} as const;

export type ToolName = keyof typeof TOOL_SLUG;
export const TOOL_NAMES = Object.keys(TOOL_SLUG) as ToolName[];

export const TOOL_DESC: Record<ToolName, string> = {
  Ruff: "Python lint",
  Bandit: "Python security",
  Gitleaks: "Secrets in any language",
  ESLint: "JavaScript and TypeScript lint",
};

type Sev = ComponentProps<typeof SevBadge>["sev"];

export type UiFinding = {
  id: string; // unique within one list (React key)
  fp: string; // stable across scans: ignores line numbers, so Resolve survives a re-run
  tool: ToolName;
  msg: string;
  file: string;
  line: number | string;
  sev: Sev;
  rule?: string;
};

export type FindingStatus = "resolved" | "ignored";

export type SavedScan = {
  findings: UiFinding[];
  at: string; // ISO time of the scan
  ref: string | null;
  source: string; // manual | pr | push
  count: number;
};

export type RepoState = {
  scans: Partial<Record<ToolName, SavedScan>>;
  states: Record<string, FindingStatus>;
};

export class QualityError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function friendly(status: number, detail?: string): string {
  if (status === 401) return "You are signed out. Sign in again and retry.";
  if (status === 403) return detail || "This repository isn't enabled yet.";
  if (status === 404) return "Repository not found, or you don't have access to it.";
  if (status === 422) return "Pick a repository first.";
  if (status === 502 || status === 504) return detail || "The service did not respond. Try again.";
  return detail || "The request failed. Try again.";
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new QualityError(0, "Network error. Check your connection and retry.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = typeof body?.detail === "string" ? body.detail : typeof body?.error === "string" ? body.error : undefined;
    throw new QualityError(res.status, friendly(res.status, detail));
  }
  return body as T;
}

// ---- ScanResult -> UiFinding -------------------------------------------------
// ScanResult's exact shape wasn't shared, so this accepts the common field names.
// Once you know the real model, tighten this function.

const SEV_MAP: Record<string, string> = {
  critical: "high",
  error: "high",
  high: "high",
  warning: "medium",
  medium: "medium",
  moderate: "medium",
  low: "low",
  info: "low",
  note: "low",
};

// Rules that fire on almost any `obj[key]` lookup. Real, but rarely urgent.
const LOW_RULES = new Set(["security/detect-object-injection"]);

function toSev(tool: ToolName, rule: string | undefined, raw: unknown): Sev {
  if (tool === "Gitleaks") return "high" as Sev; // a leaked secret is always urgent
  if (rule && LOW_RULES.has(rule)) return "low" as Sev;
  const key = String(raw ?? "").toLowerCase();
  return (SEV_MAP[key] ?? "medium") as Sev;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawFinding = Record<string, any>;

export function normalize(tool: ToolName, data: unknown): UiFinding[] {
  const d = (data ?? {}) as Record<string, unknown>;
  const raw = [d.findings, d.issues, d.results].find(Array.isArray) as RawFinding[] | undefined;
  const seen = new Map<string, number>();

  return (raw ?? [])
    // ESLint reports its own setup problems ("Definition for rule ... was not found") as findings.
    .filter((r) => !String(r.message ?? r.msg ?? "").startsWith("Definition for rule"))
    .map((r) => {
      const file = String(r.file ?? r.path ?? r.filename ?? r.location?.file ?? "");
      const line = r.line ?? r.line_number ?? r.start_line ?? r.location?.row ?? r.location?.line ?? 0;
      const rule: string | undefined = r.rule ?? r.rule_id ?? r.code ?? r.test_id ?? r.check_id ?? undefined;
      const msg = String(r.message ?? r.msg ?? r.description ?? r.issue_text ?? rule ?? "Finding");

      const fp = `${tool}|${rule ?? ""}|${file}|${msg}`.slice(0, 500); // no line number on purpose
      const base = `${fp}|${line}`;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);

      return {
        id: n === 1 ? base : `${base}#${n}`,
        fp,
        tool,
        msg,
        file,
        line,
        rule,
        sev: toSev(tool, rule, r.severity ?? r.sev ?? r.level ?? r.issue_severity),
      };
    });
}

// ---- API calls ---------------------------------------------------------------

export function runQualityScan(tool: ToolName, repoId: number, ref?: string): Promise<UiFinding[]> {
  return call<unknown>(`/api/quality/${TOOL_SLUG[tool]}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repo_id: repoId, ...(ref ? { ref } : {}) }),
  }).then((data) => normalize(tool, data));
}

type RawScan = { created_at: string; ref: string | null; source: string; finding_count: number; result: unknown };

/** Last saved scan per tool, plus which findings the user resolved or ignored. */
export async function fetchRepoState(repoId: number): Promise<RepoState> {
  const data = await call<{ scans: Record<string, RawScan>; states: Record<string, FindingStatus> }>(
    `/api/backend/quality/repos/${repoId}/latest`,
  );
  const scans: RepoState["scans"] = {};
  for (const name of TOOL_NAMES) {
    const s = data.scans[TOOL_SLUG[name]];
    if (s) scans[name] = { findings: normalize(name, s.result), at: s.created_at, ref: s.ref, source: s.source, count: s.finding_count };
  }
  return { scans, states: data.states ?? {} };
}

export function saveFindingState(repoId: number, fingerprint: string, status: "open" | FindingStatus) {
  return call<{ ok: true }>(`/api/backend/quality/repos/${repoId}/states`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fingerprint, status }),
  });
}

export type Usage = { enabled: boolean; plan: string; limit: number; used: number };

export function setRepoEnabled(repoId: number, enabled: boolean) {
  return call<Usage>(`/api/backend/repos/${repoId}/${enabled ? "enable" : "disable"}`, { method: "POST" });
}

export function fetchUsage(repoId: number) {
  return call<Usage>(`/api/backend/repos/${repoId}/usage`);
}