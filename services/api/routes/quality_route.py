"""Quality & security checks, scoped to the calling user.

The client sends only {repo_id, ref?}. Every request must carry:
  x-internal-key  proves the call comes from our frontend server
  x-user-id       the logged-in user, set by the frontend server from the verified session

full_name and installation_id come from our database, and the repo is only returned if
that user is a member of the installation that owns it. Nothing is cloned otherwise.

  POST /quality/ruff      Python lint
  POST /quality/bandit    Python security
  POST /quality/gitleaks  secrets, any language
  POST /quality/eslint    JavaScript / TypeScript lint + security rules
"""
import asyncio

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from services.api.access import get_repo_for_user
from services.api.security import current_user_id
from services.code_intelligence.integrations.github import get_installation_token
from services.quality import scan_bandit, scan_eslint, scan_gitleaks, scan_ruff
from services.quality.shared import ScanResult


class QualityRequest(BaseModel):
    repo_id: int
    ref: str | None = None


router = APIRouter(prefix="/quality", tags=["quality"])

# Cloning and scanning are heavy. Limit how many run at once.
_SLOTS = asyncio.Semaphore(3)


async def _run(scan_fn, req: QualityRequest, user_id: str) -> ScanResult:
    # Authorization. Same 404 whether the repo is missing or just not this user's.
    repo = await get_repo_for_user(user_id, req.repo_id)
    if repo is None:
        raise HTTPException(404, "Repository not found.")

    # Everything sensitive comes from our own record, never from the request.
    token = await get_installation_token(repo.installation_id)
    ref = req.ref or repo.default_branch

    async with _SLOTS:
        return await run_in_threadpool(scan_fn, repo.full_name, ref, token)


@router.post("/ruff", response_model=ScanResult)
async def ruff_route(req: QualityRequest, user_id: str = Depends(current_user_id)):
    return await _run(scan_ruff, req, user_id)


@router.post("/bandit", response_model=ScanResult)
async def bandit_route(req: QualityRequest, user_id: str = Depends(current_user_id)):
    return await _run(scan_bandit, req, user_id)


@router.post("/gitleaks", response_model=ScanResult)
async def gitleaks_route(req: QualityRequest, user_id: str = Depends(current_user_id)):
    return await _run(scan_gitleaks, req, user_id)


@router.post("/eslint", response_model=ScanResult)
async def eslint_route(req: QualityRequest, user_id: str = Depends(current_user_id)):
    return await _run(scan_eslint, req, user_id)