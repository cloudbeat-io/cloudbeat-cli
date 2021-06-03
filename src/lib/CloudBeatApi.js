import axios from 'axios';
import https from 'https';

import CloudBeatApiError from './CloudBeatApiError';
import * as API_ENDPOINTS from './endpoints';

const DEFAULT_HOST = 'https://api.cloudbeat.io';

export default class CloudBeatApi {
    constructor({ host, apiKey }) {
        this.host = host || DEFAULT_HOST;
        this.apiKey = apiKey;
        const Agent  = new https.Agent({
            rejectUnauthorized: false
        });
        
        this.http = axios.create({
            validateStatus: function (status) {
                return (status >= 200 && status < 300) || status == 304; // default
            }
        });
        this.http.defaults.httpsAgent = Agent;
    }

    async testCaseRun(caseId) {
        const response = await this._post(`${this.host}${API_ENDPOINTS.CASES}/${caseId}/run?apiKey=${this.apiKey}`);
        if (!response.data || !response.data.data || !response.data.data.id) {
            throw new CloudBeatApiError('Invalid response, "data.id" is missing.');
        }
        return response.data.data;
    }

    async testSuiteRun(suiteId) {
        const response = await this._post(`${this.host}${API_ENDPOINTS.SUITES}/${suiteId}/run?apiKey=${this.apiKey}`);
        if (!response.data || !response.data.data || !response.data.data.id) {
            throw new CloudBeatApiError('Invalid response, "data.id" is missing.');
        }
        return response.data.data;
    }

    async testMonitorRun(monitorId) {
        const response = await this._post(`${this.host}${API_ENDPOINTS.MONITORS}/${monitorId}/run?apiKey=${this.apiKey}`);
        if (!response.data || !response.data.data || !response.data.data.id) {
            throw new CloudBeatApiError('Invalid response, "data.id" is missing.');
        }
        return response.data.data;
    }

    async testResultGet(resultId) {
        const response = await this._get(`${this.host}${API_ENDPOINTS.RESULTS}/run/${resultId}?apiKey=${this.apiKey}`);
        return response;
    }

    async runGetStatus(runId) {
        const url = `${this.host}${API_ENDPOINTS.RUNS}/${runId}/0?apiKey=${this.apiKey}`;
        const response = await this._get(url);
                    
        let status;

        if (response.status == 304) {
            status = 'Unmodified';
        }
        else if (!response.data || !response.data.data || !response.data.data.status) {
            throw new CloudBeatApiError('Invalid response, "data.status" is missing.');
        }

        const result = {
            status: status
        };

        if(response && response.data && response.data.data){
            if(response.data.data.status){
                result.status = response.data.data.status;
            }

            if(response.data.data.progress){
                result.progress = response.data.data.progress.toFixed(2);
            }
        }
        return result;
    }

    async runGetResult(runId) {
        const url = `${this.host}${API_ENDPOINTS.RESULTS}/run/${runId}?apiKey=${this.apiKey}`;
        const response = await this._get(url);
        if (!response.data || !response.data.data) {
            throw new CloudBeatApiError('Invalid response, "data" is missing.');
        }
        return response.data.data;
    }

    async _post(url, postData = null) {
        try {
            return await this.http.post(url);
        }
        catch (e) {
            throw this._handleHttpError(e);
        }
    }

    async _get(url) {
        try {
            return await this.http.get(url);
        }
        catch (e) {
            throw this._handleHttpError(e);
        }
    }

    _handleHttpError(e) {
        if (!e.response) {
            return e;
        }
        return new CloudBeatApiError(e);
    }
}