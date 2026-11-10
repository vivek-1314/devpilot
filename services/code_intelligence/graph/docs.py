"""
Repo guide (SOP) generation. Put this at app/graph/docs.py.

Flow, called from index_repo:
  1. collect_facts()   inside the clone: deterministic, no LLM, only reads a few
                       non-code files (README, package.json, ...) plus nodes/edges.
  2. generate_docs()   after the clone is gone: LLM writes one Markdown section per
                       directory, then an overview from those sections.
  3. save_docs()       assembles ONE markdown document and upserts ONE row per repo.

Unchanged sections (same source_hash) are reused, so re-indexing only pays for changes.
"""

import asyncio
import hashlib
import json
import logging
import os
import re
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import httpx
from langchain_groq import ChatGroq

from services.common.db import get_db, reset_db

logger = logging.getLogger("devpilot.docs")

DOCS_MODEL = os.getenv("GROQ_DOCS_MODEL", "llama-3.1-8b-instant")  # small + cheap
CONCURRENCY = int(os.getenv("DOCS_CONCURRENCY", "2"))
USE_LLM = os.getenv("DOCS_USE_LLM", "1") != "0"  # set 0 to skip the LLM entirely
MAX_DOC_CHARS = int(os.getenv("DOCS_MAX_CHARS", "16000"))  # size cap of the final document (~4k tokens)
PROMPT_VERSION = 2  # bump when prompts change: forces cached LLM sections to regenerate
MAX_DIRS = 25
MIN_FILES_PER_DIR = 2

ENV_RE = re.compile(r"^\s*(?:export\s+)?([A-Za-z][A-Za-z0-9_]*)\s*=", re.M)
ENTRY_RE = re.compile(
    r"(^|/)(app/(page|layout)|pages/(index|_app)|src/(index|main|app)"
    r"|main|index|server|app|manage|__main__|wsgi|asgi)\.(tsx?|jsx?|mjs|py)$"
)


# ---------------------------------------------------------
# 1. Facts (inside the clone, no LLM)
# ---------------------------------------------------------

def _read(root: Path, name: str, limit: int) -> str | None:
    p = root / name
    try:
        if p.is_file():
            return p.read_text(encoding="utf-8", errors="replace")[:limit]
    except OSError:
        pass
    return None


def _package_json(text: str) -> dict | None:
    try:
        d = json.loads(text)
    except ValueError:
        return None
    return {
        "name": d.get("name"),
        "description": d.get("description"),
        "main": d.get("main"),
        "scripts": d.get("scripts"),
        "dependencies": sorted(d.get("dependencies") or {})[:40],
        "devDependencies": sorted(d.get("devDependencies") or {})[:25],
    }


def _hash(obj) -> str:
    return hashlib.sha256(
        json.dumps(obj, sort_keys=True, default=str).encode()
    ).hexdigest()[:16]


def collect_facts(root: Path, nodes: list[dict], edges: list) -> dict:
    """nodes: dicts from build_graph. edges: ImportEdge objects from build_graph."""
    files = [n for n in nodes if n["kind"] == "file"]

    symbols: dict[str, list[str]] = defaultdict(list)
    for n in nodes:
        if n["kind"] == "file":
            continue
        sig = (n.get("signature") or n["name"]).strip().replace("\n", " ")[:100]
        label = sig if sig.lower().startswith(n["kind"].lower()) else f"{n['kind']} {sig}"
        symbols[n["path"]].append(f"L{n['start_line']} {label}")

    file_hash = {f["path"]: f.get("content_hash") or "" for f in files}
    languages = Counter(f["language"] for f in files)

    imports = [e for e in edges if e.kind == "imports"]
    in_degree = Counter(e.to_path for e in imports if e.to_path)
    packages = Counter(e.target_name for e in imports if not e.to_path and e.target_name)

    def dir_of(path: str) -> str:
        return "/".join(path.split("/")[:-1][:2])

    dirs: dict[str, dict] = {}
    for f in files:
        d = dir_of(f["path"])
        if not d:
            continue
        info = dirs.setdefault(
            d,
            {"files": [], "imports_from": set(), "used_by": set(), "packages": Counter()},
        )
        info["files"].append(
            {
                "path": f["path"],
                "line_count": f["end_line"],
                "symbols": symbols.get(f["path"], [])[:25],
            }
        )

    for e in imports:
        src = dir_of(e.from_path)
        if e.to_path:
            dst = dir_of(e.to_path)
            if src in dirs and dst in dirs and src != dst:
                dirs[src]["imports_from"].add(dst)
                dirs[dst]["used_by"].add(src)
        elif e.target_name and src in dirs:
            dirs[src]["packages"][e.target_name] += 1

    keep = sorted(
        (d for d, i in dirs.items() if len(i["files"]) >= MIN_FILES_PER_DIR),
        key=lambda d: -len(dirs[d]["files"]),
    )[:MAX_DIRS]

    final_dirs: dict[str, dict] = {}
    for d in sorted(keep):
        i = dirs[d]
        info = {
            "files": sorted(i["files"], key=lambda x: x["path"]),
            "imports_from": sorted(i["imports_from"]),
            "used_by": sorted(i["used_by"]),
            "packages": [p for p, _ in i["packages"].most_common(12)],
        }
        info["hash"] = _hash(
            {
                "files": [(x["path"], file_hash.get(x["path"])) for x in info["files"]],
                "in": info["imports_from"],
                "out": info["used_by"],
            }
        )
        final_dirs[d] = info

    key_files: dict = {}
    for name in ("README.md", "readme.md", "README"):
        text = _read(root, name, 6000)
        if text:
            key_files["README"] = text
            break
    for name in (".env.example", ".env.sample"):
        text = _read(root, name, 5000)
        if text:
            # names only, never values
            key_files["env_vars"] = sorted(set(ENV_RE.findall(text)))[:40]
            break
    # manifests at the root, top level and one level down (monorepos: web/, services/api/)
    folders = [""] + sorted(set(dirs) | {p.split("/")[0] for p in file_hash if "/" in p})[:30]
    for folder in folders:
        pre = f"{folder}/" if folder else ""
        text = _read(root, pre + "package.json", 20000)
        if text:
            key_files[pre + "package.json"] = _package_json(text) or text[:1500]
        for name in ("requirements.txt", "pyproject.toml"):
            text = _read(root, pre + name, 2500)
            if text:
                key_files[pre + name] = text

    return {
        "files_total": len(files),
        "languages": dict(languages),
        "tree": sorted(f["path"] for f in files)[:200],
        "key_files": key_files,
        "entry_points": [f["path"] for f in files if ENTRY_RE.search(f["path"])][:12],
        "most_imported": in_degree.most_common(10),
        "external_packages": [p for p, _ in packages.most_common(25)],
        "dirs": final_dirs,
    }


# ---------------------------------------------------------
# 2. LLM generation
# ---------------------------------------------------------

DIR_SYSTEM = """You write ONE section of a repository guide, about one directory.
Use ONLY the facts provided. Never invent behaviour. Do not start with a heading.
Rules:
- Use the full file paths exactly as given in the facts.
- Cite a location only for symbols, as path:line using the Lnn numbers listed
  with the symbol. "line_count" is the size of a file, never a location.
- If a file has no symbols listed, say it has no indexed symbols. Do not guess
  what it does beyond what its name and the other facts support.
- If the facts show no imports or users, say the index found none.
Write short Markdown, under 250 words, with these parts:
**Purpose**, **Key files and symbols**, **Depends on / used by**."""

INTRO_SYSTEM = """You write the opening of a repository guide: exactly two sections.
## What this repo is   (3 to 5 sentences: what it does and who it is for)
## Architecture        (how the main parts fit together, from the directory summaries)
Use ONLY the facts and directory summaries provided. Never invent features.
The README can be out of date. When it conflicts with the indexed files and
symbols, trust the index and say the README may be outdated.
Use full paths. Under 250 words. Do not write any other sections."""


def _clip(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[:limit] + "\n...[truncated]"


def _clean(text: str) -> str:
    return re.sub(r"<think>.*?</think>", "", text or "", flags=re.DOTALL).strip()


def _make_llm() -> ChatGroq:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not configured.")
    return ChatGroq(
        model=DOCS_MODEL, api_key=api_key, temperature=0, max_retries=3, timeout=90
    )


async def _ask(llm: ChatGroq, system: str, user: str, max_tokens: int = 900) -> str:
    reply = await llm.ainvoke([("system", system), ("user", user)], max_tokens=max_tokens)
    meta = getattr(reply, "response_metadata", None) or {}
    if meta.get("finish_reason") == "length":
        logger.warning("LLM output hit the token limit; discarding the truncated text")
        return ""
    content = reply.content
    if isinstance(content, list):
        content = "".join(p if isinstance(p, str) else p.get("text", "") for p in content)
    return _clean(content)


def _load_existing(repo_id: int) -> dict[str, dict]:
    """Cached sections of the current document: {scope: {source_hash, content_md}}."""
    rows = (
        get_db()
        .table("repo_docs")
        .select("sections")
        .eq("repo_id", repo_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    return (rows[0].get("sections") or {}) if rows else {}


_SYM_RE = re.compile(r"L(\d+) (.*)")


def _sym_line(path: str, sym: str) -> str:
    m = _SYM_RE.match(sym)
    return f"`{path}:{m.group(1)}` {m.group(2)}" if m else f"`{path}` {sym}"


def _strip_heading(md: str) -> str:
    """Section titles come from the assembler, so drop any heading the model started with."""
    while True:
        new = re.sub(r"\A\s*#{1,6}[^\n]*\n+", "", md)
        if new == md:
            return md.strip()
        md = new


def _pkgs(kf: dict) -> dict:
    return {k: v for k, v in kf.items() if k.endswith("package.json") and isinstance(v, dict)}


def render_dir_md(d: str, info: dict) -> str:
    """Deterministic section, built only from the index. No LLM."""
    out = [
        "**Purpose**",
        f"Directory `{d}/` with {len(info['files'])} indexed files. "
        "(Plain index listing, not an LLM summary.)",
        "",
        "**Key files and symbols**",
    ]
    for f in info["files"][:15]:
        out.append(f"- `{f['path']}` ({f['line_count']} lines)")
        for sym in f["symbols"][:8]:
            out.append(f"  - {_sym_line(f['path'], sym)}")
    out += ["", "**Depends on / used by**"]
    out.append("- Imports from: " + (", ".join(f"`{x}/`" for x in info["imports_from"]) or "none found"))
    out.append("- Used by: " + (", ".join(f"`{x}/`" for x in info["used_by"]) or "none found"))
    if info["packages"]:
        out.append("- Packages: " + ", ".join(info["packages"]))
    return "\n".join(out)


def _facts_sections(facts: dict) -> str:
    """Tech stack, how to run, entry points, directory map. Built from the index only,
    always present, never written (or cut off) by the LLM."""
    kf = facts.get("key_files", {})
    pkgs = _pkgs(kf)
    pyfiles = sorted(k for k in kf if k.endswith(("requirements.txt", "pyproject.toml")))

    out = ["## Tech stack"]
    out.append(", ".join(f"{lang} ({n} files)" for lang, n in facts["languages"].items()) or "unknown")
    for k, v in pkgs.items():
        if v.get("dependencies"):
            out.append(f"- `{k}` dependencies: " + ", ".join(v["dependencies"][:20]))
    for k in pyfiles:
        if k.endswith("requirements.txt"):
            names = re.findall(r"^[A-Za-z0-9_.\-]+", kf[k], re.M)[:20]
            if names:
                out.append(f"- `{k}`: " + ", ".join(names))
    if not pkgs and not pyfiles and facts["external_packages"]:
        out.append("Packages used: " + ", ".join(facts["external_packages"][:20]))

    out += ["", "## How to run"]
    found = False
    for k, v in pkgs.items():
        if v.get("scripts"):
            found = True
            out.append(f"**`{k}`** scripts:")
            out += [f"- `{n}`: `{c}`" for n, c in list(v["scripts"].items())[:8]]
    for k in pyfiles:
        found = True
        out.append(f"- Python project: see `{k}`")
    if not found:
        out.append("No run scripts found in the indexed files.")
    if kf.get("env_vars"):
        out.append("Environment variables: " + ", ".join(f"`{v}`" for v in kf["env_vars"]))

    out += ["", "## Entry points"]
    out += [f"- `{p}`" for p in facts["entry_points"]] or ["- none detected"]

    if facts["most_imported"]:
        out += ["", "## Most imported files"]
        out += [f"- `{p}` ({n} importers)" for p, n in facts["most_imported"]]

    out += ["", "## Directory map"]
    for d, info in facts["dirs"].items():
        deps = ", ".join(f"`{x}/`" for x in info["imports_from"]) or "nothing internal"
        out.append(f"- `{d}/`: {len(info['files'])} files, imports from {deps}")
    return "\n".join(out)


def render_intro_md(repo_name: str, facts: dict) -> str:
    """Deterministic opening, used when the LLM is off or fails."""
    kf = facts.get("key_files", {})
    out = ["## What this repo is", f"`{repo_name}`: {facts['files_total']} indexed files."]
    desc = next((v["description"] for v in _pkgs(kf).values() if v.get("description")), None)
    if desc:
        out.append(desc)
    if kf.get("README"):
        out += ["", "From the README:", "", kf["README"].strip()[:700]]
    return "\n".join(out)


def render_overview_md(repo_name: str, facts: dict) -> str:
    return render_intro_md(repo_name, facts) + "\n\n" + _facts_sections(facts)


async def generate_docs(repo_name: str, facts: dict, existing: dict[str, dict]) -> list[dict]:
    """LLM-written prose where possible, deterministic sections everywhere else.
    The table is never left empty, and facts are never lost to a truncated LLM answer."""
    llm = None
    if USE_LLM:
        try:
            llm = _make_llm()
        except Exception as exc:
            logger.error("LLM unavailable, writing plain docs: %s", exc)
    suffix = f"-llm{PROMPT_VERSION}" if llm else "-plain"
    sem = asyncio.Semaphore(CONCURRENCY)
    counts = Counter()

    async def write(scope: str, base_hash: str, system: str, user: str, plain_md: str,
                    max_tokens: int, strip_heading: bool = False) -> dict:
        want = base_hash + suffix
        old = existing.get(scope)
        if old and old.get("source_hash") == want:
            return {"scope": scope, "content_md": old["content_md"], "source_hash": want}
        md = ""
        if llm:
            try:
                async with sem:
                    md = await _ask(llm, system, user, max_tokens)
            except Exception as exc:
                logger.error("LLM failed for %s: %s", scope, exc)
            if md and strip_heading:
                md = _strip_heading(md)
            if len(md) < 80:
                md = ""
        if md:
            counts["llm"] += 1
            return {"scope": scope, "content_md": md, "source_hash": want}
        counts["plain"] += 1
        # "-plain" never equals a future "-llm" hash, so it is retried on the next index
        return {"scope": scope, "content_md": plain_md, "source_hash": base_hash + "-plain"}

    async def one_dir(d: str, info: dict) -> dict:
        facts_json = _clip(json.dumps({k: v for k, v in info.items() if k != "hash"},
                                      separators=(",", ":")), 6000)
        doc = await write(f"dir:{d}", info["hash"], DIR_SYSTEM,
                          f"Directory: {d}\nFacts:\n{facts_json}", render_dir_md(d, info),
                          max_tokens=900, strip_heading=True)
        doc["title"] = d
        return doc

    dir_docs = list(await asyncio.gather(*(one_dir(d, i) for d, i in facts["dirs"].items())))

    overview_facts = {k: v for k, v in facts.items() if k not in ("dirs", "tree")}
    overview_facts["tree"] = facts["tree"][:120]
    base = _hash({"repo": repo_name, "facts": overview_facts,
                  "dirs": {d["scope"]: d["source_hash"] for d in dir_docs}})
    summaries = "\n\n".join(f"### {d['title']}\n{_clip(d['content_md'], 600)}" for d in dir_docs)
    user = (
        f"Repository: {repo_name}\n\nFACTS:\n"
        f"{_clip(json.dumps(overview_facts, separators=(',', ':')), 9000)}\n\n"
        f"DIRECTORY SUMMARIES:\n{_clip(summaries, 8000)}"
    )
    overview = await write("overview", base, INTRO_SYSTEM, user,
                           render_intro_md(repo_name, facts), max_tokens=700)
    overview["title"] = repo_name

    facts_md = _facts_sections(facts)
    facts_doc = {"scope": "facts", "title": "facts", "content_md": facts_md,
                 "source_hash": _hash(facts_md) + "-plain"}

    logger.info("docs for %s: %d LLM sections, %d plain sections",
                repo_name, counts["llm"], counts["plain"])
    return [overview, facts_doc, *dir_docs]


# ---------------------------------------------------------
# 3. Assemble ONE markdown document and save ONE row per repo
# ---------------------------------------------------------

def assemble_markdown(repo_name: str, sha: str, docs: list[dict]) -> str:
    """overview first, then one subsection per directory, trimmed to MAX_DOC_CHARS."""
    overview = next((d for d in docs if d["scope"] == "overview"), None)
    facts_doc = next((d for d in docs if d["scope"] == "facts"), None)
    dirs = sorted((d for d in docs if d["scope"] not in ("overview", "facts")),
                  key=lambda d: d["scope"])

    parts = [f"# {repo_name}: repository guide", f"_Indexed commit: `{sha[:7]}`_", ""]
    for d in (overview, facts_doc):
        if d:
            parts += [d["content_md"].strip(), ""]

    if dirs:
        parts += ["## Modules (by directory)", ""]
        used = sum(len(p) + 1 for p in parts)
        omitted = []
        for d in dirs:
            block = f"### `{d['title']}/`\n{d['content_md'].strip()}\n"
            if used + len(block) > MAX_DOC_CHARS:
                omitted.append(d["title"])
                continue
            parts.append(block)
            used += len(block)
        if omitted:
            parts.append("_Omitted for size: " + ", ".join(f"`{o}/`" for o in omitted) + "_")

    return "\n".join(parts).strip() + "\n"


def save_docs(repo_id: int, sha: str, repo_name: str, docs: list[dict], attempts: int = 3) -> int:
    """Upsert the single row for this repo. A new index replaces the old one entirely."""
    if not docs:
        return 0
    content = assemble_markdown(repo_name, sha, docs)
    row = {
        "repo_id": repo_id,
        "content_md": content,
        "sections": {
            d["scope"]: {"source_hash": d["source_hash"], "content_md": d["content_md"]}
            for d in docs
        },
        "commit_sha": sha,
        "token_estimate": len(content) // 4,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    for i in range(attempts):
        try:
            get_db().table("repo_docs").upsert(row, on_conflict="repo_id").execute()
            return len(docs)
        except httpx.TransportError:
            reset_db()
            if i == attempts - 1:
                raise
            time.sleep(1 + i)
    return 0


async def generate_and_save_docs(repo_id: int, sha: str, repo_name: str, facts: dict) -> int:
    existing = await asyncio.to_thread(_load_existing, repo_id)
    docs = await generate_docs(repo_name, facts, existing)
    return await asyncio.to_thread(save_docs, repo_id, sha, repo_name, docs)