# AI Handoff: Markdown Graph View

This folder contains a portable React + TypeScript graph-view module for markdown-based note apps.

If you are an AI reading this later, the most important point is:

- this graph is for markdown documents, not for source-code dependency graphs
- the graph structure is derived from links inside markdown content
- the component is meant to be dropped into a React app, including a future Tauri app

## What This Component Is For

Use this when the app has a vault, workspace, or folder of markdown notes and needs an Obsidian-like graph view.

The component visualizes relationships between notes by parsing:

- wiki links like `[[Project Roadmap]]`
- wiki links with aliases like `[[Project Roadmap|Roadmap]]`
- internal markdown links like `[Roadmap](../notes/project-roadmap.md)`

If a note links to another note that does not exist yet, the graph still creates a node for it as an unresolved link target.

## Why It Is Portable

This module is portable because it does not depend on:

- Tauri-specific APIs
- SQLite-specific APIs
- file-system access inside the component
- a particular app router or app state library
- a specific note editor implementation

Instead, it only depends on React and a plain array of documents:

```ts
MarkdownDocument[]
```

That means any host app can use it as long as the host app loads markdown notes first and passes them in.

Examples of valid hosts:

- React + Tauri app reading `.md` files from disk
- React app loading notes from SQLite
- React app loading notes from a remote API

The graph component does not care where the markdown came from. It only cares about the final document list.

## Expected Input

The core input shape is:

```ts
type MarkdownDocument = {
  path: string;
  content: string;
  title?: string;
  aliases?: string[];
  createdAt?: string | number | Date | null;
  updatedAt?: string | number | Date | null;
  tags?: string[];
};
```

Meaning of the important fields:

- `path`: unique note identity, usually the vault-relative file path like `notes/project-roadmap.md`
- `content`: raw markdown text used for parsing links
- `title`: optional display label; if missing, the filename is used
- `aliases`: optional alternate names that help wiki links resolve
- `createdAt`: optional metadata used for ordering or future graph features
- `tags`: optional metadata used for grouping or coloring

## How The Graph Works

High-level flow:

1. The host app loads markdown documents.
2. `markdown-graph.ts` parses links out of each document’s `content`.
3. A graph model is built:
   - notes become nodes
   - links become edges
   - missing targets become unresolved nodes
4. `MarkdownGraphView.tsx` renders the graph on a canvas.
5. A force simulation spaces nodes apart and pulls linked nodes together.
6. The React UI exposes controls similar to Obsidian:
   - filters
   - groups
   - display settings
   - force settings

## Main Files

- `MarkdownGraphView.tsx`
  The actual React component and canvas interaction layer.

- `markdown-graph.ts`
  Pure graph-building logic. This is the file to modify if link parsing, node creation, or edge generation changes.

- `types.ts`
  Shared public types for the host app and the graph module.

- `MarkdownGraphView.css`
  Component styling for the Obsidian-like layout and controls.

- `index.ts`
  Barrel export for clean imports.

## How To Use It In A Future Tauri App

Recommended host flow:

1. Rust/Tauri reads markdown files from the vault directory.
2. Rust returns a `MarkdownDocument[]` to the frontend via `invoke`.
3. React stores those documents in state.
4. React renders:

```tsx
<MarkdownGraphView documents={documents} />
```

Optional callbacks:

- `onSelectNode`
  Use this when clicking a node should open the note in the editor pane.

- `onCreateUnresolved`
  Use this when clicking “Create file” on an unresolved node should create a real markdown note.

## What To Change If The App Evolves

If the app later uses SQLite:

- keep using this component
- load notes from SQLite instead of reading files directly
- convert database rows into `MarkdownDocument[]`
- pass that array into the component

If the app later supports note aliases or frontmatter:

- map those values into `aliases`, `title`, or `tags`
- extend `markdown-graph.ts` if new link-resolution rules are needed

If the app later needs local graph mode:

- add a mode in `markdown-graph.ts` that filters visible nodes around one selected note
- keep `MarkdownGraphView.tsx` as the rendering shell

## What This Component Does Not Do Yet

- no persistence of node positions
- no saved viewport state
- no advanced Obsidian search syntax
- no local-graph-only mode
- no large-vault optimization yet

## If You Are Another AI Modifying This

Start here:

1. Read `types.ts` to understand the public API.
2. Read `markdown-graph.ts` to understand how notes become nodes and edges.
3. Read `MarkdownGraphView.tsx` to understand rendering and interactions.
4. Keep the component input as `MarkdownDocument[]` unless there is a strong reason to change the contract.
5. Prefer extending parsing and filtering logic in `markdown-graph.ts` rather than mixing parsing rules into the React UI.

The design intent is:

- Obsidian-like graph behavior
- markdown-first data model
- reusable React component
- minimal coupling to the rest of the app
