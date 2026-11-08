"""Shared models and helpers used by every quality check."""
import base64
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Iterable, Literal

from fastapi import HTTPException
from pydantic import BaseModel

Sev = Literal["low", "medium", "high"]
Tool = Literal["Ruff", "Bandit", "Gitleaks", "ESLint"]

REPO_RE = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
REF_RE = re.compile(r"^[A-Za-z0-9_./-]+$")
PR_REF_RE = re.compile(r"^refs/pull/\d+/head$")
SKIP_DIRS = {".git", "node_modules", ".venv", "venv", "env", "dist", "build", "__pycache__", ".next", "site-packages"}
MAX_FINDINGS = 1000
SEV_RANK = {"high": 0, "medium": 1, "low": 2}
PY_EXTS = {".py"}
JS_EXTS = {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"}


class Finding(BaseModel):
    id: str
    tool: Tool
    rule: str
    msg: str
    file: str
    line: int
    sev: Sev


class ScanResult(BaseModel):
    tool: Tool
    repo: str
    commit: str
    duration_ms: int
    total: int
    findings: list[Finding]


def run_cmd(cmd: list[str], cwd: Path | None = None, timeout: int = 300, ok_codes: Iterable[int] = (0,)) -> subprocess.CompletedProcess:
    try:
        p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, f"{Path(cmd[0]).name} timed out.")
    except FileNotFoundError:
        raise HTTPException(500, f"{Path(cmd[0]).name} is not installed on the API server.")
    if p.returncode not in tuple(ok_codes):
        raise HTTPException(502, f"{Path(cmd[0]).name} failed: {p.stderr.strip()[:300]}")
    return p


@contextmanager
def checkout(full_name: str, ref: str | None, depth: int, token: str):
    """Shallow-clone into a temp dir and always delete it. The token is sent as a one-off
    header, so it is never written to .git/config."""
    if not REPO_RE.match(full_name) or any(part in (".", "..") for part in full_name.split("/")):
        raise HTTPException(400, "Invalid repository name.")
    if ref and (not REF_RE.match(ref) or ref.startswith("-")):
        raise HTTPException(400, "Invalid ref.")

    pr_ref = bool(ref and PR_REF_RE.match(ref))
    basic = base64.b64encode(f"x-access-token:{token}".encode()).decode()
    cmd = ["git", "-c", "credential.helper=", "-c", f"http.extraHeader=Authorization: Basic {basic}"]
    cmd += ["-c", "core.hooksPath=/dev/null", "clone", "--quiet", "--depth", str(depth), "--no-tags"]
    if ref and not pr_ref:
        cmd += ["--branch", ref]

    tmp = tempfile.mkdtemp(prefix="quality-")
    dest = Path(tmp) / "repo"
    try:
        cmd += [f"https://github.com/{full_name}.git", str(dest)]
        try:
            p = subprocess.run(
                cmd, capture_output=True, text=True, timeout=180,
                env={**os.environ, "GIT_TERMINAL_PROMPT": "0", "GIT_ASKPASS": "/bin/true"},
            )
        except subprocess.TimeoutExpired:
            raise HTTPException(504, "Cloning the repository timed out.")
        if p.returncode != 0:
            raise HTTPException(404, "Could not clone the repository.")
        if pr_ref:
            git = ["git", "-C", str(dest), "-c", "credential.helper=", "-c", f"http.extraHeader=Authorization: Basic {basic}", "-c", "core.hooksPath=/dev/null"]
            run_cmd(git + ["fetch", "--quiet", "--depth", "1", "origin", ref], timeout=180)
            run_cmd(git + ["checkout", "--quiet", "FETCH_HEAD"])
        commit = run_cmd(["git", "-C", str(dest), "rev-parse", "HEAD"]).stdout.strip()
        yield dest, commit
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def has_files(root: Path, exts: set[str]) -> bool:
    for _, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        if any(Path(f).suffix.lower() in exts for f in files):
            return True
    return False


def rel_path(root: Path, p: str) -> str:
    if os.path.isabs(p):
        return os.path.relpath(p, root.resolve()).replace(os.sep, "/")
    return p.removeprefix("./").replace(os.sep, "/")


def make_finding(tool: Tool, rule: str, msg: str, file: str, line: int, sev: Sev) -> Finding:
    raw = f"{tool}|{rule}|{file}|{line}|{msg}"
    return Finding(id=hashlib.sha1(raw.encode()).hexdigest()[:12], tool=tool, rule=rule, msg=msg, file=file, line=max(int(line or 0), 0), sev=sev)


def finish(tool: Tool, repo: str, commit: str, started: float, findings: list[Finding]) -> ScanResult:
    unique = list({f.id: f for f in findings}.values())
    unique.sort(key=lambda f: (SEV_RANK[f.sev], f.file, f.line))
    return ScanResult(tool=tool, repo=repo, commit=commit, duration_ms=int((time.time() - started) * 1000), total=len(unique), findings=unique[:MAX_FINDINGS])


def parse_json(text: str, name: str, empty: str):
    try:
        return json.loads(text or empty)
    except json.JSONDecodeError:
        raise HTTPException(502, f"{name} returned unreadable output.")