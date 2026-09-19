const { execFileSync } = require('child_process');
const fs = require('fs');
const assert = require('node:assert');
const { describe, it, before, after } = require('node:test');
const os = require('os');
const path = require('path');
const { API_KEY, startMockApi } = require('./helpers/mock-api');
const { runCli } = require('./helpers/run-cli');

describe('cloudbeat-cli end to end', () => {
    let api;
    let tmpDir;
    let configDir;
    let projectDir;
    let env;

    const cli = (args, opts = {}) => runCli(args, { cwd: projectDir, ...opts, env: { ...env, ...(opts.env || {}) } });
    const lastRequest = (method, pathPattern) => [...api.state.requests].reverse().find(r => r.method === method && pathPattern.test(r.path));

    before(async () => {
        api = await startMockApi();
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-cli-e2e-'));
        configDir = path.join(tmpDir, 'config');
        projectDir = path.join(tmpDir, 'shop-e2e');
        env = { CB_CONFIG_DIR: configDir };

        fs.mkdirSync(path.join(projectDir, 'tests'), { recursive: true });
        fs.writeFileSync(path.join(projectDir, 'tests', 'a.spec.ts'), 'x');
        fs.writeFileSync(path.join(projectDir, 'package.json'), '{}');
        fs.writeFileSync(path.join(projectDir, '.env'), 'SECRET=1');
        const git = (...args) => execFileSync('git', ['-c', 'user.email=t@t.t', '-c', 'user.name=t', ...args], { cwd: projectDir, stdio: 'pipe' });
        git('init', '-q', '-b', 'main');
        git('remote', 'add', 'origin', 'git@github.com:acme/shop-e2e.git');
        git('add', 'tests', 'package.json');
        git('commit', '-q', '-m', 'init');
    });

    after(async () => {
        await api.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('prints its version', async () => {
        const r = await cli(['--version']);
        assert.strictEqual(r.code, 0);
        assert.match(r.stdout.trim(), /^\d+\.\d+\.\d+/);
    });

    it('whoami fails with not_logged_in before login', async () => {
        const r = await cli(['--json', 'whoami']);
        assert.strictEqual(r.code, 1);
        assert.strictEqual(r.json.code, 'not_logged_in');
    });

    it('commands requiring credentials fail with not_logged_in', async () => {
        const r = await cli(['--json', 'project', 'list']);
        assert.strictEqual(r.code, 1);
        assert.strictEqual(r.json.code, 'not_logged_in');
    });

    it('login rejects an invalid key and stores nothing', async () => {
        const r = await cli(['--json', '--apiBaseUrl', api.url, 'login', '--stdin'], { stdin: 'wrong-key\n' });
        assert.strictEqual(r.code, 1);
        assert.strictEqual(r.json.code, 'invalid_api_key');
        assert.ok(!fs.existsSync(path.join(configDir, 'config.json')));
    });

    it('login stores a verified key with owner-only permissions and never prints it', async () => {
        const r = await cli(['--json', '--apiBaseUrl', api.url, 'login', '--stdin'], { stdin: `${API_KEY}\n` });
        assert.strictEqual(r.code, 0, r.stdout + r.stderr);
        assert.strictEqual(r.json.verified, true);
        assert.ok(!r.stdout.includes(API_KEY), 'API key must be masked in the output');
        const configPath = path.join(configDir, 'config.json');
        assert.strictEqual(JSON.parse(fs.readFileSync(configPath, 'utf8')).apiKey, API_KEY);
        if (process.platform !== 'win32') {
            // eslint-disable-next-line no-bitwise
            assert.strictEqual(fs.statSync(configPath).mode & 0o777, 0o600);
        }
    });

    it('whoami reports the stored credentials', async () => {
        const r = await cli(['--json', 'whoami']);
        assert.strictEqual(r.code, 0);
        assert.strictEqual(r.json.source, 'config');
        assert.strictEqual(r.json.apiBaseUrl, api.url);
        assert.ok(!r.stdout.includes(API_KEY));
    });

    it('environment variables take precedence over the stored key', async () => {
        const r = await cli(['--json', 'whoami'], { env: { CB_API_KEY: 'other-key' } });
        assert.strictEqual(r.code, 1);
        assert.strictEqual(r.json.code, 'invalid_api_key');
    });

    it('project list returns ids', async () => {
        const r = await cli(['--json', 'project', 'list']);
        assert.strictEqual(r.code, 0);
        assert.deepStrictEqual(r.json.projects, [{ id: 7, name: 'Demo', type: 'Playwright' }]);
    });

    it('project create validates the type before calling the API', async () => {
        const requestCount = api.state.requests.length;
        const r = await cli(['--json', 'project', 'create', '--name', 'X', '--type', 'nope', '--sync', 'git']);
        assert.strictEqual(r.code, 1);
        assert.strictEqual(r.json.code, 'invalid_args');
        assert.strictEqual(api.state.requests.length, requestCount);
    });

    it('project create --sync git detects URL and branch, and reports the expected sync failure without credentials', async () => {
        const r = await cli(['--json', 'project', 'create', '--name', 'Shop E2E', '--type', 'playwright', '--sync', 'git', '--wait']);
        assert.strictEqual(r.code, 0, r.stdout + r.stderr);
        assert.strictEqual(r.json.ok, true);
        assert.strictEqual(r.json.type, 'Playwright');
        assert.deepStrictEqual(r.json.git, { url: 'https://github.com/acme/shop-e2e.git', branch: 'main', credentialsProvided: false });
        assert.strictEqual(r.json.sync.syncStatus, 'failure');

        const sent = lastRequest('POST', /\/projects\/api\/project$/).data;
        assert.deepStrictEqual(sent.settings, { type: 'Playwright', syncType: 'Git' });
        assert.deepStrictEqual(sent.gitSettings, { url: 'https://github.com/acme/shop-e2e.git', branchName: 'main' });
    });

    it('project create --git-auth takes the token from the environment and never echoes it', async () => {
        const r = await cli(
            ['--json', 'project', 'create', '--name', 'Shop E2E 2', '--type', 'Playwright', '--sync', 'git', '--git-auth', '--wait'],
            { env: { CB_GIT_TOKEN: 'ghp_supersecret' } },
        );
        assert.strictEqual(r.code, 0, r.stdout + r.stderr);
        assert.strictEqual(r.json.git.credentialsProvided, true);
        assert.strictEqual(r.json.sync.syncStatus, 'success');
        assert.ok(!(r.stdout + r.stderr).includes('ghp_supersecret'));
        assert.strictEqual(lastRequest('POST', /\/projects\/api\/project$/).data.gitSettings.token, 'ghp_supersecret');
    });

    it('project create --git-auth fails cleanly without a terminal or a token', async () => {
        const r = await cli(['--json', 'project', 'create', '--name', 'Y', '--type', 'Playwright', '--sync', 'git', '--git-auth']);
        assert.strictEqual(r.code, 1);
        assert.strictEqual(r.json.code, 'invalid_args');
    });

    it('project create --sync manual --dir uploads a packed archive', async () => {
        const r = await cli(['--json', 'project', 'create', '--name', 'Zip Project', '--type', 'Pytest', '--sync', 'manual', '--dir', '.', '--wait']);
        assert.strictEqual(r.code, 0, r.stdout + r.stderr);
        assert.strictEqual(r.json.uploadedFiles, 2);
        const req = lastRequest('POST', /\/projects\/api\/project$/);
        assert.strictEqual(req.data.settings.syncType, 'Manual');
        assert.strictEqual(req.data.gitSettings, undefined);
        assert.match(req.fileName, /\.zip$/);
    });

    it('server side validation messages reach the user', async () => {
        const r = await cli(['--json', 'project', 'create', '--name', 'NoUrl', '--type', 'TestNG', '--sync', 'git', '--dir', os.tmpdir()]);
        assert.strictEqual(r.code, 1);
        assert.strictEqual(r.json.ok, false);
    });

    it('project sync by name triggers Git synchronization and waits for a new status', async () => {
        const r = await cli(['--json', 'project', 'sync', 'Demo', '--wait']);
        assert.strictEqual(r.code, 0, r.stdout + r.stderr);
        assert.strictEqual(r.json.projectId, 7);
        assert.strictEqual(r.json.mode, 'git');
        assert.strictEqual(r.json.sync.syncDate, '2026-01-02T00:00:00');
        assert.ok(lastRequest('POST', /\/project\/7\/sync$/));
    });

    it('project sync of an unknown project fails', async () => {
        const r = await cli(['--json', 'project', 'sync', 'Does Not Exist']);
        assert.strictEqual(r.code, 1);
        assert.match(r.json.error, /not found/i);
    });

    it('pack --list never lists secrets', async () => {
        const r = await cli(['--json', 'pack', '--list']);
        assert.strictEqual(r.code, 0);
        assert.ok(r.json.files.includes('tests/a.spec.ts'));
        assert.ok(!r.json.files.includes('.env'));
    });

    it('init installs the wizard, keeps local edits, and --force restores them', async () => {
        const first = await cli(['--json', 'init']);
        assert.strictEqual(first.code, 0);
        assert.ok(first.json.created.includes(path.join('.claude', 'commands', 'cloudbeat.md')));
        assert.ok(first.json.created.some(f => f.endsWith(path.join('cloudbeat-setup', 'SKILL.md'))));

        const edited = path.join(projectDir, '.claude', 'commands', 'cloudbeat.md');
        fs.appendFileSync(edited, '\nlocal edit\n');
        const second = await cli(['--json', 'init']);
        assert.deepStrictEqual(second.json.created, []);
        assert.deepStrictEqual(second.json.skipped, [path.join('.claude', 'commands', 'cloudbeat.md')]);
        assert.ok(fs.readFileSync(edited, 'utf8').includes('local edit'));

        const forced = await cli(['--json', 'init', '--force']);
        assert.deepStrictEqual(forced.json.updated, [path.join('.claude', 'commands', 'cloudbeat.md')]);
        assert.ok(!fs.readFileSync(edited, 'utf8').includes('local edit'));
    });

    it('init rejects unsupported agents', async () => {
        const r = await cli(['--json', 'init', '--agent', 'unknown']);
        assert.strictEqual(r.code, 1);
        assert.strictEqual(r.json.code, 'invalid_args');
    });

    it('logout removes the stored key', async () => {
        const r = await cli(['--json', 'logout']);
        assert.strictEqual(r.json.removed, true);
        assert.strictEqual((await cli(['--json', 'whoami'])).json.code, 'not_logged_in');
    });
});
