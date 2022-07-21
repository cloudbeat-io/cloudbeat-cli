import { JUnitReportBuilder } from './JUnitReportBuilder';
import { TestCase } from './TestCase';
import { TestSuite } from './TestSuite';

export class Factory {
    newBuilder(): JUnitReportBuilder {
        return new JUnitReportBuilder(this);
    }

    newTestSuite(): TestSuite {
        return new TestSuite(this);
    }

    newTestCase(): TestCase {
        return new TestCase();
    };
}
