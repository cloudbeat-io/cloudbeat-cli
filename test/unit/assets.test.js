const fs = require('fs');
const assert = require('node:assert');
const { describe, it } = require('node:test');
const path = require('path');
const { PROJECT_TYPES } = require('../../build/cli-commands/project');

const SKILL_DIR = path.join(__dirname, '..', '..', 'agents', 'claude', 'skills', 'cloudbeat-setup');
const COMMANDS_DIR = path.join(__dirname, '..', '..', 'agents', 'claude', 'commands');

const frontmatter = file => {
    const match = /^---\n([\s\S]*?)\n---\n/.exec(fs.readFileSync(file, 'utf8'));
    assert.ok(match, `${file} has no frontmatter`);
    return match[1];
};

describe('wizard assets', () => {
    const kits = fs.readdirSync(path.join(SKILL_DIR, 'kits')).filter(f => f.endsWith('.md'));

    it('every kit recipe declares flavor, a valid project type and capabilities', () => {
        assert.ok(kits.length >= 9);
        for (const kit of kits) {
            const fm = frontmatter(path.join(SKILL_DIR, 'kits', kit));
            assert.match(fm, new RegExp(`^flavor: ${kit.replace('.md', '')}$`, 'm'), `${kit}: flavor must match the file name`);
            assert.match(fm, /^capabilities:$/m, `${kit}: capabilities missing`);
            const type = /^projectType: (\w+)/m.exec(fm);
            assert.ok(type && PROJECT_TYPES.includes(type[1]), `${kit}: unknown projectType`);
        }
    });

    it('every recipe referenced from project-types.md or another recipe exists', () => {
        const sources = [path.join(SKILL_DIR, 'reference', 'project-types.md'), ...kits.map(k => path.join(SKILL_DIR, 'kits', k))];
        for (const source of sources) {
            const text = fs.readFileSync(source, 'utf8');
            const refs = [...text.matchAll(/`((?:java|node|dotnet|python)-[a-z0-9-]+)(?:\.md)?`/g)].map(m => m[1]);
            for (const ref of refs) {
                assert.ok(kits.includes(`${ref}.md`), `${path.basename(source)} references missing recipe "${ref}"`);
            }
        }
    });

    it('every file referenced from SKILL.md and the commands exists', () => {
        const skill = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
        for (const ref of [...skill.matchAll(/`((?:questions|reference)\/[\w.-]+\.md)`/g)].map(m => m[1])) {
            assert.ok(fs.existsSync(path.join(SKILL_DIR, ref)), `SKILL.md references missing ${ref}`);
        }
        for (const command of fs.readdirSync(COMMANDS_DIR)) {
            const text = fs.readFileSync(path.join(COMMANDS_DIR, command), 'utf8');
            assert.match(frontmatter(path.join(COMMANDS_DIR, command)), /^description: .+/m);
            for (const ref of [...text.matchAll(/`\.claude\/(skills\/[\w./-]+\.md)`/g)].map(m => m[1])) {
                assert.ok(fs.existsSync(path.join(COMMANDS_DIR, '..', ref)), `${command} references missing ${ref}`);
            }
        }
    });

    it('project types offered by the wizard are accepted by the CLI', () => {
        const text = fs.readFileSync(path.join(SKILL_DIR, 'reference', 'project-types.md'), 'utf8');
        const rows = text.split('\n').filter(l => l.startsWith('|') && !l.startsWith('|---') && !l.startsWith('| Detection'));
        for (const row of rows) {
            const typeCell = row.split('|')[3];
            for (const type of [...typeCell.matchAll(/`(\w+)`/g)].map(m => m[1])) {
                assert.ok(PROJECT_TYPES.includes(type), `project-types.md offers unknown type "${type}"`);
            }
        }
    });

    it('no asset contains something that looks like a real secret', () => {
        const walk = dir => fs.readdirSync(dir, { withFileTypes: true })
            .flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
        for (const file of walk(path.join(SKILL_DIR, '..', '..'))) {
            assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /(ghp_[A-Za-z0-9]{20,}|glpat-[\w-]{20,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i, file);
        }
    });
});
