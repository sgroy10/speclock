// SpecLock VS Code Extension
// Enforces .cursorrules, CLAUDE.md, and AGENTS.md — makes AI rules unbreakable.
// Developed by Sandeep Roy (https://github.com/sgroy10)

const vscode = require("vscode");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

let statusBarItem;
let lockCount = 0;
let guardedFiles = new Set();
let outputChannel;

// ============================================================
// ACTIVATION
// ============================================================

function activate(context) {
  outputChannel = vscode.window.createOutputChannel("SpecLock");

  // Status bar
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.command = "speclock.showLocks";
  context.subscriptions.push(statusBarItem);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("speclock.protect", cmdProtect),
    vscode.commands.registerCommand("speclock.check", cmdCheck),
    vscode.commands.registerCommand("speclock.status", cmdStatus),
    vscode.commands.registerCommand("speclock.init", cmdInit),
    vscode.commands.registerCommand("speclock.showLocks", cmdShowLocks)
  );

  // File decoration for guarded files
  const guardedDecoration = vscode.window.createTextEditorDecorationType({
    gutterIconPath: context.asAbsolutePath("shield.svg"),
    gutterIconSize: "contain",
    overviewRulerColor: "#4F46E5",
    overviewRulerLane: vscode.OverviewRulerLane.Right,
    isWholeLine: true,
    backgroundColor: "rgba(79, 70, 229, 0.05)",
  });

  // Watch for editor changes to apply decorations
  vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      if (editor) applyDecorations(editor, guardedDecoration);
    },
    null,
    context.subscriptions
  );

  // Watch for rule file changes
  const ruleWatcher = vscode.workspace.createFileSystemWatcher(
    "**/{.cursorrules,CLAUDE.md,AGENTS.md,.speclock/brain.json}"
  );
  ruleWatcher.onDidChange(() => refreshStatus());
  ruleWatcher.onDidCreate(() => refreshStatus());
  ruleWatcher.onDidDelete(() => refreshStatus());
  context.subscriptions.push(ruleWatcher);

  // Initial status refresh
  refreshStatus();

  // Auto-protect on open if configured
  const config = vscode.workspace.getConfiguration("speclock");
  if (config.get("autoProtectOnOpen")) {
    cmdProtect();
  }

  outputChannel.appendLine("SpecLock extension activated");
}

// ============================================================
// STATUS BAR
// ============================================================

function refreshStatus() {
  const root = getWorkspaceRoot();
  if (!root) {
    statusBarItem.hide();
    return;
  }

  const brainPath = path.join(root, ".speclock", "brain.json");

  if (fs.existsSync(brainPath)) {
    try {
      const brain = JSON.parse(fs.readFileSync(brainPath, "utf-8"));
      const locks = (brain.specLock?.items || []).filter(
        (l) => l.active !== false
      );
      lockCount = locks.length;
      guardedFiles = new Set();

      // Find guarded files
      scanGuardedFiles(root);

      statusBarItem.text = `$(shield) SpecLock: ${lockCount} lock${lockCount !== 1 ? "s" : ""}`;
      statusBarItem.tooltip = `${lockCount} active constraint${lockCount !== 1 ? "s" : ""} enforced\n${guardedFiles.size} guarded file${guardedFiles.size !== 1 ? "s" : ""}\nClick to view locks`;
      statusBarItem.backgroundColor = undefined;
      statusBarItem.show();
    } catch (e) {
      statusBarItem.text = "$(shield) SpecLock: error";
      statusBarItem.tooltip = "Error reading brain.json: " + e.message;
      statusBarItem.show();
    }
  } else {
    // Check if rule files exist but SpecLock isn't initialized
    const hasRuleFiles =
      fs.existsSync(path.join(root, ".cursorrules")) ||
      fs.existsSync(path.join(root, "CLAUDE.md")) ||
      fs.existsSync(path.join(root, "AGENTS.md"));

    if (hasRuleFiles) {
      statusBarItem.text = "$(shield) SpecLock: not active";
      statusBarItem.tooltip =
        'Rule files found but not enforced. Click to run "speclock protect"';
      statusBarItem.command = "speclock.protect";
      statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.warningBackground"
      );
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  }
}

function scanGuardedFiles(root) {
  const GUARD_TAG = "SPECLOCK-GUARD";
  const extensions = [
    ".js", ".ts", ".jsx", ".tsx", ".py", ".css", ".html",
    ".vue", ".svelte", ".sql", ".rb", ".sh",
  ];

  function scan(dir, depth) {
    if (depth > 3) return; // Don't go too deep
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(fullPath, depth + 1);
        } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
          try {
            const head = fs.readFileSync(fullPath, "utf-8").substring(0, 500);
            if (head.includes(GUARD_TAG)) {
              guardedFiles.add(fullPath);
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  scan(root, 0);
}

// ============================================================
// DECORATIONS
// ============================================================

function applyDecorations(editor, decorationType) {
  if (!editor) return;
  const filePath = editor.document.uri.fsPath;

  // Check if file is guarded
  if (guardedFiles.has(filePath)) {
    // Highlight the guard header (first 8 lines)
    const text = editor.document.getText();
    if (text.includes("SPECLOCK-GUARD")) {
      const lines = text.split("\n");
      const ranges = [];
      for (let i = 0; i < Math.min(lines.length, 8); i++) {
        if (
          lines[i].includes("SPECLOCK-GUARD") ||
          lines[i].includes("LOCKED:") ||
          lines[i].includes("DO NOT MODIFY") ||
          lines[i].includes("DO NOT EDIT")
        ) {
          ranges.push(
            new vscode.Range(
              new vscode.Position(i, 0),
              new vscode.Position(i, lines[i].length)
            )
          );
        }
      }
      editor.setDecorations(decorationType, ranges);
      return;
    }
  }

  // Clear decorations for non-guarded files
  editor.setDecorations(decorationType, []);
}

// ============================================================
// COMMANDS
// ============================================================

async function cmdProtect() {
  const root = getWorkspaceRoot();
  if (!root) {
    vscode.window.showErrorMessage("SpecLock: No workspace folder open.");
    return;
  }

  outputChannel.show(true);
  outputChannel.appendLine("\n--- SpecLock Protect ---");

  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "SpecLock: Protecting workspace...",
      cancellable: false,
    },
    () => {
      return new Promise((resolve) => {
        exec(
          "npx speclock protect --no-hook",
          { cwd: root, timeout: 30000 },
          (err, stdout, stderr) => {
            outputChannel.appendLine(stdout);
            if (stderr) outputChannel.appendLine(stderr);

            if (err) {
              vscode.window.showErrorMessage(
                "SpecLock protect failed. Check output for details."
              );
            } else {
              // Parse lock count from output
              const match = stdout.match(/(\d+) new locks/);
              const extracted = stdout.match(/(\d+) constraints/);
              if (match) {
                vscode.window.showInformationMessage(
                  `SpecLock: ${match[1]} new locks added. Your rules are now enforced.`
                );
              } else if (extracted) {
                vscode.window.showInformationMessage(
                  `SpecLock: ${extracted[1]} constraints found. Rules are enforced.`
                );
              } else {
                vscode.window.showInformationMessage(
                  "SpecLock: Protection active."
                );
              }
            }
            refreshStatus();
            resolve();
          }
        );
      });
    }
  );
}

async function cmdCheck() {
  const root = getWorkspaceRoot();
  if (!root) {
    vscode.window.showErrorMessage("SpecLock: No workspace folder open.");
    return;
  }

  const action = await vscode.window.showInputBox({
    prompt: 'Describe the action to check (e.g., "delete old user data")',
    placeHolder: "What are you about to do?",
  });

  if (!action) return;

  outputChannel.show(true);
  outputChannel.appendLine(`\n--- SpecLock Check: "${action}" ---`);

  exec(
    `npx speclock check "${action.replace(/"/g, '\\"')}"`,
    { cwd: root, timeout: 15000 },
    (err, stdout, stderr) => {
      outputChannel.appendLine(stdout);
      if (stderr) outputChannel.appendLine(stderr);

      if (stdout.includes("CONFLICT") || stdout.includes("conflict")) {
        vscode.window.showWarningMessage(
          `SpecLock: CONFLICT detected for "${action}". Check output for details.`,
          "Show Details"
        ).then((choice) => {
          if (choice === "Show Details") outputChannel.show(true);
        });
      } else {
        vscode.window.showInformationMessage(
          `SpecLock: No conflicts. Safe to proceed with "${action}".`
        );
      }
    }
  );
}

async function cmdStatus() {
  const root = getWorkspaceRoot();
  if (!root) {
    vscode.window.showErrorMessage("SpecLock: No workspace folder open.");
    return;
  }

  outputChannel.show(true);
  outputChannel.appendLine("\n--- SpecLock Status ---");

  exec(
    "npx speclock status",
    { cwd: root, timeout: 15000 },
    (err, stdout, stderr) => {
      outputChannel.appendLine(stdout);
      if (stderr) outputChannel.appendLine(stderr);
    }
  );
}

async function cmdInit() {
  const root = getWorkspaceRoot();
  if (!root) {
    vscode.window.showErrorMessage("SpecLock: No workspace folder open.");
    return;
  }

  const goal = await vscode.window.showInputBox({
    prompt: "What is this project? (optional)",
    placeHolder: "e.g., E-commerce platform with React + PostgreSQL",
  });

  outputChannel.show(true);
  outputChannel.appendLine("\n--- SpecLock Init ---");

  const cmd = goal
    ? `npx speclock setup --goal "${goal.replace(/"/g, '\\"')}"`
    : "npx speclock setup";

  exec(cmd, { cwd: root, timeout: 30000 }, (err, stdout, stderr) => {
    outputChannel.appendLine(stdout);
    if (stderr) outputChannel.appendLine(stderr);

    if (err) {
      vscode.window.showErrorMessage(
        "SpecLock init failed. Check output for details."
      );
    } else {
      vscode.window.showInformationMessage(
        "SpecLock initialized. Add constraints with the lock command."
      );
    }
    refreshStatus();
  });
}

async function cmdShowLocks() {
  const root = getWorkspaceRoot();
  if (!root) return;

  const brainPath = path.join(root, ".speclock", "brain.json");
  if (!fs.existsSync(brainPath)) {
    const choice = await vscode.window.showInformationMessage(
      "SpecLock is not initialized in this workspace.",
      "Initialize",
      "Run Protect"
    );
    if (choice === "Initialize") cmdInit();
    if (choice === "Run Protect") cmdProtect();
    return;
  }

  try {
    const brain = JSON.parse(fs.readFileSync(brainPath, "utf-8"));
    const locks = (brain.specLock?.items || []).filter(
      (l) => l.active !== false
    );

    if (locks.length === 0) {
      vscode.window.showInformationMessage("No active locks. Run SpecLock Protect to extract constraints from rule files.");
      return;
    }

    const items = locks.map((l, i) => ({
      label: `$(shield) ${l.text.substring(0, 80)}${l.text.length > 80 ? "..." : ""}`,
      description: `${l.source || "user"} | ${l.tags?.join(", ") || "no tags"}`,
      detail: l.text,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: `${locks.length} active lock${locks.length !== 1 ? "s" : ""} — select to view details`,
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (selected) {
      outputChannel.show(true);
      outputChannel.appendLine(`\nLock: ${selected.detail}`);
      outputChannel.appendLine(`Source: ${selected.description}`);
    }
  } catch (e) {
    vscode.window.showErrorMessage("Error reading SpecLock state: " + e.message);
  }
}

// ============================================================
// HELPERS
// ============================================================

function getWorkspaceRoot() {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return null;
  return folders[0].uri.fsPath;
}

function deactivate() {
  if (statusBarItem) statusBarItem.dispose();
  if (outputChannel) outputChannel.dispose();
}

module.exports = { activate, deactivate };
