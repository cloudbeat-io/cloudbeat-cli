/*
 * Minimal stand-in for the CloudBeat Admin API endpoints used by the CLI.
 * Records every request, so tests can assert on what was sent.
 */
const http = require('http');

const API_KEY = 'test-key-0000-1111-2222';

function startMockApi() {
    const state = { projects: [{ id: 7, name: 'Demo', type: 'Playwright' }], sync: {}, requests: [], nextId: 100 };

    const server = http.createServer((req, res) => {
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => {
            const url = new URL(req.url, 'http://localhost');
            const body = Buffer.concat(chunks).toString('latin1');
            const jsonPart = (/name="data"[\s\S]*?\r\n\r\n([\s\S]*?)\r\n--/.exec(body) || [])[1];
            const fileName = (/name="file"; filename="([^"]+)"/.exec(body) || [])[1];
            const data = jsonPart ? JSON.parse(jsonPart) : undefined;
            state.requests.push({ method: req.method, path: url.pathname, data, fileName });

            const send = (code, payload) => {
                res.writeHead(code, { 'Content-Type': typeof payload === 'string' ? 'text/plain' : 'application/json' });
                res.end(typeof payload === 'string' ? payload : JSON.stringify(payload));
            };

            // the key must arrive as a header - never in the URL
            if (url.searchParams.has('apiKey')) {
                return send(400, 'apiKey must not be sent as a query parameter');
            }
            if (req.headers['x-api-key'] !== API_KEY) {
                return send(401, 'Invalid apiKey');
            }
            const path = url.pathname;
            if (path === '/projects/api/project/list/details') {
                return send(200, state.projects);
            }
            if (path === '/projects/api/project' && req.method === 'POST') {
                if (!data.gitSettings && data.settings.syncType === 'Git') {
                    return send(400, 'Git repository URL is missing');
                }
                const id = state.nextId++;
                state.projects.push({ id, name: data.name, type: data.type });
                const hasCredentials = !!(data.gitSettings && (data.gitSettings.token || data.gitSettings.password));
                const fails = data.settings.syncType === 'Git' && !hasCredentials;
                state.sync[id] = { polls: 0, created: true, final: fails ? { syncStatus: 'failure', message: 'Authentication failed' } : { syncStatus: 'success' } };
                return send(200, { id });
            }
            const statusMatch = /^\/projects\/api\/project\/(\d+)\/sync\/status$/.exec(path);
            if (statusMatch) {
                const sync = state.sync[statusMatch[1]] || (state.sync[statusMatch[1]] = { polls: 0, final: { syncStatus: 'success' } });
                sync.polls++;
                // first poll: a new project is still synchronizing, an existing one reports its previous synchronization
                if (sync.polls < 2) {
                    return send(200, sync.created
                        ? { commitHash: 'bbb', syncDate: '2026-01-02T00:00:00', syncStatus: 'in progress' }
                        : { commitHash: 'aaa', syncDate: '2026-01-01T00:00:00', syncStatus: 'success' });
                }
                return send(200, { commitHash: 'bbb', syncDate: '2026-01-02T00:00:00', ...sync.final });
            }
            if (/^\/projects\/api\/project\/\d+\/sync$/.test(path) || /sync\/artifacts\/\d+\/?$/.test(path)) {
                return send(200, {});
            }
            return send(404, 'not found');
        });
    });

    return new Promise(resolve => {
        server.listen(0, '127.0.0.1', () => {
            resolve({
                url: `http://127.0.0.1:${server.address().port}`,
                state,
                close: () => new Promise(done => server.close(done)),
            });
        });
    });
}

module.exports = { startMockApi, API_KEY };
