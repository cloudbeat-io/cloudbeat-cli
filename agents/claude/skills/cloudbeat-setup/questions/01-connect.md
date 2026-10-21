# Step 0 - Connect to CloudBeat

Goal: a working CLI and a verified login. Read `../reference/cli.md` first.

## Procedure
1. Find the CLI. Try these in order and use the first one that prints a version number on stdout:
   1. `npx --no -- cloudbeat-cli --version` - installed in the project (`@cloudbeat/cli` in `devDependencies`). Preferred: it is the version the project pins, and it works without internet access, e.g. on a closed network where only `npm i` from an internal registry is possible.
   2. `cloudbeat-cli --version` - installed globally.
   3. `npx -y @cloudbeat/cli --version` - downloads the current CLI from the npm registry (needs internet access, or a registry mirror that has `@cloudbeat/cli`).

   An "unknown option" message means an outdated CLI - try the next form. Use the form that worked for every `cb` command, and in the login command you give the user. If none works: Node.js is missing or outdated -> ask the user to install Node.js 18+; on a closed network, suggest adding `@cloudbeat/cli` to the project's `devDependencies` and running `npm i`. Stop until one works.
2. Run `cb --json whoami`. Failures include `apiBaseUrl` - the URL the CLI used (or, for `not_logged_in`, the URL a login would use). Use it instead of reading `~/.cloudbeat/config.json`, which contains the API key.
   - `ok: true` and `verified: true` -> tell the user which CloudBeat instance they are connected to (`apiBaseUrl`) and go on. **Skip all questions below.**
   - `code: not_logged_in` or `invalid_api_key` -> ask Q1, then do the login procedure.
   - `code: connection_failed` -> CloudBeat at `apiBaseUrl` could not be reached. Tell the user, with the reason from `error`, and help diagnose (see "Connection problems"). Then ask Q1 - include "keep the current URL" - and continue as the answer says.
   - any other failure -> show the error as is.

## Q1 - Which CloudBeat instance?
- **Ask when:** not logged in, invalid API key, or the CloudBeat instance could not be reached.
- **Options:**
  1. CloudBeat cloud - `https://api.cloudbeat.io` (Recommended)
  2. Self-hosted - the user provides the API URL of their installation, e.g. `https://cloudbeat.company.local` or `http://10.0.0.5:8080` (their administrator knows it)
  3. Only when `apiBaseUrl` from `whoami` is not the cloud URL: keep `<apiBaseUrl>`. After `connection_failed`, say that it just failed: the user may want to fix the network first (VPN, proxy, certificate). When the API key is already stored, no new login is needed - re-run `cb --json whoami` once the network is fixed.
- **Default:** the current `apiBaseUrl` when it is not the cloud URL and the failure was not `connection_failed`, otherwise cloud.

## Login procedure
Never ask for the API key in the chat. Tell the user:

> Your API key is in your CloudBeat user profile. Type the following in the prompt - the key is asked with hidden input and stored, together with the URL, only on your machine (`~/.cloudbeat/config.json`):
>
> `! <cb> login --apiBaseUrl <url>`

Use the CLI form found in step 1 for `<cb>` (e.g. `npx --no -- cloudbeat-cli`; the `--` matters - without it npx takes the CLI's options as its own) and the URL chosen in Q1 for `<url>`. Always pass `--apiBaseUrl`, also for the cloud: without it, `login` uses the previously stored URL. If `CB_API_URL` is set in the environment it overrides the stored URL for all later commands - mention it when it points elsewhere.

Then run `cb --json whoami` again to confirm. If it still fails, show the error: `invalid_api_key` means the key is wrong or belongs to another instance; `connection_failed` - see below.

## Connection problems (`connection_failed`)
Explain by the reason in `error`:
- `ENOTFOUND` / `EAI_AGAIN` - the host name is wrong or cannot be resolved (internal DNS, VPN).
- `ECONNREFUSED` - wrong port, or the server is down.
- `ETIMEDOUT` / timeout - a firewall, VPN or proxy is in the way. A required proxy goes in `HTTPS_PROXY` / `HTTP_PROXY` (and `NO_PROXY` for internal hosts).
- certificate errors (`self-signed certificate`, `unable to verify the first certificate`) - the server uses a certificate from the company's own authority: `export NODE_EXTRA_CA_CERTS=/path/to/company-ca.pem` before running the CLI. Never suggest disabling TLS verification.

## Skip rules
- Skip everything when `whoami` succeeds.
- The user does not have a CloudBeat account yet -> point them to https://cloudbeat.io to sign up, and offer to continue with the kit installation only (phases 1-4); phases 5-6 can be resumed later with `/cloudbeat`.
