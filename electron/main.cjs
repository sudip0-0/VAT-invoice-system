const path = require("node:path");
const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { auth, backup, initializeDatabase, query } = require("./db/index.cjs");

function createWindow() {
  const devServerUrl = process.env.ELECTRON_RENDERER_URL || "http://127.0.0.1:8080";
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  } else {
    console.log(`[electron] Loading renderer from ${devServerUrl}`);
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

function registerIpcHandlers() {
  ipcMain.handle("desktop:query", async (_event, request) => query(request));
  ipcMain.handle("desktop:auth:get-session", async () => auth.getSession());
  ipcMain.handle("desktop:auth:sign-up", async (_event, payload) => auth.signUp(payload));
  ipcMain.handle("desktop:auth:sign-in", async (_event, payload) => auth.signIn(payload));
  ipcMain.handle("desktop:auth:sign-out", async () => auth.signOut());
  ipcMain.handle("desktop:auth:update-user", async (_event, payload) => auth.updateUser(payload));
  ipcMain.handle("desktop:auth:reset-password", async (_event, payload) => auth.resetPasswordForEmail(payload));
  ipcMain.handle("desktop:system:open-external", async (_event, url) => {
    await shell.openExternal(url);
    return { ok: true };
  });
  ipcMain.handle("desktop:system:create-backup", async () => {
    const result = await dialog.showSaveDialog({
      title: "Create Backup",
      defaultPath: "vyapar-nepal-backup.sqlite",
      filters: [{ name: "SQLite Database", extensions: ["sqlite"] }],
    });

    if (result.canceled || !result.filePath) {
      return { data: { canceled: true }, error: null };
    }

    const response = backup.createBackup(result.filePath);
    return response.error
      ? response
      : { data: { canceled: false, path: result.filePath }, error: null };
  });
  ipcMain.handle("desktop:system:restore-backup", async () => {
    const result = await dialog.showOpenDialog({
      title: "Restore Backup",
      properties: ["openFile"],
      filters: [{ name: "SQLite Database", extensions: ["sqlite"] }],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { data: { canceled: true }, error: null };
    }

    const response = backup.restoreBackup(result.filePaths[0]);
    return response.error
      ? response
      : { data: { canceled: false, path: result.filePaths[0] }, error: null };
  });
}

app.whenReady().then(async () => {
  await initializeDatabase(app);
  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
