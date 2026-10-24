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
  await page.getByLabel("Document title").fill("Windows desktop commissioning");
  await page.locator(".tiptap").click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" Verify native desktop persistence.");
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, pdfPath);
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Your PDF is ready" })
    .waitFor({ timeout: 20000 });
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
  console.log("PASS: document persistence across desktop app restarts");
  console.log("PDF validation artifact:", pdfPath);
} finally {
  if (app) await app.close();
}
