-- Per-character toggle: when 1, clicking the character in the codex opens
-- the cinematic (full-bleed image) view instead of the default card view.
ALTER TABLE characters ADD COLUMN cinematic_preview_locked INTEGER NOT NULL DEFAULT 0;

UPDATE schema_version SET version = 5;
