# Step 1 - Confirm the detected stack

Goal: agree on the kit flavor before anything is planned. Detection comes first (see SKILL.md, Phase 1); questions only confirm or fill gaps.

## Present the findings
Show a short, scannable summary before asking:

```
Language:            Java 17 (Maven)
Test framework:      TestNG 7.9
Automation library:  Selenium 4.21 (+ Appium: no)
Tests:               src/test/java, run by `mvn test` (testng.xml)
Driver created in:   src/test/java/com/acme/base/BaseTest.java
CloudBeat kit:       not installed
=> Kit flavor:       java-testng-selenium, CloudBeat project type: TestNG
```

## Q1 - Is this correct?
- **Ask when:** always (single confirmation).
- **Options:** Yes (Recommended) / No, let me correct it.
- On "No": ask what is wrong in free text, re-detect, and show the summary again.

## Q2 - Which test project?
- **Ask when:** more than one test project was detected (monorepo, several `pom.xml` / `package.json` / `*.csproj` with tests).
- **Options:** the detected project folders (max 4, otherwise ask in text).
- The chosen folder is the project root for all following steps.

## Q3 - Where is the driver / browser created?
- **Ask when:** the flavor supports wrapping AND detection found zero or more than one candidate location.
- **Options:** the candidate files; "I create it in each test" ; "Not sure".
- "Not sure" -> search again for `new ChromeDriver`, `new RemoteWebDriver`, `new AppiumDriver`, `WebDriverManager`, driver factories, DI providers; propose the best candidate.

## Skip rules
- A kit is already installed -> say so, and ask whether to review its options (continue to step 2) or go straight to the CloudBeat project (phase 5).
- No recipe for the flavor -> explain, and jump to phase 5.
