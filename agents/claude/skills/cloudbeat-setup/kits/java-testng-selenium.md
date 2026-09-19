---
flavor: java-testng-selenium
projectType: TestNG
language: java
packages:
  - io.cloudbeat:cb-kit-testng
  - io.cloudbeat:cb-kit-selenium4   # only with Selenium 4 / Appium
capabilities:
  wrapDriver: true          # Selenium 4 WebDriver and Appium drivers
  browserLogs: auto         # collected automatically once the driver is wrapped (Chromium via DevTools; Android logcat for Appium)
  networkCapture: opt-in    # HAR from Chrome performance logs - Chromium browsers only
  screenshotsOnFailure: auto
  pageSourceOnFailure: opt-in
  restAssured: opt-in
  consoleCapture: true      # stdout/stderr, on by default
  customSteps: opt-in       # @CbStep, needs the AspectJ weaver
---

# Kit recipe: Java + TestNG (+ Selenium 4 / Appium)

## How the kit behaves
- `CbTestNGListener` reports suites, tests, hooks and failures to CloudBeat.
- The kit is **inactive outside CloudBeat**: it activates only when CloudBeat runs the tests (or when a `cloudbeat.properties` file is on the classpath). Local and CI runs are not affected - tell the user this when presenting the plan.
- All helper methods are static on `io.cloudbeat.testng.CbTestNGListener` and are safe no-ops when the kit is inactive.

## Detection details
- Build tool: `pom.xml` (Maven) or `build.gradle(.kts)` (Gradle).
- Selenium major version from `org.seleniumhq.selenium:selenium-java`. `cb-kit-selenium4` requires Selenium 4 - with Selenium 3, skip every WebDriver option and say why.
- Appium: `io.appium:java-client`.
- RestAssured: `io.rest-assured:rest-assured`.
- Listener registration style already in use: `testng.xml` `<listeners>`, `@Listeners` on a base class, or surefire `<property><name>listener</name>`.
- Driver creation site: `new ChromeDriver(`, `new RemoteWebDriver(`, `new AndroidDriver(`/`new IOSDriver(`, a driver factory, or a DI provider. Also note where `ChromeOptions` are built - needed for network capture.

## Options

### O1 `wrapDriver` - Wrap the WebDriver
- **When:** Selenium 4 or Appium detected.
- **Default:** yes.
- **User gets:** every browser/device action (navigate, click, type...) as a step in the CloudBeat report, a screenshot on failure, and browser console logs (Chromium) or Android logcat attached automatically.
- **Change:** one line where the driver is created: `driver = CbTestNGListener.wrapWebDriver(driver);`

### O2 `fullPageScreenshot`, `pageSourceOnError`, `findElementSteps` - Wrapper fine-tuning
- **When:** O1 = yes. Ask as one multi-select question; skipped by "recommended settings".
- **Defaults:** full-page screenshots **on**; save page source on failure **off**; report `findElement` calls as steps **off**.
- **Change:** a `WrapperOptions` object passed to `wrapWebDriver` - only when something differs from the defaults.

### O3 `networkCapture` - Capture network traffic (HAR)
- **When:** O1 = yes AND the tests run on a Chromium browser (Chrome/Edge). Not available for Firefox, Safari or mobile native apps.
- **Default:** no.
- **User gets:** a HAR with the requests made by the page, viewable in the CloudBeat report - useful for diagnosing failures caused by the backend.
- **Cost:** enables Chrome performance logging, which adds some overhead and produces larger results.
- **Change:** a logging preference added to `ChromeOptions`.

### O4 `cloudbeatBrowser` - Use the browser provided by CloudBeat
- **When:** Selenium/Appium detected.
- **Default:** yes.
- **User gets:** when executed by CloudBeat, tests run on the browser/device selected in CloudBeat (remote WebDriver URL + capabilities). Locally nothing changes.
- **Change:** the driver creation site uses `CbTestNGListener.getWebDriverUrl()` and `getCapabilities()` when running in CloudBeat, and the existing local driver otherwise.

### O5 `restAssured` - Report RestAssured calls
- **When:** RestAssured detected.
- **Default:** yes.
- **User gets:** each HTTP call as a step with request and response details.
- **Change:** `CbTestNGListener.wrapRestAssured();` once, in a `@BeforeSuite`.

### O6 `consoleCapture` - Capture console output
- **When:** always. Do not ask separately - mention that stdout/stderr is attached to the report by default, and offer to turn it off only if the user objects (e.g. secrets printed to the console).
- **Change when off:** system property `CB_WRAP_CONSOLE=false` in the surefire configuration.

### O7 `customSteps` - `@CbStep` annotations
- **When:** the project has a dedicated page-object / steps layer: a package or folder named like `pages`, `pageobjects`, `steps`, `flows` with at least 3 classes. A single helper class is not enough - then just mention `CbTestNGListener.step(...)` in the wrap-up.
- **Default:** no - it is the most invasive option. Explain the cost before asking.
- **User gets:** any method annotated with `@CbStep("Login as {0}")` becomes a named step.
- **Cost:** needs the AspectJ weaver as a Java agent in the surefire `argLine`. If the project already uses Allure with AspectJ, the agent is already there and only the annotations are needed.
- Steps without AspectJ are always possible: `CbTestNGListener.step("name", () -> { ... })` or `startStep` / `endLastStep`.

## Installation

### 1. Dependencies
Resolve the latest `io.cloudbeat` kit version from Maven Central (both artifacts share one version) and show it in the plan.

**Check availability first - right after the flavor is confirmed, before any option question** (SKILL.md, end of phase 1). Not every kit artifact is necessarily published to Maven Central. For each artifact you are about to add, fetch `https://repo1.maven.org/maven2/io/cloudbeat/<artifactId>/maven-metadata.xml`:
- HTTP 200 -> use its `<release>` version (artifacts from one kit release share the version; if they differ, use the highest version available for **all** of them).
- HTTP 404 -> the artifact is not publicly available. The only acceptable alternative is a repository declared in the project's own POM/Gradle build (`<repositories>`) that serves the artifact - CloudBeat builds the project on its side, so the dependency must be resolvable there too. A copy in the local `~/.m2` cache, or a mirror in `~/.m2/settings.xml`, is **not** enough. If there is no such repository, **the kit cannot be installed now**: do not ask the option questions. Tell the user which artifact is missing and that CloudBeat support can tell them how to obtain it, then ask: **continue without the kit** (Recommended - create the project and deliver the code now; run `/cloudbeat-kit` once the artifact is available; reports will contain test results without action steps, screenshots or browser logs) / **stop here**. Record `kit: not available` with the reason in the state file. Never add a dependency that cannot be resolved, and never invent alternative coordinates.

Maven:
```xml
<dependency>
    <groupId>io.cloudbeat</groupId>
    <artifactId>cb-kit-testng</artifactId>
    <version>${cloudbeat.kit.version}</version>
</dependency>
<!-- only when O1/O3/O4 apply -->
<dependency>
    <groupId>io.cloudbeat</groupId>
    <artifactId>cb-kit-selenium4</artifactId>
    <version>${cloudbeat.kit.version}</version>
</dependency>
```
Add `cloudbeat.kit.version` to `<properties>`. Keep the scope consistent with the project's TestNG/Selenium dependencies (usually `test`; no scope if test code lives in `src/main`).

Gradle: `testImplementation "io.cloudbeat:cb-kit-testng:<version>"` (and `cb-kit-selenium4`).

`cb-kit-selenium4` is built against a recent Selenium 4. If the project pins a much older Selenium 4.x, flag the possible DevTools version mismatch in the plan; dependency resolution decides which Selenium version wins - check with `mvn dependency:tree -Dincludes=org.seleniumhq.selenium`.

### 2. Register the listener
Follow the style the project already uses; with none, prefer `testng.xml`:
```xml
<listeners>
    <listener class-name="io.cloudbeat.testng.CbTestNGListener"/>
</listeners>
```
or on the common base test class: `@Listeners(CbTestNGListener.class)`. With several suite files, add it to each one CloudBeat will run.

### 3. Wrap the driver (O1, O2)
At the driver creation site, right after the driver is created and before it is stored or returned:
```java
import io.cloudbeat.testng.CbTestNGListener;

driver = CbTestNGListener.wrapWebDriver(driver);
```
With non-default options - use the setters (not the multi-argument constructor):
```java
import io.cloudbeat.common.wrapper.webdriver.WrapperOptions;

WrapperOptions cbOptions = new WrapperOptions();
cbOptions.setFullPageScreenshot(true);
cbOptions.setSavePageSourceOnError(true);
cbOptions.setIgnoreFindElement(false);   // report findElement calls as steps
driver = CbTestNGListener.wrapWebDriver(driver, cbOptions);
```
The variable must be typed as the interface (`WebDriver`, `AppiumDriver`), because the wrapped instance is returned. If the project already decorates the driver with `EventFiringDecorator`, use `CbTestNGListener.getWebDriverListener(driver)` and add that listener to the existing decorator instead.

### 4. Network capture (O3)
Where `ChromeOptions` (or `EdgeOptions`) are built:
```java
import java.util.logging.Level;
import org.openqa.selenium.logging.LogType;
import org.openqa.selenium.logging.LoggingPreferences;

LoggingPreferences cbLogPrefs = new LoggingPreferences();
cbLogPrefs.enable(LogType.PERFORMANCE, Level.ALL);
options.setCapability("goog:loggingPrefs", cbLogPrefs);
```

### 5. CloudBeat-provided browser (O4)
Adapt to the project's driver factory; the shape is:
```java
Map<String, Object> cbCaps = CbTestNGListener.getCapabilities();
if (cbCaps != null) {   // executed by CloudBeat
    MutableCapabilities caps = new MutableCapabilities(cbCaps);
    driver = new RemoteWebDriver(new URL(CbTestNGListener.getWebDriverUrl()), caps);
} else {
    driver = /* existing local driver creation, unchanged */;
}
```
Merge the project's own options (arguments, O3 logging preferences) into `caps`. Environment values defined in CloudBeat are read with `CbTestNGListener.getEnv("NAME")`.

### 6. RestAssured (O5)
```java
@BeforeSuite(alwaysRun = true)
public void cloudbeatSetup() {
    CbTestNGListener.wrapRestAssured();
}
```
Put it into the existing base class / suite setup when there is one.

### 7. `@CbStep` (O7)
Add `org.aspectj:aspectjweaver` (test scope) and the agent to surefire, preserving any existing `argLine`:
```xml
<argLine>-javaagent:"${settings.localRepository}/org/aspectj/aspectjweaver/${aspectj.version}/aspectjweaver-${aspectj.version}.jar"</argLine>
```
Then annotate a first few page-object methods as an example (`io.cloudbeat.common.annotation.CbStep`) and let the user continue.

## Verification
- `mvn -q -DskipTests test-compile` (Gradle: `./gradlew testClasses`) must pass. A dependency resolution error for an `io.cloudbeat` artifact means the availability check was skipped - revert the dependency and follow the "not publicly available" path above.
- Do not run the whole suite. If the user wants proof, run a single fast test - it must behave exactly as before, since the kit is inactive locally.

## Project settings for CloudBeat
- `--type TestNG`
- Default execution is Maven based. Pass `--exec-options` when a specific suite file or profile is needed (e.g. `-DsuiteXmlFile=testng-smoke.xml -Psmoke`). CloudBeat selects individual tests by itself, which requires `maven-surefire-plugin` 2.22.0 or newer - check the version and include an upgrade in the plan if it is older.
- Delivery: source code (Git integration recommended).

## Not available
- Network capture on non-Chromium browsers.
- WebDriver wrapping with Selenium 3.
