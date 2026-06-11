ALTER TABLE characters ADD COLUMN ribbon_icon_asset_id TEXT;
UPDATE schema_version SET version = 14;
