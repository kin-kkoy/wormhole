-- Atlas Canvas detached for redesign: every atlas dataset leaves the schema.
-- The Atlas tab remains in the UI as an "In Development" placeholder; the
-- forward-looking architecture lives in references/atlas-2d-foundation.md.
-- Inline [[links]] to map entities inside rich text are rewritten to plain
-- text by migration v12 (Rust pass in migrations.rs).

-- Cross-reference rows first
DELETE FROM entity_links
 WHERE source_type = 'map_entity' OR target_type = 'map_entity';
DELETE FROM graph_shared_node_members WHERE entity_type = 'map_entity';
DELETE FROM graph_shared_nodes WHERE graph_type = 'atlas';

-- Atlas datasets
DROP TABLE IF EXISTS map_entities;
DROP TABLE IF EXISTS canvas_paint_layers;
DROP TABLE IF EXISTS atlas_canvas;
DROP TABLE IF EXISTS atlas_heightmap;
DROP TABLE IF EXISTS atlas_splat;
DROP TABLE IF EXISTS atlas_terrain_fields;
DROP TABLE IF EXISTS atlas_underground_graph;

-- Base-map reference columns on worlds
ALTER TABLE worlds DROP COLUMN atlas_base_map_asset_id;
ALTER TABLE worlds DROP COLUMN atlas_base_map_path;

UPDATE schema_version SET version = 11;
