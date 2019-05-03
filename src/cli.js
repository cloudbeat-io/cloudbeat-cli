#!/usr/bin/env node

const fs = require("fs"); 
const path = require("path"); 
const archiver = require('archiver');
const fakeServer = require('./fakeServer');
const moment = require('moment');
const axios = require('axios');
const ora = require('ora');
const argv = require('minimist')(process.argv.slice(2));
const ReporterFileBase = require('./reporter-file-base');
const JUnitXmlReporter = require('./junit-reporter');
const util = require('util');
util.inherits(JUnitXmlReporter, ReporterFileBase);

/*
All variants of test
Pending = 0,
Initializing = 1,
Running = 2,
Finished = 3,
Canceling = 4,
Canceled = 5

*/
const statuses = {
    Pending: 'Pending',
    Initializing: 'Initializing',
    Running: 'Running',
    Finished: 'Finished',
    Canceling: 'Canceling',
    Canceled: 'Canceled'
}


const params = {};
const FAKE = 'fake';
const FAKE_HOST = 'http://localhost:5000';
let HOST = 'http://eqa.cloudbeat.io';
const POOLING_INTERVAL = 1000;
let spinner;
let intervalHandler;
let accountKey;
let apiKey;

function checkDataForError(data){
    if(data && typeof data.success !== 'undefined' && data.success === false){
        if(typeof spinner !== 'undefined'){
            if(data.error){
                spinner.fail(data.error)
            } else {
                spinner.fail('Unexpected error');
            }
        }
        process.exit(1);
    }
}

function saveTestRunResults(result) {
    // try to dynamically load reporter class based on reporter format name received from the user
    var ReporterClass = null;
    try {
        ReporterClass = JUnitXmlReporter;
    } catch (e) {
        console.log(e.stack);
        return false;
    }
    // set reporter settings
    var reporterOpt = {
        method: 'saveTestRunResults',
        targetFolder: 'results'
    };

    let folder;
    
    if(argv && argv.folder){
        folder = argv.folder;
    }

    if(folder){
        if (fs.existsSync(folder)) {
            reporterOpt.targetFolder = folder;
        } else {
            console.error("Folder `"+folder+"` did not exist ");
            process.exit(1);
        }
    }

    // serialize test results to XML and save to file
    try {
        var reporter = new ReporterClass(result, reporterOpt);
        var resultFilePath = reporter.generate();
        console.log('Results XLM saved to: ' + resultFilePath);

        
        // save XML to ZIP
        if(folder && resultFilePath){
            
            // last is file name
            // before last is folder created for file
            // all before is targetFolder path from console
            const resultFilePathSplit = resultFilePath.split(path.sep);
            const resultFileName = resultFilePathSplit[resultFilePathSplit.length-1];

            try {
                // create a file to stream archive data to.
                const pathToArchive = resultFilePath + '.zip';
                const output = fs.createWriteStream(pathToArchive);
                const archive = archiver('zip', {
                    zlib: { level: 9 } // Sets the compression level.
                });
                
                output.on('close', function() {
                    console.log('Results ZIP saved to:', pathToArchive);
                    process.exit(0);
                });
                
                archive.on('warning', function(err) {
                    if (err.code === 'ENOENT') {
                        console.warn(err);
                        // log warning
                    } else {
                        // throw error
                        throw err;
                    }
                });
                
                archive.on('error', function(err) {
                    throw err;
                });
                
                // pipe archive data to the file
                archive.pipe(output);
                
                // append a file from stream
                archive.append(fs.createReadStream(resultFilePath), { name: resultFileName });
                
                // finalize the archive (ie we are done appending files but streams have to finish yet)
                archive.finalize();

            } catch (err) {
                console.error("err" + err);
                process.exit(1);
            }
        } else {
            process.exit(0);
        }
    } catch (err) {
        console.error("Can't save results to file: " + err.message);
        process.exit(1);
    }
}

function handlePooling(suiteId, runId){
    if(params && params.fake && suiteId && runId){
        return axios.get(FAKE_HOST+'/suites/data/suite/'+suiteId+'/run/'+runId+'/1556519661', {})
        .then(function (response) {
            if(response.data.data.status === "Running"){
                spinner.text = "Running ";
            }

            if(response.data.data.status === "Finished"){
                spinner.succeed('test with run id: '+ response.data.data.runId +' finished successful');
                if(intervalHandler){
                    clearInterval(intervalHandler);
                    saveTestRunResults(response.data);
                }
            }
        })
        .catch(function (error) {
            if(error.response.status === 304){
                spinner.text = "Running";
                // not modified
            } else {
                console.log('error', error);
            }
        })
        .then(function (result) {
            return result;
        });
    } else {
        // todo need info about url
    }
}

function handleRealPooling(suiteId, runId){
    if(params && params.fake && suiteId && runId){
        return axios.get(FAKE_HOST+'/runs/api/run/'+runId+'/1556519661', {})
        .then(function (response) {
            if(response.data.data.status === "Running"){
                spinner.text = "Running ";
            }

            if(response.data.data.status === "Finished"){
                spinner.succeed('test with run id: '+ response.data.data.runId +' finished successful');
                if(intervalHandler){
                    clearInterval(intervalHandler);
                    saveTestRunResults(response.data);
                }
            }
        })
        .catch(function (error) {
            if(error.response.status === 304){
                spinner.text = "Running";
                // not modified
            } else {
                console.log('error', error);
            }
        })
        .then(function (result) {
            return result;
        });
    } else {
        return axios.get(HOST+'/runs/api/run/'+runId+'/', {
            params: {
                accountKey: accountKey,
                apiKey: apiKey
            }
        })
        .then(function (response) {
            checkDataForError(response.data);

            const status = response.data.data.status;

            if([statuses.Pending, statuses.Initializing, statuses.Running, statuses.Canceling].includes(status)){
                
                let spinnerNewText;

                if(statuses.Running === status){
                    if(response.data.data && response.data.data.progress){
                        spinnerNewText = status+' '+(response.data.data.progress*100)+'%';
                    } else {
                        spinnerNewText = status;
                    }
                    // console.log('\n response.data.data', response.data.data);
                    // console.log('\n');
                } else {   
                    spinnerNewText = status;
                }
                
                if(typeof spinner !== 'undefined'){
                    spinner.text = spinnerNewText;
                }

                startPoolingRunStatus(id, response.data.data.runId);
            }
            

                        
            if(status ===statuses.Finished){
                if(typeof spinner !== 'undefined'){
                    spinner.succeed('test with run id: '+ response.data.data.runId +' finished successful');
                    saveTestRunResults(response.data);
                }
            }
                            
            if(status === statuses.Canceled){
                if(typeof spinner !== 'undefined'){
                    spinner.info('test with run id: '+ response.data.data.runId +' canceled');
                    process.exit(0);
                }
            }
        })
        .catch(function (error) {

            if(error && error.code && error.code === 'HPE_INVALID_CONSTANT'){
                // console.log('\n error', error);
                process.exit(1);
                //ignore
            } else {
            }
        })
        .then(function (result) {
            return result;
        });
    }
}

function startPoolingRunStatus(suiteId, runId){
    if(params && params.fake){
        intervalHandler = setInterval(() => { handlePooling(suiteId, runId) }, POOLING_INTERVAL);
    } else {
        intervalHandler = setInterval(() => { handleRealPooling(suiteId, runId) }, POOLING_INTERVAL);
    }
}

function startRealTest(id){
        
    let loaderString = 'Trying to run test with suite id: '+ id;
    spinner = ora(loaderString).start();

    axios.post(HOST+'/suites/api/suite/'+id+'/run', {
        accountKey: accountKey,
        apiKey: apiKey
    })
      .then(function (response) {
        checkDataForError(response.data);
        if(response.status === 200){
            if(response.data && response.data.data && response.data.data.runId){

                loaderString = 'Started test with run id: '+ response.data.data.runId;
                spinner.text = loaderString;

                const runStatus = getRunStatus(response.data.data.runId, false);

                if(runStatus instanceof Promise){
                    runStatus.then((result)=>{
                        if(typeof spinner !== 'undefined'){
                            spinner.fail(result.error);
                        } else {
                            console.error(result.error);
                        }

                        if(result && result.data && result.data.data && result.data.data && result.data.data.data.status){
                            const status = result.data.data.data.status;
                            
                            if([statuses.Pending, statuses.Initializing, statuses.Running, statuses.Canceling].includes(status)){
                                
                                if(typeof spinner !== 'undefined'){
                                    spinner.text = status;
                                }

                                startPoolingRunStatus(id, response.data.data.runId);
                            }
                            

                                        
                            if(status === statuses.Finished){
                                if(typeof spinner !== 'undefined'){
                                    spinner.succeed('test with run id: '+ response.data.data.runId +' finished successful');
                                    saveTestRunResults(response.data);
                                }
                            }
                                            
                            if(status === statuses.Canceled){
                                if(typeof spinner !== 'undefined'){
                                    spinner.info('test with run id: '+ response.data.data.runId +' canceled');
                                    process.exit(0);
                                }
                            }
                        } else {
                            if(typeof spinner !== 'undefined'){
                                spinner.fail(result.data);
                            }             
                            console.warn('bad result', result);
                            process.exit(1);                               
                        }
                    })
                } else {
                  console.warn('bad run status result', runStatus);
                  process.exit(1);
                }
            } else {
                console.warn('bad response.data', response.data);
                process.exit(1);
            }
        } else {
            console.warn('bad response.status', response.status);
            process.exit(1);
        }
      })
      .catch(function (error) {
        console.error('\n error', error.message);
        console.error('\n full error', error);
        process.exit(1);
      });
}

function startTest(id){
    if(params && params.fake){
        let loaderString = 'Trying to run test with suite id: '+ id;
        spinner = ora(loaderString).start();

        axios.post(FAKE_HOST+'/suites/data/suite/'+id+'/run', {})
          .then(function (response) {
            if(response.status === 200){
                if(response.data && response.data.data && response.data.data.runId){
                    loaderString = 'Started test with run id: '+ response.data.data.runId;
                    spinner.text = loaderString;

                    const runStatus = getRunStatus(response.data.data.runId, false);
                    if(runStatus instanceof Promise){
                        runStatus.then((result)=>{
                            if(result && result.error){
                                if(typeof spinner !== 'undefined'){
                                    spinner.fail(result.error);
                                } else {
                                    console.error(result.error);
                                }
                                process.exit(1);
                            }

                            if(result && result.data && result.data.data && result.data.data && result.data.data.data.status){
                                const status = result.data.data.data.status;
                                if(status === 'Finished'){
                                    if(typeof spinner !== 'undefined'){
                                        spinner.succeed('test with run id: '+ response.data.data.runId +' finished successful');
                                        saveTestRunResults(response.data.data);
                                    }
                                } else if(status === 'Initializing'){
                                    startPoolingRunStatus(id, response.data.data.runId);
                                } else {
                                    if(typeof spinner !== 'undefined'){
                                        spinner.text = status;
                                    }
                                }
                            } else {
                                if(typeof spinner !== 'undefined'){
                                    spinner.fail(response.data);
                                }             
                                console.warn('bad result', result);
                                process.exit(1);                               
                            }
                        })
                    } else {
                      console.warn('bad run status result', runStatus);
                      process.exit(1);
                    }
                } else {
                    console.warn('bad response.data', response.data);
                    process.exit(1);
                }
            } else {
                console.warn('bad response.status', response.status);
                process.exit(1);
            }
          })
          .catch(function (error) {
            console.error('error', error.message);
            process.exit(1);
          });
    } else {
        startRealTest(id);
    }
}

function getRunStatus(id){
    if(params && params.fake){
        return axios.get(FAKE_HOST+'/runs/data/run/'+id+'/run', {})
        .then(function (response) {
            return { data: response, error: null };
        })
        .catch(function (error) {
            return { data: null, error: error.message };
        })
        .then(function (result) {
            return result;
        });
    } else {
        return axios.get(HOST+'/runs/api/run/'+id, {
            params: {
                accountKey: accountKey,
                apiKey: apiKey
            }
        })
        .then(function (response) {
            checkDataForError(response.data);
            return { data: response, error: null };
        })
        .catch(function (error) {
            return { data: null, error: error.message };
        })
        .then(function (result) {
            return result;
        });
        // todo need info about url
    }
}

if(argv){
    if(argv._ && Array.isArray(argv._)){
        if(argv._.includes(FAKE)){
            params.fake = true;
            console.log(`Fake mode`);
        } else {
            if(argv.accountKey && argv.apiKey){
                accountKey = argv.accountKey;
                apiKey = argv.apiKey;
            } else {
                console.error('cli requires accountKey and apiKey parameters');
                process.exit(1);
            }
        }
    }

    
    if(argv.host){
        HOST = argv.host;
    }

    if(argv.method){
        if(argv.method === "start_test"){
            if(argv.id){
                startTest(argv.id);
            } else {
                console.error('start_test method required id parameter');
                process.exit(1);
            }
        } else if(argv.method === "get_run_status"){
            if(argv.id){
                let loaderString = 'Trying to get run status with id: '+ argv.id;
                spinner = ora(loaderString).start();

                const runStatus = getRunStatus(argv.id);

                if(runStatus instanceof Promise){
                    runStatus.then((result)=>{
                        if(typeof spinner !== 'undefined'){
                            spinner.fail(result.error);
                        } else {
                            console.error(result.error);
                        }

                        if(result && result.data && result.data.data){
                            spinner.succeed('Run status is : '+ result.data.data.data.status);
                            saveTestRunResults(result.data.data);
                        }
                    });
                }
            } else {
                console.error('get_run_status method required id parameter');
                process.exit(1);
            }
        } else {
            console.error('method name is not correct');
            process.exit(1);
        }
    } else {
        console.error('method parameter is required');
        process.exit(1);
    }
} else {
    console.log('No args, please read docs');
    process.exit(1);
}