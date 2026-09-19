import fs from 'fs';
import path from 'path';
import * as out from '../lib/output';

// agent name -> directory inside the target project where the wizard files are installed
const AGENT_TARGET_DIRS: { [agent: string]: string } = {
    claude: '.claude',
};

const AGENT_NEXT_STEPS: { [agent: string]: string } = {
    claude: 'Open Claude Code in this directory and run /cloudbeat to start the setup wizard.',
};

const listFiles = (dir: string, relDir = ''): string[] => {
    const result: string[] = [];
    for (const entry of fs.readdirSync(path.join(dir, relDir), { withFileTypes: true })) {
        const relPath = path.join(relDir, entry.name);
        if (entry.isDirectory()) {
            result.push(...listFiles(dir, relPath));
        }
        else if (entry.isFile() && entry.name !== '.DS_Store') {
            result.push(relPath);
        }
    }
    return result;
};

export default function(dir: string | undefined, { agent = 'claude', force = false }: { agent?: string; force?: boolean }) {
    const agentName = agent.toLowerCase();
    const targetSubDir = AGENT_TARGET_DIRS[agentName];
    if (!targetSubDir) {
        return out.fail(`Unsupported agent: ${agent}. Supported agents: ${Object.keys(AGENT_TARGET_DIRS).join(', ')}`, 'invalid_args');
    }

    const projectDir = path.resolve(dir || process.cwd());
    if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) {
        return out.fail(`Directory not found: ${projectDir}`, 'invalid_args');
    }

    // agent files are shipped with the package, next to the "build" directory
    const sourceDir = path.join(__dirname, '..', '..', 'agents', agentName);
    if (!fs.existsSync(sourceDir)) {
        return out.fail(`Wizard files not found at ${sourceDir} - the CLI installation is incomplete.`);
    }

    const targetDir = path.join(projectDir, targetSubDir);
    const created: string[] = [];
    const updated: string[] = [];
    const unchanged: string[] = [];
    const skipped: string[] = [];

    try {
        for (const relPath of listFiles(sourceDir)) {
            const content = fs.readFileSync(path.join(sourceDir, relPath));
            const targetPath = path.join(targetDir, relPath);
            const displayPath = path.join(targetSubDir, relPath);

            if (!fs.existsSync(targetPath)) {
                fs.mkdirSync(path.dirname(targetPath), { recursive: true });
                fs.writeFileSync(targetPath, content);
                created.push(displayPath);
            }
            else if (fs.readFileSync(targetPath).equals(content)) {
                unchanged.push(displayPath);
            }
            // the file differs: either modified by the user, or installed by another CLI version
            else if (force) {
                fs.writeFileSync(targetPath, content);
                updated.push(displayPath);
            }
            else {
                skipped.push(displayPath);
            }
        }
    }
    catch (e: any) {
        return out.fail(`Failed to install the setup wizard: ${out.errorMessage(e)}`);
    }

    const lines = [
        `CloudBeat setup wizard for ${agentName} installed into ${targetDir}`,
        `  ${created.length} file(s) created, ${updated.length} updated, ${unchanged.length} unchanged`,
    ];
    if (skipped.length > 0) {
        lines.push(`  ${skipped.length} file(s) differ from this CLI version and were left untouched (use --force to overwrite):`);
        skipped.forEach(f => lines.push(`    ${f}`));
    }
    lines.push('', AGENT_NEXT_STEPS[agentName]);

    return out.success({ agent: agentName, targetDir, created, updated, unchanged, skipped, nextStep: AGENT_NEXT_STEPS[agentName] }, lines.join('\n'));
}
