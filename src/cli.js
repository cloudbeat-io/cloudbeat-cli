#!/usr/bin/env node

const fs = require("fs"); 
const https = require('https');
const request = require("request"); 
const path = require("path"); 
const archiver = require('archiver');
const tmp = require('tmp');
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
Canceled = 5

*/
const statuses = {
    Pending: 'Pending',
    Initializing: 'Initializing',
    Running: 'Running',
    Finished: 'Finished',
    Canceled: 'Canceled'
}


const params = {};
const FAKE = 'fake';
const FAKE_HOST = 'http://localhost:5000';
let HOST = 'http://eqa.cloudbeat.io';
let DEBUG = false;
const POOLING_INTERVAL = 1000;
let spinner;
let textCache;
let intervalHandler;
let apiKey;
let failOnErrors = true;

const Agent  = new https.Agent({
    rejectUnauthorized: false
})

const instance = axios.create();
instance.defaults.httpsAgent = Agent
  

function nextText(text){
    if(textCache === text){
        // ignore
    } else {
        if(textCache){
            if(typeof spinner !== 'undefined'){
                spinner = spinner.info(textCache);
                spinner.start(text);
                textCache = text;
            }
        } else {
            spinner.start(text);
            textCache = text;
        }
    }
}

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

function getRunResult(runId) {

    const params = {
        apiKey: apiKey,
        noInstances: false
    }

    return instance.get(HOST+'/results/api/results/run/'+runId, {
        params: params
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
}

function saveTestRunResults(result) {    

    if(result && result.data && result.data.runId){
        const runResult = getRunResult(result.data.runId)
        
        if(runResult instanceof Promise){
            runResult.then((result)=>{
                
                if(result && result.error){
                    if(typeof spinner !== 'undefined'){
                        spinner.fail(result.error+', check you input data');
                    } else {
                        console.error(result.error);
                    }
                }

                if(result && result.data && result.data.data && result.data.data.data){
                    reportResult(result.data.data.data);
                }
            });
        }
    } else {
        console.log('saveTestRunResults bad params');
        process.exit(1);
    }
}

function finishCLI(result) {
    var code = 1;

    if(result){
        code = result.result.isSuccess ? 0 : 1;

        if(failOnErrors){
            // do nothing, all ok
        } else {
            if(code === 0){
                code = 1;
            } else if(code === 1){
                code = 0;
            }
        }
    }

    console.log('exit code :', code);

}


function reportResult(result) {
    
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
        finishCLI(result);
    } catch (err) {
        console.error("Can't save results to file: " + err.message);
        process.exit(1);
    }
}

function handleRealPooling(suiteId, runId){
    if(params && params.fake && suiteId && runId){
        // not support now
    } else {
        
        const params = {
            apiKey: apiKey
        }

        return instance.get(HOST+'/runs/api/run/'+runId+'/', {
            params: params
        })
        .then(function (response) {
            checkDataForError(response.data);

            const status = response.data.data.status;

            if([statuses.Pending, statuses.Initializing, statuses.Running].includes(status)){
                
                let spinnerNewText;

                if(statuses.Running === status){
                    if(response.data.data && response.data.data.progress){
                        spinnerNewText = status+' '+(response.data.data.progress*100)+'%';
                    } else {
                        spinnerNewText = status;
                    }
                } else {   
                    spinnerNewText = status;
                }
                
                if(typeof spinner !== 'undefined'){
                    nextText(spinnerNewText);
                    // spinner.text = spinnerNewText;
                }

                startPoolingRunStatus(id, response.data.data.id);
            }
            
       
            if(status === statuses.Finished){
                if(typeof spinner !== 'undefined'){
                    spinner.succeed('test with run id: '+ response.data.data.runId +' finished successful');
                    saveTestRunResults(response.data);
                    if(intervalHandler){
                        clearInterval(intervalHandler);
                    }
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
                process.exit(1);
            }
        })
        .then(function (result) {
            return result;
        });
    }
}

function startPoolingRunStatus(suiteId, runId){
    if(params && params.fake){
        // not support now
    } else {
        intervalHandler = setInterval(() => { handleRealPooling(suiteId, runId) }, POOLING_INTERVAL);
    }
}

function startRealTest(id, path){
        
    let loaderString = 'Trying to run test with '+ path +' id: '+ id;
    spinner = ora().start();
    nextText(loaderString);
    
    instance.post(HOST+'/'+path+'s/api/'+path+'/'+id+'/run?apiKey='+apiKey)
      .then(function (response) {

        checkDataForError(response.data);
        if(response.status === 200){
            if(response.data && response.data.data && response.data.data.id){

                loaderString = 'Started test with run id: '+ response.data.data.id;
                nextText(loaderString);
                const runStatus = getRunStatus(response.data.data.id, false);
             
                if(runStatus instanceof Promise){
                    runStatus.then((result)=>{

                        if(result && result.error){
                            if(typeof spinner !== 'undefined'){
                                spinner.fail(result.error+', check you input data');
                            } else {
                                console.error(result.error);
                            }
                        }

                        if(result && result.data && result.data.data && result.data.data && result.data.data.data.status){
                            const status = result.data.data.data.status;
                            
                            if([statuses.Pending, statuses.Initializing, statuses.Running].includes(status)){
                                
                                if(typeof spinner !== 'undefined'){
                                    nextText(status);
                                    // spinner.text = status;
                                }

                                startPoolingRunStatus(id, response.data.data.id);
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
                if(response.data && response.data.data && response.data.data.id === null ){
                    console.warn('Test not startend, check you input data');
                } else {
                    console.warn('bad response.data', response.data);
                }

                process.exit(1);
            }
        } else {
            console.warn('bad response.status', response.status);
            process.exit(1);
        }
      })
      .catch(function (error) { 
        if(error && error.response && error.response.status){
            if(error.response.status === 422){
                if(error.response.data){
                    if(error.response.data.errorMessage){
                        console.log(error.response.data.errorMessage);
                    }
                    if(error.response.data.errors && Array.isArray(error.response.data.errors) && error.response.data.errors.length > 0){
    
                        error.response.data.errors.map((message) => {
                            console.log(message);
                        })
                    }
                    spinner.fail(`Error: ${error.message}`);
                }
            } else if(error.response.status === 404){
                let name = '';
                if(path === 'case'){
                    name = 'Case';
                } else if(path === 'suite'){
                    name = 'Suite';
                }
    
                if(name && id){
                    const errorMessage = `Error: ${name} with ID ${id} is not found.`;
                    spinner.fail(errorMessage);
                }
            } else if(error.response.status === 401){
                if(apiKey){
                    const errorMessage = `Error: The provided API KEY "${apiKey}" is not authorized. Verify that the key is correct.`;
                    spinner.fail(errorMessage);
                }
            } else if(error.message) {
                spinner.fail(`Error: ${error.message}`);
            } else {
                spinner.fail(`Uncatched error with status code: ${error.response.status}`);
            }
        } else if(error && error.code && error.code === 'ENOTFOUND') {
            spinner.fail(`Cannot find the server: ${HOST}`);
        } else {            
            spinner.fail(`Uncatched error`);
        }

        if(DEBUG){
            console.log('error', error);
        }

        process.exit(1);
      });
}

function startTest(id, path){
    if(params && params.fake){
        // not support now
    } else {
        startRealTest(id, path);
    }
}

function getRunStatus(id){
    if(params && params.fake){
    } else {
        return instance.get(HOST+'/runs/api/run/'+id+'?apiKey='+apiKey)
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

function getSaveFolderPath(folder){
    if(folder && typeof folder === 'string'){
        if(folder.endsWith(path.sep)){
            return folder;
        } else {
            return folder+path.sep;
        }
    }
    return false;
}

function sendZipToServer(zip, id){
    if(!zip){
        console.error('sendZipToServer method requires zip parameter');
        process.exit(1);
    }

    if(!id){
        console.error('sendZipToServer method requires id parameter');
        process.exit(1);
    }

    if (fs.existsSync(zip)) {
        if(params && params.fake){
            try{
                const req = request.post('http://localhost:5000/zip', function (err, resp, body) {
                    if (err) {
                        console.log('Error posting to http://localhost:5000/zip', err);
                    } else {
                        console.log('Response from server: ' + body);
                        process.exit(0);
                    }
                });
                const form = req.form();
                form.append('data', JSON.stringify(params));
                form.append('file', fs.createReadStream(zip));
            } catch(e){
                console.error('e', e);
                process.exit(1);
            }
        } else {
            let url = '/projects/api/project/sync/artifacts/';

            if(id){
                url+=id;
            }

            if(apiKey){
                url+='?apiKey='+apiKey;
            }

            try{
                const req = request.post(HOST+url, function (err, resp, body) {
                    if (err) {
                        console.log('Error!');
                        console.log('err', err);
                        console.log('Zip was not uploaded!');
                        process.exit(1);
                    } else {
                        if(resp.statusCode === 200){
                            console.log('Zip archive successfully uploaded to the server.');
                            process.exit(0);
                        } else if(resp.statusCode === 500){
                            console.error('Server side error has occurred:');

                            if(typeof resp.body === 'string'){
                                const searchString = 'd2p1:string';
                                const includes = resp.body.includes(searchString);

                                if(includes){
                                    const splitResult = resp.body.split(searchString);

                                    if(splitResult && Array.isArray(splitResult) && splitResult.length === 3){
                                        let resultString = splitResult[1].slice(1,-2);
                                        console.error('Error details: ', resultString);
                                    }
                                }
                            }
                        
                            process.exit(1);
                        } else if(resp.statusCode === 422){
                            console.error('An error has occurred:');

                            try{
                                const resultJson = JSON.parse(resp.body);

                                if(resultJson){
                                    if(resultJson.errorMessage){
                                        console.error(resultJson.errorMessage);
                                    }
                                    if(resultJson.errors && Array.isArray(resultJson.errors) && resultJson.errors.length > 0){
                                        resultJson.errors.map((message) => {
                                            console.error(message);
                                        })
                                    }
                                }
                            } catch(e) {
                                console.error('e', e);
                            }

                            process.exit(1);
                        } else if(resp.statusCode === 401){
                            console.error('Authentication Error: Invalid API Key.');
                            process.exit(1);
                        } else if(resp.statusCode === 404){
                            console.error('The specified ID is invalid.');
                            process.exit(1);
                        } else {
                            console.error('An error has occurred. Response Code: ', resp.statusCode);
                            process.exit(1);
                        }
                    }
                });
                const form = req.form();
                form.append('data', JSON.stringify(params));
                form.append('file', fs.createReadStream(zip));
            } catch(e){
                console.error('e', e);
                process.exit(1);
            }
        }
    } else {
        console.error("Archive `"+zip+"` does not exist");
        process.exit(1);
    }
}

function packAndSend(folder, id){
    if(!folder){
        console.error('packAndSend method requires folder parameter');
        process.exit(1);
    }

    if(!id){
        console.error('packAndSend method requires id parameter');
        process.exit(1);
    }


    if (fs.existsSync(folder)) {
        // Archive folder
        try {
            const saveFolderPath = getSaveFolderPath(folder);

            if(!saveFolderPath){
                console.error('folder path is incorrect: ', folder);
                console.error('\n');
                console.error('parsed folder path: ', saveFolderPath);
                process.exit(1);
            }

            const archiveName = tmp.tmpNameSync() + '.zip';
            // create a file to stream archive data to.
            const output = fs.createWriteStream(archiveName);
            const archive = archiver('zip', {
                zlib: { level: 9 } // Sets the compression level.
            });
            
            output.on('close', function() {
                console.log('Directory was compressed, zip archive location:', archiveName);
                sendZipToServer(archiveName, id);
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
            
            // append files from a sub-directory
            archive.directory(saveFolderPath, false);

            // finalize the archive (ie we are done appending files but streams have to finish yet)
            archive.finalize();
        } catch (err) {
            console.error("err" + err);
            process.exit(1);
        }
    } else {
        console.error("Folder `"+folder+"` does not exist ");
        process.exit(1);
    }
}

if(argv){
    if(argv._ && Array.isArray(argv._)){
        if(argv._.includes(FAKE)){
            params.fake = true;
            console.log(`Fake mode`);
        } else {
            if(argv.apiKey){
                apiKey = argv.apiKey;
            } else {
                console.error('cli requires apiKey parameters');
                process.exit(1);
            }
        }
    }

    if(typeof argv['fail-on-errors'] === 'string'){
        if(['true', 'false'].includes(argv['fail-on-errors'])){
            if(argv['fail-on-errors'] === 'false'){
                failOnErrors = false;
            }
        } else {
            console.error('fail-on-errors arguments can by only "true" or "false" ');
            process.exit(1);
        }
    }
    // fail-on-errors

    if(argv.host){
        HOST = argv.host;
    }

    if(argv.debug){
        DEBUG = argv.debug;
    }

    if(argv.method){
        if(argv.method === "start_test"){
            if(argv.suiteId){
                startTest(argv.suiteId, 'suite');
            } else if(argv.caseId){
                startTest(argv.caseId, 'case');
            } else {
                console.error('start_test method required suiteId or caseId parameter');
                process.exit(1);
            }
        } else if(argv.method === "get_run_status"){
            if(argv.id){
                let loaderString = 'Trying to get run status with id: '+ argv.id;
                spinner = ora(loaderString).start();

                const runStatus = getRunStatus(argv.id);

                if(runStatus instanceof Promise){
                    runStatus.then((result)=>{
                        
                        if(result && result.error){
                            if(typeof spinner !== 'undefined'){
                                spinner.fail(result.error+', check you input data');
                            } else {
                                console.error(result.error);
                            }
                        }

                        if(result && result.data && result.data.data){
                            spinner.succeed('Run status is : '+ result.data.data.data.status);

                            if([statuses.Pending, statuses.Initializing, statuses.Running].includes(result.data.data.data.status)){
                                process.exit(0);
                            } else {    
                                saveTestRunResults(result.data.data);
                            }
                        }
                    });
                }
            } else {
                console.error('get_run_status method requires suiteId or caseId parameter');
                process.exit(1);
            }
        } else if(argv.method === "pack_and_send"){
            if(argv.folder && argv.id){
                packAndSend(argv.folder, argv.id);
            } else {
                console.error('get_run_status method requires folder and id parameter');
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
    console.error('Missing arguments. Please read the docs.');
    process.exit(1);
}