import { test } from "node:test";
import assert from "node:assert/strict";
import { paginateCanvas } from "../src/pdf-pages.js";

test("moves a guide step that fits intact to the following page", () => {
  assert.deepEqual(paginateCanvas(1800, 1000, [{ top: 600, bottom: 1300 }]), [
    { start: 0, height: 600 },
    { start: 600, height: 1000 },
    { start: 1600, height: 200 },
  ]);
});
test("protects an image within a step taller than a page", () => {
  assert.deepEqual(
    paginateCanvas(1900, 1000, [
      { top: 400, bottom: 1800 },
      { top: 800, bottom: 1300 },
    ]),
    [
      { start: 0, height: 800 },
      { start: 800, height: 1000 },
      { start: 1800, height: 100 },
    ],
  );
});
test("oversized images still paginate without dropping content or looping", () => {
  const pages = paginateCanvas(2500, 1000, [{ top: 0, bottom: 2400 }]);
  assert.deepEqual(pages, [
    { start: 0, height: 1000 },
    { start: 1000, height: 1000 },
    { start: 2000, height: 500 },
  ]);
});
test("content ending exactly at a page break stays on that page", () => {
  assert.deepEqual(paginateCanvas(1000, 1000, [{ top: 100, bottom: 1000 }]), [
    { start: 0, height: 1000 },
  ]);
});
