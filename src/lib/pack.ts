import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { listGitFiles } from './git';

export const CB_IGNORE_FILE = '.cbignore';

// never uploaded, regardless of .gitignore / .cbignore content
const ALWAYS_EXCLUDED = [
    '.git/', 'node_modules/', '.cloudbeat/', '.claude/', '.idea/', '.vscode/', '.vs/',
    '__pycache__/', '.pytest_cache/', '.venv/', 'venv/',
    '.env', '.env.*', '*.pem', '*.key', '.DS_Store',
];

// used only when the directory is not a Git repository, hence there is no .gitignore to rely on
const NON_GIT_EXCLUDED = [
    'target/', 'build/', 'dist/', 'out/', 'bin/', 'obj/',
    'test-results/', 'playwright-report/', 'allure-results/', 'coverage/',
];

export interface IPackResult {
    zipPath: string;
    fileCount: number;
    sizeBytes: number;
    usedGitIgnore: boolean;
}

/*
 * Minimal ignore pattern support:
 *   "name/"  - directory with this name at any depth
 *   "a/b/"   - directory at this path relative to the root
 *   "*.ext" / "name" / ".env.*" - file (or directory) name at any depth, "*" wildcard supported
 *   "a/b.txt" - path relative to the root, "*" wildcard supported
 */
export const createIgnoreMatcher = (patterns: string[]) => {
    const toRegex = (glob: string) => new RegExp(`^${glob.split('*').map(x => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')}$`);

    const rules = patterns
        .map(x => x.trim())
        .filter(x => x && !x.startsWith('#'))
        .map(x => {
            const dirOnly = x.endsWith('/');
            const body = x.replace(/^\//, '').replace(/\/$/, '');
            return { dirOnly, anchored: body.includes('/'), regex: toRegex(body) };
        });

    return (relPath: string): boolean => {
        const segments = relPath.split('/');
        return rules.some(rule => {
            if (rule.anchored) {
                // match the path itself or any of its parent directories
                for (let i = 1; i <= segments.length; i++) {
                    const isDir = i < segments.length;
                    if ((!rule.dirOnly || isDir) && rule.regex.test(segments.slice(0, i).join('/'))) {
                        return true;
                    }
                }
                return false;
            }
            return segments.some((segment, i) => {
                const isDir = i < segments.length - 1;
                return (!rule.dirOnly || isDir) && rule.regex.test(segment);
            });
        });
    };
};

const walk = (rootDir: string, relDir: string, isIgnored: (p: string) => boolean, result: string[]) => {
    for (const entry of fs.readdirSync(path.join(rootDir, relDir), { withFileTypes: true })) {
        const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            // probe with a fake child, so that directory-only rules are evaluated
            if (!isIgnored(`${relPath}/x`)) {
                walk(rootDir, relPath, isIgnored, result);
            }
        }
        else if (entry.isFile() && !isIgnored(relPath)) {
            result.push(relPath);
        }
    }
};

// includeIgnored - pack git-ignored files as well (e.g. when packing build output)
export const listPackFiles = (dir: string, includeIgnored = false): { files: string[]; usedGitIgnore: boolean } => {
    const patterns = [...ALWAYS_EXCLUDED];
    const cbIgnorePath = path.join(dir, CB_IGNORE_FILE);
    if (fs.existsSync(cbIgnorePath)) {
        patterns.push(...fs.readFileSync(cbIgnorePath, 'utf8').split(/\r?\n/));
    }

    if (includeIgnored) {
        const allFiles: string[] = [];
        walk(dir, '', createIgnoreMatcher(patterns), allFiles);
        return { files: allFiles, usedGitIgnore: false };
    }

    const gitFiles = listGitFiles(dir);
    if (gitFiles) {
        const isIgnored = createIgnoreMatcher(patterns);
        const notIgnored = gitFiles.filter(f => !isIgnored(f) && fs.existsSync(path.join(dir, f)) && fs.statSync(path.join(dir, f)).isFile());
        return { files: notIgnored, usedGitIgnore: true };
    }

    const files: string[] = [];
    walk(dir, '', createIgnoreMatcher([...patterns, ...NON_GIT_EXCLUDED]), files);
    return { files, usedGitIgnore: false };
};

export const packDirectory = async (dir: string, zipPath: string, includeIgnored = false): Promise<IPackResult> => {
    const rootDir = path.resolve(dir);
    if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
        throw new Error(`Directory not found: ${rootDir}`);
    }
    const absZipPath = path.resolve(zipPath);
    const { files, usedGitIgnore } = listPackFiles(rootDir, includeIgnored);
    const toPack = files.filter(f => path.join(rootDir, f) !== absZipPath);
    if (toPack.length === 0) {
        throw new Error(`No files to pack in ${rootDir}${includeIgnored ? '' : ' - if the files are git-ignored (e.g. build output), use "--all"'}`);
    }

    fs.mkdirSync(path.dirname(absZipPath), { recursive: true });

    await new Promise<void>((resolve, reject) => {
        const output = fs.createWriteStream(absZipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });
        output.on('close', () => resolve());
        output.on('error', reject);
        archive.on('error', reject);
        archive.pipe(output);
        toPack.sort().forEach(f => archive.file(path.join(rootDir, f), { name: f }));
        archive.finalize();
    });

    return { zipPath: absZipPath, fileCount: toPack.length, sizeBytes: fs.statSync(absZipPath).size, usedGitIgnore };
};
