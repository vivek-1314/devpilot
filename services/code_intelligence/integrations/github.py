import os
import time

import httpx
import jwt


def _app_jwt() -> str:
    now = int(time.time())
    with open(os.environ["GITHUB_APP_PRIVATE_KEY_PATH"]) as f:
        key = f.read()
    payload = {
        "iat": now - 60,
        "exp": now + 9 * 60,
        "iss": os.environ["GITHUB_APP_ID"],
    }
    return jwt.encode(payload, key, algorithm="RS256")


async def get_installation_token(installation_id: int) -> str:
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            f"https://api.github.com/app/installations/{installation_id}/access_tokens",
            headers={
                "Authorization": f"Bearer {_app_jwt()}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )
        r.raise_for_status()
        return r.json()["token"]