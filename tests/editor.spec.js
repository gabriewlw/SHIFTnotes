import { test, expect } from "@playwright/test";
import path from "node:path";
test("font selection, brand presets, and editable tables persist", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".tiptap").click();
  await page.keyboard.press("Control+A");
  await page
    .getByLabel("Font family", { exact: true })
    .selectOption("Space Grotesk");
  await page.getByLabel("Font size", { exact: true }).selectOption("14pt");
  await expect(
    page.locator('.tiptap span[style*="Space Grotesk"]').first(),
  ).toBeVisible();
  await page.locator(".tiptap").click();
  await page.keyboard.press("Control+End");
  await page.getByRole("button", { name: "Insert table", exact: true }).click();
  await page.getByLabel("Table rows", { exact: true }).fill("3");
  await page.getByLabel("Table columns", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Create table", exact: true }).click();
  await expect(page.locator(".tiptap table tr")).toHaveCount(3);
  await page.locator(".tiptap table th").first().click();
  await page.keyboard.type("Device");
  await page.getByLabel("Add row below", { exact: true }).click();
  await page.getByLabel("Add column after", { exact: true }).click();
  await expect(page.locator(".tiptap table tr")).toHaveCount(4);
  await expect(
    page.locator(".tiptap table tr").first().locator("th,td"),
  ).toHaveCount(4);
  await page
    .getByRole("button", { name: "Brand & export settings", exact: true })
    .click();
  await page
    .getByLabel("Brand preset", { exact: true })
    .selectOption("AVTrack");
  await expect(
    page.getByLabel("Default heading font", { exact: true }),
  ).toHaveValue("Space Grotesk");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.reload();
  await expect(page.locator(".tiptap table")).toContainText("Device");
  await expect(page.locator(".app")).toHaveCSS("--brand-accent", "#c92f38");
});
test("imports AVTrack channels, configuration code, and original attachments", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Import from AVTrack", exact: false })
    .click();
  const dialog = page.getByRole("dialog");
  await page
    .getByLabel("AVTrack import file", { exact: true })
    .setInputFiles(path.resolve("tests/fixtures/avtrack-schema-2.json"));
  await expect(dialog).toContainText("SHA-256 checksum verified");
  await dialog.getByRole("button", { name: /IPTV channel list/ }).click();
  await dialog
    .getByRole("button", { name: "Insert table", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Insert profile.json as code", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Attach profile.json", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator(".tiptap table")).toContainText("239.1.2.3");
  await expect(page.locator(".tiptap pre")).toContainText([
    "device",
    "profile",
  ]);
  await expect(page.locator(".attachment-node")).toContainText("profile.json");
  await page.reload();
  await expect(page.locator(".attachment-node")).toContainText("profile.json");
  const promise = page.waitForEvent("download");
  await page.locator(".attachment-node a").click();
  const file = await promise;
  expect(file.suggestedFilename()).toBe("profile.json");
  const stream = await file.createReadStream();
  let text = "";
  for await (const chunk of stream) text += chunk;
  expect(JSON.parse(text).profile).toBe("historical-test");
});
test("edits persist, documents stay isolated, and search finds content", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("Document title")).toHaveValue(
    "Studio network setup",
  );
  await page.getByLabel("Document title").fill("Studio A commissioning");
  await page.locator(".tiptap").click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" Verified endpoint 172.16.0.42.");
  await expect(page.locator(".ip-list")).toContainText("172.16.0.42");
  await page
    .getByRole("button", { name: "New document", exact: false })
    .first()
    .click();
  await page.getByLabel("Document title").fill("Fresh document");
  await expect(page.locator(".tiptap")).not.toContainText("Verified endpoint");
  await page.getByLabel("Search documents").fill("commissioning");
  await expect(page.locator(".document-card")).toHaveCount(1);
  await page.locator(".document-card").click();
  await expect(page.locator(".tiptap")).toContainText("172.16.0.42");
  await page.reload();
  await expect(page.getByLabel("Document title")).toHaveValue(
    "Studio A commissioning",
  );
  await expect(page.locator(".tiptap")).toContainText("172.16.0.42");
});
test("inserts code and generates an editable summary included in the document", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Insert code block", { exact: true }).click();
  await page.getByLabel("Code language", { exact: true }).selectOption("bash");
  await page.getByLabel("Code snippet", { exact: true }).fill("ping 10.20.0.1");
  await page.getByRole("button", { name: "Insert code", exact: true }).click();
  await expect(page.locator("pre code.language-bash")).toContainText(
    "ping 10.20.0.1",
  );
  await page
    .getByRole("button", { name: "Create summary", exact: true })
    .click();
  await expect(
    page.getByLabel("Document summary", { exact: true }),
  ).not.toHaveValue("");
  await page
    .getByLabel("Document summary", { exact: true })
    .fill("Verify the studio control network before going on air.");
  await page
    .getByRole("button", { name: "Add to document", exact: true })
    .click();
  await expect(page.locator(".saved-summary")).toContainText(
    "Verify the studio control network",
  );
});
test("moves, resizes, captions, and removes an image", async ({ page }) => {
  await page.goto("/");
  const image = page.locator(".floating-image").first();
  await image.scrollIntoViewIfNeeded();
  const before = await image.evaluate((el) => ({
    x: el.style.left,
    y: el.style.top,
  }));
  await image.click();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const after = await image.evaluate((el) => ({
    x: el.style.left,
    y: el.style.top,
  }));
  expect(parseInt(after.x)).toBe(parseInt(before.x) + 5);
  expect(parseInt(after.y)).toBe(parseInt(before.y) + 5);
  await page.getByLabel("Image width").fill("300");
  await expect(image).toHaveCSS("width", "300px");
  await page.getByLabel("Image caption").fill("Primary studio signal path");
  await expect(image).toContainText("Primary studio signal path");
  await page.reload();
  await expect(image).toHaveCSS("width", "300px");
  await image.scrollIntoViewIfNeeded();
  await image.click();
  await page.getByLabel("Remove image", { exact: true }).click();
  await expect(page.locator(".floating-image")).toHaveCount(0);
});
test("downloads a branded PDF and a restorable workspace backup", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Brand & export settings" }).click();
  await page
    .getByLabel("Brand name", { exact: true })
    .fill("BroadcastGab Engineering");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("Studio network setup.pdf");
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const data = Buffer.concat(chunks);
  expect(data.subarray(0, 4).toString()).toBe("%PDF");
  expect(data.length).toBeGreaterThan(30000);
  expect(data.toString("latin1")).toContain("BroadcastGab Engineering");
  await page.getByLabel("Document menu", { exact: true }).click();
  const backupPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Back up workspace", exact: true })
    .click();
  const backup = await backupPromise;
  const path = await backup.path();
  await page.getByLabel("Document menu", { exact: true }).click();
  await page
    .getByRole("button", { name: "Import backup", exact: true })
    .click();
  await page
    .locator('input[type=file][accept="application/json"]')
    .setInputFiles(path);
  await expect(page.locator(".document-card")).toHaveCount(6);
});
test("small screens support navigation without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByLabel("Document title")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.getByLabel("Toggle document list").click();
  await expect(page.locator(".sidebar")).toBeVisible();
  await page
    .locator(".document-card")
    .filter({ hasText: "Engineering handover" })
    .click();
  await expect(page.getByLabel("Document title")).toHaveValue(
    "Engineering handover",
  );
});
