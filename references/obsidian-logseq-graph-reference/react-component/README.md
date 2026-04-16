# React + Tauri Markdown Graph Component

This folder contains an app-ready `MarkdownGraphView` component for a future React + TypeScript + Tauri app.

If another AI or future contributor needs a fast handoff, read [FOR_AI_READERS.md](./FOR_AI_READERS.md) first.

What it is built for:
- markdown documents, not TypeScript source files
- internal wiki links such as `[[Page Name]]`
- internal markdown file links such as `[Read more](../notes/roadmap.md)`
- unresolved links appearing as graph nodes
- Obsidian-like graph behavior and controls

## Files

- `MarkdownGraphView.tsx`: the React component
- `MarkdownGraphView.css`: component styles
- `markdown-graph.ts`: markdown parsing and graph-model building
- `types.ts`: exported TypeScript types
- `index.ts`: barrel export
- `FOR_AI_READERS.md`: plain-language explanation of purpose, portability, and integration

## Document Shape

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

The component expects a list of markdown documents already loaded by the host app. In Tauri, that usually means:

1. Read markdown files from the vault directory on the Rust side.
2. Return them to the frontend with `invoke`.
3. Pass the resulting array into `MarkdownGraphView`.

If the app later stores note metadata in SQLite, that is still fine. The graph component only needs the final `MarkdownDocument[]` input.

## Minimal Usage

```tsx
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  MarkdownGraphView,
  type MarkdownDocument,
} from "./components/graph-view";

export function NotesWorkspace() {
  const [documents, setDocuments] = useState<MarkdownDocument[]>([]);

  useEffect(() => {
    invoke<MarkdownDocument[]>("load_markdown_documents").then(setDocuments);
  }, []);

  return (
    <MarkdownGraphView
      documents={documents}
      onSelectNode={({ document, node }) => {
        console.log("selected graph node", node, document);
      }}
      onCreateUnresolved={({ label }) => {
        console.log("create note for unresolved link", label);
      }}
    />
  );
}
```

## Suggested Future Location

Once the actual app scaffold exists, move this folder into something like:

```txt
src/components/graph-view/
```

Then import it from there and connect it to your note-loading and note-opening flow.

## Current Limits

- no local graph mode yet
- no advanced Obsidian search syntax yet
- no persisted node positions yet
- no viewport save/restore yet
- no clustering or virtualization for very large vaults yet

Those are the next logical production improvements once the app structure is in place.
