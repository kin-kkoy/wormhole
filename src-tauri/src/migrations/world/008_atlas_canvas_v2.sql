-- Packet 9: Atlas Canvas v2 — layered 3D terrain painting
-- One canvas dataset per world: heightmap (Float32) + per-surface splat (RGBA8).

CREATE TABLE IF NOT EXISTS atlas_canvas (
    world_id          TEXT PRIMARY KEY REFERENCES worlds(id) ON DELETE CASCADE,
    size              INTEGER NOT NULL DEFAULT 100,
    resolution        INTEGER NOT NULL DEFAULT 161,
    splat_resolution  INTEGER NOT NULL DEFAULT 512,
    view_state_json   TEXT,
    shader_pack_id    TEXT,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL
);

-- Heightmap: Float32Array, length = resolution * resolution, normalized 0..1.
CREATE TABLE IF NOT EXISTS atlas_heightmap (
    world_id          TEXT PRIMARY KEY REFERENCES worlds(id) ON DELETE CASCADE,
    data              BLOB NOT NULL,
    updated_at        TEXT NOT NULL
);

-- Material splat textures, one row per (world, surface). surface ∈ {'upper','underground'}.
-- data = raw RGBA8, length = splat_resolution^2 * 4.
CREATE TABLE IF NOT EXISTS atlas_splat (
    world_id          TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    surface           TEXT NOT NULL,
    data              BLOB NOT NULL,
    updated_at        TEXT NOT NULL,
    PRIMARY KEY (world_id, surface)
);

UPDATE schema_version SET version = 8;
