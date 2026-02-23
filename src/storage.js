const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function nowIso() {
  return new Date().toISOString();
}

function flowkeeperDir(root) {
  return path.join(root, '.flowkeeper');
}

function ensureFlowkeeperDirs(root) {
  const base = flowkeeperDir(root);
  fs.mkdirSync(base, { recursive: true });
  fs.mkdirSync(path.join(base, 'patches'), { recursive: true });
  fs.mkdirSync(path.join(base, 'context'), { recursive: true });
}

function brainPath(root) {
  return path.join(flowkeeperDir(root), 'brain.json');
}

function eventsPath(root) {
  return path.join(flowkeeperDir(root), 'events.log');
}

function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function readBrain(root) {
  const p = brainPath(root);
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

function writeBrain(root, brain) {
  brain.project.updatedAt = nowIso();
  const p = brainPath(root);
  fs.writeFileSync(p, JSON.stringify(brain, null, 2));
}

function appendEvent(root, event) {
  const line = JSON.stringify(event);
  fs.appendFileSync(eventsPath(root), `${line}\n`);
}

function makeBrain(root, hasGit, defaultBranch) {
  const createdAt = nowIso();
  const folderName = path.basename(root);
  return {
    version: 1,
    project: {
      id: newId('fk'),
      name: folderName,
      root: root,
      createdAt,
      updatedAt: createdAt
    },
    goal: { text: '', updatedAt: createdAt },
    specLock: {
      items: []
    },
    decisions: [],
    facts: {
      deploy: {
        provider: 'unknown',
        autoDeploy: false,
        branch: '',
        notes: ''
      },
      repo: {
        defaultBranch: defaultBranch || '',
        hasGit: !!hasGit
      }
    },
    importance: {
      pinnedFiles: [],
      pinnedNotes: []
    },
    state: {
      head: {
        gitBranch: '',
        gitCommit: '',
        capturedAt: createdAt
      },
      recentChanges: [],
      reverts: []
    },
    events: { lastEventId: '', count: 0 }
  };
}

function bumpEvents(brain, eventId) {
  brain.events.lastEventId = eventId;
  brain.events.count += 1;
}

function addRecentChange(brain, item) {
  brain.state.recentChanges.unshift(item);
  if (brain.state.recentChanges.length > 20) {
    brain.state.recentChanges = brain.state.recentChanges.slice(0, 20);
  }
}

function addRevert(brain, item) {
  brain.state.reverts.unshift(item);
}

module.exports = {
  nowIso,
  flowkeeperDir,
  ensureFlowkeeperDirs,
  brainPath,
  eventsPath,
  newId,
  readBrain,
  writeBrain,
  appendEvent,
  makeBrain,
  bumpEvents,
  addRecentChange,
  addRevert
};