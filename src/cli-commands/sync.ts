import fs from 'fs';
import { CloudBeatService } from '../lib/CloudBeatService';
import * as DEFAULTS from '../lib/const/defaults';
import * as helper from '../lib/helper';
import { IReporterOptions } from '../types/IReporterOptions';

export default async function(
    projectNameOrId: any,
    filePath: string,
    apiKey: string,
    apiBaseUrl?: string,
    failOnErrors = true,
) {
    if (!filePath) {
        console.error('"filePath" argument must be specified.');
        helper.finishCLI(failOnErrors, false);
    }
    else if (!projectNameOrId) {
        console.error('"project" argument must be specified.');
        helper.finishCLI(failOnErrors, false);
    }
    if (!apiKey) {
        console.error('"apiKey" argument must be specified.');
        helper.finishCLI(failOnErrors, false);
    }
    const cb = new CloudBeatService({
        apiBaseUrl: apiBaseUrl,
        apiKey: apiKey,
    });

    try {
        if (isNaN(projectNameOrId as number)) {
            await cb.uploadProjectArtifactsByName(projectNameOrId, filePath);
        }
        else {
            await cb.uploadProjectArtifactsById(projectNameOrId as number, filePath);
        }
        helper.finishCLI(failOnErrors, true);
    }
    catch (e: any) {
        let msg = 'Artifacts upload and synchronization failed:';
        if (e && e.message){
            msg += ` ${  e.message}`;
        }
        console.error(msg);
        console.error(e);
        helper.finishCLI(failOnErrors, false);
    }
}
