import posixpath
from dataclasses import dataclass

from services.code_intelligence.graph.extractor import SUPPORTED, TS_PARSER, TSX_PARSER

EXTS = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs")


@dataclass
class ImportEdge:
    from_path: str
    to_path: str | None
    target_name: str | None
    # "imports": file -> file (or file -> package)
    # "calls":   file -> a function/class defined in to_path (target_name is its name)
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


def _bindings(node) -> list[tuple[str, str]]:
    """(local name, imported name) pairs for one import statement.

    import { a as b } from "x"  -> ("b", "a")
    import * as api from "x"    -> ("api", "*")
    import Foo from "x"         -> ("Foo", "Foo")   (best guess: default export is named like the import)
    """
    out: list[tuple[str, str]] = []
    for clause in node.children:
        if clause.type != "import_clause":
            continue
        for c in clause.children:
            if c.type == "identifier":
                local = c.text.decode()
                out.append((local, local))
            elif c.type == "named_imports":
                for s in c.children:
                    if s.type != "import_specifier":
                        continue
                    name = s.child_by_field_name("name")
                    alias = s.child_by_field_name("alias")
                    if name is None:
                        continue
                    out.append(((alias or name).text.decode(), name.text.decode()))
            elif c.type == "namespace_import":
                ident = next((x for x in c.children if x.type == "identifier"), None)
                if ident is not None:
                    out.append((ident.text.decode(), "*"))
    return out


def _walk(root):
    stack = [root]
    while stack:
        n = stack.pop()
        yield n
        stack.extend(n.children)


def extract_imports(path: str, source: bytes, known: set[str]) -> list[ImportEdge]:
    if not path.endswith(SUPPORTED):
        return []
    parser = TS_PARSER if path.endswith(".ts") else TSX_PARSER
    tree = parser.parse(source)
    edges: list[ImportEdge] = []
    seen: set[tuple] = set()
    bound: dict[str, tuple[str, str]] = {}  # local name -> (file it comes from, imported name)

    # 1) import lines: file -> file / file -> package edges, and remember what each name points to
    for node in tree.root_node.children:
        if node.type not in ("import_statement", "export_statement"):
            continue
        spec = _spec(node)
        if not spec:
            continue
        local = spec.startswith((".", "@/", "~/"))
        to_path = _resolve(path, spec, known) if local else None

        if to_path and node.type == "import_statement":
            for local_name, imported in _bindings(node):
                bound[local_name] = (to_path, imported)

        if local and not to_path:
            continue  # unresolved local import (css, missing file...): not a file edge, not a package
        target = None if to_path else _package(spec)
        key = (to_path, target)
        if key in seen:
            continue
        seen.add(key)
        edges.append(ImportEdge(from_path=path, to_path=to_path, target_name=target))

    # 2) the rest of the file: where are the imported names actually used?
    called: set[tuple[str, str]] = set()
    for n in _walk(tree.root_node):
        name = prop = None
        if n.type == "call_expression":
            fn = n.child_by_field_name("function")
            if fn is None:
                continue
            if fn.type == "identifier":  # getUser(...)
                name = fn.text.decode()
            elif fn.type == "member_expression":  # api.getUser(...)
                obj = fn.child_by_field_name("object")
                p = fn.child_by_field_name("property")
                if obj is not None and p is not None and obj.type == "identifier":
                    name, prop = obj.text.decode(), p.text.decode()
        elif n.type == "new_expression":  # new UserService()
            ctor = n.child_by_field_name("constructor")
            if ctor is not None and ctor.type == "identifier":
                name = ctor.text.decode()
        elif n.type in ("jsx_opening_element", "jsx_self_closing_element"):  # <Button />
            el = n.child_by_field_name("name")
            if el is not None and el.type == "identifier":
                name = el.text.decode()

        if name is None or name not in bound:
            continue
        to_path, imported = bound[name]
        target = prop if imported == "*" else imported
        if not target or (to_path, target) in called:
            continue
        called.add((to_path, target))
        edges.append(ImportEdge(from_path=path, to_path=to_path, target_name=target, kind="calls"))

    return edges