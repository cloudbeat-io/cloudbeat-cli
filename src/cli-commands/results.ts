import fs from 'fs';
import path from 'path';
import { ResultApi } from '@cloudbeat/client/v1';
import { IAuth } from '../lib/config';
import * as out from '../lib/output';

/*
 * Commands for analyzing failed tests: what failed recently, why a case or suite failed last time,
 * and a failure-focused breakdown of a run (failed steps, errors, stack traces, logs).
 * Made for people and AI agents alike - with --json the full data is printed as one JSON document.
 */

const RESULTS_PATH = '/results/api/results';
const DEFAULT_LOG_LINES = 20;

// gives access to the API client's HTTP instance, which carries the API key and base URL
class ResultsClient extends ResultApi {
    async get(urlPath: string, params: Record<string, string | number | undefined> = {}): Promise<any> {
        const query = Object.entries(params)
            .filter(([, value]) => value !== undefined && value !== '')
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
            .join('&');
        const body = await this.instance.get(query ? `${urlPath}?${query}` : urlPath);
        return unwrap(body);
    }
}

// some API versions wrap the payload in { data: ... }
const unwrap = (body: any) =>
    body && typeof body === 'object' && !Array.isArray(body) && 'data' in body && Object.keys(body).length <= 3 ? body.data : body;

const client = (auth: IAuth) => new ResultsClient(auth.apiKey, auth.apiBaseUrl);

const failWithApiError = (what: string, e: any): never => {
    const status = out.httpStatus(e);
    if (status === 404) {
        const detail = typeof e?.response?.data === 'string' ? e.response.data : '';
        return out.fail(`${what}: not found${detail ? ` - ${detail}` : ''}`, 'not_found');
    }
    return out.fail(`${what}: ${out.errorMessage(e)}`, out.apiErrorCode(e));
};

// --- formatting helpers ---------------------------------------------------------------------------

const indent = (text: string, prefix: string) => text.split('\n').map(l => prefix + l).join('\n');

const stackText = (stacktrace: any): string | undefined => {
    if (!stacktrace) {
        return undefined;
    }
    if (typeof stacktrace === 'string') {
        return stacktrace;
    }
    if (Array.isArray(stacktrace)) {
        return stacktrace.map(s => (typeof s === 'string' ? s : JSON.stringify(s))).join('\n');
    }
    return JSON.stringify(stacktrace, undefined, 2);
};

// parse a FailureJson string field, or return an already parsed failure object
const asFailure = (failure: any) => {
    if (!failure) {
        return undefined;
    }
    if (typeof failure === 'string') {
        try {
            return JSON.parse(failure);
        }
        catch {
            return { message: failure };
        }
    }
    return failure;
};

const formatFailure = (failure: any, prefix: string, maxStackLines = 15): string => {
    failure = asFailure(failure);
    if (!failure) {
        return '';
    }
    const lines: string[] = [];
    const type = [failure.type, failure.subType].filter(Boolean).join(' / ');
    lines.push(`${prefix}Error: ${failure.message || '(no message)'}${type ? `  [${type}]` : ''}`);
    if (failure.location || failure.line) {
        lines.push(`${prefix}At:    ${failure.location || ''}${failure.line ? `:${failure.line}` : ''}`);
    }
    const stack = stackText(failure.stacktrace || failure.stackTrace);
    if (stack) {
        const stackLines = stack.split('\n').filter(l => l.trim());
        const shown = stackLines.slice(0, maxStackLines);
        lines.push(`${prefix}Stack:`);
        lines.push(indent(shown.join('\n'), `${prefix}  `));
        if (stackLines.length > shown.length) {
            lines.push(`${prefix}  ... ${stackLines.length - shown.length} more lines`);
        }
    }
    return lines.join('\n');
};

const isFailed = (status: any) => {
    const s = String(status ?? '').toUpperCase();
    return s === 'FAILED' || s === 'BROKEN' || s === '0' || s === '5';
};

const formatTime = (time: any) => {
    const n = Number(time);
    if (!n) {
        return '';
    }
    // log times are epoch milliseconds
    return new Date(n).toISOString().substring(11, 23);
};

// failed steps, depth first, with the path of parent steps/transactions that led to them
interface IFailedStep { path: string[]; step: any }
const collectFailedSteps = (steps: any[] | undefined, parents: string[] = [], acc: IFailedStep[] = []) => {
    for (const step of steps || []) {
        const name = step.name || step.transactionName || '(step)';
        const children = step.stepList || step.steps;
        if (isFailed(step.status) && (step.failure || !children || children.length === 0)) {
            acc.push({ path: parents, step });
        }
        collectFailedSteps(children, [...parents, name], acc);
    }
    return acc;
};

// --- results failures ---------------------------------------------------------------------------

export interface IResultsFailuresOptions {
    project?: string;
    hours?: string;
}

export const failures = async (auth: IAuth, opts: IResultsFailuresOptions) => {
    const hours = opts.hours ? parseInt(opts.hours, 10) : undefined;
    if (opts.hours && (!hours || hours <= 0)) {
        return out.fail('"--hours" must be a positive number.', 'invalid_args');
    }
    try {
        const list: any[] = (await client(auth).get(`${RESULTS_PATH}/failures`, { projectName: opts.project, hoursBack: hours })) || [];
        const human = list.length === 0
            ? `No failed tests in the last ${hours || 7 * 24} hours${opts.project ? ` in project "${opts.project}"` : ''}.`
            : [
                `Failed tests in the last ${hours || 7 * 24} hours (most recent failure per test):`,
                ...list.map(f => `  ${String(f.lastFailedAt || '').replace('T', ' ').substring(0, 19)}  ${(f.type || '').padEnd(5)}  ${f.name}${f.projectName ? `  [${f.projectName}]` : ''}`),
                '',
                'Details: cloudbeat-cli results last-failure "<name>" [--suite]',
            ].join('\n');
        return out.success({ failures: list }, human);
    }
    catch (e: any) {
        return failWithApiError('Failed to get recent failures', e);
    }
};

// --- results last-failure -----------------------------------------------------------------------

export interface IResultsLastFailureOptions {
    suite?: boolean;
    snapshots?: string;
}

// snapshots can be large: saved to files on request, never printed
const extractSnapshots = (items: any[], dir: string | undefined) => {
    const saved: string[] = [];
    items.forEach((item, i) => {
        for (const [key, label] of [['errorSnapshot', 'failure'], ['baselineSnapshot', 'baseline']]) {
            const content = item[key];
            if (!content) {
                continue;
            }
            if (dir) {
                fs.mkdirSync(dir, { recursive: true });
                const file = path.resolve(dir, `${items.length > 1 ? `${i + 1}-` : ''}${label}-snapshot.txt`);
                fs.writeFileSync(file, content);
                saved.push(file);
                item[`${key}File`] = file;
            }
            item[`has${key[0].toUpperCase()}${key.substring(1)}`] = true;
            delete item[key];
        }
    });
    return saved;
};

export const lastFailure = async (auth: IAuth, name: string, opts: IResultsLastFailureOptions) => {
    if (!name) {
        return out.fail('Test case or suite name must be specified.', 'invalid_args');
    }
    const kind = opts.suite ? 'suite' : 'case';
    try {
        const params = opts.suite ? { suiteName: name } : { caseName: name };
        const data = await client(auth).get(`${RESULTS_PATH}/${kind}/last/failure`, params);
        const items: any[] = (Array.isArray(data) ? data : [data]).filter(Boolean);
        const saved = extractSnapshots(items, opts.snapshots);

        const human: string[] = [`Last failure of ${kind} "${name}":`];
        if (items.length === 0) {
            human.push('  No failed steps with details were found.');
        }
        items.forEach((item, i) => {
            if (items.length > 1) {
                human.push('', `  Failure ${i + 1}:`);
            }
            human.push(formatFailure(item.failureResult || item.failure, '  ') || '  (no failure details)');
        });
        if (saved.length) {
            human.push('', 'Snapshots saved:', ...saved.map(f => `  ${f}`));
        }
        return out.success({ type: kind, name, failures: items, snapshotFiles: saved }, human.join('\n'));
    }
    catch (e: any) {
        return failWithApiError(`Failed to get the last failure of ${kind} "${name}"`, e);
    }
};

// --- results run --------------------------------------------------------------------------------

export interface IResultsRunOptions {
    logs?: string;
    all?: boolean;
}

export const run = async (auth: IAuth, runId: string, opts: IResultsRunOptions) => {
    if (!runId) {
        return out.fail('Run id must be specified.', 'invalid_args');
    }
    const logLines = opts.logs !== undefined ? parseInt(opts.logs, 10) : DEFAULT_LOG_LINES;
    if (isNaN(logLines) || logLines < 0) {
        return out.fail('"--logs" must be 0 or a positive number.', 'invalid_args');
    }

    let result: any;
    try {
        result = await client(auth).get(`${RESULTS_PATH}/run/${encodeURIComponent(runId)}`);
    }
    catch (e: any) {
        return failWithApiError(`Failed to get the result of run ${runId}`, e);
    }
    if (!result) {
        return out.fail(`The result of run ${runId} is not available yet (the run may still be in progress).`, 'not_ready');
    }
    // the run result may be nested under "result"
    const summary = result.result && !result.instances ? result.result : result;
    const instances: any[] = result.instances || summary.instances || summary.instanceList || [];

    const report: any = {
        runId,
        name: summary.testName || summary.name,
        status: summary.status,
        startTime: summary.startTime,
        endTime: summary.endTime,
        iterations: {
            total: summary.iterationsTotal,
            passed: summary.iterationsPassed,
            failed: summary.iterationsFailed,
            skipped: summary.iterationsSkipped,
            warning: summary.iterationsWarning,
        },
        failures: [] as any[],
    };

    const human: string[] = [];
    human.push(`Run ${runId}: ${report.name || ''}`.trim());
    human.push(`Status: ${report.status ?? '?'}  |  iterations: ${report.iterations.total ?? '?'} total, ${report.iterations.passed ?? '?'} passed, ${report.iterations.failed ?? '?'} failed`);

    for (const inst of instances) {
        const where = [inst.locationName, [inst.browserName, inst.browserVersion].filter(Boolean).join(' '), inst.deviceName].filter(Boolean).join(', ');
        const instanceFailure = asFailure(inst.failureJson);
        const iterations: any[] = inst.iterationList || [];
        const failedIterations = opts.all ? iterations : iterations.filter(it => isFailed(it.status));

        if (instanceFailure) {
            // runner level failure, e.g. the test never started or results could not be processed
            report.failures.push({ instanceId: inst.id, location: where, runnerFailure: instanceFailure, consoleOutput: inst.consoleOutput });
            human.push('', `Runner failure${where ? ` (${where})` : ''}:`, formatFailure(instanceFailure, '  '));
            if (inst.consoleOutput) {
                const lines = String(inst.consoleOutput).split('\n');
                human.push('  Console output (last 30 lines):', indent(lines.slice(-30).join('\n'), '    '));
            }
        }

        for (const it of failedIterations) {
            const failedSteps = collectFailedSteps(it.stepList);
            const logs: any[] = it.logList || [];
            const shownLogs = logLines > 0 ? logs.slice(-logLines) : [];
            const failure = asFailure(it.failure);

            report.failures.push({
                case: it.displayName || it.caseName,
                caseId: it.caseId,
                iteration: it.iterationNum,
                status: it.status,
                location: where,
                failure,
                failedSteps: failedSteps.map(f => ({
                    path: f.path,
                    step: f.step.name,
                    status: f.step.status,
                    duration: f.step.duration,
                    failure: asFailure(f.step.failure),
                    screenshot: f.step.screenshotFilename || undefined,
                    logs: f.step.logs && f.step.logs.length ? f.step.logs : undefined,
                })),
                logs: shownLogs,
                logsTotal: logs.length,
                context: it.context || undefined,
            });

            human.push('', `✗ ${it.displayName || it.caseName} - iteration ${it.iterationNum ?? '?'} ${it.status}${where ? `  (${where})` : ''}`);
            if (failure && !failedSteps.some(f => asFailure(f.step.failure)?.message === failure.message)) {
                human.push(formatFailure(failure, '    '));
            }
            for (const f of failedSteps) {
                const trail = [...f.path, f.step.name].join(' › ');
                human.push(`  Failed step: ${trail}`);
                const stepFailure = formatFailure(f.step.failure, '    ');
                if (stepFailure) {
                    human.push(stepFailure);
                }
            }
            if (shownLogs.length) {
                human.push(`  Log (last ${shownLogs.length} of ${logs.length}):`);
                for (const l of shownLogs) {
                    human.push(`    ${formatTime(l.time)} ${String(l.level || '').padEnd(5)} ${l.message}`);
                }
            }
        }
    }

    if (report.failures.length === 0) {
        human.push('', instances.length ? 'No failed iterations.' : 'No instance details were returned for this run.');
    }
    return out.success({ result: report }, human.join('\n'));
};
