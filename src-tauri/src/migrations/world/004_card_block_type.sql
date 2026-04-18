-- Card blocks get a type discriminator so Label (title-only) and Text
-- (content-only) blocks can render and behave differently from standard
-- (title + content) blocks. Existing rows default to 'standard'.
ALTER TABLE character_card_blocks ADD COLUMN block_type TEXT NOT NULL DEFAULT 'standard';

UPDATE schema_version SET version = 4;
