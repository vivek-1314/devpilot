import hmac
import os

from fastapi import Header, HTTPException


import hmac
import os
import sys

from fastapi import Header, HTTPException


def _log(*a):
    print(*a, file=sys.stderr, flush=True)


def require_key(x_internal_key: str | None = Header(default=None)) -> None:
    expected = os.environ.get("INTERNAL_API_KEY", "")
    _log("KEY CHECK | server key loaded:", bool(expected), "| header sent:", bool(x_internal_key))
    _log("SERVER key:", repr(expected))
    _log("HEADER key:", repr(x_internal_key))
    if not expected:
        raise HTTPException(401, "Server has no INTERNAL_API_KEY loaded.")
    if not x_internal_key:
        raise HTTPException(401, "x-internal-key header missing.")
    if not hmac.compare_digest(x_internal_key, expected):
        raise HTTPException(401, "x-internal-key does not match.")


def current_user_id(
    x_internal_key: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None),
) -> str:
    require_key(x_internal_key)
    _log("USER CHECK | x-user-id sent:", bool(x_user_id))
    if not x_user_id or len(x_user_id) > 128 or not x_user_id.isprintable():
        raise HTTPException(401, "x-user-id header missing or invalid.")
    return x_user_id