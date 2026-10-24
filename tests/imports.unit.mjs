import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { zipSync, strToU8 } from "fflate";
import ExcelJS from "exceljs";
import {
  parseAvtrackFile,
  decodeTextFile,
  tableContent,
} from "../src/avtrack.js";
import { validIPs } from "../src/document.js";

for (const version of [
  "v0.0.186",
  "v0.0.187",
  "v0.0.188",
  "schema-2",
  "inventory-condition-schema-2",
]) {
  test(`reads historical AVTrack ${version} backup with inventory and original files`, async () => {
    const bytes = await fs.readFile(
      new URL(`./fixtures/avtrack-${version}.json`, import.meta.url),
    );
    const result = await parseAvtrackFile(new File([bytes], "backup.json"));
    assert.ok(result.collections.find((c) => c.id === "devices")?.rows.length);
    assert.ok(result.collections.find((c) => c.id === "channels")?.rows.length);
    assert.ok(result.collections.find((c) => c.id === "backups")?.rows.length);
    assert.ok(result.files.length);
    assert.ok(result.files.every((file) => file.size > 0));
    assert.ok(
      decodeTextFile(
        result.files.find((file) => file.name.endsWith(".json")),
      ).includes("profile"),
    );
    if (version === "schema-2")
      assert.match(result.description, /SHA-256 checksum verified/);
  });
}
test("checks integrity and rejects newer schemas without import", async () => {
  const data = JSON.parse(
    await fs.readFile(
      new URL("./fixtures/avtrack-schema-2.json", import.meta.url),
      "utf8",
    ),
  );
  data.tables.devices[0].name = "Changed after export";
  await assert.rejects(
    parseAvtrackFile(new File([JSON.stringify(data)], "damaged.json")),
    /checksum mismatch/,
  );
  data.schema_version = 99;
  await assert.rejects(
    parseAvtrackFile(new File([JSON.stringify(data)], "newer.json")),
    /newer than this importer supports/,
  );
});
test("reads complete ZIP and multi-report CSV ZIP exports", async () => {
  const bytes = await fs.readFile(
    new URL("./fixtures/avtrack-schema-2.json", import.meta.url),
  );
  const backup = zipSync({ "avtrack-workspace.json": bytes });
  const parsed = await parseAvtrackFile(new File([backup], "complete.zip"));
  assert.ok(parsed.collections.length >= 4);
  const reports = zipSync({
    "Devices.csv": strToU8("Device name,IP Address\nEncoder,10.0.0.2"),
    "IPTV.csv": strToU8("Channel,IP,Port\nNews,239.1.2.3,1234"),
  });
  const result = await parseAvtrackFile(new File([reports], "reports.csv.zip"));
  assert.equal(result.collections.length, 2);
  assert.equal(result.collections[1].rows[0].column_2, "1234");
});
test("reads quoted multiline CSV and separates channels from devices", async () => {
  const csv =
    'name,ip,record_type,notes\r\nEncoder,10.0.0.2,device,"Line one\nLine two"\r\nNews,239.1.2.3,iptv,Live';
  const result = await parseAvtrackFile(new File([csv], "network.csv"));
  assert.equal(result.collections.length, 2);
  assert.equal(result.collections[0].rows[0].column_3, "Line one\nLine two");
  const nodes = tableContent(
    result.collections[0],
    ["column_0", "column_1"],
    1,
    1,
    "network.csv",
  );
  assert.equal(nodes[2].content.length, 2);
  assert.equal(
    nodes[2].content[1].content[1].content[0].content[0].text,
    "10.0.0.2",
  );
});
test("reads XLSX sheets without evaluating formulas", async () => {
  const book = new ExcelJS.Workbook(),
    sheet = book.addWorksheet("Devices");
  sheet.addRow(["Device", "IP Address", "Notes"]);
  sheet.addRow(["Encoder", "10.0.0.2", { formula: "1+2", result: 3 }]);
  const result = await parseAvtrackFile(
    new File([await book.xlsx.writeBuffer()], "network.xlsx"),
  );
  assert.equal(result.collections[0].rows[0].column_2, "=1+2");
});
test("keeps individual backup bytes and rejects binary text previews", async () => {
  const bytes = Uint8Array.from([0, 1, 2, 255]);
  const result = await parseAvtrackFile(new File([bytes], "mixer.backup"));
  assert.equal(result.files[0].size, 4);
  assert.deepEqual(
    Buffer.from(result.files[0].base64, "base64"),
    Buffer.from(bytes),
  );
  assert.throws(() => decodeTextFile(result.files[0]));
});
test("validates IPv4, IPv6, and CIDR prefixes", () => {
  assert.deepEqual(
    validIPs(
      "10.0.0.1/24 2001:db8::1 ::1 999.0.0.1 10.0.0.1/33 2001:db8::1/129",
    ),
    ["10.0.0.1/24", "2001:db8::1", "::1"],
  );
});
