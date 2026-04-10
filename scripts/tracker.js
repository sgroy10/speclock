#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_FILE = path.join(__dirname, '..', 'analytics-log.json');
const PACKAGE = 'speclock';
const REPO = 'sgroy10/speclock';

async function fetchJSON(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'speclock-tracker' } });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

function loadLog() {
  try {
    return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
  } catch {
    return { entries: [] };
  }
}

function saveLog(log) {
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
}

function fmt(n) {
  return n == null ? '?' : n.toLocaleString();
}

function sparkline(nums, width = 30) {
  if (!nums.length) return '';
  const blocks = '▁▂▃▄▅▆▇█';
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  return nums.slice(-width).map(n => blocks[Math.min(Math.floor((n - min) / range * 7), 7)]).join('');
}

async function record() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const tenDaysAgo = new Date(now - 10 * 86400000).toISOString().slice(0, 10);
  const [daily, weekly, monthly, github, range] = await Promise.all([
    fetchJSON(`https://api.npmjs.org/downloads/point/last-day/${PACKAGE}`),
    fetchJSON(`https://api.npmjs.org/downloads/point/last-week/${PACKAGE}`),
    fetchJSON(`https://api.npmjs.org/downloads/point/last-month/${PACKAGE}`),
    fetchJSON(`https://api.github.com/repos/${REPO}`),
    fetchJSON(`https://api.npmjs.org/downloads/range/${tenDaysAgo}:${today}/${PACKAGE}`)
  ]);

  const entry = {
    time: now.toISOString(),
    hour: now.toLocaleString(),
    npm_daily: daily?.downloads ?? null,
    npm_weekly: weekly?.downloads ?? null,
    npm_monthly: monthly?.downloads ?? null,
    gh_stars: github?.stargazers_count ?? null,
    gh_forks: github?.forks_count ?? null,
    gh_watchers: github?.subscribers_count ?? null,
    daily_breakdown: range?.downloads ?? null
  };

  const log = loadLog();
  log.entries.push(entry);
  saveLog(log);

  return { entry, log };
}

function showDashboard(log) {
  const entries = log.entries;
  const latest = entries[entries.length - 1];
  const prev = entries.length > 1 ? entries[entries.length - 2] : null;

  console.log('');
  console.log('  ╔══════════════════════════════════════════════════════════╗');
  console.log('  ║          SPECLOCK HOURLY TRACKER                        ║');
  console.log('  ║          ' + latest.hour.padEnd(46) + '║');
  console.log('  ╚══════════════════════════════════════════════════════════╝');

  // Current stats
  console.log('');
  console.log('  ── Current Stats ─────────────────────────────────────────');
  console.log(`  npm Daily:    ${fmt(latest.npm_daily).padStart(8)}  ${prev ? (latest.npm_daily > prev.npm_daily ? '↑' : latest.npm_daily < prev.npm_daily ? '↓' : '→') : ' '} ${prev && latest.npm_daily !== prev.npm_daily ? `(was ${fmt(prev.npm_daily)})` : ''}`);
  console.log(`  npm Weekly:   ${fmt(latest.npm_weekly).padStart(8)}  ${prev ? (latest.npm_weekly > prev.npm_weekly ? '↑' : latest.npm_weekly < prev.npm_weekly ? '↓' : '→') : ' '} ${prev && latest.npm_weekly !== prev.npm_weekly ? `(was ${fmt(prev.npm_weekly)})` : ''}`);
  console.log(`  npm Monthly:  ${fmt(latest.npm_monthly).padStart(8)}  ${prev ? (latest.npm_monthly > prev.npm_monthly ? '↑' : latest.npm_monthly < prev.npm_monthly ? '↓' : '→') : ' '} ${prev && latest.npm_monthly !== prev.npm_monthly ? `(was ${fmt(prev.npm_monthly)})` : ''}`);
  console.log(`  GitHub Stars: ${fmt(latest.gh_stars).padStart(8)}  ${prev ? (latest.gh_stars > prev.gh_stars ? '↑ NEW STAR!' : '→') : ' '}`);
  console.log(`  GitHub Forks: ${fmt(latest.gh_forks).padStart(8)}`);

  // Trends
  if (entries.length > 1) {
    console.log('');
    console.log('  ── Trends ────────────────────────────────────────────────');

    const dailyNums = entries.map(e => e.npm_daily).filter(n => n != null);
    const weeklyNums = entries.map(e => e.npm_weekly).filter(n => n != null);
    const starNums = entries.map(e => e.gh_stars).filter(n => n != null);

    console.log(`  Daily DLs:  ${sparkline(dailyNums)}  (${dailyNums.length} readings)`);
    console.log(`  Weekly DLs: ${sparkline(weeklyNums)}  (${weeklyNums.length} readings)`);
    console.log(`  Stars:      ${sparkline(starNums)}  (${starNums.length} readings)`);

    // Deltas
    const first = entries[0];
    const starDelta = latest.gh_stars - first.gh_stars;
    const monthlyDelta = latest.npm_monthly - first.npm_monthly;
    const hours = Math.max(1, Math.round((new Date(latest.time) - new Date(first.time)) / 3600000));

    console.log('');
    console.log('  ── Since Tracking Started ────────────────────────────────');
    console.log(`  First reading:  ${first.hour}`);
    console.log(`  Hours tracked:  ${hours}`);
    console.log(`  Star change:    ${starDelta >= 0 ? '+' : ''}${starDelta}`);
    console.log(`  Monthly DL Δ:   ${monthlyDelta >= 0 ? '+' : ''}${fmt(monthlyDelta)}`);
    if (hours > 1) {
      console.log(`  DL/hour avg:    ~${fmt(Math.round(monthlyDelta / hours))}`);
    }
  }

  // History table (last 12 entries)
  if (entries.length > 1) {
    console.log('');
    console.log('  ── History (last 12 readings) ────────────────────────────');
    console.log('  Time                    Daily    Weekly   Monthly  Stars');
    console.log('  ─────────────────────── ──────── ──────── ──────── ─────');
    const recent = entries.slice(-12);
    for (const e of recent) {
      const t = new Date(e.time);
      const timeStr = `${t.getMonth()+1}/${t.getDate()} ${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`;
      console.log(`  ${timeStr.padEnd(24)} ${fmt(e.npm_daily).padStart(8)} ${fmt(e.npm_weekly).padStart(8)} ${fmt(e.npm_monthly).padStart(8)} ${fmt(e.gh_stars).padStart(5)}`);
    }
  }

  // Daily breakdown — the most useful view
  if (latest.daily_breakdown && latest.daily_breakdown.length) {
    console.log('');
    console.log('  ── Daily Downloads (last 10 days) ────────────────────────');
    const days = latest.daily_breakdown;
    const max = Math.max(...days.map(d => d.downloads), 1);
    for (const d of days) {
      const bar = '█'.repeat(Math.round((d.downloads / max) * 30));
      const marker = d.downloads >= max && d.downloads > 0 ? ' 🚀' : '';
      console.log(`  ${d.day}  ${String(d.downloads).padStart(5)}  ${bar}${marker}`);
    }
    const total = days.reduce((a, b) => a + b.downloads, 0);
    const nonZero = days.filter(d => d.downloads > 0);
    const avg = nonZero.length ? Math.round(total / nonZero.length) : 0;
    console.log(`  ─────────────────────────────────────────────────────────`);
    console.log(`  10-day total: ${total.toLocaleString()} | Avg/day: ${avg}`);
  }

  console.log('');
  console.log(`  Total readings: ${entries.length} | Log: analytics-log.json`);
  console.log('');
}

async function main() {
  const mode = process.argv[2];

  if (mode === '--view') {
    // Just show the dashboard without recording
    const log = loadLog();
    if (!log.entries.length) {
      console.log('  No data yet. Run: node scripts/tracker.js');
      return;
    }
    showDashboard(log);
    return;
  }

  if (mode === '--loop') {
    // Continuous mode — record every hour
    const intervalMs = 3600000; // 1 hour
    console.log(`  Starting hourly tracker (every 60 min). Ctrl+C to stop.`);
    console.log(`  First reading now...`);

    const run = async () => {
      const { log } = await record();
      showDashboard(log);
      console.log(`  Next reading at ${new Date(Date.now() + intervalMs).toLocaleString()}`);
    };

    await run();
    setInterval(run, intervalMs);
    return;
  }

  // Default: single recording + dashboard
  const { log } = await record();
  showDashboard(log);
  console.log('  Run modes:');
  console.log('    node scripts/tracker.js          # Record + show');
  console.log('    node scripts/tracker.js --view    # Show only (no record)');
  console.log('    node scripts/tracker.js --loop    # Record every hour');
}

main().catch(console.error);
