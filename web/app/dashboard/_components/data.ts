/* Mock data. Replace each export with a real API call later. */

export interface Repo {
  id: string;
  name: string;
  lang: string;
  stack: string[];
  status: "analyzed" | "analyzing";
  progress: number;
  analyzed: string;
  files: number;
  openPrs: number;
  findings: number;
  branch: string;
}

export const REPOS: Repo[] = [
  {
    id: "acme/api", name: "acme/api", lang: "Python", stack: ["FastAPI", "PostgreSQL", "Docker"],
    status: "analyzed", progress: 100, analyzed: "12 min ago", files: 184, openPrs: 4, findings: 3, branch: "main",
  },
  {
    id: "acme/web", name: "acme/web", lang: "TypeScript", stack: ["Next.js", "Tailwind CSS"],
    status: "analyzing", progress: 62, analyzed: "Running now", files: 312, openPrs: 3, findings: 1, branch: "main",
  },
];

export const AVAILABLE_REPOS = [
  { name: "acme/infra", lang: "Go" },
  { name: "acme/docs", lang: "Markdown" },
  { name: "acme/mobile", lang: "Kotlin" },
];

export type PrState = "open" | "failed" | "merged";
export type PrChecks = "passed" | "failed" | "flagged";

export interface Pr {
  n: number;
  title: string;
  author: string;
  repo: string;
  state: PrState;
  checks: PrChecks;
  files: number;
  add: number;
  del: number;
  findings: string[];
  review: string;
}

export const PRS: Pr[] = [
  {
    n: 221, title: "Fix token None for new users", author: "mira", repo: "acme/api", state: "open", checks: "passed",
    files: 2, add: 12, del: 3, findings: [],
    review: "A small, focused change. It guards the None case in get_token and adds a test. Safe to merge once CI is green.",
  },
  {
    n: 220, title: "Add rate limit to analyze endpoint", author: "jonas", repo: "acme/api", state: "failed", checks: "failed",
    files: 3, add: 54, del: 8, findings: ["tests / test_limits fails on the second request"],
    review: "The limiter keys on the repository, not the user, so tests share a counter. Key it on the user id.",
  },
  {
    n: 219, title: "Add repository importer", author: "priya", repo: "acme/api", state: "open", checks: "flagged",
    files: 4, add: 96, del: 0, findings: ["importer.py:31 runs a command from the cloned repository"],
    review: "The importer runs make test from a cloned repository on the host. Move that step into the sandbox before merging.",
  },
  {
    n: 218, title: "Log token for debugging", author: "devon", repo: "acme/api", state: "open", checks: "flagged",
    files: 1, add: 2, del: 0, findings: ["auth/tokens.py:3 writes a token to the logs"],
    review: "This logs the raw token. Log the user login instead, and rotate the token if this already reached production.",
  },
  {
    n: 217, title: "Update CI workflow", author: "mira", repo: "acme/web", state: "merged", checks: "passed",
    files: 1, add: 6, del: 2, findings: [],
    review: "Adds a cache step to the workflow. No findings.",
  },
  {
    n: 216, title: "Bump FastAPI", author: "jonas", repo: "acme/api", state: "merged", checks: "passed",
    files: 2, add: 4, del: 4, findings: [],
    review: "Dependency bump with no code changes. All checks passed.",
  },
];

export type Sev = "high" | "medium" | "low";
export type Tool = "Ruff" | "Bandit" | "Gitleaks";

export interface Finding {
  id: string;
  tool: Tool;
  sev: Sev;
  file: string;
  line: number;
  msg: string;
}

export const FINDINGS: Finding[] = [
  { id: "f1", tool: "Gitleaks", sev: "high", file: "config/settings.py", line: 12, msg: "Value looks like an API token." },
  { id: "f2", tool: "Bandit", sev: "medium", file: "repos/importer.py", line: 31, msg: "A subprocess call runs a command from a cloned repository." },
  { id: "f3", tool: "Bandit", sev: "low", file: "db.py", line: 9, msg: "Possible hardcoded password string." },
  { id: "f4", tool: "Ruff", sev: "low", file: "routes/analyze.py", line: 48, msg: "Unused import: typing.Optional." },
  { id: "f5", tool: "Ruff", sev: "low", file: "services/graph.py", line: 77, msg: "Line too long (112 > 100)." },
];

export const SCANS = [
  { id: "s1", when: "Today, 09:14", repo: "acme/api", result: "5 findings" },
  { id: "s2", when: "Yesterday, 16:02", repo: "acme/api", result: "6 findings" },
  { id: "s3", when: "Yesterday, 10:05", repo: "acme/web", result: "1 finding" },
];

export type EventKind = "repo" | "analysis" | "agent";

export const EVENTS: { id: string; kind: EventKind; text: string; repo: string; time: string; day: string }[] = [
  { id: "e1", kind: "repo", text: "Pull request #221 opened", repo: "acme/api", time: "09:30", day: "Today" },
  { id: "e2", kind: "agent", text: "Agent verified a patch in the sandbox", repo: "acme/api", time: "09:26", day: "Today" },
  { id: "e3", kind: "analysis", text: "Analysis finished", repo: "acme/api", time: "09:14", day: "Today" },
  { id: "e4", kind: "repo", text: "Push to main", repo: "acme/api", time: "09:12", day: "Today" },
  { id: "e5", kind: "agent", text: "Agent found the likely cause of run 480", repo: "acme/api", time: "17:40", day: "Yesterday" },
  { id: "e6", kind: "analysis", text: "Gitleaks flagged config/settings.py:12", repo: "acme/api", time: "16:02", day: "Yesterday" },
  { id: "e7", kind: "repo", text: "Pull request #217 merged", repo: "acme/web", time: "11:20", day: "Yesterday" },
  { id: "e8", kind: "repo", text: "Repository connected", repo: "acme/web", time: "10:05", day: "Yesterday" },
];

/* code intelligence */

export const GRAPH_NODES = [
  { id: "main", x: 300, y: 36, file: "app/main.py" },
  { id: "routes", x: 120, y: 120, file: "app/routes/analyze.py" },
  { id: "auth", x: 300, y: 120, file: "app/auth/tokens.py" },
  { id: "services", x: 480, y: 120, file: "app/services/" },
  { id: "graph", x: 380, y: 208, file: "app/services/graph.py" },
  { id: "db", x: 540, y: 208, file: "app/db.py" },
  { id: "postgres", x: 540, y: 286, file: "PostgreSQL (external)" },
];

export const GRAPH_EDGES: [string, string][] = [
  ["main", "routes"], ["main", "auth"], ["main", "services"],
  ["routes", "auth"], ["routes", "services"],
  ["services", "graph"], ["services", "db"], ["db", "postgres"],
];

export const SYMBOLS = [
  { name: "get_token", kind: "function", file: "auth/tokens.py", line: 2, refs: 7 },
  { name: "load_token", kind: "function", file: "auth/tokens.py", line: 14, refs: 3 },
  { name: "analyze", kind: "route", file: "routes/analyze.py", line: 21, refs: 1 },
  { name: "current_user", kind: "function", file: "auth/session.py", line: 8, refs: 12 },
  { name: "RepoImporter", kind: "class", file: "repos/importer.py", line: 5, refs: 4 },
  { name: "build_graph", kind: "function", file: "services/graph.py", line: 30, refs: 5 },
  { name: "run_scan", kind: "function", file: "services/scans.py", line: 18, refs: 6 },
  { name: "get_session", kind: "function", file: "db.py", line: 11, refs: 9 },
];

export const QA = [
  { q: "Where are tokens loaded?", a: "Tokens are loaded in auth/tokens.py by load_token, and get_token wraps it. Both are called from routes/analyze.py before any request to GitHub." },
  { q: "What does the analyze endpoint do?", a: "POST /analyze in routes/analyze.py checks the current user, queues the repository for analysis and returns a job id. Scans run later, inside the sandbox." },
  { q: "Which files touch the database?", a: "Only db.py talks to PostgreSQL directly. services/graph.py reads and writes through its helpers." },
];

/* AI agent */

export interface DiffLine { k: "ctx" | "del" | "add"; t: string }

export const FAILED_RUNS: {
  id: string; label: string; cause: string; file: string; diff: DiffLine[]; verify: string;
}[] = [
  {
    id: "r480", label: "Run 480 · tests / test_tokens",
    cause: "load_token returns None for new users, so get_token fails.", file: "auth/tokens.py",
    diff: [
      { k: "ctx", t: "def get_token(user):" },
      { k: "ctx", t: "    token = load_token(user)" },
      { k: "del", t: "    return token.value" },
      { k: "add", t: "    return token.value if token else None" },
    ],
    verify: "12 tests executed, 0 failed",
  },
  {
    id: "r477", label: "Run 477 · lint / ruff",
    cause: "An unused import was left behind in routes/analyze.py.", file: "routes/analyze.py",
    diff: [
      { k: "del", t: "from typing import Optional" },
      { k: "ctx", t: "from fastapi import APIRouter" },
    ],
    verify: "ruff reports no issues",
  },
  {
    id: "r484", label: "Run 484 · tests / test_graph",
    cause: "build_graph assumes every module has an import list.", file: "services/graph.py",
    diff: [
      { k: "del", t: "    for dep in module.imports:" },
      { k: "add", t: "    for dep in module.imports or []:" },
    ],
    verify: "9 tests executed, 0 failed",
  },
  {
    id: "r479", label: "Run 479 · lint / ruff",
    cause: "A line in services/graph.py is longer than the 100 character limit.", file: "services/graph.py",
    diff: [
      { k: "del", t: "    result = compute_edges(modules, include_external=True, resolve_aliases=True, depth=4)" },
      { k: "add", t: "    result = compute_edges(" },
      { k: "add", t: "        modules, include_external=True, resolve_aliases=True, depth=4" },
      { k: "add", t: "    )" },
    ],
    verify: "ruff reports no issues",
  },
];