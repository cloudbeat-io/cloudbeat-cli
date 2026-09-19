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

export const fail = (message: string, code = 'error'): never => {
    if (jsonMode) {
        console.log(JSON.stringify({ ok: false, code, error: message }, undefined, 2));
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
