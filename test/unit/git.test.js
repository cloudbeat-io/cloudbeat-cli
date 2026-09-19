const { execFileSync } = require('child_process');
const fs = require('fs');
const assert = require('node:assert');
const { describe, it, before, after } = require('node:test');
const os = require('os');
const path = require('path');
const { getGitInfo, normalizeRemoteUrl } = require('../../build/lib/git');

const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.email=t@t.t', '-c', 'user.name=t', ...args], { cwd, stdio: 'pipe' });

describe('normalizeRemoteUrl', () => {
    it('converts scp-like SSH remotes to HTTPS', () => {
        const r = normalizeRemoteUrl('git@github.com:acme/e2e-tests.git');
        assert.strictEqual(r.httpsUrl, 'https://github.com/acme/e2e-tests.git');
        assert.strictEqual(r.isSsh, true);
    });

    it('converts ssh:// remotes and drops the port', () => {
        const r = normalizeRemoteUrl('ssh://git@gitlab.acme.test:2222/qa/tests.git');
        assert.strictEqual(r.httpsUrl, 'https://gitlab.acme.test/qa/tests.git');
        assert.strictEqual(r.isSsh, true);
    });

    it('strips credentials embedded in HTTPS remotes', () => {
        const r = normalizeRemoteUrl('https://user:ghp_secret@github.com/acme/tests.git');
        assert.strictEqual(r.httpsUrl, 'https://github.com/acme/tests.git');
        assert.strictEqual(r.cleanUrl, 'https://github.com/acme/tests.git');
        assert.strictEqual(r.hadCredentials, true);
        assert.ok(!JSON.stringify(r).includes('ghp_secret'));
    });

    it('keeps plain HTTPS remotes as is', () => {
        const r = normalizeRemoteUrl('https://dev.azure.com/acme/qa/_git/tests');
        assert.strictEqual(r.httpsUrl, 'https://dev.azure.com/acme/qa/_git/tests');
        assert.strictEqual(r.isSsh, false);
        assert.strictEqual(r.hadCredentials, false);
    });

    it('does not produce an HTTPS URL for local paths', () => {
        assert.strictEqual(normalizeRemoteUrl('/srv/git/tests.git').httpsUrl, undefined);
    });
});

describe('getGitInfo', () => {
    let tmpDir;

    before(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-cli-git-'));
    });

    after(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('reports a directory outside of a repository', () => {
        const dir = path.join(tmpDir, 'plain');
        fs.mkdirSync(dir);
        // make sure a repository above the temp folder cannot be picked up
        const info = getGitInfo(dir);
        if (!info.isGitRepo) {
            assert.deepStrictEqual(info.warnings, ['Directory is not inside a Git repository.']);
        }
    });

    it('detects remote, branch, sub-folder and uncommitted files, ignoring wizard folders', () => {
        const repo = path.join(tmpDir, 'repo');
        fs.mkdirSync(path.join(repo, 'e2e', '.claude'), { recursive: true });
        fs.mkdirSync(path.join(repo, '.cloudbeat'), { recursive: true });
        git(repo, 'init', '-q', '-b', 'feature/login');
        git(repo, 'remote', 'add', 'origin', 'git@github.com:acme/shop.git');
        fs.writeFileSync(path.join(repo, 'e2e', 'a.spec.ts'), 'x');
        git(repo, 'add', '-A');
        git(repo, 'commit', '-q', '-m', 'init');
        fs.writeFileSync(path.join(repo, 'e2e', 'b.spec.ts'), 'y');
        fs.writeFileSync(path.join(repo, 'e2e', '.claude', 'cmd.md'), 'wizard');
        fs.writeFileSync(path.join(repo, '.cloudbeat', 'setup.md'), 'state');

        const root = getGitInfo(repo);
        assert.strictEqual(root.isGitRepo, true);
        assert.strictEqual(root.branch, 'feature/login');
        assert.strictEqual(root.httpsUrl, 'https://github.com/acme/shop.git');
        assert.strictEqual(root.subDir, '');
        assert.strictEqual(root.hasUpstream, false);
        assert.strictEqual(root.unpushedCommits, undefined);
        assert.deepStrictEqual(root.uncommittedFiles, ['?? e2e/b.spec.ts']);
        assert.strictEqual(root.uncommittedChanges, 1);
        assert.ok(root.warnings.some(w => w.includes('no upstream')));
        assert.ok(root.warnings.some(w => w.includes('SSH')));

        const sub = getGitInfo(path.join(repo, 'e2e'));
        assert.strictEqual(sub.subDir, 'e2e');
        assert.ok(sub.warnings.some(w => w.includes('sub-folder')));
    });
});
