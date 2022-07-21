import CloudBeatApi from './CloudBeatApi';

const RUN_POOLING_INTERVAL = 5000;

const statuses = {
    Pending: 'Pending',
    Initializing: 'Initializing',
    Running: 'Running',
    Finished: 'Finished',
    Canceled: 'Canceled',
};

export class CloudBeatService {
    private readonly api: CloudBeatApi;
    private poolingMessages: any[] = [];

    constructor({ host, apiKey }: { host?: string; apiKey: string }) {
        this.api = new CloudBeatApi({ host, apiKey });
    }

    async runCase(caseId: string) {
        const initString = `Trying to run case: ${caseId}`;
        console.log(initString);

        const newRun = await this.api.testCaseRun(caseId);
        if (!newRun) {
            throw new Error(`Unable to start a new run for case: ${caseId}`);
        }
        await this._waitForRunToFinish(newRun.id);
        const result = await this.api.testResultGet(newRun.id);
        return result;
    }
    async runSuite(suiteId: string) {
        const initString = `Trying to run suite: ${suiteId}`;
        console.log(initString);

        const newRun = await this.api.testSuiteRun(suiteId);
        if (!newRun) {
            throw new Error(`Unable to start a new run for suite: ${suiteId}`);
        }
        await this._waitForRunToFinish(newRun.id);
        const result = await this.api.testResultGet(newRun.id);
        return result;
    }
    async runMonitor(monitorId: string) {
        const initString = `Trying to run monitor: ${monitorId}`;
        console.log(initString);

        const newRun = await this.api.testMonitorRun(monitorId);
        if (!newRun) {
            throw new Error(`Unable to start a new run for monitor: ${monitorId}`);
        }
        await this._waitForRunToFinish(newRun.id);
        const result = await this.api.testResultGet(newRun.id);
        return result;
    }
    getResult(resultId: string) {

    }

    async getRunStatus(runId: string) {
        const statusResult = await this.api.runGetStatus(runId);
        let msg = 'Run status: ';
        if (statusResult.progress) {
            msg += `${statusResult.status} ${(statusResult.progress*100).toFixed(0)}%`;
        }
 else {
            msg += statusResult.status;
        }

        console.log(msg);
    }

    async getRunResult(runId: string) {
        const result = await this.api.runGetResult(runId);
        const json = JSON.stringify(result, null, 4);
        console.log(`Run result:\n${json}`);
        return result;
    }

    async handleRealPooling(runId: string, resolve: () => void){
        const statusResult = await this.api.runGetStatus(runId);
        if([statuses.Pending, statuses.Initializing, statuses.Running].includes(statusResult.status)){
            // waiting
            let msg;
            if(statuses.Running === statusResult.status){
                if(statusResult.progress){
                    msg = `${statusResult.status} ${(statusResult.progress*100).toFixed(0)}%`;
                }
 else {
                    msg = statusResult.status;
                }
            }
 else {
                msg = statusResult.status;
            }

            if(this.poolingMessages.includes(msg)){
                // ignore
            }
 else {
                this.poolingMessages.push(msg);
                console.log(msg);
            }

        }

        if (statusResult.status === statuses.Finished) {
            console.log(`Test with run id ${runId} has been completed`);
            resolve();
        }

        if (statusResult.status === statuses.Canceled) {
            console.log(`Test with run id ${runId} has been canceled`);
            resolve();
        }
    }

    async _waitForRunToFinish(runId: string) {
        this.poolingMessages = [];
        await new Promise((resolve: any) => setInterval(() => {
            this.handleRealPooling(runId, resolve);
        }, RUN_POOLING_INTERVAL));
    }
}
