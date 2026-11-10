"""Quality service (internal). No user checks here: the api service checks the
user, ownership and enabled status BEFORE forwarding the request.

  POST /quality/ruff|bandit|gitleaks|eslint     run one scan, save the result
  GET  /quality/repos/{repo_id}/latest          last saved scan per tool + finding states
  POST /quality/repos/{repo_id}/states          mark a finding open / resolved / ignored
  POST /quality/pr                              queue a PR scan (called by api webhook)
"""
import logging
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from services.common.db import get_db
from services.common.github import get_installation_token
from services.quality import scan_bandit, scan_eslint, scan_gitleaks, scan_ruff
from services.quality.pr import scan_pr
from services.quality.shared import ScanResult
from services.quality.store import _SLOTS, _latest, _save, _set_state

log = logging.getLogger(__name__)

router = APIRouter(prefix="/quality", tags=["quality"])


class QualityRequest(BaseModel):
    repo_id: int
    ref: str | None = None


class StateBody(BaseModel):
    fingerprint: str = Field(min_length=1, max_length=600)
    status: Literal["open", "resolved", "ignored"]


class PrBody(BaseModel):
    repo_id: int
    full_name: str
    installation_id: int
    number: int
    sha: str


def _repo(repo_id: int) -> dict | None:
    rows = (
        get_db().table("repositories")
        .select("id,installation_id,full_name,default_branch")
        .eq("id", repo_id).limit(1).execute().data
    )
    return rows[0] if rows else None


async def _run(tool: str, scan_fn, req: QualityRequest, user_id: str | None) -> ScanResult:
    repo = await run_in_threadpool(_repo, req.repo_id)
    if repo is None:
        raise HTTPException(404, "Repository not found.")

    # Everything sensitive comes from our own record, never from the request.
    token = await get_installation_token(repo["installation_id"])
    ref = req.ref or repo["default_branch"]

    # If the scan fails it raises here, and the previous good result stays saved.
    async with _SLOTS:
        result = await run_in_threadpool(scan_fn, repo["full_name"], ref, token)

    # A failed save must never hide a finished scan from the user.
    try:
        await run_in_threadpool(_save, req.repo_id, tool, ref, user_id, result)
    except Exception:
        log.exception("could not save %s scan for repo %s", tool, req.repo_id)
    return result


@router.post("/ruff", response_model=ScanResult)
async def ruff_route(req: QualityRequest, x_user_id: str | None = Header(default=None)):
    return await _run("ruff", scan_ruff, req, x_user_id)


@router.post("/bandit", response_model=ScanResult)
async def bandit_route(req: QualityRequest, x_user_id: str | None = Header(default=None)):
    return await _run("bandit", scan_bandit, req, x_user_id)


@router.post("/gitleaks", response_model=ScanResult)
async def gitleaks_route(req: QualityRequest, x_user_id: str | None = Header(default=None)):
    return await _run("gitleaks", scan_gitleaks, req, x_user_id)


@router.post("/eslint", response_model=ScanResult)
async def eslint_route(req: QualityRequest, x_user_id: str | None = Header(default=None)):
    return await _run("eslint", scan_eslint, req, x_user_id)


# ---- reading saved results -------------------------------------------------

@router.get("/repos/{repo_id}/latest")
async def latest_route(repo_id: int):
    return await run_in_threadpool(_latest, repo_id)


@router.post("/repos/{repo_id}/states")
async def state_route(repo_id: int, body: StateBody, x_user_id: str | None = Header(default=None)):
    await run_in_threadpool(_set_state, repo_id, x_user_id, body.fingerprint, body.status)
    return {"ok": True}


@router.post("/pr", status_code=202)
async def pr_scan(body: PrBody, bg: BackgroundTasks):
    bg.add_task(scan_pr, body.repo_id, body.full_name, body.installation_id, body.number, body.sha)
    return {"queued": True}