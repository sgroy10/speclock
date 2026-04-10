#!/usr/bin/env node

const PACKAGE = 'speclock';
const REPO = 'sgroy10/speclock';

async function fetchJSON(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'speclock-analytics' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    return null;
  }
}

function fmt(n) {
  if (n == null) return 'unavailable';
  return n.toLocaleString();
}

function bar(n, max = 100) {
  const width = 30;
  const filled = Math.min(Math.round((n / max) * width), width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

async function main() {
  const [daily, weekly, monthly, github, registry] = await Promise.all([
    fetchJSON(`https://api.npmjs.org/downloads/point/last-day/${PACKAGE}`),
    fetchJSON(`https://api.npmjs.org/downloads/point/last-week/${PACKAGE}`),
    fetchJSON(`https://api.npmjs.org/downloads/point/last-month/${PACKAGE}`),
    fetchJSON(`https://api.github.com/repos/${REPO}`),
    fetchJSON(`https://registry.npmjs.org/${PACKAGE}`)
  ]);

  const d = daily?.downloads ?? 0;
  const w = weekly?.downloads ?? 0;
  const m = monthly?.downloads ?? 0;
  const version = registry?.['dist-tags']?.latest ?? 'unknown';
  const created = registry?.time?.created ? new Date(registry.time.created).toLocaleDateString() : 'unknown';
  const modified = registry?.time?.modified ? new Date(registry.time.modified).toLocaleDateString() : 'unknown';
  const versions = registry?.versions ? Object.keys(registry.versions).length : 0;

  console.log('');
  console.log('  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║           SPECLOCK ANALYTICS DASHBOARD              ║');
  console.log('  ║           ' + new Date().toLocaleString().padEnd(42) + '║');
  console.log('  ╚══════════════════════════════════════════════════════╝');

  console.log('');
  console.log('  ── npm Downloads ─────────────────────────────────────');
  console.log(`  Today:      ${fmt(d).padStart(8)}  ${bar(d, Math.max(m / 30, 1))}`);
  console.log(`  This Week:  ${fmt(w).padStart(8)}  ${bar(w, Math.max(m, 1))}`);
  console.log(`  This Month: ${fmt(m).padStart(8)}  ${bar(m, Math.max(m, 1))}`);
  if (m > 0) {
    console.log(`  Daily Avg:  ${fmt(Math.round(m / 30)).padStart(8)}  (monthly / 30)`);
  }

  console.log('');
  console.log('  ── npm Package ───────────────────────────────────────');
  console.log(`  Version:    ${version}`);
  console.log(`  Versions:   ${versions} releases`);
  console.log(`  Created:    ${created}`);
  console.log(`  Updated:    ${modified}`);

  console.log('');
  console.log('  ── GitHub ────────────────────────────────────────────');
  if (github) {
    console.log(`  Stars:      ${fmt(github.stargazers_count).padStart(8)}  ${'⭐'.repeat(Math.min(github.stargazers_count, 20))}`);
    console.log(`  Forks:      ${fmt(github.forks_count).padStart(8)}`);
    console.log(`  Watchers:   ${fmt(github.subscribers_count).padStart(8)}`);
    console.log(`  Issues:     ${fmt(github.open_issues_count).padStart(8)}`);
    console.log(`  Size:       ${fmt(github.size)} KB`);
    console.log(`  License:    ${github.license?.spdx_id ?? 'unknown'}`);
    console.log(`  Default:    ${github.default_branch}`);
    if (github.pushed_at) {
      console.log(`  Last Push:  ${new Date(github.pushed_at).toLocaleDateString()}`);
    }
  } else {
    console.log('  GitHub data unavailable');
  }

  // Growth indicators
  console.log('');
  console.log('  ── Signals ───────────────────────────────────────────');
  const dailyAvg = m > 0 ? Math.round(m / 30) : 0;
  if (d > dailyAvg * 1.5 && dailyAvg > 0) {
    console.log('  📈 Today is above average — something is driving traffic!');
  } else if (d > 0) {
    console.log('  📊 Steady downloads today');
  } else {
    console.log('  📉 No downloads today yet');
  }
  if (github?.stargazers_count > 0) {
    const starsPerDownload = (github.stargazers_count / Math.max(m, 1)).toFixed(2);
    console.log(`  ⭐ Star-to-download ratio: ${starsPerDownload}`);
  }

  console.log('');
  console.log('  ── Distribution Status ───────────────────────────────');
  console.log('  ✅ npm (speclock)');
  console.log('  ✅ GitHub (sgroy10/speclock)');
  console.log('  ✅ Smithery (sgroy10/speclock)');
  console.log('  ✅ mcpservers.org');
  console.log('  ✅ MCP.so (submitted)');
  console.log('  ✅ Glama.ai (submitted, pending review)');
  console.log('  ✅ SettleGrid (claim email sent)');
  console.log('  ⏳ awesome-mcp-servers PR #2613 (needs Glama badge live)');
  console.log('  ✅ Official MCP Registry (PUBLISHED)');
  console.log('  ✅ MCP Market (listed)');
  console.log('  ⏳ MCP.Directory (submitted)');
  console.log('  ⏳ Cline Marketplace Issue #1292 (submitted)');
  console.log('  ⏳ awesome-claude-code (3 issues submitted)');
  console.log('  ✅ Hacker News (posted)');
  console.log('  ✅ Reddit r/ClaudeAI (posted)');
  console.log('  ✅ Reddit r/cursor (posted)');
  console.log('  ✅ dev.to blog (posted)');
  console.log('  ❌ Reddit r/programming (removed — no promo allowed)');
  console.log('  ❌ Reddit r/LocalLLaMA (removed — self-promo rule)');
  console.log('');
}

main().catch(console.error);
