# Packet 6 — Linking, Search, and Shared Relations Packet

> **Status:** Built (V1). Inline `[[`-trigger autocomplete, cross-system entity links rendered as colored spans, broken-link resolver via `useBrokenLinkResolver`, scoped global search (Overview + Atlas), peek panel, soft-delete with link invalidation. Last verified 2026-04-26.

## 1. Purpose of this packet
This packet defines the shared connective tissue across Wormhole:
- cross-system links
- link semantics
- linked record displays
- deletion cleanup
- search behavior

Without this packet, the 3 systems would behave like isolated tools instead of one product.

## 2. Core principle
All meaningful cross-system relationships in V1 should be represented through the shared `entity_links` model.

Do not invent separate ad hoc relationship storage inside each feature.

## 3. Supported entity link participants
V1 link participants:
- map_entity
- character
- lore_document

## 4. Entity links model
Use:
- id (UUID)
- world_id
- source_type (enum: character, map_entity, lore_document)
- source_id (UUID)
- target_type (enum: character, map_entity, lore_document)
- target_id (UUID)
- link_type (text, default 'related_to' — max 50 characters, alphanumeric + underscore + hyphen)
- created_at
- deleted_at nullable — for soft-delete when parent record is deleted

## 5. Link directionality
Links are **bidirectional**. Creating a single link makes it visible from both sides.

When a user links character A to lore document B:
- Character A's detail page shows lore document B in its linked records
- Lore document B's panel shows character A in its linked records

### Storage
Links are stored as **a single row** per relationship. The backend queries bidirectionally: when fetching linked records for entity A, it returns rows where `(source_id = A) OR (target_id = A)`. This avoids redundant storage while maintaining bidirectional display.

Creating a link between A and B stores one row. Deleting it removes that one row. The `source`/`target` distinction does not imply directionality to the user — both sides see the link equally.

## 6. Link types
When creating a link, the user **labels the relationship type**. The app provides suggested values but also allows freeform input.

### Suggested link_type values
- related_to (default if none specified)
- ruler_of
- resident_in
- born_in
- active_in
- appears_in
- located_in
- tied_to_event
- reference

### Behavior
- The link creation modal shows a dropdown of suggested types
- The user may type a custom type if none of the suggestions fit
- The label is stored on the `entity_links.link_type` field
- Link type labels are displayed in linked records panels so the user understands the nature of each connection (e.g., "Kira — ruler_of — Ashenmoor" rather than just "Kira — linked")

Do not build a formal ontology engine. The types are labels, not enforced schema.

## 7. Supported linked relationships
The system supports linking **any entity to any other entity** within the same world (character ↔ character, map_entity ↔ map_entity, etc.).

V1 **prioritizes display/UI** for these three cross-system relationships:
- character ↔ lore document
- character ↔ map entity
- map entity ↔ lore document

Other relationship types (e.g., character ↔ character) may be created and are stored in entity_links, but may not have dedicated UI panels in V1.

## 8. Linked records display rules
### On map entity detail
Show:
- linked characters
- linked lore docs

### On character detail
Show:
- linked map entities
- linked lore docs

### On lore doc panel
Show:
- linked characters
- linked map entities

The user must not be forced to remember where information is; linked records should keep systems connected visibly.

## 9. Link management UI
Each relevant detail page/panel should allow:
- add link
- remove link
- browse current links

A simple picker-based modal is enough for V1.

## 10. Search scope
### Minimum V1 search
Search by title/name across:
- worlds
- characters
- map entities
- lore documents

### Nice if practical
Also search:
- character summaries
- lore content

## 11. Search behavior
### World Index
Search worlds by title.

### Inside a world
Search should find:
- character names
- map entity titles
- lore document titles

Do not promise advanced relevance ranking in V1.

## 12. Search results behavior
Search results should identify:
- record type
- title/name
- possibly short preview/snippet

Selecting a result should open the correct detail view/panel.

## 13. Deletion cleanup rules
When soft-deleting a character, map entity, or lore document, the app must also **soft-delete** all related `entity_links` in the same database transaction (set their `deleted_at` timestamps).

When the parent record is permanently deleted (after 24-hour recycle bin expiry or manual permanent deletion), its related entity_links are also permanently deleted.

When a record is restored from the recycle bin, its soft-deleted entity_links are also restored.

Do not leave orphaned links.

## 14. Data integrity rules
- All links must belong to the same world
- The backend should enforce or validate this where practical
- Search must only return records relevant to the current world context when inside a world

## 15. Scope warnings
Do not build:
- formal relationship graph engine
- graph visualization system
- semantic ontology engine
- AI-assisted relation generation
- fuzzy relationship inference

This packet is about practical integration, not intelligence features.

## 16. Acceptance criteria
Shared relations/search are acceptable when:
- links can be created and removed reliably
- links show up in relevant detail screens
- deleting entities cleans related links
- search works inside the current world
- search helps the user move between the 3 systems
