/*
 * Copyright (C) 2015-2017 CloudBeat Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Helper module for internal Oxygen use
 */
var defer = require('when').defer;
var path = require('path');
var fs = require('fs');
var _ = require('lodash');

var self = module.exports = {
    generateTestSuiteFromJSFile: function (filePath, paramFile, paramMode) {
        var fileNameNoExt = self.getFileNameWithoutExt(filePath);
        var _done = defer();

        var testcase = new require('../model/testcase.js')();
        testcase.name = fileNameNoExt;
        testcase.path = filePath;
        testcase.format = 'js';
        testcase.iterationCount = 1;
        
        var suite = new require('../model/testsuite.js')();
        suite.name = testcase.name;
        suite.id = testcase.id;
        suite.testcases.push(testcase);
        if (testcase.reopenSession) {
            suite.reopenSession = testcase.reopenSession;
        }
        
        // if param file is not specified, then check if JS file is coming in pair with a parameter file 
        // (currently supporting CSV or TXT)
        if (paramFile === null) {
            var csvParamFile = path.join(path.dirname(filePath), fileNameNoExt + '.csv');
            var txtParamFile = path.join(path.dirname(filePath), fileNameNoExt + '.txt');
            var xslParamFile = path.join(path.dirname(filePath), fileNameNoExt + '.xls');
            var xslxParamFile = path.join(path.dirname(filePath), fileNameNoExt + '.xlsx');

            if (fs.existsSync(csvParamFile)) {
                paramFile = csvParamFile;
            } else if (fs.existsSync(txtParamFile)) {
                paramFile = txtParamFile;
            } else if (fs.existsSync(xslParamFile)) {
                paramFile = xslParamFile;
            } else if (fs.existsSync(xslxParamFile)) {
                paramFile = xslxParamFile;
            }
        }
        
        // try to load parameter manager if parameter file exists
        if (paramFile) {
            self.loadParameterManager(filePath, paramFile, paramMode)
                .then(function(pm) {
                    suite.paramManager = pm;
                    // if parameter reading mode is 'all' then change iterationCount to the amount of rows in the param file
                    if (suite.paramManager && paramMode == 'all') {
                        suite.iterationCount = suite.paramManager.rows;
                    }
                    _done.resolve(suite);
                })
                .catch(function(err) {
                    _done.reject(err);
                });
        }
        
        // if no parameter file specified - resolve immediately
        if (!paramFile) {
            _done.resolve(suite);
        }

        return _done.promise;
    },
    
    generateTestSuiteFromJsonFile: function (filePath, paramFile, paramMode, options) {
        console.log('filePath', filePath);
        console.log('paramFile', paramFile);
        console.log('paramMode', paramMode);
        console.log('options', options);

        var fileNameNoExt = self.getFileNameWithoutExt(filePath);
        var baseFolder = path.dirname(filePath);
        var _done = defer();
        // load json config file
        var conf = require(filePath);
        // create test suite object
        var suite = new require('../model/testsuite.js')();
        suite.name = fileNameNoExt;
        suite.iterationCount = conf.iterations || 1;
        suite.capabilities = conf.capabilities || {};
        suite.options = conf.options || null;
        suite.parallel = conf.parallel || 1;
        // initialize each test case
        _.each(conf.cases, function(caseDef) {
            // initialize testcase object
            var tc = new require('../model/testcase.js')();
            if (caseDef.name)
                tc.name = caseDef.name;
            else
                tc.name = self.getFileNameWithoutExt(caseDef.path);
            tc.path = self.resolvePath(caseDef.path, baseFolder);
            tc.format = 'js';
            tc.iterationCount = 1;
            suite.testcases.push(tc);
        });
        // try to load parameter manager if parameter file exists
        self.loadParameterManager(filePath, paramFile, paramMode)
            .then(function(pm) {
                suite.paramManager = pm;
                // if parameter reading mode is 'all' then change iterationCount to the amount of rows in the param file
                if (suite.paramManager && paramMode == 'all') {
                    suite.iterationCount = suite.paramManager.rows;
                }
                _done.resolve(suite);
            })
            .catch(function(err) {
                _done.reject(err);
            });

        // apply server settings to startup options if found in test suite configuration file
        if (conf.server) {
            // server configuration can be provided either as host + port for Appium or full URL in case of Selenium server.
            if (conf.server.host) { options.host = conf.server.host; }
            if (conf.server.port) { options.port = conf.server.port; }
            if (conf.server.url) { options.seleniumUrl = conf.server.url; }
        }

        return _done.promise;
    },

    getFileNameWithoutExt: function (filePath) {
        var fileName = path.basename(filePath);
        var fileExt = path.extname(filePath);
        var filePathNoExt = fileName.substring(0, fileName.lastIndexOf(fileExt));
        return filePathNoExt;
    },

    loadParameterManager: function(mainFile, paramFile, paramMode) {
        var paramManager = null;
        var _done = defer();
        // if param file is not specified, then check if JS file is coming in pair with a parameter file (currently supporting CSV or TXT)
        if (!paramFile) {
            var fileNameNoExt = self.getFileNameWithoutExt(mainFile);
            var csvParamFile = path.join(path.dirname(mainFile), fileNameNoExt + '.csv');
            var txtParamFile = path.join(path.dirname(mainFile), fileNameNoExt + '.txt');
            var xlsParamFile = path.join(path.dirname(mainFile), fileNameNoExt + '.xls');
            var xlsxParamFile = path.join(path.dirname(mainFile), fileNameNoExt + '.xlsx');

            if (fs.existsSync(csvParamFile)) {
                paramFile = csvParamFile;
            } else if (fs.existsSync(txtParamFile)) {
                paramFile = txtParamFile;
            } else if (fs.existsSync(xlsParamFile)) {
                paramFile = xlsParamFile;
            } else if (fs.existsSync(xlsxParamFile)) {
                paramFile = xlsxParamFile;
            }
        }
        if (paramFile) {
            paramManager = new require('./param-manager')(paramFile, paramMode || 'sequential');
            paramManager.init()
             .then(function() {
                 _done.resolve(paramManager);
             })
             .catch(function(err) {
                 _done.reject(err);
             });
        }
        else {
            _done.resolve(null);    // param file not found or is not specified
        }
        return _done.promise;
    },

    resolvePath: function(pathToResolve, baseFolder) {
        if (path.isAbsolute(pathToResolve))
            return pathToResolve;
        return path.resolve(baseFolder, pathToResolve);
    },

    makeSerializable: function(err) {
        if (typeof err === 'object') {
            return destroyCircular(err, []);
        }
        return err;

        // https://github.com/jonpacker/destroy-circular
        function destroyCircular(from, seen) {
            var to = Array.isArray(from) ? [] : {};
            seen.push(from);
            Object.keys(from).forEach(function(key) {
                if (!from[key] || (typeof from[key] != 'object' && !Array.isArray(from[key]))) {
                    to[key] = from[key];
                } else if (seen.indexOf(from[key]) == -1) {
                    to[key] = destroyCircular(from[key], seen.slice(0));
                } else to[key] = '[Circular]';
            });
            return to;
        }
    }
};
