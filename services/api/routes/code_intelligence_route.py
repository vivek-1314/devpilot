import os

import httpx
from fastapi import APIRouter, Depends, Request, Response

from services.api.access import RepoAccess, enabled_repo

router = APIRouter(prefix="/code-intelligence", tags=["code-intelligence"])

BASE_URL = os.environ.get("CODE_INTELLIGENCE_URL", "http://code-intelligence:8001")
client = httpx.AsyncClient(timeout=600)


@router.api_route("/repos/{repo_id}/{path:path}", methods=["GET", "POST"])
async def proxy(path: str, request: Request, repo: RepoAccess = Depends(enabled_repo)):
    r = await client.request(
        request.method,
        f"{BASE_URL}/code-intelligence/repos/{repo.id}/{path}",
        params=request.query_params,
        content=await request.body(),
        headers={"content-type": request.headers.get("content-type", "application/json")},
    )
    return Response(content=r.content, status_code=r.status_code,
                    media_type=r.headers.get("content-type"))