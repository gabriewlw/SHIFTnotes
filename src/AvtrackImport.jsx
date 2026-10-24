import React, { useState } from "react";
import {
  Upload,
  FileText,
  Table2,
  Check,
  Download,
  Code2,
  Paperclip,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { parseAvtrackFile, tableContent, decodeTextFile } from "./avtrack";
export default function AvtrackImport({ onInsert, notify }) {
  const [source, setSource] = useState(null),
    [filename, setFilename] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [index, setIndex] = useState(0),
    [keys, setKeys] = useState([]),
    [from, setFrom] = useState(1),
    [to, setTo] = useState(1),
    [query, setQuery] = useState("");
  const collection = source?.collections[index];
  const rows =
    collection?.rows.filter((row) =>
      Object.values(row).join(" ").toLowerCase().includes(query.toLowerCase()),
    ) || [];
  const choose = (result, i = 0) => {
    setIndex(i);
    setKeys(result.collections[i]?.columns.slice(0, 6).map((c) => c.key) || []);
    setFrom(1);
    setTo(Math.min(result.collections[i]?.rows.length || 1, 500));
    setQuery("");
  };
  async function load(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    setSource(null);
    try {
      const result = await parseAvtrackFile(file);
      setSource(result);
      setFilename(file.name);
      choose(result);
      if (!result.collections.length && !result.files.length)
        throw Error("No populated tables or configuration files were found.");
    } catch (e) {
      setSource(null);
      setError(e.message || "Could not read this file.");
    } finally {
      setBusy(false);
    }
  }
  const attach = (file) => {
    if (file.size > 5 * 1024 * 1024) {
      setError(
        "Attachments larger than 5 MB exceed this local workspace’s limit. Keep the original in your backup folder and include its metadata instead.",
      );
      return;
    }
    onInsert([
      {
        type: "fileAttachment",
        attrs: { filename: file.name, base64: file.base64, size: file.size },
      },
      { type: "paragraph" },
    ]);
    notify("Original file attached to the document and workspace backups");
  };
  const code = (file) => {
    try {
      const text = decodeTextFile(file),
        ext = file.name.split(".").pop().toLowerCase(),
        language =
          {
            xml: "xml",
            json: "json",
            js: "javascript",
            py: "python",
            sh: "bash",
          }[ext] || "plaintext";
      onInsert([
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: file.name }],
        },
        {
          type: "codeBlock",
          attrs: { language },
          content: text ? [{ type: "text", text }] : [],
        },
        { type: "paragraph" },
      ]);
      notify("Configuration inserted as editable code");
    } catch (e) {
      setError(e.message);
    }
  };
  const download = (file) => {
    const a = document.createElement("a");
    a.href = "data:application/octet-stream;base64," + file.base64;
    a.download = file.name;
    a.click();
  };
  const lastRow = Math.min(+to, rows.length);
  const validRange =
    Number.isInteger(+from) &&
    Number.isInteger(lastRow) &&
    +from >= 1 &&
    lastRow >= +from &&
    lastRow <= rows.length &&
    lastRow - +from < 500;
  return (
    <div className="avtrack-import">
      <p className="modal-description">
        Bring AVTrack records into your writing as editable tables, code, or
        attached originals. Your AVTrack database and backup files stay
        untouched.
      </p>
      <label className={`import-dropzone ${busy ? "busy" : ""}`}>
        <Upload size={24} />
        <strong>
          {busy
            ? "Reading your export…"
            : "Choose an AVTrack export or saved backup"}
        </strong>
        <span>
          CSV · XLSX · complete ZIP / JSON · configuration files · PDF
          references
        </span>
        <input
          aria-label="AVTrack import file"
          type="file"
          disabled={busy}
          onChange={load}
        />
      </label>
      <div className="format-guidance">
        <strong>Best formats</strong>
        <p>
          <b>CSV / XLSX</b> for channel lists and IP inventories.{" "}
          <b>Complete ZIP / JSON</b> for all inventories and saved device
          configurations. PDF reports can be attached; use a spreadsheet for
          editable tables.
        </p>
      </div>
      {error && (
        <div role="alert" className="import-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
      {source && (
        <>
          <div className="import-source">
            <Check size={15} />
            <div>
              <strong>{filename}</strong>
              <span>{source.description}</span>
              {source.exportedAt && <small>Exported {source.exportedAt}</small>}
            </div>
          </div>
          {!!source.collections.length && (
            <div className="import-data-layout">
              <nav className="import-sections">
                {source.collections.map((group, i) => (
                  <button
                    key={group.id}
                    className={index === i ? "selected" : ""}
                    onClick={() => choose(source, i)}
                  >
                    <Table2 size={15} />
                    <span>
                      {group.title}
                      <small>{group.rows.length} records</small>
                    </span>
                    <ChevronRight size={13} />
                  </button>
                ))}
              </nav>
              <div className="import-preview">
                <h3>{collection.title}</h3>
                <label className="import-filter">
                  Filter records
                  <input
                    aria-label="Filter AVTrack records"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setFrom(1);
                    }}
                    placeholder="Find a device, channel, IP, venue…"
                  />
                </label>
                <div className="import-columns">
                  {collection.columns.map((col) => (
                    <label key={col.key}>
                      <input
                        type="checkbox"
                        checked={keys.includes(col.key)}
                        onChange={(e) =>
                          setKeys(
                            e.target.checked
                              ? [...keys, col.key]
                              : keys.filter((key) => key !== col.key),
                          )
                        }
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
                <div className="import-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {keys.map((key) => (
                          <th key={key}>
                            {
                              collection.columns.find((c) => c.key === key)
                                ?.label
                            }
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 8).map((row, i) => (
                        <tr key={i}>
                          {keys.map((key) => (
                            <td key={key}>{row[key]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <small className="preview-caption">
                  Preview: first {Math.min(rows.length, 8)} of {rows.length}{" "}
                  matching records. Select columns and a row range before
                  inserting.
                </small>
                <div className="import-range">
                  <label>
                    From row
                    <input
                      aria-label="First import row"
                      type="number"
                      min="1"
                      max={rows.length}
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                    />
                  </label>
                  <label>
                    To row
                    <input
                      aria-label="Last import row"
                      type="number"
                      min="1"
                      max={rows.length}
                      value={Math.min(to, rows.length)}
                      onChange={(e) => setTo(e.target.value)}
                    />
                  </label>
                  <button
                    className="primary-button"
                    disabled={!keys.length || keys.length > 12 || !validRange}
                    onClick={() => {
                      onInsert(
                        tableContent(
                          { ...collection, rows },
                          keys,
                          +from,
                          lastRow,
                          filename,
                        ),
                      );
                      notify(
                        `${lastRow - +from + 1} AVTrack records inserted as an editable table`,
                      );
                    }}
                  >
                    <PlusIcon />
                    Insert table
                  </button>
                </div>
                <p className="muted">
                  Up to 500 records and 12 columns per table. Insert additional
                  ranges for larger inventories. Imported tables are dated
                  snapshots, not live links.
                </p>
              </div>
            </div>
          )}
          {!!source.files.length && (
            <section className="import-files">
              <h3>
                Saved configuration & reference files{" "}
                <span>{source.files.length}</span>
              </h3>
              <p>
                Insert readable configuration as code, attach the original
                bytes, or save a copy. Files are never executed. Attachments are
                retained in SHIFTnotes backups; PDFs show only their filenames.
              </p>
              {source.files.map((file, i) => (
                <div className="import-file" key={i}>
                  <FileText size={21} />
                  <div>
                    <strong>{file.name}</strong>
                    <small>
                      {file.device && `${file.device} · `}
                      {(file.size / 1024).toFixed(1)} KB
                    </small>
                  </div>
                  <button
                    title="Insert configuration as code"
                    aria-label={`Insert ${file.name} as code`}
                    onClick={() => code(file)}
                  >
                    <Code2 size={15} />
                    <span>Code</span>
                  </button>
                  <button
                    title="Attach original file"
                    aria-label={`Attach ${file.name}`}
                    onClick={() => attach(file)}
                  >
                    <Paperclip size={15} />
                    <span>Attach</span>
                  </button>
                  <button
                    title="Save original file"
                    aria-label={`Save ${file.name}`}
                    onClick={() => download(file)}
                  >
                    <Download size={15} />
                  </button>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
function PlusIcon() {
  return <Table2 size={14} />;
}
