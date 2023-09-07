/*
 * Copyright (C) 2015-present CloudBeat Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IReporterOptions } from '../../types/IReporterOptions';

/*
 * Oxygen Reporter abstract class
 */
export class ReporterBase {
    constructor(
        protected options: IReporterOptions,
    ) {
    }
    generate(results: any) {
        throw new Error('Abstract class, method not implemented');
    }

    protected getCasesTagsHash(): any {
        if (!this.options.caseTagList || !Array.isArray(this.options.caseTagList)) {
            return {};
        }
        const caseIdAndTagsHash: any = {};
        for (const caseTagList of this.options.caseTagList) {
            const caseIdOrFqn: any | undefined = caseTagList.caseId || caseTagList.fqn;
            if (!caseIdOrFqn) {
                continue;
            }
            caseIdAndTagsHash[caseIdOrFqn] = caseTagList.tags;
        }
        return caseIdAndTagsHash;
    }
}
