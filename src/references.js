import { Mark } from "@tiptap/core";

export const MAX_REFERENCE_SIZE = 20 * 1024 * 1024;
const DB_NAME = "shiftnotes.references.v1";

export const ReferenceLink = Mark.create({
  name: "referenceLink",
  priority: 1100,
  inclusive: false,
  excludes: "link",
  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-reference-id"),
      },
    };
  },
  parseHTML() {
    return [{ tag: "a[data-reference-id]" }];
  },
  renderHTML({ mark }) {
    return [
      "a",
      {
        "data-reference-id": mark.attrs.id,
        href: `#reference-${encodeURIComponent(mark.attrs.id)}`,
        class: "reference-link",
        tabindex: "0",
        title: "Open reference",
      },
      0,
    ];
  },
});

async function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("files", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        Error("Reference storage is unavailable. Check available disk space."),
      );
  });
}
async function transaction(mode, operation) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("files", mode);
      const request = operation(tx.objectStore("files"));
      tx.oncomplete = () => resolve(request?.result);
      tx.onerror = tx.onabort = () =>
        reject(
          Error("Could not save reference files. Check available storage."),
        );
    });
  } finally {
    db.close();
  }
}
export const listReferenceFiles = () =>
  transaction("readonly", (store) => store.getAll());
export const deleteReferenceFile = (id) =>
  transaction("readwrite", (store) => store.delete(id));
export const getReferenceFile = (id) =>
  transaction("readonly", (store) => store.get(id));
export const saveReferenceFiles = (files) =>
  transaction("readwrite", (store) => {
    for (const file of files) store.put(file);
  });
export async function storeReferenceFile(file) {
  if (file.size > MAX_REFERENCE_SIZE)
    throw Error("Reference files can be up to 20 MB each.");
  const entry = {
    id: crypto.randomUUID(),
    name: file.name,
    size: file.size,
    mime: file.type || "application/octet-stream",
    blob: new Blob([await file.arrayBuffer()], { type: file.type }),
  };
  await saveReferenceFiles([entry]);
  return entry;
}
export function saveReferenceCopy(entry) {
  const url = URL.createObjectURL(entry.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = entry.name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function backupReferenceFiles() {
  const files = await listReferenceFiles();
  return Promise.all(
    files.map(async (file) => ({
      id: file.id,
      name: file.name,
      size: file.size,
      mime: file.mime,
      base64: await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = () =>
          reject(Error("Could not read a stored reference for backup."));
        reader.readAsDataURL(file.blob);
      }),
    })),
  );
}
export function restoreReferenceFiles(entries = []) {
  if (!Array.isArray(entries))
    throw Error("Invalid reference files in backup.");
  const ids = new Map();
  const files = entries.map((entry) => {
    if (
      !entry ||
      typeof entry.id !== "string" ||
      typeof entry.name !== "string" ||
      typeof entry.base64 !== "string" ||
      entry.base64.length > Math.ceil(MAX_REFERENCE_SIZE / 3) * 4 ||
      entry.base64.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(entry.base64) ||
      ids.has(entry.id)
    )
      throw Error("Invalid reference file in backup.");
    const bytes = Uint8Array.from(atob(entry.base64), (c) => c.charCodeAt(0));
    if (bytes.length > MAX_REFERENCE_SIZE || bytes.length !== entry.size)
      throw Error("Invalid reference file size.");
    const id = crypto.randomUUID();
    ids.set(entry.id, id);
    return {
      id,
      name: entry.name,
      size: bytes.length,
      mime:
        typeof entry.mime === "string"
          ? entry.mime
          : "application/octet-stream",
      blob: new Blob([bytes]),
    };
  });
  return { files, ids };
}
export function validReferences(references) {
  return (
    references === undefined ||
    (Array.isArray(references) &&
      references.every(
        (ref) =>
          ref &&
          typeof ref.id === "string" &&
          typeof ref.name === "string" &&
          ((ref.kind === "stored" && typeof ref.fileId === "string") ||
            (ref.kind === "path" && typeof ref.path === "string") ||
            (ref.kind === "document" && typeof ref.documentId === "string")),
      ))
  );
}
