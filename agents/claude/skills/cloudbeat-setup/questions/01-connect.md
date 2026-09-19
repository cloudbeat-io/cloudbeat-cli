# Step 0 - Connect to CloudBeat

Goal: a working CLI and a verified login. Read `../reference/cli.md` first.

## Procedure
1. Find the CLI: try `cloudbeat-cli --version`, then `npx -y @cloudbeat/cli --version`. A version number on stdout means it works (an "unknown option" message means an outdated CLI - use the `npx` form, which fetches the current one). If neither works, Node.js is missing or outdated: ask the user to install Node.js 18+ and stop.
2. Run `cb --json whoami`.
   - `ok: true` and `verified: true` -> tell the user which CloudBeat instance they are connected to (`apiBaseUrl`) and go on. **Skip all questions below.**
   - `code: not_logged_in` or `invalid_api_key` -> ask Q1, then do the login procedure.

## Q1 - Which CloudBeat instance?
- **Ask when:** not logged in.
- **Options:**
  1. CloudBeat cloud - `https://api.cloudbeat.io` (Recommended)
  2. Self-hosted - the user provides the API URL of their installation (their administrator knows it)
- **Default:** cloud.

## Login procedure
Never ask for the API key in the chat. Tell the user:

> Your API key is in your CloudBeat user profile. Type the following in the prompt - the key is asked with hidden input and stored only on your machine (`~/.cloudbeat/config.json`):
>
> `! cloudbeat-cli login` (add `--apiBaseUrl <url>` for a self-hosted instance; use `! npx -y @cloudbeat/cli login` if the CLI is not installed globally)

Then run `cb --json whoami` again to confirm. If it still fails, show the error: `invalid_api_key` means the key is wrong or belongs to another instance; a network error usually means a wrong API URL or a VPN/proxy requirement.

## Skip rules
- Skip everything when `whoami` succeeds.
- The user does not have a CloudBeat account yet -> point them to https://cloudbeat.io to sign up, and offer to continue with the kit installation only (phases 1-4); phases 5-6 can be resumed later with `/cloudbeat`.
