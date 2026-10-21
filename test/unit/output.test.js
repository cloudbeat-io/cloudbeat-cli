const assert = require('node:assert');
const { describe, it } = require('node:test');
const { apiErrorCode, isConnectionError } = require('../../build/lib/output');

describe('apiErrorCode', () => {
    it('reports invalid_api_key for HTTP 401', () => {
        assert.strictEqual(apiErrorCode({ status: 401, message: 'Authentication failed, invalid API key.' }), 'invalid_api_key');
    });

    it('reports connection_failed for network errors without an HTTP response', () => {
        for (const message of [
            'connect ECONNREFUSED 127.0.0.1:9',
            'connect ETIMEDOUT 103.45.244.130:8080',
            'getaddrinfo ENOTFOUND cloudbeat.company.local',
            'getaddrinfo EAI_AGAIN cloudbeat.company.local',
            'timeout of 30000ms exceeded',
            'self-signed certificate in certificate chain',
            'unable to verify the first certificate',
        ]) {
            assert.strictEqual(apiErrorCode(new Error(message)), 'connection_failed', message);
        }
        assert.strictEqual(apiErrorCode(Object.assign(new Error('failed'), { code: 'ECONNRESET' })), 'connection_failed');
    });

    it('reports error for other HTTP and unknown failures', () => {
        assert.strictEqual(apiErrorCode({ status: 500, message: 'Internal server error, please try again later.' }), 'error');
        assert.strictEqual(apiErrorCode({ status: 404, message: 'connect ECONNREFUSED in a response body' }), 'error');
        assert.strictEqual(apiErrorCode(new Error('Unexpected token < in JSON')), 'error');
    });
});

describe('isConnectionError', () => {
    it('is false when the server answered', () => {
        assert.strictEqual(isConnectionError({ response: { status: 502 }, message: 'Bad Gateway' }), false);
    });
});
