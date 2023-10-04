import fs from 'fs';
import { CloudBeatService } from '../lib/CloudBeatService';
import * as DEFAULTS from '../lib/const/defaults';
import * as helper from '../lib/helper';
import { IReporterOptions } from '../types/IReporterOptions';

export default async function(testId: number | string, testType: string, apiKey: string, {
    tags = undefined,
    attr = undefined,
    host = undefined,
    cwd = process.cwd(),
    projectName = undefined,
    reportFormat = DEFAULTS.TEST_REPORT_FORMAT,
    reportFileSuffix = undefined,
    folder = undefined,
    failOnErrors = true,
    releaseName = undefined,
    sprintName = undefined,
    buildName = undefined,
    pipelineName = undefined,
    environmentId = undefined,
    environmentName = undefined,
    silent = false,
}) {
    if (!testId) {
        console.error('"testId" argument must be specified.');
        helper.finishCLI(failOnErrors);
    }
    else if (!testType) {
        console.error('"testType" argument must be specified.');
        helper.finishCLI(failOnErrors);
    }
    if (!apiKey) {
        console.error('"apiKey" argument must be specified.');
        helper.finishCLI(failOnErrors);
    }
    const cb = new CloudBeatService({
        apiBaseUrl: host,
        apiKey: apiKey,
    });
    const runOpts = {
        testAttributes: attr,
        tags,
        environmentName,
        environmentId,
        releaseName,
        sprintName,
        buildName,
        pipelineName,
        testName: projectName ? testId as string : undefined,
        projectName,
    };

    // if project name is specified then user wants to execute case/suite by its name
    // and we should pass 0 for the id
    if (projectName) {
        testId = 0;
    }

    try {
        let result = null;
        // eslint-disable-next-line no-undef-init
        let caseTagList = undefined;

        if (testType === 'case') {
            const { result: _result, caseTagList: _caseTagList } = await cb.runCase(testId as number, silent, runOpts);
            result = _result;
            caseTagList = _caseTagList;
        }
        else if (testType === 'monitor') {
            const { result: _result, caseTagList: _caseTagList } = await cb.runMonitor(testId as string, silent, runOpts);
            result = _result;
            caseTagList = _caseTagList;
        }
        else {
            const { result: _result, caseTagList: _caseTagList } = await cb.runSuite(testId as number, silent, runOpts);
            result = _result;
            caseTagList = _caseTagList;
        }

        if (result) {
            // set reporter settings
            const reporterOpt: IReporterOptions = {
                method: 'saveTestRunResults',
                targetFolder: 'results',
                cwd: undefined,
                timeSuffix: reportFileSuffix && reportFileSuffix === 'time',
                customSuffix: reportFileSuffix && reportFileSuffix === 'id' ? testId as string : undefined,
                caseTagList: caseTagList as any[] | undefined,
            };

            if (folder) {
                if (fs.existsSync(folder)) {
                    reporterOpt.targetFolder = folder;
                    reporterOpt.cwd = folder;
                }
                else {
                    console.error(`Folder "${folder}" does not exist`); // eslint-disable-line @typescript-eslint/restrict-template-expressions
                    helper.finishCLI(failOnErrors);
                }
            }
            else {
                reporterOpt.targetFolder = cwd;
                reporterOpt.cwd = cwd;
            }

            const reporter = helper.getReporterInstance(reportFormat, reporterOpt);
            const reportFilePath = reporter.generate(result);
            console.log(`The report is ready: ${reportFilePath}`);

            helper.finishCLI(failOnErrors, result);
        }
        else {
            console.log('No results received from the server');
        }
    }
    catch (e: any) {
        let msg = 'Test execution failed:';
        if (e && e.message){
            msg += ` ${  e.message}`;
        }
        console.error(msg);
        console.error(e);
        helper.finishCLI(failOnErrors);
    }
}
