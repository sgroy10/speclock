const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { spawnSync } = require('child_process');

let mainWindow = null;
let currentRepo = null;
let watcherStarted = false;
let devServerProcess = null;

function safeReadJson(p) {
  try {
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readEventsTail(p, maxLines) {
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const lines = raw.trim().split(/\r?\n/);
    const tail = lines.slice(-maxLines);
    return tail
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function engineModulePath() {
  return path.join(__dirname, '..', '..', 'src', 'engine.js');
}

function ensureEngine() {
  const modPath = engineModulePath();
  return require(modPath);
}

function startWatcher(repoRoot) {
  if (watcherStarted) return;
  const engine = ensureEngine();
  engine.ensureInit(repoRoot);
  engine.watchRepo(repoRoot);
  watcherStarted = true;
}

function stopDevServer() {
  if (!devServerProcess) return false;
  devServerProcess.kill();
  devServerProcess = null;
  return true;
}

function getPricingData() {
  const pricingPath = path.join(__dirname, '..', 'data', 'pricing.json');
  try {
    const raw = fs.readFileSync(pricingPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function runOpenAI(payload) {
  const url = payload.baseUrl || 'https://api.openai.com/v1/chat/completions';
  const body = {
    model: payload.model,
    messages: payload.messages,
    max_tokens: payload.maxTokens || 1024,
    temperature: payload.temperature ?? 0.2
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${payload.apiKey}`
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || 'OpenAI request failed';
    throw new Error(msg);
  }
  const text = data?.choices?.[0]?.message?.content || '';
  return { text };
}

async function runAnthropic(payload) {
  const url = payload.baseUrl || 'https://api.anthropic.com/v1/messages';
  const body = {
    model: payload.model,
    max_tokens: payload.maxTokens || 1024,
    messages: payload.messages
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': payload.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || 'Anthropic request failed';
    throw new Error(msg);
  }
  const text = data?.content?.[0]?.text || '';
  return { text };
}

async function runGemini(payload) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${payload.model}:generateContent?key=${payload.apiKey}`;
  const contents = [];
  let systemInstruction = null;

  for (const msg of payload.messages || []) {
    if (msg.role === 'system' && !systemInstruction) {
      systemInstruction = { parts: [{ text: msg.content }] };
      continue;
    }
    const role = msg.role === 'assistant' ? 'model' : 'user';
    contents.push({ role, parts: [{ text: msg.content }] });
  }

  const body = { contents };
  if (systemInstruction) body.system_instruction = systemInstruction;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || 'Gemini request failed';
    throw new Error(msg);
  }
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  return { text };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#0f1318',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopDevServer();
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('select-repo', async () => {
  const res = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (res.canceled || !res.filePaths.length) return null;
  return res.filePaths[0];
});

ipcMain.handle('select-folder', async () => {
  const res = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory']
  });
  if (res.canceled || !res.filePaths.length) return null;
  return res.filePaths[0];
});

ipcMain.handle('create-project', async (_evt, payload) => {
  if (!payload || !payload.parentPath || !payload.name || !payload.template) {
    return { ok: false, error: 'Missing fields' };
  }

  const projectPath = path.join(payload.parentPath, payload.name);
  if (fs.existsSync(projectPath)) {
    return { ok: false, error: 'Folder already exists' };
  }

  const templatePath = path.join(__dirname, '..', 'templates', payload.template);
  if (!fs.existsSync(templatePath)) {
    return { ok: false, error: 'Template not found' };
  }

  copyDir(templatePath, projectPath);
  return { ok: true, projectPath };
});

ipcMain.handle('open-repo', async (_evt, repoPath) => {
  currentRepo = repoPath;
  watcherStarted = false;
  startWatcher(currentRepo);
  return { ok: true };
});

ipcMain.handle('get-state', async () => {
  if (!currentRepo) return { repo: null, brain: null, events: [] };
  const brain = safeReadJson(path.join(currentRepo, '.flowkeeper', 'brain.json'));
  const events = readEventsTail(path.join(currentRepo, '.flowkeeper', 'events.log'), 100);
  return { repo: currentRepo, brain, events };
});

ipcMain.handle('generate-context', async () => {
  if (!currentRepo) return { ok: false };
  const engine = ensureEngine();
  engine.generateContext(currentRepo);
  return { ok: true };
});

ipcMain.handle('get-context', async () => {
  if (!currentRepo) return { text: '' };
  const p = path.join(currentRepo, '.flowkeeper', 'context', 'latest.md');
  try {
    const text = fs.readFileSync(p, 'utf8');
    return { text };
  } catch {
    return { text: '' };
  }
});

ipcMain.handle('start-dev-server', async (_evt, payload) => {
  if (!currentRepo) return { ok: false, error: 'No repo selected' };
  if (!payload || !payload.command) return { ok: false, error: 'No command provided' };

  if (devServerProcess) {
    stopDevServer();
  }

  devServerProcess = spawn(payload.command, {
    cwd: currentRepo,
    shell: true,
    env: process.env,
    stdio: 'ignore'
  });

  devServerProcess.on('exit', () => {
    devServerProcess = null;
  });

  return { ok: true };
});

ipcMain.handle('stop-dev-server', async () => {
  const stopped = stopDevServer();
  return { ok: stopped };
});

ipcMain.handle('get-pricing', async () => {
  const data = getPricingData();
  if (!data) return { ok: false };
  return { ok: true, data };
});

ipcMain.handle('get-diff', async () => {
  if (!currentRepo) return { ok: false, error: 'No repo selected' };
  const res = spawnSync('git', ['diff'], { cwd: currentRepo });
  if (res.status !== 0) return { ok: false, error: 'git diff failed' };
  return { ok: true, text: String(res.stdout) };
});

ipcMain.handle('run-model', async (_evt, payload) => {
  if (!payload || !payload.provider) return { ok: false, error: 'No provider' };
  if (!payload.apiKey) return { ok: false, error: 'API key required' };
  if (!payload.model) return { ok: false, error: 'Model required' };

  try {
    if (payload.provider === 'OpenAI') {
      const res = await runOpenAI(payload);
      return { ok: true, text: res.text };
    }
    if (payload.provider === 'Anthropic') {
      const res = await runAnthropic(payload);
      return { ok: true, text: res.text };
    }
    if (payload.provider === 'Gemini') {
      const res = await runGemini(payload);
      return { ok: true, text: res.text };
    }
    if (payload.provider === 'Grok') {
      if (!payload.baseUrl) return { ok: false, error: 'Base URL required for Grok' };
      const res = await runOpenAI(payload);
      return { ok: true, text: res.text };
    }
    if (payload.provider === 'Kimi') {
      const res = await runOpenAI({
        ...payload,
        baseUrl: payload.baseUrl || 'https://api.moonshot.ai/v1'
      });
      return { ok: true, text: res.text };
    }
    if (payload.provider === 'Custom') {
      const res = await runOpenAI(payload);
      return { ok: true, text: res.text };
    }
    return { ok: false, error: 'Unsupported provider' };
  } catch (err) {
    return { ok: false, error: err.message || 'Request failed' };
  }
});
