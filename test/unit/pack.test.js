const { execFileSync } = require('child_process');
const fs = require('fs');
const assert = require('node:assert');
const { describe, it, before, after } = require('node:test');
const os = require('os');
const path = require('path');
const { createIgnoreMatcher, listPackFiles, packDirectory } = require('../../build/lib/pack');

const write = (root, relPath, content = 'x') => {
    fs.mkdirSync(path.dirname(path.join(root, relPath)), { recursive: true });
    fs.writeFileSync(path.join(root, relPath), content);
};

describe('createIgnoreMatcher', () => {
    const isIgnored = createIgnoreMatcher(['node_modules/', '*.log', '.env', '.env.*', 'docs/internal/', 'config/secret.json', '# comment', '']);

    it('matches directories at any depth', () => {
        assert.ok(isIgnored('node_modules/a/index.js'));
        assert.ok(isIgnored('packages/x/node_modules/a.js'));
        assert.ok(!isIgnored('node_modules'), 'a file named like the directory is not matched by a directory rule');
    });

    it('matches file name globs at any depth', () => {
        assert.ok(isIgnored('debug.log'));
        assert.ok(isIgnored('logs/run/debug.log'));
        assert.ok(isIgnored('.env'));
        assert.ok(isIgnored('app/.env.production'));
        assert.ok(!isIgnored('environment.ts'));
    });

    it('matches anchored paths only from the root', () => {
        assert.ok(isIgnored('docs/internal/plan.md'));
        assert.ok(!isIgnored('x/docs/internal/plan.md'));
        assert.ok(isIgnored('config/secret.json'));
        assert.ok(!isIgnored('config/public.json'));
    });
});

describe('listPackFiles / packDirectory', () => {
    let root;

    before(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-cli-pack-'));
        write(root, 'tests/a.spec.ts');
        write(root, 'package.json', '{}');
        write(root, '.env', 'SECRET=1');
        write(root, 'certs/server.key');
        write(root, 'node_modules/x/index.js');
        write(root, 'report/index.html');
        write(root, 'docs/readme.md');
        write(root, '.claude/commands/cloudbeat.md');
        write(root, '.cloudbeat/setup.md');
        write(root, '.gitignore', 'report/\n');
        write(root, '.cbignore', 'docs/\n');
    });

    after(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('outside of a repository: applies built-in exclusions and .cbignore', () => {
        const { files, usedGitIgnore } = listPackFiles(root);
        assert.strictEqual(usedGitIgnore, false);
        assert.deepStrictEqual(files.sort(), ['.cbignore', '.gitignore', 'package.json', 'report/index.html', 'tests/a.spec.ts']);
    });

    it('inside a repository: honors .gitignore; --all brings git-ignored files back but never secrets', () => {
        execFileSync('git', ['init', '-q'], { cwd: root });
        const normal = listPackFiles(root);
        assert.strictEqual(normal.usedGitIgnore, true);
        assert.ok(!normal.files.includes('report/index.html'));
        assert.ok(normal.files.includes('tests/a.spec.ts'));

        const all = listPackFiles(root, true).files;
        assert.ok(all.includes('report/index.html'));
        for (const forbidden of ['.env', 'certs/server.key', 'node_modules/x/index.js', '.claude/commands/cloudbeat.md', '.cloudbeat/setup.md', 'docs/readme.md']) {
            assert.ok(!all.includes(forbidden), `${forbidden} must not be packed`);
            assert.ok(!normal.files.includes(forbidden), `${forbidden} must not be packed`);
        }
    });

    it('git-ignored folder packs to nothing without --all, and hints at it', async () => {
        const zip = path.join(root, 'out.zip');
        await assert.rejects(packDirectory(path.join(root, 'report'), zip), /--all/);
        const result = await packDirectory(path.join(root, 'report'), zip, true);
        assert.strictEqual(result.fileCount, 1);
        assert.ok(fs.statSync(zip).size > 0);
        fs.unlinkSync(zip);
    });

    it('does not include the archive in itself', async () => {
        const zip = path.join(root, 'self.zip');
        fs.writeFileSync(zip, 'old');
        const result = await packDirectory(root, zip, true);
        const expected = listPackFiles(root, true).files.filter(f => f !== 'self.zip').length;
        assert.strictEqual(result.fileCount, expected);
        fs.unlinkSync(zip);
    });
});
