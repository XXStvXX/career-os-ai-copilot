const { app, BrowserWindow, ipcMain, shell } = require("electron");
const fs = require("fs/promises");
const path = require("path");

const appRoot = path.resolve(__dirname, "..");
const dashboardPath = path.join(appRoot, "dashboard", "index.html");
const runtimeStateDir = path.join(appRoot, "runtime_state");
const runtimeRequestsDir = path.join(appRoot, "runtime_requests");
const jobWorkspacesDir = path.join(appRoot, "job_workspaces");
const documentPoolDir = path.join(appRoot, "document_pool");

function initialRouteHash() {
  const routeArg = process.argv.find((arg) => arg.startsWith("--route="));
  if (!routeArg) return "";
  return routeArg
    .replace(/^--route=/, "")
    .replace(/^#/, "")
    .replace(/[^a-zA-Z0-9/_-]/g, "");
}

function safeName(value) {
  return String(value || "item")
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
    .toLowerCase();
}

function jobFolderName(job) {
  return `${job.id}-${safeName(job.company)}-${safeName(job.role)}`;
}

async function ensureBaseDirs() {
  await fs.mkdir(runtimeStateDir, { recursive: true });
  await fs.mkdir(runtimeRequestsDir, { recursive: true });
  await fs.mkdir(jobWorkspacesDir, { recursive: true });
  await fs.mkdir(documentPoolDir, { recursive: true });
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function createWindow() {
  await ensureBaseDirs();
  const win = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 1040,
    minHeight: 720,
    title: "Career OS AI Copilot",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.webContents.on("console-message", (details) => {
    console.log(`[renderer:${details.level}] ${details.message} (${details.sourceId}:${details.lineNumber})`);
  });
  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[renderer:load-failed] ${errorCode} ${errorDescription} ${validatedURL}`);
  });

  await win.loadFile(dashboardPath, { hash: initialRouteHash() });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.handle("app:info", async () => ({
  appRoot,
  runtimeStateDir,
  runtimeRequestsDir,
  jobWorkspacesDir,
  documentPoolDir,
}));

ipcMain.handle("state:read", async () => readJsonIfExists(path.join(runtimeStateDir, "career-os-state.json")));

ipcMain.handle("state:write", async (_event, state) => {
  await writeJson(path.join(runtimeStateDir, "career-os-state.json"), state);
  await writeJson(path.join(runtimeRequestsDir, "career-os-requests.json"), state.requests || []);
  return { ok: true };
});

ipcMain.handle("request:write", async (_event, requests) => {
  await writeJson(path.join(runtimeRequestsDir, "career-os-requests.json"), requests || []);
  return { ok: true };
});

ipcMain.handle("job:ensure-folder", async (_event, job) => {
  const { folderName, folderPath } = getJobFolder(job);
  await fs.mkdir(path.join(folderPath, "resume"), { recursive: true });
  await fs.mkdir(path.join(folderPath, "cover_letter"), { recursive: true });
  const readmePath = path.join(folderPath, "README.md");
  let existed = true;
  try {
    await fs.access(readmePath);
  } catch {
    existed = false;
    await fs.writeFile(
      readmePath,
      `# ${job.company} - ${job.role}\n\nJob ID: ${job.id}\nTerm: ${job.term}\nSource: ${job.source}\nCreated by Career OS: ${new Date().toISOString()}\n`,
      "utf8",
    );
  }
  return { ok: true, existed, folderName, folderPath };
});

ipcMain.handle("job:open-folder", async (_event, job) => {
  const { folderName, folderPath } = getJobFolder(job);
  await fs.mkdir(path.join(folderPath, "resume"), { recursive: true });
  await fs.mkdir(path.join(folderPath, "cover_letter"), { recursive: true });
  const result = await shell.openPath(folderPath);
  return { ok: !result, message: result, folderName, folderPath };
});

ipcMain.handle("files:save-package", async (_event, { job, kind, files }) => {
  const { folderName } = getJobFolder(job);
  const targetDir = path.join(jobWorkspacesDir, folderName, kind);
  await fs.mkdir(targetDir, { recursive: true });
  const saved = [];
  for (const file of files || []) {
    if (!file.path) continue;
    const targetPath = path.join(targetDir, path.basename(file.name || file.path));
    if (path.resolve(file.path) !== path.resolve(targetPath)) {
      await fs.copyFile(file.path, targetPath);
    }
    saved.push({ name: path.basename(targetPath), path: targetPath });
  }
  return { ok: true, saved, folderName };
});

ipcMain.handle("files:save-documents", async (_event, { files }) => {
  const saved = [];
  for (const file of files || []) {
    if (!file.path) continue;
    const category = documentCategory(file.name || file.path);
    const targetDir = path.join(documentPoolDir, category);
    await fs.mkdir(targetDir, { recursive: true });
    const targetPath = path.join(targetDir, path.basename(file.name || file.path));
    if (path.resolve(file.path) !== path.resolve(targetPath)) {
      await fs.copyFile(file.path, targetPath);
    }
    saved.push({ name: path.basename(targetPath), path: targetPath, category });
  }
  return { ok: true, saved };
});

ipcMain.handle("path:open", async (_event, targetPath) => {
  const resolved = resolveAppPath(targetPath);
  const result = await shell.openPath(resolved);
  return { ok: !result, message: result };
});

ipcMain.handle("url:open", async (_event, url) => {
  await shell.openExternal(url);
  return { ok: true };
});

function documentCategory(filename) {
  const lower = String(filename || "").toLowerCase();
  if (/resume|cv|简历/.test(lower)) return "resume_templates";
  if (/transcript|成绩|grade/.test(lower)) return "transcripts";
  if (/cover|letter|求职信/.test(lower)) return "cover_letters";
  return "other_documents";
}

function resolveAppPath(targetPath) {
  if (!targetPath || targetPath === ".") return appRoot;
  if (path.isAbsolute(targetPath)) return targetPath;
  if (targetPath.startsWith("../") || targetPath.startsWith("./")) {
    return path.resolve(appRoot, "dashboard", targetPath);
  }
  return path.resolve(appRoot, targetPath);
}

function getJobFolder(job) {
  const folderName = jobFolderName(job);
  return {
    folderName,
    folderPath: path.join(jobWorkspacesDir, folderName),
  };
}
