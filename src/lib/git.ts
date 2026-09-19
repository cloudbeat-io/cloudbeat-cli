import { execFileSync } from 'child_process';

export interface IGitInfo {
    isGitRepo: boolean;
    rootDir?: string;
    // path of the inspected directory relative to the repository root ('' if it is the root)
    subDir?: string;
    branch?: string;
    remoteName?: string;
    // remote URL as configured locally (with embedded credentials removed)
    remoteUrl?: string;
    // remote URL converted to HTTPS form, as expected by CloudBeat Git integration
    httpsUrl?: string;
    isSshRemote?: boolean;
    remoteUrlHadCredentials?: boolean;
    hasUpstream?: boolean;
    unpushedCommits?: number;
    // number of modified and untracked files, not counting the setup wizard's own folders
    uncommittedChanges?: number;
    // up to 50 of them, in "git status --porcelain" format
    uncommittedFiles?: string[];
    warnings: string[];
}

const git = (cwd: string, args: string[], trim = true): string | undefined => {
    try {
        const output = execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        return trim ? output.trim() : output;
    }
    catch (e) {
        return undefined;
    }
};

/*
 * Converts SSH style remotes to HTTPS and strips any embedded credentials:
 *   git@github.com:org/repo.git           -> https://github.com/org/repo.git
 *   ssh://git@host:2222/org/repo.git      -> https://host/org/repo.git
 *   https://user:token@host/org/repo.git  -> https://host/org/repo.git
 */
export const normalizeRemoteUrl = (url: string): { httpsUrl?: string; cleanUrl: string; isSsh: boolean; hadCredentials: boolean } => {
    const scpLike = /^(?:[^@/\s]+@)?([^:/\s]+):(?!\/\/)(.+)$/.exec(url);
    if (scpLike && !/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
        return { httpsUrl: `https://${scpLike[1]}/${scpLike[2]}`, cleanUrl: url, isSsh: true, hadCredentials: false };
    }
    try {
        const parsed = new URL(url);
        if (parsed.protocol === 'ssh:' || parsed.protocol === 'git:') {
            return { httpsUrl: `https://${parsed.hostname}${parsed.pathname}`, cleanUrl: url, isSsh: true, hadCredentials: false };
        }
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            const hadCredentials = !!(parsed.username || parsed.password);
            parsed.username = '';
            parsed.password = '';
            return { httpsUrl: parsed.toString(), cleanUrl: parsed.toString(), isSsh: false, hadCredentials };
        }
    }
    catch (e) {
        // not a parsable URL (e.g. a local path)
    }
    return { cleanUrl: url, isSsh: false, hadCredentials: false };
};

export const getGitInfo = (dir: string): IGitInfo => {
    const warnings: string[] = [];

    if (git(dir, ['rev-parse', '--is-inside-work-tree']) !== 'true') {
        return { isGitRepo: false, warnings: ['Directory is not inside a Git repository.'] };
    }

    const info: IGitInfo = { isGitRepo: true, warnings };
    info.rootDir = git(dir, ['rev-parse', '--show-toplevel']);
    info.subDir = (git(dir, ['rev-parse', '--show-prefix']) || '').replace(/\/$/, '');
    info.branch = git(dir, ['symbolic-ref', '--short', '-q', 'HEAD']) || undefined;

    if (!info.branch) {
        warnings.push('HEAD is detached - no current branch.');
    }
    if (info.subDir) {
        warnings.push(`Directory is a sub-folder ("${info.subDir}") of the repository. CloudBeat synchronizes the whole repository.`);
    }

    // prefer the remote tracked by the current branch, then "origin", then the first configured remote
    const upstream = git(dir, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
    info.hasUpstream = !!upstream;
    const remotes = (git(dir, ['remote']) || '').split('\n').filter(x => x);
    const upstreamRemote = upstream ? remotes.find(r => upstream.startsWith(`${r}/`)) : undefined;
    info.remoteName = upstreamRemote || (remotes.includes('origin') ? 'origin' : remotes[0]);

    if (!info.remoteName) {
        warnings.push('Repository has no remotes configured.');
        return info;
    }

    const rawUrl = git(dir, ['remote', 'get-url', info.remoteName]);
    if (rawUrl) {
        const normalized = normalizeRemoteUrl(rawUrl);
        info.remoteUrl = normalized.cleanUrl;
        info.httpsUrl = normalized.httpsUrl;
        info.isSshRemote = normalized.isSsh;
        info.remoteUrlHadCredentials = normalized.hadCredentials;
        if (normalized.isSsh) {
            warnings.push('Remote uses SSH. CloudBeat authenticates over HTTPS, so the URL was converted - verify it is correct.');
        }
        if (!normalized.httpsUrl) {
            warnings.push('Remote URL could not be converted to an HTTPS URL.');
        }
    }

    if (upstream) {
        info.unpushedCommits = parseInt(git(dir, ['rev-list', '--count', '@{u}..HEAD']) || '0', 10);
        if (info.unpushedCommits > 0) {
            warnings.push(`${info.unpushedCommits} local commit(s) are not pushed - CloudBeat will not see them.`);
        }
    }
    else if (info.branch) {
        warnings.push(`Branch "${info.branch}" has no upstream - it may not exist on the remote.`);
    }

    // wizard files are never uploaded and are not relevant for the synchronization
    const changedFiles = (git(dir, ['status', '--porcelain'], false) || '').split('\n')
        .filter(x => x && !/^.{3}"?(\.claude|\.cloudbeat)\//.test(x));
    info.uncommittedChanges = changedFiles.length;
    info.uncommittedFiles = changedFiles.slice(0, 50);
    if (info.uncommittedChanges > 0) {
        warnings.push(`${info.uncommittedChanges} uncommitted change(s) - CloudBeat will not see them.`);
    }

    return info;
};

// lists files which are either tracked or untracked-but-not-ignored, relative to "dir"
export const listGitFiles = (dir: string): string[] | undefined => {
    try {
        const out = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
            cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256 * 1024 * 1024,
        });
        return out.split('\0').filter(x => x);
    }
    catch (e) {
        return undefined;
    }
};
