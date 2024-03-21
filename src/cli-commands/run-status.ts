import { CloudBeatService } from '../lib/CloudBeatService';
import * as helper from '../lib/helper';

export default async function(runId: string, apiKey: string, {
    host = undefined,
    failOnErrors = true,
}) {
    if (!runId) {
        console.error('"runId" argument must be specified.');
        helper.finishCLI(failOnErrors, false);
    }
    const cb = new CloudBeatService({
        apiBaseUrl: host,
        apiKey: apiKey,
    });

    try {
        await cb.getRunStatus(runId);
        helper.finishCLI(failOnErrors, false);
    }
 catch (e: any) {
        console.error(`Failed to get run status: ${e.message}`);
        helper.finishCLI(failOnErrors, false);
    }
}
