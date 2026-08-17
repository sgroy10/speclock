#!/usr/bin/env node

import { enforceConflictCheck } from "../src/core/enforcer.js";

const MAX_INPUT_BYTES = 1024 * 1024;
const MAX_ACTION_CHARS = 12000;

function respond(output) {
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

function summarize(input) {
  const tool = input.tool_name || "Unknown";
  const data = input.tool_input || {};

  if (tool === "Bash") {
    return `Claude Code plans to run this shell command:\n${String(data.command || "")}`;
  }

  const file = data.file_path || data.path || "unknown file";
  if (tool === "Write") {
    return `Claude Code plans to write ${file}:\n${String(data.content || "")}`;
  }

  return [
    `Claude Code plans to edit ${file}.`,
    data.old_string ? `Replace:\n${data.old_string}` : "",
    data.new_string ? `With:\n${data.new_string}` : "",
  ].filter(Boolean).join("\n");
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  raw += chunk;
  if (Buffer.byteLength(raw, "utf8") > MAX_INPUT_BYTES) process.exit(0);
});

process.stdin.on("end", () => {
  try {
    const input = JSON.parse(raw);
    const action = summarize(input).slice(0, MAX_ACTION_CHARS);
    const result = enforceConflictCheck(input.cwd || process.cwd(), action);
    const details = result.analysis.slice(0, 4000);

    if (result.blocked) {
      respond({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: details || "SpecLock blocked this action.",
        },
      });
    } else if (result.hasConflict) {
      respond({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "allow",
          permissionDecisionReason: "SpecLock is in advisory mode.",
          additionalContext: details,
        },
      });
    }
  } catch {
    // Hook infrastructure failures must not unexpectedly block user actions.
  }
});
