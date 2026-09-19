const { spawn } = require('child_process');
const path = require('path');

const CLI_PATH = path.join(__dirname, '..', '..', '..', 'build', 'index.js');

// runs the built CLI and resolves with its exit code, stdout, stderr and parsed JSON output (if any)
function runCli(args, { cwd, env = {}, stdin } = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [CLI_PATH, ...args], {
            cwd,
            env: { ...process.env, CB_API_KEY: '', CB_API_URL: '', CB_GIT_TOKEN: '', CB_GIT_USERNAME: '', ...env },
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', d => stdout += d);
        child.stderr.on('data', d => stderr += d);
        child.on('error', reject);
        child.on('close', code => {
            let json;
            try {
                json = JSON.parse(stdout);
            }
            catch (e) {
                // not a JSON output
            }
            resolve({ code, stdout, stderr, json });
        });
        child.stdin.end(stdin || '');
    });
}

module.exports = { runCli };
