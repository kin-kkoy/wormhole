-- Move faction icon from characters to shelves.
ALTER TABLE character_shelves ADD COLUMN icon_asset_id TEXT;
UPDATE schema_version SET version = 15;
