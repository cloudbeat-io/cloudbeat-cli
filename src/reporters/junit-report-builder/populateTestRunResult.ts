const DISPLAY_NAME_SEPARATOR = '/';

export function populateTestRunResult(runResult: any, builder: any) {
    if (!runResult) {
        throw new Error('"runResult" is null or undefined');
    }
    const testResult = runResult.result;
    const suite = builder.testSuite()
    .id(testResult.testSuiteId || testResult.testCaseId /*when executing cases, suiteId wiill be null so write caseId instead*/)
    .name(testResult.testName)
    .time(formatTime(testResult.duration));

    if (Array.isArray(runResult.instances) && runResult.instances.length > 0) {
        runResult.instances.forEach((testInstance: any, instanceIndex: number) => {
            const { browserName, deviceName, locationName } = testInstance;
            if (Array.isArray(testInstance.iterationList) && testInstance.iterationList.length > 0) {
                testInstance.iterationList.forEach((caseIteration: any, iterationIndex: number) => {
                    const { caseId, caseName, fqn, status, failure, stepList } = caseIteration;
                    const duration = calculateDurationBySteps(stepList);
                    const displayName = getCaseDisplayName(caseName, locationName, browserName, deviceName);
                    const isFailed = status === 'FAILED';
                    const altcaseId = `${instanceIndex}-${iterationIndex}`;
                    const testCase = suite.testCase()
                        .id(caseId || altcaseId)
                        .name(displayName)
                        .className(fqn || caseName)
                        .time(formatTime(duration));
                    if (isFailed) {
                        testCase.failure(getFailureMessage(failure || getFailureFromSteps(stepList), runResult.result.id, runResult.domain));
                    }
                });
            }
        });
    }
    // we should execute the below code only if test has failed on initializing stage
    // in that case, we might not have "instances" list in the result object
    else if (Array.isArray(runResult.cases) && runResult.cases.length > 0) {
        runResult.cases.map((caseResultSum: any, index: number) => {
            const { caseName, testCaseId, caseFqn, isSuccess } = caseResultSum;
            const testCase = suite.testCase()
                .id(testCaseId || index)
                .name(caseName)
                .className(caseFqn || caseName)
                .duration(0);
            if (!isSuccess) {
                testCase.failure(getUnknownFailureMessage());
            }
        });
    }
}

function calculateDurationBySteps(stepList: any[]): number {
    if (!Array.isArray(stepList)) {
        return 0;
    }
    const durationInMs = stepList.reduce(
        (previousSum: number, step: any) => previousSum + (step.duration as number || 0),
        0,
    );
    return durationInMs / 1000;
}

function getUnknownFailureMessage(): string {
    return 'Unknown failure';
}

function getFailureMessage(failure: any, resultId: number, domain?: string) {
    let failureMsg = '';
    if (failure) {
        if (failure.type && typeof failure.type === 'string') {
            failureMsg += `${failure.type} - `;
        }
        if (failure.message && typeof failure.message === 'string') {
            failureMsg += failure.message;
        }
        if (failure.details && typeof failure.details === 'string') {
            failureMsg += failure.details;
        }
        if (domain) {
            // old CB API will return just the domain so we add HTTPS schema manually
            const cbHost = domain.startsWith('http') ? domain : `https://${domain}`;
            failureMsg += `\n More details: ${cbHost}/#/results/${resultId}`;
        }
    }
    return failureMsg;
}

function getFailureFromSteps(stepList: any[]): any {
    for (const step of stepList) {
        if (step.failure) {
            return step.failure;
        }
        if (step.stepList) {
            const childStepFailure = getFailureFromSteps(step.stepList);
            if (childStepFailure) {
                return childStepFailure;
            }
        }
    }
    return null;
}

function getCaseDisplayName(caseName: string, locationName: string, browserName?: string, deviceName?: string): string {
    let displayName = caseName;
    if (deviceName) {
        deviceName += ` ${DISPLAY_NAME_SEPARATOR} ${deviceName}`;
    }
    if (browserName) {
        displayName += ` ${DISPLAY_NAME_SEPARATOR} ${browserName}`;
    }
    // FIXME: decide if locationName shall be included in the display name
    return displayName;
}

function formatTime(time: number) {
    try{
        if (time && time.toFixed) {
            return time.toFixed(2);
        }
        else {
            return 0;
        }
    }
    catch(e) {
        console.warn('Invalid time format', e);
        return 'Invalid time format';
    }
}

function getCaseDuration(stepList: any[]) {
    try {
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
}
