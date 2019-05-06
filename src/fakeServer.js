const http = require('http');
const formidable = require('formidable');
const util = require('util');
const port = 5000;
const delay = 200;

// POST `/suites/data/suite/313/run`
// GET `/suites/data/suite/313/run/895a2c38dad1417aa9d23da15faf7ac3`
// GET `/suites/data/suite/313/run/895a2c38dad1417aa9d23da15faf7ac3/1556519661`
// GET `/runs/data/run/895a2c38dad1417aa9d23da15faf7ac3/run`

let runId = '895a2c38dad1417aa9d23da15faf7ac3';
const entityId = '556';
let counter = 0;

const getCounter = () => {
    return counter;
}

const requestHandler = (request, response) => {

    const urlSplit = request.url.split('/');

    if(urlSplit[1] === 'zip'){
      const form = new formidable.IncomingForm();
      form.parse(request, function(err, fields, files) {
        if (err) {
          // Check for and handle any errors here.
          console.error(err.message);
          return;
        }        
         // Like real server
         setTimeout(function(){ 
            response.writeHead(200, {'content-type': 'text/plain'});
            response.write('received upload:\n\n');
    
            // This last line responds to the form submission with a list of the parsed data and files.
            response.end(util.inspect({fields: fields, files: files}));
      }, delay);

      });

    }

    if(urlSplit[1] === 'suites'){
        if(urlSplit.length === 6){
            // POST `/suites/data/suite/313/run`

            runId = urlSplit[4]+'___'+runId;

            const resp = {
                "success":true,
                "data":
                    { "runId": runId }
            }
    
            // Like real server
            setTimeout(function(){ 
                response.setHeader('Content-Type', 'application/json');
                response.end(JSON.stringify(resp));
            }, delay);
        }

        
        if(urlSplit.length === 7){
            // GET `/suites/data/suite/313/run/b71765bad24a4ef7b1a08973994baa89`
            
            const resp = {
                "success":true,
                "data":{
                   "runId": runId,
                   "entityId": entityId,
                   "entityType":"TestCase",
                   "runName":"test",
                   "resultId":null,
                   "startTime":"2019-04-30T05:37:11",
                   "endTime":null,
                   "duration":null,
                   "status":"Initializing",
                   "progress":0.0,
                   "statusLastUpdate":"2019-04-30T05:37:11Z",
                   "executingUserName":"Oleg Savka",
                   "instances":[
                      {
                         "id":"5fa37abf3dad415fa7c01fa929792515",
                         "runId":"895a2c38dad1417aa9d23da15faf7ac3",
                         "startTime":"2019-04-30T05:37:11",
                         "endTime":null,
                         "pendingDuration":-0.35846049999999996,
                         "initializingStartTime":"2019-04-30T05:37:11",
                         "initializingDuration":null,
                         "runningStartTime":null,
                         "runningDuration":null,
                         "status":"Initializing",
                         "statusLastUpdate":"2019-04-30T05:37:11Z",
                         "progress":0.0,
                         "casesStatusJson":[
                            {
                               "id":556,
                               "name":"test",
                               "order":null,
                               "iterationsPassed":0,
                               "iterationsFailed":0,
                               "progress":0.0,
                               "failures":null
                            }
                         ],
                         "capabilitiesJson":{
                            "browserName":"Chrome"
                         },
                         "browserName":null,
                         "browserVersion":null,
                         "deviceName":null,
                         "locationName":null,
                         "outputLog":null
                      }
                   ]
                }
             }
             
            // Like real server
            setTimeout(function(){ 
                response.setHeader('Content-Type', 'application/json');
                response.end(JSON.stringify(resp));
            }, delay);
        }

        if(urlSplit.length === 8){
            // GET `/suites/data/suite/313/run/b71765bad24a4ef7b1a08973994baa89/1556519661`

            counter++;

            if(counter === 1){       
                // Like real server
                setTimeout(() => {  
                    response.statusCode = 304;
                    response.setHeader('Content-Type', 'application/json');
                    response.end();

                }, delay);
            } else {
                const resp1 = {  
                    "success":true,
                    "data":{  
                       "counter": getCounter(),
                       "runId":"3dc30c922ed84d8cb3d77d80a77f8807",
                       "entityId":313,
                       "entityType":"TestSuite",
                       "runName":"test",
                       "resultId":null,
                       "startTime":"2019-04-30T13:16:16",
                       "endTime":null,
                       "duration":null,
                       "status":"Running",
                       "progress":0.0,
                       "statusLastUpdate":"2019-04-30T13:16:26Z",
                       "executingUserName":"Oleg Savka",
                       "instances":[  
                          {  
                             "id":"e668bc018b964782b5e7b00194d31432",
                             "runId":"3dc30c922ed84d8cb3d77d80a77f8807",
                             "startTime":"2019-04-30T13:16:16",
                             "endTime":null,
                             "pendingDuration":0.285815,
                             "initializingStartTime":"2019-04-30T13:16:16",
                             "initializingDuration":9.9418013,
                             "runningStartTime":"2019-04-30T13:16:26",
                             "runningDuration":null,
                             "status":"Running",
                             "statusLastUpdate":"2019-04-30T13:16:26Z",
                             "progress":0.0,
                             "casesStatusJson":[  
                                {  
                                   "id":556,
                                   "name":"test",
                                   "order":1,
                                   "iterationsPassed":0,
                                   "iterationsFailed":0,
                                   "progress":0.0,
                                   "failures":null
                                },
                                {  
                                   "id":1337,
                                   "name":"another test",
                                   "order":2,
                                   "iterationsPassed":0,
                                   "iterationsFailed":0,
                                   "progress":0.0,
                                   "failures":null
                                },
                                {  
                                   "id":1352,
                                   "name":"web",
                                   "order":3,
                                   "iterationsPassed":0,
                                   "iterationsFailed":0,
                                   "progress":0.0,
                                   "failures":null
                                },
                                {  
                                   "id":1345,
                                   "name":"test - long",
                                   "order":4,
                                   "iterationsPassed":0,
                                   "iterationsFailed":0,
                                   "progress":0.0,
                                   "failures":null
                                }
                             ],
                             "capabilitiesJson":{  
                                "browserName":"Chrome"
                             },
                             "browserName":null,
                             "browserVersion":null,
                             "deviceName":null,
                             "locationName":null,
                             "outputLog":null
                          }
                       ]
                    }
                }

                const resp4 = {
                    "success":true,
                    "data":{
                       "counter": getCounter(),
                       "runId": runId,
                       "entityId": entityId,
                       "entityType":"TestCase",
                       "runName":"test",
                       "resultId":129938,
                       "startTime":"2019-04-30T05:37:11",
                       "endTime":"2019-04-30T05:37:19",
                       "duration":8.0162478,
                       "status":"Finished",
                       "progress":1.0,
                       "statusLastUpdate":"2019-04-30T05:37:19Z",
                       "executingUserName":"Oleg Savka",
                       "instances":[
                          {
                             "id":"5fa37abf3dad415fa7c01fa929792515",
                             "runId":"895a2c38dad1417aa9d23da15faf7ac3",
                             "startTime":"2019-04-30T05:37:11",
                             "endTime":"2019-04-30T05:37:19",
                             "pendingDuration":-0.35846049999999996,
                             "initializingStartTime":"2019-04-30T05:37:11",
                             "initializingDuration":6.4226022,
                             "runningStartTime":"2019-04-30T05:37:17",
                             "runningDuration":2.0162478,
                             "status":"Finished",
                             "statusLastUpdate":"2019-04-30T05:37:19Z",
                             "progress":1.0,
                             "casesStatusJson":[
                                {
                                   "id":556,
                                   "name":"test",
                                   "order":null,
                                   "iterationsPassed":1,
                                   "iterationsFailed":0,
                                   "progress":1.0,
                                   "failures":[
                 
                                   ]
                                }
                             ],
                             "capabilitiesJson":{
                                "browserName":"Chrome"
                             },
                             "browserName":null,
                             "browserVersion":null,
                             "deviceName":null,
                             "locationName":null,
                             "outputLog":null
                          }
                       ]
                    }
                }
        
                // Like real server
                setTimeout(function(){ 
                    response.setHeader('Content-Type', 'application/json');
                    let resp;

                    if(counter < 4){
                        resp = resp1;
                    } else {
                        resp = resp4;
                        counter = 0;
                    }

                    response.end(JSON.stringify(resp));
                }, delay);
            }
        }
    }

    if(urlSplit[1] === 'runs'){
        // GET `/runs/data/run/b71765bad24a4ef7b1a08973994baa89/run`

        let resp;

        if(urlSplit[4].startsWith('2')){
            resp = {
                "success":true,
                "data":{
                   "runId": runId,
                   "entityId": entityId,
                   "entityType":"TestSuite",
                   "runName":"test",
                   "resultId":null,
                   "startTime":"2019-04-30T13:16:16",
                   "endTime":null,
                   "duration":null,
                   "status":"Initializing",
                   "progress":0.0,
                   "statusLastUpdate":"2019-04-30T13:16:16Z",
                   "executingUserName":"Oleg Savka",
                   "instances":[
                      {
                         "id":"e668bc018b964782b5e7b00194d31432",
                         "runId":"3dc30c922ed84d8cb3d77d80a77f8807",
                         "startTime":"2019-04-30T13:16:16",
                         "endTime":null,
                         "pendingDuration":0.285815,
                         "initializingStartTime":"2019-04-30T13:16:16",
                         "initializingDuration":null,
                         "runningStartTime":null,
                         "runningDuration":null,
                         "status":"Initializing",
                         "statusLastUpdate":"2019-04-30T13:16:16Z",
                         "progress":0.0,
                         "casesStatusJson":[
                            {
                               "id":556,
                               "name":"test",
                               "order":1,
                               "iterationsPassed":0,
                               "iterationsFailed":0,
                               "progress":0.0,
                               "failures":null
                            },
                            {
                               "id":1337,
                               "name":"another test",
                               "order":2,
                               "iterationsPassed":0,
                               "iterationsFailed":0,
                               "progress":0.0,
                               "failures":null
                            },
                            {
                               "id":1352,
                               "name":"web",
                               "order":3,
                               "iterationsPassed":0,
                               "iterationsFailed":0,
                               "progress":0.0,
                               "failures":null
                            },
                            {
                               "id":1345,
                               "name":"test - long",
                               "order":4,
                               "iterationsPassed":0,
                               "iterationsFailed":0,
                               "progress":0.0,
                               "failures":null
                            }
                         ],
                         "capabilitiesJson":{
                            "browserName":"Chrome"
                         },
                         "browserName":null,
                         "browserVersion":null,
                         "deviceName":null,
                         "locationName":null,
                         "outputLog":null
                      }
                   ]
                }
            }
        } else {
            resp = {
                "success":true,
                "data":{
                   "runId": runId,
                   "entityId": entityId,
                   "entityType":"TestCase",
                   "runName":"test",
                   "resultId":129938,
                   "startTime":"2019-04-30T05:37:11",
                   "endTime":"2019-04-30T05:37:19",
                   "duration":8.0162478,
                   "status":"Finished",
                   "progress":1.0,
                   "statusLastUpdate":"2019-04-30T05:37:19Z",
                   "executingUserName":"Oleg Savka",
                   "instances":[
                      {
                         "id":"5fa37abf3dad415fa7c01fa929792515",
                         "runId":"895a2c38dad1417aa9d23da15faf7ac3",
                         "startTime":"2019-04-30T05:37:11",
                         "endTime":"2019-04-30T05:37:19",
                         "pendingDuration":-0.35846049999999996,
                         "initializingStartTime":"2019-04-30T05:37:11",
                         "initializingDuration":6.4226022,
                         "runningStartTime":"2019-04-30T05:37:17",
                         "runningDuration":2.0162478,
                         "status":"Finished",
                         "statusLastUpdate":"2019-04-30T05:37:19Z",
                         "progress":1.0,
                         "casesStatusJson":[
                            {
                               "id":556,
                               "name":"test",
                               "order":null,
                               "iterationsPassed":1,
                               "iterationsFailed":0,
                               "progress":1.0,
                               "failures":[
             
                               ]
                            }
                         ],
                         "capabilitiesJson":{
                            "browserName":"Chrome"
                         },
                         "browserName":null,
                         "browserVersion":null,
                         "deviceName":null,
                         "locationName":null,
                         "outputLog":null
                      }
                   ]
                }
            }
        }

         
        // Like real server
        setTimeout(function(){ 
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(resp));
        }, delay);
    }

}

const server = http.createServer(requestHandler)
server.listen(port, (err) => {
    if (err) {
        return console.log('something bad happened', err)
    }
})