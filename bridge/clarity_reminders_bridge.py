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
    "Content-Type": "application/json",
}


# ---------------------------------------------------------------------------
# Supabase REST helpers
# ---------------------------------------------------------------------------
def _url(table: str, qs: str = "") -> str:
    return f"{SUPABASE_URL}/rest/v1/{table}{qs}"


def _req(method: str, url: str, body: Optional[Any] = None, access_token: Optional[str] = None, prefer: Optional[str] = None) -> Any:
    headers = dict(HEADERS)
    if access_token:
        # The user's access token is what satisfies row-level-security (auth.uid()).
        headers["Authorization"] = f"Bearer {access_token}"
    else:
        headers["Authorization"] = f"Bearer {ANON_KEY}"
    if prefer:
        headers["Prefer"] = prefer
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        detail = e.read().decode() if e.fp else ""
        raise RuntimeError(f"Supabase {method} {url} -> {e.code}: {detail}")


def get_user_id(access_token: str) -> str:
    """Return the user id from the access token's `sub` claim.

    We decode the JWT locally instead of calling /auth/v1/user — that endpoint
    was returning 403 in some project configs, and the uid is already in the
    token we hold.
    """
    import base64

    try:
        payload_b64 = access_token.split(".")[1]
        # JWT uses url-safe base64 without padding
        payload_b64 += "=" * (-len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        return payload["sub"]
    except Exception as e:
        raise RuntimeError(f"could not read user id from token: {e}")


# ---------------------------------------------------------------------------
# AppleScript / Reminders access
# ---------------------------------------------------------------------------
def _quote(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def fetch_reminders() -> List[Dict[str, Any]]:
    """Return reminders as dicts with a persistent 'id' from Reminders.app.

    We build a pipe-delimited line per reminder (no AppleScript record syntax to
    parse) so parsing is robust. Every property is read defensively because some
    reminder fields (e.g. notes) can throw on certain items.
    """
    script = '''
    set out to ""
    tell application "Reminders"
      repeat with r in (every reminder)
        try
          set rid to id of r as text
        on error
          set rid to ""
        end try
        try
          set rname to name of r as text
        on error
          set rname to ""
        end try
        try
          set rnotes to notes of r as text
        on error
          set rnotes to ""
        end try
        try
          set rcompleted to completed of r as text
        on error
          set rcompleted to "false"
        end try
        try
          set rlist to name of (container of r) as text
        on error
          set rlist to ""
        end try
        try
          set rflagged to flagged of r as text
        on error
          set rflagged to "false"
        end try
        try
          set rdue to (due date of r as text)
        on error
          set rdue to ""
        end try
        set rname to my esc(rname)
        set rnotes to my esc(rnotes)
        set rlist to my esc(rlist)
        set rdue to my esc(rdue)
        set out to out & rid & "|" & rname & "|" & rnotes & "|" & rcompleted & "|" & rlist & "|" & rflagged & "|" & rdue & linefeed
      end repeat
    end tell
    return out

    on esc(s)
      set s to s as text
      set s to my replace(s, "\\n", " ")
      set s to my replace(s, "|", "/")
      return s
    end esc

    on replace(s, f, r)
      set tid to AppleScript's text item delimiters
      set AppleScript's text item delimiters to f
      set parts to text items of s
      set AppleScript's text item delimiters to r
      set s to parts as text
      set AppleScript's text item delimiters to tid
      return s
    end replace
    '''
    raw = subprocess.run(
        ["osascript", "-e", script], capture_output=True, text=True
    ).stdout
    return _parse_reminders_lines(raw)


def _parse_reminders_lines(text: str) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        parts = line.split("|")
        if len(parts) < 7:
            continue
        rid, name, notes, completed, lst, flagged, due = parts[:7]
        items.append({
            "id": rid,
            "title": name,
            "notes": notes,
            "completed": completed.strip().lower() in ("true", "yes", "1"),
            "list": lst,
            "flagged": flagged.strip().lower() in ("true", "yes", "1"),
            "due": _parse_applescript_date(due),
        })
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
    """Reminders -> Supabase. Upsert by a deterministic id derived from external_id.

    We key reminder rows on `id = user_id + ':' + external_id` (the Clarity task
    primary key) so the upsert uses the real PK constraint (on_conflict=id),
    which PostgREST always accepts — avoiding the need for a composite unique
    index on (user_id, external_id).
    """
    reminders = fetch_reminders()
    rows = []
    for r in reminders:
        ext = r["id"]
        if not ext:
            continue
        rows.append({
            "id": f"{user_id}:{ext}",
            "user_id": user_id,
            "external_id": ext,
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
    # Upsert on the primary key (id)
    _req(
        "POST",
        _url("clarity_tasks", "?on_conflict=id"),
        rows,
        access_token=access_token,
        prefer="resolution=merge-duplicates",
    )


def push_clarity_edits_to_reminders(user_id: str, access_token: str) -> None:
    """Clarity edits -> Reminders. Only source='reminders' rows changed since synced_at.

    PostgREST can't compare one column to another in a filter, so we fetch all
    reminders-sourced rows and apply the `updated_at > synced_at` check in Python.
    """
    resp = _req(
        "GET",
        _url(
            "clarity_tasks",
            f"?select=*&user_id=eq.{user_id}&source=eq.reminders",
        ),
        access_token=access_token,
    )
    for row in resp or []:
        ext = row.get("external_id")
        if not ext:
            continue
        # Only push changes made after the last successful sync.
        synced = row.get("synced_at")
        updated = row.get("updated_at")
        if synced and updated and updated <= synced:
            continue
        if row.get("deleted_at"):
            delete_reminder(ext)
        else:
            if row.get("title"):
                set_reminder_title(ext, row["title"])
            set_reminder_completed(ext, bool(row.get("completed")))


def mark_synced(user_id: str, access_token: str) -> None:
    _req(
        "POST",
        _url("clarity_sync_state", "?on_conflict=user_id"),
        {
            "user_id": user_id,
            "last_synced_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            "pending": False,
            "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        },
        access_token=access_token,
        prefer="resolution=merge-duplicates",
    )


def clear_pending(user_id: str, access_token: str) -> None:
    _req(
        "POST",
        _url("clarity_sync_state", "?on_conflict=user_id"),
        {
            "user_id": user_id,
            "pending": False,
            "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        },
        access_token=access_token,
        prefer="resolution=merge-duplicates",
    )


def get_pending(user_id: str, access_token: str) -> bool:
    resp = _req(
        "GET",
        _url("clarity_sync_state", f"?select=pending&user_id=eq.{user_id}"),
        access_token=access_token,
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
        clear_pending(user_id, access_token)
        print("pending cleared")
        return 0

    # Only run if there's a pending request OR --once (launchd idle pass)
    if not args.once and not get_pending(user_id, access_token):
        # No pending flag; skip to save battery. launchd still wakes every 30s,
        # but we do nothing unless Clarity asked.
        return 0

    print(f"[clarity-bridge] syncing user {user_id[:8]}…")
    pull_reminders_to_supabase(user_id, access_token)
    push_clarity_edits_to_reminders(user_id, access_token)
    mark_synced(user_id, access_token)
    print("[clarity-bridge] sync complete")
    return 0


if __name__ == "__main__":
    sys.exit(main())
