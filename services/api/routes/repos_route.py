"""Switch a repository on or off for DevPilot. The plan limit counts enabled repos.

  POST /repos/{repo_id}/enable
  POST /repos/{repo_id}/disable
  GET  /repos/{repo_id}/usage

Register it in main.py:  app.include_router(repos_route.router)
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from postgrest.exceptions import APIError

from services.api.access import DEFAULT_LIMIT, PLAN_LIMITS, RepoAccess, owned_repo
from services.common.db import get_db

router = APIRouter(prefix="/repos", tags=["repos"])


def _usage(installation_id: int) -> dict:
    db = get_db()
    inst = db.table("installations").select("plan").eq("id", installation_id).limit(1).execute().data
    plan = inst[0]["plan"] if inst else "free"
    limit = PLAN_LIMITS.get(plan, DEFAULT_LIMIT)
    used = (
        db.table("repositories")
        .select("id", count="exact")
        .eq("installation_id", installation_id)
        .eq("analyze_enabled", True)
        .execute()
        .count
        or 0
    )
    return {"plan": plan, "limit": limit, "used": used}


def _set_enabled(repo: RepoAccess, enabled: bool) -> dict:
    try:
        get_db().table("repositories").update({"analyze_enabled": enabled}).eq("id", repo.id).execute()
    except APIError as exc:
        # raised by the enforce_repo_limit() trigger
        if "repo_limit_reached" in str(exc):
            limit = _usage(repo.installation_id)["limit"]
            raise HTTPException(403, f"Your plan includes {limit} repositories. Disable one to enable another.")
        raise
    return {"enabled": enabled, **_usage(repo.installation_id)}


@router.post("/{repo_id}/enable")
async def enable(repo: RepoAccess = Depends(owned_repo)):
    return await run_in_threadpool(_set_enabled, repo, True)


@router.post("/{repo_id}/disable")
async def disable(repo: RepoAccess = Depends(owned_repo)):
    return await run_in_threadpool(_set_enabled, repo, False)


@router.get("/{repo_id}/usage")
async def usage(repo: RepoAccess = Depends(owned_repo)):
    data = await run_in_threadpool(_usage, repo.installation_id)
    return {"enabled": repo.enabled, **data}