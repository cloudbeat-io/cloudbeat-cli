import fs from 'fs';
import CloudBeatService from '../lib/CloudBeatService';
import * as DEFAULTS from '../lib/defaults';
import helper from '../lib/helper';

export default async function(testId, testType, apiKey, {
    host = null,
    cwd = process.cwd(),
    format = DEFAULTS.TEST_REPORT_FORMAT,
    folder = null,
    failOnErrors = true,
    debug = false
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
        host: host,
        apiKey: apiKey
    });

    try {
        let result = null;

        if (testType === 'case') {
            result = await cb.runCase(testId);
        } else if (testType === 'monitor') {
            result = await cb.runMonitor(testId);
        } else {
            result = await cb.runSuite(testId);
        }

        if (result) {
            // set reporter settings
            var reporterOpt = {
                method: 'saveTestRunResults',
                targetFolder: 'results'
            };

            if(folder){
                if (fs.existsSync(folder)) {
                    reporterOpt.targetFolder = folder;
                    reporterOpt.cwd = folder;
                } else {
                    console.error(`Folder "${folder}" did not exist`);
                    helper.finishCLI(failOnErrors);
                }
            } else {
                reporterOpt.targetFolder = cwd;
                reporterOpt.cwd = cwd;
            }
            
            const reporter = helper.getReporterInstance(format, reporterOpt);
            const reportFilePath = reporter.generate(result.data.data);
            console.log(`The report is ready: ${reportFilePath}`);

            helper.finishCLI(failOnErrors, result.data.data);
        }
    } catch (e) {
        let msg = 'Test execution failed:';
        if (e && e.message){
            msg += ' ' + e.message;
        }
        console.error(msg);
        console.error(e);
        helper.finishCLI(failOnErrors);
    }
}