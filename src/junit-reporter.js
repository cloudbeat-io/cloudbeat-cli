/*
 * Copyright (C) 2015-2017 CloudBeat Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/*
 * Oxygen JUnit XML Reporter
 */
const builder = require('./../junit-report-builder');
const path = require('path');
const _ = require('lodash');

var ReporterFileBase = require('./reporter-file-base');
var util = require('util');
util.inherits(JUnitXmlReporter, ReporterFileBase);

function JUnitXmlReporter(results, options) {
    JUnitXmlReporter.super_.call(this, results, options);
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
}

const getCaseDuration = (stepList) => {
    try{
        let result = 0;

        if(stepList && Array.isArray(stepList)){
            stepList.map((item) => {
                if(item && item.duration && typeof item.duration === 'number'){
                    result += item.duration;
                }
            })
        }

        if(result > 0){
            result = result/1000;
        }

        return result;
    } catch(e) {
        console.warn('get case duration error', e);
        return 0;
    }
}

JUnitXmlReporter.prototype.generate = function() {
    var resultFilePath = this.createFolderStructureAndFilePath('.xml');
    var resultFolderPath = path.dirname(resultFilePath);

    if(this.options && this.options.method){

        this.replaceScreenshotsWithFiles(resultFolderPath);

        const method = this.options.method;

        if(method === "saveTestRunResults"){
            populateTestRunResult(this.results, builder);


            builder.writeTo(resultFilePath);

            return resultFilePath;

        }
    } else {
        console.warn('method field is required');
    }

    return;

    // the 'results' object can contain a single test suite result or an array of multiple parallel test results
    if (this.results instanceof Array) {
        // go through multiple results
        _.each(this.results, function(resultSet) {
            populateSuiteResults(resultSet, builder);
        });
    } else {
        populateSuiteResults(this.results, builder);
    }

    builder.writeTo(resultFilePath);

    return resultFilePath;
};
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
                var testCase = suite.testCase()
                .time(formatTime(caseDuration))
                .id(item.testCaseId)
                .name(item.caseName)
            } else {
                var testCase = suite.testCase()
                .time(formatTime(caseDuration))
                .id(item.testCaseId)
                .name(item.caseName)
                .failure(caseFailedMessage);
            }  
        })
    }
}


function populateSuiteResults(result, builder) {

    var suite = builder.testSuite().name(result.data.runId);
    // _.each(result.iterations, function(outerIt) {
    //     _.each(outerIt.testcases, function(testcase) {
    //         var testCase = suite.testCase().name(testcase._name);
    //         testCase.time(testcase._duration ? testcase._duration / 1000 : 0);
    //         _.each(testcase.iterations, function(innerIt) {
    //             var lastFailedStep = null;
    //             _.each(innerIt.steps, function(step) {
    //                 if (step._status === 'failed') {
    //                     lastFailedStep = step;
    //                 }
    //                 else {
    //                     lastFailedStep = null;
    //                 }
    //             });
    //             if (lastFailedStep) {
    //                 var message = lastFailedStep.failure._type || '';
    //                 message += lastFailedStep.failure._message ? (' - ' + lastFailedStep.failure._message) : '';
    //                 message += lastFailedStep.failure._line ? ' at line ' + lastFailedStep.failure._line : '';
    //                 if (message === '') {
    //                     message = null;
    //                 }
    //                 testCase.failure(message);
    //             }
    //         });
    //     });
    // });
}

module.exports = JUnitXmlReporter;
