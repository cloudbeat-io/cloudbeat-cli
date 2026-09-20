import fs from 'fs';
import os from 'os';
import path from 'path';
import { CreateProjectRequest, ProjectApi, ProjectSyncType } from '@cloudbeat/client/v1';
import { IAuth } from '../lib/config';
import { getGitInfo } from '../lib/git';
import * as out from '../lib/output';
import { packDirectory } from '../lib/pack';
import { ask, askSecret, isInteractive } from '../lib/prompt';

export const PROJECT_TYPES = [
    'Oxygen', 'CucumberOxygen', 'CucumberJava', 'TestNG', 'JUnit', 'KotlinTestNG', 'KotlinJUnit5',
    'MSTestBinary', 'NUnit3Binary', 'Playwright', 'CucumberJs', 'BellatrixJs', 'Cypress', 'Postman', 'Pytest',
];

const SYNC_TYPES: { [key: string]: ProjectSyncType } = { git: 'Git', manual: 'Manual', none: 'None' };

const SYNC_IN_PROGRESS = 'in progress';
const SYNC_FAILURE = 'failure';
const SYNC_POLL_INTERVAL = 3000;
const SYNC_TIMEOUT = 10 * 60 * 1000;

export interface IProjectCreateOptions {
    name?: string;
    type?: string;
    sync?: string;
    gitUrl?: string;
    gitBranch?: string;
    gitAuth?: boolean;
    dir?: string;
    file?: string;
    execCommand?: string;
    execOptions?: string;
    assemblyNames?: string;
    notes?: string;
    wait?: boolean;
    all?: boolean;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const waitForSync = async (api: ProjectApi, projectId: number, previousSyncDate?: string) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < SYNC_TIMEOUT) {
        const syncStatus = await api.getSyncStatus(projectId.toString());
        const isNewStatus = !previousSyncDate || syncStatus.syncDate !== previousSyncDate;
        if (isNewStatus && syncStatus.syncStatus && syncStatus.syncStatus !== SYNC_IN_PROGRESS) {
            return syncStatus;
        }
        await sleep(SYNC_POLL_INTERVAL);
    }
    throw new Error('Timed out waiting for project synchronization to finish.');
};

const finishWithSyncStatus = (data: object, syncStatus: { syncStatus?: string; message?: string; details?: string } | undefined, humanMessage: string) => {
    if (syncStatus && syncStatus.syncStatus === SYNC_FAILURE) {
        if (out.isJsonMode()) {
            // the main operation succeeded, but synchronization did not - let the caller decide what to do
            return out.success({ ...data, sync: syncStatus });
        }
        return out.fail(`${humanMessage}\nSynchronization failed: ${[syncStatus.message, syncStatus.details].filter(x => x).join(' ') || 'unknown reason'}`);
    }
    return out.success({ ...data, sync: syncStatus }, humanMessage);
};

// packs a directory into a temporary zip, or reads the provided zip
const getArtifacts = async (dir?: string, file?: string, includeIgnored = false): Promise<{ fileName: string; content: Buffer; fileCount?: number } | undefined> => {
    if (file) {
        if (!fs.existsSync(file)) {
            throw new Error(`Provided file not found: ${file}`);
        }
        return { fileName: path.basename(file), content: fs.readFileSync(file) };
    }
    if (dir) {
        const zipPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cb-pack-')), `${path.basename(path.resolve(dir)) || 'project'}.zip`);
        try {
            const packed = await packDirectory(dir, zipPath, includeIgnored);
            out.info(`Packed ${packed.fileCount} file(s), ${(packed.sizeBytes / 1024).toFixed(0)} KB.`);
            return { fileName: path.basename(zipPath), content: fs.readFileSync(zipPath), fileCount: packed.fileCount };
        }
        finally {
            fs.rmSync(path.dirname(zipPath), { recursive: true, force: true });
        }
    }
    return undefined;
};

export const list = async (auth: IAuth) => {
    try {
        const projects = await new ProjectApi(auth.apiKey, auth.apiBaseUrl).list();
        return out.success({ projects }, projects.map(p => `${p.id}\t${p.type}\t${p.name}`).join('\n') || 'No projects found.');
    }
    catch (e: any) {
        return out.fail(`Failed to list projects: ${out.errorMessage(e)}`);
    }
};

export const create = async (auth: IAuth, opts: IProjectCreateOptions) => {
    if (!opts.name) {
        return out.fail('"--name" option must be specified.', 'invalid_args');
    }
    const type = PROJECT_TYPES.find(t => t.toLowerCase() === (opts.type || '').toLowerCase());
    if (!type) {
        return out.fail(`"--type" must be one of: ${PROJECT_TYPES.join(', ')}`, 'invalid_args');
    }
    const syncType = SYNC_TYPES[(opts.sync || '').toLowerCase()];
    if (!syncType) {
        return out.fail('"--sync" must be one of: git, manual, none', 'invalid_args');
    }

    const request: CreateProjectRequest = {
        name: opts.name,
        type,
        notes: opts.notes,
        settings: {
            type,
            syncType,
            execCommand: opts.execCommand,
            execOptions: opts.execOptions,
            assemblyNames: opts.assemblyNames,
        },
    };

    try {
        if (syncType === 'Git') {
            // fall back to the repository of the current directory
            const gitInfo = !opts.gitUrl || !opts.gitBranch ? getGitInfo(opts.dir || process.cwd()) : undefined;
            const url = opts.gitUrl || gitInfo?.httpsUrl;
            if (!url) {
                return out.fail('Git repository URL could not be detected. Specify it using "--git-url".', 'invalid_args');
            }
            request.gitSettings = { url, branchName: opts.gitBranch || gitInfo?.branch };

            if (opts.gitAuth) {
                // credentials are either taken from the environment (CI) or asked interactively - never from command line arguments
                let userName = process.env.CB_GIT_USERNAME;
                let token = process.env.CB_GIT_TOKEN;
                if (!token) {
                    if (!isInteractive()) {
                        return out.fail('"--git-auth" requires an interactive terminal, or CB_GIT_TOKEN (and optionally CB_GIT_USERNAME) environment variables.', 'invalid_args');
                    }
                    userName = await ask(`Git username for ${url} (leave empty if using an access token only): `);
                    token = await askSecret('Git access token or password: ');
                }
                if (!token) {
                    return out.fail('Git access token was not provided.', 'invalid_args');
                }
                // CloudBeat stores either a token, or a username + password pair
                if (userName) {
                    request.gitSettings.userName = userName;
                    request.gitSettings.password = token;
                }
                else {
                    request.gitSettings.token = token;
                }
            }
        }

        const artifacts = syncType === 'Manual' ? await getArtifacts(opts.dir, opts.file, opts.all) : undefined;

        const api = new ProjectApi(auth.apiKey, auth.apiBaseUrl);
        const projectId = await api.create(request, artifacts?.fileName, artifacts?.content);

        const data = {
            projectId,
            name: request.name,
            type,
            syncType,
            git: request.gitSettings ? { url: request.gitSettings.url, branch: request.gitSettings.branchName, credentialsProvided: !!opts.gitAuth } : undefined,
            uploadedFiles: artifacts?.fileCount,
        };
        const humanMessage = `Project "${request.name}" created (id: ${projectId}).`;

        // synchronization is started by the backend upon creation for Git projects and for Manual projects with artifacts
        const syncStarted = syncType === 'Git' || (syncType === 'Manual' && !!artifacts);
        if (opts.wait && syncStarted) {
            out.info(`${humanMessage} Waiting for synchronization to finish...`);
            return finishWithSyncStatus(data, await waitForSync(api, projectId), humanMessage);
        }
        return out.success(data, humanMessage);
    }
    catch (e: any) {
        return out.fail(`Failed to create project: ${out.errorMessage(e)}`);
    }
};

export const resolveProjectId = async (api: ProjectApi, projectNameOrId: string): Promise<number> => {
    if (/^\d+$/.test(projectNameOrId)) {
        return parseInt(projectNameOrId, 10);
    }
    const matches = (await api.list()).filter(p => p.name.toLowerCase() === projectNameOrId.toLowerCase());
    if (matches.length !== 1) {
        throw new Error(matches.length === 0 ? `Project not found: ${projectNameOrId}` : `Multiple projects are named "${projectNameOrId}", use project id instead.`);
    }
    return matches[0].id;
};

export const status = async (auth: IAuth, projectNameOrId: string) => {
    try {
        const api = new ProjectApi(auth.apiKey, auth.apiBaseUrl);
        const projectId = await resolveProjectId(api, projectNameOrId);
        const syncStatus = await api.getSyncStatus(projectId.toString());
        return out.success(
            { projectId, sync: syncStatus },
            `Sync status: ${syncStatus.syncStatus || 'never synchronized'}${syncStatus.message ? ` - ${[syncStatus.message, syncStatus.details].filter(x => x).join(' ')}` : ''}`,
        );
    }
    catch (e: any) {
        return out.fail(`Failed to get project status: ${out.errorMessage(e)}`);
    }
};

// triggers Git synchronization, or uploads artifacts if "dir" or "file" is specified
export const sync = async (auth: IAuth, projectNameOrId: string, opts: { dir?: string; file?: string; wait?: boolean; all?: boolean }) => {
    try {
        const api = new ProjectApi(auth.apiKey, auth.apiBaseUrl);
        const projectId = await resolveProjectId(api, projectNameOrId);
        const previous = await api.getSyncStatus(projectId.toString());
        const artifacts = await getArtifacts(opts.dir, opts.file, opts.all);

        if (artifacts) {
            await api.uploadArtifacts(projectId.toString(), artifacts.fileName, artifacts.content);
        }
        else {
            await api.triggerSync(projectId.toString());
        }

        const data = { projectId, mode: artifacts ? 'upload' : 'git', uploadedFiles: artifacts?.fileCount };
        const humanMessage = artifacts ? 'Artifacts uploaded.' : 'Git synchronization started.';
        if (opts.wait) {
            out.info(`${humanMessage} Waiting for synchronization to finish...`);
            return finishWithSyncStatus(data, await waitForSync(api, projectId, previous.syncDate), humanMessage);
        }
        return out.success(data, humanMessage);
    }
    catch (e: any) {
        return out.fail(`Project synchronization failed: ${out.errorMessage(e)}`);
    }
};
