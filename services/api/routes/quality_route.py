"""Quality & security checks, scoped to the calling user and saved per repo.

  POST /quality/ruff|bandit|gitleaks|eslint     run one check now (manual button), save the result
  GET  /quality/repos/{repo_id}/latest          last saved scan per tool + resolved/ignored findings
  POST /quality/repos/{repo_id}/states          mark a finding open / resolved / ignored
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from services.api.access import RepoAccess, get_repo_for_user, owned_repo
from services.api.security import current_user_id
from services.code_intelligence.integrations.github import get_installation_token
from services.db import get_db
from services.quality import scan_bandit, scan_eslint, scan_gitleaks, scan_ruff
from services.quality.shared import ScanResult

log = logging.getLogger(__name__)


class QualityRequest(BaseModel):
    repo_id: int
    ref: str | None = None


class StateBody(BaseModel):
    fingerprint: str = Field(min_length=1, max_length=600)
    status: Literal["open", "resolved", "ignored"]


router = APIRouter(prefix="/quality", tags=["quality"])

# Cloning and scanning are heavy. Limit how many run at once.
_SLOTS = asyncio.Semaphore(3)


# ---- persistence -----------------------------------------------------------

def _count(data: dict | None) -> int:
    if not data:
        return 0
    for key in ("findings", "issues", "results"):
        if isinstance(data.get(key), list):
            return len(data[key])
    return 0


def _save(repo_id: int, tool: str, ref: str | None, user_id: str | None, result: ScanResult, source: str = "manual") -> None:
    """One row per repo and tool: a re-scan replaces the previous result."""
    data = result.model_dump(mode="json")
    get_db().table("quality_scans").upsert(
        {
            "repo_id": repo_id,
            "tool": tool,
            "source": source,
            "ref": ref,
            "status": "done",
            "finding_count": _count(data),
            "result": data,
            "error": None,
            "requested_by": user_id,
            "created_at": datetime.now(timezone.utc).isoformat(),  # "scanned at"
        },
        on_conflict="repo_id,tool",
    ).execute()


def _latest(repo_id: int) -> dict:
    db = get_db()
    rows = (
        db.table("quality_scans")
        .select("tool,created_at,ref,source,finding_count,result")
        .eq("repo_id", repo_id)
        .eq("status", "done")
        .order("created_at", desc=True)
        .limit(80)
        .execute()
        .data
        or []
    )
    scans: dict[str, dict] = {}
    for row in rows:
        scans.setdefault(row["tool"], row)  # rows are newest first, so the first per tool wins

    states = db.table("finding_states").select("fingerprint,status").eq("repo_id", repo_id).execute().data or []
    return {"scans": scans, "states": {s["fingerprint"]: s["status"] for s in states}}


def _set_state(repo_id: int, user_id: str, fingerprint: str, status: str) -> None:
    db = get_db()
    if status == "open":
        db.table("finding_states").delete().eq("repo_id", repo_id).eq("fingerprint", fingerprint).execute()
        return
    db.table("finding_states").upsert(
        {
            "repo_id": repo_id,
            "fingerprint": fingerprint,
            "status": status,
            "updated_by": user_id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()


# ---- running a scan --------------------------------------------------------

async def _run(tool: str, scan_fn, req: QualityRequest, user_id: str) -> ScanResult:
    # Same 404 whether the repo is missing or just not this user's.
    repo = await get_repo_for_user(user_id, req.repo_id)
    if repo is None:
        raise HTTPException(404, "Repository not found.")
    if not repo.enabled:
        raise HTTPException(403, "This repository isn't enabled yet. Enable it first.")

    # Everything sensitive comes from our own record, never from the request.
    token = await get_installation_token(repo.installation_id)
    ref = req.ref or repo.default_branch

    # If the scan fails it raises here, and the previous good result stays saved.
    async with _SLOTS:
        result = await run_in_threadpool(scan_fn, repo.full_name, ref, token)

    await _try_save(repo.id, tool, ref, user_id, result)
    return result


async def _try_save(repo_id, tool, ref, user_id, result) -> None:
    # A failed save must never hide a finished scan from the user.
    try:
        await run_in_threadpool(_save, repo_id, tool, ref, user_id, result)
    except Exception:
        log.exception("could not save %s scan for repo %s", tool, repo_id)


@router.post("/ruff", response_model=ScanResult)
async def ruff_route(req: QualityRequest, user_id: str = Depends(current_user_id)):
    return await _run("ruff", scan_ruff, req, user_id)


@router.post("/bandit", response_model=ScanResult)
async def bandit_route(req: QualityRequest, user_id: str = Depends(current_user_id)):
    return await _run("bandit", scan_bandit, req, user_id)


@router.post("/gitleaks", response_model=ScanResult)
async def gitleaks_route(req: QualityRequest, user_id: str = Depends(current_user_id)):
    return await _run("gitleaks", scan_gitleaks, req, user_id)


@router.post("/eslint", response_model=ScanResult)
async def eslint_route(req: QualityRequest, user_id: str = Depends(current_user_id)):
    return await _run("eslint", scan_eslint, req, user_id)


# ---- reading saved results -------------------------------------------------

@router.get("/repos/{repo_id}/latest")
async def latest_route(repo: RepoAccess = Depends(owned_repo)):
    return await run_in_threadpool(_latest, repo.id)


@router.post("/repos/{repo_id}/states")
async def state_route(body: StateBody, repo: RepoAccess = Depends(owned_repo), user_id: str = Depends(current_user_id)):
    await run_in_threadpool(_set_state, repo.id, user_id, body.fingerprint, body.status)
    return {"ok": True}