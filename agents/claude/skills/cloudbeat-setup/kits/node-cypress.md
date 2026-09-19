---
flavor: node-cypress
projectType: Cypress
language: javascript/typescript
packages: []                # nothing is installed into the project
capabilities:
  wrapDriver: false
  browserLogs: false
  networkCapture: false
  screenshotsOnFailure: auto   # full-page, configured by CloudBeat at run time
  commandLog: auto             # Cypress commands are reported as steps
  video: auto                  # when video recording is enabled in the Cypress config
kitInstall: none
---

# Kit recipe: Cypress

## How it works
**Cypress projects need no kit.** When CloudBeat runs a Cypress project, its runner adds its own support file and reporter to the working copy at run time: specs, tests, Cypress commands (as steps), failures and full-page failure screenshots are reported automatically.

Do **not** install `@cloudbeat/cypress` - it is a beta package without a public entry point, used internally by the runner.

Therefore: skip phases 2-4 (no options, no plan, no file changes). Tell the user why in one or two sentences, then continue with the CloudBeat project (phase 5).

## Checks to do instead - report findings, change nothing without asking
1. **`package-lock.json`** is committed. CloudBeat installs dependencies with npm; a yarn/pnpm-only project needs a lock file generated (`npm install --package-lock-only`).
2. **Base URL**: if the tests rely on `baseUrl`, mention that an environment value named `baseUrl` (or `BASE_URL`) defined in CloudBeat overrides Cypress' `baseUrl` - this is how the same project runs against different environments.
3. **Secrets**: `cypress.env.json` is normally git-ignored, so CloudBeat will not receive it. Values the tests need must be defined as environment values in CloudBeat. Never upload or commit that file on the user's behalf.
4. **A `cbreporter/` folder** in the project root is reserved for the runner - warn if the project already has one.
5. **Video**: recorded and attached only if `video: true` in the Cypress config (off by default since Cypress 13). Offer to enable it; default no (slower runs).

## Verification
- `npx cypress verify`, and check that the spec pattern in the Cypress config matches the spec files that exist.

## Project settings for CloudBeat
- `--type Cypress`.
- Delivery: source code (Git integration recommended). `cypress/videos`, `cypress/screenshots`, `cypress/downloads` and `node_modules` must not be uploaded - excluded automatically when git-ignored; otherwise propose a `.cbignore`.

## Not available
- Browser console logs and network capture.
- Custom kit helpers (test attributes, output data) for Cypress.
