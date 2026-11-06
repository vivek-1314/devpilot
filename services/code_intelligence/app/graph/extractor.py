import hashlib
from dataclasses import dataclass

import tree_sitter_typescript as tsts
from tree_sitter import Language, Parser

TS_PARSER = Parser(Language(tsts.language_typescript()))
TSX_PARSER = Parser(Language(tsts.language_tsx()))

SUPPORTED = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs")


@dataclass
class SymbolNode:
    kind: str
    name: str
    qualified_name: str
    start_line: int
    end_line: int
    signature: str
    content_hash: str


def extract_symbols(path: str, source: bytes) -> list[SymbolNode]:
    if not path.endswith(SUPPORTED):
        return []

    parser = TS_PARSER if path.endswith(".ts") else TSX_PARSER
    tree = parser.parse(source)
    out: list[SymbolNode] = []
    seen: set[str] = set()

    def add(kind: str, name: str, scope: str | None, node) -> None:
        qualified = f"{path}::{scope + '.' if scope else ''}{name}"
        if qualified in seen:
            return
        seen.add(qualified)
        text = source[node.start_byte:node.end_byte]
        first_line = text.split(b"\n", 1)[0].decode("utf-8", "replace").strip()[:200]
        out.append(
            SymbolNode(
                kind=kind,
                name=name,
                qualified_name=qualified,
                start_line=node.start_point[0] + 1,
                end_line=node.end_point[0] + 1,
                signature=first_line,
                content_hash=hashlib.sha256(text).hexdigest(),
            )
        )

    def visit(node, scope: str | None) -> None:
        t = node.type

        if t == "function_declaration":
            name = node.child_by_field_name("name")
            if name:
                add("function", name.text.decode(), scope, node)
            return

        if t == "class_declaration":
            name = node.child_by_field_name("name")
            body = node.child_by_field_name("body")
            if name:
                class_name = name.text.decode()
                add("class", class_name, scope, node)
                if body:
                    for child in body.children:
                        visit(child, class_name)
            return

        if t == "method_definition":
            name = node.child_by_field_name("name")
            if name:
                add("method", name.text.decode(), scope, node)
            return

        if t == "variable_declarator":
            name = node.child_by_field_name("name")
            value = node.child_by_field_name("value")
            if (
                name is not None
                and name.type == "identifier"
                and value is not None
                and value.type in ("arrow_function", "function_expression")
            ):
                add("function", name.text.decode(), scope, node)
            return

        for child in node.children:
            visit(child, scope)

    visit(tree.root_node, None)
    return out
