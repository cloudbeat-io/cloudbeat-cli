import { ResultApi, RunOptions, RuntimeApi } from '@cloudbeat/client/v1';
import { RunStatus, RunStatusEnum } from '@cloudbeat/types';

const RUN_POOLING_INTERVAL = 5000;

const statuses = {
    Pending: 'Pending',
    Initializing: 'Initializing',
    Running: 'Running',
    Finished: 'Finished',
    Canceled: 'Canceled',
};

export class CloudBeatService {
    private readonly runtimeApi: RuntimeApi;
    private readonly resultApi: ResultApi;

    constructor({ apiBaseUrl, apiKey }: { apiBaseUrl?: string; apiKey: string }) {
        this.runtimeApi = new RuntimeApi(apiKey, apiBaseUrl);
        this.resultApi = new ResultApi(apiKey, apiBaseUrl);
    }

    async runCase(caseId: number, options?: RunOptions) {
        const caze = caseId === 0 && options?.testName ? options.testName : caseId;
        console.log(`Trying to run case: ${caze}`);

        const newRunId = await this.runtimeApi.runTestCase(caseId, options);
        if (!newRunId) {
            throw new Error(`Unable to start a new run for case: ${caze}`);
        }
        await this._waitForRunToFinish(newRunId);
        const result = await this.resultApi.getResultByRunId(newRunId);
        const caseTagList = await this.resultApi.getResultTestCasesTagsByRunId(newRunId);
        return { result, caseTagList };
    }
    async runSuite(suiteId: number, options?: RunOptions) {
        const suite = suiteId === 0 && options?.testName ? options.testName : suiteId;
        console.log(`Trying to run suite: ${suite}`);

        const newRunId = await this.runtimeApi.runTestSuite(suiteId, options);
        if (!newRunId) {
            throw new Error(`Unable to start a new run for suite: ${suite}`);
        }
        await this._waitForRunToFinish(newRunId);
        const result = await this.resultApi.getResultByRunId(newRunId);
        const caseTagList = await this.resultApi.getResultTestCasesTagsByRunId(newRunId);
        return { result, caseTagList };
    }
    async runMonitor(monitorId: string, options?: RunOptions) {
        console.log(`Trying to run monitor: ${monitorId}`);

        const newRunId = await this.runtimeApi.runMonitor(monitorId, options);
        if (!newRunId) {
            throw new Error(`Unable to start a new run for monitor: ${monitorId}`);
        }
        await this._waitForRunToFinish(newRunId);
        const result = await this.resultApi.getResultByRunId(newRunId);
        const caseTagList = await this.resultApi.getResultTestCasesTagsByRunId(newRunId);
        return { result, caseTagList: null };
    }
    getResult(resultId: string) {

    }

    async getRunStatus(runId: string) {
        const runStatus: RunStatus = await this.runtimeApi.getRunStatus(runId);
        let msg = 'Run status: ';
        if (runStatus.progress) {
            msg += `${RunStatusEnum[runStatus.status]} ${(runStatus.progress*100).toFixed(0)}%`;
        }
        else {
            msg += RunStatusEnum[runStatus.status];
        }
    }

    async getRunResult(runId: string) {
        const result = await this.resultApi.getResultByRunId(runId);
        if (result) {
            const json = JSON.stringify(result, null, 4);
            console.log(`Run result:\n${json}`);
        }
        return result;
    }

    async handleRealPooling(runId: string, resolve: () => void){
        const runStatus: RunStatus = await this.runtimeApi.getRunStatus(runId);
        if (runStatus.status === RunStatusEnum.Pending
            || runStatus.status === RunStatusEnum.Initializing
            || runStatus.status === RunStatusEnum.Running
        ) {
            // waiting
            let msg;
            if (runStatus.status === RunStatusEnum.Running) {
                if (runStatus.progress) {
                    msg = `${RunStatusEnum[runStatus.status]} ${(runStatus.progress * 100).toFixed(0)}%`;
                }
                else {
                    msg = RunStatusEnum[runStatus.status];
                }
            }
            else {
                msg = RunStatusEnum[runStatus.status];
            }

            console.log(msg);
        }
        else if (runStatus.status === RunStatusEnum.Finished) {
            console.log(`Test with run id ${runId} has been completed`);
            resolve();
        }
        else if (runStatus.status === RunStatusEnum.Canceled) {
            console.log(`Test with run id ${runId} has been canceled`);
            resolve();
        }
    }

    async _waitForRunToFinish(runId: string) {
        let intervalId;
        await new Promise((resolve: any) => {
            intervalId = setInterval(() => {
                this.handleRealPooling(runId, resolve);
            }, RUN_POOLING_INTERVAL);
        });
        clearInterval(intervalId);
    }
}
