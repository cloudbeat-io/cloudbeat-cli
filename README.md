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

#### Run test:
test sample : ```node src/cli.js --method=start_test --id=[id] --accountKey=[accountKey] --apiKey=[apiKey]```

#### Get test status:
Just run ```node src/cli.js fake --method=get_run_status --id=[id] --accountKey=[accountKey] --apiKey=[apiKey]```
