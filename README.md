# CloudBeat API CLI

## Installation:
```npm install -g @cloudbeat/cli```

## Usage

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

* `-project <projectName>` - Project name. If specified, then `<testId>` should specify case/suite name instead of an id.
* `-e, --env <name>` - Specifies environment to use for test execution. Environment should be already defined in CloudBeat for the project whose test is being executed. 
* `-a, --attr <attributes>` - Allows passing name-value pairs to test execution scripts. The passed data can be accessed via `attributes` property. E.g. `log.info(attributes)`.
* `--release <releaseName>` - Name of the release or version to be associated with the test result.
* `--build <buildName>` - Name of the build to be associated with the test result.
* `--suffix <time|id>` - Report filename suffix to use. Must be either "time" or "id".
* `--folder <folder>` - Path to a directory where test results will be saved. If not specified, results will be saved in the current working directory.	

**Usage example**:

```console
cloudbeat-cli start case 70224 --apiKey AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEE --apiBaseUrl https://api.cloudbeat.io --env MyEnviroment --attr foo=bar,baz=qux
```

### Get current test run status:
`run-status` can be used for getting status of a currently executing test:  
```console
cloudbeat-cli run-status <runId> --apiKey <apiKey> --apiBaseUrl <apiUrl>
```

### Get test result for specified test run:
`run-result` can be used for getting result data for a finished test:  
```console
cloudbeat-cli run-result <runId> --apiKey <apiKey> --apiBaseUrl <apiUrl>
```

### Additional general options (work with all commands):

* `-f, --failOnErrors <true|false>` - Controls whether to return non-successful exit code on errors or not.
* `-d, --debug <true|false>` - Print debug information during execution.