
# CloudBeat API CLI

## Installation:
```npm install -g cloudbeat-cli```

## Usage

#### Run specified test case or suite in CloudBeat
Following command will execute the specified Suite, wait for the tests to finish, and will produce XML report in JUnit format: 
```cloudbeat-cli run <testId> <testType> <apiKey> [host] [folder]```

#### Get specified run status:
Method can be used for getting status of an already running test:
```cloudbeat-cli run-status <runId> <apiKey> [host] ```

#### Get test result for specified test run:
Method can be used for getting status of an finished test:
```cloudbeat-cli --method=pack_and_send --id=[id] --apiKey=[apiKey]```


#### Additional parameters

Exit code can be controlled with `--failOnErrors` (true or false). Default is true.
For example ```--failOnErrors=true```
