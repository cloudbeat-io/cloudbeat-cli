---
description: Synchronize this test project with CloudBeat - trigger Git synchronization, or pack and upload the current code - and report the result.
---

# /cloudbeat-sync - deliver the latest code to CloudBeat

Read `.claude/skills/cloudbeat-setup/reference/cli.md` for the CLI contract (`cb` below is the CLI, always with `--json`). The ground rules of `.claude/skills/cloudbeat-setup/SKILL.md` apply: no secrets in the chat.

1. Read `.cloudbeat/setup.md`. No project id recorded -> tell the user to run `/cloudbeat` first (or ask for the project name/id if they created the project elsewhere, and look it up with `cb --json project list`).
2. `cb --json whoami` - if not logged in, ask the user to run `! cloudbeat-cli login`.
3. By delivery method:

   **git**
   - `cb --json git-info`: if there are unpushed commits or uncommitted changes, tell the user that CloudBeat will not see them, and ask whether to continue anyway. Never commit or push unless the user asks you to.
   - `cb --json project sync <id> --wait`

   **upload**
   - .NET (binary) projects: build first, as described in the kit recipe (`dotnet build -c Release`), and upload the build output folder with `--all`.
   - `cb --json project sync <id> --dir <dir> --wait` (preview with `cb --json pack <dir> --list` when the user asks what is being uploaded).

4. Check `sync.syncStatus` in the result:
   - `success` -> report it with the time.
   - `failure` -> show `sync.message` and diagnose: authentication -> Git credentials are missing or expired; they are entered in the project settings in CloudBeat (never in this chat). Branch/repository not found -> compare with `git-info`. Anything else -> show the message as is.
5. Update "last sync" in `.cloudbeat/setup.md`.

Request: $ARGUMENTS
