
# CloudBeat API CLI

## Installation:
```npm install -g cloudbeat-cli```

## Usage

#### Run specified test case or suite in CloudBeat
Following command will execute the specified Case or Suite, wait for the tests to finish, and will produce XML report in JUnit format: 
```cloudbeat-cli run <testId> <testType> <apiKey> [host] [folder]```
If test execution succeeds exit code will be 0. Otherwise exit code will be 1.

Arguments:

* `testId` - Test id.
* `testType` - Either `case` or `suite`.
* `apiKey` - API key. Can be retrieved from the user profile in CloudBeat.
* `host` - Optional CloudBeat API address. Defaults to https://api.cloudbeat.io.
* `folder` - Optional path to a directory where test results will be saved. If not specified, results will be saved in the current working directory.

Usage example:

`cloudbeat-cli run 70224 case AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEE https://api.cloudbeat.io`

#### Get run status:
`run-status` can be used for getting status of a currently executing test:
```cloudbeat-cli run-status <runId> <apiKey> [host]```

#### Get test result for specified test run:
`run-result` can be used for getting result data for a finished test:
```cloudbeat-cli run-result <runId> <apiKey> [host]```

#### Additional parameters

Exit code can be controlled with `--failOnErrors` (true or false). Default is true.
For example:
`cloudbeat-cli --failOnErrors=false run 70224 case AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEE https://api.cloudbeat.io`
