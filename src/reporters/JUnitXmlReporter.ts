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
import { Factory, populateTestRunResult } from './junit-report-builder';

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
            const casesTagsHash = this.getCasesTagsHash();
            populateTestRunResult(result, builder, casesTagsHash);

            builder.writeTo(resultFilePath);

            return resultFilePath;

        }
    }
}
