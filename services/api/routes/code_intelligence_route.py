### Code Intelligence Routes
# All routes are scoped to the calling user via `owned_repo` (services/api/access.py),
# which runs the internal-key check, reads x-user-id and verifies repo ownership.
#
# - `POST /repos/{repo_id}/index` – Indexes a GitHub repository.
# - `GET /repos/{repo_id}/graph` – Retrieves the repository's code graph.
# - `POST /repos/{repo_id}/chat` – Chats with AI about the repository using the latest 12 messages.
# - `Msg` – Defines the chat message structure.
# - `ChatBody` – Defines the chat request body.

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from services.api.access import RepoAccess, owned_repo
from services.code_intelligence.chat import chat
from services.code_intelligence.pipeline import RepoNotFound, index_repo, load_graph

router = APIRouter(prefix="/code-intelligence", tags=["code-intelligence"])


@router.post("/repos/{repo_id}/index")
async def index(repo: RepoAccess = Depends(owned_repo)):
    try:
        return await index_repo(repo.id)
    except RepoNotFound:
        raise HTTPException(status_code=404, detail="Repository not found.")
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/repos/{repo_id}/graph")
def graph(repo: RepoAccess = Depends(owned_repo)):
    return load_graph(repo.id)


class Msg(BaseModel):
    role: str  # "user" or "assistant" only
    content: str


class ChatBody(BaseModel):
    messages: list[Msg]


@router.post("/repos/{repo_id}/chat")
async def chat_route(body: ChatBody, repo: RepoAccess = Depends(owned_repo)):
    msgs = [m.model_dump() for m in body.messages[-12:] if m.role in ("user", "assistant")]
    if not msgs or msgs[-1]["role"] != "user":
        raise HTTPException(status_code=400, detail="last message must be from the user")
    try:
        return await chat(repo.id, msgs)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"chat failed: {e}")