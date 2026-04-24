const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopApi", {
  query: (request) => ipcRenderer.invoke("desktop:query", request),
  auth: {
    getSession: () => ipcRenderer.invoke("desktop:auth:get-session"),
    signUp: (payload) => ipcRenderer.invoke("desktop:auth:sign-up", payload),
    signIn: (payload) => ipcRenderer.invoke("desktop:auth:sign-in", payload),
    signOut: () => ipcRenderer.invoke("desktop:auth:sign-out"),
    updateUser: (payload) => ipcRenderer.invoke("desktop:auth:update-user", payload),
    resetPasswordForEmail: (payload) => ipcRenderer.invoke("desktop:auth:reset-password", payload),
  },
  system: {
    openExternal: (url) => ipcRenderer.invoke("desktop:system:open-external", url),
    createBackup: () => ipcRenderer.invoke("desktop:system:create-backup"),
    restoreBackup: () => ipcRenderer.invoke("desktop:system:restore-backup"),
  },
});
