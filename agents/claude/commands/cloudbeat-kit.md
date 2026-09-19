---
description: Install the CloudBeat Kit into this test project, or change its options (WebDriver wrapping, browser logs, network capture...). Does not touch the CloudBeat project.
---

# /cloudbeat-kit - install or reconfigure the CloudBeat Kit

Runs only the kit part of the setup wizard (phases 1-4 of `.claude/skills/cloudbeat-setup/SKILL.md`). No login and no CloudBeat project are needed.

1. Read `.claude/skills/cloudbeat-setup/SKILL.md` - its ground rules apply, in particular the approval gate before any file change.
2. Read `.cloudbeat/setup.md` if it exists. Verify what it says against the code (the user may have changed things since): is the kit dependency present, which options are actually in place.
3. Phase 1: detect and confirm the stack (`questions/02-stack.md`). Skip the confirmation if the flavor is recorded and still matches.
4. Phase 2: go through the options of the flavor's recipe (`questions/03-kit-options.md`), using the current values as defaults. For a first installation offer "Use recommended settings".
5. Phase 3: present the plan. For a reconfiguration it contains **only the differences** - including the removal of code that belongs to options being turned off.
6. Phase 4: apply and verify as the recipe says.
7. Update the "Stack" and "Kit" sections of `.cloudbeat/setup.md`.
8. Remind the user how the change reaches CloudBeat: commit and push for Git-synchronized projects, `/cloudbeat-sync` for uploaded projects.

Request: $ARGUMENTS
