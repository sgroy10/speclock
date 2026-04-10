/**
 * Unit tests for src/core/mcp-install.js
 * Runs with `node tests/mcp-install.test.mjs`.
 * Uses a temporary HOME directory and monkey-patches os.homedir.
 */

import os from "os";
import fs from "fs";
import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const fakeHome = path.join(repoRoot, ".test-home-mcp");

// Monkey-patch os.homedir BEFORE importing the module under test
fs.rmSync(fakeHome, { recursive: true, force: true });
fs.mkdirSync(fakeHome, { recursive: true });
os.homedir = () => fakeHome;

const projectDir = path.join(fakeHome, "project");
fs.mkdirSync(projectDir, { recursive: true });

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
    console.log(`  [OK] ${name}`);
  } catch (e) {
    results.push({ name, ok: false, err: e.message });
    console.error(`  [FAIL] ${name}: ${e.message}`);
  }
}

const m = await import("../src/core/mcp-install.js");

// --- Test 1: fresh install to claude-code creates file ---
test("claude-code fresh install", () => {
  const r = m.installForClient("claude-code", projectDir);
  if (r.errors.length > 0) throw new Error(r.errors.join("; "));
  if (r.writes.length !== 2) throw new Error(`expected 2 writes, got ${r.writes.length}`);
  for (const w of r.writes) {
    if (w.status !== "installed") throw new Error(`write ${w.path} status=${w.status}`);
    const cfg = JSON.parse(fs.readFileSync(w.path, "utf-8"));
    if (!cfg.mcpServers?.speclock?.command) throw new Error(`missing speclock in ${w.path}`);
    if (cfg.mcpServers.speclock.command !== "npx") throw new Error("wrong command");
  }
});

// --- Test 2: install preserves existing servers and top-level keys ---
test("claude-code merge preserves existing", () => {
  const existingCfg = {
    mcpServers: {
      existingServer: { command: "node", args: ["other.js"] },
    },
    otherTopLevel: "preserved",
  };
  const claudeMcpPath = path.join(fakeHome, ".claude", "mcp.json");
  fs.writeFileSync(claudeMcpPath, JSON.stringify(existingCfg, null, 2));

  m.installForClient("claude-code", projectDir, { includeProject: false });
  const cfg = JSON.parse(fs.readFileSync(claudeMcpPath, "utf-8"));
  if (!cfg.mcpServers.existingServer) throw new Error("existing server dropped");
  if (!cfg.mcpServers.speclock) throw new Error("speclock not added");
  if (cfg.otherTopLevel !== "preserved") throw new Error("top-level key dropped");
});

// --- Test 3: uninstall removes speclock but preserves other servers ---
test("claude-code uninstall preserves other servers", () => {
  m.uninstallForClient("claude-code", projectDir, { includeProject: false });
  const claudeMcpPath = path.join(fakeHome, ".claude", "mcp.json");
  const cfg = JSON.parse(fs.readFileSync(claudeMcpPath, "utf-8"));
  if (cfg.mcpServers.speclock) throw new Error("speclock still present after uninstall");
  if (!cfg.mcpServers.existingServer) throw new Error("existing server dropped on uninstall");
});

// --- Test 4: cursor install ---
test("cursor install", () => {
  const r = m.installForClient("cursor", projectDir);
  if (r.errors.length > 0) throw new Error(r.errors.join("; "));
  const cfg = JSON.parse(
    fs.readFileSync(path.join(fakeHome, ".cursor", "mcp.json"), "utf-8")
  );
  if (!cfg.mcpServers.speclock) throw new Error("cursor speclock missing");
});

// --- Test 5: windsurf install (no project scope) ---
test("windsurf install", () => {
  const r = m.installForClient("windsurf", projectDir);
  if (r.errors.length > 0) throw new Error(r.errors.join("; "));
  if (r.writes.length !== 1) throw new Error(`expected 1 write (no project), got ${r.writes.length}`);
  const cfg = JSON.parse(
    fs.readFileSync(
      path.join(fakeHome, ".codeium", "windsurf", "mcp_config.json"),
      "utf-8"
    )
  );
  if (!cfg.mcpServers.speclock) throw new Error("windsurf speclock missing");
});

// --- Test 6: codex install (TOML) ---
test("codex install (TOML)", () => {
  // Seed an existing TOML config with another server
  const codexPath = path.join(fakeHome, ".codex", "config.toml");
  fs.mkdirSync(path.dirname(codexPath), { recursive: true });
  fs.writeFileSync(
    codexPath,
    `[mcp_servers.other]\ncommand = "node"\nargs = ["x.js"]\n`
  );

  const r = m.installForClient("codex", projectDir);
  if (r.errors.length > 0) throw new Error(r.errors.join("; "));
  const toml = fs.readFileSync(codexPath, "utf-8");
  if (!toml.includes("[mcp_servers.speclock]")) throw new Error("speclock block missing");
  if (!toml.includes("[mcp_servers.other]")) throw new Error("other block dropped");
  if (!toml.includes('command = "npx"')) throw new Error("command not written");
});

// --- Test 7: codex uninstall (TOML) preserves other block ---
test("codex uninstall (TOML) preserves others", () => {
  const codexPath = path.join(fakeHome, ".codex", "config.toml");
  m.uninstallForClient("codex", projectDir);
  const toml = fs.readFileSync(codexPath, "utf-8");
  if (toml.includes("[mcp_servers.speclock]")) throw new Error("speclock block still present");
  if (!toml.includes("[mcp_servers.other]")) throw new Error("other block dropped");
});

// --- Test 8: cline install (VS Code settings JSONC) ---
test("cline install (VS Code)", () => {
  // Seed an existing VS Code settings.json with a comment (JSONC) — our
  // parser should still cope.
  const paths = m.getClientConfigPaths("cline", projectDir);
  const settingsPath = paths.primary.path;
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(
    settingsPath,
    `{\n  // a comment\n  "editor.fontSize": 14\n}\n`
  );

  const r = m.installForClient("cline", projectDir);
  if (r.errors.length > 0) throw new Error(r.errors.join("; "));
  const cfg = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
  if (!cfg["cline.mcpServers"]?.speclock) throw new Error("cline speclock missing");
  if (cfg["editor.fontSize"] !== 14) throw new Error("editor.fontSize dropped");
});

// --- Test 9: installAll invokes every client ---
test("installAll covers every client", () => {
  const rs = m.installAll(projectDir);
  const clients = rs.map((r) => r.client);
  for (const expected of ["claude-code", "cursor", "windsurf", "cline", "codex"]) {
    if (!clients.includes(expected)) throw new Error(`missing ${expected}`);
  }
});

// --- Test 10: unknown client throws clean error ---
test("unknown client raises error", () => {
  const r = m.installForClient("not-a-real-client", projectDir);
  if (r.errors.length === 0) throw new Error("expected errors for unknown client");
});

// Cleanup
fs.rmSync(fakeHome, { recursive: true, force: true });

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) process.exit(1);
