-- Character shelves: named groups for organizing the codex.
CREATE TABLE IF NOT EXISTS character_shelves (
    id          TEXT PRIMARY KEY,
    world_id    TEXT NOT NULL REFERENCES worlds(id),
    name        TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

-- Nullable FK — unshelved characters land in the default "All Characters" pool.
ALTER TABLE characters ADD COLUMN shelf_id TEXT REFERENCES character_shelves(id);

UPDATE schema_version SET version = 13;
