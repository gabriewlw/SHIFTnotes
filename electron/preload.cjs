const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("shiftDesktop", {
  platform: process.platform,
  chooseReferenceFile: () => ipcRenderer.invoke("choose-reference-file"),
  openReferencePath: (filePath) =>
    ipcRenderer.invoke("open-reference-path", filePath),
  openStoredReference: (file) =>
    ipcRenderer.invoke("open-stored-reference", file),
  printDocument: () => ipcRenderer.invoke("print-document"),
  onPrintRequested: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("print-requested", listener);
    return () => ipcRenderer.removeListener("print-requested", listener);
  },
  exportPDF: (options) => ipcRenderer.invoke("export-pdf", options),
});
