"""ESLint: JavaScript / TypeScript lint + security rules."""
import os
import time
from pathlib import Path

from fastapi import HTTPException

from services.quality.shared import (
    JS_EXTS, ScanResult, Sev, checkout, finish, has_files, make_finding, parse_json, rel_path, run_cmd,
)

# Default: services/eslint/ next to this package. Override with the env vars below.
ESLINT_DIR = Path(os.environ.get("ESLINT_DIR", Path(__file__).resolve().parents[1] / "eslint"))
ESLINT_BIN = os.environ.get("ESLINT_BIN", str(ESLINT_DIR / "node_modules" / ".bin" / "eslint"))
ESLINT_CONFIG = os.environ.get("ESLINT_CONFIG", str(ESLINT_DIR / "eslint.config.mjs"))


def _eslint_sev(rule: str, level: int) -> Sev:
    if rule.startswith("security/"):
        return "high"
    return "medium" if level == 2 else "low"


def scan_eslint(full_name: str, ref: str | None, token: str) -> ScanResult:
    started = time.time()
    with checkout(full_name, ref, 1, token) as (root, commit):
        if not has_files(root, JS_EXTS):
            raise HTTPException(422, "No JavaScript or TypeScript files found.")
        # Uses this server's own ESLint config, so the repository's dependencies are never installed or run.
        p = run_cmd([ESLINT_BIN, "--no-config-lookup", "-c", ESLINT_CONFIG, "--format", "json", "--no-warn-ignored", "."], cwd=root, ok_codes=(0, 1))
        out = []
        for f in parse_json(p.stdout, "ESLint", "[]"):
            path = rel_path(root, f.get("filePath", ""))
            for m in f.get("messages", []):
                if m.get("fatal") or not m.get("ruleId"):
                    continue
                out.append(make_finding("ESLint", m["ruleId"], m.get("message", ""), path, m.get("line", 0), _eslint_sev(m["ruleId"], m.get("severity", 1))))
        return finish("ESLint", full_name, commit, started, out)