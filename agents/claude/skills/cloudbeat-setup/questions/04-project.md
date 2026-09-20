# Step 3 - CloudBeat project

Goal: a project id to deliver the code to. Creation happens together with code delivery (step 4), because the delivery method is part of project creation - here we only decide **which** project.

## Procedure
Run `cb --json project list` first.

## Q1 - New or existing project?
- **Ask when:** the list contains at least one project whose `type` matches the detected flavor. Otherwise say in one sentence that no existing project of this type was found, and go straight to Q2.
- **Options:**
  1. Create a new project (Recommended)
  2. Use an existing project -> show the projects whose `type` matches the detected flavor (others cannot run this code); the user picks one. Record its id and skip Q2.
- **Default:** new. If a project with the same name as the repository/folder already exists, mention it - the user may have set it up before.

## Q2 - Project name
- **Ask when:** creating a new project.
- **Default:** derived from the first available of: the repository name (last path segment of the `git-info` URL, without `.git`), the `name` in the build file (`package.json`, `artifactId`, csproj), the folder name. Make it human friendly: split on `-`/`_`/`.`, capitalize words, and write common acronyms in upper case (E2E, UI, API, QA) - `acme-e2e-tests` -> `Acme E2E Tests`. Do not add the repository owner. Offer the default plus free text.
- Names must be unique among the listed projects - check before proposing.

## Q3 - Test command
- **Ask when:** the project is not run by the type's standard command - e.g. tests are started through a custom npm script, a Maven profile, a specific `testng.xml`, or a sub-directory.
- **Default:** keep CloudBeat's default for the type (do not pass `--exec-command`). When the question is skipped, still state the command CloudBeat will use in one line, so the user can object.
- When needed, propose the command detected in phase 1 and pass it as `--exec-command`. For Java, suite files/profiles go to `--exec-options`.
- .NET binary types: instead of a command, `--assembly-names` is required - the test assembly file name(s), e.g. `Acme.Tests.dll`, taken from the `.csproj` (`AssemblyName` or the project file name).

## Skip rules
- `.cloudbeat/setup.md` already has a project id and `project status <id>` succeeds -> confirm with the user that this is still the project to use, and skip the step.

## Errors
- HTTP 403 on create: the user's role cannot create projects - they need edit permission, or an administrator should create the project; then choose "existing project".
- HTTP 404 on create/list: the CloudBeat installation is older than this wizard and does not support project management by API key. The user creates the project in the CloudBeat UI; continue with "existing project" (ask for the project id if listing is not supported either).
