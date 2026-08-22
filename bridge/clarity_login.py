"""Clarity auth session storage for the Mac Reminders bridge.

Stores the Supabase session (access token + refresh token) in a local file
(~/.clarity_session.json, chmod 600). We deliberately avoid the macOS Keychain
here because launchd agents run in a non-interactive session where Keychain
access is frequently denied (no UI / separate security context), which would
make the background sync fail silently.

The session file is in the user's home directory with 0600 perms, so it is
only readable by this user. For a single-user personal machine this is an
acceptable trade-off for reliable unattended sync.

Interface used by clarity_reminders_bridge.py:
    get_access_token() -> str          # valid JWT, auto-refreshes if expired
    store_session(email, password)     # one-time login, called by __main__
"""

import json
import os
import base64
import urllib.request
import urllib.error
import webbrowser

SUPABASE_URL = "https://pakfyyvdfwxglcjkatqz.supabase.co"
ANON_KEY = "sb_publishable_sC0C_y4pbJOUEANyk7o8Tg_u5PZpzVs"

SESSION_PATH = os.path.expanduser("~/.clarity_session.json")


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------
def _b64decodeurl(s: str) -> bytes:
    s += "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s)


def _jwt_claims(token: str) -> dict:
    try:
        return json.loads(_b64decodeurl(token.split(".")[1]))
    except Exception:
        return {}


def _is_expired(token: str) -> bool:
    claims = _jwt_claims(token)
    exp = claims.get("exp")
    if not exp:
        return False
    import time
    return time.time() >= exp - 30  # 30s skew


# ---------------------------------------------------------------------------
# Session file storage
# ---------------------------------------------------------------------------
def _save_session(session: dict) -> None:
    with open(SESSION_PATH, "w") as f:
        json.dump(session, f)
    os.chmod(SESSION_PATH, 0o600)


def _load_session() -> dict | None:
    try:
        with open(SESSION_PATH) as f:
            return json.load(f)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Supabase auth
# ---------------------------------------------------------------------------
def _auth_post(path: str, payload: dict) -> dict:
    req = urllib.request.Request(
        f"{SUPABASE_URL}/auth/v1/{path}",
        data=json.dumps(payload).encode(),
        headers={
            "apikey": ANON_KEY,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Supabase auth {path} -> {e.code}: {e.read().decode()[:300]}")


def _refresh(refresh_token: str) -> dict:
    return _auth_post(
        "token?grant_type=refresh_token",
        {"refresh_token": refresh_token},
    )


def get_access_token() -> str:
    """Return a valid access token, refreshing if needed. Raises if no session."""
    session = _load_session()
    if not session:
        raise RuntimeError(
            "No Clarity session found. Run: python3 clarity_login.py"
        )
    access = session.get("access_token")
    if access and not _is_expired(access):
        return access
    # Refresh
    refresh = session.get("refresh_token")
    if not refresh:
        raise RuntimeError("Session missing refresh token; re-run python3 clarity_login.py")
    new = _refresh(refresh)
    new["refresh_token"] = new.get("refresh_token", refresh)
    _save_session(new)
    return new["access_token"]


def store_session(email: str, password: str) -> None:
    """One-time login. Persists the session to ~/.clarity_session.json."""
    data = _auth_post("token?grant_type=password", {"email": email, "password": password})
    if not data.get("access_token"):
        raise RuntimeError(f"Login failed: {data}")
    _save_session(data)
    print(f"Stored session in {SESSION_PATH} (chmod 600). Bridge can now run unattended.")


if __name__ == "__main__":
    import getpass
    email = input("Clarity email: ").strip()
    password = getpass.getpass("Clarity password: ")
    store_session(email, password)
