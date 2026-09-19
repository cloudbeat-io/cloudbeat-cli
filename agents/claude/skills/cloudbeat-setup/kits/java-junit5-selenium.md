---
flavor: java-junit5-selenium
projectType: JUnit          # KotlinJUnit5 for Kotlin projects
language: java / kotlin
packages:
  - io.cloudbeat:cb-kit-junit5
  - io.cloudbeat:cb-kit-selenium4   # only with Selenium 4 / Appium
capabilities:
  wrapDriver: true
  browserLogs: auto         # once the driver is wrapped (Chromium via DevTools; Android logcat for Appium)
  networkCapture: opt-in    # Chromium only
  screenshotsOnFailure: auto
  pageSourceOnFailure: opt-in
  screenRecording: manual   # CbJunitExtension.attachScreenRecording(...)
  restAssured: false        # not exposed by the JUnit 5 kit
  consoleCapture: true
  customSteps: opt-in
---

# Kit recipe: Java/Kotlin + JUnit 5 (+ Selenium 4 / Appium)

This kit shares the WebDriver wrapper with the TestNG kit. **Read `java-testng-selenium.md` first** - its "How the kit behaves", detection details, and options O1-O4, O6 and O7 apply here unchanged, with `io.cloudbeat.junit.CbJunitExtension` in place of `CbTestNGListener` (same static method names: `wrapWebDriver`, `getWebDriverListener`, `getCapabilities`, `getWebDriverUrl`, `getEnv`, `step`, `startStep`, `endLastStep`). This file lists only the differences.

## Differences in options
- **O5 `restAssured` is not available** - `wrapRestAssured()` exists only in the TestNG kit. If RestAssured is detected, say so; do not offer it.
- Extra helpers, mention in the wrap-up (no code added by default): `CbJunitExtension.attachScreenshot(bytes)`, `attachPageSource(html)`, `attachScreenRecording(path)`, `addTestAttribute(name, value)`, `addOutputData(name, value)`, `logInfo/logWarning/logError(...)`.

## Installation

### 1. Dependencies
**Check availability first - right after the flavor is confirmed, before any option question** (SKILL.md, end of phase 1). Not every kit artifact is necessarily published to Maven Central. For each artifact you are about to add, fetch `https://repo1.maven.org/maven2/io/cloudbeat/<artifactId>/maven-metadata.xml`:
- HTTP 200 -> use its `<release>` version (artifacts from one kit release share the version; if they differ, use the highest version available for **all** of them).
- HTTP 404 -> the artifact is not publicly available. The only acceptable alternative is a repository declared in the project's own POM/Gradle build (`<repositories>`) that serves the artifact - CloudBeat builds the project on its side, so the dependency must be resolvable there too. A copy in the local `~/.m2` cache, or a mirror in `~/.m2/settings.xml`, is **not** enough. If there is no such repository, **the kit cannot be installed now**: do not ask the option questions. Tell the user which artifact is missing and that CloudBeat support can tell them how to obtain it, then ask: **continue without the kit** (Recommended - create the project and deliver the code now; run `/cloudbeat-kit` once the artifact is available; reports will contain test results without action steps, screenshots or browser logs) / **stop here**. Record `kit: not available` with the reason in the state file. Never add a dependency that cannot be resolved, and never invent alternative coordinates.

```xml
<dependency>
    <groupId>io.cloudbeat</groupId>
    <artifactId>cb-kit-junit5</artifactId>
    <version>${cloudbeat.kit.version}</version>
    <scope>test</scope>
</dependency>
```
plus `cb-kit-selenium4` when a WebDriver option is chosen. Gradle: `testImplementation "io.cloudbeat:cb-kit-junit5:<version>"`. Resolve the latest version from Maven Central; both artifacts share one version.

### 2. Register the extension
Two parts, both required:
- The kit's `TestExecutionListener` is discovered automatically through `META-INF/services` - nothing to do.
- The Jupiter extension must be declared. On the common base test class (it is inherited), else on each test class:
  ```java
  import io.cloudbeat.junit.CbJunitExtension;
  import org.junit.jupiter.api.extension.ExtendWith;

  @ExtendWith(CbJunitExtension.class)
  public abstract class BaseTest { ... }
  ```
  If the class already has `@ExtendWith({A.class, B.class})`, append to the list.

### 3. WebDriver, network capture, CloudBeat browser, `@CbStep`
As in `java-testng-selenium.md` sections 3, 4, 5 and 7, using `CbJunitExtension`. For per-test capabilities there is also `CbJunitExtension.getCapabilities(userCaps, testInfo)`, which adds the test name to the session.

## Verification
- `mvn -q -DskipTests test-compile` (Gradle: `./gradlew testClasses`).

## Project settings for CloudBeat
- `--type JUnit` (`KotlinJUnit5` for Kotlin). `maven-surefire-plugin` 2.22.0+ is required (it is also the minimum for JUnit 5 itself).
- Delivery: source code (Git integration recommended).

## Not available
- RestAssured reporting; network capture on non-Chromium browsers; WebDriver wrapping with Selenium 3.
