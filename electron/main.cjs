const path = require("node:path");
const { app, BrowserWindow, dialog, ipcMain, shell, session } = require("electron");
const { auth, backup, documents, initializeDatabase, query, stock } = require("./db/index.cjs");
const { isAllowedExternalUrl } = require("./security/open-external.cjs");
const { logger } = require("./logger.cjs");

function applyContentSecurityPolicy() {
  const isDev = !app.isPackaged;
  const csp = isDev
    ? "default-src 'self'; script-src 'self' 'unsafe-inline' http://127.0.0.1:* http://localhost:*; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:*; font-src 'self' data:;"
    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none';";

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders, "Content-Security-Policy": [csp] };
    callback({ responseHeaders: headers });
  });
}

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
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  } else {
    logger.info("loading_renderer", { url: devServerUrl });
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

function registerIpcHandlers() {
  ipcMain.handle("desktop:query", async (_event, request) => query(request));
  ipcMain.handle("desktop:documents:create-and-issue", async (_event, payload) =>
    documents.createAndIssue(payload)
  );
  ipcMain.handle("desktop:stock:adjust", async (_event, payload) => stock.adjust(payload));
  ipcMain.handle("desktop:auth:get-session", async () => auth.getSession());
  ipcMain.handle("desktop:auth:sign-up", async (_event, payload) => auth.signUp(payload));
  ipcMain.handle("desktop:auth:sign-in", async (_event, payload) => auth.signIn(payload));
  ipcMain.handle("desktop:auth:sign-out", async () => auth.signOut());
  ipcMain.handle("desktop:auth:update-user", async (_event, payload) => auth.updateUser(payload));
  ipcMain.handle("desktop:auth:reset-password", async (_event, payload) =>
    auth.resetPasswordForEmail(payload)
  );
  ipcMain.handle("desktop:auth:create-member", async (_event, payload) => auth.createMember(payload));
  ipcMain.handle("desktop:auth:list-members", async (_event, payload) => auth.listMembers(payload));
  ipcMain.handle("desktop:auth:remove-member", async (_event, payload) => auth.removeMember(payload));
  ipcMain.handle("desktop:system:open-external", async (_event, url) => {
    if (!isAllowedExternalUrl(url)) {
      logger.warn("open_external_denied", { url });
      return { ok: false, error: "Only http(s) URLs are allowed" };
    }
    await shell.openExternal(url);
    return { ok: true };
  });
  ipcMain.handle("desktop:system:open-logs", async () => {
    const dir = logger.getLogDir();
    if (!dir) {
      return { ok: false, error: "Logs are not initialized" };
    }
    await shell.openPath(dir);
    return { ok: true, path: dir };
  });
  ipcMain.handle("desktop:system:create-backup", async (_event, payload = {}) => {
    const encrypted = payload?.unencrypted !== true;
    const result = await dialog.showSaveDialog({
      title: encrypted ? "Create Encrypted Backup" : "Create Unencrypted Backup",
      defaultPath: encrypted ? "vyapar-nepal-backup.vyapar-bak" : "vyapar-nepal-backup.sqlite",
      filters: encrypted
        ? [{ name: "Encrypted Vyapar Backup", extensions: ["vyapar-bak"] }]
        : [{ name: "SQLite Database", extensions: ["sqlite"] }],
    });

    if (result.canceled || !result.filePath) {
      return { data: { canceled: true }, error: null };
    }

    const response = backup.createBackup(result.filePath, {
      passphrase: payload?.passphrase,
      unencrypted: payload?.unencrypted === true,
    });
    return response.error
      ? response
      : {
          data: {
            canceled: false,
            path: result.filePath,
            checksum: response.data?.checksum,
            encrypted: response.data?.encrypted,
          },
          error: null,
        };
  });
  ipcMain.handle("desktop:system:restore-backup", async (_event, payload = {}) => {
    const result = await dialog.showOpenDialog({
      title: "Restore Backup",
      properties: ["openFile"],
      filters: [
        { name: "Vyapar Backups", extensions: ["vyapar-bak", "sqlite"] },
        { name: "Encrypted Backup", extensions: ["vyapar-bak"] },
        { name: "SQLite Database", extensions: ["sqlite"] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { data: { canceled: true }, error: null };
    }

    const response = backup.restoreBackup(result.filePaths[0], {
      passphrase: payload?.passphrase,
    });
    return response.error
      ? response
      : {
          data: {
            canceled: false,
            path: result.filePaths[0],
            safetyPath: response.data?.safetyPath,
          },
          error: null,
        };
  });
}

app.whenReady().then(async () => {
  applyContentSecurityPolicy();
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
