-- Per-document worldbuilding status (Proposal 01): stub | draft | wip | done.
-- Shown as colored dots in the Lore folder tree, settable via context menu.
ALTER TABLE lore_documents ADD COLUMN status TEXT NOT NULL DEFAULT 'draft';

UPDATE schema_version SET version = 16;
