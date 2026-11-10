from datetime import datetime, timezone
from pathlib import Path

from services.common.db import get_db
from services.code_intelligence.graph.extractor import extract_symbols
from services.code_intelligence.graph.imports import ImportEdge, extract_imports
from services.code_intelligence.graph.walker import walk_repo

BATCH = 500


def build_graph(root: Path) -> tuple[list[dict], list[ImportEdge]]:
    files = walk_repo(root)
    known = {f.path for f in files}
    nodes: list[dict] = []
    edges: list[ImportEdge] = []

    for f in files:
        data = (root / f.path).read_bytes()
        nodes.append(
            {
                "kind": "file",
                "name": f.name,
                "qualified_name": f.path,
                "path": f.path,
                "language": f.language,
                "start_line": 1,
                "end_line": f.line_count,
                "signature": None,
                "content_hash": f.content_hash,
            }
        )
        for s in extract_symbols(f.path, data):
            nodes.append(
                {
                    "kind": s.kind,
                    "name": s.name,
                    "qualified_name": s.qualified_name,
                    "path": f.path,
                    "language": f.language,
                    "start_line": s.start_line,
                    "end_line": s.end_line,
                    "signature": s.signature,
                    "content_hash": s.content_hash,
                }
            )
        edges.extend(extract_imports(f.path, data, known))

    return nodes, edges


def save_graph(repo_id: int, sha: str, nodes: list[dict], edges: list[ImportEdge]) -> dict:
    db = get_db()

    rows = [{**n, "repo_id": repo_id, "commit_sha": sha} for n in nodes]
    id_by_qname: dict[str, int] = {}
    # (file path, function/class name) -> node id, used to point "calls" edges at the function
    id_by_sym: dict[tuple[str, str], int] = {}
    for i in range(0, len(rows), BATCH):
        res = (
            db.table("code_nodes")
            .upsert(rows[i : i + BATCH], on_conflict="repo_id,qualified_name")
            .execute()
        )
        for r in res.data:
            id_by_qname[r["qualified_name"]] = r["id"]
            if r.get("kind") != "file":
                id_by_sym.setdefault((r["path"], r["name"]), r["id"])

    db.table("code_nodes").delete().eq("repo_id", repo_id).neq("commit_sha", sha).execute()

    db.table("code_edges").delete().eq("repo_id", repo_id).execute()
    edge_rows = []
    for e in edges:
        from_id = id_by_qname.get(e.from_path)
        if from_id is None:
            continue

        if e.kind == "calls":
            # file -> the function/class it uses in another file
            to_id = id_by_sym.get((e.to_path, e.target_name))
            if to_id is None:
                continue  # the used name is not a function/class we indexed
            edge_rows.append(
                {
                    "repo_id": repo_id,
                    "from_node_id": from_id,
                    "to_node_id": to_id,
                    "target_name": e.target_name,
                    "kind": "calls",
                    "commit_sha": sha,
                }
            )
            continue

        to_id = id_by_qname.get(e.to_path) if e.to_path else None
        if to_id is None and not e.target_name:
            continue
        edge_rows.append(
            {
                "repo_id": repo_id,
                "from_node_id": from_id,
                "to_node_id": to_id,
                "target_name": None if to_id else e.target_name,
                "kind": e.kind,
                "commit_sha": sha,
            }
        )
    for i in range(0, len(edge_rows), BATCH):
        db.table("code_edges").insert(edge_rows[i : i + BATCH]).execute()

    db.table("repositories").update(
        {"last_indexed_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", repo_id).execute()

    return {"nodes": len(rows), "edges": len(edge_rows)}