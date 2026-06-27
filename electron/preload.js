const { contextBridge, ipcRenderer, webUtils } = require("electron");

function fileListToRecords(files) {
  return Array.from(files || []).map((file) => ({
    name: file.name,
    path: webUtils.getPathForFile(file),
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
  }));
}

contextBridge.exposeInMainWorld("careerOSNative", {
  isElectron: true,
  getInfo: () => ipcRenderer.invoke("app:info"),
  readState: () => ipcRenderer.invoke("state:read"),
  writeState: (state) => ipcRenderer.invoke("state:write", state),
  writeRequests: (requests) => ipcRenderer.invoke("request:write", requests),
  ensureJobFolder: (job) => ipcRenderer.invoke("job:ensure-folder", job),
  openJobFolder: (job) => ipcRenderer.invoke("job:open-folder", job),
  savePackageFiles: (job, kind, files) =>
    ipcRenderer.invoke("files:save-package", { job, kind, files: fileListToRecords(files) }),
  saveDocumentFiles: (files) => ipcRenderer.invoke("files:save-documents", { files: fileListToRecords(files) }),
  openPath: (targetPath) => ipcRenderer.invoke("path:open", targetPath),
  openUrl: (url) => ipcRenderer.invoke("url:open", url),
});
