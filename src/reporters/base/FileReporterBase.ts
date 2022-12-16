/*
 * Copyright (C) 2015-present CloudBeat Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/*
 * Oxygen File Reporter abstract class
 */
import fs from 'fs';
import path from 'path';
import moment from 'moment';

import { IReporterOptions } from '../../types/IReporterOptions';
import { ReporterBase } from './ReporterBase';

const REPORT_FILE_NAME = 'report';

export class FileReporterBase extends ReporterBase {
    constructor(
        protected options: IReporterOptions,
    ) {
        super(options);
    }
    createFolderStructureAndFilePath(fileExtension: string) {
        if (!fileExtension || typeof fileExtension !== 'string' || fileExtension.length === 0) {
            throw new Error('"fileExtension" argument must be specified');
        }
        // if fileExtension doesn't start with '.', add it automatically
        if (!fileExtension.startsWith('.')) {
            fileExtension = `.${fileExtension}`;
        }
        if (!this.options || !this.options.cwd) {
            throw new Error('Error constructing reports path, "cwd" option is missing.');
        }
        const resultsBaseFolder = this.options.cwd;
        // create results main folder (where all the results for the current test case or test suite are stored)
        this.createFolderIfNotExists(resultsBaseFolder);
        const resultFolderPath = resultsBaseFolder;
        let suffix = '';
        // create timestamp-based file name for the current results if "timeSuffix" property is specified
        if (this.options.timeSuffix) {
            suffix = `-${moment().format('YYYY-MM-DD_HHmmss')}`;
        }
        else if (this.options.customSuffix) {
            suffix = `-${this.options.customSuffix}`;
        }
        return path.join(resultFolderPath, `${REPORT_FILE_NAME}${suffix}${fileExtension}`);

    }
    createFolderIfNotExists(folderPath: string) {
        try {
            fs.mkdirSync(folderPath);
        }
        catch(e: any) {
            if (e.code !== 'EEXIST') {
                throw e;
            }
        }
        return folderPath;
    }

    // save all screenshots to files and replace screenshot content with file path in the result JSON before serialization
    replaceScreenshotsWithFiles(result: any, folderPath: string) {
        if (!folderPath) {
            throw new Error('"folderPath" argument cannot be null or empty.');
        }
        // const stepsWithScreenshot = [];

        // if(
        //     result &&
        //     result.cases &&
        //     Array.isArray(result.cases) &&
        //     result.cases.length > 0
        // ){
        //     for (let caze of result.cases) {
        //         // this._populateStepsWithScreenshots(caze.steps, stepsWithScreenshot);
        //     }
        // }
        // const screenshotFilePrefix = 'screenshot-';
        // const screenshotFileSuffix = '.png';
        // for (let i = 0; i<stepsWithScreenshot.length; i++) {
        //     let filename = screenshotFilePrefix + i + screenshotFileSuffix;
        //     let filepath = path.join(folderPath, filename);
        //     let step = stepsWithScreenshot[i];
        //     fs.writeFileSync(filepath, step.screenshot, 'base64');
        //     step.screenshotFile = filename;
        //     step.screenshot = null; // don't save base64 screenshot date to the file
        // }
    }
    _populateStepsWithScreenshots(steps: any[], stepsWithScreenshot: any[]) {
        for (const step of steps) {
            if (step.screenshot) {
                stepsWithScreenshot.push(step);
            }
            // handle child steps too
            if (step.steps) {
                this._populateStepsWithScreenshots(step.steps, stepsWithScreenshot);
            }
        }
    }
}
