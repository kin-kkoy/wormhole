# Packet 7 — UX and Interaction Packet

## 1. Purpose of this packet
This packet defines shared user experience rules:
- navigation behavior
- layout logic
- panel behavior
- dialog patterns
- visual tone
- interaction consistency

This packet is not a visual mockup. It is a behavior and layout packet.

## 2. Core UX goal
Wormhole should feel:
- clean
- immersive
- structured
- readable
- calm
- personal

It should not feel:
- like a generic admin dashboard
- like a social product
- like an overdesigned game editor
- like a chaotic note wall

## 3. Primary navigation
Use a **top dock** as the primary navigation inside a world.

Tabs:
- Overview
- Atlas Canvas
- Character Codex
- Lore Archive

Rules:
- stable selected state
- compact
- always visible inside world shell
- no sidebar dependency for primary navigation

## 4. World Index UX
The World Index should feel like:
- a launchpad into worlds
- simple and readable
- not overloaded

World cards should show enough context to choose a world quickly.

## 5. World Overview UX
World Overview is the landing page inside a world. It has **two view modes** toggled by a button:

### View Mode A — Graph View (default)
A **lightweight force-directed graph** (similar to Obsidian’s graph view) that visualizes the world’s structure.

Layout:
- **Root node** (center, fixed position): the world title. Hovering shows the world summary text in a tooltip.
- **Cover image node**: connected below the root. If a world cover image exists, clicking shows a lightbox with the full image. If no cover image is set, this node is hidden.
- **Group nodes**: connected outward from the root. One per system — "Characters," "Lore," "Atlas." Each group node displays its record count as a label (e.g., "Characters (12)"). Count excludes soft-deleted records.
- **Expanded children**: group nodes are **collapsed by default**. Clicking a group node toggles expansion. When expanded, the **5 most recently modified** non-deleted records in that system are shown as child nodes. Clicking a group node again collapses it. Clicking a child node opens the full detail view.
- **Quick actions**: right-clicking a group node opens a context menu with actions ("New Character," "New Lore Doc," "New Map Entity" — relevant to that system). These are UI controls, not graph nodes.

Graph rules:
- Use D3-force or equivalent with default spring/repulsion parameters
- Root node is pinned at center (not affected by physics)
- Nodes settle into stable positions within 2–3 seconds
- For worlds with 50+ total records, disable physics animation and use a static radial layout to maintain performance
- Max 200 visible nodes at once (truncate child lists if necessary)
- The graph should feel alive but calm — gentle settling, not chaotic bouncing

### View Mode B — Dashboard
A card/grid layout showing the **same information** as the graph view:
- world title and summary at the top
- cover image/banner
- sections (tabs or card groups) for each system: Characters, Lore, Atlas
- each section shows: record count, list/preview of recent or pinned items, quick action buttons (e.g., "New Character," "New Lore Doc")

The dashboard is a simpler, more conventional alternative for users who prefer it. Each section is a collapsible card group (click header to expand/collapse). All sections are visible simultaneously (no tab navigation).

### Toggle
A visible toggle button switches between Graph View and Dashboard. The user’s preference is persisted in app settings and restored on app restart.

## 6. Atlas Canvas UX
Atlas must feel spatial and navigable.

Rules:
- map is primary visual surface
- selected entity details must be easy to access
- zoom/pan should feel smooth but not flashy
- markers/regions must remain readable over the map background

Avoid:
- clutter
- overanimated interactions
- buried detail panels

## 7. Character Codex UX
Character creation and reading should feel guided.

Rules:
- core profile fields come first
- expressive section is visible and respected
- optional modules should feel additive, not overwhelming
- detail page should not feel like a broken freeform collage

## 8. Lore Archive UX
Lore writing should feel familiar and dependable.

Rules:
- folder tree is understandable
- editor is stable
- linked records panel reinforces context
- writing surface should not be crowded by too many tools

## 9. Dialog patterns
Use dialogs for:
- create world
- edit world
- create map entity
- edit map entity
- create character
- edit character
- create folder
- create document
- link picker
- delete confirmation

Dialogs should:
- have clear titles and labeled fields (required vs optional)
- confirm destructive actions explicitly with a warning message
- not be overcomplicated
- include action buttons: primary action (Create/Save/Delete) + Cancel
- be dismissible via Escape key
- NOT close when clicking outside the dialog (user must click Cancel or an action button)
- show inline validation errors on required fields before saving

## 10. Empty states
Every major screen should have a meaningful empty state.

Examples:
- no worlds yet
- no map entities yet
- no characters yet
- no lore docs yet

Empty states should guide the user toward the next action.

## 11. Selection model
Inside each system, selection should be clear.

Examples:
- Atlas: selected map entity
- Character Codex: selected/opened character
- Lore Archive: selected folder/doc

Do not make selection state confusing or hidden.

## 12. Forms
Forms should be:
- straightforward
- compact
- readable
- grouped logically

Do not expose dozens of fields at once if most are optional.

## 13. Motion and polish
Use subtle motion only where it helps:
- hover
- tab transitions
- dialog entry
- panel changes

Do not make motion a product feature.

## 14. Cross-system peek panel
When the user clicks an inline `[[link]]` or a linked record entry from any system, the target opens in a **read-only peek panel** that slides in from the right side.

### Peek panel behavior
- the peek panel occupies **40% of the screen width** (50% on screens narrower than 1024px)
- main content remains visible behind/beside the peek panel
- the peek panel shows a read-only preview of the linked record (character card, lore document content, or map entity details)
- editing is not supported in the peek panel
- a **close button** (X) in the top-right corner closes the panel
- clicking main content while peek is open does NOT close it — the user must explicitly close it
- only **one peek panel** may be open at a time (clicking another link replaces the current peek content)

### Full-screen transition
At the top of the peek panel, a prominent "Open Full" button triggers a **slide transition** (300ms):
1. the peek panel content slides left and expands to fill the full screen
2. the linked record opens in its full system view (e.g., the lore document opens in Lore Archive)
3. a **back button** in the upper left reverses the slide: full view slides right, previous state (with peek panel) slides back in

No nested peek panels. Only one full-screen transition depth.

### Scope
This peek/slide behavior applies to **all cross-system link clicks**:
- from a lore doc → clicking a linked character → peek shows character card
- from a character page → clicking a linked lore doc → peek shows lore doc
- from Atlas Canvas → clicking a linked character on the entity panel → peek shows character
- from any inline `[[link]]` in any rich text field (in view mode)

Exception: clicking a record from within the same system (e.g., lore doc → lore doc while already in Lore Archive) may open the target directly in the same view instead of a peek panel.

## 15. Visual styling constraints
Target style:
- **dark theme** as default, **light theme** available via toggle in settings
- atmospheric but restrained
- clean panels
- soft hierarchy
- good spacing
- readable text contrast

Avoid:
- too many colors
- loud gamified badges
- ornamental clutter

## 16. System identity cues
Each of the 3 systems should feel distinct enough that the user knows where they are:

- **Atlas Canvas**: spatial metaphor — large pannable canvas, positioned entities, zoom controls. Accent color: blue.
- **Character Codex**: passport/card metaphor — card grid, flip animation, inventory-style block layout. Accent color: purple.
- **Lore Archive**: document/notebook metaphor — folder tree sidebar, text editor, linear reading flow. Accent color: amber.

Accent colors appear in headers, tab indicators, and section borders. All systems share the same underlying typography, spacing, and dark/light theme palette to feel cohesive.

## 17. Acceptance criteria
UX/interaction is acceptable when:
- the user can always tell where they are
- navigation feels stable
- the app feels consistent across systems
- dialogs and forms behave predictably
- empty states guide rather than confuse
- the product feels coherent rather than fragmented
- the graph view World Overview renders and is interactive
- the dashboard toggle shows the same information in card/grid layout
- the peek panel opens for cross-system link clicks and the full-screen slide transition works
- dark and light theme toggle works
