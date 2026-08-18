import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const manifest = JSON.parse(readFileSync(".claude-plugin/plugin.json", "utf8"));
const marketplace = JSON.parse(readFileSync(".claude-plugin/marketplace.json", "utf8"));
const mcp = JSON.parse(readFileSync(".mcp.json", "utf8"));
const hooks = JSON.parse(readFileSync("hooks/hooks.json", "utf8"));

assert.equal(manifest.name, "speclock");
assert.equal(manifest.version, "5.8.0");
assert.equal(marketplace.plugins[0].source, ".");
assert.ok(mcp.mcpServers.speclock);
assert.equal(hooks.hooks.PreToolUse[0].matcher, "Write|Edit|Bash");

const hook = spawnSync("node", ["scripts/claude-hook.js"], {
  input: JSON.stringify({
    cwd: process.cwd(),
    tool_name: "Write",
    tool_input: { file_path: "safe.txt", content: "Add harmless documentation." },
  }),
  encoding: "utf8",
  timeout: 30000,
});

assert.equal(hook.status, 0);
assert.doesNotThrow(() => hook.stdout.trim() && JSON.parse(hook.stdout));

const fixture = mkdtempSync(join(tmpdir(), "speclock-plugin-test-"));
spawnSync("git", ["init", "-q"], { cwd: fixture });
writeFileSync(join(fixture, "CLAUDE.md"), "NEVER delete customer data.\n");
const protect = spawnSync(
  "node",
  [join(process.cwd(), "bin/speclock.js"), "protect", "--strict"],
  { cwd: fixture, encoding: "utf8" },
);
assert.equal(protect.status, 0);

const denied = spawnSync("node", ["scripts/claude-hook.js"], {
  input: JSON.stringify({
    cwd: fixture,
    tool_name: "Bash",
    tool_input: { command: "delete all customer data" },
  }),
  encoding: "utf8",
});
const denial = JSON.parse(denied.stdout);
assert.equal(denial.hookSpecificOutput.permissionDecision, "deny");
console.log("Claude plugin: 7/7 passed");
