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
const os = require("node:os");

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
    backgroundColor: "#101318",
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
    : "#171a20";
  const accent = /^#[0-9a-f]{6}$/i.test(options?.brand?.accent)
    ? options.brand.accent
    : "#c92f38";
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: "Export document as PDF",
    defaultPath: path.join(
      app.getPath("documents"),
      `${title.replace(/[<>:"/\\|?*\x00-\x1f]/g, "").trim() || "Document"}.pdf`,
    ),
    filters: [{ name: "PDF document", extensions: ["pdf"] }],
  });
  if (canceled || !filePath) return { canceled: true };
  const previousTheme = await mainWindow.webContents.executeJavaScript(
    "document.documentElement.dataset.printTheme",
  );
  await mainWindow.webContents.executeJavaScript(
    'document.documentElement.dataset.printTheme = "dark"',
  );
  let buffer;
  try {
    buffer = await mainWindow.webContents.printToPDF({
      scale: 0.9,
      generateTaggedPDF: true,
      generateDocumentOutline: true,
      printBackground: true,
      pageSize: "A4",
      preferCSSPageSize: false,
      margins: { top: 0.6, bottom: 0.65, left: 0.35, right: 0.35 },
      displayHeaderFooter: true,
      headerTemplate: `<div style="font-family:Arial;font-size:9px;width:100%;margin:0 35px;padding:9px 12px;background:${primary};color:white;display:flex;justify-content:space-between;-webkit-print-color-adjust:exact"><span>${escapeHTML(name)}</span><span>TECHNICAL DOCUMENTATION</span></div>`,
      footerTemplate: `<div style="font-family:Arial;font-size:8px;width:100%;margin:0 35px;padding-top:8px;border-top:2px solid ${accent};color:#b6bdca;-webkit-print-color-adjust:exact;display:flex;justify-content:space-between"><span>${escapeHTML(title)}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    });
  } finally {
    await mainWindow.webContents.executeJavaScript(
      `document.documentElement.dataset.printTheme = ${JSON.stringify(previousTheme || "white")}`,
    );
  }
  await fs.writeFile(filePath, buffer);
  return { canceled: false };
});

// Keep local file access behind explicit user actions and a document-only allowlist.
const referenceExtensions = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ods",
  ".odt",
  ".ppt",
  ".pptx",
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".xml",
  ".log",
  ".ini",
  ".cfg",
  ".yaml",
  ".yml",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
]);
function trustedReferenceSender(event) {
  if (event.sender !== mainWindow?.webContents)
    throw new Error("Unknown window");
}
ipcMain.handle("choose-reference-file", async (event) => {
  trustedReferenceSender(event);
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Link a manual, handover, or spreadsheet",
    properties: ["openFile"],
  });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle("open-reference-path", async (event, filePath) => {
  trustedReferenceSender(event);
  if (
    typeof filePath !== "string" ||
    filePath.includes("\0") ||
    !path.isAbsolute(filePath)
  )
    return "Enter an absolute path to a file on this computer.";
  if (!referenceExtensions.has(path.extname(filePath).toLowerCase()))
    return "This file type cannot be opened from SHIFTnotes. Open it manually from your file manager.";
  try {
    if (!(await fs.stat(filePath)).isFile())
      return "This path does not point to a file.";
    return await shell.openPath(filePath);
  } catch {
    return "The linked file could not be found. It may have been moved or deleted.";
  }
});
ipcMain.handle("open-stored-reference", async (event, file) => {
  trustedReferenceSender(event);
  if (
    !file ||
    typeof file.name !== "string" ||
    typeof file.base64 !== "string" ||
    file.base64.length > 27962028 ||
    file.base64.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(file.base64)
  )
    return "Invalid reference file.";
  const name = path.basename(file.name).replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
  if (!referenceExtensions.has(path.extname(name).toLowerCase()))
    return "Save a copy of this file to open it from your file manager.";
  try {
    const directory = await fs.mkdtemp(
      path.join(os.tmpdir(), "shiftnotes-reference-"),
    );
    const filePath = path.join(directory, name);
    await fs.writeFile(filePath, Buffer.from(file.base64, "base64"), {
      mode: 0o600,
    });
    return await shell.openPath(filePath);
  } catch {
    return "Could not open the stored file. Save a copy instead.";
  }
});

ipcMain.handle("print-document", async (event) => {
  if (event.sender !== mainWindow?.webContents)
    throw new Error("Unknown window");
  return new Promise((resolve) =>
    mainWindow.webContents.print({ printBackground: true }, (success, reason) =>
      resolve({ success, reason }),
    ),
  );
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
            click: () => mainWindow?.webContents.send("print-requested"),
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
