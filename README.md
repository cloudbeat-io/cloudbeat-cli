# CloudBeat API CLI

## Installation:
```npm install -g cloudbeat-cli```

## Usage

#### Upload ZIP archives to CloudBeat:

```cloudbeat-cli --method=pack_and_send --id=[id] --accountKey=[accountKey] --apiKey=[apiKey] --folder=C:\testResults --host=https://app.cloudbeat.io```

#### Run Suite:
```cloudbeat-cli --method=start_test --id=[id] --accountKey=[accountKey] --apiKey=[apiKey] --host=https://app.cloudbeat.io```

#### Get test status:
Just run ```cloudbeat-cli --method=get_run_status --id=[id] --accountKey=[accountKey] --apiKey=[apiKey] --host=https://app.cloudbeat.io```

#### Additional parameters
If you want to save results to a folder and pack it to zip add --folder parameter.
For example ```--folder=C:\testResults```

Exit code can be controlled with `--fail-on-errors` (true or false). Default is true.
For example ```--fail-on-errors=true```


## Development - fake server:

#### Run test:
* short(time) test sample : ```node src/cli.js fake --method=start_test --id=1```

* long(time) test sample : ```node src/cli.js fake --method=start_test --id=2```

#### Get test status:
Just run ```node src/cli.js fake --method=get_run_status --id=c0310c37190140b5a61d7e2d0d3493bc```

