import asyncio
import base64
import os
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

from services.common.github import get_installation_token

async def _run(*args: str, cwd: str | None = None, timeout: int = 120) -> str:
    env = {**os.environ, "GIT_TERMINAL_PROMPT": "0", "GIT_ASKPASS": "/bin/true"}
    proc = await asyncio.create_subprocess_exec(
        *args,
        cwd=cwd,
        env=env,
        stdin=asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        out, err = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        proc.kill()
        raise RuntimeError(f"git timed out after {timeout}s")
    if proc.returncode != 0:
        raise RuntimeError(f"git failed: {err.decode()[:500]}")
    return out.decode().strip()


@asynccontextmanager
async def cloned_repo(installation_id: int, full_name: str, branch: str):
    token = await get_installation_token(installation_id)
    basic = base64.b64encode(f"x-access-token:{token}".encode()).decode()

    with tempfile.TemporaryDirectory(prefix="devpilot-") as tmp:
        dest = Path(tmp) / "repo"
        await _run(
            "git",
            "-c", "credential.helper=",
            "-c", f"http.extraheader=AUTHORIZATION: basic {basic}",
            "clone", "--depth", "1", "--branch", branch,
            f"https://github.com/{full_name}.git",
            str(dest),
        )
        sha = await _run("git", "rev-parse", "HEAD", cwd=str(dest))
        yield dest, sha
