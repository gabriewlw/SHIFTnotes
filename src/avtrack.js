import Papa from "papaparse";
import { unzipSync } from "fflate";
import schemas from "./avtrack-schemas.json" with { type: "json" };

export const MAX_IMPORT_BYTES = 200_000_000;
const label = (key) =>
  ({
    name: "Name",
    ip: "IP address",
    vlan: "VLAN",
    record_type: "Record type",
    channel_source: "Channel source",
    ip_confirmed: "IP confirmed",
    discipline: "System",
    serial_number: "Serial number",
    created_at: "Saved at",
    device_name: "Device",
    equipment_type: "Backup type",
  })[key] || key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
export const scalar = (value) =>
  value === null || value === undefined
    ? ""
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
function dataset(id, title, keys, records) {
  return {
    id,
    title,
    columns: keys.map((key) => ({ key, label: label(key) })),
    rows: records.map((row) =>
      Object.fromEntries(keys.map((key) => [key, scalar(row[key])])),
    ),
  };
}
function fromGrid(id, title, grid) {
  const rows = grid.filter((row) =>
    row.some((value) => String(value ?? "").trim()),
  );
  if (!rows.length) return null;
  const columns = rows[0].map((value, index) => ({
    key: `column_${index}`,
    label: scalar(value).trim() || `Column ${index + 1}`,
  }));
  if (columns.length > 100)
    throw Error(
      "This sheet has more than 100 columns. Export only the relevant columns from AVTrack.",
    );
  return {
    id,
    title,
    columns,
    rows: rows
      .slice(1)
      .map((row) =>
        Object.fromEntries(
          columns.map((column, i) => [column.key, scalar(row[i])]),
        ),
      ),
  };
}
function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  const compare = (a, b) => {
    const aa = Array.from(a, (c) => c.codePointAt(0)),
      bb = Array.from(b, (c) => c.codePointAt(0));
    for (let i = 0; i < Math.min(aa.length, bb.length); i++) {
      if (aa[i] !== bb[i]) return aa[i] - bb[i];
    }
    return aa.length - bb.length;
  };
  return (
    "{" +
    Object.keys(value)
      .sort(compare)
      .map((key) => JSON.stringify(key) + ":" + canonical(value[key]))
      .join(",") +
    "}"
  );
}
async function readBackup(data) {
  if (data.format !== "avtrack-workspace" || data.version !== 1)
    throw Error(
      "Unsupported AVTrack backup format. Use a complete backup exported by AVTrack.",
    );
  if (
    data.schema_version !== undefined &&
    ![1, 2].includes(data.schema_version)
  )
    throw Error(
      `AVTrack schema ${data.schema_version} is newer than this importer supports. No data was imported. Use a CSV/XLSX report or update SHIFTnotes.`,
    );
  const schemaVersion =
      data.schema_version ||
      (Object.hasOwn(data.tables || {}, "backup_details") ? 2 : 1),
    contract = schemas[schemaVersion];
  if (
    !data.columns ||
    !data.tables ||
    typeof data.files !== "object" ||
    data.files === null
  )
    throw Error("The backup is missing tables, columns, or its file manifest.");
  const same = (a, b) =>
    a.length === b.length && a.every((key) => b.includes(key));
  if (!same(Object.keys(contract), Object.keys(data.tables)))
    throw Error(
      "The backup table layout is unsupported or incomplete. No data was imported.",
    );
  for (const [table, columns] of Object.entries(contract)) {
    if (
      !Array.isArray(data.columns[table]) ||
      !same(columns, data.columns[table]) ||
      !Array.isArray(data.tables[table]) ||
      !data.tables[table].every(
        (row) =>
          row && typeof row === "object" && same(columns, Object.keys(row)),
      )
    )
      throw Error(
        `The backup contains an unsupported ${table} layout. No data was imported.`,
      );
  }
  let integrity = "Legacy backup: no checksum supplied";
  if (data.integrity !== undefined) {
    if (
      data.integrity?.algorithm !== "sha256" ||
      !/^([a-f0-9]{64})$/.test(data.integrity.digest || "")
    )
      throw Error("Invalid backup integrity metadata.");
    const { integrity: omitted, ...payload } = data;
    const digest = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(canonical(payload)),
        ),
      ),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");
    if (digest !== data.integrity.digest)
      throw Error(
        "Backup checksum mismatch. The file may be damaged or modified. No data was imported.",
      );
    integrity = "SHA-256 checksum verified";
  }
  const devices = data.tables.devices;
  const collections = [
    dataset(
      "devices",
      "Device IP list",
      ["name", "ip", "vlan", "venue", "discipline", "notes", "ip_confirmed"],
      devices.filter((row) => row.record_type === "device"),
    ),
    dataset(
      "channels",
      "IPTV channel list",
      ["name", "ip", "port", "channel_source", "notes", "category"],
      devices.filter((row) => row.record_type === "iptv"),
    ),
  ];
  for (const inventory of data.tables.equipment_inventories) {
    let layout;
    try {
      layout = JSON.parse(inventory.layout || "{}");
    } catch {
      throw Error("An inventory layout is unreadable.");
    }
    const records = data.tables.equipment
      .filter((row) => row.inventory_id === inventory.id)
      .map((row) => {
        let values;
        try {
          values = JSON.parse(row.custom_values || "{}");
        } catch {
          throw Error("Inventory custom fields are unreadable.");
        }
        return {
          ...row,
          ...Object.fromEntries(
            Object.entries(values).filter(([key]) => !Object.hasOwn(row, key)),
          ),
        };
      });
    const keys = [
      "description",
      "brand",
      "model",
      "serial_number",
      "quantity",
      "location",
      "notes",
    ];
    for (const col of layout.columns || [])
      if (!keys.includes(col.key)) keys.push(col.key);
    const group = dataset(
      `inventory-${inventory.id}`,
      inventory.name || "Equipment inventory",
      keys,
      records,
    );
    for (const col of layout.columns || []) {
      const match = group.columns.find((c) => c.key === col.key);
      if (match) match.label = col.label || match.label;
    }
    collections.push(group);
  }
  const details = new Map(
    data.tables.backup_details?.map((row) => [row.backup_id, row.details]) ||
      [],
  );
  const backups = data.tables.av_backups.map((row) => ({
    ...row,
    recovery_details: details.get(row.id) || "",
  }));
  collections.push(
    dataset(
      "backups",
      "Saved configuration backups",
      [
        "device_name",
        "equipment_type",
        "filename",
        "size",
        "notes",
        "created_at",
        "recovery_details",
      ],
      backups,
    ),
  );
  const files = backups.map((row) => {
    const encoded = row.storage_name
      ? data.files[row.storage_name]
      : row.content;
    if (
      typeof encoded !== "string" ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        encoded,
      )
    )
      throw Error("A saved configuration file has invalid encoding.");
    const size =
      (encoded.length * 3) / 4 -
      (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0);
    if (!Number.isInteger(row.size) || size !== row.size)
      throw Error(`Saved backup ${row.filename} is missing or incomplete.`);
    return {
      name: String(row.filename),
      base64: encoded,
      size,
      device: scalar(row.device_name),
    };
  });
  return {
    collections: collections.filter((c) => c.rows.length),
    files,
    description: `AVTrack complete backup · schema ${schemaVersion} · ${integrity}`,
    exportedAt: scalar(data.exported_at),
  };
}

export async function parseAvtrackFile(file) {
  if (file.size > MAX_IMPORT_BYTES)
    throw Error(
      "Choose a file smaller than 200 MB. Export a smaller AVTrack selection if needed.",
    );
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext === "csv") {
    const parsed = Papa.parse(await file.text(), { skipEmptyLines: "greedy" });
    if (parsed.errors.length)
      throw Error(
        "This CSV contains malformed quoting. Export a fresh CSV from AVTrack.",
      );
    const grid = parsed.data;
    const header = grid[0] || [];
    const index = header.findIndex(
      (v) => String(v).toLowerCase() === "record_type",
    );
    const collections =
      index >= 0
        ? ["device", "iptv"].map((type) =>
            fromGrid(
              type,
              type === "device" ? "Device IP list" : "IPTV channel list",
              [header, ...grid.slice(1).filter((row) => row[index] === type)],
            ),
          )
        : [fromGrid("csv", file.name.replace(/\.csv$/i, ""), grid)];
    return {
      collections: collections.filter((c) => c?.rows.length),
      files: [],
      description: "AVTrack CSV · values imported as literal text",
    };
  }
  if (ext === "xlsx") {
    const { default: ExcelJS } = await import("exceljs");
    const book = new ExcelJS.Workbook();
    const bytes = new Uint8Array(await file.arrayBuffer());
    let totalSize = 0;
    unzipSync(bytes, {
      filter: (entry) => {
        totalSize += entry.originalSize;
        if (totalSize > MAX_IMPORT_BYTES)
          throw Error(
            "The uncompressed workbook exceeds 200 MB. Export a smaller selection.",
          );
        return false;
      },
    });
    await book.xlsx.load(bytes);
    const collections = [];
    for (const sheet of book.worksheets) {
      if (sheet.rowCount > 25000 || sheet.columnCount > 100)
        throw Error(
          "A workbook sheet exceeds 25,000 rows or 100 columns. Export a smaller selection.",
        );
      const grid = [];
      sheet.eachRow((row) => {
        const values = [];
        for (let i = 1; i <= sheet.columnCount; i++) {
          const cell = row.getCell(i),
            v = cell.value;
          values.push(
            v && typeof v === "object"
              ? v.formula
                ? "=" + v.formula
                : v.richText
                  ? v.richText.map((part) => part.text).join("")
                  : v.text || v.result || cell.text
              : v,
          );
        }
        grid.push(values);
      });
      const group = fromGrid(sheet.id, sheet.name, grid);
      if (group?.rows.length) collections.push(group);
    }
    return {
      collections,
      files: [],
      description:
        "AVTrack Excel workbook · select a worksheet · formulas are not executed",
    };
  }
  if (ext === "zip") {
    let totalSize = 0;
    const entries = unzipSync(new Uint8Array(await file.arrayBuffer()), {
      filter: (entry) => {
        totalSize += entry.originalSize;
        if (totalSize > MAX_IMPORT_BYTES)
          throw Error("The uncompressed backup exceeds 200 MB.");
        return (
          entry.name === "avtrack-workspace.json" ||
          entry.name.toLowerCase().endsWith(".csv")
        );
      },
    });
    if (entries["avtrack-workspace.json"])
      return readBackup(
        JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(
            entries["avtrack-workspace.json"],
          ),
        ),
      );
    const reports = Object.entries(entries)
      .filter(([name]) => name.toLowerCase().endsWith(".csv"))
      .map(([name, bytes]) => {
        const parsed = Papa.parse(new TextDecoder().decode(bytes), {
          skipEmptyLines: "greedy",
        });
        if (parsed.errors.length)
          throw Error(`The CSV report ${name} contains malformed quoting.`);
        return fromGrid(name, name.replace(/\.csv$/i, ""), parsed.data);
      })
      .filter((group) => group?.rows.length);
    if (reports.length)
      return {
        collections: reports,
        files: [],
        description: "AVTrack CSV report bundle · select a report",
      };
  }
  if (ext === "json") {
    const data = JSON.parse(await file.text());
    if (data?.format === "avtrack-workspace") return readBackup(data);
  }
  // Individual device configuration files and PDF reports remain downloadable attachments.
  if (file.size > 5 * 1024 * 1024)
    throw Error(
      "Individual attachments must be smaller than 5 MB. Keep larger originals in your backup folder and import their AVTrack metadata instead.",
    );
  const bytes = new Uint8Array(await file.arrayBuffer());
  let raw = "";
  for (let i = 0; i < bytes.length; i += 8192)
    raw += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return {
    collections: [],
    files: [
      { name: file.name, base64: btoa(raw), size: file.size, device: "" },
    ],
    description:
      "Individual configuration or reference file · original bytes preserved",
  };
}
export function tableContent(collection, keys, from, to, source) {
  const textNode = (value) => ({
    type: "paragraph",
    content: scalar(value) ? [{ type: "text", text: scalar(value) }] : [],
  });
  const cell = (type, value) => ({ type, content: [textNode(value)] });
  return [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: collection.title }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: `Source: ${source} · imported ${new Date().toLocaleDateString()} · snapshot, not a live connection`,
        },
      ],
    },
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: keys.map((key) =>
            cell(
              "tableHeader",
              collection.columns.find((c) => c.key === key)?.label || key,
            ),
          ),
        },
        ...collection.rows.slice(from - 1, to).map((row) => ({
          type: "tableRow",
          content: keys.map((key) => cell("tableCell", row[key])),
        })),
      ],
    },
    { type: "paragraph" },
  ];
}
export function decodeTextFile(file) {
  if (file.size > 250_000)
    throw Error(
      "This configuration is too large for a code block. Attach the original file instead.",
    );
  const bytes = Uint8Array.from(atob(file.base64), (char) =>
    char.charCodeAt(0),
  );
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text))
    throw Error(
      "This is a binary file. Attach the original instead of inserting it as code.",
    );
  return text;
}
