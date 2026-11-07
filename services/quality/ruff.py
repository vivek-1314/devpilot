"""Ruff: Python lint."""
import time

from fastapi import HTTPException

from services.quality.shared import (
    PY_EXTS, ScanResult, Sev, checkout, finish, has_files, make_finding, parse_json, rel_path, run_cmd,
)


def _ruff_sev(code: str) -> Sev:
    if code.startswith("E9"):
        return "high"
    return "medium" if code[:1] in ("F", "B") else "low"


def scan_ruff(full_name: str, ref: str | None, token: str) -> ScanResult:
    started = time.time()
    with checkout(full_name, ref, 1, token) as (root, commit):
        if not has_files(root, PY_EXTS):
            raise HTTPException(422, "No Python files found. Ruff only runs on Python repositories.")
        # --isolated: ignore the scanned repo's own ruff config so every repo gets the same rules.
        p = run_cmd(["ruff", "check", "--isolated", "--output-format", "json", "--no-cache", "--exit-zero", "."], cwd=root)
        out = []
        for d in parse_json(p.stdout, "Ruff", "[]"):
            code = d.get("code") or "syntax-error"
            out.append(make_finding("Ruff", code, d.get("message", ""), rel_path(root, d.get("filename", "")), (d.get("location") or {}).get("row", 0), _ruff_sev(code)))
        return finish("Ruff", full_name, commit, started, out)