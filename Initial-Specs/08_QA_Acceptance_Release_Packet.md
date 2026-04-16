# Packet 8 — QA, Acceptance, and Release Packet

## 1. Purpose of this packet
This packet defines:
- what “done enough” means for V1
- how to check the build
- what failures matter
- what must work before the app is considered a real V1

## 2. QA philosophy
The goal is not perfection.
The goal is a coherent, stable V1 that already behaves like Wormhole.

This packet exists to prevent “it sort of runs” from being mistaken for “it is actually ready.”

## 3. Acceptance categories
Check V1 in these categories:
1. world management
2. world overview
3. atlas canvas
4. character codex
5. lore archive
6. linking
7. search
8. persistence
9. destructive actions
10. general UX consistency

## 4. World management acceptance
Must pass:
- can create world
- can edit world
- can delete world with confirmation
- can open world
- can persist worlds across app restart

## 5. World Overview acceptance
Must pass:
- graph view renders with root node (world title), group nodes (Characters, Lore, Atlas), and cover image node
- hovering root node shows summary
- clicking a group node reveals child nodes (recent/pinned records)
- quick actions accessible from group nodes (context menu or floating button)
- group nodes show record counts
- dashboard toggle switches to card/grid view with same information
- view mode preference persists across sessions
- does not appear visually dead or empty when content exists

## 6. Atlas Canvas acceptance
Must pass:
- animated ocean default canvas is visible and animating
- user can paint colored regions on the canvas with freehand brush
- map background image can optionally be set
- map entity can be created
- map entity can be placed/repositioned (anchored to canvas space)
- entities stay in position when zooming and panning
- map entity can be selected
- selected entity panel shows correct details
- entity can be edited
- entity can be deleted with confirmation
- linked characters/lore docs appear when linked
- layout, painted regions, and entities persist after restart

## 7. Character Codex acceptance
Must pass:
### Character Card Page
- can create character with image and name
- character card page displays with inventory grid layout
- can drag blocks from dock/palette onto the grid
- can resize blocks (cycle width 1/2/3 columns, height 1/2 rows)
- can reposition blocks within the grid
- can delete blocks
- blocks do not overlap
- grid respects max 3 columns and fixed row count (fits one screen)
- edit mode shows dock, drag handles, resize controls
- view mode hides edit UI and renders content as styled HTML
- in-character intro is visible and distinct
- landscape and portrait header layouts work per character
- brief details (key-value pairs) persist

### Character Details Page
- 3D card flip animation transitions between card and details
- first detail section is always present with image, name, core stats, objective summary
- can add custom detail sections with user-chosen titles
- can select layout type per section (prose, cards, timeline, key-value)
- can navigate between sections via tabs, arrow keys, and prev/next buttons
- can edit content within each section layout type
- can reorder, rename, and delete custom sections
- view mode renders all section content styled with clickable `[[links]]`

### General
- can edit/delete character with confirmation (recycle bin)
- linked records show correctly
- character list shows thumbnail cards with manual reordering
- all data persists after app restart

## 8. Lore Archive acceptance
Must pass:
- can create folder (up to 5 nesting levels)
- can rename folder
- can delete folder safely — documents inside are moved to root, user sees warning with document count
- can drag-and-drop folders to reorganize (reorder siblings, move to different parent)
- circular folder hierarchies are rejected
- can create document
- can rename document
- can edit and save content (rich text WYSIWYG with auto-save on blur)
- undo/redo works in the editor (Ctrl+Z / Ctrl+Shift+Z)
- can reopen a saved document later with content intact
- linked records panel shows correct links
- inline `[[links]]` resolve and are clickable in view mode

## 9. Linking acceptance
Must pass:
- can link character to lore doc with a typed label (e.g., "appears_in")
- can link character to map entity with a typed label
- can link map entity to lore doc with a typed label
- links appear bidirectionally in both relevant places
- link type label is visible in linked records panels
- deleting an entity soft-deletes related links (recycle bin)
- inline `[[links]]` in rich text fields resolve and are clickable
- clicking an inline link opens the peek panel

## 10. Search acceptance
Must pass:
- can search worlds by title (case-insensitive substring)
- can search characters by name
- can search map entities by title
- can search lore docs by title
- results display record type label, full title, and short snippet where applicable
- results are sorted alphabetically, max 50 returned
- soft-deleted records (in recycle bin) do not appear in search
- selecting a result opens the relevant detail view/panel

Full-text search of lore content and character summaries is deferred to V2.

## 11. Persistence acceptance
Must pass:
- app restart preserves all worlds (each as a `.wormhole` file)
- app restart preserves map layout, painted regions, and entity positions
- app restart preserves character data (including layout variant and brief details)
- app restart preserves lore structure/content (rich text JSON)
- app restart preserves links (including link type labels)
- recycle bin contents persist until 24-hour expiry

## 12. Asset handling acceptance
Must pass:
- importing image creates usable asset (stored as BLOB in `.wormhole` database)
- asset references use UUIDs, not file paths — no broken links when moving the `.wormhole` file
- world cover image loads after app restart
- character image loads after app restart
- map background image loads after app restart
- sharing a `.wormhole` file to another machine preserves all assets

## 13. Destructive action acceptance
Must pass:
- deletion requires confirmation
- deleting world permanently removes the `.wormhole` file (with explicit warning)
- deleting character/map entity/lore doc moves record to per-world recycle bin
- records in recycle bin are recoverable within 24 hours
- records in recycle bin do not appear in search, linked records, or autocomplete
- restoring a record from recycle bin also restores its entity links
- after 24 hours, records are permanently deleted
- user can manually empty the recycle bin
- deletion should not leave broken visible state

## 14. UX consistency acceptance
Must pass:
- top dock works consistently
- selection state is understandable
- dialogs behave consistently
- empty states are present where needed
- app does not feel like three unrelated tools
- peek panel works for all cross-system link clicks
- full-screen slide transition from peek panel works
- back button returns from full-screen to previous view
- dark/light theme toggle works and persists
- rich text editor with inline link autocomplete works across all rich text fields

## 15. Regression checklist
Before calling a build “good enough,” re-check:
- create/edit/delete world
- create/edit/delete map entity
- create/edit/delete character
- create/edit/delete lore document
- create/delete links
- app restart persistence
- asset import
- search basics

## 16. Release readiness threshold
A V1 build is release-ready enough when:
- all major acceptance criteria from sections 4–14 pass
- there are no known data-loss bugs
- there are no severe navigation dead ends
- persistence is reliable
- the app feels cohesive across all three systems (same typography, spacing, interaction patterns)
- navigation between systems is smooth (top dock, peek panels, search)
- no system feels isolated or incomplete

## 17. Known acceptable imperfection
The following may still be imperfect in V1 without blocking release:
- minor layout quirks
- non-critical styling roughness
- light markdown limitations
- limited search sophistication
- non-essential polish gaps

## 18. Release blockers
Do not call V1 done if any of these are true:
- data disappears unexpectedly
- links break routinely
- app restart loses state
- deleting a character breaks linked lore documents or map entities (links must be soft-deleted, not the linked records themselves)
- deleting a map entity breaks linked characters
- deleting a lore folder permanently deletes its documents (they should move to root)
- orphaned entity_links appear (referencing deleted records without being soft-deleted themselves)
- the 3-system navigation is unclear
- core CRUD is unreliable

## 19. Final release definition
Wormhole V1 is ready when it is:
- coherent
- persistent
- navigable
- structurally correct
- stable enough to use for real worldbuilding work
