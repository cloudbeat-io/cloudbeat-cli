import { CloudBeatService } from '../lib/CloudBeatService';
import * as helper from '../lib/helper';

export default async function(runId: string, apiKey: string, host = undefined, {
    failOnErrors = false,
    debug = false,
}) {
    if (!runId) {
        console.error('"runId" argument must be specified.');
        helper.finishCLI(failOnErrors);
    }
    const cb = new CloudBeatService({
        apiBaseUrl: host,
        apiKey: apiKey,
    });

    try {
        const result = await cb.getRunResult(runId);
        helper.finishCLI(failOnErrors, result);
    }
 catch (e: any) {
        let msg = 'Failed to get run result:';
        if(e && e.message){
            msg += ` ${e.message}`;
        }
        if(e && e.path){
            msg += ` Path: ${e.path}`;
        }
        console.log(msg);
        helper.finishCLI(failOnErrors);
    }
}
