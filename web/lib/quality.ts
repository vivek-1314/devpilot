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
  id: string;
  tool: ToolName;
  msg: string;
  file: string;
  line: number | string;
  sev: Sev;
  rule?: string;
};

export class QualityError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function friendly(status: number, detail?: string): string {
  if (status === 401) return "You are signed out. Sign in again and retry.";
  if (status === 404) return "Repository not found, or you don't have access to it.";
  if (status === 422) return "Pick a repository first.";
  if (status === 504) return "The check took too long. Try again.";
  return detail || "The check failed. Try again.";
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

function toSev(tool: ToolName, raw: unknown): Sev {
  if (tool === "Gitleaks") return "high" as Sev; // a leaked secret is always urgent
  const key = String(raw ?? "").toLowerCase();
  return (SEV_MAP[key] ?? "medium") as Sev;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalize(tool: ToolName, data: any): UiFinding[] {
  const raw: any[] = data?.findings ?? data?.issues ?? data?.results ?? [];
  const seen = new Map<string, number>();

  return raw.map((r) => {
    const file = String(r.file ?? r.path ?? r.filename ?? r.location?.file ?? "");
    const line = r.line ?? r.line_number ?? r.start_line ?? r.location?.row ?? r.location?.line ?? 0;
    const rule = r.rule ?? r.rule_id ?? r.code ?? r.test_id ?? r.check_id ?? undefined;
    const msg = String(r.message ?? r.msg ?? r.description ?? r.issue_text ?? rule ?? "Finding");

    // Stable id so "Resolve" survives a re-run. Duplicates get a counter.
    const base = `${tool}:${file}:${line}:${rule ?? msg}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);

    return {
      id: n === 1 ? base : `${base}#${n}`,
      tool,
      msg,
      file,
      line,
      rule,
      sev: toSev(tool, r.severity ?? r.sev ?? r.level ?? r.issue_severity),
    };
  });
}

// ---- API call ----------------------------------------------------------------

export async function runQualityScan(tool: ToolName, repoId: number, ref?: string): Promise<UiFinding[]> {
  let res: Response;
  try {
    res = await fetch(`/api/quality/${TOOL_SLUG[tool]}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo_id: repoId, ...(ref ? { ref } : {}) }),
    });
  } catch {
    throw new QualityError(0, "Network error. Check your connection and retry.");
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = typeof body?.detail === "string" ? body.detail : undefined;
    throw new QualityError(res.status, friendly(res.status, detail));
  }
  return normalize(tool, body);
}