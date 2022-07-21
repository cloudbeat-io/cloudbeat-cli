
import fs from 'fs';
import path from 'path';

import { Factory } from './Factory';

const mkdirp = require('mkdirp');
const xmlBuilder = require('xmlbuilder');

export class JUnitReportBuilder {
    private testSuitesAndCases: any[] = [];
    constructor(
        private factory: Factory,
    ) {
    }
    writeTo(reportPath: string): void {
        mkdirp.sync(path.dirname(reportPath));
        fs.writeFileSync(reportPath, this.build(), 'utf8');
    }

    build(): any {
        const xmlTree = xmlBuilder.create('testsuites', { encoding: 'UTF-8', allowSurrogateChars: true });
        this.testSuitesAndCases.forEach(suiteOrCase => {
            suiteOrCase.build(xmlTree);
        });
        return xmlTree.end({ pretty: true });
    }

    testSuite() {
        const suite = this.factory.newTestSuite();
        this.testSuitesAndCases.push(suite);
        return suite;
    }

    testCase() {
        const testCase = this.factory.newTestCase();
        this.testSuitesAndCases.push(testCase);
        return testCase;
    }

    newBuilder() {
        return this.factory.newBuilder();
    }
}
