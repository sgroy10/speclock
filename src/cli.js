#!/usr/bin/env node
const path = require('path');
const {
  ensureInit,
  setGoal,
  addLock,
  addDecision,
  updateDeployFacts,
  watchRepo,
  generateContext
} = require('./engine');

function parseArgs(argv) {
  const args = argv.slice(2);
  const cmd = args.shift();
  return { cmd, args };
}

function parseFlags(args) {
  const out = { _: [] };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (!next || next.startsWith('--')) {
        out[key] = true;
      } else {
        out[key] = next;
        i += 1;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

function parseTags(raw) {
  if (!raw) return [];
  return raw.split(',').map((t) => t.trim()).filter(Boolean);
}

function rootDir() {
  return process.cwd();
}

function main() {
  const { cmd, args } = parseArgs(process.argv);
  const root = rootDir();

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    console.log('Usage: flowkeeper <command>');
    console.log('Commands: init, goal, lock, decide, facts, watch, context');
    process.exit(0);
  }

  if (cmd === 'init') {
    ensureInit(root);
    console.log('FlowKeeper initialized.');
    return;
  }

  if (cmd === 'goal') {
    const text = args.join(' ').trim();
    if (!text) {
      console.error('Goal text is required.');
      process.exit(1);
    }
    setGoal(root, text);
    console.log('Goal updated.');
    return;
  }

  if (cmd === 'lock') {
    const flags = parseFlags(args);
    const text = flags._.join(' ').trim();
    if (!text) {
      console.error('Lock text is required.');
      process.exit(1);
    }
    addLock(root, text, parseTags(flags.tags), flags.source || 'user');
    console.log('SpecLock item added.');
    return;
  }

  if (cmd === 'decide') {
    const flags = parseFlags(args);
    const text = flags._.join(' ').trim();
    if (!text) {
      console.error('Decision text is required.');
      process.exit(1);
    }
    addDecision(root, text, parseTags(flags.tags), flags.source || 'user');
    console.log('Decision added.');
    return;
  }

  if (cmd === 'facts') {
    const sub = args.shift();
    if (sub !== 'deploy') {
      console.error('Only facts deploy is supported.');
      process.exit(1);
    }
    const flags = parseFlags(args);
    const payload = {
      provider: flags.provider,
      branch: flags.branch,
      notes: flags.notes
    };
    if (flags.autoDeploy !== undefined) {
      payload.autoDeploy = String(flags.autoDeploy).toLowerCase() === 'true';
    }
    updateDeployFacts(root, payload);
    console.log('Deploy facts updated.');
    return;
  }

  if (cmd === 'watch') {
    watchRepo(root);
    return;
  }

  if (cmd === 'context') {
    generateContext(root);
    console.log('Context pack generated.');
    return;
  }

  console.error(`Unknown command: ${cmd}`);
  process.exit(1);
}

main();