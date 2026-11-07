"""Gitleaks: secrets, any language."""
import tempfile
import time
from pathlib import Path

from services.quality.shared import ScanResult, checkout, finish, make_finding, parse_json, rel_path, run_cmd


def scan_gitleaks(full_name: str, ref: str | None, token: str) -> ScanResult:
    started = time.time()
    # Any language. The last 100 commits are cloned so secrets that were removed later are still found.
    with checkout(full_name, ref, 100, token) as (root, commit), tempfile.TemporaryDirectory() as tmp:
        report = Path(tmp) / "leaks.json"
        run_cmd(["gitleaks", "detect", "--source", str(root), "--report-format", "json", "--report-path", str(report), "--redact", "--no-banner", "--exit-code", "0", "--log-level", "error"])
        data = parse_json(report.read_text() if report.exists() else "", "Gitleaks", "[]") or []
        out = []
        for d in data:
            msg = d.get("Description") or d.get("RuleID", "Secret detected")
            sha = (d.get("Commit") or "")[:7]
            if sha:
                msg = f"{msg} (commit {sha})"
            out.append(make_finding("Gitleaks", d.get("RuleID", "secret"), msg, rel_path(root, d.get("File", "")), d.get("StartLine", 0), "high"))
        return finish("Gitleaks", full_name, commit, started, out)