import logging

from fastapi import HTTPException
from fastapi.concurrency import run_in_threadpool

from services.api.routes.quality_route import _SLOTS, _save
from services.code_intelligence.integrations.github import get_installation_token
from services.quality import scan_bandit, scan_eslint, scan_gitleaks, scan_ruff

log = logging.getLogger(__name__)

TOOLS = {"ruff": scan_ruff, "bandit": scan_bandit, "gitleaks": scan_gitleaks, "eslint": scan_eslint}
_inflight: set[tuple[int, str]] = set()


async def scan_pr(repo_id: int, full_name: str, installation_id: int, pr_number: int, sha: str) -> None:
    key = (repo_id, sha)
    if key in _inflight:  # GitHub retries deliveries
        return
    _inflight.add(key)
    try:
        token = await get_installation_token(installation_id)
        ref = f"refs/pull/{pr_number}/head"
        label = f"PR #{pr_number} @ {sha[:7]}"
        for tool, fn in TOOLS.items():
            try:
                async with _SLOTS:
                    result = await run_in_threadpool(fn, full_name, ref, token)
                await run_in_threadpool(_save, repo_id, tool, label, None, result, "pr")
            except HTTPException as e:  # e.g. Ruff on a repo with no Python files
                log.info("PR scan skipped: %s repo=%s pr=%s: %s", tool, repo_id, pr_number, e.detail)
            except Exception:
                log.exception("PR scan failed: %s repo=%s pr=%s", tool, repo_id, pr_number)
    except Exception:
        log.exception("PR scan setup failed: repo=%s pr=%s", repo_id, pr_number)
    finally:
        _inflight.discard(key)