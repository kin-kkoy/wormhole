# Packet 1 — Master Product Spec

## 1. Purpose of this packet
This document defines what Wormhole is, what it is not, and what the product is trying to achieve.
It is the identity and scope anchor for every other packet.

## 2. Product name
**Wormhole**

## 3. Product definition
Wormhole is a **local-first personal world explorer and story codex** for fictional universes.

It is composed of three connected systems:
1. **Atlas Canvas** — the world map / spatial system
2. **Character Codex** — the character profile and detail system
3. **Lore Archive** — the lore, notes, and longform writing system

The user should be able to open a world and immediately understand:
- the world itself
- important locations
- important characters
- connected lore and narrative material

## 4. Primary value proposition
Wormhole helps a single creative user manage a fictional world through structured, connected records instead of scattered notes.

The app should make it easier to:
- stay oriented inside a world
- connect map, characters, and lore
- revisit a world after time away
- grow a world without turning it into a dump

## 5. Core principle
**Expression with structure.**

The app must support creative, immersive, personal worldbuilding, but never at the cost of losing navigability, clarity, or long-term usability.

## 6. Intended user
Primary user:
- one personal user
- maintaining one or more fictional worlds
- using the app repeatedly over time

This is not a multi-user collaboration product in V1.

## 7. What Wormhole is not
Wormhole is not:
- a public publishing platform
- a collaboration tool
- a social storytelling platform
- a full note-taking replacement for everything
- a drawing suite
- a pixel art editor
- a game engine editor
- a pure wiki clone

## 8. Product mental model
The cleanest way to understand Wormhole is:

### World
A fictional universe or project container.

### Atlas Canvas
The world seen spatially through meaningful locations and map entities.

### Character Codex
The world seen through its people.

### Lore Archive
The world seen through documents, notes, stories, and fragments.

### Links
The glue connecting those three systems.

## 9. Product goals
Wormhole must let the user:
- create multiple worlds
- open a world
- browse map entities
- browse characters
- write lore
- link records between systems
- persist everything locally

## 10. Product success test
The product is succeeding when the user can:
- enter a world
- understand where to go next
- move between map, character, and lore smoothly
- trust that the app’s structure reflects the world meaningfully

## 11. Product constraints
Mandatory constraints:
- local-first
- desktop-first
- single-user
- structured data model
- no major system outside the 3-system framework in V1

## 12. V1 product boundaries
V1 includes:
- World Index
- World Overview (graph view + dashboard toggle)
- Atlas Canvas (animated ocean canvas, freehand region coloring, map entities)
- Character Codex (passport-style card layout, two layout variants, manual ordering)
- Lore Archive (rich text WYSIWYG editor)
- explicit record linking with typed labels and bidirectional display
- inline `[[links]]` with autocomplete in all rich text fields
- cross-system peek panel with full-screen slide transition
- per-world recycle bin (24-hour recovery)
- dark/light theme toggle
- local persistence via `.wormhole` files (one per world)
- freeform tags with genre-based suggestions
- undo/redo in all rich text editors

V1 excludes:
- custom theme import (deferred)
- advanced media/animation systems
- collaboration
- cloud sync
- AI generation
- deep faction/timeline/event platforms as standalone modules
- custom drag-and-drop page building
- graph visualization of lore/character relationships (distinct from World Overview graph)
- export to markdown

## 13. Long-term extensibility stance
Wormhole may expand later, but V1 must be built as a coherent core, not as an unfinished shell for a dream product.
Future additions must only be considered if they reinforce the 3-system identity instead of swallowing it.

## 14. Product language
Use these terms consistently:
- World
- World Overview
- Atlas Canvas
- Character Codex
- Lore Archive
- Map Entity
- Character
- Lore Document
- Linked Records

Avoid vague language like:
- random “nodes”
- “cards” when the object is really a character record
- “wormhole” as the internal name for every object

“Wormhole” is the app name and world-entry metaphor, not the label for every data structure.

## 15. Product-level non-negotiables
- Structured truth must not be hidden in unstructured docs
- Decorative expression must not replace data structure
- The app must not require the user to design every page from zero
- The top-level product identity must remain the 3-system model

## 16. Final product summary
Wormhole is a local-first desktop app for exploring and maintaining fictional worlds through three connected systems:
- Atlas Canvas
- Character Codex
- Lore Archive

It should feel personal, expressive, clear, and durable.
