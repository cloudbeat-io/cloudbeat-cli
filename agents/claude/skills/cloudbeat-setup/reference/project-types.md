# Stack -> kit flavor -> CloudBeat project type

Use the detection signals to pick a row. `Recipe` is the file in `kits/`; "-" means no recipe yet: tell the user, and continue with project creation and code delivery only.

| Detection signals | Flavor / Recipe | `--type` | Kit package |
|---|---|---|---|
| `pom.xml`/`build.gradle` with `org.testng` + `selenium-java` or `io.appium` | `java-testng-selenium` | `TestNG` | `io.cloudbeat:cb-kit-testng` + `io.cloudbeat:cb-kit-selenium4` |
| `org.testng` without Selenium/Appium | `java-testng-selenium` (skip the WebDriver options) | `TestNG` | `io.cloudbeat:cb-kit-testng` |
| `junit-jupiter` (JUnit 5) | `java-junit5-selenium` | `JUnit` | `io.cloudbeat:cb-kit-junit5` (+ `cb-kit-selenium4`) |
| `junit:junit` (JUnit 4), also when run through the Vintage engine | `java-junit4` | `JUnit` | `io.cloudbeat:cb-kit-junit4` (listener only, no WebDriver wrapping) |
| `io.cucumber` / `info.cukes` (Cucumber for Java) | - (see notes) | `CucumberJava` | none for current Cucumber versions |
| Kotlin + TestNG / JUnit 5 | `java-testng-selenium` / `java-junit5-selenium` (translate the snippets to Kotlin) | `KotlinTestNG` / `KotlinJUnit5` | same as Java |
| `package.json` with `@playwright/test` | `node-playwright` | `Playwright` | `@cloudbeat/playwright` |
| `package.json` with `@cucumber/cucumber` (+ `playwright`) | `node-cucumber` | `CucumberJs` | `@cloudbeat/cucumber` |
| `package.json` with `cypress` | `node-cypress` (no kit to install) | `Cypress` | none - reporting is added by CloudBeat at run time |
| `package.json` with `@wdio/cli` (WebdriverIO) | - (see notes) | not supported | - |
| `package.json` with `@bellatrix/*` | - | `BellatrixJs` | - |
| `*.csproj` with `NUnit` 4.x / 3.x | `dotnet-nunit` | `NUnit3Binary` | `CloudBeat.Kit.NUnit4` / `CloudBeat.Kit.NUnit` |
| `*.csproj` with `MSTest.TestFramework` / `MSTest` | `dotnet-mstest` | `MSTestBinary` | `CloudBeat.Kit.MSTest` |
| `*.csproj` with `Microsoft.Playwright.NUnit` | `dotnet-nunit` + note | `NUnit3Binary` | + `CloudBeat.Kit.Playwright` (inherit `CbPageTest` instead of `PageTest`) |
| `pytest` in `requirements.txt` / `pyproject.toml` | `python-pytest` | `Pytest` | `cloudbeat-pytest` (+ `cloudbeat-selenium`) |
| Postman collection (`*.postman_collection.json`) | - | `Postman` | none needed |
| Oxygen project (`oxygen.conf.js`, `*.ox.js`) | - | `Oxygen` / `CucumberOxygen` | none needed |

## Notes
- **Cucumber for Java**: there is no CloudBeat kit for current Cucumber-JVM versions (the only existing plugin targets the legacy Cucumber 1.x API and is not maintained). Projects that run Cucumber through TestNG (`AbstractTestNGCucumberTests`) or the JUnit Platform can use the TestNG / JUnit 5 kit instead: the project is then created as `--type TestNG` / `JUnit`, scenarios are reported as tests, and WebDriver wrapping works as usual. Present this as an option, not a default - the user may prefer a `CucumberJava` project without a kit, where CloudBeat works with feature files.
- **WebdriverIO**: CloudBeat has no WebdriverIO project type, so such a project cannot be created or executed by CloudBeat yet. Tell the user, and stop after phase 1. Do not install `@cloudbeat/wdio` - it is not released.
- **Postman, Oxygen, Bellatrix**: no kit is needed; go straight to the CloudBeat project (phase 5).
- **.NET project types are binary**: CloudBeat runs compiled test assemblies. Code delivery for .NET means uploading the build output (see the `dotnet-nunit` recipe), and `--assembly-names` is required when creating the project.
- Java, Node.js and Python projects are delivered as source code; CloudBeat installs dependencies and builds on its side (for Node.js it runs `npm ci`, so `package-lock.json` must be present and committed).
- When several flavors match (e.g. a monorepo), ask the user which test project to set up, and treat its folder as the project root.
- Versions: do not hardcode from memory. Resolve the latest published version at install time (`npm view <pkg> version`, `dotnet add package` without a version, Maven Central search) and show it in the plan.
