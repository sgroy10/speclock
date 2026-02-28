import path from "path";
import {
  ensureInit,
  setGoal,
  addLock,
  removeLock,
  addDecision,
  addNote,
  updateDeployFacts,
  logChange,
  checkConflict,
  watchRepo,
  createSpecLockMd,
  guardFile,
  unguardFile,
  injectPackageJsonMarker,
  syncLocksToPackageJson,
  autoGuardRelatedFiles,
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

// --- Auto-regenerate context after write operations ---

function refreshContext(root) {
  try {
    generateContext(root);
  } catch (_) {
    // Silently skip if context generation fails
  }
}

// --- Help text ---

function printHelp() {
  console.log(`
SpecLock v1.6.0 — AI Constraint Engine
Developed by Sandeep Roy (github.com/sgroy10)

Usage: speclock <command> [options]

Commands:
  setup [--goal <text>]           Full setup: init + SPECLOCK.md + context
  init                            Initialize SpecLock in current directory
  goal <text>                     Set or update the project goal
  lock <text> [--tags a,b]        Add a non-negotiable constraint
  lock remove <id>                Remove a lock by ID
  guard <file> [--lock "text"]    Inject lock warning into a file (NEW)
  unguard <file>                  Remove lock warning from a file (NEW)
  decide <text> [--tags a,b]      Record a decision
  note <text> [--pinned]          Add a pinned note
  log-change <text> [--files x,y] Log a significant change
  check <text>                    Check if action conflicts with locks
  context                         Generate and print context pack
  facts deploy [--provider X]     Set deployment facts
  watch                           Start file watcher (auto-track changes)
  serve [--project <path>]        Start MCP stdio server
  status                          Show project brain summary

Options:
  --tags <a,b,c>                  Comma-separated tags
  --source <user|agent>           Who created this (default: user)
  --files <a.ts,b.ts>             Comma-separated file paths
  --goal <text>                   Goal text (for setup command)
  --lock <text>                   Lock text (for guard command)
  --project <path>                Project root (for serve)

Examples:
  npx speclock setup --goal "Build PawPalace pet shop"
  npx speclock lock "Never modify auth files"
  npx speclock guard src/Auth.tsx --lock "Never modify auth files"
  npx speclock check "Adding social login to auth page"
  npx speclock log-change "Built payment system" --files src/pay.tsx
  npx speclock decide "Use Supabase for auth"
  npx speclock context
  npx speclock status
`);
}

// --- Status display ---

function showStatus(root) {
  const brain = readBrain(root);
  if (!brain) {
    console.log("SpecLock not initialized. Run: npx speclock setup");
    return;
  }

  const activeLocks = brain.specLock.items.filter((l) => l.active !== false);

  console.log(`\nSpecLock Status — ${brain.project.name}`);
  console.log("=".repeat(50));
  console.log(`Goal: ${brain.goal.text || "(not set)"}`);
  console.log(`Locks: ${activeLocks.length} active`);
  console.log(`Decisions: ${brain.decisions.length}`);
  console.log(`Notes: ${brain.notes.length}`);
  console.log(`Events: ${brain.events.count}`);
  console.log(`Deploy: ${brain.facts.deploy.provider || "(not set)"}`);

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

  // --- SETUP (new: one-shot full setup) ---
  if (cmd === "setup") {
    const flags = parseFlags(args);
    const goalText = flags.goal || flags._.join(" ").trim();

    // 1. Initialize
    ensureInit(root);
    console.log("Initialized .speclock/ directory.");

    // 2. Set goal if provided
    if (goalText) {
      setGoal(root, goalText);
      console.log(`Goal set: "${goalText}"`);
    }

    // 3. Create SPECLOCK.md in project root
    const mdPath = createSpecLockMd(root);
    console.log(`Created SPECLOCK.md (AI instructions file).`);

    // 4. Inject marker into package.json (so AI tools auto-discover SpecLock)
    const pkgResult = injectPackageJsonMarker(root);
    if (pkgResult.success) {
      console.log("Injected SpecLock marker into package.json.");
    }

    // 5. Generate context
    generateContext(root);
    console.log("Generated .speclock/context/latest.md");

    // 6. Print summary
    console.log(`
SpecLock is ready!

Files created/updated:
  .speclock/brain.json          — Project memory
  .speclock/context/latest.md   — Context for AI (read this)
  SPECLOCK.md                   — AI rules (read this)
  package.json                  — Active locks embedded (AI auto-discovery)

Next steps:
  To add constraints:  npx speclock lock "Never touch auth files"
  To check conflicts:  npx speclock check "Modifying auth page"
  To log changes:      npx speclock log-change "Built landing page"
  To see status:       npx speclock status

Tip: When starting a new chat, tell the AI:
  "Check speclock status and read the project constraints before doing anything"
`);
    return;
  }

  // --- INIT ---
  if (cmd === "init") {
    ensureInit(root);
    createSpecLockMd(root);
    injectPackageJsonMarker(root);
    generateContext(root);
    console.log("SpecLock initialized. Created SPECLOCK.md, updated package.json, and generated context file.");
    return;
  }

  // --- GOAL ---
  if (cmd === "goal") {
    const text = args.join(" ").trim();
    if (!text) {
      console.error("Error: Goal text is required.");
      console.error("Usage: speclock goal <text>");
      process.exit(1);
    }
    setGoal(root, text);
    refreshContext(root);
    console.log(`Goal set: "${text}"`);
    return;
  }

  // --- LOCK ---
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
        // Sync updated locks to package.json
        syncLocksToPackageJson(root);
        refreshContext(root);
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

    // Auto-guard related files (Solution 1)
    const guardResult = autoGuardRelatedFiles(root, text);
    if (guardResult.guarded.length > 0) {
      console.log(`Auto-guarded ${guardResult.guarded.length} related file(s):`);
      for (const f of guardResult.guarded) {
        console.log(`  🔒 ${f}`);
      }
    }

    // Sync locks to package.json (Solution 2)
    const syncResult = syncLocksToPackageJson(root);
    if (syncResult.success) {
      console.log(`Synced ${syncResult.lockCount} lock(s) to package.json.`);
    }

    refreshContext(root);
    console.log(`Locked (${lockId}): "${text}"`);
    return;
  }

  // --- DECIDE ---
  if (cmd === "decide") {
    const flags = parseFlags(args);
    const text = flags._.join(" ").trim();
    if (!text) {
      console.error("Error: Decision text is required.");
      console.error("Usage: speclock decide <text> [--tags a,b]");
      process.exit(1);
    }
    const { decId } = addDecision(root, text, parseTags(flags.tags), flags.source || "user");
    refreshContext(root);
    console.log(`Decision recorded (${decId}): "${text}"`);
    return;
  }

  // --- NOTE ---
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
    refreshContext(root);
    console.log(`Note added (${noteId}): "${text}"`);
    return;
  }

  // --- LOG-CHANGE (new) ---
  if (cmd === "log-change") {
    const flags = parseFlags(args);
    const text = flags._.join(" ").trim();
    if (!text) {
      console.error("Error: Change summary is required.");
      console.error('Usage: speclock log-change "what changed" --files a.ts,b.ts');
      process.exit(1);
    }
    const files = flags.files ? flags.files.split(",").map((f) => f.trim()).filter(Boolean) : [];
    logChange(root, text, files);
    refreshContext(root);
    console.log(`Change logged: "${text}"`);
    if (files.length > 0) {
      console.log(`Files: ${files.join(", ")}`);
    }
    return;
  }

  // --- CHECK (new: conflict check) ---
  if (cmd === "check") {
    const text = args.join(" ").trim();
    if (!text) {
      console.error("Error: Action description is required.");
      console.error('Usage: speclock check "what you plan to do"');
      process.exit(1);
    }
    const result = checkConflict(root, text);
    if (result.hasConflict) {
      console.log(`\nCONFLICT DETECTED`);
      console.log("=".repeat(50));
      for (const lock of result.conflictingLocks) {
        console.log(`  [${lock.confidence}] "${lock.text}"`);
        console.log(`  Confidence: ${lock.score}%`);
        if (lock.reasons && lock.reasons.length > 0) {
          for (const reason of lock.reasons) {
            console.log(`  - ${reason}`);
          }
        }
        console.log("");
      }
      console.log(result.analysis);
    } else {
      console.log(`No conflicts found. Safe to proceed with: "${text}"`);
    }
    return;
  }

  // --- GUARD (new: file-level lock) ---
  if (cmd === "guard") {
    const flags = parseFlags(args);
    const filePath = flags._[0];
    if (!filePath) {
      console.error("Error: File path is required.");
      console.error('Usage: speclock guard <file> --lock "constraint text"');
      process.exit(1);
    }
    const lockText = flags.lock || "This file is locked by SpecLock. Do not modify.";
    const result = guardFile(root, filePath, lockText);
    if (result.success) {
      console.log(`Guarded: ${filePath}`);
      console.log(`Lock warning injected: "${lockText}"`);
    } else {
      console.error(result.error);
      process.exit(1);
    }
    return;
  }

  // --- UNGUARD ---
  if (cmd === "unguard") {
    const filePath = args[0];
    if (!filePath) {
      console.error("Error: File path is required.");
      console.error("Usage: speclock unguard <file>");
      process.exit(1);
    }
    const result = unguardFile(root, filePath);
    if (result.success) {
      console.log(`Unguarded: ${filePath}`);
    } else {
      console.error(result.error);
      process.exit(1);
    }
    return;
  }

  // --- FACTS ---
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
    refreshContext(root);
    console.log("Deploy facts updated.");
    return;
  }

  // --- CONTEXT ---
  if (cmd === "context") {
    const md = generateContext(root);
    console.log(md);
    return;
  }

  // --- WATCH ---
  if (cmd === "watch") {
    await watchRepo(root);
    return;
  }

  // --- SERVE ---
  if (cmd === "serve") {
    // Start MCP server — pass through --project if provided
    const flags = parseFlags(args);
    const projectArg = flags.project || root;
    process.env.SPECLOCK_PROJECT_ROOT = projectArg;
    await import("../mcp/server.js");
    return;
  }

  // --- STATUS ---
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
