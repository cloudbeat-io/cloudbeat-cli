export interface IReporterOptions {
    method: 'saveTestRunResults';
    targetFolder: string;
    cwd?: string;
    timeSuffix?: boolean;
    customSuffix?: string;
}
