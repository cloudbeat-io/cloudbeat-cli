import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import { ResultApi } from '@cloudbeat/client/v1';
import { IAuth } from '../lib/config';
import * as out from '../lib/output';

/*
 * Commands for analyzing failed tests: what failed recently, why a case or suite failed last time,
 * a failure-focused breakdown of a run or result, every step and log line of one iteration,
 * and the run history of a case.
 * Made for people and AI agents alike - with --json the full data is printed as one JSON document.
 */

const RESULTS_PATH = '/results/api/results';
const DEFAULT_LOG_LINES = 20;
// shown when an endpoint added for AI analysis is missing on an older CloudBeat server
const NEEDS_NEWER_SERVER = 'this command needs a CloudBeat version with the results API for AI analysis';

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

const failWithApiError = (what: string, e: any, notFoundHint?: string): never => {
    const status = out.httpStatus(e);
    if (status === 404) {
        const detail = typeof e?.response?.data === 'string' ? e.response.data : '';
        const hint = !detail && notFoundHint ? ` (if the id is right, ${notFoundHint})` : '';
        return out.fail(`${what}: not found${detail ? ` - ${detail}` : ''}${hint}`, 'not_found');
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
        // the location often includes the line already (file:line:column)
        const location = String(failure.location || '');
        const line = failure.line && !location.includes(`:${failure.line}`) ? `:${failure.line}` : '';
        lines.push(`${prefix}At:    ${location}${line}`);
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
                ...list.map(f => `  ${String(f.lastFailedAt || '').replace('T', ' ').substring(0, 19)}  ${(f.type || '').padEnd(5)}  ${f.name}${f.projectName ? `  [${f.projectName}]` : ''}${f.resultId ? `  result ${f.resultId}` : ''}`),
                '',
                list.some(f => f.resultId)
                    ? 'Details: cloudbeat-cli results show <resultId>'
                    : 'Details: cloudbeat-cli results last-failure "<name>" [--suite]',
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

const parseLogLines = (logs: string | undefined) => {
    const logLines = logs !== undefined ? parseInt(logs, 10) : DEFAULT_LOG_LINES;
    if (isNaN(logLines) || logLines < 0) {
        return out.fail('"--logs" must be 0 or a positive number.', 'invalid_args');
    }
    return logLines;
};

export const run = async (auth: IAuth, runId: string, opts: IResultsRunOptions) => {
    if (!runId) {
        return out.fail('Run id must be specified.', 'invalid_args');
    }
    const logLines = parseLogLines(opts.logs);

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
    return renderResult(result, `Run ${runId}`, { runId }, logLines, !!opts.all);
};

// --- results show -------------------------------------------------------------------------------

export const show = async (auth: IAuth, resultId: string, opts: IResultsRunOptions) => {
    if (!/^\d+$/.test(resultId || '')) {
        return out.fail('Result id must be a number (see "results failures").', 'invalid_args');
    }
    const logLines = parseLogLines(opts.logs);

    let result: any;
    try {
        result = await client(auth).get(`${RESULTS_PATH}/${resultId}`);
    }
    catch (e: any) {
        return failWithApiError(`Failed to get result ${resultId}`, e, NEEDS_NEWER_SERVER);
    }
    if (!result) {
        return out.fail(`Result ${resultId} was not found.`, 'not_found');
    }
    return renderResult(result, `Result ${resultId}`, { resultId: Number(resultId) }, logLines, !!opts.all);
};

// failure breakdown of a result as returned by api/results/run/{runId} and api/results/{id}
const renderResult = (result: any, label: string, ids: object, logLines: number, all: boolean) => {
    // the API returns { result, instances, cases }: the summary is under "result"
    const summary = result.result || result;
    const instances: any[] = result.instances || summary.instances || summary.instanceList || [];
    // the summary has no status field, it follows from the iteration counts
    const status = summary.status ?? (summary.iterationsTotal !== undefined ? (summary.iterationsFailed > 0 ? 'FAILED' : 'PASSED') : undefined);

    const report: any = {
        ...ids,
        resultId: summary.id,
        runId: summary.runId || (ids as any).runId,
        name: summary.testName || summary.name,
        project: summary.projectName,
        environment: summary.environmentName,
        status,
        startTime: summary.startDate || summary.startTime,
        endTime: summary.endDate || summary.endTime,
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
    human.push(`${label}: ${report.name || ''}`.trim());
    human.push(`Status: ${report.status ?? '?'}  |  iterations: ${report.iterations.total ?? '?'} total, ${report.iterations.passed ?? '?'} passed, ${report.iterations.failed ?? '?'} failed`);

    for (const inst of instances) {
        const where = [inst.locationName, [inst.browserName, inst.browserVersion].filter(Boolean).join(' '), inst.deviceName].filter(Boolean).join(', ');
        const instanceFailure = asFailure(inst.failureJson);
        const iterations: any[] = inst.iterationList || [];
        const failedIterations = all ? iterations : iterations.filter(it => isFailed(it.status));

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
                iterationId: it.id,
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

            human.push('', `✗ ${it.displayName || it.caseName} - iteration ${it.iterationNum ?? '?'} ${it.status}${where ? `  (${where})` : ''}${it.id ? `  [iteration id ${it.id}]` : ''}`);
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
    else if (report.failures.some((f: any) => f.iterationId)) {
        human.push('', 'All steps and logs of an iteration: cloudbeat-cli results iteration <iteration id>');
    }
    return out.success({ result: report }, human.join('\n'));
};

// --- results iteration --------------------------------------------------------------------------

export interface IResultsIterationOptions {
    screenshots?: string;
}

const statusMark = (status: any) => {
    const s = String(status ?? '').toUpperCase();
    if (isFailed(s)) {
        return '✗';
    }
    if (s === 'PASSED' || s === '1') {
        return '✓';
    }
    if (s === 'SKIPPED' || s === '2') {
        return '-';
    }
    if (s === 'WARNING' || s === '4') {
        return '!';
    }
    return '?';
};

// the step tree, one line per step, with the failure under the step that failed
const formatStepTree = (steps: any[] | undefined, depth: number, lines: string[]) => {
    for (const step of steps || []) {
        const prefix = '  '.repeat(depth + 1);
        lines.push(`${prefix}${statusMark(step.status)} ${step.name || step.transactionName || '(step)'}`);
        const failure = formatFailure(step.failure, `${prefix}    `);
        if (failure) {
            lines.push(failure);
        }
        for (const l of step.logs || []) {
            if (['error', 'warn'].includes(String(l.level).toLowerCase())) {
                lines.push(`${prefix}    [${l.level}] ${l.message}`);
            }
        }
        formatStepTree(step.stepList || step.steps, depth + 1, lines);
    }
};

// screenshots of failed steps, and the iteration's own image attachments
const collectScreenshots = (iter: any) => {
    const urls: { url: string; name: string }[] = [];
    const add = (url: string | undefined, name: string) => {
        if (url && /^https?:\/\//i.test(url) && !urls.some(u => u.url === url)) {
            urls.push({ url, name });
        }
    };
    const walk = (steps: any[] | undefined) => {
        for (const step of steps || []) {
            if (isFailed(step.status)) {
                add(step.screenshotFilename, `step-${step.id}`);
                for (const a of step.attachments || []) {
                    if (String(a.mimeType || '').startsWith('image/') || /screenshot/i.test(String(a.type))) {
                        add(a.url, `step-${step.id}-${a.id}`);
                    }
                }
            }
            walk(step.stepList || step.steps);
        }
    };
    walk(iter.stepList);
    for (const a of iter.attachments || []) {
        if (String(a.mimeType || '').startsWith('image/') || /screenshot/i.test(String(a.type))) {
            add(a.url, `iteration-${a.id}`);
        }
    }
    return urls;
};

// plain GET of a file url, following redirects
const httpGet = (url: string, redirects = 3): Promise<Buffer> => new Promise((resolve, reject) => {
    const get = url.startsWith('https:') ? https.get : http.get;
    const req = get(url, res => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400 && res.headers.location && redirects > 0) {
            res.resume();
            resolve(httpGet(new URL(res.headers.location, url).toString(), redirects - 1));
            return;
        }
        if (status !== 200) {
            res.resume();
            reject(new Error(`HTTP ${status}`));
            return;
        }
        const chunks: Buffer[] = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
    });
    req.setTimeout(30000, () => req.destroy(new Error('timed out')));
    req.on('error', reject);
});

const downloadScreenshots = async (urls: { url: string; name: string }[], dir: string) => {
    fs.mkdirSync(dir, { recursive: true });
    const saved: string[] = [];
    const failed: string[] = [];
    for (const { url, name } of urls) {
        try {
            const ext = path.extname(new URL(url).pathname) || '.png';
            const file = path.resolve(dir, `${name}${ext}`);
            fs.writeFileSync(file, await httpGet(url));
            saved.push(file);
        }
        catch (e: any) {
            failed.push(`${url} (${e.message})`);
        }
    }
    return { saved, failed };
};

export const iteration = async (auth: IAuth, iterationId: string, opts: IResultsIterationOptions) => {
    if (!/^\d+$/.test(iterationId || '')) {
        return out.fail('Iteration id must be a number (shown by "results show" and "results run").', 'invalid_args');
    }
    let it: any;
    try {
        it = await client(auth).get(`${RESULTS_PATH}/iteration/${iterationId}`);
    }
    catch (e: any) {
        return failWithApiError(`Failed to get iteration ${iterationId}`, e, NEEDS_NEWER_SERVER);
    }
    if (!it) {
        return out.fail(`Iteration ${iterationId} was not found.`, 'not_found');
    }

    const screenshots = collectScreenshots(it);
    const downloaded = opts.screenshots ? await downloadScreenshots(screenshots, opts.screenshots) : undefined;

    const human: string[] = [];
    human.push(`${statusMark(it.status)} ${it.displayName || it.caseName} - iteration ${it.iterationNum ?? '?'} ${it.status ?? ''}`.trim());
    const failure = formatFailure(it.failure, '  ', 40);
    if (failure) {
        human.push(failure);
    }
    const params = it.context?.params;
    if (params && Object.keys(params).length) {
        human.push('', 'Parameters:');
        for (const [k, v] of Object.entries(params)) {
            human.push(`  ${k} = ${typeof v === 'string' ? v : JSON.stringify(v)}`);
        }
    }
    if (it.stepList?.length) {
        human.push('', 'Steps:');
        formatStepTree(it.stepList, 0, human);
    }
    const logs: any[] = it.logList || [];
    if (logs.length) {
        human.push('', `Log (${logs.length} lines):`);
        for (const l of logs) {
            human.push(`  ${formatTime(l.time)} ${String(l.level || '').padEnd(5)} ${l.message}`);
        }
    }
    const attachments: any[] = it.attachments || [];
    if (attachments.length) {
        human.push('', 'Attachments:');
        for (const a of attachments) {
            human.push(`  ${a.displayName || a.fileName || a.id}  ${a.url || ''}`.trimEnd());
        }
    }
    if (downloaded) {
        if (downloaded.saved.length) {
            human.push('', 'Screenshots saved:', ...downloaded.saved.map(f => `  ${f}`));
        }
        else if (screenshots.length === 0) {
            human.push('', 'No screenshots in this iteration.');
        }
        if (downloaded.failed.length) {
            human.push('', 'Screenshots that could not be downloaded:', ...downloaded.failed.map(f => `  ${f}`));
        }
    }
    else if (screenshots.length) {
        human.push('', `${screenshots.length} screenshot(s) available: add --screenshots <dir> to save them.`);
    }

    return out.success({
        iteration: it,
        screenshots: screenshots.map(s => s.url),
        screenshotFiles: downloaded?.saved,
        screenshotErrors: downloaded?.failed.length ? downloaded.failed : undefined,
    }, human.join('\n'));
};

// --- results history ----------------------------------------------------------------------------

export interface IResultsHistoryOptions {
    project?: string;
    limit?: string;
    days?: string;
}

export const history = async (auth: IAuth, caseName: string, opts: IResultsHistoryOptions) => {
    if (!caseName) {
        return out.fail('Test case name must be specified.', 'invalid_args');
    }
    const limit = opts.limit ? parseInt(opts.limit, 10) : undefined;
    if (opts.limit && (!limit || limit <= 0)) {
        return out.fail('"--limit" must be a positive number.', 'invalid_args');
    }
    const days = opts.days ? parseInt(opts.days, 10) : undefined;
    if (opts.days && (!days || days <= 0)) {
        return out.fail('"--days" must be a positive number.', 'invalid_args');
    }
    let list: any[];
    try {
        list = (await client(auth).get(`${RESULTS_PATH}/case/history`, { caseName, projectName: opts.project, limit, daysBack: days })) || [];
    }
    catch (e: any) {
        return failWithApiError(`Failed to get the history of case "${caseName}"`, e, NEEDS_NEWER_SERVER);
    }

    const human: string[] = [];
    if (list.length === 0) {
        human.push(`No runs of case "${caseName}" in the last ${days || 30} days${opts.project ? ` in project "${opts.project}"` : ''}.`);
    }
    else {
        const lastPass = list.find(h => !isFailed(h.status) && String(h.status).toUpperCase() !== 'SKIPPED');
        human.push(`Last ${list.length} runs of case "${caseName}" (newest first):`);
        for (const h of list) {
            const when = String(h.date || '').replace('T', ' ').substring(0, 19);
            const where = [h.suiteName, h.environmentName].filter(Boolean).join(', ');
            human.push(`  ${statusMark(h.status)} ${when}  ${String(h.status ?? '').padEnd(7)}  iteration ${h.iterationId}  result ${h.resultId}${where ? `  [${where}]` : ''}`);
            if (h.failureMessage) {
                human.push(`      ${h.failureMessage.split('\n')[0]}${h.failureLocation ? `  @ ${h.failureLocation}` : ''}`);
            }
        }
        human.push('', lastPass
            ? `Last passed: ${String(lastPass.date || '').replace('T', ' ').substring(0, 19)} (iteration ${lastPass.iterationId}).`
            : 'No passing run in this period.');
    }
    return out.success({ caseName, history: list }, human.join('\n'));
};

// --- results ai-data ----------------------------------------------------------------------------

export const aiData = async (auth: IAuth, resultId: string) => {
    if (!/^\d+$/.test(resultId || '')) {
        return out.fail('Result id must be a number (see "results failures").', 'invalid_args');
    }
    let text: any;
    try {
        text = await client(auth).get(`${RESULTS_PATH}/${resultId}/ai-data`);
    }
    catch (e: any) {
        return failWithApiError(`Failed to get the AI digest of result ${resultId}`, e, NEEDS_NEWER_SERVER);
    }
    text = typeof text === 'string' ? text : JSON.stringify(text, undefined, 2);
    return out.success({ resultId: Number(resultId), text }, text.trimEnd());
};
