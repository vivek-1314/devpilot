import hashlib
import os
from dataclasses import dataclass
from pathlib import Path

SKIP_DIRS = {".git", "node_modules", "dist", "build", ".next", "venv", ".venv", "__pycache__"}
MAX_BYTES = 1_000_000

LANGUAGES = {
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".py": "python",
}


@dataclass
class FileNode:
    path: str
    name: str
    language: str
    line_count: int
    content_hash: str


def walk_repo(root: Path) -> list[FileNode]:
    nodes: list[FileNode] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fname in filenames:
            language = LANGUAGES.get(Path(fname).suffix)
            if language is None:
                continue
            full = Path(dirpath) / fname
            if full.stat().st_size > MAX_BYTES:
                continue
            data = full.read_bytes()
            nodes.append(
                FileNode(
                    path=full.relative_to(root).as_posix(),
                    name=fname,
                    language=language,
                    line_count=data.count(b"\n") + 1,
                    content_hash=hashlib.sha256(data).hexdigest(),
                )
            )
    nodes.sort(key=lambda n: n.path)
    return nodes
