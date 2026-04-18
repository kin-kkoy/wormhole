-- Stage 5: Atlas Canvas
-- One paint layer per world (V1: a single flat raster)
CREATE UNIQUE INDEX IF NOT EXISTS idx_canvas_paint_layers_world_unique
    ON canvas_paint_layers(world_id);

-- Base map image reference on the world record
ALTER TABLE worlds ADD COLUMN atlas_base_map_asset_id TEXT
    REFERENCES assets(id);

-- Helpful indices for map_entity queries (list, parent lookup)
CREATE INDEX IF NOT EXISTS idx_map_entities_world_active
    ON map_entities(world_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_map_entities_parent
    ON map_entities(parent_map_entity_id);

UPDATE schema_version SET version = 3;
