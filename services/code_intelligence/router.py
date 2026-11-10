### Code Intelligence Routes (internal service)
# No user, ownership or enabled checks here. The api service does those
# BEFORE forwarding. This service only trusts calls from api.
#
# - `POST /repos/{repo_id}/index` – Indexes a GitHub repository.
# - `GET /repos/{repo_id}/graph` – Retrieves the repository's code graph.
# - `POST /repos/{repo_id}/chat` – Chats with AI about the repository using the latest 12 messages.

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.code_intelligence.chat import chat
from services.code_intelligence.pipeline import RepoNotFound, index_repo, load_graph

log = logging.getLogger(__name__)

router = APIRouter(prefix="/code-intelligence", tags=["code-intelligence"])


@router.post("/repos/{repo_id}/index")
async def index(repo_id: int):
    try:
        return await index_repo(repo_id)
    except RepoNotFound:
        raise HTTPException(status_code=404, detail="Repository not found.")
    except RuntimeError:
        log.exception("index failed for repo %s", repo_id)
        raise HTTPException(status_code=502, detail="Indexing failed. Try again.")


@router.get("/repos/{repo_id}/graph")
def graph(repo_id: int):
    return load_graph(repo_id)


class Msg(BaseModel):
    role: str  # "user" or "assistant" only
    content: str = Field(max_length=4000)


class ChatBody(BaseModel):
    messages: list[Msg]


@router.post("/repos/{repo_id}/chat")
async def chat_route(repo_id: int, body: ChatBody):
    msgs = [m.model_dump() for m in body.messages[-12:] if m.role in ("user", "assistant")]
    if not msgs or msgs[-1]["role"] != "user":
        raise HTTPException(status_code=400, detail="last message must be from the user")
    try:
        return await chat(repo_id, msgs)
    except Exception:
        log.exception("chat failed for repo %s", repo_id)
        raise HTTPException(status_code=502, detail="Chat failed. Try again.")