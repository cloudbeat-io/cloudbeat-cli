---
flavor: dotnet-mstest
projectType: MSTestBinary
language: csharp
packages:
  - CloudBeat.Kit.MSTest
capabilities:
  wrapDriver: true           # Selenium EventFiringWebDriver
  browserLogs: false
  networkCapture: false
  screenshotsOnFailure: auto # once the driver is wrapped
  pageSourceOnFailure: false # NUnit kits only
  nlog: false                # NUnit kits only
  customSteps: opt-in        # CbMSTest.Step(...) or [CbStep]
delivery: upload-build-output
---

# Kit recipe: .NET + MSTest (+ Selenium)

The MSTest kit mirrors the NUnit kit. **Read `dotnet-nunit.md` first** - "How the kit behaves" (inactive outside CloudBeat, **binary delivery**), target framework requirements (`net8.0` / `net10.0`), and the delivery section apply here. Differences are listed below. Static helpers live on `CloudBeat.Kit.MSTest.CbMSTest`.

## Detection details
- `MSTest.TestFramework` / `MSTest` package reference; the kit is built against MSTest 3.x - with MSTest 2.x include an MSTest upgrade in the plan and point out that it is a prerequisite.
- A common base test class, how `TestContext` is declared, and whether tests use `[TestMethod]` or `[DataTestMethod]`.
- Driver creation site; Selenium / Appium packages.

## Options

### O0 `integration` - How tests are connected to the kit
- **When:** always. This is the one decision specific to MSTest.
- **Options:**
  1. **Inherit from `CbTest`** (Recommended when there is a common base class, or few test classes) - the base class makes every `[TestMethod]` report to CloudBeat. It declares `TestContext`, `[ClassInitialize]`, `[TestInitialize]` and `[TestCleanup]`; existing members with these attributes keep working (MSTest runs base class initializers first), but a `TestContext` property declared in the project's own classes must be removed, so that the one inherited from `CbTest` is used (a second declaration would hide it and the kit would not receive the context).
  2. **Replace `[TestMethod]` with `[CbTestMethod]`** - no base class needed, but every test method is touched. Good for projects whose test classes already inherit from something that cannot change.
- The two can be mixed; `CbTest` skips methods that already have `[CbTestMethod]`.

### O1 `wrapDriver` - Wrap the WebDriver
- **When:** Selenium detected. **Default:** yes.
- As in `dotnet-nunit.md` O1 (requires `EventFiringWebDriver`).

### O2 `fullPageScreenshot`, `findElementSteps`
- **When:** O1 = yes. **Defaults:** full-page screenshots on (ChromeDriver only); `ignoreFindElement: true`.
- Page source on failure is **not** available in the MSTest kit.

### O3 `customSteps`
- Informational, as in `dotnet-nunit.md` O5: `CbMSTest.Step("name", () => { ... })`, `CbMSTest.Transaction(...)`, or `[CbStep("...")]` (namespace `CloudBeat.Kit.MSTest.Attributes`).

## Installation

### 1. Package
`dotnet add <test project>.csproj package CloudBeat.Kit.MSTest`

### 2. Integration (O0)
```csharp
using CloudBeat.Kit.MSTest;

[TestClass]
public class LoginTests : CbTest { ... }      // or the project's base class : CbTest
```
or
```csharp
using CloudBeat.Kit.MSTest.Attributes;

[CbTestMethod]
public void UserCanLogin() { ... }
```
`[DataTestMethod]` tests: use option 1 (`CbTest`), since `[CbTestMethod]` replaces the attribute.

### 3. Wrap the driver (O1, O2)
```csharp
using CloudBeat.Kit.MSTest;
using OpenQA.Selenium.Support.Events;

var eventDriver = new EventFiringWebDriver(new ChromeDriver(options));
CbMSTest.WrapWebDriver(eventDriver);   // optional: takeFullPageScreenshots: true, ignoreFindElement: true
driver = eventDriver;
```
Call it in `[TestInitialize]` (per test). Browser and environment selected in CloudBeat: `CbMSTest.GetCapabilities()`, `CbMSTest.GetEnvironmentValue("name")`, guarded by `CbMSTest.IsRunningFromCB()`. Data-driven tests can take their rows from CloudBeat with `[DynamicData(nameof(CbMSTest.GetTestData), typeof(CbMSTest), DynamicDataSourceType.Method)]` - mention only if the project is data-driven.

## Verification
- `dotnet build -c Release`, then `dotnet test --list-tests --no-build -c Release` lists the same tests as before.

## Project settings and delivery for CloudBeat
- `--type MSTestBinary --assembly-names <TestAssembly>.dll`, upload of the build output folder with `--all` - exactly as described in `dotnet-nunit.md`.

## Not available
- Network capture, browser console logs, page source on failure, NLog forwarding.
