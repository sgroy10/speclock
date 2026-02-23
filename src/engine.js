const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const {
  nowIso,
  ensureFlowkeeperDirs,
  flowkeeperDir,
  newId,
  readBrain,
  writeBrain,
  appendEvent,
  bumpEvents,
  addRecentChange,
  addRevert
} = require('./storage');
const { hasGit, getHead, getDefaultBranch, captureDiff } = require('./git');

function ensureInit(root) {
  ensureFlowkeeperDirs(root);
  let brain = readBrain(root);
  if (!brain) {
    const gitExists = hasGit(root);
    const defaultBranch = gitExists ? getDefaultBranch(root) : '';
    brain = require('./storage').makeBrain(root, gitExists, defaultBranch);
    if (gitExists) {
      const head = getHead(root);
      brain.state.head.gitBranch = head.gitBranch;
      brain.state.head.gitCommit = head.gitCommit;
      brain.state.head.capturedAt = nowIso();
    }
    const eventId = newId('evt');
    const event = {
      eventId,
      type: 'init',
      at: nowIso(),
      files: [],
      summary: 'Initialized FlowKeeper',
      patchPath: ''
    };
    bumpEvents(brain, eventId);
    appendEvent(root, event);
    writeBrain(root, brain);
  }
  return brain;
}

function recordEvent(root, brain, event) {
  bumpEvents(brain, event.eventId);
  appendEvent(root, event);
  writeBrain(root, brain);
}

function writePatch(root, eventId, content) {
  const patchPath = path.join(flowkeeperDir(root), 'patches', `${eventId}.patch`);
  fs.writeFileSync(patchPath, content);
  return path.join('.flowkeeper', 'patches', `${eventId}.patch`);
}

function setGoal(root, text) {
  const brain = ensureInit(root);
  brain.goal.text = text;
  brain.goal.updatedAt = nowIso();
  const eventId = newId('evt');
  const event = {
    eventId,
    type: 'goal_updated',
    at: nowIso(),
    files: [],
    summary: 'Updated goal',
    patchPath: ''
  };
  recordEvent(root, brain, event);
}

function addLock(root, text, tags, source) {
  const brain = ensureInit(root);
  brain.specLock.items.unshift({
    id: newId('lock'),
    text,
    createdAt: nowIso(),
    source: source || 'user',
    tags: tags || []
  });
  const eventId = newId('evt');
  const event = {
    eventId,
    type: 'lock_added',
    at: nowIso(),
    files: [],
    summary: 'Added SpecLock item',
    patchPath: ''
  };
  recordEvent(root, brain, event);
}

function addDecision(root, text, tags, source) {
  const brain = ensureInit(root);
  brain.decisions.unshift({
    id: newId('dec'),
    text,
    createdAt: nowIso(),
    source: source || 'user',
    tags: tags || []
  });
  const eventId = newId('evt');
  const event = {
    eventId,
    type: 'decision_added',
    at: nowIso(),
    files: [],
    summary: 'Added decision',
    patchPath: ''
  };
  recordEvent(root, brain, event);
}

function updateDeployFacts(root, payload) {
  const brain = ensureInit(root);
  const deploy = brain.facts.deploy;
  if (payload.provider) deploy.provider = payload.provider;
  if (typeof payload.autoDeploy === 'boolean') deploy.autoDeploy = payload.autoDeploy;
  if (payload.branch !== undefined) deploy.branch = payload.branch;
  if (payload.notes !== undefined) deploy.notes = payload.notes;
  const eventId = newId('evt');
  const event = {
    eventId,
    type: 'fact_updated',
    at: nowIso(),
    files: [],
    summary: 'Updated deploy facts',
    patchPath: ''
  };
  recordEvent(root, brain, event);
}

function handleFileEvent(root, brain, type, filePath) {
  const eventId = newId('evt');
  const rel = path.relative(root, filePath);
  let patchPath = '';
  if (brain.facts.repo.hasGit) {
    const diff = captureDiff(root);
    const patchContent = diff && diff.trim().length > 0 ? diff : '(no diff available)';
    patchPath = writePatch(root, eventId, patchContent);
  }
  const summary = `${type.replace('_', ' ')}: ${rel}`;
  const event = {
    eventId,
    type,
    at: nowIso(),
    files: [rel],
    summary,
    patchPath
  };
  addRecentChange(brain, {
    eventId,
    summary,
    files: [rel],
    at: event.at
  });
  recordEvent(root, brain, event);
}

function watchRepo(root) {
  const brain = ensureInit(root);
  const ignore = [
    '**/node_modules/**',
    '**/.git/**',
    '**/.flowkeeper/**'
  ];

  let lastFileEventAt = 0;

  const watcher = chokidar.watch(root, {
    ignored: ignore,
    ignoreInitial: true,
    persistent: true
  });

  watcher.on('add', (p) => {
    lastFileEventAt = Date.now();
    handleFileEvent(root, brain, 'file_created', p);
  });
  watcher.on('change', (p) => {
    lastFileEventAt = Date.now();
    handleFileEvent(root, brain, 'file_changed', p);
  });
  watcher.on('unlink', (p) => {
    lastFileEventAt = Date.now();
    handleFileEvent(root, brain, 'file_deleted', p);
  });

  if (brain.facts.repo.hasGit) {
    const intervalMs = 5000;
    setInterval(() => {
      const head = getHead(root);
      if (!head.gitCommit) return;
      const prev = brain.state.head.gitCommit;
      const now = Date.now();
      if (prev && head.gitCommit !== prev && now - lastFileEventAt > 2000) {
        const eventId = newId('evt');
        const event = {
          eventId,
          type: 'revert_detected',
          at: nowIso(),
          files: [],
          summary: `HEAD moved to ${head.gitCommit}`,
          patchPath: ''
        };
        addRevert(brain, {
          eventId,
          kind: 'git_checkout',
          target: head.gitCommit,
          at: event.at,
          note: ''
        });
        recordEvent(root, brain, event);
      }
      brain.state.head.gitBranch = head.gitBranch;
      brain.state.head.gitCommit = head.gitCommit;
      brain.state.head.capturedAt = nowIso();
      writeBrain(root, brain);
    }, intervalMs);
  }

  console.log('FlowKeeper watching for changes...');
}

function generateContext(root) {
  const brain = ensureInit(root);
  const contextPath = path.join(flowkeeperDir(root), 'context', 'latest.md');

  const specItems = brain.specLock.items.slice(0, 12).map((i) => `- ${i.text}`);
  const decisions = brain.decisions.slice(0, 10).map((i) => `- ${i.text}`);
  const recent = brain.state.recentChanges.slice(0, 5).map((c) => {
    const files = c.files && c.files.length ? c.files.join(', ') : '';
    return `- [${c.at}] ${c.summary}${files ? ` (${files})` : ''}`;
  });
  const reverts = brain.state.reverts.map((r) => `- [${r.at}] ${r.kind} ${r.target}`);

  const lines = [
    '# FlowKeeper Context Pack',
    '## Goal',
    brain.goal.text || '',
    '## SpecLock (Non-negotiables)',
    specItems.length ? specItems.join('\n') : '- (none)',
    '## Decisions',
    decisions.length ? decisions.join('\n') : '- (none)',
    '## Deploy Facts',
    `- Provider: ${brain.facts.deploy.provider}`,
    `- Auto-deploy: ${brain.facts.deploy.autoDeploy}`,
    `- Branch: ${brain.facts.deploy.branch}`,
    '## Recent Changes (last 5)',
    recent.length ? recent.join('\n') : '- (none)',
    '## Reverts (if any)',
    reverts.length ? reverts.join('\n') : '- (none)',
    '## Instruction to agent',
    'Follow SpecLock and Decisions. Do not contradict. If unsure, re-run `flowkeeper context`.'
  ];

  fs.writeFileSync(contextPath, `${lines.join('\n')}\n`);

  const eventId = newId('evt');
  const event = {
    eventId,
    type: 'context_generated',
    at: nowIso(),
    files: ['.flowkeeper/context/latest.md'],
    summary: 'Generated context pack',
    patchPath: ''
  };
  recordEvent(root, brain, event);
}

module.exports = {
  ensureInit,
  setGoal,
  addLock,
  addDecision,
  updateDeployFacts,
  watchRepo,
  generateContext
};
