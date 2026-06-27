const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('fs/promises');
const path = require('path');

const appRoot = path.resolve(__dirname, '..');
const stateDir = path.join(appRoot, 'runtime_state');
const requestDir = path.join(appRoot, 'runtime_requests');
const workspaceDir = path.join(appRoot, 'job_workspaces');
const documentDir = path.join(appRoot, 'document_pool');
const statePath = path.join(stateDir, 'career-os-state.json');

async function ensureDirs() {
  await fs.mkdir(stateDir, { recursive: true });
  await fs.mkdir(requestDir, { recursive: true });
  await fs.mkdir(workspaceDir, { recursive: true });
  await fs.mkdir(documentDir, { recursive: true });
}

function slug(value) {
  return String(value || 'item')
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .toLowerCase();
}

function jobFolder(job) {
  return path.join(workspaceDir, `${job.id}-${slug(job.company)}-${slug(job.role)}`);
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function createWindow() {
  await ensureDirs();
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    title: 'Career OS AI Copilot',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await win.loadFile(path.join(appRoot, 'dashboard', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.handle('state:read', async () => readJson(statePath));
ipcMain.handle('state:write', async (_event, state) => {
  await writeJson(statePath, state);
  await writeJson(path.join(requestDir, 'career-os-requests.json'), state.requests || []);
  return { ok: true };
});
ipcMain.handle('job:ensure-folder', async (_event, job) => {
  const folder = jobFolder(job);
  await fs.mkdir(path.join(folder, 'resume'), { recursive: true });
  await fs.mkdir(path.join(folder, 'cover_letter'), { recursive: true });
  await fs.writeFile(
    path.join(folder, 'README.md'),
    `# ${job.company} - ${job.role}\n\nJob ID: ${job.id}\nSource: ${job.source}\n`,
    { flag: 'a' },
  );
  return { ok: true, folder };
});
ipcMain.handle('path:open', async (_event, targetPath) => {
  const result = await shell.openPath(targetPath || appRoot);
  return { ok: !result, message: result };
});
ipcMain.handle('url:open', async (_event, url) => {
  await shell.openExternal(url);
  return { ok: true };
});
