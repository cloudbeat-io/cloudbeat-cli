/*
 * Copyright (C) 2015-present CloudBeat Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/*
 * Oxygen JUnit XML Reporter
 */
import path from 'path';
import { IReporterOptions } from '../types/IReporterOptions';
import { FileReporterBase } from './base/FileReporterBase';
import { Factory } from './junit-report-builder';

const populateTestRunResult = (obj: any, builder: any) => {
    const data = obj.result;
    const suite = builder.testSuite()
    .id(data.id)
    .name(data.testName)
    .time(formatTime(data.duration));

    if(obj) {
        if (Array.isArray(obj.cases) && obj.cases.length > 0) {
            obj.cases.map((casesItem: any, index: number) => {
                const iterationList: any[] = [];
                if (obj && obj.instances && Array.isArray(obj.instances)) {
                    obj.instances.map((instancesItem: any) => {
                        if (instancesItem.iterationList && Array.isArray(instancesItem.iterationList) && instancesItem.iterationList.length > 0) {
                            instancesItem.iterationList.map((iterationListItem: any) => {
                                if (iterationListItem.caseId === casesItem.testCaseId) {
                                    iterationListItem.browserName = instancesItem.browserName;
                                    iterationListItem.deviceName = instancesItem.deviceName;
                                    iterationList.push(iterationListItem);
                                }
                            });
                        }
                    });
                }

                if(iterationList && Array.isArray(iterationList) && iterationList.length > 0){
                    iterationList.map((iterationListItem) => {
                        const stepList = iterationListItem.stepList || [];
                        let caseDuration = 0;
                        let caseFailedMessage = '';
                        caseDuration = getCaseDuration(stepList);

                        if (iterationListItem.failure) {
                            const failure = iterationListItem.failure || {};
                            if (failure) {
                                if (failure.type && typeof failure.type === 'string') {
                                    caseFailedMessage += `${failure.type} - `;
                                }
                                if (failure.message && typeof failure.message === 'string') {
                                    caseFailedMessage += failure.message;
                                }
                                if (failure.details && typeof failure.details === 'string') {
                                    caseFailedMessage += failure.details;
                                }
                                if (obj.domain) {
                                    // old CB API will return just the domain so we add HTTPS schema manually
                                    const cbHost = obj.domain.startsWith('http') ? obj.domain : `https://${obj.domain}`;
                                    caseFailedMessage += `\n Test Result: ${cbHost}/#/results/${data.id}`;
                                }
                            }
                        }

                        let testCase;
                        if (casesItem.isSuccess) {
                            testCase = suite.testCase()
                            .id(casesItem.testCaseId)
                            .name(casesItem.caseName)
                            .time(formatTime(caseDuration));
                        }
                        else {
                            testCase = suite.testCase()
                            .id(casesItem.testCaseId)
                            .name(casesItem.caseName)
                            .time(formatTime(caseDuration))
                            .failure(caseFailedMessage);
                        }

                        if (iterationListItem.browserName) {
                            testCase.browserName(iterationListItem.browserName);
                        }

                        if (iterationListItem.deviceName) {
                            testCase.deviceName(iterationListItem.deviceName);
                        }
                    });
                }
                else {
                    if (casesItem.isSuccess) {
                        suite.testCase()
                        .id(casesItem.testCaseId)
                        .name(casesItem.caseName);
                    }
                    else {
                        suite.testCase()
                        .id(casesItem.testCaseId)
                        .name(casesItem.caseName);
                    }
                }
            });
        }
        else if (Array.isArray(obj.instances) && obj.instances.length > 0) {
            // Unable to start instance error
            obj.instances.map((iterationListItem: any, idx: number) => {
                const testCase = suite.testCase()
                .id(idx)
                .name(idx)
                .failure(iterationListItem.failureJson);

                if (iterationListItem.browserName) {
                    testCase.browserName(iterationListItem.browserName);
                }

                if (iterationListItem.deviceName) {
                    testCase.deviceName(iterationListItem.deviceName);
                }
            });
        }
    }
};

const formatTime = (time: number) => {
    try{
        if (time && time.toFixed) {
            return time.toFixed(2);
        }
 else {
            return time;
        }
    }
 catch(e) {
        console.warn('format time error', e);
        return 'format time error';
    }
};

const getCaseDuration = (stepList: any[]) => {
    try{
        let result = 0;

        if (stepList && Array.isArray(stepList)) {
            stepList.map((item) => {
                if (item && item.duration && typeof item.duration === 'number') {
                    result += item.duration;
                }
            });
        }

        if (result > 0) {
            result = result/1000;
        }

        return result;
    }
 catch(e) {
        console.warn('get case duration error', e);
        return 0;
    }
};

export default class JUnitXmlReporter extends FileReporterBase {
    constructor(options: IReporterOptions) {
        super(options);
    }

    generate(result: any) {
        const resultFilePath = this.createFolderStructureAndFilePath('.xml');
        const resultFolderPath = path.dirname(resultFilePath);

        this.replaceScreenshotsWithFiles(result, resultFolderPath);

        const method = this.options.method;

        if(method === 'saveTestRunResults'){
            const builder = new Factory().newBuilder();

            populateTestRunResult(result, builder);

            builder.writeTo(resultFilePath);

            return resultFilePath;

        }
    }
}
