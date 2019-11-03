
# CloudBeat API CLI

## Installation:
```npm install -g cloudbeat-cli```

## Usage

#### Running a Suite:
Following command will execute the specified Suite, wait for the tests to finish, and will produce XML report in JUnit format: 
```cloudbeat-cli --method=start_test --suiteId=[suiteId] --apiKey=[apiKey] --host=https://api.cloudbeat.io```
```cloudbeat-cli --method=start_test --caseId=[caseId] --apiKey=[apiKey] --host=https://api.cloudbeat.io```

#### Getting test status:
`get_run_status` switch can be used for getting status of an already running test:
```cloudbeat-cli --method=get_run_status --id=[id] --apiKey=[apiKey] --host=https://api.cloudbeat.io```

#### CI/CD integration - Uploading ZIP archives to CloudBeat:

```cloudbeat-cli --method=pack_and_send --id=[id] --apiKey=[apiKey] --folder=C:\testResults --host=https://api.cloudbeat.io```


#### Additional parameters

Exit code can be controlled with `--fail-on-errors` (true or false). Default is true.
For example ```--fail-on-errors=true```


## Development (using mockup server):

#### Run test:
* short(time) test sample : ```node src/cli.js fake --method=start_test --suiteId=1```

* long(time) test sample : ```node src/cli.js fake --method=start_test --caseId=2```

#### Getting test status:
```node src/cli.js fake --method=get_run_status --id=c0310c37190140b5a61d7e2d0d3493bc```
