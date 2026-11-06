import os

from supabase import Client, create_client

_client: Client | None = None


def get_db() -> Client:
    global _client
    if _client is None:
        url = os.environ.get("SUPABASE_URL") or os.environ["NEXT_PUBLIC_SUPABASE_URL"]
        _client = create_client(url, os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    return _client


def reset_db() -> None:
    global _client
    _client = None