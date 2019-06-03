# CloudBeat API CLI

## Installing:
```npm install```

## Fake server:

#### Run test:
* short(time) test sample : ```node src/cli.js fake --method=start_test --id=1```

* long(time) test sample : ```node src/cli.js fake --method=start_test --id=2```

#### Get test status:
Just run ```node src/cli.js fake --method=get_run_status --id=c0310c37190140b5a61d7e2d0d3493bc```

## Real server:

#### Uploading ZIP archives to CloudBeat:

sample : ```node src/cli.js --method=pack_and_send --id=[id] --accountKey=[accountKey] --apiKey=[apiKey] --folder=C:\testResults --host=google.com```

#### Run test:
test sample : ```node src/cli.js --method=start_test --id=[id] --accountKey=[accountKey] --apiKey=[apiKey]```

#### Get test status:
Just run ```node src/cli.js fake --method=get_run_status --id=[id] --accountKey=[accountKey] --apiKey=[apiKey]```

If you want to save results to some folder and pack it to zip add --folder parameter.
For example ```--folder=C:\testResults```

If you want to set your host - use --host parameter.
For example ```--host=google.com```

If you want to set controlling exit code - use --fail-on-errors parameter (true or false). Default is true.
For example ```--fail-on-errors=true```