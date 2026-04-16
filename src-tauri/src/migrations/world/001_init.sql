CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER NOT NULL
);
INSERT INTO schema_version (version) VALUES (1);

CREATE TABLE IF NOT EXISTS worlds (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'Untitled World',
    world_type TEXT NOT NULL DEFAULT 'Custom',
    summary TEXT,
    cover_asset_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (cover_asset_id) REFERENCES assets(id)
);

CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    world_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    data BLOB NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (world_id) REFERENCES worlds(id)
);

CREATE TABLE IF NOT EXISTS map_entities (
    id TEXT PRIMARY KEY,
    world_id TEXT NOT NULL,
    parent_map_entity_id TEXT,
    type TEXT NOT NULL CHECK(type IN ('region', 'settlement', 'landmark', 'district', 'infrastructure')),
    title TEXT NOT NULL,
    description TEXT,
    x REAL NOT NULL DEFAULT 0.0,
    y REAL NOT NULL DEFAULT 0.0,
    width REAL,
    height REAL,
    style_token TEXT,
    tags_text TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY (world_id) REFERENCES worlds(id),
    FOREIGN KEY (parent_map_entity_id) REFERENCES map_entities(id)
);

CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    world_id TEXT NOT NULL,
    image_asset_id TEXT,
    name TEXT NOT NULL,
    short_role TEXT,
    objective_summary TEXT,
    in_character_intro TEXT,
    decorative_ribbon TEXT,
    traits_text TEXT,
    card_layout_variant TEXT NOT NULL DEFAULT 'landscape',
    brief_details_json TEXT,
    sort_order INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY (world_id) REFERENCES worlds(id),
    FOREIGN KEY (image_asset_id) REFERENCES assets(id)
);

CREATE TABLE IF NOT EXISTS character_card_blocks (
    id TEXT PRIMARY KEY,
    character_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '{}',
    grid_column INTEGER NOT NULL,
    grid_row INTEGER NOT NULL,
    col_span INTEGER NOT NULL DEFAULT 1,
    row_span INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (character_id) REFERENCES characters(id)
);

CREATE TABLE IF NOT EXISTS character_detail_sections (
    id TEXT PRIMARY KEY,
    character_id TEXT NOT NULL,
    title TEXT NOT NULL,
    layout_type TEXT NOT NULL CHECK(layout_type IN ('prose', 'grid', 'timeline', 'cards')),
    content TEXT,
    structured_content_json TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (character_id) REFERENCES characters(id)
);

CREATE TABLE IF NOT EXISTS lore_folders (
    id TEXT PRIMARY KEY,
    world_id TEXT NOT NULL,
    parent_folder_id TEXT,
    title TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY (world_id) REFERENCES worlds(id),
    FOREIGN KEY (parent_folder_id) REFERENCES lore_folders(id)
);

CREATE TABLE IF NOT EXISTS lore_documents (
    id TEXT PRIMARY KEY,
    world_id TEXT NOT NULL,
    folder_id TEXT,
    title TEXT NOT NULL DEFAULT 'Untitled Document',
    content TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY (world_id) REFERENCES worlds(id),
    FOREIGN KEY (folder_id) REFERENCES lore_folders(id)
);

CREATE TABLE IF NOT EXISTS entity_links (
    id TEXT PRIMARY KEY,
    world_id TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK(source_type IN ('character', 'map_entity', 'lore_document')),
    source_id TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK(target_type IN ('character', 'map_entity', 'lore_document')),
    target_id TEXT NOT NULL,
    link_type TEXT NOT NULL DEFAULT 'related_to',
    created_at TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY (world_id) REFERENCES worlds(id)
);

CREATE TABLE IF NOT EXISTS canvas_paint_layers (
    id TEXT PRIMARY KEY,
    world_id TEXT NOT NULL,
    layer_data BLOB NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (world_id) REFERENCES worlds(id)
);
