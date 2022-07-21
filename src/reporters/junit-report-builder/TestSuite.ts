import { Factory } from './Factory';

const formatDate = require('date-format').asString;
const _ = require('lodash');


export class TestSuite {
  private _attributes: any = {};
  private _testCases: any[] = [];
  private _properties: any = [];

  constructor(private _factory: Factory) {
  }

  id(name: string) {
    this._attributes.id = name;
    return this;
  }

  name(name: string) {
    this._attributes.name = name;
    return this;
  }

  time(timeInSeconds: number) {
    this._attributes.time = timeInSeconds;
    return this;
  }

  timestamp(timestamp: any) {
    if (_.isDate(timestamp)) {
      this._attributes.timestamp = formatDate('yyyy-MM-ddThh:mm:ss', timestamp);
    }
    else {
      this._attributes.timestamp = timestamp;
    }
    return this;
  }

  property(name: string, value: any) {
    this._properties.push({ name, value });
    return this;
  }

  testCase() {
    const testCase = this._factory.newTestCase();
    this._testCases.push(testCase);
    return testCase;
  }

  getFailureCount() {
    return this._sumTestCaseCounts((testCase: any) => {
      return testCase.getFailureCount();
    });
  }

  getErrorCount() {
    return this._sumTestCaseCounts((testCase: any) => {
      return testCase.getErrorCount();
    });
  }

  getSkippedCount() {
    return this._sumTestCaseCounts((testCase: any) => {
      return testCase.getSkippedCount();
    });
  }

  build(parentElement: any) {
    this._attributes.tests = this._testCases.length;
    this._attributes.failures = this.getFailureCount();
    this._attributes.errors = this.getErrorCount();
    this._attributes.skipped = this.getSkippedCount();
    const suiteElement = parentElement.ele('testsuite', this._attributes);

    if (this._properties.length) {
      const propertiesElement = suiteElement.ele('properties');
      _.forEach(this._properties, (property: any) => {
        propertiesElement.ele('property', {
          name: property.name,
          value: property.value,
        });
      });
    }

    this._testCases.forEach((testCase: any) => {
      testCase.build(suiteElement);
    });
  }

  private _sumTestCaseCounts(counterFunction: any) {
    const counts = _.map(this._testCases, counterFunction);
    return _.sum(counts);
  }
}
