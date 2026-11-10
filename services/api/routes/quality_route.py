import os

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from services.api.access import RepoAccess, get_repo_for_user, owned_repo
from services.api.security import current_user_id

router = APIRouter(prefix="/quality", tags=["quality"])

BASE_URL = os.environ.get("QUALITY_URL", "http://quality:8002")
client = httpx.AsyncClient(timeout=600)


class QualityRequest(BaseModel):
    repo_id: int
    ref: str | None = None


def _reply(r: httpx.Response) -> Response:
    return Response(content=r.content, status_code=r.status_code,
                    media_type=r.headers.get("content-type"))


# POST /quality/ruff|bandit|gitleaks|eslint  (repo_id is in the body, so check access here)
@router.post("/{tool}")
async def run_check(tool: str, req: QualityRequest, user_id: str = Depends(current_user_id)):
    if tool not in {"ruff", "bandit", "gitleaks", "eslint"}:
        raise HTTPException(404, "Unknown check.")

    repo = await get_repo_for_user(user_id, req.repo_id)
    if repo is None:
        raise HTTPException(404, "Repository not found.")
    if not repo.enabled:
        raise HTTPException(403, "This repository isn't enabled yet. Enable it first.")

    r = await client.post(
        f"{BASE_URL}/quality/{tool}",
        json={"repo_id": repo.id, "ref": req.ref},
        headers={"x-user-id": user_id},
    )
    return _reply(r)


@router.api_route("/repos/{repo_id}/{path:path}", methods=["GET", "POST"])
async def proxy(path: str, request: Request, repo: RepoAccess = Depends(owned_repo),
                user_id: str = Depends(current_user_id)):
    if path not in {"latest", "states"}:
        raise HTTPException(404, "Not found.")

    try:
        r = await client.request(
            request.method,
            f"{BASE_URL}/quality/repos/{repo.id}/{path}",
            content=await request.body(),
            headers={
                "x-user-id": user_id,
                "content-type": request.headers.get("content-type", "application/json"),
            },
        )
    except httpx.RequestError as e:
        raise HTTPException(502, f"quality service unreachable: {e!r}")
    return _reply(r)