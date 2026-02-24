import path from "path";
import {
  ensureInit,
  setGoal,
  addLock,
  removeLock,
  addDecision,
  addNote,
  updateDeployFacts,
  watchRepo,
} from "../core/engine.js";
import { generateContext } from "../core/context.js";
import { readBrain } from "../core/storage.js";

// --- Argument parsing ---

function parseArgs(argv) {
  const args = argv.slice(2);
  const cmd = args.shift() || "";
  return { cmd, args };
}

function parseFlags(args) {
  const out = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (!next || next.startsWith("--")) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

function parseTags(raw) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function rootDir() {
  return process.cwd();
}

// --- Help text ---

function printHelp() {
  console.log(`
SpecLock v1.1.0 — AI Continuity Engine
Developed by Sandeep Roy (github.com/sgroy10)

Usage: speclock <command> [options]

Commands:
  init                          Initialize SpecLock in current directory
  goal <text>                   Set or update the project goal
  lock <text> [--tags a,b]      Add a non-negotiable constraint (SpecLock)
  lock remove <id>              Remove a lock by ID
  decide <text> [--tags a,b]    Record a decision
  note <text> [--pinned]        Add a pinned note
  facts deploy [--provider X]   Set deployment facts
  context                       Generate and print context pack
  watch                         Start file watcher (auto-track changes)
  serve [--project <path>]      Start MCP stdio server
  status                        Show project brain summary

Options:
  --tags <a,b,c>                Comma-separated tags
  --source <user|agent>         Who created this (default: user)
  --provider <name>             Deploy provider
  --branch <name>               Deploy branch
  --autoDeploy <true|false>     Auto-deploy setting
  --url <url>                   Deployment URL
  --notes <text>                Additional notes
  --project <path>              Project root (for serve)

Examples:
  speclock init
  speclock goal "Ship v1 of the continuity engine"
  speclock lock "No external database in v1" --tags scope
  speclock decide "Use MCP as primary integration" --tags architecture
  speclock context
  speclock serve --project /path/to/repo

MCP Tools (19): init, get_context, set_goal, add_lock, remove_lock,
  add_decision, add_note, set_deploy_facts, log_change, get_changes,
  get_events, check_conflict, session_briefing, session_summary,
  checkpoint, repo_status, suggest_locks, detect_drift, health
`);
}

// --- Status display ---

function showStatus(root) {
  const brain = readBrain(root);
  if (!brain) {
    console.log("SpecLock not initialized. Run: speclock init");
    return;
  }

  const activeLocks = brain.specLock.items.filter((l) => l.active !== false);

  console.log(`\nSpecLock Status — ${brain.project.name}`);
  console.log("=".repeat(50));
  console.log(`Goal: ${brain.goal.text || "(not set)"}`);
  console.log(`SpecLocks: ${activeLocks.length} active`);
  console.log(`Decisions: ${brain.decisions.length}`);
  console.log(`Notes: ${brain.notes.length}`);
  console.log(`Events: ${brain.events.count}`);
  console.log(`Deploy: ${brain.facts.deploy.provider}`);

  if (brain.sessions.current) {
    console.log(`Session: active (${brain.sessions.current.toolUsed})`);
  } else {
    console.log(`Session: none active`);
  }

  if (brain.sessions.history.length > 0) {
    const last = brain.sessions.history[0];
    console.log(
      `Last session: ${last.toolUsed} — ${last.summary || "(no summary)"}`
    );
  }

  console.log(`Recent changes: ${brain.state.recentChanges.length}`);
  console.log(`Reverts: ${brain.state.reverts.length}`);
  console.log("");
}

// --- Main ---

async function main() {
  const { cmd, args } = parseArgs(process.argv);
  const root = rootDir();

  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    printHelp();
    process.exit(0);
  }

  if (cmd === "init") {
    ensureInit(root);
    console.log("SpecLock initialized.");
    return;
  }

  if (cmd === "goal") {
    const text = args.join(" ").trim();
    if (!text) {
      console.error("Error: Goal text is required.");
      console.error("Usage: speclock goal <text>");
      process.exit(1);
    }
    setGoal(root, text);
    console.log(`Goal set: "${text}"`);
    return;
  }

  if (cmd === "lock") {
    // Check for "lock remove <id>"
    if (args[0] === "remove") {
      const lockId = args[1];
      if (!lockId) {
        console.error("Error: Lock ID is required.");
        console.error("Usage: speclock lock remove <lockId>");
        process.exit(1);
      }
      const result = removeLock(root, lockId);
      if (result.removed) {
        console.log(`Lock removed: "${result.lockText}"`);
      } else {
        console.error(result.error);
        process.exit(1);
      }
      return;
    }

    const flags = parseFlags(args);
    const text = flags._.join(" ").trim();
    if (!text) {
      console.error("Error: Lock text is required.");
      console.error("Usage: speclock lock <text> [--tags a,b] [--source user]");
      process.exit(1);
    }
    const { lockId } = addLock(root, text, parseTags(flags.tags), flags.source || "user");
    console.log(`SpecLock added (${lockId}): "${text}"`);
    return;
  }

  if (cmd === "decide") {
    const flags = parseFlags(args);
    const text = flags._.join(" ").trim();
    if (!text) {
      console.error("Error: Decision text is required.");
      console.error("Usage: speclock decide <text> [--tags a,b]");
      process.exit(1);
    }
    const { decId } = addDecision(root, text, parseTags(flags.tags), flags.source || "user");
    console.log(`Decision recorded (${decId}): "${text}"`);
    return;
  }

  if (cmd === "note") {
    const flags = parseFlags(args);
    const text = flags._.join(" ").trim();
    if (!text) {
      console.error("Error: Note text is required.");
      console.error("Usage: speclock note <text> [--pinned]");
      process.exit(1);
    }
    const pinned = flags.pinned !== false;
    const { noteId } = addNote(root, text, pinned);
    console.log(`Note added (${noteId}): "${text}"`);
    return;
  }

  if (cmd === "facts") {
    const sub = args.shift();
    if (sub !== "deploy") {
      console.error("Error: Only 'facts deploy' is supported.");
      console.error(
        "Usage: speclock facts deploy --provider X --branch Y"
      );
      process.exit(1);
    }
    const flags = parseFlags(args);
    const payload = {
      provider: flags.provider,
      branch: flags.branch,
      notes: flags.notes,
      url: flags.url,
    };
    if (flags.autoDeploy !== undefined) {
      payload.autoDeploy =
        String(flags.autoDeploy).toLowerCase() === "true";
    }
    updateDeployFacts(root, payload);
    console.log("Deploy facts updated.");
    return;
  }

  if (cmd === "context") {
    const md = generateContext(root);
    console.log(md);
    return;
  }

  if (cmd === "watch") {
    await watchRepo(root);
    return;
  }

  if (cmd === "serve") {
    // Start MCP server — pass through --project if provided
    const flags = parseFlags(args);
    const projectArg = flags.project || root;
    process.env.SPECLOCK_PROJECT_ROOT = projectArg;
    await import("../mcp/server.js");
    return;
  }

  if (cmd === "status") {
    showStatus(root);
    return;
  }

  console.error(`Unknown command: ${cmd}`);
  console.error("Run 'speclock --help' for usage.");
  process.exit(1);
}

main().catch((err) => {
  console.error("SpecLock error:", err.message);
  process.exit(1);
});
