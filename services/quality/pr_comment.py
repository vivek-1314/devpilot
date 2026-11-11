"""DevPilot PR comment: list the findings in files changed by a PR and post ONE comment per PR.

Usage (at the end of your /quality/pr handler, after scans finish and are saved):

    await post_pr_review(
        token=installation_token,          # GitHub App installation access token
        full_name="vivek-1314/devpilot",
        number=2,
        findings=all_findings,             # flat list of findings from all tools
        report_url="",                     # unused, kept so existing callers don't break
        dismissed_ids=dismissed_ids,       # optional: ids the user already dismissed
        sha=sha,
    )

Each finding is expected to look like:
    {"id", "tool", "sev", "file", "line", "rule", "msg"}
"""
import logging

import httpx

log = logging.getLogger(__name__)

API = "https://api.github.com"
MARKER = "<!-- devpilot-pr-review -->"  # lets us find our own comment and update it
MAX_SHOWN = 15                          # never list more than this on the PR

SEV_RANK = {"critical": 0, "high": 1, "medium": 2, "low": 3}

# Bandit rules that fire on almost every project that runs subprocesses/asserts.
NOISY_RULES = {"B404", "B603", "B607", "B101"}

# Lint rules that usually mean a real bug, not style.
LINT_MUST_SHOW = {"F821", "F811", "E999", "E902", "no-undef", "no-unreachable"}


def _is_important(f: dict) -> bool:
    tool = (f.get("tool") or "").lower()
    rule, sev = f.get("rule"), (f.get("sev") or "").lower()

    if tool == "gitleaks":
        return True  # a secret is always worth showing
    if rule in NOISY_RULES:
        return False
    if tool == "bandit":
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
    """Return (findings_in_changed_files, 0). Important ones are sorted first."""
    findings = [_to_dict(f) for f in findings]
    dismissed = set(dismissed_ids)
    in_pr = [
        f for f in findings
        if f.get("file") in changed_files and f.get("id") not in dismissed
    ]
    in_pr.sort(
        key=lambda f: (
            0 if _is_important(f) else 1,
            SEV_RANK.get((f.get("sev") or "").lower(), 9),
            (f.get("tool") or "").lower(),
            f.get("file") or "",
            f.get("line") or 0,
        )
    )
    return in_pr, 0


def _cell(text: str, limit: int = 110) -> str:
    text = (text or "").replace("|", "\\|").replace("\n", " ").strip()
    return text if len(text) <= limit else text[: limit - 1] + "…"


def build_comment(findings, hidden=0, report_url="", sha=None):
    lines = [MARKER, "### DevPilot review", ""]

    if not findings:
        lines.append("No issues found in the files changed by this PR.")
    else:
        counts = {}
        for f in findings:
            s = (f.get("sev") or "low").lower()
            counts[s] = counts.get(s, 0) + 1
        summary = " · ".join(
            f"{counts[s]} {s}" for s in ("critical", "high", "medium", "low") if s in counts
        )
        lines += [f"**{len(findings)} finding(s):** {summary}", ""]
        lines += ["| Severity | Tool | Location | Issue |", "|---|---|---|---|"]
        for f in findings[:MAX_SHOWN]:
            loc = f"`{f.get('file')}:{f.get('line')}`"
            lines.append(
                f"| {f.get('sev')} | {f.get('tool')} | {loc} | "
                f"{_cell(f.get('msg'))} (`{f.get('rule')}`) |"
            )
        if len(findings) > MAX_SHOWN:
            lines += ["", f"…and {len(findings) - MAX_SHOWN} more."]

    if sha:
        lines += ["", f"<sub>Scanned commit {sha[:7]}</sub>"]
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


async def post_pr_review(token, full_name, number, findings, report_url="",
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
            in_pr, hidden = select_important(findings, changed, dismissed_ids)
            log.info(
                "PR comment %s#%s: %d findings total, %d changed files, %d shown",
                full_name, number, len(findings), len(changed), len(in_pr),
            )
            body = build_comment(in_pr, hidden, report_url, sha)

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