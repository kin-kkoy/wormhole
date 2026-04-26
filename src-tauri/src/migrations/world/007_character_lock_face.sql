-- Replace the bool `cinematic_preview_locked` with a tri-state `locked_face`:
-- NULL = unlocked (card shown by default, Preview button enabled);
-- 'card' = locked to card (Preview disabled);
-- 'cinematic' = locked to cinematic (Preview disabled).

ALTER TABLE characters ADD COLUMN locked_face TEXT;

UPDATE characters SET locked_face = 'cinematic' WHERE cinematic_preview_locked = 1;

ALTER TABLE characters DROP COLUMN cinematic_preview_locked;

UPDATE schema_version SET version = 7;
