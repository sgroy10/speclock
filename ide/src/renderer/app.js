const repoPathEl = document.getElementById('repoPath');
const selectRepoBtn = document.getElementById('selectRepo');
const newProjectBtn = document.getElementById('newProject');
const genContextBtn = document.getElementById('genContext');
const copyContextBtn = document.getElementById('copyContext');
const providerPicker = document.getElementById('providerPicker');
const modelPicker = document.getElementById('modelPicker');
const modelLabel = document.getElementById('modelLabel');
const apiKeyInput = document.getElementById('apiKey');
const baseUrlInput = document.getElementById('baseUrl');
const customModelInput = document.getElementById('customModel');
const devCommandInput = document.getElementById('devCommand');
const previewUrlInput = document.getElementById('previewUrl');
const startPreviewBtn = document.getElementById('startPreview');
const stopPreviewBtn = document.getElementById('stopPreview');
const previewFrame = document.getElementById('previewFrame');
const previewStatusEl = document.getElementById('previewStatus');
const runPromptBtn = document.getElementById('runPrompt');
const responseTextEl = document.getElementById('responseText');
const goalTextEl = document.getElementById('goalText');
const lockListEl = document.getElementById('lockList');
const decisionListEl = document.getElementById('decisionList');
const revertListEl = document.getElementById('revertList');
const recentListEl = document.getElementById('recentList');
const eventListEl = document.getElementById('eventList');
const eventCountEl = document.getElementById('eventCount');
const engineStatusEl = document.getElementById('engineStatus');
const continuityStatusEl = document.getElementById('continuityStatus');
const contextPreviewEl = document.getElementById('contextPreview');
const promptInput = document.getElementById('promptInput');
const inputTokensEl = document.getElementById('inputTokens');
const outputTokensEl = document.getElementById('outputTokens');
const inputRateEl = document.getElementById('inputRate');
const outputRateEl = document.getElementById('outputRate');
const estimateResultEl = document.getElementById('estimateResult');
const pricingMetaEl = document.getElementById('pricingMeta');
const refreshPricingBtn = document.getElementById('refreshPricing');
const diffBoxEl = document.getElementById('diffBox');
const loadDiffBtn = document.getElementById('loadDiff');
const sessionListEl = document.getElementById('sessionList');

const modalEl = document.getElementById('modal');
const projectNameEl = document.getElementById('projectName');
const projectPathEl = document.getElementById('projectPath');
const pickFolderBtn = document.getElementById('pickFolder');
const templateGridEl = document.getElementById('templateGrid');
const cancelProjectBtn = document.getElementById('cancelProject');
const createProjectBtn = document.getElementById('createProject');
const projectErrorEl = document.getElementById('projectError');

const templates = [
  { id: 'landing', title: 'Landing Page', desc: 'Marketing page with hero + pricing.' },
  { id: 'saas', title: 'SaaS Dashboard', desc: 'Ops dashboard layout with metrics.' }
];

let selectedTemplate = 'landing';
let sessionHistory = [];

const modelsByProvider = {
  OpenAI: [
    { id: 'gpt-4o', label: 'GPT-4o', inRate: 2.5, outRate: 10 },
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini', inRate: 0.15, outRate: 0.6 },
    { id: 'gpt-4.1', label: 'GPT-4.1', inRate: 2, outRate: 8 },
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', inRate: 0.4, outRate: 1.6 }
  ],
  Anthropic: [
    { id: 'claude-sonnet-4', label: 'Claude Sonnet 4', inRate: 3, outRate: 15 },
    { id: 'claude-haiku-3-5', label: 'Claude Haiku 3.5', inRate: 0.8, outRate: 4 },
    { id: 'claude-opus-4', label: 'Claude Opus 4', inRate: 15, outRate: 75 }
  ],
  Gemini: [
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', inRate: 1.25, outRate: 10 },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', inRate: 0.3, outRate: 2.5 },
    { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', inRate: 0.1, outRate: 0.4 }
  ],
  Grok: [
    { id: 'grok-4', label: 'Grok 4', inRate: 3, outRate: 15 },
    { id: 'grok-code-fast-1', label: 'Grok Code Fast 1', inRate: 0.2, outRate: 1.5 }
  ],
  Kimi: [
    { id: 'kimi-k2-0711-preview', label: 'Kimi K2 0711 Preview', inRate: null, outRate: null }
  ],
  Custom: [
    { id: 'custom', label: 'Custom', inRate: null, outRate: null }
  ]
};

function renderList(el, items, emptyText) {
  el.innerHTML = '';
  if (!items || items.length === 0) {
    const div = document.createElement('div');
    div.className = 'muted';
    div.textContent = emptyText;
    el.appendChild(div);
    return;
  }
  items.forEach((item) => {
    const div = document.createElement('div');
    div.textContent = item;
    el.appendChild(div);
  });
}

function renderTemplates() {
  templateGridEl.innerHTML = '';
  templates.forEach((tpl) => {
    const card = document.createElement('div');
    card.className = `template-card ${tpl.id === selectedTemplate ? 'active' : ''}`;
    card.dataset.template = tpl.id;
    card.innerHTML = `
      <div class="template-title">${tpl.title}</div>
      <div class="template-desc">${tpl.desc}</div>
    `;
    card.addEventListener('click', () => {
      selectedTemplate = tpl.id;
      renderTemplates();
    });
    templateGridEl.appendChild(card);
  });
}

function renderSessionHistory() {
  if (!sessionHistory.length) {
    sessionListEl.classList.add('muted');
    sessionListEl.textContent = 'No sessions yet';
    return;
  }
  sessionListEl.classList.remove('muted');
  sessionListEl.innerHTML = '';
  sessionHistory.slice(-5).reverse().forEach((item) => {
    const div = document.createElement('div');
    div.textContent = `${item.provider} ${item.model} — ${item.prompt.slice(0, 60)}`;
    sessionListEl.appendChild(div);
  });
}

function setModelOptions(provider) {
  modelPicker.innerHTML = '';
  const models = modelsByProvider[provider] || [];
  models.forEach((model) => {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = model.label;
    modelPicker.appendChild(option);
  });
  applyRates(provider, models[0]);
}

function applyRates(provider, model) {
  const inRate = model?.inRate ?? '';
  const outRate = model?.outRate ?? '';
  inputRateEl.value = inRate === null ? '' : inRate;
  outputRateEl.value = outRate === null ? '' : outRate;
  const showCustom = provider === 'Custom' || provider === 'Kimi' || !model?.id;
  customModelInput.style.display = showCustom ? 'block' : 'none';
  baseUrlInput.style.display = provider === 'Custom' || provider === 'Grok' || provider === 'Kimi' ? 'block' : 'none';
  if (provider === 'Kimi' && !baseUrlInput.value) baseUrlInput.value = 'https://api.moonshot.ai/v1';
  if (provider === 'Grok' && !baseUrlInput.value) baseUrlInput.value = '';
  if (provider === 'Kimi') {
    customModelInput.value = model?.id || customModelInput.value;
  }
}

function estimateCost() {
  const inputTokens = Number(inputTokensEl.value || 0);
  const outputTokens = Number(outputTokensEl.value || 0);
  const inputRate = Number(inputRateEl.value || 0);
  const outputRate = Number(outputRateEl.value || 0);
  const cost = (inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate;
  estimateResultEl.textContent = `Estimated cost: $${cost.toFixed(4)}`;
}

function loadPricingData(data) {
  if (!data || !data.providers) return;
  pricingMetaEl.textContent = `Rates updated: ${data.updatedAt || 'unknown'}`;
  Object.keys(modelsByProvider).forEach((provider) => {
    const models = modelsByProvider[provider];
    const providerRates = data.providers[provider] || {};
    models.forEach((model) => {
      const rate = providerRates[model.id];
      if (rate) {
        model.inRate = rate.in;
        model.outRate = rate.out;
      }
    });
  });
  setModelOptions(providerPicker.value);
  estimateCost();
}

async function refreshPricing() {
  const res = await window.flowkeeper.getPricing();
  if (res.ok) {
    loadPricingData(res.data);
  }
}

async function refreshState() {
  const state = await window.flowkeeper.getState();
  if (!state.repo) {
    repoPathEl.textContent = 'Not connected';
    engineStatusEl.textContent = 'Engine: offline';
    continuityStatusEl.textContent = 'Continuity: idle';
    return;
  }

  repoPathEl.textContent = state.repo;
  engineStatusEl.textContent = 'Engine: active';

  const brain = state.brain;
  if (brain) {
    goalTextEl.textContent = brain.goal?.text || 'Not set';
    renderList(
      lockListEl,
      (brain.specLock?.items || []).slice(0, 6).map((i) => `• ${i.text}`),
      'No locks'
    );
    renderList(
      decisionListEl,
      (brain.decisions || []).slice(0, 6).map((i) => `• ${i.text}`),
      'No decisions'
    );
    renderList(
      revertListEl,
      (brain.state?.reverts || []).slice(0, 4).map((i) => `• ${i.kind} ${i.target}`),
      'No reverts'
    );
    renderList(
      recentListEl,
      (brain.state?.recentChanges || []).slice(0, 5).map((i) => `• ${i.summary}`),
      'No recent changes'
    );
    continuityStatusEl.textContent = `Continuity: ${brain.state?.recentChanges?.length ? 'tracking' : 'idle'}`;
  }

  renderList(
    eventListEl,
    (state.events || []).slice(-8).reverse().map((e) => `${e.type} — ${e.summary}`),
    'No events yet'
  );

  eventCountEl.textContent = `${state.events?.length || 0} events`;
}

async function refreshContext() {
  const res = await window.flowkeeper.getContext();
  if (res.text) {
    contextPreviewEl.textContent = res.text.trim();
  }
}

function showModal() {
  modalEl.classList.remove('hidden');
  projectErrorEl.textContent = '';
  renderTemplates();
}

function hideModal() {
  modalEl.classList.add('hidden');
}

selectRepoBtn.addEventListener('click', async () => {
  const repo = await window.flowkeeper.selectRepo();
  if (!repo) return;
  await window.flowkeeper.openRepo(repo);
  await refreshState();
  await refreshContext();
});

newProjectBtn.addEventListener('click', () => {
  showModal();
});

pickFolderBtn.addEventListener('click', async () => {
  const folder = await window.flowkeeper.selectFolder();
  if (folder) projectPathEl.value = folder;
});

cancelProjectBtn.addEventListener('click', () => {
  hideModal();
});

createProjectBtn.addEventListener('click', async () => {
  const name = projectNameEl.value.trim();
  const parentPath = projectPathEl.value.trim();
  if (!name || !parentPath) {
    projectErrorEl.textContent = 'Name and location are required.';
    return;
  }

  const res = await window.flowkeeper.createProject({ name, parentPath, template: selectedTemplate });
  if (!res.ok) {
    projectErrorEl.textContent = res.error || 'Failed to create project.';
    return;
  }

  await window.flowkeeper.openRepo(res.projectPath);
  hideModal();
  await refreshState();
  await refreshContext();
});

genContextBtn.addEventListener('click', async () => {
  await window.flowkeeper.generateContext();
  await refreshContext();
});

copyContextBtn.addEventListener('click', async () => {
  const res = await window.flowkeeper.getContext();
  if (!res.text) return;
  await navigator.clipboard.writeText(res.text);
  copyContextBtn.textContent = 'Copied';
  setTimeout(() => (copyContextBtn.textContent = 'Copy Context'), 1200);
});

providerPicker.addEventListener('change', () => {
  const provider = providerPicker.value;
  modelLabel.textContent = `Provider: ${provider}`;
  setModelOptions(provider);
});

modelPicker.addEventListener('change', () => {
  const provider = providerPicker.value;
  const selected = modelsByProvider[provider]?.find((m) => m.id === modelPicker.value);
  applyRates(provider, selected);
});

[inputTokensEl, outputTokensEl, inputRateEl, outputRateEl].forEach((el) => {
  el.addEventListener('input', estimateCost);
});

refreshPricingBtn.addEventListener('click', async () => {
  await refreshPricing();
});

startPreviewBtn.addEventListener('click', async () => {
  const command = devCommandInput.value.trim() || 'npm run dev';
  const url = previewUrlInput.value.trim() || 'http://localhost:3000';
  devCommandInput.value = command;
  previewUrlInput.value = url;
  const res = await window.flowkeeper.startDevServer({ command });
  if (res.ok) {
    previewFrame.src = url;
    previewStatusEl.textContent = 'Preview: running';
  } else {
    previewStatusEl.textContent = `Preview: ${res.error || 'failed'}`;
  }
});

stopPreviewBtn.addEventListener('click', async () => {
  await window.flowkeeper.stopDevServer();
  previewFrame.src = 'about:blank';
  previewStatusEl.textContent = 'Preview: stopped';
});

loadDiffBtn.addEventListener('click', async () => {
  const res = await window.flowkeeper.getDiff();
  if (res.ok) {
    diffBoxEl.textContent = res.text || '(no diff)';
  } else {
    diffBoxEl.textContent = res.error || 'diff failed';
  }
});

runPromptBtn.addEventListener('click', async () => {
  const provider = providerPicker.value;
  const apiKey = apiKeyInput.value.trim();
  const model = provider === 'Custom'
    ? customModelInput.value.trim()
    : (provider === 'Kimi' ? (customModelInput.value.trim() || modelPicker.value) : modelPicker.value);
  const baseUrl = baseUrlInput.value.trim();
  const prompt = promptInput.value.trim();

  if (!apiKey || !model || !prompt) {
    responseTextEl.textContent = 'Missing API key, model, or prompt.';
    return;
  }

  await window.flowkeeper.generateContext();
  const contextRes = await window.flowkeeper.getContext();
  const context = contextRes.text || '';

  const messages = [
    { role: 'system', content: context },
    { role: 'user', content: prompt }
  ];

  responseTextEl.textContent = 'Running...';

  const res = await window.flowkeeper.runModel({
    provider,
    apiKey,
    model,
    baseUrl: baseUrl || undefined,
    messages
  });

  if (res.ok) {
    responseTextEl.textContent = res.text || '(empty response)';
    sessionHistory.push({
      provider,
      model,
      prompt,
      response: res.text || '',
      at: new Date().toISOString()
    });
    renderSessionHistory();
  } else {
    responseTextEl.textContent = res.error || 'Request failed';
  }
});

setModelOptions(providerPicker.value);
estimateCost();
refreshPricing();
renderSessionHistory();

setInterval(() => {
  refreshState();
}, 2000);

refreshState();