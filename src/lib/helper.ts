import reporters from '../reporters';
import { IReporterOptions } from '../types/IReporterOptions';

export const getReporterInstance = (format: string, opts: IReporterOptions) => {
    if (!format) {
        throw new Error('Invalid argument, "format" must be specified');
    }
    const ReporterClass = (reporters as any)[format];
    if (ReporterClass) {
        return new ReporterClass(opts);
    }
    throw new Error(`Reporter of this format does not exist: ${format}`);
};

export const finishCLI = (failOnErrors = true, result?: any) => {
    let code = 1;

    if (
        result &&
        result.result &&
        typeof result.result.isSuccess !== 'undefined'
    ) {
        code = result.result.isSuccess ? 0 : 1;
    }

    if (failOnErrors?.toString() === 'false') {
        failOnErrors = false;
    }
    else {
        failOnErrors = true;
    }

    if (failOnErrors) {
        // do nothing, all ok
    }
    else {
        if (code === 0) {
            code = 1;
        }
        else if (code === 1) {
            code = 0;
        }
    }

    process.exit(code);
};
