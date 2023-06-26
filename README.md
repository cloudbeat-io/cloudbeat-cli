
# CloudBeat API CLI

## Installation:
```npm install -g @cloudbeat/cli```

## Usage

#### Run specified test case or suite in CloudBeat
Following command will execute the specified Case or Suite, wait for the tests to finish, and will produce XML report in JUnit format: 
```cloudbeat-cli start <testType> <testId> --apiKey <apiKey> --apiBaseUrl <apiUrl> [folder]```  
If test execution succeeds exit code will be 0. Otherwise exit code will be 1.

Arguments:

* `testId` - Test id.
* `testType` - Either `case` or `suite`.
* `apiKey` - API key. Can be retrieved from the user profile in CloudBeat.
* `apiUrl` - CloudBeat API address. For SaaS it should be https://api.cloudbeat.io. For on-premises installations consult your system administrator.
* `folder` - Optional path to a directory where test results will be saved. If not specified, results will be saved in the current working directory.

Usage example:

`cloudbeat-cli start case 70224 --apiKey AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEE --apiBaseUrl https://api.cloudbeat.io`

#### Get run status:
`run-status` can be used for getting status of a currently executing test:  
```cloudbeat-cli run-status <runId> --apiKey <apiKey> --apiBaseUrl <apiUrl>```

#### Get test result for specified test run:
`run-result` can be used for getting result data for a finished test:  
```cloudbeat-cli run-result <runId> --apiKey <apiKey> --apiBaseUrl <apiUrl>```

#### Additional parameters

Exit code can be controlled with `--failOnErrors` (true or false). Default is true.
For example:  
`cloudbeat-cli --failOnErrors=false start case 70224  --apiKey AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEE --apiBaseUrl https://api.cloudbeat.io`
