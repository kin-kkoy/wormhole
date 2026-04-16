# Wormhole — 8 Packet Build Bundle

This bundle contains the 8 major specs/build packets for Wormhole.

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

## The 8 packets
1. Master Product Spec
2. Core Build Packet
3. Atlas Canvas Build Packet
4. Character Codex Build Packet
5. Lore Archive Build Packet
6. Linking / Search / Shared Relations Packet
7. UX / Interaction Packet
8. QA / Acceptance / Release Packet

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
