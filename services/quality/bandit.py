"""Bandit: Python security."""
import time

from fastapi import HTTPException

from services.quality.shared import (
    PY_EXTS, ScanResult, checkout, finish, has_files, make_finding, parse_json, rel_path, run_cmd,
)

EXCLUDE = "./.git,./node_modules,./.venv,./venv,./env,./build,./dist,./site-packages"


def scan_bandit(full_name: str, ref: str | None, token: str) -> ScanResult:
    started = time.time()
    with checkout(full_name, ref, 1, token) as (root, commit):
        if not has_files(root, PY_EXTS):
            raise HTTPException(422, "No Python files found. Bandit only runs on Python repositories.")
        # Bandit exits 1 when it finds issues, which is a normal result.
        p = run_cmd(["bandit", "-r", ".", "-f", "json", "-q", "-x", EXCLUDE], cwd=root, ok_codes=(0, 1))
        out = [
            make_finding("Bandit", r.get("test_id", "bandit"), r.get("issue_text", ""), rel_path(root, r.get("filename", "")), r.get("line_number", 0), (r.get("issue_severity") or "LOW").lower())
            for r in parse_json(p.stdout, "Bandit", "{}").get("results", [])
        ]
        return finish("Bandit", full_name, commit, started, out)