import { test, expect } from "@playwright/test";

test("dark document exports and white or dark printing keep editing colors intact", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".paper")).toHaveCSS(
    "background-color",
    "rgb(23, 26, 32)",
  );
  await expect(page.locator(".document-title")).toHaveCSS(
    "font-family",
    '"Space Grotesk", sans-serif',
  );
  await page.keyboard.press("Control+p");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("radio", { name: /White paper/ })).toBeChecked();
  await page.evaluate(() => {
    window.print = () => {
      window.printedTheme = document.documentElement.dataset.printTheme;
    };
  });
  await page.getByRole("button", { name: "Continue to print" }).click();
  expect(await page.evaluate(() => window.printedTheme)).toBe("white");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".paper")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await expect(page.locator(".document-title")).toHaveCSS(
    "color",
    "rgb(32, 38, 49)",
  );
  await page.emulateMedia({ media: "screen" });
  await page.getByRole("radio", { name: /Dark document/ }).check();
  await page.getByRole("button", { name: "Continue to print" }).click();
  expect(await page.evaluate(() => window.printedTheme)).toBe("dark");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".paper")).toHaveCSS(
    "background-color",
    "rgb(23, 26, 32)",
  );
  await expect(page.locator(".document-title")).toHaveCSS(
    "color",
    "rgb(243, 244, 247)",
  );
  await page.emulateMedia({ media: "screen" });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".paper")).toHaveCSS(
    "background-color",
    "rgb(23, 26, 32)",
  );
});
