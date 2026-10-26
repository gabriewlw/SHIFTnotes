import React, { useState, useEffect, useRef, useMemo } from "react";
import { useEditor, EditorContent, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle, FontSize } from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import { TableKit } from "@tiptap/extension-table";
import TypographyToolbar from "./TypographyToolbar";
import { FONT_FAMILIES, BRAND_PRESETS } from "./fonts";
import TextAlign from "@tiptap/extension-text-align";
import { common, createLowlight } from "lowlight";
import {
  ArrowUpRight,
  ArrowLeft,
  Plus,
  Search,
  FileText,
  Folder,
  ChevronDown,
  ChevronRight,
  Download,
  PanelRight,
  MoreHorizontal,
  Command,
  Settings2,
  Check,
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Code2,
  ImagePlus,
  Link2,
  Undo2,
  Redo2,
  AlignLeft,
  Sparkles,
  X,
  Copy,
  Network,
  Pin,
  Trash2,
  GripVertical,
  BookOpen,
  CircleHelp,
  LayoutTemplate,
  CheckCheck,
  Menu,
  Upload,
  Monitor,
  Type,
  Highlighter,
} from "lucide-react";
import {
  DEFAULT_BRAND,
  initialDocs,
  makeDocument,
  validIPs,
  summarize,
} from "./document";
import { Attachment, CanvasSpacer } from "./Attachment";
import {
  ReferenceLink,
  backupReferenceFiles,
  restoreReferenceFiles,
  saveReferenceFiles,
  validReferences,
} from "./references";
import { ReferencePicker, ReferenceDetails } from "./ReferencePicker";
import { GuideStep, GuideImage, TutorialStepForm } from "./GuideStep";
const AvtrackImport = React.lazy(() => import("./AvtrackImport"));
import { IPHighlight } from "./editor";

const lowlight = createLowlight(common);
function readSaved(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}
function Button({
  label,
  children,
  onClick,
  active,
  disabled,
  className = "",
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`icon-button ${active ? "active" : ""} ${className}`}
    >
      {children}
    </button>
  );
}
function Modal({ title, children, onClose }) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <div>
            <span className="eyebrow">YOUR WRITING WORKSPACE</span>
            <h2>{title}</h2>
          </div>
          <Button label="Close dialog" onClick={onClose}>
            <X size={20} />
          </Button>
        </header>
        {children}
      </section>
    </div>
  );
}

function MovableImage({
  item,
  selected,
  onSelect,
  onChange,
  onDelete,
  paperRef,
}) {
  const drag = useRef(null);
  const start = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.focus();
    onSelect(item.id);
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: item.x, oy: item.y };
  };
  const move = (e) => {
    if (!drag.current) return;
    const d = drag.current;
    const width = paperRef.current?.clientWidth || 700;
    onChange({
      ...item,
      x: Math.max(0, Math.min(width - item.width, d.ox + e.clientX - d.x)),
      y: Math.max(0, d.oy + e.clientY - d.y),
    });
  };
  return (
    <figure
      className={`floating-image ${selected ? "selected" : ""}`}
      style={{ left: item.x, top: item.y, width: item.width }}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      tabIndex={0}
      aria-label={item.caption || "Movable image"}
      onFocus={() => onSelect(item.id)}
      onKeyDown={(e) => {
        const delta = {
          ArrowLeft: [-5, 0],
          ArrowRight: [5, 0],
          ArrowUp: [0, -5],
          ArrowDown: [0, 5],
        }[e.key];
        if (delta) {
          e.preventDefault();
          onChange({
            ...item,
            x: Math.max(
              0,
              Math.min(
                (paperRef.current?.clientWidth || 700) - item.width,
                item.x + delta[0],
              ),
            ),
            y: Math.max(0, item.y + delta[1]),
          });
        }
      }}
    >
      <img
        src={item.src}
        draggable="false"
        alt={item.caption || "Document illustration"}
      />
      <figcaption>{item.caption}</figcaption>
      {selected && (
        <div
          className="image-options"
          data-export-hide
          onPointerDown={(e) => e.stopPropagation()}
        >
          <GripVertical size={14} />
          <span>Drag to position</span>
          <input
            aria-label="Image width"
            type="range"
            min="100"
            max={Math.max(100, (paperRef.current?.clientWidth || 700) - item.x)}
            value={item.width}
            onChange={(e) => onChange({ ...item, width: +e.target.value })}
          />
          <Button label="Remove image" onClick={onDelete}>
            <Trash2 size={14} />
          </Button>
        </div>
      )}
    </figure>
  );
}

export default function App() {
  const [docs, setDocs] = useState(() =>
    readSaved("shiftnotes.documents.v1", initialDocs),
  );
  const [activeId, setActiveId] = useState(
    () => localStorage.getItem("shiftnotes.active") || "studio-network",
  );
  const [brand, setBrand] = useState(() =>
    (() => {
      const saved = readSaved("shiftnotes.brand.v1", DEFAULT_BRAND);
      return saved.primary === "#173f3d" &&
        saved.accent === "#d6a566" &&
        saved.name === "SHIFTnotes"
        ? { ...saved, ...DEFAULT_BRAND }
        : saved;
    })(),
  );
  const [openedReference, setOpenedReference] = useState(null);
  const [printTheme, setPrintTheme] = useState("white");
  useEffect(() => {
    document.documentElement.dataset.printTheme = printTheme;
  }, [printTheme]);
  useEffect(() => {
    const openPrint = () => setModal("print");
    const shortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        openPrint();
      }
    };
    window.addEventListener("keydown", shortcut);
    const unsubscribe = window.shiftDesktop?.onPrintRequested(openPrint);
    return () => {
      window.removeEventListener("keydown", shortcut);
      unsubscribe?.();
    };
  }, []);
  const [filter, setFilter] = useState("All documents"),
    [search, setSearch] = useState(""),
    [panel, setPanel] = useState(window.innerWidth >= 900 ? "outline" : null),
    [modal, setModal] = useState(null),
    [selectedImage, setSelectedImage] = useState(null),
    [exporting, setExporting] = useState(false),
    [toast, setToast] = useState(""),
    [storageError, setStorageError] = useState(false),
    [mobileNav, setMobileNav] = useState(false),
    [menu, setMenu] = useState(false);
  const [tableRows, setTableRows] = useState(3),
    [tableCols, setTableCols] = useState(3),
    [tableHeader, setTableHeader] = useState(true),
    [snippet, setSnippet] = useState(""),
    [language, setLanguage] = useState("xml"),
    [link, setLink] = useState(""),
    [summaryDraft, setSummaryDraft] = useState("");
  const paperRef = useRef(),
    fileRef = useRef(),
    importRef = useRef(),
    toastTimer = useRef();
  const activeDoc = docs.find((d) => d.id === activeId) || docs[0];
  const docsRef = useRef(docs);
  docsRef.current = docs;
  const currentRef = useRef(activeDoc.id);
  currentRef.current = activeDoc.id;
  const notify = (message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
  };
  const updateDoc = (patch) =>
    setDocs((prev) =>
      prev.map((d) =>
        d.id === currentRef.current
          ? { ...d, ...patch, updated: Date.now() }
          : d,
      ),
    );
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockLowlight.configure({ lowlight, defaultLanguage: "xml" }),
      Placeholder.configure({
        placeholder: "Start writing something worth sharing…",
      }),
      Highlight,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      IPHighlight,
      Attachment,
      ReferenceLink,
      GuideStep,
      GuideImage,
      CanvasSpacer,
      TextStyle,
      FontFamily,
      FontSize,
      TableKit.configure({ table: { resizable: true } }),
    ],
    content: activeDoc.content,
    onUpdate: ({ editor }) => updateDoc({ content: editor.getHTML() }),
    editorProps: {
      attributes: { class: "document-body", spellcheck: "false" },
    },
  });
  useEffect(() => {
    if (editor) {
      editor.commands.setContent(activeDoc.content, { emitUpdate: false });
      setSelectedImage(null);
      setSummaryDraft(activeDoc.summary);
    }
  }, [activeDoc.id, editor]);
  const editorData = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            text: e.getText({ blockSeparator: "\n" }),
            json: e.getJSON(),
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            code: e.isActive("codeBlock"),
            highlight: e.isActive("highlight"),
            heading: e.isActive("heading", { level: 2 }),
            fontFamily: e.getAttributes("textStyle").fontFamily || "",
            fontSize: e.getAttributes("textStyle").fontSize || "",
            inTable: e.isActive("table"),
          }
        : null,
  });
  useEffect(() => {
    try {
      localStorage.setItem("shiftnotes.documents.v1", JSON.stringify(docs));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [docs]);
  useEffect(() => {
    try {
      localStorage.setItem("shiftnotes.brand.v1", JSON.stringify(brand));
    } catch {
      notify("Brand settings could not be saved.");
    }
  }, [brand]);
  useEffect(() => {
    localStorage.setItem("shiftnotes.active", activeDoc.id);
  }, [activeDoc.id]);
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        setModal(null);
        setMenu(false);
        setSelectedImage(null);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("document-search")?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        const doc = makeDocument();
        setDocs((p) => [doc, ...p]);
        setActiveId(doc.id);
        setFilter("All documents");
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        notify(
          storageError
            ? "Storage is full. Export a backup."
            : "All changes saved on this device",
        );
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [storageError]);
  const text = editorData?.text || "",
    ips = validIPs(text),
    wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const headings = (editorData?.json?.content || [])
    .filter((n) => n.type === "heading")
    .map((n) => ({
      level: n.attrs.level,
      text: n.content?.map((c) => c.text || "").join("") || "",
    }));
  const filtered = docs
    .filter(
      (d) =>
        (filter === "All documents" ||
          (filter === "Pinned" && d.pinned) ||
          d.folder === filter) &&
        `${d.title} ${d.content.replace(/<[^>]*>/g, " ")}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => b.updated - a.updated);
  const create = (template = "blank") => {
    const doc = makeDocument(
      ["Engineering", "Operations"].includes(filter) ? filter : "Engineering",
      template,
    );
    setDocs((p) => [doc, ...p]);
    setActiveId(doc.id);
    setModal(null);
    setFilter("All documents");
    setMobileNav(false);
  };
  const changeImage = (item) =>
    updateDoc({
      images: activeDoc.images.map((i) => (i.id === item.id ? item : i)),
    });
  async function addImage(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
        file.type,
      )
    ) {
      notify("Choose a PNG, JPEG, WebP, or GIF image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify("Please choose an image smaller than 5 MB.");
      return;
    }
    const src = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }).catch(() => null);
    if (!src) {
      notify("Could not read this image.");
      return;
    }
    const dimensions = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.naturalHeight / img.naturalWidth);
      img.onerror = () => resolve(0.6);
      img.src = src;
    });
    const item = {
      id: crypto.randomUUID(),
      src,
      aspect: dimensions,
      x: 54,
      y: Math.max(
        250,
        (paperRef.current?.querySelector(".tiptap")?.offsetHeight || 400) + 170,
      ),
      width: Math.min(400, (paperRef.current?.clientWidth || 680) - 108),
      caption: file.name.replace(/\.[^.]+$/, ""),
    };
    updateDoc({ images: [...activeDoc.images, item] });
    setSelectedImage(item.id);
    notify(
      "Image added. Drag it anywhere; use arrow keys for precise placement.",
    );
  }
  const downloadBackup = async () => {
    try {
      const referenceFiles = await backupReferenceFiles();
      const blob = new Blob(
          [
            JSON.stringify(
              { version: 2, documents: docs, brand, referenceFiles },
              null,
              2,
            ),
          ],
          { type: "application/json" },
        ),
        a = document.createElement("a");
      if (blob.size > 200 * 1024 * 1024)
        throw Error(
          "The workspace exceeds the 200 MB backup limit. Save copies of large references and remove unused stored files before retrying.",
        );
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = "SHIFTnotes-backup.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMenu(false);
      notify("Workspace backup downloaded");
    } catch (err) {
      notify(`Backup failed: ${err.message}`);
    }
  };
  const importBackup = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > 200 * 1024 * 1024)
        throw Error("Workspace backups can be up to 200 MB.");
      const backup = JSON.parse(await file.text());
      if (
        ![1, 2].includes(backup.version) ||
        !Array.isArray(backup.documents) ||
        !backup.documents.length ||
        !backup.documents.every(
          (d) =>
            typeof d.id === "string" &&
            typeof d.title === "string" &&
            typeof d.content === "string" &&
            validReferences(d.references) &&
            Array.isArray(d.images) &&
            d.images.every(
              (i) =>
                typeof i.src === "string" &&
                /^data:image\/(png|jpeg|gif|webp|svg\+xml)/.test(i.src) &&
                [i.x, i.y, i.width].every(Number.isFinite),
            ),
        )
      )
        throw Error();
      if (
        new Set(backup.documents.map((d) => d.id)).size !==
        backup.documents.length
      )
        throw Error("Duplicate document IDs in backup.");
      const restored = restoreReferenceFiles(backup.referenceFiles);
      const documentIds = new Map(
        backup.documents.map((d) => [d.id, crypto.randomUUID()]),
      );
      const imported = backup.documents.map((d) => ({
        ...d,
        id: documentIds.get(d.id),
        references: (d.references || []).map((ref) => ({
          ...ref,
          ...(ref.kind === "document"
            ? { documentId: documentIds.get(ref.documentId) || ref.documentId }
            : {}),
          ...(ref.kind === "stored"
            ? { fileId: restored.ids.get(ref.fileId) || ref.fileId }
            : {}),
        })),
        folder: ["Engineering", "Operations"].includes(d.folder)
          ? d.folder
          : "Engineering",
        summary: typeof d.summary === "string" ? d.summary : "",
        updated: Date.now(),
      }));
      await saveReferenceFiles(restored.files);
      const nextDocs = [...imported, ...docsRef.current];
      localStorage.setItem("shiftnotes.documents.v1", JSON.stringify(nextDocs));
      setDocs(nextDocs);
      setActiveId(imported[0].id);
      notify(`${imported.length} documents imported`);
    } catch {
      notify(
        "Could not import backup. Check its format and available storage.",
      );
    }
  };
  const doExport = async () => {
    setExporting(true);
    setSelectedImage(null);
    try {
      await document.fonts.ready;
      if (window.shiftDesktop) {
        const result = await window.shiftDesktop.exportPDF({
          title: activeDoc.title,
          brand,
        });
        if (result.canceled) return;
      } else {
        await (
          await import("./export")
        ).exportPDF(paperRef.current, activeDoc.title, brand);
      }
      notify("Your PDF is ready");
    } catch (err) {
      console.error(err);
      notify(
        "PDF export failed. Try Print / Save as PDF from the document menu.",
      );
    } finally {
      setExporting(false);
    }
  };
  const copy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      notify("Copied to clipboard");
    } catch {
      notify("Clipboard unavailable. Select the text and copy it manually.");
    }
  };
  const generateSummary = () => {
    const result = summarize(text);
    if (!result) {
      notify("Write a little more before creating a summary.");
      return;
    }
    setSummaryDraft(result);
    setPanel("summary");
    notify("Summary created locally. Review it before sharing.");
  };
  const imageBottom = Math.max(
    0,
    ...activeDoc.images.map((i) => i.y + i.width * (i.aspect || 0.5) + 45),
  );
  const paperHeight = Math.max(1090, imageBottom + 70);
  const bodyRect = paperRef.current
    ?.querySelector(".tiptap")
    ?.getBoundingClientRect();
  const paperRect = paperRef.current?.getBoundingClientRect();
  const summaryGap = Math.max(
    40,
    imageBottom -
      (bodyRect && paperRect ? bodyRect.bottom - paperRect.top : 800) +
      30,
  );
  return (
    <div
      className={`app ${window.shiftDesktop ? "is-desktop" : ""}`}
      style={{
        "--brand": brand.primary,
        "--brand-accent": brand.accent,
        "--body-font": brand.bodyFont || "DM Sans",
        "--heading-font": brand.headingFont || "Space Grotesk",
      }}
    >
      <aside className={`sidebar ${mobileNav ? "mobile-open" : ""}`}>
        <a
          className="logo"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setFilter("All documents");
          }}
        >
          <span className="logo-mark">
            <BookOpen size={21} />
          </span>
          SHIFT<span className="logo-light">notes</span>
          <span className="beta">BETA</span>
        </a>
        <div className="workspace-label">
          <span className="workspace-avatar">G</span>
          <div>
            My workspace<small>Personal workspace</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <button className="new-document" onClick={() => create()}>
          <Plus size={17} /> New document <span>Ctrl N</span>
        </button>
        <div className="search-field">
          <Search size={15} />
          <input
            id="document-search"
            aria-label="Search documents"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents…"
          />
          <kbd>Ctrl K</kbd>
        </div>
        <nav className="primary-nav">
          <button
            className={filter === "All documents" ? "selected" : ""}
            onClick={() => setFilter("All documents")}
          >
            <FileText size={16} />
            All documents<span>{docs.length}</span>
          </button>
          <button
            className={filter === "Pinned" ? "selected" : ""}
            onClick={() => setFilter("Pinned")}
          >
            <Pin size={15} />
            Pinned<span>{docs.filter((d) => d.pinned).length}</span>
          </button>
        </nav>
        <div className="section-label">
          COLLECTIONS<span>{2}</span>
        </div>
        <nav className="collection-nav">
          {["Engineering", "Operations"].map((name, i) => (
            <button
              key={name}
              className={filter === name ? "selected" : ""}
              onClick={() => setFilter(name)}
            >
              <Folder size={16} className={i ? "gold" : "green"} />
              {name}
              <span>{docs.filter((d) => d.folder === name).length}</span>
            </button>
          ))}
        </nav>
        <div className="section-label document-list-label">
          {search
            ? "SEARCH RESULTS"
            : filter === "All documents"
              ? "RECENT DOCUMENTS"
              : filter.toUpperCase()}
          <button
            aria-label="New from template"
            onClick={() => setModal("templates")}
          >
            <Plus size={15} />
          </button>
        </div>
        <div className="document-list">
          {filtered.map((d) => (
            <button
              key={d.id}
              className={`document-card ${activeDoc.id === d.id ? "current" : ""}`}
              onClick={() => {
                setActiveId(d.id);
                setMobileNav(false);
              }}
            >
              <div>
                <FileText size={15} />
                <span>{d.title}</span>
                {d.pinned && <Pin size={11} />}
              </div>
              <p>
                {d.content
                  .replace(/<[^>]+>/g, " ")
                  .replace(/&[^;]+;/g, " ")
                  .trim()
                  .slice(0, 66) || "A fresh page. Make it yours."}
              </p>
              <small>
                {d.folder}
                <span>·</span>
                {new Date(d.updated).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </small>
            </button>
          ))}
          {!filtered.length && (
            <div className="empty-list">
              <Search size={24} />
              <p>No documents here yet.</p>
              <button
                onClick={() => {
                  setSearch("");
                  setFilter("All documents");
                }}
              >
                Show all documents
              </button>
            </div>
          )}
        </div>
        <div className="sidebar-bottom">
          <button onClick={() => setModal("avtrack")}>
            <Upload size={16} />
            Import from AVTrack
            <ArrowUpRight size={14} />
          </button>
          <button onClick={() => setModal("templates")}>
            <LayoutTemplate size={16} />
            Document templates
            <ArrowUpRight size={14} />
          </button>
          <button onClick={() => setModal("brand")}>
            <Settings2 size={16} />
            Brand & export settings
          </button>
          <div className="profile">
            <span className="profile-avatar">G</span>
            <div>
              Gabriel<small>Local workspace</small>
            </div>
            <Button
              label="Help & keyboard shortcuts"
              onClick={() => setModal("help")}
            >
              <CircleHelp size={17} />
            </Button>
          </div>
        </div>
      </aside>
      <div className="main-workspace">
        <header className="topbar">
          <div className="breadcrumbs">
            <Button
              label="Toggle document list"
              className="mobile-toggle"
              onClick={() => setMobileNav(!mobileNav)}
            >
              <Menu size={19} />
            </Button>
            <Folder size={15} />
            <span>{activeDoc.folder}</span>
            <ChevronRight size={13} />
            <strong>{activeDoc.title}</strong>
          </div>
          <div className="topbar-actions">
            <span className={`save-status ${storageError ? "error" : ""}`}>
              <CheckCheck size={15} />
              {storageError
                ? "Storage full · export a backup"
                : "Saved on this device"}
            </span>
            <Button
              label="Toggle document details"
              active={!!panel}
              onClick={() => setPanel(panel ? null : "outline")}
            >
              <PanelRight size={18} />
            </Button>
            <span className="vertical-divider" />
            <button
              className="export-button"
              onClick={doExport}
              disabled={exporting}
            >
              <Download size={15} />
              {exporting ? "Exporting…" : "Export PDF"}
            </button>
            <div className="menu-anchor">
              <Button label="Document menu" onClick={() => setMenu(!menu)}>
                <MoreHorizontal size={20} />
              </Button>
              {menu && (
                <div className="dropdown">
                  <button
                    onClick={() => {
                      updateDoc({ pinned: !activeDoc.pinned });
                      setMenu(false);
                    }}
                  >
                    <Pin size={15} />
                    {activeDoc.pinned ? "Unpin document" : "Pin document"}
                  </button>
                  <button
                    onClick={() => {
                      setMenu(false);
                      setModal("document");
                    }}
                  >
                    <Folder size={15} />
                    Document settings
                  </button>
                  <button
                    onClick={() => {
                      setMenu(false);
                      setModal("print");
                    }}
                  >
                    <FileText size={15} />
                    Print / Save as PDF
                  </button>
                  <button onClick={downloadBackup}>
                    <Download size={15} />
                    Back up workspace
                  </button>
                  <button
                    onClick={() => {
                      importRef.current.click();
                      setMenu(false);
                    }}
                  >
                    <Upload size={15} />
                    Import backup
                  </button>
                  <button
                    className="danger"
                    onClick={() => {
                      setMenu(false);
                      setModal("delete");
                    }}
                  >
                    <Trash2 size={15} />
                    Delete document
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="editor-layout">
          <main className="writing-area">
            <div className="document-topline">
              <div>
                <span className="tiny-dot" /> YOUR IDEAS, WELL DOCUMENTED
              </div>
              <button onClick={generateSummary}>
                <Sparkles size={14} />
                Create summary
              </button>
            </div>
            <div className="toolbar" aria-label="Document formatting">
              {editor && (
                <>
                  <select
                    aria-label="Text style"
                    value={editorData?.heading ? "heading" : "paragraph"}
                    onChange={(e) =>
                      e.target.value === "heading"
                        ? editor
                            .chain()
                            .focus()
                            .toggleHeading({ level: 2 })
                            .run()
                        : editor.chain().focus().setParagraph().run()
                    }
                  >
                    <option value="paragraph">Normal text</option>
                    <option value="heading">Heading</option>
                  </select>
                  <span className="tool-divider" />
                  <Button
                    label="Bold"
                    active={editorData?.bold}
                    onClick={() => editor.chain().focus().toggleBold().run()}
                  >
                    <Bold size={16} />
                  </Button>
                  <Button
                    label="Italic"
                    active={editorData?.italic}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                  >
                    <Italic size={16} />
                  </Button>
                  <Button
                    label="Highlight"
                    active={editorData?.highlight}
                    onClick={() =>
                      editor.chain().focus().toggleHighlight().run()
                    }
                  >
                    <Highlighter size={16} />
                  </Button>
                  <span className="tool-divider" />
                  <Button
                    label="Bulleted list"
                    onClick={() =>
                      editor.chain().focus().toggleBulletList().run()
                    }
                  >
                    <List size={18} />
                  </Button>
                  <Button
                    label="Numbered list"
                    onClick={() =>
                      editor.chain().focus().toggleOrderedList().run()
                    }
                  >
                    <ListOrdered size={18} />
                  </Button>
                  <Button
                    label="Callout"
                    onClick={() =>
                      editor.chain().focus().toggleBlockquote().run()
                    }
                  >
                    <Quote size={16} />
                  </Button>
                  <span className="tool-divider" />
                  <Button
                    label="Insert link"
                    onClick={() => {
                      setLink(editor.getAttributes("link").href || "");
                      setModal("link");
                    }}
                  >
                    <Link2 size={17} />
                  </Button>
                  <Button
                    label="Insert tutorial step"
                    onClick={() => setModal("tutorial-step")}
                  >
                    <ListOrdered size={17} />
                  </Button>
                  <Button
                    label="Insert document reference"
                    onClick={() => setModal("reference")}
                  >
                    <BookOpen size={17} />
                  </Button>
                  <Button
                    label="Insert image"
                    onClick={() => fileRef.current.click()}
                  >
                    <ImagePlus size={17} />
                  </Button>
                  <Button
                    label="Insert code block"
                    active={editorData?.code}
                    onClick={() => {
                      setSnippet("");
                      setModal("code");
                    }}
                  >
                    <Code2 size={18} />
                  </Button>
                  <span className="toolbar-spacer" />
                  <Button
                    label="Undo"
                    onClick={() => editor.chain().focus().undo().run()}
                  >
                    <Undo2 size={16} />
                  </Button>
                  <Button
                    label="Redo"
                    onClick={() => editor.chain().focus().redo().run()}
                  >
                    <Redo2 size={16} />
                  </Button>
                </>
              )}
            </div>
            <TypographyToolbar
              editor={editor}
              data={editorData}
              onInsertTable={() => setModal("table")}
            />
            <div
              className="paper-scroll"
              onClick={(e) => {
                if (!e.target.closest(".floating-image"))
                  setSelectedImage(null);
              }}
            >
              <article
                ref={paperRef}
                data-brand-name={brand.name}
                className="paper"
                style={{ minHeight: paperHeight }}
              >
                <div className="paper-heading">
                  <div className="paper-meta">
                    <span className="document-tag">
                      <span />
                      {activeDoc.tag}
                    </span>
                    <span className="document-version">WORKING DOCUMENT</span>
                  </div>
                  <textarea
                    aria-label="Document title"
                    className="document-title"
                    value={activeDoc.title}
                    rows={activeDoc.title.length > 35 ? 2 : 1}
                    onChange={(e) => updateDoc({ title: e.target.value })}
                    placeholder="Untitled document"
                  />
                  <div className="document-byline">
                    <span className="author-dot">G</span>Gabriel
                    <span className="byline-dot">·</span>
                    <span>
                      {new Date(activeDoc.updated).toLocaleDateString(
                        undefined,
                        { month: "long", day: "numeric", year: "numeric" },
                      )}
                    </span>
                    <span className="byline-dot">·</span>
                    <span>
                      {Math.max(1, Math.ceil(wordCount / 200))} min read
                    </span>
                  </div>
                </div>
                <EditorContent
                  editor={editor}
                  onClickCapture={(event) => {
                    const link = event.target.closest("a[data-reference-id]");
                    if (!link) return;
                    event.preventDefault();
                    event.stopPropagation();
                    const reference = activeDoc.references?.find(
                      (ref) => ref.id === link.dataset.referenceId,
                    );
                    if (reference) {
                      setOpenedReference(reference);
                      setModal("reference-details");
                    } else
                      notify(
                        "This reference is missing. Attach or link it again.",
                      );
                  }}
                />
                {activeDoc.summary && (
                  <section
                    className="saved-summary"
                    style={{ marginTop: summaryGap }}
                  >
                    <div className="eyebrow">DOCUMENT SUMMARY</div>
                    {activeDoc.summary.split("\n\n").map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </section>
                )}
                {activeDoc.references?.length > 0 && (
                  <section
                    className="document-references"
                    style={{ marginTop: activeDoc.summary ? 24 : summaryGap }}
                  >
                    <h3>References</h3>
                    {activeDoc.references.map((ref) => (
                      <div key={ref.id}>
                        <button
                          onClick={() => {
                            setOpenedReference(ref);
                            setModal("reference-details");
                          }}
                        >
                          {ref.name}
                        </button>
                        <small>
                          {ref.kind === "path"
                            ? ref.path
                            : ref.kind === "stored"
                              ? "Stored reference file"
                              : "SHIFTnotes document"}
                        </small>
                      </div>
                    ))}
                  </section>
                )}
                {activeDoc.images.map((item) => (
                  <MovableImage
                    key={item.id}
                    item={item}
                    selected={selectedImage === item.id}
                    onSelect={setSelectedImage}
                    onChange={changeImage}
                    onDelete={() =>
                      updateDoc({
                        images: activeDoc.images.filter(
                          (i) => i.id !== item.id,
                        ),
                      })
                    }
                    paperRef={paperRef}
                  />
                ))}
                <div className="paper-bottom" data-export-hide>
                  <span>Made for the details that matter.</span>
                  <span>SHIFTnotes</span>
                </div>
              </article>
            </div>
            <footer className="editor-footer">
              <span>
                <span className="tiny-dot" />
                All changes{" "}
                {storageError ? "could not be saved" : "saved locally"}
              </span>
              <div>
                <span>{wordCount} words</span>
                <span>{text.length} characters</span>
                <span>100%</span>
              </div>
            </footer>
          </main>
          {panel && (
            <aside className="details-panel">
              <div className="panel-tabs">
                <button
                  className={panel === "outline" ? "selected" : ""}
                  onClick={() => setPanel("outline")}
                >
                  Document
                </button>
                <button
                  className={panel === "summary" ? "selected" : ""}
                  onClick={() => {
                    setPanel("summary");
                    setSummaryDraft(activeDoc.summary);
                  }}
                >
                  <Sparkles size={13} />
                  Summary
                </button>
              </div>
              {panel === "outline" ? (
                <>
                  <div className="details-section">
                    <div className="section-label">
                      ON THIS PAGE <AlignLeft size={14} />
                    </div>
                    <div className="outline">
                      {headings.length ? (
                        headings.map((h, i) => (
                          <button
                            key={i}
                            style={{ paddingLeft: h.level > 2 ? 22 : 12 }}
                            onClick={() => {
                              const el = paperRef.current.querySelectorAll(
                                ".tiptap h1,.tiptap h2,.tiptap h3,.tiptap h4",
                              )[i];
                              el?.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                              });
                            }}
                          >
                            <span className="outline-dot" />
                            {h.text || "Untitled section"}
                          </button>
                        ))
                      ) : (
                        <p className="muted">
                          Add headings to build your outline.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="details-section">
                    <div className="section-label">
                      TECHNICAL DETAILS <Code2 size={14} />
                    </div>
                    <div className="technical-count">
                      <span className="technical-icon">
                        <Network size={16} />
                      </span>
                      <div>
                        IP addresses
                        <small>{ips.length} unique addresses detected</small>
                      </div>
                    </div>
                    <div className="ip-list">
                      {ips.map((ip) => (
                        <button
                          key={ip}
                          onClick={() => copy(ip)}
                          title={`Copy ${ip}`}
                        >
                          <code>{ip}</code>
                          <Copy size={12} />
                        </button>
                      ))}
                      {!ips.length && (
                        <p className="muted">
                          IPv4 and IPv6 addresses appear here as you write.
                        </p>
                      )}
                    </div>
                    <div className="code-count">
                      <Code2 size={14} />
                      <span>
                        {
                          (editorData?.json?.content || []).filter(
                            (n) => n.type === "codeBlock",
                          ).length
                        }{" "}
                        code blocks
                      </span>
                      <span className="language-chip">XML / CODE</span>
                    </div>
                  </div>
                  <div className="details-section image-detail">
                    <div className="section-label">
                      IMAGE CANVAS <ImagePlus size={14} />
                    </div>
                    <p>
                      Drop the rigid layouts.
                      <br />
                      Move your images anywhere.
                    </p>
                    <button
                      className="outline-button"
                      onClick={() => fileRef.current.click()}
                    >
                      <Plus size={14} />
                      Add an image
                    </button>
                    {selectedImage && (
                      <>
                        <label className="small-label">
                          Image caption
                          <input
                            value={
                              activeDoc.images.find(
                                (i) => i.id === selectedImage,
                              )?.caption || ""
                            }
                            onChange={(e) =>
                              changeImage({
                                ...activeDoc.images.find(
                                  (i) => i.id === selectedImage,
                                ),
                                caption: e.target.value,
                              })
                            }
                          />
                        </label>
                        <p className="muted">
                          Use arrow keys to move the selected image.
                        </p>
                      </>
                    )}
                  </div>
                  <div className="export-card">
                    <div className="export-card-icon">
                      <FileText size={20} />
                      <span>PDF</span>
                    </div>
                    <h3>Ready to share.</h3>
                    <p>
                      Your document. Your brand.
                      <br />A polished PDF, every time.
                    </p>
                    <button onClick={() => setModal("brand")}>
                      Customize PDF style
                      <ArrowUpRight size={14} />
                    </button>
                    <div className="swatches">
                      <span style={{ background: brand.primary }} />
                      <span style={{ background: brand.accent }} />
                      <span style={{ background: "#f5f2ec" }} />
                      <small>{brand.name}</small>
                    </div>
                  </div>
                </>
              ) : (
                <div className="summary-panel">
                  <div className="summary-symbol">
                    <Sparkles size={24} />
                  </div>
                  <h3>The essentials, distilled.</h3>
                  <p>
                    Create a concise summary from your document. Runs on your
                    device, with no API key required.
                  </p>
                  <button className="primary-button" onClick={generateSummary}>
                    <Sparkles size={15} />
                    {summaryDraft ? "Regenerate summary" : "Generate summary"}
                  </button>
                  {(summaryDraft || activeDoc.summary) && (
                    <>
                      <label className="small-label">
                        REVIEW & EDIT
                        <textarea
                          aria-label="Document summary"
                          rows={13}
                          value={summaryDraft}
                          onChange={(e) => setSummaryDraft(e.target.value)}
                        />
                      </label>
                      <button
                        className="outline-button"
                        onClick={() => {
                          updateDoc({ summary: summaryDraft });
                          notify("Summary added to your document and PDF");
                        }}
                      >
                        <Plus size={14} />
                        Add to document
                      </button>
                      {activeDoc.summary && (
                        <button
                          className="text-button"
                          onClick={() => {
                            updateDoc({ summary: "" });
                            setSummaryDraft("");
                          }}
                        >
                          Remove saved summary
                        </button>
                      )}
                      <small>
                        Extractive summary · always review technical details.
                      </small>
                    </>
                  )}
                </div>
              )}
            </aside>
          )}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={addImage}
      />
      <input
        ref={importRef}
        type="file"
        accept="application/json"
        hidden
        onChange={importBackup}
      />
      {toast && (
        <div role="status" className="toast">
          <Check size={16} />
          {toast}
        </div>
      )}
      {modal === "avtrack" && (
        <Modal
          title="From AVTrack to your document"
          onClose={() => setModal(null)}
        >
          <React.Suspense fallback={<p className="muted">Loading importer…</p>}>
            <AvtrackImport
              notify={notify}
              onInsert={(nodes) =>
                editor
                  .chain()
                  .focus("end")
                  .insertContent([
                    ...(summaryGap > 40
                      ? [
                          {
                            type: "canvasSpacer",
                            attrs: { height: summaryGap },
                          },
                        ]
                      : []),
                    ...nodes,
                  ])
                  .run()
              }
            />
          </React.Suspense>
          <div className="modal-actions">
            <button className="primary-button" onClick={() => setModal(null)}>
              Done
            </button>
          </div>
        </Modal>
      )}
      {modal === "table" && (
        <Modal
          title="Give your details a little structure"
          onClose={() => setModal(null)}
        >
          <p className="modal-description">
            Create an editable table for equipment, IP plans, checklists, and
            technical specifications.
          </p>
          <div className="color-fields">
            <label className="field">
              Rows
              <input
                aria-label="Table rows"
                type="number"
                min="1"
                max="50"
                value={tableRows}
                onChange={(e) => setTableRows(e.target.value)}
              />
            </label>
            <label className="field">
              Columns
              <input
                aria-label="Table columns"
                type="number"
                min="1"
                max="12"
                value={tableCols}
                onChange={(e) => setTableCols(e.target.value)}
              />
            </label>
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={tableHeader}
              onChange={(e) => setTableHeader(e.target.checked)}
            />
            Include a header row
          </label>
          <div className="modal-actions">
            <button className="outline-button" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button
              className="primary-button"
              disabled={
                !Number.isInteger(+tableRows) ||
                +tableRows < 1 ||
                +tableRows > 50 ||
                !Number.isInteger(+tableCols) ||
                +tableCols < 1 ||
                +tableCols > 12
              }
              onClick={() => {
                editor
                  .chain()
                  .focus()
                  .insertTable({
                    rows: +tableRows,
                    cols: +tableCols,
                    withHeaderRow: tableHeader,
                  })
                  .run();
                setModal(null);
              }}
            >
              Create table
            </button>
          </div>
        </Modal>
      )}
      {modal === "code" && (
        <Modal title="A place for your code" onClose={() => setModal(null)}>
          <p className="modal-description">
            Readable, syntax-highlighted snippets for the technical details.
          </p>
          <label className="field">
            Language
            <select
              aria-label="Code language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {[
                "xml",
                "javascript",
                "typescript",
                "json",
                "bash",
                "python",
                "css",
                "plaintext",
              ].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Code
            <textarea
              className="code-input"
              aria-label="Code snippet"
              rows={9}
              placeholder="Paste your code here…"
              value={snippet}
              onChange={(e) => setSnippet(e.target.value)}
            />
          </label>
          <div className="modal-actions">
            <button className="outline-button" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button
              className="primary-button"
              disabled={!snippet.trim()}
              onClick={() => {
                editor
                  .chain()
                  .focus()
                  .insertContent([
                    {
                      type: "codeBlock",
                      attrs: { language },
                      content: [{ type: "text", text: snippet }],
                    },
                    { type: "paragraph" },
                  ])
                  .run();
                setModal(null);
              }}
            >
              <Code2 size={15} />
              Insert code
            </button>
          </div>
        </Modal>
      )}
      {modal === "tutorial-step" && (
        <Modal title="Add a tutorial step" onClose={() => setModal(null)}>
          <TutorialStepForm
            onInsert={(step) => {
              // A step is a top-level section; append without nesting inside an existing step.
              editor
                .chain()
                .focus()
                .insertContentAt(editor.state.doc.content.size, [
                  ...(summaryGap > 40
                    ? [{ type: "canvasSpacer", attrs: { height: summaryGap } }]
                    : []),
                  step,
                  { type: "paragraph" },
                ])
                .run();
              setModal(null);
              notify("Tutorial step added");
            }}
          />
        </Modal>
      )}
      {modal === "reference" && (
        <Modal title="Add a document reference" onClose={() => setModal(null)}>
          <ReferencePicker
            documents={docs}
            currentId={activeDoc.id}
            onInsert={(reference) => {
              if (editor.state.selection.empty)
                editor
                  .chain()
                  .focus()
                  .insertContent({
                    type: "text",
                    text: reference.name,
                    marks: [
                      { type: "referenceLink", attrs: { id: reference.id } },
                    ],
                  })
                  .run();
              else
                editor
                  .chain()
                  .focus()
                  .unsetMark("link")
                  .setMark("referenceLink", { id: reference.id })
                  .run();
              updateDoc({
                references: [...(activeDoc.references || []), reference],
              });
              setModal(null);
              notify("Reference linked");
            }}
          />
        </Modal>
      )}
      {modal === "reference-details" && openedReference && (
        <Modal title="Document reference" onClose={() => setModal(null)}>
          <ReferenceDetails
            reference={openedReference}
            documents={docs}
            onNavigate={(id) => {
              setActiveId(id);
              setModal(null);
            }}
          />
          <div className="modal-actions">
            <button className="outline-button" onClick={() => setModal(null)}>
              Close
            </button>
            <button
              onClick={() => {
                const content = editor.getJSON();
                const removeMark = (node) => {
                  if (node.marks)
                    node.marks = node.marks.filter(
                      (mark) =>
                        mark.type !== "referenceLink" ||
                        mark.attrs.id !== openedReference.id,
                    );
                  node.content?.forEach(removeMark);
                };
                removeMark(content);
                editor.commands.setContent(content);
                updateDoc({
                  references: (activeDoc.references || []).filter(
                    (ref) => ref.id !== openedReference.id,
                  ),
                  content: editor.getHTML(),
                });
                setModal(null);
              }}
            >
              Remove reference link
            </button>
          </div>
        </Modal>
      )}
      {modal === "link" && (
        <Modal title="Add a link" onClose={() => setModal(null)}>
          <label className="field">
            Destination URL
            <input
              autoFocus
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://example.com"
            />
          </label>
          <div className="modal-actions">
            <button
              className="outline-button"
              onClick={() => {
                editor.chain().focus().unsetLink().run();
                setModal(null);
              }}
            >
              Remove link
            </button>
            <button
              className="primary-button"
              disabled={!/^https?:\/\//i.test(link)}
              onClick={() => {
                if (editor.state.selection.empty)
                  editor
                    .chain()
                    .focus()
                    .insertContent({
                      type: "text",
                      text: link,
                      marks: [{ type: "link", attrs: { href: link } }],
                    })
                    .run();
                else editor.chain().focus().setLink({ href: link }).run();
                setModal(null);
              }}
            >
              Insert link
            </button>
          </div>
        </Modal>
      )}
      {modal === "print" && (
        <Modal title="Print document" onClose={() => setModal(null)}>
          <p className="modal-description">
            Choose your paper appearance. Export PDF always preserves the dark
            document design.
          </p>
          <div
            className="print-options"
            role="radiogroup"
            aria-label="Print background"
          >
            <label>
              <input
                type="radio"
                name="print-theme"
                value="white"
                checked={printTheme === "white"}
                onChange={() => setPrintTheme("white")}
              />
              <span>
                <strong>White paper</strong>
                <small>
                  Dark text on a white background. Recommended for physical
                  printing.
                </small>
              </span>
            </label>
            <label>
              <input
                type="radio"
                name="print-theme"
                value="dark"
                checked={printTheme === "dark"}
                onChange={() => setPrintTheme("dark")}
              />
              <span>
                <strong>Dark document</strong>
                <small>
                  Keep the charcoal background and document colors. Enable
                  background graphics in your browser’s print dialog.
                </small>
              </span>
            </label>
          </div>
          <div className="modal-actions">
            <button onClick={() => setModal(null)}>Cancel</button>
            <button
              className="primary"
              onClick={async () => {
                document.documentElement.dataset.printTheme = printTheme;
                try {
                  if (window.shiftDesktop) {
                    const result = await window.shiftDesktop.printDocument();
                    if (result.success) notify("Print job sent");
                    else if (!/cancel/i.test(result.reason || ""))
                      notify(
                        "Printing failed. Check your printer and try again.",
                      );
                  } else window.print();
                } catch {
                  notify("Printing failed. Check your printer and try again.");
                }
              }}
            >
              Continue to print
            </button>
          </div>
        </Modal>
      )}
      {modal === "brand" && (
        <Modal title="Make it your own" onClose={() => setModal(null)}>
          <p className="modal-description">
            Choose the identity used on your document and exported PDF. Presets
            use the fonts and colors found in your AVTrack project.
          </p>
          <label className="field">
            Brand preset
            <select
              aria-label="Brand preset"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value)
                  setBrand({ ...BRAND_PRESETS[e.target.value] });
              }}
            >
              <option value="">Choose a preset…</option>
              {Object.keys(BRAND_PRESETS).map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <div className="brand-preview" style={{ background: brand.primary }}>
            <BookOpen size={24} />
            <strong>{brand.name}</strong>
            <span style={{ background: brand.accent }} />
          </div>
          <label className="field">
            Brand name
            <input
              value={brand.name}
              maxLength={40}
              onChange={(e) => setBrand({ ...brand, name: e.target.value })}
            />
          </label>
          <div className="color-fields">
            <label className="field">
              Body font
              <select
                aria-label="Default document font"
                value={brand.bodyFont || "DM Sans"}
                onChange={(e) =>
                  setBrand({ ...brand, bodyFont: e.target.value })
                }
              >
                {FONT_FAMILIES.map((font) => (
                  <option key={font}>{font}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Heading font
              <select
                aria-label="Default heading font"
                value={brand.headingFont || "Space Grotesk"}
                onChange={(e) =>
                  setBrand({ ...brand, headingFont: e.target.value })
                }
              >
                {FONT_FAMILIES.map((font) => (
                  <option key={font}>{font}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="color-fields">
            <label className="field">
              Primary color
              <div>
                <input
                  aria-label="Primary brand color"
                  type="color"
                  value={brand.primary}
                  onChange={(e) =>
                    setBrand({ ...brand, primary: e.target.value })
                  }
                />
                <code>{brand.primary}</code>
              </div>
            </label>
            <label className="field">
              Accent color
              <div>
                <input
                  aria-label="Accent brand color"
                  type="color"
                  value={brand.accent}
                  onChange={(e) =>
                    setBrand({ ...brand, accent: e.target.value })
                  }
                />
                <code>{brand.accent}</code>
              </div>
            </label>
          </div>
          <div className="info-box">
            <Monitor size={18} />
            <p>
              PDFs include a branded header, accent rule, document title, and
              page numbers. Choose a brand preset or customize the colors and
              typography.
            </p>
          </div>
          <div className="modal-actions">
            <button
              className="outline-button"
              onClick={() => setBrand(DEFAULT_BRAND)}
            >
              Reset colors
            </button>
            <button
              className="primary-button"
              onClick={() => {
                setModal(null);
                notify("Brand settings saved");
              }}
            >
              <Check size={15} />
              Done
            </button>
          </div>
        </Modal>
      )}
      {modal === "templates" && (
        <Modal
          title="Start with a little structure"
          onClose={() => setModal(null)}
        >
          <div className="template-grid">
            <button onClick={() => create()}>
              <FileText />
              <h3>Blank document</h3>
              <p>A clean page for your next idea.</p>
            </button>
            <button onClick={() => create("guide")}>
              <ListOrdered />
              <h3>Step-by-step guide</h3>
              <p>Numbered instructions, screenshots, and reference links.</p>
            </button>
            <button onClick={() => create("handover")}>
              <LayoutTemplate />
              <h3>Shift handover</h3>
              <p>Overview, changes, issues, next steps.</p>
            </button>
          </div>
        </Modal>
      )}
      {modal === "document" && (
        <Modal title="Document settings" onClose={() => setModal(null)}>
          <label className="field">
            Collection
            <select
              value={activeDoc.folder}
              onChange={(e) => updateDoc({ folder: e.target.value })}
            >
              <option>Engineering</option>
              <option>Operations</option>
            </select>
          </label>
          <label className="field">
            Document label
            <input
              value={activeDoc.tag}
              onChange={(e) => updateDoc({ tag: e.target.value })}
              maxLength={35}
            />
          </label>
          <button className="primary-button" onClick={() => setModal(null)}>
            Done
          </button>
        </Modal>
      )}
      {modal === "delete" && (
        <Modal title="Delete this document?" onClose={() => setModal(null)}>
          <p className="modal-description">
            “{activeDoc.title}” will be removed from this device. Export a
            workspace backup first if you need to keep a copy.
          </p>
          <div className="modal-actions">
            <button className="outline-button" onClick={() => setModal(null)}>
              Keep document
            </button>
            <button
              className="danger-button"
              onClick={() => {
                const remaining = docs.filter((d) => d.id !== activeDoc.id);
                if (!remaining.length) remaining.push(makeDocument());
                setDocs(remaining);
                setActiveId(remaining[0].id);
                setModal(null);
                notify("Document deleted");
              }}
            >
              Delete document
            </button>
          </div>
        </Modal>
      )}
      {modal === "help" && (
        <Modal
          title="A quieter space for technical work"
          onClose={() => setModal(null)}
        >
          <div className="help-content">
            <p>
              Write with familiar formatting, add highlighted code blocks, and
              click detected IPv4 and IPv6 addresses to copy them.
            </p>
            <p>
              Select an image to drag it anywhere on the page. Resize it with
              the slider, change its caption in the details panel, or move it
              precisely with arrow keys. Images are free-positioned overlays;
              leave space in your text for them.
            </p>
            <p>
              Summaries select key sentences locally. Review and edit them
              before adding them to your document.
            </p>
            <p>
              Documents are saved locally on this computer. Use{" "}
              <strong>Document menu → Back up workspace</strong> to keep a
              portable copy. No account, server sync, or cloud storage is
              connected.
            </p>
            <div className="shortcut">
              <span>Find a document</span>
              <kbd>Ctrl + K</kbd>
            </div>
            <div className="shortcut">
              <span>Bold / italic</span>
              <kbd>Ctrl + B / I</kbd>
            </div>
            <div className="shortcut">
              <span>Undo</span>
              <kbd>Ctrl + Z</kbd>
            </div>
            <div className="shortcut">
              <span>Close a dialog</span>
              <kbd>Esc</kbd>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
