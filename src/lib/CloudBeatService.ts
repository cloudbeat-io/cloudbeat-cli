import fs from 'fs';
import path from 'path';
import { ProjectApi, ResultApi, RunOptions, RuntimeApi } from '@cloudbeat/client/v1';
import { RunStatus, RunStatusEnum } from '@cloudbeat/types';

const RUN_POOLING_INTERVAL = 5000;
const STATUS_POOLING_INTERVAL = 1000;

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
    private readonly projectApi: ProjectApi;

    constructor({ apiBaseUrl, apiKey }: { apiBaseUrl?: string; apiKey: string }) {
        this.runtimeApi = new RuntimeApi(apiKey, apiBaseUrl);
        this.resultApi = new ResultApi(apiKey, apiBaseUrl);
        this.projectApi = new ProjectApi(apiKey, apiBaseUrl);
    }

    public async runCase(caseId: number, silent: boolean, options?: RunOptions) {
        const caze = caseId === 0 && options?.testName ? options.testName : caseId;
        console.log(`Trying to run case: ${caze}`);

        const newRunId = await this.runtimeApi.runTestCase(caseId, options);
        if (!newRunId) {
            throw new Error(`Unable to start a new run for case: ${caze}`);
        }
        await this.waitForRunToFinish(newRunId, silent);
        const result = await this.resultApi.getResultByRunId(newRunId);
        const caseTagList = await this.resultApi.getResultTestCasesTagsByRunId(newRunId);
        return { result, caseTagList };
    }
    public async runSuite(suiteId: number, silent: boolean, options?: RunOptions) {
        const suite = suiteId === 0 && options?.testName ? options.testName : suiteId;
        console.log(`Trying to run suite: ${suite}`);

        const newRunId = await this.runtimeApi.runTestSuite(suiteId, options);
        if (!newRunId) {
            throw new Error(`Unable to start a new run for suite: ${suite}`);
        }
        await this.waitForRunToFinish(newRunId, silent);
        const result = await this.resultApi.getResultByRunId(newRunId);
        const caseTagList = await this.resultApi.getResultTestCasesTagsByRunId(newRunId);
        return { result, caseTagList };
    }
    public async runMonitor(monitorId: string, silent: boolean, options?: RunOptions) {
        console.log(`Trying to run monitor: ${monitorId}`);

        const newRunId = await this.runtimeApi.runMonitor(monitorId, options);
        if (!newRunId) {
            throw new Error(`Unable to start a new run for monitor: ${monitorId}`);
        }
        await this.waitForRunToFinish(newRunId, silent);
        const result = await this.resultApi.getResultByRunId(newRunId);
        const caseTagList = await this.resultApi.getResultTestCasesTagsByRunId(newRunId);
        return { result, caseTagList: null };
    }

    public async getRunStatus(runId: string) {
        const runStatus: RunStatus = await this.runtimeApi.getRunStatus(runId);
        let msg = 'Run status: ';
        if (runStatus.progress) {
            msg += `${RunStatusEnum[runStatus.status]} ${(runStatus.progress*100).toFixed(0)}%`;
        }
        else {
            msg += RunStatusEnum[runStatus.status];
        }
    }

    public async getRunResult(runId: string) {
        const result = await this.resultApi.getResultByRunId(runId);
        if (result) {
            const json = JSON.stringify(result, null, 4);
            console.log(`Run result:\n${json}`);
        }
        return result;
    }

    public async uploadProjectArtifactsByName(projectName: string, filePath: string) {

    }

    public async uploadProjectArtifactsById(projectId: number, filePath: string) {
        // api/project/sync/artifacts/{id}
        if (!fs.existsSync(filePath)) {
            throw new Error(`Provided file not found: ${filePath}`);
        }
        const fileName = path.basename(filePath);
        const fileContent = fs.readFileSync(filePath);
        const { commitHash } = await this.projectApi.getSyncStatus(projectId.toString()) || {};
        if (!commitHash) {
            throw new Error('Unable to obtain sync status.');
        }
        await this.projectApi.uploadArtifacts(projectId.toString(), fileName, fileContent);
        await this.waitForSyncStatusToChange(projectId, commitHash);
    }

    private async handleRealPooling(runId: string, silent: boolean, resolve: () => void) {
        const runStatus: RunStatus = await this.runtimeApi.getRunStatus(runId);
        if (runStatus.status === RunStatusEnum.Pending
            || runStatus.status === RunStatusEnum.Initializing
            || runStatus.status === RunStatusEnum.Running
        ) {
            if (!silent) {
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

    private async waitForRunToFinish(runId: string, silent: boolean) {
        let intervalId;
        await new Promise((resolve: any) => {
            intervalId = setInterval(() => {
                this.handleRealPooling(runId, silent, resolve);
            }, RUN_POOLING_INTERVAL);
        });
        clearInterval(intervalId);
    }

    private async waitForSyncStatusToChange(projectId: number, commitHash: string) {
        let intervalId: any;
        await new Promise((resolve: any) => {
            intervalId = setInterval(async () => {
                const syncStatus = await this.projectApi.getSyncStatus(projectId.toString());
                if (syncStatus.commitHash !== commitHash) {
                    resolve();
                }
            }, STATUS_POOLING_INTERVAL);
        });
        clearInterval(intervalId);
    }
}
