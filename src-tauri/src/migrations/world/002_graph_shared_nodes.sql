-- Add tags to characters (spec requires it, was missing from schema)
ALTER TABLE characters ADD COLUMN tags_text TEXT;

-- Add image to map_entities (for image nodes in graph)
ALTER TABLE map_entities ADD COLUMN image_asset_id TEXT REFERENCES assets(id);

-- Shared nodes for graph grouping (Atlas + Characters graphs)
CREATE TABLE IF NOT EXISTS graph_shared_nodes (
    id TEXT PRIMARY KEY,
    world_id TEXT NOT NULL,
    graph_type TEXT NOT NULL CHECK(graph_type IN ('atlas', 'characters')),
    name TEXT NOT NULL,
    color TEXT,
    font_style TEXT DEFAULT 'normal',
    font_size REAL DEFAULT 14.0,
    auto_generated INTEGER NOT NULL DEFAULT 0,
    source_tag TEXT,
    hidden INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (world_id) REFERENCES worlds(id)
);

CREATE TABLE IF NOT EXISTS graph_shared_node_members (
    id TEXT PRIMARY KEY,
    shared_node_id TEXT NOT NULL,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('character', 'map_entity')),
    entity_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (shared_node_id) REFERENCES graph_shared_nodes(id) ON DELETE CASCADE
);

UPDATE schema_version SET version = 2;
