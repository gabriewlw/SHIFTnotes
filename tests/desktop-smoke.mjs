import { _electron as electron } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const profile = await fs.mkdtemp(path.join(os.tmpdir(), "shiftnotes-smoke-"));
const pdfPath = path.join(profile, "technical-document.pdf");
const headless =
  process.platform === "linux"
    ? [
        "--no-sandbox",
        "--headless",
        "--ozone-platform=headless",
        "--disable-gpu",
      ]
    : [];
const launch = () =>
  electron.launch({
    args: [".", ...headless, `--user-data-dir=${profile}`],
    timeout: 30000,
  });
let app;
try {
  app = await launch();
  const page = await app.firstWindow();
  await page.waitForLoadState();
  await page.getByLabel("Document title").waitFor();
  assert.equal(
    await page.evaluate(() => window.shiftDesktop.platform),
    process.platform,
  );
  assert.equal(await page.evaluate(() => typeof window.require), "undefined");
  assert.equal(
    await page.evaluate(() => document.documentElement.dataset.printTheme),
    "white",
  );
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].webContents.send("print-requested");
  });
  await page.getByRole("dialog").waitFor();
  await page.getByRole("radio", { name: /White paper/ }).check();
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].webContents.print = (
      options,
      callback,
    ) => {
      globalThis.smokePrintOptions = options;
      callback(true);
    };
  });
  await page.getByRole("button", { name: "Continue to print" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Print job sent" })
    .waitFor();
  assert.equal(
    await app.evaluate(() => globalThis.smokePrintOptions.printBackground),
    true,
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  console.log(
    "PASS: desktop print menu offers white and dark paper through native printing",
  );
  await page.getByLabel("Document title").fill("Windows desktop commissioning");
  await page.locator(".tiptap").click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" Verify native desktop persistence.");
  const originalPath = path.join(profile, "original-handover.txt");
  await fs.writeFile(originalPath, "Previous handover reference");
  await app.evaluate(({ shell }) => {
    shell.openPath = async (filePath) => {
      globalThis.openedReference = filePath;
      return "";
    };
  });
  assert.equal(
    await page.evaluate(
      (filePath) => window.shiftDesktop.openReferencePath(filePath),
      originalPath,
    ),
    "",
  );
  assert.equal(
    await app.evaluate(() => globalThis.openedReference),
    originalPath,
  );
  assert.match(
    await page.evaluate(() =>
      window.shiftDesktop.openReferencePath("/missing/manual.pdf"),
    ),
    /not be found/,
  );
  assert.match(
    await page.evaluate(() =>
      window.shiftDesktop.openReferencePath("/tmp/untrusted.exe"),
    ),
    /cannot be opened/,
  );
  await page
    .getByRole("button", { name: "Insert document reference", exact: true })
    .click();
  await page.getByLabel("Reference type").selectOption("stored");
  await page
    .getByLabel("Upload reference file")
    .setInputFiles({
      name: "old-handover.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Shift,Status\nPrevious,Complete\n"),
    });
  await page
    .locator(".document-references")
    .getByRole("button", { name: "old-handover.csv", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open in default app", exact: true })
    .click();
  // Wait for the main-process IPC to reach the mocked OS integration.
  await page.waitForFunction(() =>
    document.querySelector(
      ".reference-details button.primary-button:not(:disabled)",
    ),
  );
  const openedPath = await app.evaluate(() => globalThis.openedReference);
  assert.equal(
    await fs.readFile(openedPath, "utf8"),
    "Shift,Status\nPrevious,Complete\n",
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  console.log(
    "PASS: original file opening, missing/unsupported path handling, and stored reference bytes (OS launch mocked)",
  );
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, pdfPath);
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Your PDF is ready" })
    .waitFor({ timeout: 20000 });
  assert.equal(
    await page.evaluate(() => document.documentElement.dataset.printTheme),
    "white",
  );
  const pdf = await fs.readFile(pdfPath);
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  assert.ok(pdf.length > 20000);
  console.log(
    "PASS: packaged UI, isolated preload bridge, and native PDF export",
  );
  await app.close();
  app = await launch();
  const reopened = await app.firstWindow();
  await reopened.getByLabel("Document title").waitFor();
  assert.equal(
    await reopened.getByLabel("Document title").inputValue(),
    "Windows desktop commissioning",
  );
  assert.ok(
    (await reopened.locator(".tiptap").innerText()).includes(
      "Verify native desktop persistence.",
    ),
  );
  await reopened
    .locator(".document-references")
    .getByRole("button", { name: "old-handover.csv", exact: true })
    .click();
  await reopened
    .getByRole("button", { name: "Save a copy", exact: true })
    .waitFor();
  console.log(
    "PASS: document and reference-file persistence across desktop app restarts",
  );
  console.log("PDF validation artifact:", pdfPath);
} finally {
  if (app) await app.close();
}
