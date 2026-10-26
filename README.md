# SHIFTnotes

A standalone, offline Windows writing app for technical documents. It combines a familiar notes editor with code, free-positioned images, tables, AVTrack imports, and branded PDF export.

## Windows: run the app

Download `SHIFTnotes-1.0.0-Windows-x64.exe` from the **SHIFTnotes-Windows** artifact in this repository's [Windows build workflow](https://github.com/gabriewlw/SHIFTnotes/actions/workflows/windows.yml). Extract the downloaded artifact ZIP, then double-click the EXE. No browser, server, Node.js installation, or administrator access is required. The portable executable extracts its bundled runtime when it starts.

Targets **Windows 10/11 x64**. This initial build is unsigned; Windows may show an unknown-publisher warning. Only run a build from a source you trust. Documents are stored under the current Windows user's application profile, not alongside the EXE. Moving the EXE does not move your documents. Back up your workspace before changing computers or deleting application data.

## Writing tools

- Rich text, headings, lists, callouts, highlights, links, and undo/redo.
- Font family and size controls for selected text or subsequent typing. Bundled free fonts: DM Sans, Space Grotesk, JetBrains Mono, Inter, Roboto, Open Sans, Lato, Merriweather, and Manrope. Fonts work offline and retain their upstream open licenses.
- **Brand & export settings** includes AVTrack and BroadcastGab presets, customizable colors, and default document/heading fonts. The project fonts and dark charcoal/red styling were verified against AVTrack's bundled BroadcastGab reference; no project logos are included.
- Insert tables with a header row, add/remove rows and columns, resize columns, merge/split selected cells, and edit values directly.
- Syntax-highlighted XML, JavaScript, TypeScript, JSON, Bash, Python, CSS, and plain text blocks.
- IPv4, IPv6, and CIDR highlighting, plus a copyable address inspector.
- PNG/JPEG/GIF/WebP uploads up to 5 MB per image. Select and drag to position; use arrow keys to move by 5 pixels. Resize with the slider and edit captions in the inspector. Images are overlays: leave space in your text. Positions are relative to the document rather than text anchors.
- Local, editable extractive summaries. These select key sentences; they do not call an AI service. Review technical details before inserting a summary into the document.
- Collections, pins, full-document search, outline navigation, and blank/handover templates.
- Native Windows PDF export with a save dialog, selectable text, embedded document fonts, brand headers, footers, and page numbers. Review pagination before sharing longer documents or layouts containing free-positioned images.
- Local autosave and portable JSON workspace backups/imports. Original attachments are retained in workspace backups; PDF reports include their filenames, not embedded file bytes.

## AVTrack integration

Choose **Import from AVTrack**. Review a dataset, select columns, filter records, and choose a row range before inserting an editable snapshot table. Imports do not connect to or modify AVTrack's live database.

| AVTrack format                                  | Recommended use                                                                | SHIFTnotes behavior                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| CSV                                             | A selected device/IP or channel list                                           | Editable table; mixed device/channel exports are separated                                              |
| XLSX                                            | Several lists, named inventories, or custom columns                            | Select a worksheet, then insert an editable table                                                       |
| Complete ZIP / JSON backup                      | Devices, IPTV, named inventories, recovery metadata, saved configuration files | Read-only preview, schema checks, SHA-256 verification when supplied, selectable tables, original files |
| CSV report ZIP                                  | Full report bundle from AVTrack                                                | Select a report, then insert an editable table                                                          |
| Individual XML / JSON / CFG / INI / text backup | Configuration details                                                          | Insert readable UTF-8 content as code or attach the original bytes                                      |
| PDF or proprietary/binary backup                | Reference material                                                             | Attach or save the original; no lossy attempt to reconstruct editable tables                            |

Complete-backup envelope version 1 and data schemas 1–2 are supported, including legacy v0.0.186–188 fixtures. Newer unknown schemas and checksum mismatches are rejected without changing documents. This is a documentation importer, **not** an AVTrack database restore tool. Audit/history tables remain in the source backup; the importer exposes documentation-relevant records only.

Import limits: 200 MB compressed input and uncompressed archive contents, 25,000 rows/100 columns per workbook sheet, 500 rows/12 selected columns per inserted table, 250 KB for code previews, and 5 MB per original attachment. Insert successive ranges for long lists. Spreadsheet formulas are treated as literal text and never evaluated. Imported records include a source filename and import date; they do not update automatically when AVTrack changes.

## Dark documents and printing

The workspace and documents use the AVTrack / BroadcastGab charcoal and red palette, with DM Sans body text, Space Grotesk headings, and JetBrains Mono code/IP addresses. Brand presets remain available in **Brand & export settings**.

**Export PDF** preserves the dark document background across the whole PDF page, including page margins. For physical printing, open **Document menu → Print / Save as PDF** or press **Ctrl/Cmd+P**. Choose **White paper** (the default) for dark text on white paper, or **Dark document** to retain the document colors. In browser print dialogs, enable background graphics for dark printing. Printing does not change the editing theme or the appearance of subsequent PDF exports.

## Local data

The initial version uses the embedded browser's local storage, shared by windows of the app on the same Windows user profile. There is no server, account, cloud synchronization, or network requirement for writing. Storage quota errors are shown; image/attachment-heavy workspaces can exhaust local storage. Use **Document menu → Back up workspace** regularly. Backup imports are additive.

The included example documents are editable demonstrations. Replacing the application build does not intentionally reset saved documents. This release has no automatic revision history or crash-recovery journal beyond local autosave; those are prioritized in [FEATURE_ROADMAP.md](FEATURE_ROADMAP.md).

## Build on Windows

Install Node.js 24 LTS and Git, then run PowerShell in the checkout:

```powershell
npm ci
npm run desktop
```

Build the portable EXE:

```powershell
npm run desktop:build
```

Output: `release/SHIFTnotes-1.0.0-Windows-x64.exe`. `scripts/stage-desktop.mjs` packages only the bundled UI and Electron entry points; no development dependencies are shipped as application modules.

The GitHub workflow builds a Windows artifact on pushes to `main`, version tags, or manual runs. It runs import compatibility and native desktop smoke tests before packaging. No release is automatically published.

## Development and checks

```sh
npm run dev          # optional browser development mode
npm run build
npm run test:imports # AVTrack historical formats, checksums, ZIP, XLSX, literal formulas
npm test             # Chromium UI tests
npm run test:desktop # native Electron startup, PDF export, and restart persistence
```

Browser tests use `/usr/bin/chromium` by default; set `CHROMIUM_PATH` for another Chromium executable. The desktop smoke test uses Electron's bundled runtime on Windows and headless Electron on Linux. Linux cloud builds can set writable `XDG_CACHE_HOME`, `electron_config_cache`, and `ELECTRON_BUILDER_CACHE` paths. Keep the supplied network proxy and TLS verification enabled.

Browser-mode PDF downloads use rasterization to preserve layout. Use the Windows app or **Print / Save as PDF** for selectable text. No API keys are needed.

## Reference provenance

AVTrack formats, fonts, color tokens, and synthetic compatibility fixtures were inspected at commit `3da366b41b25c3148994193101acc41b3b058121` of [gabriewlw/avtrack](https://github.com/gabriewlw/avtrack). The fixture files in `tests/fixtures/` are synthetic examples from that project, not customer backup data. No changes were made to AVTrack.

## Document references

Select words in a document and choose **Insert document reference** in the toolbar. With no selection, the reference name is inserted at the cursor. Choose:

- **SHIFTnotes document** to link an older handover, SOP, or other note. Click its inline link or its entry in the document's **References** section, then **Open document**.
- **Stored file** to upload a manual, spreadsheet, or reference document (up to 20 MB each), or reuse a previously stored file. Copies live in the app's local file storage and are included in workspace backups. **Save a copy** retrieves the original bytes. In the desktop app, **Open in default app** opens a temporary copy; changes made in another app do not replace the stored reference.
- **Local file path** to point to an original file without copying it. The desktop app offers **Browse files** and **Open linked file** for supported document types. Browser mode provides the path for copying. Moving or deleting the original breaks the link; backups preserve the path, not its contents.

Reference files are not embedded in exported PDFs. The PDF includes the reference names and, for path references, their paths. Workspace backup format 2 includes stored files and preserves links between imported documents; older format-1 backups can still be imported. Backups up to 200 MB are supported. Stored files persist separately from document text; clearing app/browser data removes both unless backed up.

## Step-by-step guides

Choose **Document templates → Step-by-step guide**, or use **Insert tutorial step** in any document. Give each step a title and add instructions, a screenshot/image, or both. PNG, JPEG, GIF, and WebP images up to 5 MB are supported, with optional captions. Steps append in order and number automatically; edit their headings and instructions directly on the page. Step images remain in the document flow beside the instructions, and are preserved in workspace backups, dark PDF exports, and white-background printing. Large images still count toward the editor's local document-storage quota; check the save status and keep backups.
