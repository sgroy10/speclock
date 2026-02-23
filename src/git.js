const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function hasGit(root) {
  const gitDir = path.join(root, '.git');
  if (!fs.existsSync(gitDir)) return false;
  const res = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: root });
  return res.status === 0;
}

function getHead(root) {
  const branch = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root });
  const commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root });
  if (branch.status !== 0 || commit.status !== 0) {
    return { gitBranch: '', gitCommit: '' };
  }
  return {
    gitBranch: String(branch.stdout).trim(),
    gitCommit: String(commit.stdout).trim()
  };
}

function getDefaultBranch(root) {
  const res = spawnSync('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'], { cwd: root });
  if (res.status === 0) {
    const ref = String(res.stdout).trim();
    const parts = ref.split('/');
    return parts[parts.length - 1] || '';
  }
  const head = getHead(root);
  return head.gitBranch || '';
}

function captureDiff(root) {
  const res = spawnSync('git', ['diff'], { cwd: root });
  if (res.status !== 0) return null;
  return String(res.stdout);
}

module.exports = { hasGit, getHead, getDefaultBranch, captureDiff };
