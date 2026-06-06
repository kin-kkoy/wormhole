# Wormhole — Spec Bundle

## Current state (2026-06-06)

**Built:**
The original packets shipped; their specs live in `_archive/`. A consolidated
summary of what shipped and any deltas from spec is in `IMPLEMENTED.md` —
**start there**.

- **Core app** — World index/registry, Character Codex, Lore Archive
  (incl. Read Mode), linking/search/shared relations, cross-system UX, QA
  baseline.
- **Typography v2 (Packet 10)** — Lore typography popover, per-document lore
  font overrides, expanded inline toolbar (color / underline / strikethrough /
  alignment), and a 10-family OFL catalog factored into a shared source of
  truth.

**⚠ Atlas Canvas — DETACHED (2026-06-06):**
The entire Atlas system (2D map, 3D terrain, map entities, and their SQLite
schema) was removed pending a ground-up redesign. The Atlas tab remains in the
app as an "In Development" placeholder. The forward-looking architecture
blueprint is `references/atlas-2d-foundation.md`, with the validated rendering
prototype at `prototypes/2D-AtlasMap-Prototype.html` — those two files are the
ONLY Atlas references that survive; do not resurrect removed code without
re-reading them.

**Pre-spec ideas (not yet specced/built):**
- Atlas Canvas rebuild (per the blueprint above).
- Cyber-Goggles AI companion (lore stress-testing roleplay; planned last in
  build queue).

---

## Navigation

| File | What it is |
|---|---|
| `IMPLEMENTED.md` | Consolidated summary of all shipped work — **start here** for build history + spec deltas |
| `_archive/` | Original packets (full detail, for reference). Atlas packets were removed with the system |

---

## Product summary

Wormhole is a local-first desktop app for managing fictional worlds through three connected systems: Atlas Canvas (in development), Character Codex, and Lore Archive. Single-user, no cloud, no collab. Stack: Tauri 2 + React 19 + TypeScript + Vite + Rust + SQLite + TipTap (rich text).

## Implementation rule

Do not reinterpret Wormhole into a general notes app, drawing program, game engine editor, or fully custom page-builder. The product must remain centered on three connected systems.
