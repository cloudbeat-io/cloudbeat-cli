---
description: CloudBeat setup wizard - install the CloudBeat Kit for this test project, create a CloudBeat project, and deliver the code (Git integration or upload).
argument-hint: "[restart]"
---

# /cloudbeat - CloudBeat setup wizard

Run the full CloudBeat setup for the test automation project in the current directory.

1. Read `.claude/skills/cloudbeat-setup/SKILL.md` and follow it exactly - its ground rules apply to everything you do here, above all: **no secrets in the chat**, **all CloudBeat operations through the CLI with `--json`**, and **no file changes before the user approves the plan**.
2. Read `.cloudbeat/setup.md` if it exists:
   - any argument other than `restart` is an additional instruction from the user for this run - follow it as long as it does not conflict with the ground rules.
   - argument `restart` -> ignore the saved state and start from phase 0 (do not delete anything the previous run installed; detect it instead).
   - all phases done, kit `installed` or `not needed`, and last sync `success` -> show the recap and offer: change kit options (`/cloudbeat-kit`), synchronize the code (`/cloudbeat-sync`), or set up again (`/cloudbeat restart`).
   - all phases done but with open items (kit `declined` / `not available`, last sync failed, entries under "Left for the user") -> list the open items and offer to resolve them: `/cloudbeat-kit` for the kit, `/cloudbeat-sync` for the synchronization.
   - otherwise -> tell the user where the previous run stopped and continue from the first unfinished phase.
3. Go through the phases in order. For each one, read its question file from `.claude/skills/cloudbeat-setup/questions/` right before you start the phase, and the kit recipe from `.claude/skills/cloudbeat-setup/kits/` once the flavor is known. Do not rely on memory of these files from earlier runs.
4. Update `.cloudbeat/setup.md` after every phase.

Arguments: $ARGUMENTS
