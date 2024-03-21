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

export const finishCLI = (failOnErrors = true, isSuccess: boolean) => {
    let code = isSuccess ? 0 : 1;

    failOnErrors = failOnErrors?.toString() === 'false' ? false : true;

    if (failOnErrors) {
        // do nothing, all ok
    }
    else {
        code = 0;
    }

    process.exit(code);
};
