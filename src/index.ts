#! /usr/bin/env node

// import program from 'commander';
import colors from 'colors';
import { Command } from 'commander';
const program = new Command();
import gitInfoCmd from './cli-commands/git-info';
import initCmd from './cli-commands/init';
import { login, logout, whoami } from './cli-commands/login';
import packCmd from './cli-commands/pack';
import * as projectCmd from './cli-commands/project';
import runResultCmd from './cli-commands/run-result';
import runStatusCmd from './cli-commands/run-status';
import startCmd from './cli-commands/start';
import syncCmd from './cli-commands/sync';
import { IAuth, resolveAuth } from './lib/config';
import * as out from './lib/output';

const { version } = require('../package.json');

let noCommandExecuted = true;

// general
program
.description(`CloudBeat CLI service v${version}`)
.name('cloudbeat-cli')
.version(version, '-v, --version', 'print CLI version')
.usage('<command> [options]')
.option('--apiKey <apiKey>', 'your CloudBeat API key. if not specified, CB_API_KEY environment variable or the key stored by "login" command is used')
.option('--apiBaseUrl <apiUrl>', 'API URL for a privately hosted CloudBeat instance (i.e. your local alternative to https://api.cloudbeat.io)')
.option('-f, --failOnErrors <true|false>', 'controls whether to return non-successful exit code on errors or not')
.option('--json', 'print command result as JSON (supported by: login, logout, whoami, init, git-info, pack, project)');

// resolves credentials from command line flags, environment variables, or the config stored by "login" command
const getAuth = (): IAuth => {
    out.setJsonMode(program.json);
    const auth = resolveAuth({ apiKey: program.apiKey, apiBaseUrl: program.apiBaseUrl });
    if (!auth) {
        return out.fail('API key is not specified. Run "cloudbeat-cli login", or use "--apiKey" option or CB_API_KEY environment variable.', 'not_logged_in');
    }
    return auth;
};

// login command
program
.command('login', { isDefault: false })
.option('--stdin', 'read API key from the standard input instead of prompting for it')
.description('store CloudBeat API key, so it does not have to be specified for each command')
.action((cmd) => {
    noCommandExecuted = false;
    out.setJsonMode(program.json);
    login({ apiKey: program.apiKey, apiBaseUrl: program.apiBaseUrl, stdin: cmd.stdin });
});

// logout command
program
.command('logout', { isDefault: false })
.description('remove stored CloudBeat API key')
.action(() => {
    noCommandExecuted = false;
    out.setJsonMode(program.json);
    logout();
});

// whoami command
program
.command('whoami', { isDefault: false })
.description('show and verify the credentials currently in use')
.action(() => {
    noCommandExecuted = false;
    out.setJsonMode(program.json);
    whoami({ apiKey: program.apiKey, apiBaseUrl: program.apiBaseUrl });
});

// git-info command
program
.command('git-info [dir]', { isDefault: false })
.description('detect Git repository URL and branch of the specified (or current) directory')
.action((dir) => {
    noCommandExecuted = false;
    out.setJsonMode(program.json);
    gitInfoCmd(dir);
});

// pack command
program
.command('pack [dir]', { isDefault: false })
.storeOptionsAsProperties(false)
.passCommandToAction(false)
.option('-o, --output <zipPath>', 'path of the zip archive to create. "<dir name>.zip" in the current directory by default')
.option('--list', 'only list files which would be packed, without creating the archive')
.option('--all', 'include git-ignored files as well, e.g. when uploading build output (.cbignore still applies)')
.description('pack project directory into a zip archive, honoring .gitignore and .cbignore')
.action((dir, opts) => {
    noCommandExecuted = false;
    out.setJsonMode(program.json);
    packCmd(dir, opts);
});

// init command
program
.command('init [dir]', { isDefault: false })
.storeOptionsAsProperties(false)
.passCommandToAction(false)
.option('--agent <agent>', 'AI coding agent to install the CloudBeat setup wizard for. supported: claude', 'claude')
.option('--force', 'overwrite wizard files which were modified locally')
.description('install the AI assisted CloudBeat setup wizard into the specified (or current) test project directory')
.action((dir, opts) => {
    noCommandExecuted = false;
    out.setJsonMode(program.json);
    initCmd(dir, opts);
});

// project commands
const projectCommands = program
.command('project', { isDefault: false })
.description('manage CloudBeat projects: list, create, sync, status');

projectCommands
.command('list')
.description('list projects accessible to the current user')
.action(() => {
    noCommandExecuted = false;
    projectCmd.list(getAuth());
});

projectCommands
.command('create')
.storeOptionsAsProperties(false)
.passCommandToAction(false)
.requiredOption('--name <name>', 'project name')
.requiredOption('--type <type>', `project type: ${projectCmd.PROJECT_TYPES.join(', ')}`)
.requiredOption('--sync <git|manual|none>', 'how project files are delivered to CloudBeat')
.option('--git-url <url>', 'Git repository HTTPS URL. detected from the current directory by default')
.option('--git-branch <branch>', 'Git branch. detected from the current directory by default')
.option('--git-auth', 'provide Git credentials now: asked interactively, or taken from CB_GIT_TOKEN and CB_GIT_USERNAME environment variables')
.option('--dir <dir>', 'manual sync: directory to pack and upload. Git sync: directory to detect the repository from')
.option('--file <zipPath>', 'manual sync: zip archive to upload')
.option('--all', 'include git-ignored files as well, e.g. when uploading build output (.cbignore still applies)')
.option('--exec-command <command>', 'test execution command. project type default is used if not specified')
.option('--exec-options <options>', 'test execution options (TestNG, JUnit, Cucumber)')
.option('--assembly-names <names>', 'test assembly names (MSTestBinary, NUnit3Binary)')
.option('--notes <notes>', 'project notes')
.option('--wait', 'wait for the initial synchronization to finish')
.description('create a new project')
.action((opts) => {
    noCommandExecuted = false;
    projectCmd.create(getAuth(), opts);
});

projectCommands
.command('sync <project>')
.storeOptionsAsProperties(false)
.passCommandToAction(false)
.option('--dir <dir>', 'directory to pack and upload (manual sync projects)')
.option('--file <zipPath>', 'zip archive to upload (manual sync projects)')
.option('--all', 'include git-ignored files as well, e.g. when uploading build output (.cbignore still applies)')
.option('--wait', 'wait for the synchronization to finish')
.description('synchronize project by name or id: triggers Git synchronization, or uploads files if --dir or --file is specified')
.action((projectNameOrId, opts) => {
    noCommandExecuted = false;
    projectCmd.sync(getAuth(), projectNameOrId, opts);
});

projectCommands
.command('status <project>')
.description('get synchronization status of a project specified by name or id')
.action((projectNameOrId) => {
    noCommandExecuted = false;
    projectCmd.status(getAuth(), projectNameOrId);
});

// sync command
program
.command('sync <project> <filePath>', { isDefault: false })
.description('upload and synchronize ZIP-based project artifacts')
.action(
    (
        project,
        filePath,
    ) => {
        noCommandExecuted = false;
        const auth = getAuth();
        syncCmd(project, filePath, auth.apiKey, auth.apiBaseUrl, program.failOnErrors);
    },
);

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
    const auth = getAuth();
    startCmd(testId, testType, auth.apiKey, {
        attr,
        tags,
        host: auth.apiBaseUrl,
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
    const auth = getAuth();
    runStatusCmd(runId, auth.apiKey, {
        host: auth.apiBaseUrl,
        failOnErrors: program.failOnErrors,
    });
});

// run-result command
program
.command('run-result <runId>', { isDefault: false })
.description('get test result for the specified test run')
.action((runId) => {
    noCommandExecuted = false;
    const auth = getAuth();
    runResultCmd(runId, auth.apiKey, auth.apiBaseUrl, {
        failOnErrors: program.failOnErrors,
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
