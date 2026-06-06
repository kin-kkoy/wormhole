# Packet 10 — Typography v2

> **Status:** Spec draft, 2026-04-26.
>
> Builds on the v1 typography work shipped in the Character Codex polish pass:
> - Per-world Character typography popover (gear icon → Headings / Prose / Labels / KV Values)
> - Bundled fonts: Cormorant Garamond, Crimson Pro, Inter (plus system serif/sans fallbacks)
> - Inline font + size picker (TipTap bubble menu) on every rich-text field
>
> **What this packet adds:** lore-side typography settings, atlas-side tokens, per-document font overrides, and a richer inline formatting toolbar. Aim: feel as expressive as Google Docs, with a curated catalog that fits the codex aesthetic.

---

## 1. Purpose

The user wants lore to *carry the emotion of the prose*. A line like "...you must find...**HIM!!!**" should be able to render with a heavier, scarier face at a larger size, distinct from the surrounding body text. The v1 inline picker can already do that mechanically — but the catalog of fonts is too narrow (3 fonts) to convey real tonal variation, lore has no role-level defaults of its own (only Characters does), and Atlas inherits Character defaults accidentally rather than by design.

This packet completes the typography model so all four world-content systems (Characters, Lore, Atlas, in-line per-selection) have intentional, overridable defaults — and the bundled font catalog is wide enough to actually deliver mood through type.

---

## 2. Goals (and explicit non-goals)

### Goals

- **Lore typography popover** — gear icon in the Lore Archive toolbar, mirrors the Characters one. Per-world defaults for lore body text, headings, and labels.
- **Atlas typography tokens** — Atlas-specific font roles that cascade from Lore by default but can override per system if the user wants. Atlas gets its own gear popover.
- **Per-document font defaults for lore** — each lore document can override the world-level lore defaults. Stored on the document.
- **Expanded inline toolbar** — color picker (preset codex palette), underline, strikethrough, alignment.
- **Expanded font catalog** — bundled fonts grow from 3 to ~10, picked specifically to give the user real tonal range (decorative, blackletter, hand-drawn, monospace, etc.).
- All controls work in **edit mode and view mode** — the inline picker only appears while editing, but the marks persist in view.

### Non-goals

- **No paragraph-style system** like Word's "Normal / Heading 1 / Quote". The role-level defaults are flat per-system; we don't expose styles users can name.
- **No web-fetched fonts.** Everything bundled, offline-first.
- **No font *weight* picker** in the inline toolbar. Bold (already shipped) is the only weight control. Variable-axis sliders (slant, weight, optical size) are out of scope.
- **No per-character per-doc overrides** — i.e., no "this character's card uses a custom font". Characters use only world-level defaults plus inline marks. Per-doc overrides are lore-only.
- **No multi-user or sync concerns** — Wormhole is single-user.
- **No Read Mode override.** The lore Read Mode (paper-styled book reader) keeps its dedicated `--paper-*` tokens unchanged. Per-doc lore typography applies to *write mode* and editor previews; Read Mode is a separate aesthetic layer that intentionally enforces its own paper-book look.

---

## 3. Background — the three layers

The user-facing model has three layers stacked from broadest to narrowest:

| Layer | Scope | Persistence | Set via |
|---|---|---|---|
| 1. Bundled fallback | The whole app, default look | Compiled in | n/a (CSS) |
| 2. Per-world defaults | All content of a system in this world | Tauri Store, per `worldId` | gear-icon popovers (Characters / Lore / Atlas) |
| 3. Per-document override | One specific lore document | Lore DB, per `document_id` | doc-level font panel inside the lore writer |
| 4. Inline marks | One selection inside a rich-text field | ProseMirror JSON in the document | bubble menu on selection |

Each layer overrides the one above. CSS-variable cascade does most of the work; per-doc lore overrides set a `style` attribute on a wrapping div so they only affect *that* document's editor.

---

## 4. Scope — what this packet builds

### 4.1 Lore typography popover (the missing twin of Characters')

Add a **Lore Typography** gear button to the Lore Archive toolbar. Opens a modal dialog identical in structure to the existing `CharacterTypographySettings` (live preview block + 4 role rows + Reset/Done footer), but:

- **Roles**:
  - **Body** — lore document body text (TipTap prose)
  - **Headings** — H1 / H2 / H3 in lore docs (StarterKit-rendered)
  - **Quotes** — `<blockquote>` styling
  - **Labels / Meta** — folder titles, doc list metadata, breadcrumb chrome

- **CSS tokens** added in `src/styles/typography.css`:
  ```
  --lore-font-display
  --lore-font-body
  --lore-font-quote
  --lore-font-label
  --lore-size-{display,body,quote,label}
  ```

- **Persistence**: same Tauri Store, key `lore-typography:<worldId>`. New hook `useLoreTypography.ts` mirrors `useCharacterTypography.ts`.

- **Where applied**: `DocumentEditor.tsx`, `BookPage` (write-mode preview only — Read Mode is separate), `FolderTree.tsx`, `DocumentList`. NOT applied to Read Mode (`--paper-*` tokens stay independent).

### 4.2 Atlas typography tokens (cascade from Lore, optional override)

Atlas Canvas has one TipTap surface today (entity descriptions in `AtlasEntityPanel`). It currently borrows Character codex tokens by accident.

This packet introduces dedicated atlas tokens that **cascade from lore by default** so they share aesthetic without configuration:

```css
:root {
  --atlas-font-body:  var(--lore-font-body);
  --atlas-font-label: var(--lore-font-label);
  --atlas-size-body:  var(--lore-size-body);
  --atlas-size-label: var(--lore-size-label);
}
```

A user who never touches Atlas typography will see lore defaults applied to entity descriptions automatically.

A user who *does* want a different atlas font opens the **Atlas Typography** gear button in the Atlas toolbar — same modal pattern. Picking a value sets the atlas-specific token directly (overrides the cascade). "Reset to defaults" in the atlas popover wipes the overrides, restoring the lore inheritance.

Persistence: Tauri Store key `atlas-typography:<worldId>`. New hook `useAtlasTypography.ts`.

### 4.3 Per-document font defaults for lore

Each lore document can override the world-level lore defaults. Use case: an in-world manuscript should open in Cormorant Garamond at 18px every time, while the user's other 49 docs stay in Crimson Pro at 15px.

#### UI

A small **font preset bar** appears at the top of `DocumentEditor.tsx`, below the title, above the body — in line with the existing toolbar. Three controls:

```
[ Body: Cormorant Garamond ▾  18px ▾ ]   [ Use world defaults ]
```

- Body family + size are the two most-used; offered explicitly.
- A "More…" link opens a small popover with the same role rows as the world-level lore popover but pre-populated from this doc's overrides — for power users who want to tweak Headings / Quotes / Labels per-doc.
- "Use world defaults" clears all per-doc overrides and reverts to the world settings.

#### Schema

New column on `lore_documents`:

```sql
ALTER TABLE lore_documents
  ADD COLUMN typography_overrides_json TEXT;
```

`NULL` = use world defaults. Otherwise stores the same shape as the lore typography settings:

```json
{
  "body":    { "family": "cormorant", "sizeRem": 1.125 },
  "display": { "family": "cormorant", "sizeRem": 2.25  }
}
```

Partial: only the role keys the user has overridden. Missing roles fall through to the world default.

Migration version bumps in `migrations.rs`. New Tauri command `update_document_typography(documentId, overridesJson)`.

#### Application

When a doc opens, its overrides are applied as **inline `style` attributes on a wrapping `.doc-editor__doc` div**, scoped to that one editor instance:

```tsx
<div className="doc-editor__doc" style={{
  '--lore-font-body': resolvedStack,
  '--lore-size-body': `${sizeRem}rem`,
  // … other overridden roles
}}>
  <TipTapEditor … />
</div>
```

Local CSS variable scope means closing the doc and opening another doesn't carry settings across. Other write-mode editors (lore lists, read-mode previews) continue to use the world defaults.

### 4.4 Inline toolbar expansion

Today's bubble menu has: Font / Size / Bold / Italic / Reset. Expand to:

```
┌──────────────────────────────────────────────────────────────┐
│ [Font ▾] [Size ▾] │ B I U S │ A▾ │ ◧ ▾ │ ↺                   │
└──────────────────────────────────────────────────────────────┘
   family   size      formatting   color   align  reset
```

#### New controls

- **Underline (U)** — needs `@tiptap/extension-underline`. Toggle.
- **Strikethrough (S)** — already in StarterKit. Toggle.
- **Color picker (A▾)** — opens a 10-swatch grid + "Default" reset. Uses TextStyle's color attribute (extending `TextStyleWithFontSize` further or adding the official color extension).
- **Alignment (◧▾)** — needs `@tiptap/extension-text-align`. Four options: left / center / right / justify. Block-level mark, applies to the paragraph the cursor is in (or all paragraphs in a multi-paragraph selection).

#### Color palette — **codex-tuned, 10 swatches**

| Slot | Name | Hex (dark theme) | Hex (light theme) | Intended use |
|---|---|---|---|---|
| 1 | Default | unset | unset | clears the color mark |
| 2 | Ink | `#e8e8ed` | `#1a1a2e` | normal body (matches `--text-primary`) |
| 3 | Parchment | `#f3e7c8` | `#5b4a26` | warm highlight, "this is special" |
| 4 | Sepia | `#c2a578` | `#8a6b3f` | aged / archival emphasis |
| 5 | Burgundy | `#c0586d` | `#8e2940` | passion, danger, blood-tone |
| 6 | Forest | `#82c596` | `#2e7d4f` | nature, life, growth |
| 7 | Royal Indigo | `#9b8bff` | `#4f3fbf` | mystical, otherworldly |
| 8 | Pewter | `#9aa3b3` | `#525a6a` | neutral aside, footnote |
| 9 | Gold Leaf | `#e2b86c` | `#a07418` | divine, treasure, importance |
| 10 | Sea Glass | `#7bc2c5` | `#2e7c80` | water, distant, dreamlike |
| 11 | Cinder | `#7c5045` | `#5a2e22` | scorched, regretful, dark earth |

(11 entries because Default is a control, not a color.) The palette renders as a 5×2 grid plus a top-row "Default" pill.

The color names are content-affordance hints, not labels — the picker shows swatches with hover tooltips of the name.

Storage: TextStyle gains a `color` attribute. Inline mark renders as `<span style="color: …">`. Round-trips through ProseMirror JSON natively.

### 4.5 Expanded font catalog

The current 3 bundled fonts can't deliver the tonal range the user wants. Catalog grows to ~10, organized by intended use:

| Family | Role | Vibe | Size on disk (latin+latin-ext, 2-3 weights) |
|---|---|---|---|
| Cormorant Garamond | Display serif | Elegant, literary (already bundled) | ~120 KB |
| Crimson Pro | Body serif | Warm, readable book text (already bundled) | ~120 KB |
| Inter | Sans / labels | Clean, geometric (already bundled) | ~150 KB |
| **EB Garamond** | Body serif (alt) | Older, more bookish than Crimson | ~80 KB |
| **Cinzel** | Display, all-caps | Inscription / monumental / fantasy titles | ~50 KB |
| **UnifrakturMaguntia** | Blackletter | Medieval, ominous — for "HIM!!!" lines | ~60 KB |
| **Caveat** | Hand-drawn | Personal, intimate, journal-like | ~50 KB |
| **Special Elite** | Typewriter | In-world dossiers, found documents | ~50 KB |
| **JetBrains Mono** | Monospace | Code, ledgers, structured data | ~120 KB |
| **Cormorant Unicase** | Decorative serif | Bold display alternative to plain Cormorant | ~60 KB |

Total bundle: roughly 700–900 KB. Acceptable for a desktop app — not a web bundle.

Source: all OFL fonts from Google Fonts. Mirror the existing `src/assets/fonts/` workflow (download the latin + latin-ext woff2 subsets per face, append to `fonts.css`, register `@font-face`).

The font catalog (the `FONT_LABELS` / `FONT_STACKS` constants in `src/hooks/useCharacterTypography.ts`) gets factored out into a shared `src/lib/font-catalog.ts` so all three system hooks (Character / Lore / Atlas) and the inline bubble menu reference the same source of truth.

The picker UI groups fonts by category in the dropdown:

```
─ Serif
  Cormorant Garamond
  Crimson Pro
  EB Garamond
─ Display
  Cinzel
  Cormorant Unicase
─ Decorative
  UnifrakturMaguntia
  Caveat
  Special Elite
─ Sans
  Inter
─ Mono
  JetBrains Mono
─ System
  System Serif
  System Sans
```

---

## 5. Data model changes

### 5.1 Lore documents

```sql
ALTER TABLE lore_documents
  ADD COLUMN typography_overrides_json TEXT;
```

NULL = inherit world. Otherwise JSON object as in §4.3.

### 5.2 Tauri Store keys

| Key | Shape | Purpose |
|---|---|---|
| `char-typography:<worldId>` | (existing) | Character codex defaults |
| `lore-typography:<worldId>` | same as char | Lore defaults |
| `atlas-typography:<worldId>` | same as char (smaller subset) | Atlas overrides over lore inheritance |

### 5.3 ProseMirror marks

`textStyle` mark gains a `color` attribute (in addition to `fontFamily` and `fontSize` from v1).

New marks: `underline` (from `@tiptap/extension-underline`), `strike` (already in StarterKit, just expose it). Block attribute: `textAlign` on paragraphs (from `@tiptap/extension-text-align`).

All round-trip through the existing `JSON.stringify(editor.getJSON())` storage with no schema changes to the host columns.

---

## 6. File impact

### New files

- `src/lib/font-catalog.ts` — moved from `useCharacterTypography.ts`. Source of truth for all font definitions.
- `src/hooks/useLoreTypography.ts`
- `src/hooks/useAtlasTypography.ts`
- `src/features/lore/LoreTypographySettings.tsx` + `.css`
- `src/features/atlas/AtlasTypographySettings.tsx` + `.css`
- `src/components/lore/DocumentTypographyPanel.tsx` + `.css` — per-doc override bar inside `DocumentEditor`
- `src/assets/fonts/` — adds ~7 new families, ~14 woff2 files (latin + latin-ext per face)

### Modified files

- `src/styles/typography.css` — add `--lore-font-*`, `--atlas-font-*`, and `--lore-size-*`, `--atlas-size-*` tokens (with cascade defaults wiring atlas → lore)
- `src/components/lore/DocumentEditor.tsx` — wraps the editor body in a div with inline-style overrides from the doc's `typography_overrides_json`
- `src/components/editor/EditorBubbleMenu.tsx` + `.css` — adds U / S / Color / Alignment buttons; color popover; alignment popover
- `src/components/editor/TextStyleWithFontSize.ts` — extend with `color` attribute
- `src/lib/commands.ts` + `src-tauri/src/commands/lore.rs` — new `update_document_typography` command
- `src-tauri/src/migrations.rs` — schema bump adding the column
- `src/hooks/useCharacterTypography.ts` — refactor to import from the new shared font-catalog module (no behavior change)

### Reused utilities

- The existing modal dialog pattern + CSS in `CharacterTypographySettings.css` — Lore and Atlas dialogs copy this near-verbatim. The reset/done footer, live preview block, role row layout — all the same. Three roles diverge in fields, not UX.
- The existing `applyCharacterTypography(settings)` function pattern — applies CSS variables onto `document.documentElement.style`. Generalize to take a token-prefix argument so the same function powers all three systems.
- The existing inline marks pipeline in `EditorBubbleMenu.tsx` — the new color and alignment controls plug into the same `setMark` / `unsetMark` flow.
- Tauri Store helpers (`getSettingsStore`) and the existing `loadCharacterTypography` / `saveCharacterTypography` debounced-save pattern — replicated for Lore and Atlas.

---

## 7. Build order

1. **Refactor font catalog** out of `useCharacterTypography.ts` into `src/lib/font-catalog.ts`. No behavior change. (Pre-req for everything else.)
2. **Bundle the new fonts** (~7 families). Update `fonts.css`. Run `npm run tauri dev` and visually confirm each face renders.
3. **Lore typography popover** (4.1). Most-requested, cleanest implementation.
4. **Atlas typography popover** (4.2). Trivial after Lore — same component pattern, fewer roles.
5. **Inline toolbar expansion** (4.4). Underline + strikethrough + color + alignment. No schema changes; pure frontend.
6. **Per-document font defaults** (4.3). Schema migration, new Tauri command, doc-level UI. Highest implementation cost.

Ship after step 5 if scope creeps; step 6 can be a separate release.

---

## 8. Acceptance criteria

### Lore (4.1)
- [ ] Lore Archive toolbar has a typography (A) icon next to existing controls.
- [ ] Click → modal opens with live preview + 4 role rows.
- [ ] Pick "EB Garamond" for Body → all lore docs in this world reflow.
- [ ] Reload app → settings persist for that world.
- [ ] Switch worlds → each world has its own lore typography.
- [ ] Reset → restores Crimson Pro / system serif defaults.

### Atlas (4.2)
- [ ] Atlas toolbar has a typography (A) icon.
- [ ] By default, Atlas entity description fonts match whatever the user has set in Lore typography (cascade via CSS vars).
- [ ] Setting a font in the Atlas popover overrides only Atlas, not Lore.
- [ ] "Reset" in Atlas popover restores the lore-inherited default.
- [ ] Lore typography unchanged when atlas overrides are set.

### Per-document (4.3)
- [ ] Each lore doc shows a small font preset bar at the top of the editor in write mode.
- [ ] Picking a font there changes only that doc — other docs in the same world remain on world defaults.
- [ ] "Use world defaults" clears the doc's overrides, restoring the world-level lore font.
- [ ] Reload → per-doc overrides persist (read from `lore_documents.typography_overrides_json`).
- [ ] Read Mode is unaffected — it keeps its own paper-book fonts (`--paper-*` tokens unchanged).

### Inline toolbar (4.4)
- [ ] Selecting text in any TipTap field shows the bubble menu with: Font / Size / B / I / U / S / Color / Align / Reset.
- [ ] Underline applies inline; persists; renders correctly in view mode.
- [ ] Strikethrough applies inline; persists; renders correctly.
- [ ] Color picker shows the 11-swatch palette (Default + 10 colors); active swatch highlights.
- [ ] Alignment buttons (left/center/right/justify) apply to the paragraph(s) intersecting the selection.
- [ ] Reset clears all `textStyle` attributes including color (font + size + color).

### Catalog (4.5)
- [ ] Bundled font catalog includes ~10 OFL fonts in `src/assets/fonts/`.
- [ ] Picker UI groups fonts by category (Serif / Display / Decorative / Sans / Mono / System).
- [ ] Selecting "UnifrakturMaguntia" renders prose in blackletter — confirms decorative fonts work end-to-end.
- [ ] Each character typography popover, lore typography popover, atlas typography popover, and the inline picker share the same font catalog (single source of truth).

### General
- [ ] No regressions in existing Character codex typography.
- [ ] `npx tsc --noEmit` clean.
- [ ] App boots with no console errors related to font loading.

---

## 9. Open questions / future work

- **Per-character typography overrides.** Equivalent to per-doc lore overrides, but for individual characters. Out of scope here. Likely overkill — character names + KV are short, role-level world defaults should cover the use case.
- **Font weight axis pickers.** Variable fonts (Inter, Crimson Pro have variable axes) could expose a weight slider in the inline picker. Not needed for v2; revisit if users ask.
- **Font upload.** Letting users drop their own `.woff2` files into a per-world fonts folder. Powerful but a sandbox / file-permission rabbit hole. Document as future work, do not build.
- **Read Mode typography per-doc.** Read Mode currently uses fixed paper-styled fonts. Some users may want a doc to render in Read Mode using the same overrides as write mode. Decide later — Read Mode is intentionally stylized and decoupling those tokens may dilute its identity.
- **Smart inline picker presets.** "Apply the 'whisper' preset" → italic, smaller, sepia color in one click. Compelling for emotional expressivity but adds UI complexity. Future spec.
