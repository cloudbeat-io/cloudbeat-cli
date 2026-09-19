# CloudBeat API CLI

## Installation:
```npm install -g @cloudbeat/cli```

## Usage

### AI assisted project setup
The CLI ships a setup wizard for AI coding agents (currently Claude Code). Run the following in the root of your test automation project:
```console
npx @cloudbeat/cli init --agent claude
```
It installs the `/cloudbeat`, `/cloudbeat-kit` and `/cloudbeat-sync` commands and the `cloudbeat-setup` skill into `.claude/`. Open Claude Code in the same directory and run `/cloudbeat`: the wizard detects your test framework, installs and configures the matching CloudBeat Kit, creates a project in CloudBeat, and delivers your code using Git integration or file upload. Files you modified locally are not overwritten, unless `--force` is specified.

### Authentication
Instead of passing `--apiKey` and `--apiBaseUrl` to each command, the credentials can be stored once:
```console
cloudbeat-cli login [--apiBaseUrl <apiUrl>]
```
The API key is asked interactively (without being echoed) and saved to `~/.cloudbeat/config.json`. Use `login --stdin` to pipe the key in non-interactive environments.

Credentials are resolved in the following order: `--apiKey`/`--apiBaseUrl` options, `CB_API_KEY`/`CB_API_URL` environment variables, stored configuration.

* `cloudbeat-cli whoami` - shows and verifies the credentials in use.
* `cloudbeat-cli logout` - removes the stored credentials.

### JSON output
`login`, `logout`, `whoami`, `git-info`, `pack` and `project` commands support the global `--json` option. A single JSON document with `"ok": true|false` is printed to stdout, which makes the commands suitable for scripts and AI agents.

### Manage projects
```console
cloudbeat-cli project list
cloudbeat-cli project create --name <name> --type <type> --sync <git|manual|none> [options]
cloudbeat-cli project sync <projectNameOrId> [--dir <dir> | --file <zip>] [--wait]
cloudbeat-cli project status <projectNameOrId>
```

**`project create` options**:

* `--type <type>` - Oxygen, CucumberOxygen, CucumberJava, TestNG, JUnit, KotlinTestNG, KotlinJUnit5, MSTestBinary, NUnit3Binary, Playwright, CucumberJs, BellatrixJs, Cypress, Postman or Pytest.
* `--sync git` - CloudBeat pulls the code from a Git repository. `--git-url` and `--git-branch` are detected from the current directory if not specified (SSH remotes are converted to HTTPS).
* `--git-auth` - provide Git credentials now. They are asked interactively, or taken from `CB_GIT_TOKEN` (and optionally `CB_GIT_USERNAME`) environment variables. Without this option the credentials can be added later in the CloudBeat UI.
* `--sync manual` - files are uploaded as a zip archive. Use `--dir <dir>` to pack and upload a directory, or `--file <zip>` to upload an existing archive.
* `--exec-command`, `--exec-options`, `--assembly-names`, `--notes` - optional project settings.
* `--wait` - wait for the initial synchronization to finish.

`project sync` without `--dir`/`--file` triggers Git synchronization.

### Helpers
* `cloudbeat-cli git-info [dir]` - detects the Git repository URL, branch, and conditions which would prevent CloudBeat from seeing the latest code (unpushed commits, missing upstream, uncommitted changes).
* `cloudbeat-cli pack [dir] [-o <zip>] [--list] [--all]` - packs a directory into a zip archive. `--all` includes git-ignored files as well (e.g. build output); it is also supported by `project create` and `project sync`. `.gitignore` is honored, additional exclusions can be listed in `.cbignore`. `node_modules`, `.git`, `.env*` and key files are never included.

### Execute a test case or suite:
Following command will execute the specified Case or Suite, wait for the tests to finish, and will produce XML report in JUnit format: 
```console
cloudbeat-cli start <testType> <testId> --apiKey <apiKey> --apiBaseUrl <apiUrl> [options]
```  
If test execution succeeds exit code will be 0. Otherwise exit code will be 1.

**Arguments**:

* `testId` - Test id.
* `testType` - Either `case` or `suite`.
* `apiKey` - API key. Can be retrieved from the user profile in CloudBeat.
* `apiBaseUrl` - CloudBeat API address. For SaaS it should be https://api.cloudbeat.io. For on-premises installations consult your system administrator.

**Options**:

* `--project <projectName>` - Project name. If specified, then `<testId>` should specify case/suite name instead of an id.
* `--tags <tags>` - Specifies tags by which the tests will be executed. Will work only with Suite.
* `-e, --env <name>` - Specifies environment to use for test execution. Environment should be already defined in CloudBeat for the project whose test is being executed. 
* `-a, --attr <attributes>` - Allows passing name-value pairs to test execution scripts. The passed data can be accessed via `attributes` property. E.g. `log.info(attributes)`.
* `--release <releaseName>` - Name of the release or version to be associated with the test result.
* `--build <buildName>` - Name of the build to be associated with the test result. Requires specifying `--release` as well.
* `--suffix <time|id>` - Report filename suffix to use. Must be either "time" or "id".
* `--folder <folder>` - Path to a directory where test results will be saved. If not specified, results will be saved in the current working directory.
* `--silent` - Do not print test progress details.  

**Usage examples**:

Execute Case by its id and pass environment id and test attributes:

```console
cloudbeat-cli start case 70224 --apiKey AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEE --apiBaseUrl https://api.cloudbeat.io --env MyEnviroment --attr foo=bar,baz=qux
```

Execute Case by its name. Note that when executing tests by name, project name should be specified as well:

```console
cloudbeat-cli start case "My Case" --project "My Project" --apiKey AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEE --apiBaseUrl https://api.cloudbeat.io
```

Execute tests marked with the specified tags in the specified suite. This will override any tags selected via CloudBeat UI:

```console
cloudbeat-cli start suite 34984 --tags foo,bar,qaz --apiKey AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEE --apiBaseUrl https://api.cloudbeat.io
```

### Get current test run status:
`run-status` can be used for retrieving the status of a currently executing test:  
```console
cloudbeat-cli run-status <runId> --apiKey <apiKey> --apiBaseUrl <apiUrl>
```

### Get test result for specified test run:
`run-result` can be used for retrieving the result data for a finished test:  
```console
cloudbeat-cli run-result <runId> --apiKey <apiKey> --apiBaseUrl <apiUrl>
```

### Update project artifacts:
`sync` can be used for updating artifacts for the specified project using a zip archive.
```console
cloudbeat-cli sync <projectId> <artifactArchive> --apiKey <apiKey> --apiBaseUrl <apiUrl>
```  

**Arguments**:

* `projectId` - Project id. Project type must support uploading artifacts as zip archives.
* `artifactArchive` - Path to a zip archive containing the artifacts.
* `apiKey` - API key. Can be retrieved from the user profile in CloudBeat.
* `apiBaseUrl` - CloudBeat API address. For SaaS it should be https://api.cloudbeat.io. For on-premises installations consult your system administrator.

**Usage examples**:

```console
cloudbeat-cli sync 53574 "C:\foo\bar.zip" --apiKey AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEE --apiBaseUrl https://api.cloudbeat.io
```

### Additional general options (work with all commands):

* `-f, --failOnErrors <true|false>` - Controls whether to return non-successful exit code on errors or not.
