import fs from 'fs';
import os from 'os';
import path from 'path';

export const DEFAULT_API_BASE_URL = 'https://api.cloudbeat.io';

export interface ICliConfig {
    apiKey?: string;
    apiBaseUrl?: string;
}

export interface IAuth {
    apiKey: string;
    apiBaseUrl: string;
    source: 'flags' | 'env' | 'config';
}

export const getConfigDir = () => process.env.CB_CONFIG_DIR || path.join(os.homedir(), '.cloudbeat');

export const getConfigPath = () => path.join(getConfigDir(), 'config.json');

export const loadConfig = (): ICliConfig => {
    try {
        return JSON.parse(fs.readFileSync(getConfigPath(), 'utf8')) as ICliConfig;
    }
    catch (e) {
        return {};
    }
};

export const saveConfig = (config: ICliConfig) => {
    fs.mkdirSync(getConfigDir(), { recursive: true, mode: 0o700 });
    fs.writeFileSync(getConfigPath(), `${JSON.stringify(config, undefined, 4)}\n`, { mode: 0o600 });
    // mode is ignored by writeFileSync if the file already exists
    fs.chmodSync(getConfigPath(), 0o600);
};

export const deleteConfig = (): boolean => {
    if (!fs.existsSync(getConfigPath())) {
        return false;
    }
    fs.unlinkSync(getConfigPath());
    return true;
};

/*
 * Resolves credentials in the following order: command line flags, environment variables, stored config.
 */
export const resolveAuth = (flags: ICliConfig): IAuth | undefined => {
    const config = loadConfig();
    const apiBaseUrl = flags.apiBaseUrl || process.env.CB_API_URL || config.apiBaseUrl || DEFAULT_API_BASE_URL;

    if (flags.apiKey) {
        return { apiKey: flags.apiKey, apiBaseUrl, source: 'flags' };
    }
    if (process.env.CB_API_KEY) {
        return { apiKey: process.env.CB_API_KEY, apiBaseUrl, source: 'env' };
    }
    if (config.apiKey) {
        return { apiKey: config.apiKey, apiBaseUrl, source: 'config' };
    }
    return undefined;
};

export const maskApiKey = (apiKey: string) => apiKey.length <= 8 ? '****' : `${apiKey.substring(0, 4)}…${apiKey.substring(apiKey.length - 4)}`;
