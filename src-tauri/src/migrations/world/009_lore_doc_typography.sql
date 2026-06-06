-- Packet 10 §4.3: per-document lore typography overrides.
-- NULL = inherit world-level lore defaults. Otherwise a JSON object of the
-- shape { "<role>": { "family": "<key>", "sizeRem": <number> }, ... } where
-- only the roles the user overrode are present.
ALTER TABLE lore_documents ADD COLUMN typography_overrides_json TEXT;

UPDATE schema_version SET version = 9;
