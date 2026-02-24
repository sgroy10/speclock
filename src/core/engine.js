import fs from "fs";
import path from "path";
import {
  nowIso,
  ensureSpeclockDirs,
  speclockDir,
  newId,
  readBrain,
  writeBrain,
  appendEvent,
  makeBrain,
  bumpEvents,
  addRecentChange,
  addRevert,
  readEvents,
} from "./storage.js";
import { hasGit, getHead, getDefaultBranch, captureDiff } from "./git.js";

// --- Internal helpers ---

function recordEvent(root, brain, event) {
  bumpEvents(brain, event.eventId);
  appendEvent(root, event);
  writeBrain(root, brain);
}

function writePatch(root, eventId, content) {
  const patchPath = path.join(
    speclockDir(root),
    "patches",
    `${eventId}.patch`
  );
  fs.writeFileSync(patchPath, content);
  return path.join(".speclock", "patches", `${eventId}.patch`);
}

// --- Core functions (ported + extended) ---

export function ensureInit(root) {
  ensureSpeclockDirs(root);
  let brain = readBrain(root);
  if (!brain) {
    const gitExists = hasGit(root);
    const defaultBranch = gitExists ? getDefaultBranch(root) : "";
    brain = makeBrain(root, gitExists, defaultBranch);
    if (gitExists) {
      const head = getHead(root);
      brain.state.head.gitBranch = head.gitBranch;
      brain.state.head.gitCommit = head.gitCommit;
      brain.state.head.capturedAt = nowIso();
    }
    const eventId = newId("evt");
    const event = {
      eventId,
      type: "init",
      at: nowIso(),
      files: [],
      summary: "Initialized SpecLock",
      patchPath: "",
    };
    bumpEvents(brain, eventId);
    appendEvent(root, event);
    writeBrain(root, brain);
  }
  return brain;
}

export function setGoal(root, text) {
  const brain = ensureInit(root);
  brain.goal.text = text;
  brain.goal.updatedAt = nowIso();
  const eventId = newId("evt");
  const event = {
    eventId,
    type: "goal_updated",
    at: nowIso(),
    files: [],
    summary: `Goal set: ${text.substring(0, 80)}`,
    patchPath: "",
  };
  recordEvent(root, brain, event);
  return brain;
}

export function addLock(root, text, tags, source) {
  const brain = ensureInit(root);
  const lockId = newId("lock");
  brain.specLock.items.unshift({
    id: lockId,
    text,
    createdAt: nowIso(),
    source: source || "user",
    tags: tags || [],
    active: true,
  });
  const eventId = newId("evt");
  const event = {
    eventId,
    type: "lock_added",
    at: nowIso(),
    files: [],
    summary: `Lock added: ${text.substring(0, 80)}`,
    patchPath: "",
  };
  recordEvent(root, brain, event);
  return { brain, lockId };
}

export function removeLock(root, lockId) {
  const brain = ensureInit(root);
  const lock = brain.specLock.items.find((l) => l.id === lockId);
  if (!lock) {
    return { brain, removed: false, error: `Lock not found: ${lockId}` };
  }
  lock.active = false;
  const eventId = newId("evt");
  const event = {
    eventId,
    type: "lock_removed",
    at: nowIso(),
    files: [],
    summary: `Lock removed: ${lock.text.substring(0, 80)}`,
    patchPath: "",
  };
  recordEvent(root, brain, event);
  return { brain, removed: true, lockText: lock.text };
}

export function addDecision(root, text, tags, source) {
  const brain = ensureInit(root);
  const decId = newId("dec");
  brain.decisions.unshift({
    id: decId,
    text,
    createdAt: nowIso(),
    source: source || "user",
    tags: tags || [],
  });
  const eventId = newId("evt");
  const event = {
    eventId,
    type: "decision_added",
    at: nowIso(),
    files: [],
    summary: `Decision: ${text.substring(0, 80)}`,
    patchPath: "",
  };
  recordEvent(root, brain, event);
  return { brain, decId };
}

export function addNote(root, text, pinned = true) {
  const brain = ensureInit(root);
  const noteId = newId("note");
  brain.notes.unshift({
    id: noteId,
    text,
    createdAt: nowIso(),
    pinned,
  });
  const eventId = newId("evt");
  const event = {
    eventId,
    type: "note_added",
    at: nowIso(),
    files: [],
    summary: `Note: ${text.substring(0, 80)}`,
    patchPath: "",
  };
  recordEvent(root, brain, event);
  return { brain, noteId };
}

export function updateDeployFacts(root, payload) {
  const brain = ensureInit(root);
  const deploy = brain.facts.deploy;
  if (payload.provider !== undefined) deploy.provider = payload.provider;
  if (typeof payload.autoDeploy === "boolean")
    deploy.autoDeploy = payload.autoDeploy;
  if (payload.branch !== undefined) deploy.branch = payload.branch;
  if (payload.url !== undefined) deploy.url = payload.url;
  if (payload.notes !== undefined) deploy.notes = payload.notes;
  const eventId = newId("evt");
  const event = {
    eventId,
    type: "fact_updated",
    at: nowIso(),
    files: [],
    summary: "Updated deploy facts",
    patchPath: "",
  };
  recordEvent(root, brain, event);
  return brain;
}

export function logChange(root, summary, files = []) {
  const brain = ensureInit(root);
  const eventId = newId("evt");
  let patchPath = "";
  if (brain.facts.repo.hasGit) {
    const diff = captureDiff(root);
    if (diff && diff.trim().length > 0) {
      patchPath = writePatch(root, eventId, diff);
    }
  }
  const event = {
    eventId,
    type: "manual_change",
    at: nowIso(),
    files,
    summary,
    patchPath,
  };
  addRecentChange(brain, {
    eventId,
    summary,
    files,
    at: event.at,
  });
  recordEvent(root, brain, event);
  return { brain, eventId };
}

export function handleFileEvent(root, brain, type, filePath) {
  const eventId = newId("evt");
  const rel = path.relative(root, filePath);
  let patchPath = "";
  if (brain.facts.repo.hasGit) {
    const diff = captureDiff(root);
    const patchContent =
      diff && diff.trim().length > 0 ? diff : "(no diff available)";
    patchPath = writePatch(root, eventId, patchContent);
  }
  const summary = `${type.replace("_", " ")}: ${rel}`;
  const event = {
    eventId,
    type,
    at: nowIso(),
    files: [rel],
    summary,
    patchPath,
  };
  addRecentChange(brain, {
    eventId,
    summary,
    files: [rel],
    at: event.at,
  });
  recordEvent(root, brain, event);
}

// --- Synonym groups for semantic matching ---
const SYNONYM_GROUPS = [
  ["remove", "delete", "drop", "eliminate", "destroy", "kill", "purge", "wipe"],
  ["add", "create", "introduce", "insert", "new"],
  ["change", "modify", "alter", "update", "mutate", "transform", "rewrite"],
  ["break", "breaking", "incompatible", "destabilize"],
  ["public", "external", "exposed", "user-facing", "client-facing"],
  ["private", "internal", "hidden", "encapsulated"],
  ["database", "db", "schema", "table", "migration", "sql"],
  ["api", "endpoint", "route", "rest", "graphql"],
  ["test", "testing", "spec", "coverage", "assertion"],
  ["deploy", "deployment", "release", "ship", "publish", "production"],
  ["security", "auth", "authentication", "authorization", "token", "credential"],
  ["dependency", "package", "library", "module", "import"],
  ["refactor", "restructure", "reorganize", "cleanup"],
  ["disable", "deactivate", "turn-off", "switch-off"],
  ["enable", "activate", "turn-on", "switch-on"],
];

// Negation words that invert meaning
const NEGATION_WORDS = ["no", "not", "never", "without", "dont", "don't", "cannot", "can't", "shouldn't", "mustn't", "avoid", "prevent", "prohibit", "forbid", "disallow"];

// Destructive action words
const DESTRUCTIVE_WORDS = ["remove", "delete", "drop", "destroy", "kill", "purge", "wipe", "break", "disable", "revert", "rollback", "undo"];

function expandWithSynonyms(words) {
  const expanded = new Set(words);
  for (const word of words) {
    for (const group of SYNONYM_GROUPS) {
      if (group.includes(word)) {
        for (const syn of group) expanded.add(syn);
      }
    }
  }
  return [...expanded];
}

function hasNegation(text) {
  const lower = text.toLowerCase();
  return NEGATION_WORDS.some((neg) => lower.includes(neg));
}

function isDestructiveAction(text) {
  const lower = text.toLowerCase();
  return DESTRUCTIVE_WORDS.some((w) => lower.includes(w));
}

// Check if a proposed action conflicts with any active SpecLock
export function checkConflict(root, proposedAction) {
  const brain = ensureInit(root);
  const activeLocks = brain.specLock.items.filter((l) => l.active !== false);
  if (activeLocks.length === 0) {
    return {
      hasConflict: false,
      conflictingLocks: [],
      analysis: "No active locks. No constraints to check against.",
    };
  }

  const actionLower = proposedAction.toLowerCase();
  const actionWords = actionLower.split(/\s+/).filter((w) => w.length > 2);
  const actionExpanded = expandWithSynonyms(actionWords);
  const actionIsDestructive = isDestructiveAction(actionLower);

  const conflicting = [];
  for (const lock of activeLocks) {
    const lockLower = lock.text.toLowerCase();
    const lockWords = lockLower.split(/\s+/).filter((w) => w.length > 2);
    const lockExpanded = expandWithSynonyms(lockWords);

    // Direct keyword overlap
    const directOverlap = actionWords.filter((w) => lockWords.includes(w));

    // Synonym-expanded overlap
    const synonymOverlap = actionExpanded.filter((w) => lockExpanded.includes(w));
    const uniqueSynonymMatches = synonymOverlap.filter((w) => !directOverlap.includes(w));

    // Negation analysis: lock says "No X" and action does X
    const lockHasNegation = hasNegation(lockLower);
    const actionHasNegation = hasNegation(actionLower);
    const negationConflict = lockHasNegation && !actionHasNegation && synonymOverlap.length > 0;

    // Calculate confidence score
    let confidence = 0;
    let reasons = [];

    if (directOverlap.length > 0) {
      confidence += directOverlap.length * 30;
      reasons.push(`direct keyword match: ${directOverlap.join(", ")}`);
    }
    if (uniqueSynonymMatches.length > 0) {
      confidence += uniqueSynonymMatches.length * 15;
      reasons.push(`synonym match: ${uniqueSynonymMatches.join(", ")}`);
    }
    if (negationConflict) {
      confidence += 40;
      reasons.push("lock prohibits this action (negation detected)");
    }
    if (actionIsDestructive && synonymOverlap.length > 0) {
      confidence += 20;
      reasons.push("destructive action against locked constraint");
    }

    confidence = Math.min(confidence, 100);

    if (confidence >= 15) {
      const level = confidence >= 70 ? "HIGH" : confidence >= 40 ? "MEDIUM" : "LOW";
      conflicting.push({
        id: lock.id,
        text: lock.text,
        matchedKeywords: [...new Set([...directOverlap, ...uniqueSynonymMatches])],
        confidence,
        level,
        reasons,
      });
    }
  }

  if (conflicting.length === 0) {
    return {
      hasConflict: false,
      conflictingLocks: [],
      analysis: `Checked against ${activeLocks.length} active lock(s). No conflicts detected (keyword + synonym + negation analysis). Proceed with caution.`,
    };
  }

  // Sort by confidence descending
  conflicting.sort((a, b) => b.confidence - a.confidence);

  const details = conflicting
    .map(
      (c) =>
        `- [${c.level}] "${c.text}" (confidence: ${c.confidence}%)\n  Reasons: ${c.reasons.join("; ")}`
    )
    .join("\n");

  return {
    hasConflict: true,
    conflictingLocks: conflicting,
    analysis: `Potential conflict with ${conflicting.length} lock(s):\n${details}\nReview before proceeding.`,
  };
}

// --- Auto-lock suggestions ---
export function suggestLocks(root) {
  const brain = ensureInit(root);
  const suggestions = [];

  // Analyze decisions for implicit constraints
  for (const dec of brain.decisions) {
    const lower = dec.text.toLowerCase();
    // Decisions with strong commitment language become lock candidates
    if (/\b(always|must|only|exclusively|never|required)\b/.test(lower)) {
      suggestions.push({
        text: dec.text,
        source: "decision",
        sourceId: dec.id,
        reason: `Decision contains strong commitment language — consider promoting to a lock`,
      });
    }
  }

  // Analyze notes for implicit constraints
  for (const note of brain.notes) {
    const lower = note.text.toLowerCase();
    if (/\b(never|must not|do not|don't|avoid|prohibit|forbidden)\b/.test(lower)) {
      suggestions.push({
        text: note.text,
        source: "note",
        sourceId: note.id,
        reason: `Note contains prohibitive language — consider promoting to a lock`,
      });
    }
  }

  // Check for common patterns that should be locked
  const existingLockTexts = brain.specLock.items
    .filter((l) => l.active)
    .map((l) => l.text.toLowerCase());

  // Suggest common locks if not already present
  const commonPatterns = [
    { keyword: "api", suggestion: "No breaking changes to public API" },
    { keyword: "database", suggestion: "No destructive database migrations without backup" },
    { keyword: "deploy", suggestion: "All deployments must pass CI checks" },
    { keyword: "security", suggestion: "No secrets or credentials in source code" },
    { keyword: "test", suggestion: "No merging without passing tests" },
  ];

  // Check if project context suggests these
  const allText = [
    brain.goal.text,
    ...brain.decisions.map((d) => d.text),
    ...brain.notes.map((n) => n.text),
  ].join(" ").toLowerCase();

  for (const pattern of commonPatterns) {
    if (allText.includes(pattern.keyword)) {
      const alreadyLocked = existingLockTexts.some((t) =>
        t.includes(pattern.keyword)
      );
      if (!alreadyLocked) {
        suggestions.push({
          text: pattern.suggestion,
          source: "pattern",
          sourceId: null,
          reason: `Project mentions "${pattern.keyword}" but has no lock protecting it`,
        });
      }
    }
  }

  return { suggestions, totalLocks: brain.specLock.items.filter((l) => l.active).length };
}

// --- Drift detection ---
export function detectDrift(root) {
  const brain = ensureInit(root);
  const activeLocks = brain.specLock.items.filter((l) => l.active !== false);
  if (activeLocks.length === 0) {
    return { drifts: [], status: "no_locks", message: "No active locks to check against." };
  }

  const drifts = [];

  // Check recent changes against locks
  for (const change of brain.state.recentChanges) {
    const changeLower = change.summary.toLowerCase();
    const changeWords = changeLower.split(/\s+/).filter((w) => w.length > 2);
    const changeExpanded = expandWithSynonyms(changeWords);

    for (const lock of activeLocks) {
      const lockLower = lock.text.toLowerCase();
      const lockWords = lockLower.split(/\s+/).filter((w) => w.length > 2);
      const lockExpanded = expandWithSynonyms(lockWords);

      const overlap = changeExpanded.filter((w) => lockExpanded.includes(w));
      const lockHasNegation = hasNegation(lockLower);

      if (overlap.length >= 2 && lockHasNegation) {
        drifts.push({
          lockId: lock.id,
          lockText: lock.text,
          changeEventId: change.eventId,
          changeSummary: change.summary,
          changeAt: change.at,
          matchedTerms: overlap,
          severity: overlap.length >= 3 ? "high" : "medium",
        });
      }
    }
  }

  // Check for reverts (always a drift signal)
  for (const revert of brain.state.reverts) {
    drifts.push({
      lockId: null,
      lockText: "(git revert detected)",
      changeEventId: revert.eventId,
      changeSummary: `Git ${revert.kind} to ${revert.target.substring(0, 12)}`,
      changeAt: revert.at,
      matchedTerms: ["revert"],
      severity: "high",
    });
  }

  const status = drifts.length === 0 ? "clean" : "drift_detected";
  const message = drifts.length === 0
    ? `All clear. ${activeLocks.length} lock(s) checked against ${brain.state.recentChanges.length} recent change(s). No drift detected.`
    : `WARNING: ${drifts.length} potential drift(s) detected. Review immediately.`;

  return { drifts, status, message };
}

// --- Session management ---

export function startSession(root, toolName = "unknown") {
  const brain = ensureInit(root);

  // Auto-close previous session if open
  if (brain.sessions.current) {
    const prev = brain.sessions.current;
    prev.endedAt = nowIso();
    prev.summary = prev.summary || "Session auto-closed (new session started)";
    brain.sessions.history.unshift(prev);
    if (brain.sessions.history.length > 50) {
      brain.sessions.history = brain.sessions.history.slice(0, 50);
    }
  }

  const session = {
    id: newId("ses"),
    startedAt: nowIso(),
    endedAt: null,
    summary: "",
    toolUsed: toolName,
    eventsInSession: 0,
  };
  brain.sessions.current = session;

  const eventId = newId("evt");
  const event = {
    eventId,
    type: "session_started",
    at: nowIso(),
    files: [],
    summary: `Session started (${toolName})`,
    patchPath: "",
  };
  recordEvent(root, brain, event);
  return { brain, session };
}

export function endSession(root, summary) {
  const brain = ensureInit(root);
  if (!brain.sessions.current) {
    return { brain, ended: false, error: "No active session to end." };
  }

  const session = brain.sessions.current;
  session.endedAt = nowIso();
  session.summary = summary;

  // Count events during this session
  const events = readEvents(root, { since: session.startedAt });
  session.eventsInSession = events.length;

  brain.sessions.history.unshift(session);
  if (brain.sessions.history.length > 50) {
    brain.sessions.history = brain.sessions.history.slice(0, 50);
  }
  brain.sessions.current = null;

  const eventId = newId("evt");
  const event = {
    eventId,
    type: "session_ended",
    at: nowIso(),
    files: [],
    summary: `Session ended: ${summary.substring(0, 100)}`,
    patchPath: "",
  };
  recordEvent(root, brain, event);
  return { brain, ended: true, session };
}

export function getSessionBriefing(root, toolName = "unknown") {
  const { brain, session } = startSession(root, toolName);

  const lastSession =
    brain.sessions.history.length > 0 ? brain.sessions.history[0] : null;

  let changesSinceLastSession = 0;
  let warnings = [];

  if (lastSession && lastSession.endedAt) {
    const eventsSince = readEvents(root, { since: lastSession.endedAt });
    changesSinceLastSession = eventsSince.length;

    // Check for reverts since last session
    const revertsSince = eventsSince.filter(
      (e) => e.type === "revert_detected"
    );
    if (revertsSince.length > 0) {
      warnings.push(
        `${revertsSince.length} revert(s) detected since last session. Verify current state before proceeding.`
      );
    }
  }

  return {
    brain,
    session,
    lastSession,
    changesSinceLastSession,
    warnings,
  };
}

// --- File watcher ---

export async function watchRepo(root) {
  const { default: chokidar } = await import("chokidar");
  const brain = ensureInit(root);
  const ignore = [
    "**/node_modules/**",
    "**/.git/**",
    "**/.speclock/**",
  ];

  let lastFileEventAt = 0;

  const watcher = chokidar.watch(root, {
    ignored: ignore,
    ignoreInitial: true,
    persistent: true,
  });

  watcher.on("add", (p) => {
    lastFileEventAt = Date.now();
    handleFileEvent(root, brain, "file_created", p);
  });
  watcher.on("change", (p) => {
    lastFileEventAt = Date.now();
    handleFileEvent(root, brain, "file_changed", p);
  });
  watcher.on("unlink", (p) => {
    lastFileEventAt = Date.now();
    handleFileEvent(root, brain, "file_deleted", p);
  });

  // Revert detection via HEAD polling
  if (brain.facts.repo.hasGit) {
    setInterval(() => {
      const head = getHead(root);
      if (!head.gitCommit) return;
      const prev = brain.state.head.gitCommit;
      const now = Date.now();
      if (prev && head.gitCommit !== prev && now - lastFileEventAt > 2000) {
        const eventId = newId("evt");
        const event = {
          eventId,
          type: "revert_detected",
          at: nowIso(),
          files: [],
          summary: `HEAD moved to ${head.gitCommit.substring(0, 12)}`,
          patchPath: "",
        };
        addRevert(brain, {
          eventId,
          kind: "git_checkout",
          target: head.gitCommit,
          at: event.at,
          note: "",
        });
        recordEvent(root, brain, event);
      }
      brain.state.head.gitBranch = head.gitBranch;
      brain.state.head.gitCommit = head.gitCommit;
      brain.state.head.capturedAt = nowIso();
      writeBrain(root, brain);
    }, 5000);
  }

  console.log("SpecLock watching for changes...");
  return watcher;
}
