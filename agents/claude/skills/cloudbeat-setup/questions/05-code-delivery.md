# Step 4 - Code delivery

Goal: the test code is in CloudBeat and the first synchronization succeeded.

## Procedure
Run `cb --json git-info` in the project root before asking anything. Most users open the agent inside a cloned repository, so the repository URL and branch can usually be detected.

Then probe the remote **anonymously** - this validates the URL, tells whether the repository is public, and whether the branch exists there:

`GIT_TERMINAL_PROMPT=0 git -c credential.helper= ls-remote --heads <httpsUrl> <branch>`

- succeeds and prints a ref -> public repository, branch exists: recommend "Not needed" in Q3.
- succeeds with no output -> public repository, but the branch is **not on the remote**.
- fails (authentication / not found) -> private repository or wrong URL: recommend "Now" in Q3. Whether the branch exists cannot be verified - rely on `hasUpstream`.

If `remoteUrlHadCredentials` is true, warn the user that their local Git remote URL contains an embedded credential (the CLI stripped it and it was not sent anywhere), and suggest moving it to a credential helper.

## Q1 - How should CloudBeat get the code?
- **Ask when:** always, but choose the default from `git-info`.
- **Options:**
  1. **Git integration** - CloudBeat pulls from the repository, and re-synchronizes on demand. (Recommended when `isGitRepo` and `httpsUrl` are present)
  2. **File upload** - the current folder is packed and uploaded now; re-upload with `/cloudbeat-sync` after changes. (Recommended when there is no Git remote)
- **Forced choice:** .NET binary project types are always delivered by upload of the build output (see the recipe) - explain and skip the question. An existing project keeps its delivery method - skip the question.

## Git integration

### Q2 - Confirm repository and branch
- Show `httpsUrl` and `branch` from `git-info` and ask to confirm or correct. If `isSshRemote`, say that the SSH address was converted to HTTPS because CloudBeat authenticates with a token, and ask the user to verify the URL.
- Default branch choice: the current branch - also when it has no upstream (then with the push warning below). If the current branch looks like a feature branch (not `main`/`master`/`develop`), ask whether CloudBeat should rather follow the main branch.

### Warnings - surface every entry of `warnings[]` that applies, before creating the project
- `subDir` not empty: CloudBeat synchronizes the whole repository, the tests live in a sub-folder. The test command may need to `cd` into it (`--exec-command`), or the user can choose file upload of this folder instead.
- `unpushedCommits` > 0 / `uncommittedChanges` > 0: CloudBeat only sees what is pushed. **The kit changes made by this wizard are uncommitted right now.** Show `uncommittedFiles` so the user can commit and push (do not commit or push on your own unless the user asks for it). The project can be created now and synchronized again after the push.
- `hasUpstream` is false: the branch may not exist on the remote at all, in which case the first synchronization fails with "branch not found" no matter which credentials are given. Ask: **push the branch first and come back** (Recommended - the wizard resumes from this step with `/cloudbeat`) / **continue anyway** (the branch exists on the remote under the same name) / **use another branch**.

### Q3 - Git credentials: now or later?
- **Ask when:** Git integration was chosen.
- **Options:**
  1. **Now** - provide a repository access token through the CLI. (Recommended for private repositories)
  2. **Later, in the CloudBeat UI** - the project is created with the URL and branch only.
  3. **Not needed** - the repository is public.
- A read-only token is enough (GitHub: fine-grained token with "Contents: read"; GitLab: `read_repository`; Bitbucket: app password with repository read; Azure DevOps: PAT with Code read).

**Now:** the token must not pass through the chat, so the *user* runs the creation command. Give them the complete command, with all values filled in:

> `! cloudbeat-cli project create --name "<name>" --type <Type> --sync git --git-url <url> --git-branch <branch> --git-auth --wait`

The CLI asks for the username (empty when using a token only) and the token with hidden input. It prints the project id - read it from the output; if unsure, find the project with `cb --json project list`.

If the command fails: `Project with this name already exists` / validation errors -> fix the value and give the user the corrected command. If the user cannot run it (no interactive terminal, does not have a token at hand), offer "Later" instead - never ask for the token in the chat as a workaround.

**Later / Not needed:** create the project yourself:

`cb --json project create --name "<name>" --type <Type> --sync git --git-url <url> --git-branch <branch> --wait`

For "Later" on a private repository the first synchronization **is expected to fail** with an authentication error - say this upfront, so it does not look like a problem. Then tell the user to open the project's settings in CloudBeat, enter the Git credentials, and run `/cloudbeat-sync`.

## File upload
1. Preview: `cb --json pack . --list`. Show the file count and the top-level entries. Check the list for things that should not be uploaded (build output, reports, videos, large binaries, credentials) and propose a `.cbignore` for them. `.env*`, keys, `node_modules` and `.git` are excluded automatically.
2. Ask for confirmation, then create and upload in one command:
   `cb --json project create --name "<name>" --type <Type> --sync manual --dir . --wait`
   (existing project: `cb --json project sync <id> --dir . --wait`)

## After creation / synchronization
- Check `sync.syncStatus` in the result, not just `ok`.
  - `success` -> report the project id and continue to the wrap-up.
  - `failure` -> show `sync.message` and `sync.details` (the details hold the real reason). Authentication failure -> if the user chose "Later" in Q3 this is the expected outcome: do not ask again, record it and go on to the wrap-up; otherwise the credentials were wrong - the user fixes them in the project settings in CloudBeat and runs `/cloudbeat-sync`. Branch not found -> the branch is not pushed. Other -> show the message as is.
  - In every case the phase counts as completed once the project exists; the sync outcome is recorded in `last sync`.
  - timeout -> the synchronization is still running; `cb --json project status <id>` shows the outcome later.
- Save the project id, delivery method, URL/branch and the credentials choice to `.cloudbeat/setup.md`.
