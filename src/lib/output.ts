/*
 * Output helpers for commands supporting the global --json flag.
 * In JSON mode exactly one JSON document is written to stdout, so the output can be consumed by scripts and AI agents.
 */
let jsonMode = false;

export const setJsonMode = (enabled: boolean) => {
    jsonMode = !!enabled;
};

export const isJsonMode = () => jsonMode;

// human readable progress message - suppressed in JSON mode
export const info = (message: string) => {
    if (!jsonMode) {
        console.log(message);
    }
};

export const success = (data: object, humanMessage?: string): never => {
    if (jsonMode) {
        console.log(JSON.stringify({ ok: true, ...data }, undefined, 2));
    }
    else if (humanMessage) {
        console.log(humanMessage);
    }
    process.exit(0);
};

export const fail = (message: string, code = 'error', data: object = {}): never => {
    if (jsonMode) {
        console.log(JSON.stringify({ ok: false, code, error: message, ...data }, undefined, 2));
    }
    else {
        console.error(message);
    }
    process.exit(1);
};

export const httpStatus = (e: any): number | undefined => e?.status || e?.response?.status;

export const errorMessage = (e: any): string => {
    const status = httpStatus(e);
    const msg = e?.message || String(e);
    return status ? `${msg} (HTTP ${status})` : msg;
};

// network level failures (no HTTP response): wrong host or port, server down, firewall/proxy, TLS certificate problems.
// The API client keeps only the message of the underlying error, so the message is matched as well as the code.
const CONNECTION_ERROR_PATTERN = new RegExp([
    'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'ESOCKETTIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH',
    'ECONNABORTED', 'timeout of \\d+ms exceeded', 'socket hang up', 'certificate', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
].join('|'), 'i');

export const isConnectionError = (e: any): boolean =>
    !httpStatus(e) && CONNECTION_ERROR_PATTERN.test(`${e?.code || ''} ${e?.message || ''}`);

// error code for a failed API call: invalid_api_key, connection_failed or error
export const apiErrorCode = (e: any): string => {
    if (httpStatus(e) === 401) {
        return 'invalid_api_key';
    }
    return isConnectionError(e) ? 'connection_failed' : 'error';
};
