# Wormhole

A local-first desktop app for building fictional worlds: characters, lore, and the links between them, stored in files on your own machine. No accounts, no cloud.

Built with Tauri 2 (Rust) and React + TypeScript, with SQLite for storage.

## Features

- **Worlds as files.** Each world is a single self-contained `.wormhole` file (a SQLite database) in a storage folder you pick. Images are stored inside the file, so you can copy a world to another machine and it still works. The world index remembers where you left off in each world and offers to resume there.
- **Overview.** Each world has a summary card, character and document counts, and one relationship graph of characters and lore that you can pan and zoom. You can group related entities into shared nodes, either by hand or by detecting them from shared tags.
- **Character Codex.** Each character has a card and a dossier:
  - The card front is a fixed 3×7 grid of blocks you drag into place.
  - The dossier has tabbed sections in prose, card, timeline, and key-value layouts, and you can convert a section from one layout to another.
  - Characters can be organised into shelves, each with an optional icon, and the list can be sorted, filtered by tag, and reordered by dragging.
- **Lore Archive.** Rich-text documents (TipTap) in nested folders you can drag to reorder. Each document has a status (stub, draft, WIP, or done), a live word count, and a panel of its linked records.
- **Read Mode.** Lore is shown as a library of books. It supports continuous and paginated layouts, a table of contents, cross-document "next page" links, bookmarks, and read tracking.
- **Typography.** 10 bundled open-licence font families, so no web fonts are needed. Fonts can be set per world for the Codex and Lore, and per document for Lore. The editor toolbar has font, size, colour, and alignment controls.
- **Entity linking.** Characters and lore documents can link to each other. Type `[[` in the editor to get autocomplete for inline links. Clicking a link opens a peek panel, so you can preview the record without leaving the page. Links to deleted records are flagged, and a repair menu helps fix them.
- **Search.** Press Ctrl+K from any tab to search character fields and the titles and content of lore documents.
- **Recycle bins.** The Codex and Lore Archive each have a bin. Deletes are soft and can be restored, and anything in a bin for more than 24 hours is purged when the app starts.
- **Dark and light themes**, plus a one-click example world to explore.

## Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri 2 (Rust backend, system webview) |
| Frontend | React 19, TypeScript, Vite 7, React Router |
| State | Zustand |
| Storage | SQLite via `rusqlite` (bundled), with versioned migrations |
| Rich text | TipTap (ProseMirror); content stored as TipTap JSON |
| Graphs | `d3-zoom` / `d3-selection` for pan and zoom, custom deterministic radial layout |
| Settings | Tauri Store plugin |

## Architecture

The frontend is only a view layer. All data access goes through Tauri commands implemented in Rust:

```
React component
  -> typed wrapper in src/lib/commands.ts
    -> Tauri invoke (IPC)
      -> #[tauri::command] in src-tauri/src/commands/<domain>.rs
        -> rusqlite -> registry.db or the open .wormhole file
```

- **Two kinds of database.** `registry.db` lives in the OS app-data directory. It records where world files are and caches their title, summary, and cover. It never stores world content: characters, lore, links, reading progress, and image assets all live in that world's own `.wormhole` file.
- **One open world at a time.** `AppDatabase` (`src-tauri/src/db.rs`) keeps the registry connection open at all times and swaps in the active world's connection when you open a world.
- **Migrations.** The registry (v3) and world (v17) schemas have separate version tracks. Most steps are SQL files under `src-tauri/src/migrations/`. One step is written in Rust: it rewrites stored rich-text JSON and has unit tests. Migrations run automatically when a database is opened.
- **Commands.** 80 commands, grouped by domain: worlds, assets, graph, characters, shelves, character blocks and sections, lore, links, and search. All are registered in `src-tauri/src/lib.rs`.

### Repository layout

```
src/                 React frontend
  features/          Top-level screens: worlds, characters, lore (incl. read/), atlas placeholder
  components/        Shared UI: editor, linking, typography, graph, lore, characters, common
  lib/               Typed command wrappers, typography engine, font catalog, graph layout
  state/store.ts     Zustand store
src-tauri/           Rust backend (commands, db, migrations)
Initial-Specs/       V1 specs (archived) and IMPLEMENTED.md, a summary of what shipped
references/          Vision documents and the Atlas rebuild blueprint
prototypes/          Standalone HTML prototypes for the Atlas redesign
scripts/             Font bundling helper
```

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) and npm
- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- The system dependencies for Tauri 2 on your OS. See the [Tauri prerequisites guide](https://tauri.app/start/prerequisites/). On Linux, this includes WebKitGTK.

### Run in development

```bash
git clone https://github.com/kin-kkoy/wormhole.git
cd wormhole
npm install
npm run tauri dev
```

This starts the Vite dev server on `http://localhost:1420` and opens the desktop window. On first launch, the app asks you to choose a storage folder for your world files, or to use the default one.

### Build and test

```bash
npm run tauri build                                  # release bundle -> src-tauri/target/release/bundle/
cargo test --manifest-path src-tauri/Cargo.toml     # Rust unit tests
```

## Project status

Version `0.1.0`. This is a personal project, developed on Linux.

- **Shipped (V1):** world management, Overview, Character Codex, Lore Archive with Read Mode, entity linking and the peek panel, search, typography, and recycle bins. `Initial-Specs/IMPLEMENTED.md` summarises what shipped and where it differs from the original specs.
- **Atlas Canvas (being redesigned):** the first map system (a 2D canvas, then a 3D terrain version) was built and then removed for a ground-up redesign. For now, the Atlas tab shows an "In Development" placeholder. The rebuild is based on `references/atlas-2d-foundation.md` and the prototypes in `prototypes/`.
- **Testing:** there are Rust unit tests for the migration logic and no frontend test suite yet.
