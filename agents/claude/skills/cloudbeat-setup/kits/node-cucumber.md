---
flavor: node-cucumber
projectType: CucumberJs
language: javascript/typescript
packages:
  - "@cloudbeat/cucumber"
capabilities:
  wrapDriver: opt-in        # Playwright page + expect, reported as sub-steps of Gherkin steps
  browserLogs: opt-in       # page.on('console', cb.onConsole)
  networkCapture: false
  screenshotsOnFailure: manual   # whatever the project attaches with this.attach(png, 'image/png')
  video: opt-in             # cb.addAttachment('video', path)
  trace: opt-in             # cb.addAttachment('trace', path)
  customSteps: auto         # Gherkin steps are the steps
---

# Kit recipe: Cucumber.js (+ Playwright)

## How the kit behaves
- `@cloudbeat/cucumber` is a Cucumber formatter: features, scenarios, Gherkin steps, hooks and failures are reported without code changes.
- Everything else (`cb.*` helpers, page wrapping) talks to the formatter through Cucumber's own `world.attach`, so it is harmless when the formatter is not active. The formatter reports only when executed by CloudBeat.
- Requires `@cucumber/cucumber` **12 or newer** (peer dependency). With an older major version, tell the user the kit cannot be installed until Cucumber is upgraded; offer to continue without the kit.

## Detection details
- `@cucumber/cucumber` version; configuration file: `cucumber.(js|cjs|mjs|json|yaml)` or the `cucumber` key in `package.json`; profiles (`default`, others).
- Browser library: `playwright` / `@playwright/test` (wrapping supported) - or `selenium-webdriver`, `webdriverio` (no wrapping available).
- The custom World class and the hooks file: where the browser, context and page are created (`Before`), and closed (`After`).
- Assertion style: `expect` from `@playwright/test`, or chai/assert (only Playwright `expect` can be wrapped).
- `npm ci` is used by CloudBeat -> a committed `package-lock.json` is required (see `node-playwright.md`).

## Options

### O1 `wrapPage` - Report Playwright actions as sub-steps
- **When:** Playwright detected and the page is created in one place (World / hooks).
- **Default:** yes.
- **User gets:** under every Gherkin step, the Playwright actions it performed (goto, click, fill, locator actions, waits...).
- **Change:** one line where the page is created; `this.page` becomes a transparent proxy.

### O2 `wrapExpect` - Report assertions as sub-steps
- **When:** O1 = yes and the project uses Playwright's `expect`.
- **Default:** yes.
- **Change:** the project's step definitions must use the wrapped `expect`. This works cleanly only when `expect` is provided from a single place (World property or a shared module). If every step file imports `expect` from `@playwright/test` directly, list the files that would change and let the user decide - default to **no** in that case.

### O3 `browserLogs` - Capture browser console logs
- **When:** Playwright detected.
- **Default:** yes.
- **Change:** `page.on('console', cb.onConsole)` next to the page creation, and `cb.setWorld(this)` in a `Before` hook.

### O4 `video` / `trace` - Attach Playwright video or trace
- **When:** the project already records video (`recordVideo` in `newContext`) or tracing (`context.tracing.start`), or the user wants it.
- **Default:** attach what is already recorded; do not turn on recording unasked (cost: slower runs, bigger results).
- **Change:** in the `After` hook, after the context is closed / tracing stopped: `cb.addAttachment('video', videoPath)` / `cb.addAttachment('trace', tracePath)`.

## Installation

### 1. Dependency
`npm install -D @cloudbeat/cucumber` (project's package manager; keep `package-lock.json` updated).

### 2. Register the formatter
Add to **every profile CloudBeat will run**, keeping existing formatters:
```js
// cucumber.js
module.exports = {
    default: {
        format: ['progress-bar', 'html:reports/cucumber.html', '@cloudbeat/cucumber'],
    },
};
```
JSON/YAML configuration: same `format` array. If formatters are passed on the command line in an npm script (`--format ...`), add `--format @cloudbeat/cucumber` there instead.

### 3. World binding, page wrapping, console logs (O1-O3)
In the hooks file (TypeScript shown; adapt to the project's World):
```ts
import { Before } from '@cucumber/cucumber';
import { expect as pwExpect } from '@playwright/test';
import { cb, wrapPlaywrightPage, wrapExpect } from '@cloudbeat/cucumber';

Before(async function (this: CustomWorld) {
    cb.setWorld(this);                                       // required by every cb.* helper
    // ... existing browser / context / page creation ...
    this.page.on('console', cb.onConsole);                   // O3 - subscribe before wrapping
    this.page = wrapPlaywrightPage(this.page, this);         // O1
    this.expect = wrapExpect(pwExpect, this);                // O2 - when expect is provided by the World
});
```
`cb.setWorld(this)` must run at the start of every scenario - put it first in the earliest `Before` hook. With parallel workers this is fine: each worker has its own module instance.

### 4. Video / trace (O4)
```ts
After(async function (this: CustomWorld) {
    const video = this.page.video();
    await this.context.close();                               // the video file is complete only after close
    if (video) cb.addAttachment('video', await video.path());
});
```

## Other helpers - mention in the wrap-up
`cb.addTestAttribute(name, value)`, `cb.addOutputData(name, data)`, `cb.setFailureReason(reason)`.

## Verification
- `npx cucumber-js --dry-run` (with the profile CloudBeat will use) must succeed and report the same scenario count as before.
- TypeScript: run the project's type check.

## Project settings for CloudBeat
- `--type CucumberJs`. Pass `--exec-command` only if a non-default profile or a custom script is needed (e.g. `npx cucumber-js -p ci`).
- Delivery: source code (Git integration recommended).

## Not available
- Network (HAR) capture (the Playwright trace from O4 contains the network log).
- Action-level sub-steps for Selenium or WebdriverIO based Cucumber projects - Gherkin steps are still reported.
