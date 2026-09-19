---
flavor: node-playwright
projectType: Playwright
language: javascript/typescript
packages:
  - "@cloudbeat/playwright"
capabilities:
  wrapDriver: false         # not needed - the kit is a Playwright reporter, steps come from Playwright itself
  browserLogs: opt-in       # page.on('console', cb.onConsole)
  networkCapture: false
  screenshotsOnFailure: true   # forwarded when Playwright is configured to take them
  video: opt-in                # forwarded when Playwright records it
  trace: opt-in                # forwarded when Playwright records it
  consoleCapture: auto         # stdout of the test process
  customSteps: auto            # test.step() is reported as is
---

# Kit recipe: Playwright Test (Node.js)

## How the kit behaves
- `@cloudbeat/playwright` is a standard Playwright reporter. Suites, tests, `test.step()` steps, `expect` calls and failures are reported without touching the tests.
- The reporter is **inactive outside CloudBeat** - local and CI runs keep working and keep their other reporters.
- Screenshots, video and trace are taken by Playwright according to `use: { ... }` in the config; the reporter forwards whatever Playwright produced.

## Detection details
- `@playwright/test` in `package.json`; config file `playwright.config.(ts|js|mjs|cjs)`.
- Package manager from the lock file (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`). **CloudBeat installs dependencies with `npm ci`**, which requires a committed `package-lock.json` - if the project uses yarn/pnpm only, flag it in the plan: a `package-lock.json` has to be generated and committed (`npm install --package-lock-only`).
- Existing `reporter` setting: a string, an array, or conditional (`process.env.CI ? ... : ...`).
- A shared fixtures file (`test.extend(`) - needed for the browser logs option. Note what the spec files import `test` from.
- Current `use.screenshot`, `use.video`, `use.trace` values.

## Options

### O1 `browserLogs` - Capture browser console logs
- **When:** always.
- **Default:** yes when the project already has a shared fixtures file (small change), or when creating one means changing the import in at most 10 spec files; otherwise no.
- **User gets:** the browser's console messages (errors, warnings, logs) next to the failing test in CloudBeat.
- **Cost:** none from kit version 2.2.2 on. Versions up to 2.2.1 write a raw JSON line to stdout for every browser console message **also outside CloudBeat**, which pollutes local and CI output. The fixture below therefore subscribes only when executed by CloudBeat (`process.env.CB_RUN_ID`) - keep that guard regardless of the installed version; mention the stdout issue only if the resolved version is 2.2.1 or older.
- **Change:** an automatic fixture that subscribes every page to `cb.onConsole`. Without an existing fixtures file, a new one is created and the spec files' `test` import has to point to it - list every file this touches in the plan, and let the user decline.

### O2 `screenshots` - Screenshot on failure
- **When:** `use.screenshot` is not set or `'off'`.
- **Default:** yes -> `screenshot: 'only-on-failure'`.
- **User gets:** the failure screenshot on the failed step.

### O3 `video` - Video recording
- **When:** `use.video` is not set or `'off'`.
- **Default:** no. Recommended value when yes: `'retain-on-failure'`.
- **Cost:** slower runs and bigger results.

### O4 `trace` - Playwright trace
- **When:** `use.trace` is not set or `'off'`.
- **Default:** no. Recommended value when yes: `'retain-on-failure'` (or `'on-first-retry'` when retries are enabled).
- **User gets:** the trace file attached to the test, downloadable from the report.

If O2-O4 are already enabled in the config, do not ask - just mention that they will be forwarded to CloudBeat. One exception to flag: `trace` / `video` set to `'on-first-retry'` while `retries` is 0 (or non-zero only under `process.env.CI`) produces nothing unless retries happen - point it out and offer `'retain-on-failure'`; do not assume that CloudBeat sets `CI`.

## Installation

### 1. Dependency
Use the project's package manager, as a dev dependency:
```
npm install -D @cloudbeat/playwright
```
Show the resolved version in the plan (`npm view @cloudbeat/playwright version`). Make sure `package-lock.json` is updated and not git-ignored.

### 2. Add the reporter
Keep all existing reporters. Examples:
```ts
// was: reporter: 'html'
reporter: [['html'], ['@cloudbeat/playwright']],

// was: reporter: [['list'], ['junit', { outputFile: 'results.xml' }]]
reporter: [['list'], ['junit', { outputFile: 'results.xml' }], ['@cloudbeat/playwright']],

// was: no reporter setting (Playwright default is 'list', or 'dot' on CI)
reporter: [[process.env.CI ? 'dot' : 'list'], ['@cloudbeat/playwright']],
```
With a conditional expression, add the CloudBeat reporter to every branch.

### 3. Browser console logs (O1)
Existing fixtures file - add an automatic fixture:
```ts
import { test as base } from '@playwright/test';
import { cb } from '@cloudbeat/playwright';

export const test = base.extend<{ cloudbeatConsole: void }>({
    cloudbeatConsole: [async ({ page }, use) => {
        if (process.env.CB_RUN_ID) {   // only when executed by CloudBeat
            page.on('console', cb.onConsole);
        }
        await use();
    }, { auto: true }],
});
export { expect } from '@playwright/test';
```
Merge into the project's existing `extend` call rather than creating a second `test` object. If tests open additional pages (`context.newPage()`), subscribe at context level instead: `context.on('page', p => p.on('console', cb.onConsole))` (with the same `CB_RUN_ID` guard).

No fixtures file - create one (e.g. `tests/fixtures.ts`, following the project's layout) with the content above, and change `import { test, expect } from '@playwright/test'` in the spec files to import from it.

### 4. Screenshots / video / trace (O2-O4)
Set the chosen values in the top-level `use: { ... }` block. If projects override them in `projects[].use`, point it out.

## Other kit helpers - mention in the wrap-up, do not add by default
```ts
import { cb } from '@cloudbeat/playwright';
cb.addTestAttribute('name', value);   // show a value on the test in the report
cb.addOutputData('name', data);       // pass data out of the test
cb.setFailureReason(reason);          // classify a failure (FailureReasonEnum from @cloudbeat/types)
```

## Verification
- `npx playwright test --list` must succeed and list the same tests as before (it loads the config and all spec files without running them).
- TypeScript projects with a type-check script: run it. Without such a script (or without a `tsconfig.json`) do not run `tsc` ad hoc - Playwright compiles the tests itself, and an ad hoc run fails for reasons unrelated to the kit.
- `npm audit` findings printed during the installation: mention them only if they come from `@cloudbeat/*` packages (`npm audit --json`); pre-existing findings are out of scope.

## Project settings for CloudBeat
- `--type Playwright`. The default command is `npx playwright test`; pass `--exec-command` only when the project needs something else (a specific config file: `npx playwright test -c e2e/playwright.config.ts`).
- Delivery: source code (Git integration recommended). `node_modules`, reports and `test-results` must not be uploaded - they are excluded when git-ignored.

## Not available
- Network (HAR) capture is not collected by this kit. Users who need network details can enable Playwright trace (O4), which contains the network log.
