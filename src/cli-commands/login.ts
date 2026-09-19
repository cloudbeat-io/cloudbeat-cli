import { ProjectApi } from '@cloudbeat/client/v1';
import { DEFAULT_API_BASE_URL, deleteConfig, getConfigPath, loadConfig, maskApiKey, resolveAuth, saveConfig } from '../lib/config';
import * as out from '../lib/output';
import { askSecret, isInteractive, readStdin } from '../lib/prompt';

/*
 * Verifies the API key by listing projects.
 * Returns undefined if the backend doesn't support the endpoint, i.e. the key could not be verified.
 */
const verifyApiKey = async (apiKey: string, apiBaseUrl: string): Promise<number | undefined> => {
    try {
        return (await new ProjectApi(apiKey, apiBaseUrl).list()).length;
    }
    catch (e: any) {
        if (out.httpStatus(e) === 404) {
            return undefined;
        }
        throw e;
    }
};

export const login = async ({ apiKey, apiBaseUrl, stdin }: { apiKey?: string; apiBaseUrl?: string; stdin?: boolean }) => {
    const baseUrl = apiBaseUrl || process.env.CB_API_URL || loadConfig().apiBaseUrl || DEFAULT_API_BASE_URL;

    // NOTE: this is the single place where the way credentials are obtained is decided.
    // A browser based flow can be added here later without affecting the rest of the CLI.
    let key = apiKey;
    if (!key && stdin) {
        key = await readStdin();
    }
    else if (!key && isInteractive()) {
        out.info(`Logging in to ${baseUrl}`);
        out.info('Your API key can be found in your user profile in CloudBeat.');
        key = await askSecret('API key: ');
    }
    if (!key) {
        return out.fail('API key was not provided. Run "cloudbeat-cli login" in an interactive terminal, or pipe the key using "--stdin".', 'no_api_key');
    }

    try {
        const projectCount = await verifyApiKey(key, baseUrl);
        saveConfig({ apiKey: key, apiBaseUrl: baseUrl });
        const verified = projectCount !== undefined;
        return out.success(
            { apiBaseUrl: baseUrl, apiKey: maskApiKey(key), verified, projectCount, configPath: getConfigPath() },
            verified
                ? `Logged in to ${baseUrl} (${projectCount} project(s) accessible). Credentials saved to ${getConfigPath()}`
                : `Credentials saved to ${getConfigPath()}, but the API key could not be verified against ${baseUrl}.`,
        );
    }
    catch (e: any) {
        return out.fail(`Login failed: ${out.errorMessage(e)}`, out.httpStatus(e) === 401 ? 'invalid_api_key' : 'error');
    }
};

export const logout = () => {
    const removed = deleteConfig();
    return out.success({ removed }, removed ? 'Logged out - stored credentials removed.' : 'No stored credentials found.');
};

export const whoami = async (flags: { apiKey?: string; apiBaseUrl?: string }) => {
    const auth = resolveAuth(flags);
    if (!auth) {
        return out.fail('Not logged in. Run "cloudbeat-cli login".', 'not_logged_in');
    }
    try {
        const projectCount = await verifyApiKey(auth.apiKey, auth.apiBaseUrl);
        return out.success(
            { apiBaseUrl: auth.apiBaseUrl, apiKey: maskApiKey(auth.apiKey), source: auth.source, verified: projectCount !== undefined, projectCount },
            `Logged in to ${auth.apiBaseUrl} using API key ${maskApiKey(auth.apiKey)} (from ${auth.source}).`,
        );
    }
    catch (e: any) {
        return out.fail(`Stored credentials are not valid: ${out.errorMessage(e)}`, out.httpStatus(e) === 401 ? 'invalid_api_key' : 'error');
    }
};
