# Packet 5 — Lore Archive Build Packet

> **Status:** Built (V1) + Read Mode. Folder hierarchy, document CRUD, TipTap-based body editor, inline cross-system links, paginated and continuous readers, paper-styled tokens, cross-doc next-page navigation. Pending **Packet 10** for lore-side typography popover, per-document font defaults, and expanded inline toolbar (color, alignment, underline).

## 1. Purpose of this packet
This packet defines the Lore Archive system:
- folder model
- document model
- editor behavior
- linking behavior
- scope limits

## 2. System definition
Lore Archive is the longform writing and note system for Wormhole.

It stores:
- lore pages
- chapters
- fragments
- summaries
- diary-like writing
- notes tied to the world

## 3. System role inside Wormhole
Lore Archive is where the world’s longform content lives.

It must feel flexible enough for real writing, while staying clearly connected to the app’s structured entities.

## 4. Important boundary
Lore Archive is **not** the source of truth for the app’s structured state.

It is content linked to structured records.
Do not treat the archive as the hidden storage layer for worlds, characters, or map entities.

## 5. V1 scope
### Included
- folder tree
- create folder
- rename folder
- delete folder
- create document
- rename document
- delete document
- edit document content
- save document content
- linked records panel
- document-to-document links in markdown-style text

### Excluded
- graph view
- plugin architecture
- full Obsidian clone behavior
- advanced WYSIWYG editor
- collaborative editing
- workspace docking complexity

## 6. Data model
Use:
- `lore_folders`
- `lore_documents`

### lore_folders
- id
- world_id
- parent_folder_id nullable
- title
- sort_order
- created_at
- updated_at
- deleted_at nullable — for recycle bin soft-delete

### lore_documents
- id
- world_id
- folder_id nullable
- title
- content (JSON — TipTap/ProseMirror document tree, not raw text)
- created_at
- updated_at
- deleted_at nullable — for recycle bin soft-delete

## 7. Folder tree behavior
The folder tree should:
- be understandable
- support nesting up to **5 levels** deep
- support drag-and-drop reorganization: reorder siblings, or move a folder to a different parent
- circular hierarchies are prevented by the backend (a folder may not be moved into its own descendant)
- moving a folder does not move its documents (documents stay in their original folder)

Folders are organizational containers, not a substitute for world/entity structure.

## 8. Document editor
The lore document editor is a **rich text WYSIWYG editor** based on TipTap (ProseMirror).

The editor renders formatting as the user types — headings appear as headings, bold appears bold, lists appear as lists. The user does not see raw markdown syntax.

Requirements:
- stable editing with undo/redo (Ctrl+Z / Ctrl+Shift+Z)
- save/reload
- good readability
- clean, calm writing surface — not crowded with toolbars or formatting controls

The editor stores content as a **JSON document tree** (TipTap/ProseMirror native format), not as a raw markdown string.

## 9. Rich text capabilities
The editor must support:
- headings (H1, H2, H3)
- paragraphs
- bold, italic
- bullet lists, numbered lists
- inline links to other records (see section 10)
- horizontal rules
- blockquotes

Not required in V1:
- tables
- embedded images within the document body
- code blocks
- footnotes

## 10. Inline links (Obsidian-style)
Documents support `[[inline links]]` to other records in the world.

### Behavior
1. User types `[[`
2. An autocomplete dropdown appears showing matching records (characters, map entities, lore documents) from the current world
3. The dropdown filters as the user continues typing
4. User selects a record or presses Escape to dismiss
5. The link is stored as a structured node in the document JSON and renders as a clickable reference

### Rules
- The autocomplete must not block typing — the user can freely type through it
- Clicking an inline link opens a **read-only peek panel** on the right side (see UX packet for peek behavior)
- Links only search within the current world
- This is the same inline link system described in Core Build Packet section 19 — reuse the same component

## 11. Explicit linked records
Each lore document must be able to link explicitly to:
- characters
- map entities

These links should appear in a **linked records panel**.

This explicit panel matters more than fancy inline parsing.

## 12. Lore Archive UI layout
Recommended layout:
- left: folder tree
- center: document editor/view
- right: linked records panel

This is an internal system layout, not the primary app nav.

## 13. Create/edit flows
### Folder
- create
- rename
- delete

### Document
- create
- rename
- edit content
- delete
- assign/move to folder if practical

## 14. Deletion behavior
### Deleting a lore document
- ask for confirmation
- soft-delete the document (set `deleted_at`) and soft-delete related entity links in the same transaction
- document moves to per-world recycle bin, recoverable for 24 hours

### Deleting a folder
- ask for confirmation with a warning: "This folder contains X documents. They will be moved to root."
- soft-delete the folder (set `deleted_at`)
- documents inside the folder are **NOT deleted** — they are moved to the root level (`folder_id` set to NULL)
- the folder itself goes to the recycle bin; restoring it does not re-adopt its former documents

## 15. Scope warnings
Do not add to Lore Archive:
- transclusion (embedding one document inside another)
- automatic backlinks sidebar
- graph visualization of document connections
- templating or snippet system
- scheduled or recurring notes

Lore Archive is a folder-tree document editor, not a knowledge management system. It is one of the three systems, not the whole product.

## 16. Acceptance criteria
Lore Archive is acceptable when the user can:
- create folders
- create documents
- edit/save documents
- rename/delete folders and docs
- see linked characters/map entities from a document
- reopen the app and find lore structure and content intact
