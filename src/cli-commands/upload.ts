import fs from 'fs';
import { CloudBeatService } from '../lib/CloudBeatService';
import * as DEFAULTS from '../lib/const/defaults';
import * as helper from '../lib/helper';
import { IReporterOptions } from '../types/IReporterOptions';

export default async function(projectId: string, artifactFilePath: string, apiKey: string, {
    debug = false,
    failOnErrors = true,
    host = undefined,
    cwd = process.cwd(),
}) {
    if (!projectId) {
        console.error('"projectId" argument must be specified.');
        helper.finishCLI(failOnErrors);
    }
    else if (!artifactFilePath) {
        console.error('"artifactFile" argument must be specified.');
        helper.finishCLI(failOnErrors);
    }
    else if (!apiKey) {
        console.error('"apiKey" argument must be specified.');
        helper.finishCLI(failOnErrors);
    }
    const cb = new CloudBeatService({
        apiBaseUrl: host,
        apiKey: apiKey,
    });

    try {
        await cb.uploadArtifact(projectId, artifactFilePath);
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
