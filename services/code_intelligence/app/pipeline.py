import asyncio

import time

import httpx

from app.db import get_db, reset_db
from app.graph.indexer import build_graph, save_graph
from app.integrations.clone import cloned_repo

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

    async with cloned_repo(
        repo["installation_id"], repo["full_name"], repo["default_branch"]
    ) as (path, sha):
        nodes, edges = await asyncio.to_thread(build_graph, path)
        result = await asyncio.to_thread(save_with_retry, repo_id, sha, nodes, edges)

    return {"repo_id": repo_id, "commit": sha, **result}


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
