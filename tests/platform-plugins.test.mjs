import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = async (file) => JSON.parse(await readFile(path.join(root, file), 'utf8'));

const portable = await json('plugin.json');
assert.equal(portable.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
assert.equal(portable.name, 'speclock');
assert.equal(portable.version, '5.8.0');

const cursorMcp = await json('mcp.json');
assert.deepEqual(cursorMcp.mcpServers.speclock.args.slice(0, 2), ['--yes', 'speclock@5.8.0']);

const gemini = await json('gemini-extension.json');
assert.equal(gemini.name, 'speclock');
assert.equal(gemini.contextFileName, 'SPECLOCK-GEMINI.md');
assert.equal(gemini.mcpServers.speclock.command, 'npx');

const codex = await json('plugins/speclock/.codex-plugin/plugin.json');
assert.equal(codex.version, '5.8.0');
assert.equal(codex.mcpServers, './.mcp.json');
assert.equal(codex.skills, './skills/');

const codexMcp = await json('plugins/speclock/.mcp.json');
assert.deepEqual(codexMcp.mcpServers.speclock.args.slice(0, 2), ['--yes', 'speclock@5.8.0']);

const skill = await readFile(path.join(root, 'plugins/speclock/skills/speclock-guardrails/SKILL.md'), 'utf8');
assert.match(skill, /^---\nname: speclock-guardrails\n/);
assert.doesNotMatch(skill, /TODO/);
assert.match(skill, /does not prove factual correctness or eliminate hallucinations/i);

console.log('Platform plugin packaging tests passed (Cursor/Agent Plugin, Gemini CLI, Codex).');
