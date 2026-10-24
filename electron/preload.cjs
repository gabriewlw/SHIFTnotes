const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("shiftDesktop", {
  platform: process.platform,
  exportPDF: (options) => ipcRenderer.invoke("export-pdf", options),
});
