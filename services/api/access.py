"""Repo access guard: the ONE place that decides whether a user may touch a repo.

Rule: user --member of--> installation --owns--> repo. Both links must exist.

  owned_repo    member of the owning installation (used for enable / disable / read state)
  enabled_repo  same, and the repo has been enabled (index, graph, chat, scans)
"""
from dataclasses import dataclass

from fastapi import Depends, HTTPException
from fastapi.concurrency import run_in_threadpool

from services.api.security import current_user_id
from services.db import get_db  # adjust the import if db.py lives elsewhere

# Keep in sync with the CASE in enforce_repo_limit() (migration 001).
PLAN_LIMITS = {"free": 2}
DEFAULT_LIMIT = 1000


@dataclass
class RepoAccess:
    id: int
    full_name: str
    installation_id: int
    default_branch: str | None = None
    enabled: bool = False


def _lookup(user_id: str, repo_id: int) -> RepoAccess | None:
    db = get_db()

    repo = (
        db.table("repositories")
        .select("id,installation_id,full_name,default_branch,analyze_enabled")
        .eq("id", repo_id)
        .limit(1)
        .execute()
        .data
    )
    if not repo:
        return None
    repo = repo[0]

    member = (
        db.table("installation_members")
        .select("user_id")
        .eq("user_id", user_id)
        .eq("installation_id", repo["installation_id"])
        .limit(1)
        .execute()
        .data
    )
    if not member:
        return None

    return RepoAccess(
        repo["id"],
        repo["full_name"],
        repo["installation_id"],
        repo.get("default_branch"),
        bool(repo.get("analyze_enabled")),
    )


async def get_repo_for_user(user_id: str, repo_id: int) -> RepoAccess | None:
    """The repo ONLY if user_id belongs to the installation that owns it, else None."""
    return await run_in_threadpool(_lookup, user_id, repo_id)


async def owned_repo(repo_id: int, user_id: str = Depends(current_user_id)) -> RepoAccess:
    """Key check + user id + ownership. Same 404 for missing and not-yours."""
    repo = await get_repo_for_user(user_id, repo_id)
    if repo is None:
        raise HTTPException(404, "Repository not found.")
    return repo


async def enabled_repo(repo: RepoAccess = Depends(owned_repo)) -> RepoAccess:
    """Ownership plus: the user has switched this repo on (counts toward the plan limit)."""
    if not repo.enabled:
        raise HTTPException(403, "This repository isn't enabled yet. Enable it first.")
    return repo