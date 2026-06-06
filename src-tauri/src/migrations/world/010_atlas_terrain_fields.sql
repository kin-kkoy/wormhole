-- Atlas 2D rebuild: data-first terrain.
-- The world's terrain is a numerical dataset, not pixels: one row per
-- (world, layer) holding the elevation + material arrays verbatim.
--   layer     ∈ {'surface', 'underground'} (the Sky layer is sparse — it is
--               the map_entities table, not a field).
--   elevation = Float32 LE, grid_size² samples. Sea level is 0.0; new worlds
--               are fully flooded at -2.0 (deep ocean).
--   material  = Uint8, grid_size² codes into the frontend MATERIAL_INDEX
--               (append-only — see src/features/atlas/engine/materials.ts).
CREATE TABLE IF NOT EXISTS atlas_terrain_fields (
    world_id    TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    layer       TEXT NOT NULL,
    grid_size   INTEGER NOT NULL,
    elevation   BLOB NOT NULL,
    material    BLOB NOT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    PRIMARY KEY (world_id, layer)
);

-- Underground layer: a SUBTRACTIVE NODE GRAPH (carved chambers/tunnels), not
-- a dense field — see the foundation blueprint §3C. Stored as one JSON
-- document per world: {"nodes": [{id, x, y, radius, links_to, breaks_surface}]}.
CREATE TABLE IF NOT EXISTS atlas_underground_graph (
    world_id    TEXT PRIMARY KEY REFERENCES worlds(id) ON DELETE CASCADE,
    data        TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

-- Asset strategy: base maps are referenced by external path (lightweight,
-- portable world files; missing files degrade to a placeholder). The legacy
-- embedded-asset column (atlas_base_map_asset_id) remains readable.
ALTER TABLE worlds ADD COLUMN atlas_base_map_path TEXT;

UPDATE schema_version SET version = 10;
