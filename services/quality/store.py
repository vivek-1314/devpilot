import asyncio
from datetime import datetime, timezone

from services.common.db import get_db
from services.quality.shared import ScanResult

# Cloning and scanning are heavy. Limit how many run at once.
_SLOTS = asyncio.Semaphore(3)


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
            "created_at": datetime.now(timezone.utc).isoformat(),
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
        scans.setdefault(row["tool"], row)  # newest first, so the first per tool wins

    states = db.table("finding_states").select("fingerprint,status").eq("repo_id", repo_id).execute().data or []
    return {"scans": scans, "states": {s["fingerprint"]: s["status"] for s in states}}


def _set_state(repo_id: int, user_id: str | None, fingerprint: str, status: str) -> None:
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