# Wormhole — Spec Bundle

The 8 original V1 packets plus post-V1 spec extensions (Packet 9: Atlas Canvas v2; Packet 10: Typography v2).

## Current state (2026-04-26)

**Built (V1):**
- Packets 1–2 — product identity, stack, two-database architecture, migrations, asset BLOB pipeline.
- Packet 3 — Atlas Canvas V1 (region painting, markers, freehand color regions).
- Packet 4 — Character Codex V1 + 2026-04-25 polish pass (typography v1, inline font picker, live drag-reflow, codex aesthetic).
- Packet 5 — Lore Archive V1 + Read Mode (paginated and continuous readers, paper tokens, cross-doc next-page).
- Packet 6 — Linking / Search / Shared Relations V1 (`[[`-trigger autocomplete, broken-link resolver, peek panel, scoped global search).
- Packets 7–8 — UX rules and QA/acceptance criteria, applied across V1.

**Specced, not started:**
- **Packet 9 — Atlas Canvas v2** (3D painting, layers, shaders). Reference prototype at `prototypes/atlas-canvas-painting-prototype.html`.
- **Packet 10 — Typography v2** (lore + atlas typography popovers, per-document font defaults, expanded inline toolbar, expanded font catalog).

**Pre-spec ideas (in `Future-Feature-Plans.md` at repo root):**
- Cyber-Goggles AI companion (lore stress-testing roleplay; planned last in build queue).
- Overview redesign (tabbed system graphs, shared nodes, Location Affiliation) — tracked in memory, not yet in the ideas notebook.

Each packet's own status banner at its top has the latest build state for that system.

## Recommended usage
For implementation:
1. Start with `01_Master_Product_Spec.md` (product identity and scope)
2. Then `02_Core_Build_Packet.md` (stack, architecture, shared foundations)
3. Then implement system packets in this order (Character Codex before Atlas Canvas because character CRUD is simpler and provides seed data for linking):
   - `04_Character_Codex_Build_Packet.md`
   - `05_Lore_Archive_Build_Packet.md`
   - `03_Atlas_Canvas_Build_Packet.md`
4. Then apply shared integration rules from:
   - `06_Linking_Search_Shared_Relations_Packet.md`
   - `07_UX_Interaction_Packet.md`
5. Use `08_QA_Acceptance_Release_Packet.md` as the definition of done

Note: packet numbering does not match build order. Build order follows dependency logic (see `02_Core_Build_Packet.md` section 16).

## The packets

### Original V1 (1–8)
1. Master Product Spec
2. Core Build Packet
3. Atlas Canvas Build Packet
4. Character Codex Build Packet
5. Lore Archive Build Packet
6. Linking / Search / Shared Relations Packet
7. UX / Interaction Packet
8. QA / Acceptance / Release Packet

### Post-V1 spec extensions
9. Atlas Canvas v2 — 3D, Painting, Layers, Shaders (supersedes parts of #3)
10. Typography v2 — Lore + Atlas typography popovers, per-document font defaults, expanded inline toolbar, expanded font catalog

## Product summary
Wormhole is a local-first desktop app for managing fictional worlds through three connected systems:
- Atlas Canvas
- Character Codex
- Lore Archive

The app is for a single personal user and prioritizes:
- usability
- structure
- expressive flexibility
- long-term maintainability

## Important implementation rule
Do not reinterpret Wormhole into:
- a general notes app
- a full Obsidian replacement
- a drawing program
- a game engine editor
- a fully custom page-builder

The product must remain centered on three connected systems.

## Suggested prompt lead-in for an implementation agent
"Use these packets as the implementation source of truth. Respect scope boundaries, do not invent extra systems, and build the narrowest correct version first."
