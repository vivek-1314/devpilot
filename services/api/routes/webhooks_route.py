import hashlib
import hmac
import json
import logging
import os

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request
from fastapi.concurrency import run_in_threadpool

from services.common.db import get_db
import httpx

log = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks", tags=["webhooks"])

PR_ACTIONS = {"opened", "synchronize", "reopened"}

QUALITY_URL = os.environ.get("QUALITY_URL", "http://quality:8002")


async def _send_pr(repo: dict, number: int, sha: str) -> None:
    """Hand the PR scan to the quality container. A failure is logged, never raised."""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"{QUALITY_URL}/quality/pr",
                json={
                    "repo_id": repo["id"],
                    "full_name": repo["full_name"],
                    "installation_id": repo["installation_id"],
                    "number": number,
                    "sha": sha,
                },
            )
            r.raise_for_status()
    except Exception:
        log.exception("could not queue PR scan for repo %s", repo["id"])


def _verify(raw: bytes, sig: str | None) -> None:
    secret = os.environ.get("GITHUB_WEBHOOK_SECRET", "")
    if not secret:
        log.error("GITHUB_WEBHOOK_SECRET is not set")
        raise HTTPException(401, "Unauthorized.")
    expected = "sha256=" + hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    if not sig or not hmac.compare_digest(sig, expected):
        raise HTTPException(401, "Unauthorized.")


def _find_repo(repo_id: int) -> dict | None:
    rows = (
        get_db().table("repositories")
        .select("id,full_name,installation_id,analyze_enabled")
        .eq("id", repo_id).limit(1).execute().data
    )
    return rows[0] if rows else None


@router.post("/github", status_code=202)
async def github_webhook(
    request: Request,
    bg: BackgroundTasks,
    x_hub_signature_256: str | None = Header(default=None),
    x_github_event: str | None = Header(default=None),
):
    raw = await request.body()
    _verify(raw, x_hub_signature_256)

    if x_github_event != "pull_request":
        return {"ok": True, "ignored": x_github_event}
    try:
        payload = json.loads(raw)
    except ValueError:
        raise HTTPException(400, "Bad payload.")
    if payload.get("action") not in PR_ACTIONS:
        return {"ok": True, "ignored": payload.get("action")}

    pr = payload.get("pull_request") or {}
    repo_id = (payload.get("repository") or {}).get("id")
    number = pr.get("number")
    sha = (pr.get("head") or {}).get("sha")
    if not isinstance(repo_id, int) or not isinstance(number, int) or not isinstance(sha, str):
        raise HTTPException(400, "Bad payload.")

    repo = await run_in_threadpool(_find_repo, repo_id)
    if not repo or not repo["analyze_enabled"]:
        return {"ok": True, "skipped": "not enabled"}

    bg.add_task(_send_pr, repo, number, sha)
    return {"ok": True, "queued": True}