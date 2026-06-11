-- Resume-where-you-left-off: per-world last position snapshot, shown on the
-- world index card. JSON: {tab, entity_type, entity_id, entity_title, saved_at}.
ALTER TABLE registry_worlds ADD COLUMN last_position TEXT;

UPDATE schema_version SET version = 3;
