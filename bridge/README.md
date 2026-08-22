# Clarity ↔ Apple Reminders Sync (Mac bridge)

Clarity runs in the browser and can't reach Apple Reminders directly (no browser
API for it). A small **launchd agent on your Mac** bridges the two. It reads your
Reminders via AppleScript and reconciles with the Clarity Supabase tables.

## What it does
- **Reminders → Clarity**: every reminder (in selected lists) becomes a Clarity
  task with `source='reminders'` and a stable `external_id` (the Reminders item
  id). Completed/flagged/notes/due-date are mirrored.
- **Clarity → Reminders**: when you complete, rename, or delete a *synced* task
  in Clarity, the change is pushed back to the matching Reminders item. Local
  tasks (`source='local'`) are never touched.
- **Conflict rule**: last-write-wins (`updated_at` vs `synced_at`).

## Install on your Mac (one time)

1. **Copy this `bridge/` folder** to a stable location, e.g.
   `~/clarity-bridge/`.

2. **Sign in once** (stores a refreshable Supabase session in your Keychain):
   ```bash
   cd ~/clarity-bridge
   python3 clarity_login.py
   # enter your Clarity email + password
   ```

3. **Install the launchd agent** (runs every 30s, no-ops unless you hit Sync):
   ```bash
   cp com.clarity.reminders-bridge.plist ~/Library/LaunchAgents/
   launchctl load ~/Library/LaunchAgents/com.clarity.reminders-bridge.plist
   ```
   (Edit the `ProgramArguments` path in the plist to match where you put the folder.)

4. **Grant Automation permission** when prompted the first time Reminders is
   touched (System Settings → Privacy & Security → Automation → allow Terminal/
   your app to control Reminders).

## Use it
- Open Clarity (https://azmerfaiesal.github.io/clarity/) on any device.
- Click **Sync with Apple Reminders** in the sidebar. This sets a `pending` flag.
- Within ~30s your Mac agent picks it up, runs the two-way sync, and clears the
  flag. The sidebar shows "Last synced …".

## Manual runs (for testing)
```bash
python3 clarity_reminders_bridge.py --once          # one full sync pass
python3 clarity_reminders_bridge.py --clear-pending # just clear the flag
python3 clarity_login.py --status                   # show stored session
```

## Files
- `clarity_reminders_bridge.py` — the sync engine (stdlib only, no pip deps)
- `clarity_login.py` — one-time auth, stores refresh token in Keychain
- `com.clarity.reminders-bridge.plist` — launchd agent

## Notes / limitations
- Requires macOS + a logged-in GUI session (Reminders.app needs it).
- AppleScript date parsing is best-effort; if a due date doesn't sync, check
  `clarity-bridge.err.log` in `/tmp`.
- Two-way matching relies on Reminders' persistent item `id`. If you delete and
  recreate a reminder in Reminders, it gets a new id and appears as a new task.
