const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('flowkeeper', {
  selectRepo: () => ipcRenderer.invoke('select-repo'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  createProject: (payload) => ipcRenderer.invoke('create-project', payload),
  openRepo: (repoPath) => ipcRenderer.invoke('open-repo', repoPath),
  getState: () => ipcRenderer.invoke('get-state'),
  generateContext: () => ipcRenderer.invoke('generate-context'),
  getContext: () => ipcRenderer.invoke('get-context'),
  startDevServer: (payload) => ipcRenderer.invoke('start-dev-server', payload),
  stopDevServer: () => ipcRenderer.invoke('stop-dev-server'),
  getPricing: () => ipcRenderer.invoke('get-pricing'),
  getDiff: () => ipcRenderer.invoke('get-diff'),
  runModel: (payload) => ipcRenderer.invoke('run-model', payload)
});
