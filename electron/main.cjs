const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  ipcMain,
  shell,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");

let mainWindow;
const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 1000,
    minWidth: 760,
    minHeight: 600,
    title: "SHIFTnotes",
    backgroundColor: "#f5f5f1",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url !== mainWindow.webContents.getURL()) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });
  mainWindow.webContents.session.on("will-download", (_event, item) => {
    item.setSaveDialogOptions({
      title: "Save SHIFTnotes export",
      defaultPath: path.join(app.getPath("documents"), item.getFilename()),
    });
  });
  mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

ipcMain.handle("export-pdf", async (event, options) => {
  if (event.sender !== mainWindow?.webContents)
    throw new Error("Unknown window");
  const title = String(options?.title || "Untitled document").slice(0, 200);
  const name = String(options?.brand?.name || "SHIFTnotes").slice(0, 40);
  const primary = /^#[0-9a-f]{6}$/i.test(options?.brand?.primary)
    ? options.brand.primary
    : "#173f3d";
  const accent = /^#[0-9a-f]{6}$/i.test(options?.brand?.accent)
    ? options.brand.accent
    : "#d6a566";
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: "Export document as PDF",
    defaultPath: path.join(
      app.getPath("documents"),
      `${title.replace(/[<>:"/\\|?*\x00-\x1f]/g, "").trim() || "Document"}.pdf`,
    ),
    filters: [{ name: "PDF document", extensions: ["pdf"] }],
  });
  if (canceled || !filePath) return { canceled: true };
  const buffer = await mainWindow.webContents.printToPDF({
    scale: 0.9,
    generateTaggedPDF: true,
    generateDocumentOutline: true,
    printBackground: true,
    pageSize: "A4",
    preferCSSPageSize: false,
    margins: { top: 0.6, bottom: 0.65, left: 0.35, right: 0.35 },
    displayHeaderFooter: true,
    headerTemplate: `<div style="font-family:Arial;font-size:9px;width:100%;margin:0 35px;padding:9px 12px;background:${primary};color:white;display:flex;justify-content:space-between;-webkit-print-color-adjust:exact"><span>${escapeHTML(name)}</span><span>TECHNICAL DOCUMENTATION</span></div>`,
    footerTemplate: `<div style="font-family:Arial;font-size:8px;width:100%;margin:0 35px;padding-top:8px;border-top:2px solid ${accent};color:#7c8585;display:flex;justify-content:space-between"><span>${escapeHTML(title)}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
  });
  await fs.writeFile(filePath, buffer);
  return { canceled: false };
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "File",
        submenu: [
          {
            label: "Print…",
            accelerator: "CmdOrCtrl+P",
            click: () =>
              mainWindow?.webContents.print({ printBackground: true }),
          },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      { role: "editMenu" },
      { role: "viewMenu" },
      {
        label: "Help",
        submenu: [
          {
            label: "About SHIFTnotes",
            click: () =>
              dialog.showMessageBox(mainWindow, {
                title: "SHIFTnotes",
                message: "SHIFTnotes",
                detail:
                  "A focused technical writing workspace.\nDocuments are stored locally on this computer.\nVersion " +
                  app.getVersion(),
              }),
          },
        ],
      },
    ]),
  );
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
