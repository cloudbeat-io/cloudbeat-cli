import CloudBeatApi from './CloudBeatApi';

const RUN_POOLING_INTERVAL = 5000;

const statuses = {
    Pending: 'Pending',
    Initializing: 'Initializing',
    Running: 'Running',
    Finished: 'Finished',
    Canceled: 'Canceled'
};

export default class CloudBeatService {
    constructor({ host, apiKey }) {
        this.api = new CloudBeatApi({ host, apiKey });
    }
    async runCase(caseId) {
        let initString = `Trying to run case: ${caseId}`;
        console.log(initString);

        const newRun = await this.api.testCaseRun(caseId);
        if (!newRun) {
            throw new Error(`Unable to start a new run for case: ${caseId}`);
        }
        await this._waitForRunToFinish(newRun.id);
        const result = await this.api.testResultGet(newRun.id);
        return result;
    }
    async runSuite(suiteId) {
        let initString = `Trying to run suite: ${suiteId}`;
        console.log(initString);

        const newRun = await this.api.testSuiteRun(suiteId);
        if (!newRun) {
            throw new Error(`Unable to start a new run for suite: ${suiteId}`);
        }
        await this._waitForRunToFinish(newRun.id);
        const result = await this.api.testResultGet(newRun.id);
        return result;
    }
    async runMonitor(monitorId) {
        let initString = `Trying to run monitor: ${monitorId}`;
        console.log(initString);

        const newRun = await this.api.testMonitorRun(monitorId);
        if (!newRun) {
            throw new Error(`Unable to start a new run for monitor: ${monitorId}`);
        }
        await this._waitForRunToFinish(newRun.id);
        const result = await this.api.testResultGet(newRun.id);
        return result;
    }
    getResult(resultId) {

    }

    async getRunStatus(runId) {
        const statusResult = await this.api.runGetStatus(runId);
        let msg = 'Run status: ';
        if(statusResult.progress){
            msg += statusResult.status+' '+(statusResult.progress*100)+'%';
        } else {
            msg += statusResult.status;
        }

        console.log(msg);
    }

    async getRunResult(runId) {
        const result = await this.api.runGetResult(runId);
        const json = JSON.stringify(result, null, 4);
        console.log(`Run result:\n${json}`);
        return result;
    }

    async handleRealPooling(runId, resolve){
        const statusResult = await this.api.runGetStatus(runId);
        if([statuses.Pending, statuses.Initializing, statuses.Running].includes(statusResult.status)){
            // waiting   
            let msg;         
            if(statuses.Running === statusResult.status){
                if(statusResult.progress){
                    msg = statusResult.status+' '+(statusResult.progress*100)+'%';
                } else {
                    msg = statusResult.status;
                }
            } else {
                msg = statusResult.status;
            }

            if(this.poolingMessages.includes(msg)){
                // ignore
            } else {
                this.poolingMessages.push(msg);
                console.log(msg);
            }

        }
        
        if(statusResult.status === statuses.Finished){
            console.log('Test with run id ' + runId + ' has been completed');
            resolve();
        }
                        
        if(statusResult.status === statuses.Canceled){
            console.log('Test with run id ' + runId + ' has been canceled');
            resolve();
        }
    }

    async _waitForRunToFinish(runId) {
        this.poolingMessages = [];
        await new Promise(resolve => setInterval(() => {
            this.handleRealPooling(runId, resolve);
        }, RUN_POOLING_INTERVAL));
    }
}