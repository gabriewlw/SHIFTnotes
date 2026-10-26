import React, { useEffect, useState, useRef } from "react";
import {
  listReferenceFiles,
  deleteReferenceFile,
  storeReferenceFile,
  getReferenceFile,
  saveReferenceCopy,
} from "./references";

export function ReferencePicker({ documents, currentId, onInsert }) {
  const active = useRef(true);
  useEffect(
    () => () => {
      active.current = false;
    },
    [],
  );
  const [kind, setKind] = useState("document");
  const [label, setLabel] = useState("");
  const [search, setSearch] = useState("");
  const [path, setPath] = useState("");
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    listReferenceFiles()
      .then(setFiles)
      .catch((err) => setError(err.message));
  }, []);
  const insert = (ref) =>
    onInsert({
      ...ref,
      id: crypto.randomUUID(),
      name: label.trim() || ref.name,
    });
  return (
    <>
      <p className="modal-description">
        Link a previous handover, manual, SOP, or spreadsheet to the words
        selected in your document.
      </p>
      <label className="field">
        Reference type
        <select
          aria-label="Reference type"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setError("");
          }}
        >
          <option value="document">SHIFTnotes document</option>
          <option value="stored">Stored file</option>
          <option value="path">Local file path</option>
        </select>
      </label>
      <label className="field">
        Link text (optional)
        <input
          aria-label="Reference link text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Previous shift handover or switch manual"
        />
      </label>
      {kind === "document" && (
        <>
          <label className="field">
            Find a document
            <input
              aria-label="Find reference document"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search handovers, manuals, SOPs…"
            />
          </label>
          <div className="reference-list">
            {documents
              .filter(
                (doc) =>
                  doc.id !== currentId &&
                  doc.title.toLowerCase().includes(search.toLowerCase()),
              )
              .map((doc) => (
                <button
                  key={doc.id}
                  onClick={() =>
                    insert({
                      kind: "document",
                      documentId: doc.id,
                      name: doc.title,
                    })
                  }
                >
                  <strong>{doc.title}</strong>
                  <small>
                    {doc.folder} · {new Date(doc.updated).toLocaleDateString()}
                  </small>
                </button>
              ))}
          </div>
        </>
      )}
      {kind === "stored" && (
        <>
          <p className="modal-description">
            Upload a copy to keep in the app, up to 20 MB per file. Stored
            references are included in workspace backups. PDFs show the link
            text, without embedding reference files.
          </p>
          <label className="field">
            Upload reference file
            <input
              aria-label="Upload reference file"
              type="file"
              disabled={busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                setBusy(true);
                setError("");
                try {
                  const entry = await storeReferenceFile(file);
                  if (!active.current) return;
                  setFiles((previous) => [...previous, entry]);
                  insert({
                    kind: "stored",
                    fileId: entry.id,
                    name: entry.name,
                  });
                } catch (err) {
                  setError(err.message);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
          {busy && <p role="status">Storing reference…</p>}
          <div className="reference-list">
            {files.map((file) => {
              const inUse = documents.some((doc) =>
                doc.references?.some(
                  (ref) => ref.kind === "stored" && ref.fileId === file.id,
                ),
              );
              return (
                <div className="reference-file-row" key={file.id}>
                  <button
                    onClick={() =>
                      insert({
                        kind: "stored",
                        fileId: file.id,
                        name: file.name,
                      })
                    }
                  >
                    <strong>{file.name}</strong>
                    <small>
                      {(file.size / 1024).toFixed(1)} KB · Stored on this device
                    </small>
                  </button>
                  <button
                    aria-label={`Delete stored copy of ${file.name}`}
                    disabled={inUse}
                    title={
                      inUse
                        ? "Remove this file's document references before deleting the stored copy"
                        : "Delete the unused stored copy"
                    }
                    onClick={async () => {
                      try {
                        await deleteReferenceFile(file.id);
                        setFiles((previous) =>
                          previous.filter((entry) => entry.id !== file.id),
                        );
                      } catch (err) {
                        setError(err.message);
                      }
                    }}
                  >
                    Delete copy
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
      {kind === "path" && (
        <>
          <p className="modal-description">
            Keep a link to the original file. Moving or deleting it breaks the
            link. Local files open in the desktop app; browser mode lets you
            copy the path.
          </p>
          <label className="field">
            File path
            <input
              aria-label="Reference file path"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder={"C:\\Manuals\\Switch guide.pdf"}
            />
          </label>
          {window.shiftDesktop && (
            <button
              className="outline-button"
              onClick={async () => {
                try {
                  const result =
                    await window.shiftDesktop.chooseReferenceFile();
                  if (result) setPath(result);
                } catch {
                  setError("Could not select a file.");
                }
              }}
            >
              Browse files
            </button>
          )}
          <div className="modal-actions">
            <button
              className="primary-button"
              disabled={
                !/^(?:[A-Za-z]:[\\/]|\/|\\\\)/.test(path.trim()) ||
                /[\x00-\x1f]/.test(path)
              }
              onClick={() =>
                insert({
                  kind: "path",
                  path: path.trim(),
                  name: path.trim().split(/[\\/]/).pop() || path.trim(),
                })
              }
            >
              Insert file reference
            </button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </>
  );
}

export function ReferenceDetails({ reference, documents, onNavigate }) {
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const target = documents.find((doc) => doc.id === reference.documentId);
  useEffect(() => {
    if (reference.kind !== "stored") return;
    let active = true;
    getReferenceFile(reference.fileId)
      .then((entry) => {
        if (!active) return;
        if (entry) setFile(entry);
        else
          setError(
            "This stored file is missing. Restore it from a workspace backup or attach it again.",
          );
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [reference]);
  const open = async () => {
    setError("");
    setBusy(true);
    try {
      const result =
        reference.kind === "stored"
          ? await window.shiftDesktop.openStoredReference({
              name: file.name,
              base64: await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(",")[1]);
                reader.onerror = reject;
                reader.readAsDataURL(file.blob);
              }),
            })
          : await window.shiftDesktop.openReferencePath(reference.path);
      if (result) setError(result);
    } catch {
      setError(
        "Could not open this reference. Check that the file exists and an application is installed for it.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="reference-details">
      <h3>{reference.name}</h3>
      {reference.kind === "document" &&
        (target ? (
          <>
            <p>SHIFTnotes document · {target.title}</p>
            <button
              className="primary-button"
              onClick={() => onNavigate(target.id)}
            >
              Open document
            </button>
          </>
        ) : (
          <p role="alert">
            The linked document is missing or has been deleted.
          </p>
        ))}
      {reference.kind === "stored" && file && (
        <>
          <p>
            {file.name} · {(file.size / 1024).toFixed(1)} KB
          </p>
          <p className="modal-description">
            A copy is stored in this app and included in workspace backups.
            Opening it in another app uses a temporary copy; edits there do not
            update this stored reference.
          </p>
          <button
            className="outline-button"
            onClick={() => saveReferenceCopy(file)}
          >
            Save a copy
          </button>
          {window.shiftDesktop && (
            <button className="primary-button" disabled={busy} onClick={open}>
              Open in default app
            </button>
          )}
        </>
      )}
      {reference.kind === "path" && (
        <>
          <code className="reference-path">{reference.path}</code>
          <p className="modal-description">
            This links to the original file on your computer. Its contents are
            not included in backups.
          </p>
          <button
            className="outline-button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(reference.path);
              } catch {
                setError(
                  "Could not copy the path. Select and copy it manually.",
                );
              }
            }}
          >
            Copy file path
          </button>
          {window.shiftDesktop && (
            <button className="primary-button" disabled={busy} onClick={open}>
              Open linked file
            </button>
          )}
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
