---
flavor: dotnet-nunit
projectType: NUnit3Binary
language: csharp
packages:
  - CloudBeat.Kit.NUnit4     # NUnit 4.x
  - CloudBeat.Kit.NUnit      # NUnit 3.x
capabilities:
  wrapDriver: true           # Selenium EventFiringWebDriver
  browserLogs: manual        # only via CbNUnit.AddLogs(...) written by the user
  networkCapture: false
  screenshotsOnFailure: auto # once the driver is wrapped
  pageSourceOnFailure: opt-in
  nlog: opt-in
  httpClient: opt-in
  customSteps: opt-in        # [CbStep] attribute or CbNUnit.Step(...)
delivery: upload-build-output
---

# Kit recipe: .NET + NUnit (+ Selenium)

## How the kit behaves
- The `[CbNUnitTest]` attribute on a test fixture (or on a common base class - it is inherited) reports tests, set-up/tear-down hooks and failures.
- The kit is **inactive outside CloudBeat**: `CbNUnit.*` helpers return immediately when the tests are not executed by CloudBeat, so local and CI runs are unaffected.
- **.NET projects are delivered as binaries.** CloudBeat runs the compiled test assembly with `dotnet test`. Code delivery is an upload of the build output folder - Git integration does not apply. Explain this early, in step 1, so the delivery step is not a surprise.

## Detection details
- NUnit major version from the `NUnit` package reference in the `*.csproj`: 4.x -> `CloudBeat.Kit.NUnit4`, 3.x -> `CloudBeat.Kit.NUnit`. Both use the namespace `CloudBeat.Kit.NUnit`.
- Target framework: the kits target `net8.0` and `net10.0`. Older targets (`net6.0`, .NET Framework) -> tell the user the kit cannot be installed until the test project targets .NET 8 or newer; offer to continue without the kit.
- Selenium: `Selenium.WebDriver` (+ `Selenium.Support` for `EventFiringWebDriver`). Appium: `Appium.WebDriver`.
- NLog: `NLog` package and an `NLog.config` / `nlog` section. HttpClient usage in tests: `new HttpClient(`.
- `Microsoft.Playwright.NUnit`: see "Playwright for .NET" below.
- A common base fixture class, and the driver creation site.
- Assembly name: `<AssemblyName>` in the csproj, else the project file name + `.dll`.

## Options

### O1 `wrapDriver` - Wrap the WebDriver
- **When:** Selenium detected.
- **Default:** yes.
- **User gets:** browser actions as report steps and a screenshot on failure.
- **Change:** the kit hooks into Selenium's `EventFiringWebDriver`. If the project uses a plain `IWebDriver`, the driver creation site is changed to wrap it in `EventFiringWebDriver` (from `Selenium.Support`) - say so explicitly, the field type stays `IWebDriver`.

### O2 `fullPageScreenshot`, `pageSourceOnError`, `findElementSteps` - Wrapper fine-tuning
- **When:** O1 = yes; skipped by "recommended settings".
- **Defaults:** full-page screenshots **on** (works with ChromeDriver only); page source on failure **off**; report `FindElement` failures **off** (`ignoreFindElement: true`).

### O3 `nlog` - Send NLog output to CloudBeat
- **When:** NLog detected.
- **Default:** yes.
- **Change:** a `CloudBeat` target and rule added to the NLog configuration.

### O4 `httpClient` - Report HttpClient calls
- **When:** tests create `HttpClient` instances.
- **Default:** no - requires changing how each `HttpClient` is constructed.
- **Change:** `new HttpClient(new CbHttpMessageHandler(CbNUnit.Current.Reporter))`.

### O5 `customSteps` - Named steps
- **When:** always; informational unless the user wants examples added.
- **Default:** no code changes. Show the two ways: `CbNUnit.Step("Login", () => { ... })`, or the `[CbStep("Login as {0}")]` attribute on page-object methods.

## Installation

### 1. Package
```
dotnet add <test project>.csproj package CloudBeat.Kit.NUnit4
```
(`CloudBeat.Kit.NUnit` for NUnit 3). Omit the version to get the latest; show the resolved version in the plan. With central package management (`Directory.Packages.props`), add the version there.

### 2. Attribute
On the common base fixture, else on every `[TestFixture]` class:
```csharp
using CloudBeat.Kit.NUnit.Attributes;

[CbNUnitTest]
public abstract class BaseTest { ... }
```

### 3. Wrap the driver (O1, O2)
```csharp
using CloudBeat.Kit.NUnit;
using OpenQA.Selenium.Support.Events;

var eventDriver = new EventFiringWebDriver(new ChromeDriver(options));
CbNUnit.WrapWebDriver(eventDriver);   // optional: takeFullPageScreenshots: true, ignoreFindElement: true, takePageSourceOnError: false
driver = eventDriver;
```
`WrapWebDriver` must be called in the set-up of each test that creates a driver (it binds the driver to the currently running test).

When executed by CloudBeat, the browser selected in CloudBeat is available through `CbNUnit.GetCapabilities()`, and values defined in CloudBeat through `CbNUnit.GetEnvironmentValue("name")` - offer to use them at the driver creation site, guarded by `CbNUnit.IsRunningFromCB()`.

### 4. NLog (O3)
```xml
<extensions><add assembly="CloudBeat.Kit.NUnit4"/></extensions>
<targets><target name="cloudbeat" xsi:type="CloudBeat"/></targets>
<rules><logger name="*" minlevel="Info" writeTo="cloudbeat"/></rules>
```
Use the assembly name of the installed kit package. Merge into the existing configuration; keep existing targets.

### 5. `[CbStep]` (O5, only if requested)
The attribute is woven at compile time by AspectInjector. After annotating a method, build and check that the step shows up - if the weaver did not run, add a direct `AspectInjector` package reference to the test project.

## Verification
- `dotnet build -c Release` must pass.
- `dotnet test --list-tests --no-build -c Release` lists the same tests as before.

## Project settings and delivery for CloudBeat
- `--type NUnit3Binary --assembly-names <TestAssembly>.dll`
- Build, then upload the **build output folder** (the one containing `<TestAssembly>.dll` and `<TestAssembly>.runtimeconfig.json`), e.g. `bin/Release/net8.0`:
  ```
  dotnet build -c Release
  cb --json project create --name "<name>" --type NUnit3Binary --assembly-names <TestAssembly>.dll --sync manual --dir <project>/bin/Release/net8.0 --all --wait
  ```
  `--all` is required because build output is git-ignored. Preview with `cb --json pack <dir> --all --list`.
- After every change the project is rebuilt and re-uploaded: `/cloudbeat-sync` does it. Suggest adding the same two commands to the user's CI pipeline (with `CB_API_KEY` as a CI secret).
- Browser drivers and other native files copied to the output folder are part of the upload - warn if the folder is unusually large (> 200 MB).

## Playwright for .NET
When `Microsoft.Playwright.NUnit` is used, additionally install `CloudBeat.Kit.Playwright` and change the fixtures' base class from `PageTest` to `CbPageTest` (namespace `CloudBeat.Kit.Playwright`) - page, locator, `Expect` and API request calls are then reported as steps. O1/O2 do not apply.

## Not available
- Network (HAR) capture.
- Automatic browser console logs. Logs can only be added by the user's own code through `CbNUnit.AddLogs(...)`.
