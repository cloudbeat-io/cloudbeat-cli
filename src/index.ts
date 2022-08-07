#! /usr/bin/env node

// import program from 'commander';
import colors from 'colors';
import { Command } from 'commander';
const program = new Command();
import runCmd from './cli-commands/run';
import runResultCmd from './cli-commands/run-result';
import runStatusCmd from './cli-commands/run-status';

const { version } = require('../package.json');

let noCommandExecuted = true;

// general
program
.description(`CloudBeat CLI service v${  version}`)
.name('cloudbeat-cli')
.usage('<command> [options]')
.option('-foe, --failOnErrors <fail-on-errors>', 'controls whether to return non-successful exit code on errors or not')
.option('-dbg, --debug <debug>', 'print debug information during execution');
// .option('-f, --format <format>', 'test result format for run command. Default is `junit`.');

// run command
program
.command('run <testId> <testType> <apiKey> [host] [folder]', { isDefault: true })
.option('-t, --tags <tags>', 'comma separated tag list to be associated with the test result', tagsOptionParser)
.description('run specified test case or suite in CloudBeat')
.action((testId, testType, apiKey, host, folder, { tags={} }) => {
    noCommandExecuted = false;
    runCmd(testId, testType, apiKey, {
        tags,
        host,
        cwd: folder,
        format: program.format,
        folder: folder,
        failOnErrors: program.failOnErrors,
    });
});

// run-status command
program
.command('run-status <runId> <apiKey> [host]', { isDefault: false })
.description('get specified run status')
.action((runId, apiKey, host = null) => {
    noCommandExecuted = false;

    runStatusCmd(runId, apiKey, {
        host,
        failOnErrors: program.failOnErrors,
        debug: program.debug,
    });
});

// run-result command
program
.command('run-result <runId> <apiKey> [host]', { isDefault: false })
.description('get test result for the specified test run')
.action((runId, apiKey, host = null) => {
    noCommandExecuted = false;
    runResultCmd(runId, apiKey, host, {
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
