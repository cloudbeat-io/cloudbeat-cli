#! /usr/bin/env node

// import program from 'commander';
import colors from 'colors';
import { Command } from 'commander';
const program = new Command();
import runResultCmd from './cli-commands/run-result';
import runStatusCmd from './cli-commands/run-status';
import startCmd from './cli-commands/start';

const { version } = require('../package.json');

let noCommandExecuted = true;

// general
program
.description(`CloudBeat CLI service v${version}`)
.name('cloudbeat-cli')
.usage('<command> [options]')
.requiredOption('--apiKey <apiKey>', 'your CloudBeat API key')
.requiredOption('--apiBaseUrl <apiUrl>', 'API URL for a privately hosted CloudBeat instance (e.g. your local alternative to https://api.cloudbeat.io')
.option('-f, --failOnErrors <true|false>', 'controls whether to return non-successful exit code on errors or not')
.option('-d, --debug <true|false>', 'print debug information during execution');

// start command
program
.command('start <testType> <testId>', { isDefault: true })
.option('--project <projectName>', 'if project name is specified, then \'testId\' should specify case/suite name instead of an id')
.option('--tags <tags>', 'list of comma separated Suite tags to execute', tagsOptionParser)
.option('-a, --attr <attributes>', 'list of comma separated name-value pairs to be passed to the test script', attrOptionParser)
.option('-e, --env <environmentName>', 'name of the environment to be associated with the test')
.option('--envId <environmentId>', 'ID of the environment to be associated with the test')
.option('--build <buildName>', 'name of the build to be associated with the test result')
.option('--release <releaseName>', 'name of the release or version to be associated with the test result')
// .option('--pipeline <pipelineName>', 'name of the current pipeline to be associated with the test result')
// .option('--sprint <sprintName>', 'name of the current sprint to be associated with the test result')
.option('--suffix <time|id>', 'report file name suffix type - must be either "time" or "id"')
.option('--format <junit>', 'test result report format - currently only "junit" is supported')
.option('--folder <folder>', 'path to a directory where test results will be saved. current working directory is used by default.')
.option('--silent', 'do not print test progress details.')
.description('launch the specified type of test (case or suite) in CloudBeat')
.action((testType, testId,
    {
        attr={},
        tags=undefined,
        suffix=undefined,
        project: projectName,
        env: environmentName,
        envId: environmentId,
        build: buildName,
        release: releaseName,
        pipeline: pipelineName,
        sprint: sprintName,
        folder: folder,
        silent: silent,
    },
 ) => {
    noCommandExecuted = false;
    startCmd(testId, testType, program.apiKey, {
        attr,
        tags,
        host: program.apiBaseUrl,
        cwd: folder,
        reportFormat: program.format,
        reportFileSuffix: suffix,
        folder: folder,
        silent: silent,
        failOnErrors: program.failOnErrors,
        environmentName,
        environmentId: !isNaN(environmentId) ? parseInt(environmentId, 10) : environmentId,
        buildName,
        pipelineName,
        releaseName,
        sprintName,
        projectName,
    });
});

// run-status command
program
.command('run-status <runId>', { isDefault: false })
.description('get specified run status')
.action((runId) => {
    noCommandExecuted = false;
    runStatusCmd(runId, program.apiKey, {
        host: program.apiBaseUrl,
        failOnErrors: program.failOnErrors,
        debug: program.debug,
    });
});

// run-result command
program
.command('run-result <runId>', { isDefault: false })
.description('get test result for the specified test run')
.action((runId) => {
    noCommandExecuted = false;
    runResultCmd(runId, program.apiKey, program.apiBaseUrl, {
        failOnErrors: program.failOnErrors,
        debug: program.debug,
    });
});

program.parse(process.argv);

const makeRed = (txt: string) => {
    return colors.red(txt); // display the help text in red on the console
};

if (noCommandExecuted) {
    program.outputHelp(makeRed);
}

process.on('unhandledRejection', (error: any) => {
    console.log('UnhandledRejection error: ', error.message);
});

process.on('uncaughtException', (err, origin) => {
    console.log('Caught exception: ', err);
    console.log('Exception origin: ', origin);
});

process.on('warning', (warning) => {
    console.warn(warning.name);
    console.warn(warning.message);
    console.warn(warning.stack);
});

function attrOptionParser(optionValue: string) {
    const attrsListNameValueAsString = optionValue.split(',');
    const attrsHash: {[key: string]: string | string[]} = {};
    attrsListNameValueAsString.forEach((attrNameValueStr: string) => {
        if (attrNameValueStr.indexOf('=')) {
            const [ attrName, attrValue ] = attrNameValueStr.split('=');
            // if attr with this name already exists, add different values to the same attrs in form of Array
            if (attrsHash[attrName]) {
                if (Array.isArray(attrsHash[attrName])) {
                    (attrsHash[attrName] as string[]).push(attrValue);
                }
                else {
                    attrsHash[attrName] = [attrsHash[attrName] as string, attrValue];
                }
            }
            else {
                attrsHash[attrName] = attrValue;
            }
        }
    });
    return attrsHash;
}

function tagsOptionParser(optionValue: string) {
    let tags = optionValue.split(',');
    // trim any whitespace
    tags = tags.map(tag => tag.trim());
    // return only distinct
    const distinctTags = [...new Set(tags)];
    return distinctTags;
}
