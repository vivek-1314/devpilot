import os

from fastapi import APIRouter, Depends, Header, HTTPException

from app.pipeline import RepoNotFound, index_repo, load_graph

router = APIRouter(prefix="/code-intelligence", tags=["code-intelligence"])


def require_key(x_internal_key: str = Header(default="")):
    expected = os.environ.get("INTERNAL_API_KEY")
    if not expected or x_internal_key != expected:
        raise HTTPException(status_code=401, detail="unauthorized")


@router.post("/repos/{repo_id}/index", dependencies=[Depends(require_key)])
async def index(repo_id: int):
    try:
        return await index_repo(repo_id)
    except RepoNotFound:
        raise HTTPException(status_code=404, detail="repo not found")
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/repos/{repo_id}/graph", dependencies=[Depends(require_key)])
def graph(repo_id: int):
    return load_graph(repo_id)
