#!/usr/bin/env python3
"""
clarity_reminders_bridge.py
===========================
Two-way sync between Apple Reminders (on this Mac) and the Clarity app
(Supabase `clarity_tasks`). Runs as a launchd agent; invoked by Clarity's
"Sync" button which sets a `pending` flag in `clarity_sync_state`.

Design
------
- Reminders are read/written via `osascript` (AppleScript). AppleScript gives
  us a *persistent* reminder id (the `id` property) we use to match rows.
- Reminders flow -> Clarity as rows with source='reminders', external_id=<id>.
- Clarity edits (title/notes/completed/due/delete) flow -> Reminders, matched
  by external_id. Local tasks (source='local') are never touched.
- Conflict resolution: last-write-wins on updated_at vs synced_at.

Requires: macOS, python3 (stdlib only). Supabase anon key (publishable).
No third-party packages.

Usage
-----
  python3 clarity_reminders_bridge.py              # full two-way sync
  python3 clarity_reminders_bridge.py --once       # alias of above
  python3 clarity_reminders_bridge.py --clear-pending
"""

import argparse
import datetime as dt
import json
import subprocess
import sys
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------------------
# CONFIG  (the anon key is publishable; safe to keep here)
# ---------------------------------------------------------------------------
SUPABASE_URL = "https://pakfyyvdfwxglcjkatqz.supabase.co"
ANON_KEY = "sb_publishable_sC0C_y4pbJOUEANyk7o8Tg_u5PZpzVs"
# Reminders lists to sync. Empty list = all lists.
SYNC_LISTS: List[str] = []
# Only include reminders not completed older than this many days (0 = all)
MAX_PAST_DAYS = 0

HEADERS = {
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}",
    "Content-Type": "application/json",
}


# ---------------------------------------------------------------------------
# Supabase REST helpers
# ---------------------------------------------------------------------------
def _url(table: str, qs: str = "") -> str:
    return f"{SUPABASE_URL}/rest/v1/{table}{qs}"


def _req(method: str, url: str, body: Optional[Any] = None) -> Any:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        detail = e.read().decode() if e.fp else ""
        raise RuntimeError(f"Supabase {method} {url} -> {e.code}: {detail}")


def get_user_id(access_token: str) -> str:
    """Exchange the access token for the user id (auth.uid() isn't callable via REST)."""
    req = urllib.request.Request(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={"apikey": ANON_KEY, "Authorization": f"Bearer {access_token}"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())["id"]


# ---------------------------------------------------------------------------
# AppleScript / Reminders access
# ---------------------------------------------------------------------------
def _quote(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def fetch_reminders() -> List[Dict[str, Any]]:
    """Return reminders as dicts with a persistent 'id' from Reminders.app."""
    list_filter = ""
    if SYNC_LISTS:
        names = ", ".join(f'"{_quote(n)}"' for n in SYNC_LISTS)
        list_filter = f" whose container's name is in {{ {names} }}"
    script = f'''
    set out to {{}}
    tell application "Reminders"
      repeat with r in (every reminder{list_filter})
        set end of out to {{
          "id", (id of r as text),
          "title", (name of r),
          "notes", (notes of r),
          "completed", (completed of r),
          "list", (name of (container of r)),
          "due", (due date of r as text),
          "flagged", (flagged of r)
        }}
      end repeat
    end tell
    return out
    '''
    raw = subprocess.run(
        ["osascript", "-ss"], input=script, capture_output=True, text=True
    ).stdout
    return _parse_reminders_record(raw)


def _parse_reminders_record(text: str) -> List[Dict[str, Any]]:
    """Parse the AppleScript record list into dicts."""
    items: List[Dict[str, Any]] = []
    # AppleScript returns a flat list of key/value pairs; reconstruct records.
    # Format: {{"id", "x", "title", "y", ...}, {...}}
    import re

    # Split top-level records on "}, {" boundaries is unreliable; use a tokenizer.
    # Simpler: replace record delimiters, then walk pairs.
    text = text.strip()
    if not text or text == "{}":
        return items
    # Remove outer braces
    text = text[1:-1] if text.startswith("{") and text.endswith("}") else text
    # Tokenize quoted strings and bare words
    tokens = re.findall(r'"((?:[^"\\]|\\.)*)"|(\S+)', text)
    flat = [t[0] if t[0] != "" else t[1] for t in tokens]
    cur: Dict[str, Any] = {}
    i = 0
    while i < len(flat):
        key = flat[i]
        if key in ("id", "title", "notes", "completed", "list", "due", "flagged", "flagged"):
            val = flat[i + 1] if i + 1 < len(flat) else ""
            if key == "completed":
                val = val.lower() in ("true", "yes")
            cur[key] = val
        else:
            # beginning of a new record marker without explicit close; push if filled
            if cur:
                items.append(cur)
                cur = {}
        i += 1
    if cur:
        items.append(cur)
    # Normalize due dates
    for it in items:
        it["due"] = _parse_applescript_date(it.get("due", ""))
    return items


def _parse_applescript_date(s: str) -> Optional[str]:
    if not s or s == "missing value":
        return None
    s = s.strip()
    # AppleScript date format e.g. "Tuesday, August 21, 2026 at 3:04:00 PM"
    try:
        parsed = dt.datetime.strptime(s, "%A, %B %d, %Y at %I:%M:%S %p")
        return parsed.date().isoformat()
    except ValueError:
        try:
            parsed = dt.datetime.strptime(s, "%A, %B %d, %Y")
            return parsed.date().isoformat()
        except ValueError:
            return None


def set_reminder_completed(reminder_id: str, completed: bool) -> None:
    verb = "set completed of" if completed else "set completed of"
    script = f'''
    tell application "Reminders"
      if exists (first reminder whose id is "{_quote(reminder_id)}") then
        set completed of (first reminder whose id is "{_quote(reminder_id)}") to {"true" if completed else "false"}
      end if
    end tell
    '''
    subprocess.run(["osascript", "-e", script], capture_output=True, text=True)


def set_reminder_title(reminder_id: str, title: str) -> None:
    script = f'''
    tell application "Reminders"
      if exists (first reminder whose id is "{_quote(reminder_id)}") then
        set name of (first reminder whose id is "{_quote(reminder_id)}") to "{_quote(title)}"
      end if
    end tell
    '''
    subprocess.run(["osascript", "-e", script], capture_output=True, text=True)


def delete_reminder(reminder_id: str) -> None:
    script = f'''
    tell application "Reminders"
      if exists (first reminder whose id is "{_quote(reminder_id)}") then
        delete (first reminder whose id is "{_quote(reminder_id)}")
      end if
    end tell
    '''
    subprocess.run(["osascript", "-e", script], capture_output=True, text=True)


# ---------------------------------------------------------------------------
# Sync core
# ---------------------------------------------------------------------------
def pull_reminders_to_supabase(user_id: str, access_token: str) -> None:
    """Reminders -> Supabase. Upsert by external_id for this user."""
    reminders = fetch_reminders()
    rows = []
    for r in reminders:
        rows.append({
            "user_id": user_id,
            "external_id": r["id"],
            "source": "reminders",
            "title": r.get("title", "") or "",
            "description": r.get("notes", "") or "",
            "completed": bool(r.get("completed")),
            "due_date": r.get("due"),
            "favorite": bool(r.get("flagged")),
            "source_list": r.get("list", ""),
            "deleted_at": None,
            "synced_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        })
    if not rows:
        return
    # Upsert on (user_id, external_id)
    _req(
        "POST",
        _url("clarity_tasks", "?on_conflict=user_id,external_id"),
        rows,
    )


def push_clarity_edits_to_reminders(user_id: str, access_token: str) -> None:
    """Clarity edits -> Reminders. Only source='reminders' rows changed since synced_at."""
    resp = _req(
        "GET",
        _url(
            "clarity_tasks",
            f"?select=*&user_id=eq.{user_id}&source=eq.reminders"
            f"&updated_at=gt.synced_at&order=updated_at.asc",
        ),
    )
    for row in resp or []:
        ext = row.get("external_id")
        if not ext:
            continue
        if row.get("deleted_at"):
            delete_reminder(ext)
        else:
            if row.get("title"):
                set_reminder_title(ext, row["title"])
            set_reminder_completed(ext, bool(row.get("completed")))


def mark_synced(user_id: str) -> None:
    _req(
        "POST",
        _url("clarity_sync_state", "?on_conflict=user_id"),
        {
            "user_id": user_id,
            "last_synced_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            "pending": False,
            "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        },
    )


def clear_pending(user_id: str) -> None:
    _req(
        "POST",
        _url("clarity_sync_state", "?on_conflict=user_id"),
        {
            "user_id": user_id,
            "pending": False,
            "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        },
    )


def get_pending(user_id: str) -> bool:
    resp = _req(
        "GET",
        _url("clarity_sync_state", f"?select=pending&user_id=eq.{user_id}"),
    )
    if resp and len(resp) > 0:
        return bool(resp[0].get("pending"))
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Clarity <-> Apple Reminders bridge")
    parser.add_argument("--once", action="store_true", help="run one sync pass")
    parser.add_argument("--clear-pending", action="store_true")
    args = parser.parse_args()

    # Get a valid access token (refreshing from Keychain if needed).
    try:
        import clarity_login
        access_token = clarity_login.get_access_token()
    except Exception as e:
        print(f"ERROR: cannot acquire token ({e}). Run clarity_login.py first.", file=sys.stderr)
        return 3

    try:
        user_id = get_user_id(access_token)
    except Exception as e:
        print(f"ERROR: auth failed: {e}", file=sys.stderr)
        return 3

    if args.clear_pending:
        clear_pending(user_id)
        print("pending cleared")
        return 0

    # Only run if there's a pending request OR --once (launchd idle pass)
    if not args.once and not get_pending(user_id):
        # No pending flag; skip to save battery. launchd still wakes every 30s,
        # but we do nothing unless Clarity asked.
        return 0

    print(f"[clarity-bridge] syncing user {user_id[:8]}…")
    pull_reminders_to_supabase(user_id, access_token)
    push_clarity_edits_to_reminders(user_id, access_token)
    mark_synced(user_id)
    print("[clarity-bridge] sync complete")
    return 0


if __name__ == "__main__":
    sys.exit(main())
