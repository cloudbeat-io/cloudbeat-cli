# CloudBeat CLI reference for the wizard

## Invoking the CLI
Use the first one that works:
1. `cloudbeat-cli` - globally installed
2. `npx -y @cloudbeat/cli` - no installation needed (requires Node.js 18+)

Below, `cb` stands for whichever works. Always add `--json` (a global option, it goes right after `cb`).

## Output contract
Exactly one JSON document on stdout:
- success: `{ "ok": true, ... }`, exit code 0
- failure: `{ "ok": false, "code": "<code>", "error": "<message>" }`, exit code 1

Codes: `not_logged_in`, `invalid_api_key`, `no_api_key`, `invalid_args`, `error`.

With `--wait`, a synchronization that finishes with a failure is still `"ok": true` (the command itself worked) - always check `sync.syncStatus` (`success` | `failure` | `in progress`), `sync.message` and `sync.details` (the actual reason, e.g. "Authentication failed..." behind the generic message "Git operation failed.").

## Commands

| Command | Purpose |
|---------|---------|
| `cb --json whoami` | are we logged in, and where. `apiBaseUrl`, masked `apiKey`, `verified` |
| `cb login [--apiBaseUrl <url>]` | **interactive, run by the user** (`! cloudbeat-cli login`). Hidden prompt for the API key, stored in `~/.cloudbeat/config.json` |
| `cb --json git-info [dir]` | `isGitRepo`, `rootDir`, `remoteName`, `remoteUrlHadCredentials`, `httpsUrl`, `remoteUrl`, `branch`, `subDir`, `isSshRemote`, `hasUpstream`, `unpushedCommits` (only when there is an upstream), `uncommittedChanges`, `uncommittedFiles[]` (the wizard's `.claude/` and `.cloudbeat/` folders are not counted), `warnings[]` |
| `cb --json pack [dir] --list` | files that would be uploaded - use it to preview an upload |
| `cb --json project list` | `projects[]` with `id`, `name`, `type` |
| `cb --json project create --name <n> --type <t> --sync <git\|manual\|none> [...]` | creates a project, returns `projectId` |
| `cb --json project sync <nameOrId> [--dir <dir>] [--wait]` | without `--dir`: trigger Git synchronization. With `--dir`: pack and upload |
| `cb --json project status <nameOrId>` | current `sync` status |

### `project create` options
- `--type`: see `project-types.md`
- `--sync git`: `--git-url` and `--git-branch` default to the repository of the current directory (SSH remote converted to HTTPS). Pass them explicitly once the user confirmed the values.
- `--git-auth`: provide Git credentials now. **Interactive - must be run by the user** via `! ...`, without `--json` (the CLI asks for username and token with hidden input). In CI the CLI reads `CB_GIT_TOKEN` / `CB_GIT_USERNAME` instead.
- `--sync manual --dir .`: pack the directory and upload it together with project creation.
- `--exec-command <cmd>`: only when the project's test command differs from the type default. `--exec-options`, `--assembly-names` (required for .NET binary types), `--notes`.
- `--wait`: wait until the initial synchronization finishes (up to 10 minutes).

## Packing rules
`--all` (on `pack`, `project create`, `project sync`) also includes git-ignored files - needed when uploading build output such as `bin/Release/net8.0`. Without it a git-ignored folder packs to zero files.

`.gitignore` is honored (when the directory is a Git repository) and `.cbignore` adds exclusions using the same simple syntax (`dir/`, `*.ext`, `path/to/file`). `.git`, `node_modules`, `.env*`, `*.pem`, `*.key`, `.claude`, `.cloudbeat` and IDE folders are never uploaded.
