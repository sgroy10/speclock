import os from "os";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
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
  getSessionBriefing,
  endSession,
} from "../core/engine.js";
import { generateContext, generateContextPack } from "../core/context.js";
import {
  readBrain,
  readEvents,
  newId,
  nowIso,
  appendEvent,
  bumpEvents,
  writeBrain,
} from "../core/storage.js";
import {
  captureStatus,
  createTag,
  getDiffSummary,
} from "../core/git.js";

// --- Project root resolution ---
function parseArgs(argv) {
  const args = { project: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--project" && argv[i + 1]) {
      args.project = argv[i + 1];
      i++;
    }
  }
  return args;
}

const args = parseArgs(process.argv);
const PROJECT_ROOT =
  args.project || process.env.FLOWKEEPER_PROJECT_ROOT || process.cwd();

// --- MCP Server ---
const server = new McpServer(
  { name: "flowkeeper", version: "1.0.0" },
  {
    instructions:
      "FlowKeeper is an AI continuity engine. Call flowkeeper_session_briefing at the start of a new session, and flowkeeper_session_summary before ending. Use flowkeeper_get_context to refresh your project understanding at any time.",
  }
);

// ========================================
// MEMORY MANAGEMENT TOOLS
// ========================================

// Tool 1: flowkeeper_init
server.tool(
  "flowkeeper_init",
  "Initialize FlowKeeper in the current project directory. Creates .flowkeeper/ with brain.json, events.log, and supporting directories.",
  {},
  async () => {
    const brain = ensureInit(PROJECT_ROOT);
    return {
      content: [
        {
          type: "text",
          text: `FlowKeeper initialized for "${brain.project.name}" at ${brain.project.root}`,
        },
      ],
    };
  }
);

// Tool 2: flowkeeper_get_context — THE KEY TOOL
server.tool(
  "flowkeeper_get_context",
  "THE KEY TOOL. Returns the full structured context pack including goal, locks, decisions, recent changes, deploy facts, reverts, session history, and notes. Call this at the start of every session or whenever you need to refresh your understanding of the project.",
  {
    format: z
      .enum(["markdown", "json"])
      .optional()
      .default("markdown")
      .describe("Output format: markdown (readable) or json (structured)"),
  },
  async ({ format }) => {
    if (format === "json") {
      const pack = generateContextPack(PROJECT_ROOT);
      return {
        content: [{ type: "text", text: JSON.stringify(pack, null, 2) }],
      };
    }
    const md = generateContext(PROJECT_ROOT);
    return { content: [{ type: "text", text: md }] };
  }
);

// Tool 3: flowkeeper_set_goal
server.tool(
  "flowkeeper_set_goal",
  "Set or update the project goal. This is the high-level objective that guides all work.",
  {
    text: z.string().min(1).describe("The project goal text"),
  },
  async ({ text }) => {
    setGoal(PROJECT_ROOT, text);
    return {
      content: [{ type: "text", text: `Goal set: "${text}"` }],
    };
  }
);

// Tool 4: flowkeeper_add_lock
server.tool(
  "flowkeeper_add_lock",
  "Add a non-negotiable constraint (SpecLock). These are rules that must NEVER be violated during development.",
  {
    text: z.string().min(1).describe("The constraint text"),
    tags: z
      .array(z.string())
      .optional()
      .default([])
      .describe("Category tags"),
    source: z
      .enum(["user", "agent"])
      .optional()
      .default("agent")
      .describe("Who created this lock"),
  },
  async ({ text, tags, source }) => {
    const { lockId } = addLock(PROJECT_ROOT, text, tags, source);
    return {
      content: [
        { type: "text", text: `Lock added (${lockId}): "${text}"` },
      ],
    };
  }
);

// Tool 5: flowkeeper_remove_lock
server.tool(
  "flowkeeper_remove_lock",
  "Remove (deactivate) a SpecLock by its ID. The lock is soft-deleted and kept in history.",
  {
    lockId: z.string().min(1).describe("The lock ID to remove"),
  },
  async ({ lockId }) => {
    const result = removeLock(PROJECT_ROOT, lockId);
    if (!result.removed) {
      return {
        content: [{ type: "text", text: result.error }],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: "text",
          text: `Lock removed: "${result.lockText}"`,
        },
      ],
    };
  }
);

// Tool 6: flowkeeper_add_decision
server.tool(
  "flowkeeper_add_decision",
  "Record an architectural or design decision. Decisions guide future work and prevent contradictory changes.",
  {
    text: z.string().min(1).describe("The decision text"),
    tags: z.array(z.string()).optional().default([]),
    source: z
      .enum(["user", "agent"])
      .optional()
      .default("agent"),
  },
  async ({ text, tags, source }) => {
    const { decId } = addDecision(PROJECT_ROOT, text, tags, source);
    return {
      content: [
        { type: "text", text: `Decision recorded (${decId}): "${text}"` },
      ],
    };
  }
);

// Tool 7: flowkeeper_add_note
server.tool(
  "flowkeeper_add_note",
  "Add a pinned note for reference. Notes persist across sessions as reminders.",
  {
    text: z.string().min(1).describe("The note text"),
    pinned: z
      .boolean()
      .optional()
      .default(true)
      .describe("Whether to pin this note in context"),
  },
  async ({ text, pinned }) => {
    const { noteId } = addNote(PROJECT_ROOT, text, pinned);
    return {
      content: [
        { type: "text", text: `Note added (${noteId}): "${text}"` },
      ],
    };
  }
);

// Tool 8: flowkeeper_set_deploy_facts
server.tool(
  "flowkeeper_set_deploy_facts",
  "Record deployment configuration facts (provider, branch, auto-deploy settings).",
  {
    provider: z
      .string()
      .optional()
      .describe("Deploy provider (vercel, railway, aws, netlify, etc.)"),
    branch: z.string().optional().describe("Deploy branch"),
    autoDeploy: z
      .boolean()
      .optional()
      .describe("Whether auto-deploy is enabled"),
    url: z.string().optional().describe("Deployment URL"),
    notes: z.string().optional().describe("Additional deploy notes"),
  },
  async (params) => {
    updateDeployFacts(PROJECT_ROOT, params);
    return {
      content: [{ type: "text", text: "Deploy facts updated." }],
    };
  }
);

// ========================================
// CHANGE TRACKING TOOLS
// ========================================

// Tool 9: flowkeeper_log_change
server.tool(
  "flowkeeper_log_change",
  "Manually log a significant change. Use this when you make an important modification that should be tracked in the context.",
  {
    summary: z
      .string()
      .min(1)
      .describe("Brief description of the change"),
    files: z
      .array(z.string())
      .optional()
      .default([])
      .describe("Files affected"),
  },
  async ({ summary, files }) => {
    const { eventId } = logChange(PROJECT_ROOT, summary, files);
    return {
      content: [
        { type: "text", text: `Change logged (${eventId}): "${summary}"` },
      ],
    };
  }
);

// Tool 10: flowkeeper_get_changes
server.tool(
  "flowkeeper_get_changes",
  "Get recent file changes tracked by FlowKeeper.",
  {
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(20),
  },
  async ({ limit }) => {
    const brain = readBrain(PROJECT_ROOT);
    if (!brain) {
      return {
        content: [
          {
            type: "text",
            text: "FlowKeeper not initialized. Run flowkeeper_init first.",
          },
        ],
        isError: true,
      };
    }
    const changes = brain.state.recentChanges.slice(0, limit);
    if (changes.length === 0) {
      return {
        content: [{ type: "text", text: "No changes tracked yet." }],
      };
    }
    const formatted = changes
      .map((ch) => {
        const files =
          ch.files && ch.files.length > 0
            ? ` (${ch.files.join(", ")})`
            : "";
        return `- [${ch.at.substring(0, 19)}] ${ch.summary}${files}`;
      })
      .join("\n");
    return {
      content: [
        { type: "text", text: `Recent changes (${changes.length}):\n${formatted}` },
      ],
    };
  }
);

// Tool 11: flowkeeper_get_events
server.tool(
  "flowkeeper_get_events",
  "Get the event log, optionally filtered by type. Event types: init, goal_updated, lock_added, lock_removed, decision_added, note_added, fact_updated, file_created, file_changed, file_deleted, revert_detected, context_generated, session_started, session_ended, manual_change, checkpoint_created.",
  {
    type: z.string().optional().describe("Filter by event type"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(200)
      .optional()
      .default(50),
    since: z
      .string()
      .optional()
      .describe("ISO timestamp; only return events after this time"),
  },
  async ({ type, limit, since }) => {
    const events = readEvents(PROJECT_ROOT, { type, limit, since });
    if (events.length === 0) {
      return {
        content: [{ type: "text", text: "No events found." }],
      };
    }
    const formatted = events
      .map(
        (e) =>
          `- [${e.at.substring(0, 19)}] ${e.type}: ${e.summary || ""}`
      )
      .join("\n");
    return {
      content: [
        {
          type: "text",
          text: `Events (${events.length}):\n${formatted}`,
        },
      ],
    };
  }
);

// ========================================
// CONTINUITY PROTECTION TOOLS
// ========================================

// Tool 12: flowkeeper_check_conflict
server.tool(
  "flowkeeper_check_conflict",
  "Check if a proposed action conflicts with any active SpecLock. Use before making significant changes.",
  {
    proposedAction: z
      .string()
      .min(1)
      .describe("Description of the action you plan to take"),
  },
  async ({ proposedAction }) => {
    const result = checkConflict(PROJECT_ROOT, proposedAction);
    return {
      content: [{ type: "text", text: result.analysis }],
    };
  }
);

// Tool 13: flowkeeper_session_briefing
server.tool(
  "flowkeeper_session_briefing",
  "Start a new session and get a full briefing. Returns context pack plus what happened since the last session. Call this at the very beginning of a new conversation.",
  {
    toolName: z
      .enum(["claude-code", "cursor", "codex", "windsurf", "cline", "unknown"])
      .optional()
      .default("unknown")
      .describe("Which AI tool is being used"),
  },
  async ({ toolName }) => {
    const briefing = getSessionBriefing(PROJECT_ROOT, toolName);
    const contextMd = generateContext(PROJECT_ROOT);

    const parts = [];

    // Session info
    parts.push(`# FlowKeeper Session Briefing`);
    parts.push(`Session started (${toolName}). ID: ${briefing.session.id}`);
    parts.push("");

    // Last session summary
    if (briefing.lastSession) {
      parts.push("## Last Session");
      parts.push(`- Tool: **${briefing.lastSession.toolUsed}**`);
      parts.push(`- Ended: ${briefing.lastSession.endedAt || "unknown"}`);
      if (briefing.lastSession.summary)
        parts.push(`- Summary: ${briefing.lastSession.summary}`);
      parts.push(
        `- Events: ${briefing.lastSession.eventsInSession || 0}`
      );
      parts.push(
        `- Changes since then: ${briefing.changesSinceLastSession}`
      );
      parts.push("");
    }

    // Warnings
    if (briefing.warnings.length > 0) {
      parts.push("## ⚠ Warnings");
      for (const w of briefing.warnings) {
        parts.push(`- ${w}`);
      }
      parts.push("");
    }

    // Full context
    parts.push("---");
    parts.push(contextMd);

    return {
      content: [{ type: "text", text: parts.join("\n") }],
    };
  }
);

// Tool 14: flowkeeper_session_summary
server.tool(
  "flowkeeper_session_summary",
  "End the current session and record what was accomplished. Call this before ending a conversation.",
  {
    summary: z
      .string()
      .min(1)
      .describe("Summary of what was accomplished in this session"),
  },
  async ({ summary }) => {
    const result = endSession(PROJECT_ROOT, summary);
    if (!result.ended) {
      return {
        content: [{ type: "text", text: result.error }],
        isError: true,
      };
    }
    const session = result.session;
    const duration =
      session.startedAt && session.endedAt
        ? Math.round(
            (new Date(session.endedAt) - new Date(session.startedAt)) /
              60000
          )
        : 0;
    return {
      content: [
        {
          type: "text",
          text: `Session ended. Duration: ${duration} min. Events: ${session.eventsInSession}. Summary: "${summary}"`,
        },
      ],
    };
  }
);

// ========================================
// GIT INTEGRATION TOOLS
// ========================================

// Tool 15: flowkeeper_checkpoint
server.tool(
  "flowkeeper_checkpoint",
  "Create a named git tag checkpoint for easy rollback.",
  {
    name: z
      .string()
      .min(1)
      .describe("Checkpoint name (alphanumeric, hyphens, underscores)"),
  },
  async ({ name }) => {
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const tag = `fk_${safeName}_${Date.now()}`;
    const result = createTag(PROJECT_ROOT, tag);

    if (!result.ok) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to create checkpoint: ${result.error}`,
          },
        ],
        isError: true,
      };
    }

    // Record event
    const brain = readBrain(PROJECT_ROOT);
    if (brain) {
      const eventId = newId("evt");
      const event = {
        eventId,
        type: "checkpoint_created",
        at: nowIso(),
        files: [],
        summary: `Checkpoint: ${tag}`,
        patchPath: "",
      };
      bumpEvents(brain, eventId);
      appendEvent(PROJECT_ROOT, event);
      writeBrain(PROJECT_ROOT, brain);
    }

    return {
      content: [
        { type: "text", text: `Checkpoint created: ${tag}` },
      ],
    };
  }
);

// Tool 16: flowkeeper_repo_status
server.tool(
  "flowkeeper_repo_status",
  "Get current git repository status including branch, commit, changed files, and diff summary.",
  {},
  async () => {
    const status = captureStatus(PROJECT_ROOT);
    const diffSummary = getDiffSummary(PROJECT_ROOT);

    const lines = [
      `Branch: ${status.branch}`,
      `Commit: ${status.commit}`,
      "",
      `Changed files (${status.changedFiles.length}):`,
    ];

    if (status.changedFiles.length > 0) {
      for (const f of status.changedFiles) {
        lines.push(`  ${f.status} ${f.file}`);
      }
    } else {
      lines.push("  (clean working tree)");
    }

    if (diffSummary) {
      lines.push("");
      lines.push("Diff summary:");
      lines.push(diffSummary);
    }

    return {
      content: [{ type: "text", text: lines.join("\n") }],
    };
  }
);

// --- Start server ---
const transport = new StdioServerTransport();
await server.connect(transport);

process.stderr.write(
  `FlowKeeper MCP v1.0.0 running (stdio). Root: ${PROJECT_ROOT}${os.EOL}`
);
