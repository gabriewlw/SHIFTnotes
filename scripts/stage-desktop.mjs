import fs from "node:fs/promises";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const stage = path.join(root, ".desktop-app");
const pkg = JSON.parse(
  await fs.readFile(path.join(root, "package.json"), "utf8"),
);
await fs.rm(stage, { recursive: true, force: true });
await fs.mkdir(stage, { recursive: true });
for (const dir of ["dist", "electron"])
  await fs.cp(path.join(root, dir), path.join(stage, dir), { recursive: true });
const { name, version, description, main, author, license } = pkg;
await fs.writeFile(
  path.join(stage, "package.json"),
  JSON.stringify(
    { name, version, description, main, author, license },
    null,
    2,
  ),
);
console.log("Prepared bundled desktop app (no runtime npm dependencies).");
