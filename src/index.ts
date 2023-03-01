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
.requiredOption('--apiKey <api-key>', 'your CloudBeat API key')
.option('--apiBaseUrl <base-url>', 'API URL to privately hosted CloudBeat instance (e.g. your local alternative to https://api.cloudbeat.io')
.option('-f, --failOnErrors <fail-on-errors>', 'controls whether to return non-successful exit code on errors or not')
.option('-d, --debug <debug>', 'print debug information during execution');

// start command
program
.command('start <testType> <testId> [folder]', { isDefault: true })
.option('-t, --tags <tags>', 'comma separated tag list to be associated with the test result', tagsOptionParser)
.option('--suffix [time|id]', 'report file name suffix type - must be either "time" or "id"')
.option('--format [junit]', 'test result report format - currently only "junit" is supported')
.description('start running specified type of test (case or suite) in CloudBeat')
.action((testType, testId, folder, { tags={}, suffix=undefined }) => {
    noCommandExecuted = false;
    startCmd(testId, testType, program.apiKey, {
        tags,
        host: program.apiBaseUrl,
        cwd: folder,
        reportFormat: program.format,
        reportFileSuffix: suffix,
        folder: folder,
        failOnErrors: program.failOnErrors,
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

function tagsOptionParser(optionValue: string) {
    const tagsListNameValueAsString = optionValue.split(',');
    const tagsHash: {[key: string]: string | string[]} = {};
    tagsListNameValueAsString.forEach((tagNameValueStr: string) => {
        if (tagNameValueStr.indexOf('=')) {
            const [ tagName, tagValue ] = tagNameValueStr.split('=');
            // if tag with this name already exists, add different values to the same tags in form of Array
            if (tagsHash[tagName]) {
                if (Array.isArray(tagsHash[tagName])) {
                    (tagsHash[tagName] as string[]).push(tagValue);
                }
                else {
                    tagsHash[tagName] = [tagsHash[tagName] as string, tagValue];
                }
            }
            else {
                tagsHash[tagName] = tagValue;
            }
        }
    });
    return tagsHash;
}
