import logging
import os

from fastapi import HTTPException
from fastapi.concurrency import run_in_threadpool

from services.quality.store import _SLOTS, _save
from services.common.github import get_installation_token
from services.quality import scan_bandit, scan_eslint, scan_gitleaks, scan_ruff
from services.quality.pr_comment import post_pr_review  # NEW

log = logging.getLogger(__name__)

TOOLS = {"ruff": scan_ruff, "bandit": scan_bandit, "gitleaks": scan_gitleaks, "eslint": scan_eslint}
_inflight: set[tuple[int, str]] = set()

# NEW: base URL of your dashboard, e.g. https://devpilot.example.com
DASHBOARD_URL = os.environ.get("DASHBOARD_URL", "").rstrip("/")


async def scan_pr(repo_id: int, full_name: str, installation_id: int, pr_number: int, sha: str) -> None:
    key = (repo_id, sha)
    if key in _inflight:  # GitHub retries deliveries
        return
    _inflight.add(key)
    try:
        token = await get_installation_token(installation_id)
        ref = f"refs/pull/{pr_number}/head"
        label = f"PR #{pr_number} @ {sha[:7]}"
        all_findings = []  # NEW: collect findings from every tool that succeeded
        for tool, fn in TOOLS.items():
            try:
                async with _SLOTS:
                    result = await run_in_threadpool(fn, full_name, ref, token)
                await run_in_threadpool(_save, repo_id, tool, label, None, result, "pr")
                all_findings.extend(result.findings)  # NEW
            except HTTPException as e:  # e.g. Ruff on a repo with no Python files
                log.info("PR scan skipped: %s repo=%s pr=%s: %s", tool, repo_id, pr_number, e.detail)
            except Exception:
                log.exception("PR scan failed: %s repo=%s pr=%s", tool, repo_id, pr_number)

        # NEW: one comment after all tools are done. post_pr_review never raises.
        report_url = f"{DASHBOARD_URL}/repos/{repo_id}" if DASHBOARD_URL else ""
        await post_pr_review(
            token=token,
            full_name=full_name,
            number=pr_number,
            findings=all_findings,
            report_url=report_url,
            sha=sha,
        )
    except Exception:
        log.exception("PR scan setup failed: repo=%s pr=%s", repo_id, pr_number)
    finally:
        _inflight.discard(key)