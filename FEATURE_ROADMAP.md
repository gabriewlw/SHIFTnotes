# Recommended next features

These are recommendations, not features claimed to be implemented.

| Priority | Feature                                     | Why it fits technical writing                                                                                              |
| -------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1        | Revision history and crash recovery         | Recover overwritten configurations, text, and images; compare revisions before restoring                                   |
| 1        | Portable project files                      | One document plus its images and original backups, independent of the Windows user profile                                 |
| 1        | Image annotation and redaction              | Label ports, trace signal flow, add numbered callouts, conceal sensitive details                                           |
| 1        | PDF table of contents and figure references | Keep long installation guides navigable and references correct as sections move                                            |
| 2        | Internal links and backlinks                | Connect a device guide, incident report, network plan, and related handover                                                |
| 2        | Reusable snippet library                    | Insert tested XML, commands, warnings, and standard procedures consistently                                                |
| 2        | Side-by-side document/code comparison       | Check exactly what changed between configuration captures or document revisions                                            |
| 2        | Searchable attachments / OCR                | Find text inside imported PDFs and screenshot-based evidence                                                               |
| 2        | Optional sensitive-data review              | Flag likely credentials for review before PDF export, with explicit false-positive controls                                |
| 3        | AVTrack refresh and reconciliation          | Compare a new export with a saved snapshot; show differences before applying them                                          |
| 3        | Optional encrypted sync                     | Share documents across machines without losing offline access; requires an explicit storage and conflict-resolution design |

## Research and design references

- [Joplin's official project documentation](https://github.com/laurent22/joplin/blob/dev/README.md) describes searchable notebooks, attachment-aware import/export, and optional encrypted synchronization. For SHIFTnotes, portable backups and dependable search should come before synchronization.
- [Obsidian's official Backlinks documentation](https://github.com/obsidianmd/obsidian-help/blob/master/en/Plugins/Backlinks.md) explains linked and unlinked mentions. This is useful for relationships between technical procedures, devices, and incident records.
- [AVTrack export implementation](https://github.com/gabriewlw/avtrack/blob/main/exports.py) and [complete-backup compatibility policy](https://github.com/gabriewlw/avtrack/blob/main/docs/backup-compatibility.md) inform the existing read-only import design. Structured CSV/XLSX is preferred to reverse-engineering a PDF; complete ZIP/JSON preserves the file associations required for configuration records.
- [AVTrack font documentation](https://github.com/gabriewlw/avtrack/blob/main/static/fonts/README.md) identifies Space Grotesk, DM Sans, and JetBrains Mono as the shared BroadcastGab/AVTrack typography.

This roadmap prioritizes durable data and practical technical documentation over adding unrelated note-taking features.
