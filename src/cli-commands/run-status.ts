import { CloudBeatService } from '../lib/CloudBeatService';
import * as helper from '../lib/helper';

export default async function(runId: string, apiKey: string, {
    host = undefined,
    failOnErrors = true,
    debug = false,
}) {
    if (!runId) {
        console.error('"runId" argument must be specified.');
        helper.finishCLI(failOnErrors);
    }
    const cb = new CloudBeatService({
        host: host,
        apiKey: apiKey,
    });

    try {
        await cb.getRunStatus(runId);
        helper.finishCLI(failOnErrors);
    }
 catch (e: any) {
        console.error(`Failed to get run status: ${e.message}`);
        helper.finishCLI(failOnErrors);
    }
}
