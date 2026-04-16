ALTER TABLE registry_worlds ADD COLUMN summary TEXT;
ALTER TABLE registry_worlds ADD COLUMN world_type TEXT NOT NULL DEFAULT 'Custom';
UPDATE schema_version SET version = 2;
