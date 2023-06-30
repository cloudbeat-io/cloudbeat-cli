let counter = 1;
module.exports = (req, res) => {
    res.setHeader('content-type', 'application/json; charset=utf-8');
    if (counter == 1) {
        res.status(200).send('{"statusCode":200,"data":{"runId":"ed0a508b8536454f89c15cb5f0a61a40","entityId":62145,"entityType":"TestCase","runName":"Verify","startTime":"2023-06-29T11:57:36","duration":34,"status":"Running","progress":0,"statusLastUpdate":"2023-06-29T11:57:40Z","executingUserName":"Roman Ovs.","executingUserId":1,"projectId":1114,"instances":[{"id":"8f8edd2ffe4d45f6873705d10598e9d5","runId":"ed0a508b8536454f89c15cb5f0a61a40","startTime":"2023-06-29T11:57:36","pendingDuration":1.0089595,"initializingStartTime":"2023-06-29T11:57:37","initializingDuration":3.4097518,"runningStartTime":"2023-06-29T11:57:40","status":"Running","statusLastUpdate":"2023-06-29T11:57:40Z","progress":0,"casesStatusJson":[{"id":62145,"name":"Verify","order":0,"progress":0,"iterationsFailed":0,"iterationsPassed":0}],"capabilitiesJson":{"browserName":"Chrome"},"locationName":"EQA1"}]}}');
    }
    else {
        res.status(200).send('{"statusCode":200,"data":{"runId":"ed0a508b8536454f89c15cb5f0a61a40","entityId":62145,"entityType":"TestCase","runName":"Verify","startTime":"2023-06-29T11:57:36","duration":34,"status":"Finished","progress":0,"statusLastUpdate":"2023-06-29T11:57:40Z","executingUserName":"Roman Ovs.","executingUserId":1,"projectId":1114,"instances":[{"id":"8f8edd2ffe4d45f6873705d10598e9d5","runId":"ed0a508b8536454f89c15cb5f0a61a40","startTime":"2023-06-29T11:57:36","pendingDuration":1.0089595,"initializingStartTime":"2023-06-29T11:57:37","initializingDuration":3.4097518,"runningStartTime":"2023-06-29T11:57:40","status":"Running","statusLastUpdate":"2023-06-29T11:57:40Z","progress":0,"casesStatusJson":[{"id":62145,"name":"Verify","order":0,"progress":0,"iterationsFailed":0,"iterationsPassed":0}],"capabilitiesJson":{"browserName":"Chrome"},"locationName":"EQA1"}]}}');
    }
    console.log('counter', counter);
    counter++;
};
