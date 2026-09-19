---
flavor: java-junit4
projectType: JUnit
language: java
packages:
  - io.cloudbeat:cb-kit-junit4
capabilities:
  wrapDriver: false
  browserLogs: false
  networkCapture: false
  screenshotsOnFailure: false
  consoleCapture: false
  customSteps: false
---

# Kit recipe: Java + JUnit 4

## How the kit behaves
- The JUnit 4 kit is a **run listener only**: it reports test classes, tests and failures. There is no WebDriver wrapping, so no action steps, screenshots, browser logs or network capture.
- It is inactive outside CloudBeat, like the other Java kits.

## Options
There are no optional features. Instead, ask one question:

### Q `migrate` - Stay on JUnit 4 or move to JUnit 5?
- **When:** the project uses Selenium or Appium (where the richer kits make a real difference).
- **Options:**
  1. Install the JUnit 4 kit as is - basic pass/fail reporting. (Recommended - no change to the tests)
  2. I plan to migrate to JUnit 5 - then use the `java-junit5-selenium` recipe after the migration. Do not perform the migration as part of this wizard; it is out of scope.
- JUnit 4 tests executed through the JUnit 5 Vintage engine are still JUnit 4 tests - use this recipe.

## Installation

### 1. Dependency
**Check availability first - right after the flavor is confirmed, before any option question** (SKILL.md, end of phase 1). Not every kit artifact is necessarily published to Maven Central. For each artifact you are about to add, fetch `https://repo1.maven.org/maven2/io/cloudbeat/<artifactId>/maven-metadata.xml`:
- HTTP 200 -> use its `<release>` version (artifacts from one kit release share the version; if they differ, use the highest version available for **all** of them).
- HTTP 404 -> the artifact is not publicly available. The only acceptable alternative is a repository declared in the project's own POM/Gradle build (`<repositories>`) that serves the artifact - CloudBeat builds the project on its side, so the dependency must be resolvable there too. A copy in the local `~/.m2` cache, or a mirror in `~/.m2/settings.xml`, is **not** enough. If there is no such repository, **the kit cannot be installed now**: do not ask the option questions. Tell the user which artifact is missing and that CloudBeat support can tell them how to obtain it, then ask: **continue without the kit** (Recommended - create the project and deliver the code now; run `/cloudbeat-kit` once the artifact is available; reports will contain test results without action steps, screenshots or browser logs) / **stop here**. Record `kit: not available` with the reason in the state file. Never add a dependency that cannot be resolved, and never invent alternative coordinates.

```xml
<dependency>
    <groupId>io.cloudbeat</groupId>
    <artifactId>cb-kit-junit4</artifactId>
    <version>${cloudbeat.kit.version}</version>
    <scope>test</scope>
</dependency>
```
Resolve the latest version from Maven Central.

### 2. Register the listener
JUnit 4 has no automatic listener discovery - register it in surefire (merge with existing `<properties>`; an existing `listener` property takes a comma-separated list):
```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-surefire-plugin</artifactId>
    <configuration>
        <properties>
            <property>
                <name>listener</name>
                <value>io.cloudbeat.junit4.CloudBeatJUnit4Listener</value>
            </property>
        </properties>
    </configuration>
</plugin>
```
Gradle has no equivalent setting for JUnit 4 run listeners. For a Gradle project explain this, and offer to continue without the kit (project creation and code delivery only).

## Verification
- `mvn -q -DskipTests test-compile`.

## Project settings for CloudBeat
- `--type JUnit`; `maven-surefire-plugin` 2.22.0+.
- Delivery: source code (Git integration recommended).
