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
import builder from '../../junit-report-builder';
import FileReporterBase from '../lib/FileReporterBase';

function populateTestRunResult(obj, builder) {

    let instances;
    let iterationList;
    const data = obj.result;

    if(obj && obj.instances && Array.isArray(obj.instances)){
        instances = obj.instances;

        if(Array.isArray(instances) && instances[0] && instances[0].iterationList && Array.isArray(instances[0].iterationList)){
            iterationList = instances[0].iterationList;
        }
    }


    var suite = builder.testSuite()
    .time(formatTime(data.duration))
    .id(data.id)
    .name(data.testName);

    if(obj && obj.cases){
        obj.cases.map((item, index) => {       

            let caseDuration = 0;
            let caseFailedMessage = '';
                        
            if(
                iterationList && 
                Array.isArray(iterationList) && 
                iterationList[index] && 
                iterationList[index].stepList
            ) {
                const stepList = iterationList[index].stepList || [];
                
                caseDuration = getCaseDuration(stepList);

                if(iterationList[index].failure){
                
                    const failure = iterationList[index].failure || {};
    
                    if(failure){
                        
                        if(failure.type && typeof failure.type === 'string'){
                            caseFailedMessage += failure.type+' - ';
                        }

                        if(failure.message && typeof failure.message === 'string'){
                            caseFailedMessage += failure.message;
                        }
                        
                        if(failure.details && typeof failure.details === 'string'){
                            caseFailedMessage += failure.details;
                        }

                        if(obj.domain){
                            caseFailedMessage += '\n Test Result: '+obj.domain+'/#/results/'+data.id;
                        }
                    }
                }

            }
            
            if(item.isSuccess){
                suite.testCase()
                .time(formatTime(caseDuration))
                .id(item.testCaseId)
                .name(item.caseName);
            } else {
                suite.testCase()
                .time(formatTime(caseDuration))
                .id(item.testCaseId)
                .name(item.caseName)
                .failure(caseFailedMessage);
            }  
        });
    }
}

const formatTime = (time) => {
    try{
        if(time && time.toFixed){
            return time.toFixed(2);
        } else {
            return time;
        }
    } catch(e) {
        console.warn('format time error', e);
        return 'format time error';
    }
};

const getCaseDuration = (stepList) => {
    try{
        let result = 0;

        if(stepList && Array.isArray(stepList)){
            stepList.map((item) => {
                if(item && item.duration && typeof item.duration === 'number'){
                    result += item.duration;
                }
            });
        }

        if(result > 0){
            result = result/1000;
        }

        return result;
    } catch(e) {
        console.warn('get case duration error', e);
        return 0;
    }
};
export default class JUnitXmlReporter extends FileReporterBase {
    constructor(options) {
        super(options);
    }

    generate(result) {        
        var resultFilePath = this.createFolderStructureAndFilePath('.xml');
        var resultFolderPath = path.dirname(resultFilePath);

        this.replaceScreenshotsWithFiles(result, resultFolderPath);
        
        const method = this.options.method;

        if(method === 'saveTestRunResults'){
            populateTestRunResult(result, builder);


            builder.writeTo(resultFilePath);

            return resultFilePath;

        }

        // for (let result of result) {
        //     for (let suite of result.suites) {
        //         this._populateSuiteResults(suite, builder);
        //     }
        // }

        // builder.writeTo(resultFilePath);

        // return resultFilePath;
    }
}
