"""Repo access guard: the ONE place that decides whether a user may touch a repo.

Rule: user --member of--> installation --owns--> repo. Both links must exist.
Every route that takes a repo_id goes through get_repo_for_user() / owned_repo().
"""
from dataclasses import dataclass

from fastapi import Depends, HTTPException
from fastapi.concurrency import run_in_threadpool

from services.api.security import current_user_id


def _db():
    from services.db import get_db
    return get_db()


@dataclass
class RepoAccess:
    id: int
    full_name: str
    installation_id: int
    default_branch: str | None = None


def _lookup(user_id: str, repo_id: int) -> RepoAccess | None:
    db = _db()

    repo = (
        db.table("repositories")
        .select("id,installation_id,full_name,default_branch")
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

    return RepoAccess(repo["id"], repo["full_name"], repo["installation_id"], repo.get("default_branch"))


async def get_repo_for_user(user_id: str, repo_id: int) -> RepoAccess | None:
    """The repo ONLY if user_id belongs to the installation that owns it, else None."""
    return await run_in_threadpool(_lookup, user_id, repo_id)


async def owned_repo(repo_id: int, user_id: str = Depends(current_user_id)) -> RepoAccess:
    """Route dependency: key check + user id + ownership, in one. Same 404 for missing and not-yours."""
    repo = await get_repo_for_user(user_id, repo_id)
    if repo is None:
        raise HTTPException(404, "Repository not found.")
    return repo