import path from 'path';
import { getGitInfo } from '../lib/git';
import * as out from '../lib/output';

export default function(dir?: string) {
    const info = getGitInfo(path.resolve(dir || process.cwd()));

    const lines = info.isGitRepo
        ? [
            `Repository: ${info.httpsUrl || info.remoteUrl || 'no remote'}`,
            `Branch:     ${info.branch || 'detached HEAD'}`,
            ...info.warnings.map(w => `Warning:    ${w}`),
        ]
        : info.warnings;

    return out.success({ ...info }, lines.join('\n'));
}
