#!/usr/bin/env python3
"""
clarity_login.py — one-time auth for the Mac bridge.

Prompts for your Clarity email/password, signs in via Supabase auth, and stores
the access + refresh tokens in the macOS Keychain (service: "clarity-bridge").
The launchd agent reads these so the sync runs unattended.

Run once, then forget about it. The refresh token is long-lived; the helper
also exposes a `get_token()` for the bridge to mint a fresh access token.

Usage:
  python3 clarity_login.py            # interactive sign-in, stores tokens
  python3 clarity_login.py --status   # show stored user / token expiry
"""
import argparse
import datetime as dt
import getpass
import json
import subprocess
import sys
import urllib.error
import urllib.request
from typing import Optional

SUPABASE_URL = "https://pakfyyvdfwxglcjkatqz.supabase.co"
ANON_KEY = "sb_publishable_sC0C_y4pbJOUEANyk7o8Tg_u5PZpzVs"
SERVICE = "clarity-bridge"
KEY_USER = "supabase-session"


def _keychain_get() -> Optional[dict]:
    try:
        out = subprocess.run(
            ["security", "find-generic-password", "-s", SERVICE, "-w"],
            capture_output=True, text=True,
        )
        if out.returncode != 0:
            return None
        return json.loads(out.stdout.strip())
    except Exception:
        return None


def _keychain_set(data: dict) -> None:
    subprocess.run(
        ["security", "add-generic-password", "-s", SERVICE, "-a", KEY_USER,
         "-w", json.dumps(data), "-U"],
        capture_output=True, text=True, check=True,
    )


def _post(path: str, payload: dict) -> dict:
    req = urllib.request.Request(
        f"{SUPABASE_URL}{path}",
        data=json.dumps(payload).encode(),
        headers={"apikey": ANON_KEY, "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def get_access_token() -> str:
    """Return a valid access token, refreshing if expired."""
    sess = _keychain_get()
    if not sess:
        raise RuntimeError("No stored session. Run clarity_login.py first.")
    now = dt.datetime.now(dt.timezone.utc).timestamp()
    expires_at = sess.get("expires_at", 0)
    if now < expires_at - 60:
        return sess["access_token"]
    # refresh
    refreshed = _post(
        "/auth/v1/token?grant_type=refresh_token",
        {"refresh_token": sess["refresh_token"]},
    )
    sess["access_token"] = refreshed["access_token"]
    sess["refresh_token"] = refreshed.get("refresh_token", sess["refresh_token"])
    sess["expires_at"] = now + refreshed.get("expires_in", 3600)
    _keychain_set(sess)
    return sess["access_token"]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--status", action="store_true")
    args = ap.parse_args()
    if args.status:
        sess = _keychain_get()
        if not sess:
            print("No session stored.")
            return 1
        exp = dt.datetime.fromtimestamp(sess.get("expires_at", 0), dt.timezone.utc)
        print(f"User: {sess.get('user_email')}  Expires: {exp.isoformat()}")
        return 0

    email = input("Clarity email: ").strip()
    password = getpass.getpass("Clarity password: ")
    try:
        res = _post("/auth/v1/token?grant_type=password",
                    {"email": email, "password": password})
    except urllib.error.HTTPError as e:
        print(f"Sign-in failed: {e.code} {e.read().decode()}")
        return 1
    now = dt.datetime.now(dt.timezone.utc).timestamp()
    _keychain_set({
        "access_token": res["access_token"],
        "refresh_token": res["refresh_token"],
        "expires_at": now + res.get("expires_in", 3600),
        "user_email": email,
    })
    print("Stored session in Keychain. Bridge can now run unattended.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
