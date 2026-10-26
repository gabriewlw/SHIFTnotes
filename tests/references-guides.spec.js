import { test, expect } from "@playwright/test";

const openPicker = async (page, type) => {
  await page
    .getByRole("button", { name: "Insert document reference", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Reference type" })
    .selectOption(type);
};
const backupWorkspace = async (page) => {
  await page
    .getByRole("button", { name: "Document menu", exact: true })
    .click();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Back up workspace", exact: true })
    .click();
  return downloaded;
};
const downloadBytes = async (download) => {
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
};

test("links selected text to older handovers and follows it after restart", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "New document Ctrl N", exact: true })
    .click();
  await page.locator(".tiptap").click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("See previous handover");
  await page.keyboard.press("Shift+Home");
  await openPicker(page, "document");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Engineering handover/ })
    .click();
  await expect(page.locator(".reference-link")).toHaveText(
    "See previous handover",
  );
  await page.reload();
  await page.locator(".reference-link").click();
  await page
    .getByRole("button", { name: "Open document", exact: true })
    .click();
  await expect(page.getByLabel("Document title")).toHaveValue(
    "Engineering handover",
  );
});

test("stored spreadsheets survive reload and backup restoration with original bytes and remapped document links", async ({
  page,
  browser,
}) => {
  const bytes = Buffer.from("Device,IP\nEncoder,192.168.10.21\n");
  await page.goto("/");
  await page
    .getByRole("button", { name: "New document Ctrl N", exact: true })
    .click();
  await page.getByLabel("Document title").fill("Current shift");
  await openPicker(page, "document");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Engineering handover/ })
    .click();
  await page.locator(".tiptap").click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await openPicker(page, "stored");
  await page.getByLabel("Upload reference file").setInputFiles({
    name: "commissioning.csv",
    mimeType: "text/csv",
    buffer: bytes,
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await page
    .locator(".reference-link")
    .filter({ hasText: "commissioning.csv" })
    .click();
  const copy = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save a copy", exact: true }).click();
  expect(await downloadBytes(await copy)).toEqual(bytes);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  const backup = await backupWorkspace(page);
  const data = JSON.parse((await downloadBytes(backup)).toString());
  expect(data.version).toBe(2);
  expect(Buffer.from(data.referenceFiles[0].base64, "base64")).toEqual(bytes);
  const original = data.documents.find((doc) => doc.title === "Current shift");
  expect(original.references).toHaveLength(2);

  const context = await browser.newContext();
  try {
    const restored = await context.newPage();
    await restored.goto("http://127.0.0.1:5173/");
    await restored
      .getByRole("button", { name: "Document menu", exact: true })
      .click();
    await restored
      .getByRole("button", { name: "Import backup", exact: true })
      .click();
    await restored
      .locator('input[type=file][accept="application/json"]')
      .setInputFiles(await backup.path());
    await expect(restored.locator(".document-card")).toHaveCount(7);
    const saved = await restored.evaluate(() =>
      JSON.parse(localStorage.getItem("shiftnotes.documents.v1")),
    );
    const imported = saved[0];
    expect(imported.id).not.toBe(original.id);
    const target = saved.find(
      (doc) =>
        doc.id ===
        imported.references.find((ref) => ref.kind === "document").documentId,
    );
    expect(target.title).toBe("Engineering handover");
    expect(target.id).not.toBe(
      data.documents.find((doc) => doc.title === "Engineering handover").id,
    );
    await restored
      .locator(".reference-link")
      .filter({ hasText: "commissioning.csv" })
      .click();
    const restoredCopy = restored.waitForEvent("download");
    await restored
      .getByRole("button", { name: "Save a copy", exact: true })
      .click();
    expect(await downloadBytes(await restoredCopy)).toEqual(bytes);
  } finally {
    await context.close();
  }
});

test("local path references persist and can be removed without deleting the original file", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "New document Ctrl N", exact: true })
    .click();
  await openPicker(page, "path");
  await page
    .getByLabel("Reference file path")
    .fill("C:\\Manuals\\Switch SOP.pdf");
  await page
    .getByRole("button", { name: "Insert file reference", exact: true })
    .click();
  await page.reload();
  await page.locator(".reference-link").click();
  await expect(page.locator(".reference-path")).toHaveText(
    "C:\\Manuals\\Switch SOP.pdf",
  );
  await expect(
    page.getByRole("button", { name: "Open linked file" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Remove reference link", exact: true })
    .click();
  await expect(page.locator(".reference-link")).toHaveCount(0);
  await expect(page.locator(".tiptap")).toContainText("Switch SOP.pdf");
  await page.reload();
  await expect(page.locator(".document-references")).toHaveCount(0);
});

test("guide templates support numbered text, image-only, and combined steps across persistence and printing", async ({
  page,
}) => {
  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Document templates", exact: true })
    .click();
  await page.getByRole("button", { name: /Step-by-step guide/ }).click();
  await expect(page.getByLabel("Document title")).toHaveValue("Untitled guide");
  await expect(page.locator(".guide-step")).toHaveCount(1);
  for (const [title, text, illustration] of [
    ["Check access", "Connect to 10.20.0.1 and verify access.", false],
    ["Identify the port", "", true],
    ["Verify the result", "Match the screenshot and record the result.", true],
  ]) {
    await page
      .getByRole("button", { name: "Insert tutorial step", exact: true })
      .click();
    await page.getByLabel("Step title", { exact: true }).fill(title);
    if (text) await page.getByLabel("Step instructions").fill(text);
    if (illustration) {
      await page.getByLabel("Step image", { exact: true }).setInputFiles({
        name: "screen.png",
        mimeType: "image/png",
        buffer: image,
      });
      await page.getByLabel("Step image caption").fill(`${title} screenshot`);
    }
    await page.getByRole("button", { name: "Add step", exact: true }).click();
  }
  await expect(page.locator(".guide-step")).toHaveCount(4);
  await expect(page.locator(".guide-image")).toHaveCount(2);
  await page.reload();
  await expect(page.locator(".guide-step")).toHaveCount(4);
  await expect(page.locator(".guide-image figcaption").last()).toHaveText(
    "Verify the result screenshot",
  );
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".guide-step").first()).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await expect(page.locator(".guide-image img").last()).toBeVisible();
  await page.emulateMedia({ media: "screen" });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  expect((await downloadBytes(await download)).subarray(0, 4).toString()).toBe(
    "%PDF",
  );
});

test("rejects oversized reference files and preserves existing documents on malformed backup", async ({
  page,
}) => {
  await page.goto("/");
  await openPicker(page, "stored");
  await page
    .getByLabel("Upload reference file")
    .setInputFiles({
      name: "oversized.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.alloc(20 * 1024 * 1024 + 1),
    });
  await expect(page.getByRole("alert")).toContainText("up to 20 MB");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  const documents = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("shiftnotes.documents.v1")),
  );
  const invalid = {
    version: 2,
    documents,
    referenceFiles: [
      { id: "bad", name: "broken.pdf", size: 100, base64: "!invalid!" },
    ],
  };
  await page
    .getByRole("button", { name: "Document menu", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Import backup", exact: true })
    .click();
  await page
    .locator('input[type=file][accept="application/json"]')
    .setInputFiles({
      name: "bad-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(invalid)),
    });
  await expect(page.getByRole("status")).toContainText(
    "Could not import backup",
  );
  await expect(page.locator(".document-card")).toHaveCount(3);
});
