/**
 * SpecLock MCP Autoinstaller
 * One-command installer: wires SpecLock as an MCP server into any AI client.
 *
 * Usage (CLI):
 *   speclock mcp install <client>     — claude-code|cursor|windsurf|cline|codex|all
 *   speclock mcp uninstall <client>
 *
 * The investor audit found the biggest manual friction was users having to
 * hand-edit JSON to wire up SpecLock as an MCP server. This module removes
 * that friction entirely — one command, any supported client, any OS.
 *
 * Developed by Sandeep Roy (https://github.com/sgroy10)
 */

import fs from "fs";
import path from "path";
import os from "os";

// The stanza we inject. Kept in one place so every client stays in sync.
export const SPECLOCK_MCP_STANZA = {
  command: "npx",
  args: ["-y", "speclock", "serve"],
};

export const SUPPORTED_CLIENTS = [
  "claude-code",
  "cursor",
  "windsurf",
  "cline",
  "codex",
  "all",
];

/**
 * Resolve the config file locations for a given client on the current OS.
 * Returns { primary, project } where each is { path, format }.
 * format is "json" | "toml" | "vscode-json".
 *
 * - primary  = global/user-level config (always attempted)
 * - project  = project-scoped config (only written if --project flag used)
 */
export function getClientConfigPaths(client, projectRoot = process.cwd()) {
  const home = os.homedir();
  const platform = process.platform; // "win32" | "darwin" | "linux"

  switch (client) {
    case "claude-code": {
      return {
        primary: {
          path: path.join(home, ".claude", "mcp.json"),
          format: "json",
          label: "Claude Code",
        },
        project: {
          path: path.join(projectRoot, ".mcp.json"),
          format: "json",
          label: "Claude Code (project)",
        },
      };
    }

    case "cursor": {
      return {
        primary: {
          path: path.join(home, ".cursor", "mcp.json"),
          format: "json",
          label: "Cursor",
        },
        project: {
          path: path.join(projectRoot, ".cursor", "mcp.json"),
          format: "json",
          label: "Cursor (project)",
        },
      };
    }

    case "windsurf": {
      return {
        primary: {
          path: path.join(home, ".codeium", "windsurf", "mcp_config.json"),
          format: "json",
          label: "Windsurf",
        },
        project: null,
      };
    }

    case "cline": {
      // Cline lives inside VS Code User settings.json.
      let settingsPath;
      if (platform === "win32") {
        settingsPath = path.join(
          process.env.APPDATA || path.join(home, "AppData", "Roaming"),
          "Code",
          "User",
          "settings.json"
        );
      } else if (platform === "darwin") {
        settingsPath = path.join(
          home,
          "Library",
          "Application Support",
          "Code",
          "User",
          "settings.json"
        );
      } else {
        settingsPath = path.join(home, ".config", "Code", "User", "settings.json");
      }
      return {
        primary: {
          path: settingsPath,
          format: "vscode-json",
          label: "Cline (VS Code settings)",
        },
        project: null,
      };
    }

    case "codex": {
      return {
        primary: {
          path: path.join(home, ".codex", "config.toml"),
          format: "toml",
          label: "Codex",
        },
        project: null,
      };
    }

    default:
      throw new Error(
        `Unknown client "${client}". Supported: ${SUPPORTED_CLIENTS.join(", ")}`
      );
  }
}

// --- JSON helpers ---

function readJsonSafe(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8").trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`Could not parse JSON at ${filePath}: ${e.message}`);
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

/**
 * Merge speclock into a plain JSON config that uses "mcpServers".
 * Preserves all other servers and top-level keys.
 */
function injectJson(config) {
  const next = { ...(config || {}) };
  if (!next.mcpServers || typeof next.mcpServers !== "object") {
    next.mcpServers = {};
  }
  next.mcpServers = {
    ...next.mcpServers,
    speclock: { ...SPECLOCK_MCP_STANZA },
  };
  return next;
}

function removeJson(config) {
  if (!config || typeof config !== "object") return { changed: false, config };
  if (!config.mcpServers || !config.mcpServers.speclock) {
    return { changed: false, config };
  }
  const next = { ...config, mcpServers: { ...config.mcpServers } };
  delete next.mcpServers.speclock;
  return { changed: true, config: next };
}

/**
 * VS Code settings.json uses JSONC (comments + trailing commas).
 * We do a best-effort: if parse fails, we fall back to a safe string rewrite
 * that touches only the "cline.mcpServers" block.
 */
function injectVsCodeJson(filePath) {
  const exists = fs.existsSync(filePath);
  let parsed = null;
  let raw = "";

  if (exists) {
    raw = fs.readFileSync(filePath, "utf-8");
    try {
      // Try a lenient parse: strip line/block comments and trailing commas.
      const stripped = raw
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1")
        .replace(/,(\s*[}\]])/g, "$1");
      parsed = stripped.trim() ? JSON.parse(stripped) : {};
    } catch {
      parsed = null; // fall back to string append below
    }
  }

  if (parsed !== null) {
    const next = { ...parsed };
    // Cline reads either "cline.mcpServers" or "mcpServers". We write the
    // Cline-specific key to avoid clashing with other VS Code extensions.
    const existing = next["cline.mcpServers"] || {};
    next["cline.mcpServers"] = {
      ...existing,
      speclock: { ...SPECLOCK_MCP_STANZA },
    };
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(next, null, 2) + "\n", "utf-8");
    return { mode: "parsed" };
  }

  // Fallback: file has comments or odd formatting. Append a marker block.
  // This is safe: VS Code's JSONC parser accepts duplicate keys (last wins)
  // but to avoid corruption we just warn the user instead of rewriting.
  throw new Error(
    `Could not safely parse VS Code settings at ${filePath}. ` +
      `Please add this manually:\n` +
      `  "cline.mcpServers": { "speclock": ${JSON.stringify(
        SPECLOCK_MCP_STANZA
      )} }`
  );
}

function removeVsCodeJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return { changed: false };
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  let parsed;
  try {
    const stripped = raw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1")
      .replace(/,(\s*[}\]])/g, "$1");
    parsed = stripped.trim() ? JSON.parse(stripped) : {};
  } catch {
    throw new Error(
      `Could not safely parse VS Code settings at ${filePath}. ` +
        `Please remove "speclock" from "cline.mcpServers" manually.`
    );
  }
  const block = parsed["cline.mcpServers"];
  if (!block || !block.speclock) return { changed: false };
  const next = { ...parsed, "cline.mcpServers": { ...block } };
  delete next["cline.mcpServers"].speclock;
  fs.writeFileSync(filePath, JSON.stringify(next, null, 2) + "\n", "utf-8");
  return { changed: true };
}

// --- TOML helpers (Codex ~/.codex/config.toml) ---
//
// Codex uses an extremely small TOML dialect for MCP servers:
//   [mcp_servers.speclock]
//   command = "npx"
//   args = ["-y", "speclock", "serve"]
//
// We do NOT pull in a TOML parser dependency. We implement a targeted
// inject/remove that leaves other [mcp_servers.*] tables untouched.

const CODEX_STANZA = [
  "",
  "[mcp_servers.speclock]",
  'command = "npx"',
  'args = ["-y", "speclock", "serve"]',
  "",
].join("\n");

function injectToml(filePath) {
  let existing = "";
  if (fs.existsSync(filePath)) {
    existing = fs.readFileSync(filePath, "utf-8");
    if (existing.includes("[mcp_servers.speclock]")) {
      return { changed: false, reason: "already present" };
    }
  } else {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const trimmed = existing.replace(/\s+$/, "");
  const next = (trimmed ? trimmed + "\n" : "") + CODEX_STANZA;
  fs.writeFileSync(filePath, next, "utf-8");
  return { changed: true };
}

function removeToml(filePath) {
  if (!fs.existsSync(filePath)) return { changed: false };
  const raw = fs.readFileSync(filePath, "utf-8");
  if (!raw.includes("[mcp_servers.speclock]")) {
    return { changed: false };
  }
  // Remove the [mcp_servers.speclock] block up to the next [section] or EOF.
  const cleaned = raw.replace(
    /\n?\[mcp_servers\.speclock\][\s\S]*?(?=\n\[|\n*$)/,
    ""
  );
  fs.writeFileSync(filePath, cleaned.replace(/\s+$/, "") + "\n", "utf-8");
  return { changed: true };
}

// --- Public API ---

/**
 * Install SpecLock MCP server into a single client.
 * Returns { client, writes: [{ path, status, label }], errors: [] }.
 */
export function installForClient(client, projectRoot = process.cwd(), options = {}) {
  const includeProject = options.includeProject !== false; // default: yes
  const result = { client, writes: [], errors: [] };

  let paths;
  try {
    paths = getClientConfigPaths(client, projectRoot);
  } catch (e) {
    result.errors.push(e.message);
    return result;
  }

  const targets = [paths.primary];
  if (includeProject && paths.project) targets.push(paths.project);

  for (const target of targets) {
    if (!target) continue;
    try {
      let status;
      if (target.format === "json") {
        const current = readJsonSafe(target.path) || {};
        const next = injectJson(current);
        writeJson(target.path, next);
        status = "installed";
      } else if (target.format === "vscode-json") {
        const out = injectVsCodeJson(target.path);
        status = out.mode === "parsed" ? "installed" : "installed";
      } else if (target.format === "toml") {
        const out = injectToml(target.path);
        status = out.changed ? "installed" : "already present";
      } else {
        throw new Error(`Unsupported format: ${target.format}`);
      }

      result.writes.push({
        path: target.path,
        status,
        label: target.label,
      });
    } catch (e) {
      result.errors.push(`${target.label}: ${e.message}`);
    }
  }

  return result;
}

/**
 * Uninstall SpecLock MCP server from a single client.
 */
export function uninstallForClient(client, projectRoot = process.cwd(), options = {}) {
  const includeProject = options.includeProject !== false;
  const result = { client, writes: [], errors: [] };

  let paths;
  try {
    paths = getClientConfigPaths(client, projectRoot);
  } catch (e) {
    result.errors.push(e.message);
    return result;
  }

  const targets = [paths.primary];
  if (includeProject && paths.project) targets.push(paths.project);

  for (const target of targets) {
    if (!target) continue;
    if (!fs.existsSync(target.path)) {
      result.writes.push({
        path: target.path,
        status: "not installed",
        label: target.label,
      });
      continue;
    }

    try {
      let changed = false;
      if (target.format === "json") {
        const current = readJsonSafe(target.path) || {};
        const out = removeJson(current);
        if (out.changed) {
          writeJson(target.path, out.config);
          changed = true;
        }
      } else if (target.format === "vscode-json") {
        const out = removeVsCodeJson(target.path);
        changed = out.changed;
      } else if (target.format === "toml") {
        const out = removeToml(target.path);
        changed = out.changed;
      }

      result.writes.push({
        path: target.path,
        status: changed ? "removed" : "not installed",
        label: target.label,
      });
    } catch (e) {
      result.errors.push(`${target.label}: ${e.message}`);
    }
  }

  return result;
}

/**
 * Install across all supported clients at once.
 */
export function installAll(projectRoot = process.cwd(), options = {}) {
  const clients = SUPPORTED_CLIENTS.filter((c) => c !== "all");
  const results = [];
  for (const c of clients) {
    results.push(installForClient(c, projectRoot, options));
  }
  return results;
}

export function uninstallAll(projectRoot = process.cwd(), options = {}) {
  const clients = SUPPORTED_CLIENTS.filter((c) => c !== "all");
  const results = [];
  for (const c of clients) {
    results.push(uninstallForClient(c, projectRoot, options));
  }
  return results;
}

/**
 * Format an install/uninstall result for console output.
 */
export function formatResult(result, action = "install") {
  const lines = [];
  const hasErrors = result.errors && result.errors.length > 0;
  const verb = action === "install" ? "added to" : "removed from";

  for (const w of result.writes) {
    if (w.status === "installed") {
      lines.push(`  [OK] SpecLock ${verb} ${w.label} config at: ${w.path}`);
    } else if (w.status === "removed") {
      lines.push(`  [OK] SpecLock ${verb} ${w.label} config at: ${w.path}`);
    } else if (w.status === "already present") {
      lines.push(`  [--] SpecLock already present in ${w.label}: ${w.path}`);
    } else if (w.status === "not installed") {
      lines.push(`  [--] SpecLock not present in ${w.label}: ${w.path}`);
    } else {
      lines.push(`  [??] ${w.label}: ${w.status} — ${w.path}`);
    }
  }

  if (hasErrors) {
    for (const e of result.errors) {
      lines.push(`  [!!] ${e}`);
    }
  }

  return lines.join("\n");
}

/**
 * Next-steps hint shown after a successful install.
 */
export function nextStepsFor(client) {
  const hints = {
    "claude-code": "Restart Claude Code to activate SpecLock.",
    cursor: "Restart Cursor (Cmd/Ctrl+Shift+P → Reload Window) to activate SpecLock.",
    windsurf: "Restart Windsurf to activate SpecLock.",
    cline: "Reload VS Code (Cmd/Ctrl+Shift+P → Developer: Reload Window) to activate SpecLock in Cline.",
    codex: "Restart Codex CLI to activate SpecLock.",
  };
  return hints[client] || "Restart your AI client to activate SpecLock.";
}
