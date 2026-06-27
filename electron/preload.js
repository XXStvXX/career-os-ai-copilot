const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('careerOSNative', {
  readState: () => ipcRenderer.invoke('state:read'),
  writeState: (state) => ipcRenderer.invoke('state:write', state),
  ensureJobFolder: (job) => ipcRenderer.invoke('job:ensure-folder', job),
  openPath: (targetPath) => ipcRenderer.invoke('path:open', targetPath),
  openUrl: (url) => ipcRenderer.invoke('url:open', url),
});
