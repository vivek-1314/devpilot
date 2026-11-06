import posixpath
from dataclasses import dataclass

from app.graph.extractor import SUPPORTED, TS_PARSER, TSX_PARSER

EXTS = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs")


@dataclass
class ImportEdge:
    from_path: str
    to_path: str | None
    target_name: str | None
    kind: str = "imports"


def _spec(node) -> str | None:
    src = node.child_by_field_name("source")
    if src is None:
        return None
    return src.text.decode().strip("\"'`")


def _package(spec: str) -> str:
    parts = spec.split("/")
    return "/".join(parts[:2]) if spec.startswith("@") else parts[0]


def _resolve(from_path: str, spec: str, known: set[str]) -> str | None:
    if spec.startswith("."):
        bases = [posixpath.normpath(posixpath.join(posixpath.dirname(from_path), spec))]
    elif spec.startswith("@/") or spec.startswith("~/"):
        rest = spec[2:]
        bases = [rest, "src/" + rest]
    else:
        return None
    for b in bases:
        if b in known:
            return b
        for ext in EXTS:
            if b + ext in known:
                return b + ext
        for ext in EXTS:
            candidate = f"{b}/index{ext}"
            if candidate in known:
                return candidate
    return None


def extract_imports(path: str, source: bytes, known: set[str]) -> list[ImportEdge]:
    if not path.endswith(SUPPORTED):
        return []
    parser = TS_PARSER if path.endswith(".ts") else TSX_PARSER
    tree = parser.parse(source)
    edges: list[ImportEdge] = []
    seen: set[tuple] = set()

    for node in tree.root_node.children:
        if node.type not in ("import_statement", "export_statement"):
            continue
        spec = _spec(node)
        if not spec:
            continue
        local = spec.startswith((".", "@/", "~/"))
        to_path = _resolve(path, spec, known) if local else None
        target = None if to_path else (spec if local else _package(spec))
        key = (to_path, target)
        if key in seen:
            continue
        seen.add(key)
        edges.append(ImportEdge(from_path=path, to_path=to_path, target_name=target))
    return edges
