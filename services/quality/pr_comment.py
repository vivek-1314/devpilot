"""DevPilot PR comment: pick the important findings and post ONE comment per PR.

Usage (at the end of your /quality/pr handler, after scans finish and are saved):

    await post_pr_review(
        token=installation_token,          # GitHub App installation access token
        full_name="vivek-1314/devpilot",
        number=2,
        findings=all_findings,             # flat list of finding dicts from all 4 tools
        report_url="https://your-dashboard/repos/123/pr/2",
        dismissed_ids=dismissed_ids,       # optional: ids the user already dismissed
    )

Each finding dict is expected to look like:
    {"id", "tool", "sev", "file", "line", "rule", "msg"}
"""
import logging

import httpx

log = logging.getLogger(__name__)

API = "https://api.github.com"
MARKER = "<!-- devpilot-pr-review -->"  # lets us find our own comment and update it
MAX_SHOWN = 10                          # never list more than this on the PR

SEV_RANK = {"critical": 0, "high": 1, "medium": 2, "low": 3}
TOOL_RANK = {"Gitleaks": 0, "Bandit": 1, "Ruff": 2, "ESLint": 3}

# Bandit rules that fire on almost every project that runs subprocesses/asserts.
NOISY_RULES = {"B404", "B603", "B607", "B101"}

# Lint rules that usually mean a real bug, not style.
LINT_MUST_SHOW = {"F821", "F811", "E999", "E902", "no-undef", "no-unreachable"}


def _is_important(f: dict) -> bool:
    tool, rule, sev = f.get("tool"), f.get("rule"), (f.get("sev") or "").lower()

    if tool == "Gitleaks":
        return True  # a secret is always worth showing
    if rule in NOISY_RULES:
        return False
    if tool == "Bandit":
        return sev in ("critical", "high", "medium")
    # Ruff / ESLint: only high severity or rules that usually indicate real bugs
    return sev in ("critical", "high") or rule in LINT_MUST_SHOW


def _to_dict(f) -> dict:
    """Findings may be dicts or pydantic models (v2 or v1); always return a dict."""
    if isinstance(f, dict):
        d = dict(f)
    elif hasattr(f, "model_dump"):
        d = f.model_dump()
    else:
        d = f.dict()
    path = (d.get("file") or "").replace("\\", "/")
    while path.startswith("./"):
        path = path[2:]
    d["file"] = path
    return d


def select_important(findings, changed_files, dismissed_ids=()):
    """Return (important_sorted, hidden_count) for findings in files this PR changed."""
    findings = [_to_dict(f) for f in findings]
    dismissed = set(dismissed_ids)
    in_pr = [
        f for f in findings
        if f.get("file") in changed_files and f.get("id") not in dismissed
    ]
    important = [f for f in in_pr if _is_important(f)]
    important.sort(
        key=lambda f: (
            SEV_RANK.get((f.get("sev") or "").lower(), 9),
            TOOL_RANK.get(f.get("tool"), 9),
            f.get("file") or "",
            f.get("line") or 0,
        )
    )
    return important, len(in_pr) - len(important)


def _cell(text: str, limit: int = 110) -> str:
    text = (text or "").replace("|", "\\|").replace("\n", " ").strip()
    return text if len(text) <= limit else text[: limit - 1] + "…"


def build_comment(important, hidden, report_url, sha=None):
    lines = [MARKER, "### DevPilot review", ""]

    if not important:
        lines.append("No important issues found in the files changed by this PR.")
    else:
        counts = {}
        for f in important:
            s = (f.get("sev") or "low").lower()
            counts[s] = counts.get(s, 0) + 1
        summary = " · ".join(
            f"{counts[s]} {s}" for s in ("critical", "high", "medium", "low") if s in counts
        )
        lines += [f"**{len(important)} important finding(s):** {summary}", ""]
        lines += ["| Severity | Tool | Location | Issue |", "|---|---|---|---|"]
        for f in important[:MAX_SHOWN]:
            loc = f"`{f.get('file')}:{f.get('line')}`"
            lines.append(
                f"| {f.get('sev')} | {f.get('tool')} | {loc} | "
                f"{_cell(f.get('msg'))} (`{f.get('rule')}`) |"
            )
        if len(important) > MAX_SHOWN:
            lines.append("")
            lines.append(f"…and {len(important) - MAX_SHOWN} more in the full report.")

    if hidden:
        lines += ["", f"{hidden} lower-priority finding(s) in changed files are hidden."]

    if report_url:
        lines += ["", f"[View full report]({report_url})"]
    if sha:
        lines.append(f"<sub>Scanned commit {sha[:7]}</sub>")
    return "\n".join(lines)


async def _changed_files(client, headers, full_name, number) -> set[str]:
    files, page = set(), 1
    while True:
        r = await client.get(
            f"{API}/repos/{full_name}/pulls/{number}/files",
            params={"per_page": 100, "page": page},
            headers=headers,
        )
        r.raise_for_status()
        data = r.json()
        files.update(item["filename"] for item in data)
        if len(data) < 100:
            return files
        page += 1


async def _existing_comment_id(client, headers, full_name, number):
    page = 1
    while True:
        r = await client.get(
            f"{API}/repos/{full_name}/issues/{number}/comments",
            params={"per_page": 100, "page": page},
            headers=headers,
        )
        r.raise_for_status()
        data = r.json()
        for c in data:
            if MARKER in (c.get("body") or ""):
                return c["id"]
        if len(data) < 100:
            return None
        page += 1


async def post_pr_review(token, full_name, number, findings, report_url,
                         dismissed_ids=(), sha=None) -> None:
    """Post (or update) the DevPilot comment on a PR. Failures are logged, never raised."""
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            changed = await _changed_files(client, headers, full_name, number)
            important, hidden = select_important(findings, changed, dismissed_ids)
            log.info(
                "PR comment %s#%s: %d findings total, %d changed files, %d important, %d hidden",
                full_name, number, len(findings), len(changed), len(important), hidden,
            )
            body = build_comment(important, hidden, report_url, sha)

            existing = await _existing_comment_id(client, headers, full_name, number)
            if existing:
                r = await client.patch(
                    f"{API}/repos/{full_name}/issues/comments/{existing}",
                    json={"body": body},
                    headers=headers,
                )
            else:
                r = await client.post(
                    f"{API}/repos/{full_name}/issues/{number}/comments",
                    json={"body": body},
                    headers=headers,
                )
            r.raise_for_status()
    except Exception:
        log.exception("could not post PR comment for %s#%s", full_name, number)