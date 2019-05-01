#!/usr/bin/env node

const fakeServer = require('./fakeServer');
const axios = require('axios');
const ora = require('ora');
const argv = require('minimist')(process.argv.slice(2));
const ReporterFileBase = require('./reporter-file-base');
const JUnitXmlReporter = require('./junit-reporter');
const util = require('util');
util.inherits(JUnitXmlReporter, ReporterFileBase);


const params = {};
const FAKE = 'fake';
const FAKE_HOST = 'http://localhost:5000';
const POOLING_INTERVAL = 1000;
let spinner;
let intervalHandler;


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
    // serialize test results to XML and save to file
    try {
        var reporter = new ReporterClass(result, reporterOpt);
        var resultFilePath = reporter.generate();
        console.log('Results saved to: ' + resultFilePath);
        process.exit(0);
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

function startPoolingRunStatus(suiteId, runId){
    intervalHandler = setInterval(() => { handlePooling(suiteId, runId) }, POOLING_INTERVAL);
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
                            if(result && result.data && result.data.data && result.data.data && result.data.data.data.status){
                                const status = result.data.data.data.status;
                                if(status === 'Finished'){
                                    if(typeof spinner !== 'undefined'){
                                        spinner.succeed('test with run id: '+ response.data.data.runId +' finished successful');
                                        saveTestRunResults(result.data.data);
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
            console.error('error', error.message);
            process.exit(1);
          });
    } else {
        // todo need info about real url system
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
        // todo need info about url
    }
}

if(argv){
    if(argv._ && Array.isArray(argv._)){
        if(argv._.includes(FAKE)){
            params.fake = true;
            console.log(`Fake mode`);
        }
    }

    if(argv.method){
        if(argv.method === "start_test"){
            if(argv.id){
                startTest(argv.id);
            } else {
                console.error('start_test method required id parameter');
                process.exit(1);
            }
        }
        if(argv.method === "get_run_status"){
            if(argv.id){
                let loaderString = 'Trying to get run status with id: '+ argv.id;
                spinner = ora(loaderString).start();

                const runStatus = getRunStatus(argv.id);
                if(runStatus instanceof Promise){
                    runStatus.then((result)=>{
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
        }
    }
} else {
    console.log('No args, please read docs');
    process.exit(1);
}