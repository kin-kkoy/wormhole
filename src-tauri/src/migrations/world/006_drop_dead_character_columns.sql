-- Drop `traits_text` and `card_layout_variant` — both superseded by the
-- shipped card redesign. `traits_text` was a pre-grid scalar; the card-blocks
-- grid now covers that role. `card_layout_variant` was never wired to UI;
-- the card front uses a single Preview-style layout.
--
-- SQLite ALTER TABLE ... DROP COLUMN works in SQLite >= 3.35.0 (rusqlite
-- bundles 3.44+ via Tauri), so this is safe here.

ALTER TABLE characters DROP COLUMN traits_text;
ALTER TABLE characters DROP COLUMN card_layout_variant;

UPDATE schema_version SET version = 6;
