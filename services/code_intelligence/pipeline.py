import asyncio
import logging
import time

import httpx

from services.db import get_db, reset_db
from services.code_intelligence.graph.docs import (
    collect_facts,
    generate_and_save_docs
)
from services.code_intelligence.graph.indexer import build_graph, save_graph
from services.code_intelligence.integrations.clone import cloned_repo

logger = logging.getLogger("devpilot.pipeline")

PAGE = 1000


class RepoNotFound(Exception):
    pass


def save_with_retry(repo_id, sha, nodes, edges, attempts=3):
    for i in range(attempts):
        try:
            return save_graph(repo_id, sha, nodes, edges)
        except httpx.TransportError:
            reset_db()
            if i == attempts - 1:
                raise
            time.sleep(1 + i)


async def index_repo(repo_id: int) -> dict:
    db = get_db()
    res = await asyncio.to_thread(
        lambda: db.table("repositories")
        .select("id,installation_id,full_name,default_branch")
        .eq("id", repo_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise RepoNotFound(repo_id)
    repo = res.data[0]

    facts = None
    async with cloned_repo(
        repo["installation_id"], repo["full_name"], repo["default_branch"]
    ) as (path, sha):
        nodes, edges = await asyncio.to_thread(build_graph, path)
        result = await asyncio.to_thread(save_with_retry, repo_id, sha, nodes, edges)

        # Cheap and deterministic. Needs the clone (README, package.json, ...).
        # A failure here must never fail indexing.
        try:
            facts = await asyncio.to_thread(collect_facts, path, nodes, edges)
        except Exception:
            logger.exception("collect_facts failed for repo %s", repo_id)

    # Clone is gone. The slow LLM step runs here, and is also allowed to fail.
    docs_saved = 0
    if facts:
        try:
            docs_saved = await generate_and_save_docs(
                repo_id, sha, repo["full_name"], facts
            )
        except Exception:
            logger.exception("doc generation failed for repo %s", repo_id)

    return {"repo_id": repo_id, "commit": sha, "docs": docs_saved, **result}


def _fetch_all(make_query) -> list[dict]:
    rows: list[dict] = []
    start = 0
    while True:
        batch = make_query().range(start, start + PAGE - 1).execute().data
        rows.extend(batch)
        if len(batch) < PAGE:
            return rows
        start += PAGE


def load_graph(repo_id: int) -> dict:
    db = get_db()
    nodes = _fetch_all(
        lambda: db.table("code_nodes")
        .select("id,kind,name,qualified_name,path,language,start_line,end_line,signature")
        .eq("repo_id", repo_id)
        .order("id")
    )
    edges = _fetch_all(
        lambda: db.table("code_edges")
        .select("id,from_node_id,to_node_id,target_name,kind")
        .eq("repo_id", repo_id)
        .order("id")
    )
    return {"nodes": nodes, "edges": edges}