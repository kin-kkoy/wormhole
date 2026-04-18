// Atlas Canvas commands — Stage 5
use crate::db::AppDatabase;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

const MAX_PARENT_DEPTH: usize = 5;

// ─── Structs ─────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct MapEntityFull {
    pub id: String,
    pub world_id: String,
    pub parent_map_entity_id: Option<String>,
    pub entity_type: String,
    pub title: String,
    pub description: Option<String>,
    pub x: f64,
    pub y: f64,
    pub width: Option<f64>,
    pub height: Option<f64>,
    pub style_token: Option<String>,
    pub tags_text: Option<String>,
    pub image_asset_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaintLayerData {
    pub data_base64: Option<String>,
    pub mime_type: String,
    pub updated_at: Option<String>,
}

// ─── Row helpers ─────────────────────────────────────────────────────────────

const FULL_COLUMNS: &str = "id, world_id, parent_map_entity_id, type, title, description, \
    x, y, width, height, style_token, tags_text, image_asset_id, created_at, updated_at";

fn row_to_full(row: &rusqlite::Row) -> rusqlite::Result<MapEntityFull> {
    Ok(MapEntityFull {
        id: row.get(0)?,
        world_id: row.get(1)?,
        parent_map_entity_id: row.get(2)?,
        entity_type: row.get(3)?,
        title: row.get(4)?,
        description: row.get(5)?,
        x: row.get(6)?,
        y: row.get(7)?,
        width: row.get(8)?,
        height: row.get(9)?,
        style_token: row.get(10)?,
        tags_text: row.get(11)?,
        image_asset_id: row.get(12)?,
        created_at: row.get(13)?,
        updated_at: row.get(14)?,
    })
}

fn query_entity_full(
    conn: &rusqlite::Connection,
    entity_id: &str,
) -> Result<MapEntityFull, String> {
    conn.query_row(
        &format!(
            "SELECT {} FROM map_entities WHERE id = ?1 AND deleted_at IS NULL",
            FULL_COLUMNS
        ),
        [entity_id],
        row_to_full,
    )
    .map_err(|e| format!("Map entity not found: {}", e))
}

// ─── Hierarchy helpers ───────────────────────────────────────────────────────

/// Walks up through parent_map_entity_id from `start_id` and returns the chain
/// (excluding `start_id` itself). Guards against cycles by bounding the walk to
/// 32 hops.
fn ancestors_of(
    conn: &rusqlite::Connection,
    start_id: &str,
) -> Result<Vec<String>, String> {
    let mut ancestors: Vec<String> = Vec::new();
    let mut cursor: Option<String> = conn
        .query_row(
            "SELECT parent_map_entity_id FROM map_entities WHERE id = ?1 AND deleted_at IS NULL",
            [start_id],
            |row| row.get::<_, Option<String>>(0),
        )
        .unwrap_or(None);

    let mut hops = 0;
    while let Some(id) = cursor {
        if hops > 32 {
            return Err("Parent chain exceeds safety limit (possible cycle)".to_string());
        }
        if ancestors.contains(&id) || id == start_id {
            return Err("Circular parent relationship detected".to_string());
        }
        let next: Option<String> = conn
            .query_row(
                "SELECT parent_map_entity_id FROM map_entities WHERE id = ?1 AND deleted_at IS NULL",
                [&id],
                |row| row.get::<_, Option<String>>(0),
            )
            .unwrap_or(None);
        ancestors.push(id);
        cursor = next;
        hops += 1;
    }
    Ok(ancestors)
}

/// Returns all descendant ids of `root_id` (not including `root_id`) via a
/// recursive CTE. Only considers active (non-deleted) rows.
fn descendants_of(
    conn: &rusqlite::Connection,
    root_id: &str,
) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare(
            "WITH RECURSIVE descendants(id) AS (
                SELECT id FROM map_entities
                WHERE parent_map_entity_id = ?1 AND deleted_at IS NULL
                UNION ALL
                SELECT me.id FROM map_entities me
                JOIN descendants d ON me.parent_map_entity_id = d.id
                WHERE me.deleted_at IS NULL
            )
            SELECT id FROM descendants",
        )
        .map_err(|e| format!("Failed to prepare descendants query: {}", e))?;

    let ids: Vec<String> = stmt
        .query_map([root_id], |row| row.get::<_, String>(0))
        .map_err(|e| format!("Failed to query descendants: {}", e))?
        .filter_map(|r| r.ok())
        .collect();
    Ok(ids)
}

/// Walk soft-deleted descendants of a root entity. Used by restore to undo a
/// cascade soft-delete symmetrically.
fn soft_deleted_descendants_of(
    conn: &rusqlite::Connection,
    root_id: &str,
) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare(
            "WITH RECURSIVE descendants(id) AS (
                SELECT id FROM map_entities
                WHERE parent_map_entity_id = ?1 AND deleted_at IS NOT NULL
                UNION ALL
                SELECT me.id FROM map_entities me
                JOIN descendants d ON me.parent_map_entity_id = d.id
                WHERE me.deleted_at IS NOT NULL
            )
            SELECT id FROM descendants",
        )
        .map_err(|e| format!("Failed to prepare soft-deleted descendants query: {}", e))?;

    let ids: Vec<String> = stmt
        .query_map([root_id], |row| row.get::<_, String>(0))
        .map_err(|e| format!("Failed to query soft-deleted descendants: {}", e))?
        .filter_map(|r| r.ok())
        .collect();
    Ok(ids)
}

/// Validates that `proposed_parent_id` would be a legal parent for `entity_id`
/// (or for a new entity with id == None). Enforces:
///   - No self-parenting.
///   - No cycles (proposed parent cannot be a descendant of the entity).
///   - Resulting parent chain cannot exceed MAX_PARENT_DEPTH.
fn validate_parent(
    conn: &rusqlite::Connection,
    entity_id: Option<&str>,
    proposed_parent_id: &str,
) -> Result<(), String> {
    if let Some(id) = entity_id {
        if id == proposed_parent_id {
            return Err("An entity cannot be its own parent".to_string());
        }
    }

    // Parent must exist and be active
    let parent_exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM map_entities WHERE id = ?1 AND deleted_at IS NULL",
            [proposed_parent_id],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|e| format!("Failed to check parent existence: {}", e))?
        > 0;
    if !parent_exists {
        return Err("Parent map entity not found".to_string());
    }

    // If editing an existing entity, the new parent must not be one of its
    // descendants (that would introduce a cycle).
    if let Some(id) = entity_id {
        let descendants = descendants_of(conn, id)?;
        if descendants.iter().any(|d| d == proposed_parent_id) {
            return Err("Cannot set parent to a descendant of this entity".to_string());
        }
    }

    // Depth check: parent's ancestor chain length + 1 (parent itself) + any
    // descendants of the entity being edited must not exceed MAX_PARENT_DEPTH.
    let parent_ancestors = ancestors_of(conn, proposed_parent_id)?;
    let depth_above = parent_ancestors.len() + 1; // ancestors + parent itself
    let depth_below = if let Some(id) = entity_id {
        // descendant chain length from this entity
        subtree_depth(conn, id)?
    } else {
        0
    };
    if depth_above + depth_below + 1 > MAX_PARENT_DEPTH {
        return Err(format!(
            "Parent-child chain would exceed max depth of {}",
            MAX_PARENT_DEPTH
        ));
    }
    Ok(())
}

/// Returns the max chain length rooted at `root_id` (0 if no children).
fn subtree_depth(
    conn: &rusqlite::Connection,
    root_id: &str,
) -> Result<usize, String> {
    fn recurse(
        conn: &rusqlite::Connection,
        id: &str,
        visited: &mut Vec<String>,
    ) -> Result<usize, String> {
        if visited.contains(&id.to_string()) {
            return Ok(0);
        }
        visited.push(id.to_string());

        let mut stmt = conn
            .prepare(
                "SELECT id FROM map_entities WHERE parent_map_entity_id = ?1 AND deleted_at IS NULL",
            )
            .map_err(|e| format!("Failed to query children: {}", e))?;
        let children: Vec<String> = stmt
            .query_map([id], |row| row.get::<_, String>(0))
            .map_err(|e| format!("Failed to read children: {}", e))?
            .filter_map(|r| r.ok())
            .collect();
        let mut max = 0;
        for c in children {
            let d = recurse(conn, &c, visited)?;
            if d + 1 > max {
                max = d + 1;
            }
        }
        Ok(max)
    }
    let mut visited = Vec::new();
    recurse(conn, root_id, &mut visited)
}

// ─── Map Entity commands ─────────────────────────────────────────────────────

#[tauri::command]
pub fn list_map_entities(
    state: State<Mutex<AppDatabase>>,
) -> Result<Vec<MapEntityFull>, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let mut stmt = conn
        .prepare(&format!(
            "SELECT {} FROM map_entities WHERE deleted_at IS NULL ORDER BY created_at ASC",
            FULL_COLUMNS
        ))
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let entities: Vec<MapEntityFull> = stmt
        .query_map([], row_to_full)
        .map_err(|e| format!("Failed to query map entities: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(entities)
}

#[tauri::command]
pub fn get_map_entity(
    entity_id: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<MapEntityFull, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    query_entity_full(conn, &entity_id)
}

#[tauri::command]
pub fn create_map_entity(
    entity_type: String,
    title: String,
    x: f64,
    y: f64,
    parent_map_entity_id: Option<String>,
    description: Option<String>,
    tags_text: Option<String>,
    image_asset_id: Option<String>,
    state: State<Mutex<AppDatabase>>,
) -> Result<MapEntityFull, String> {
    // Validate type against schema CHECK constraint for a friendlier error
    const VALID_TYPES: [&str; 5] = [
        "region",
        "settlement",
        "landmark",
        "district",
        "infrastructure",
    ];
    if !VALID_TYPES.contains(&entity_type.as_str()) {
        return Err(format!(
            "Invalid entity type '{}'. Must be one of: {}",
            entity_type,
            VALID_TYPES.join(", ")
        ));
    }
    if title.trim().is_empty() {
        return Err("Title is required".to_string());
    }

    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (world_id, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    if let Some(ref pid) = parent_map_entity_id {
        validate_parent(conn, None, pid)?;
    }

    let entity_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO map_entities (id, world_id, parent_map_entity_id, type, title, \
         description, x, y, tags_text, image_asset_id, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        rusqlite::params![
            entity_id,
            world_id,
            parent_map_entity_id,
            entity_type,
            title.trim(),
            description,
            x,
            y,
            tags_text,
            image_asset_id,
            now,
            now
        ],
    )
    .map_err(|e| format!("Failed to create map entity: {}", e))?;

    query_entity_full(conn, &entity_id)
}

/// Lightweight position-only update — used on drag.
#[tauri::command]
pub fn update_map_entity_position(
    entity_id: String,
    x: f64,
    y: f64,
    state: State<Mutex<AppDatabase>>,
) -> Result<(), String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE map_entities SET x = ?1, y = ?2, updated_at = ?3 WHERE id = ?4 AND deleted_at IS NULL",
        rusqlite::params![x, y, now, entity_id],
    )
    .map_err(|e| format!("Failed to update position: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn update_map_entity(
    entity_id: String,
    title: Option<String>,
    entity_type: Option<String>,
    description: Option<String>,
    parent_map_entity_id: Option<String>,
    clear_parent: Option<bool>,
    x: Option<f64>,
    y: Option<f64>,
    tags_text: Option<String>,
    image_asset_id: Option<String>,
    clear_image: Option<bool>,
    state: State<Mutex<AppDatabase>>,
) -> Result<MapEntityFull, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    // Validate parent change before writing
    if let Some(ref pid) = parent_map_entity_id {
        validate_parent(conn, Some(&entity_id), pid)?;
    }
    if let Some(ref t) = entity_type {
        const VALID_TYPES: [&str; 5] = [
            "region",
            "settlement",
            "landmark",
            "district",
            "infrastructure",
        ];
        if !VALID_TYPES.contains(&t.as_str()) {
            return Err(format!("Invalid entity type '{}'", t));
        }
    }

    let now = chrono::Utc::now().to_rfc3339();
    let mut set_clauses = vec!["updated_at = ?1".to_string()];
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(now.clone())];
    let mut idx = 2;

    macro_rules! add_field {
        ($field:expr, $val:expr) => {
            if let Some(ref v) = $val {
                set_clauses.push(format!("{} = ?{}", $field, idx));
                params.push(Box::new(v.clone()));
                idx += 1;
            }
        };
    }

    add_field!("title", title);
    add_field!("type", entity_type);
    add_field!("description", description);
    add_field!("tags_text", tags_text);

    if let Some(true) = clear_parent {
        set_clauses.push("parent_map_entity_id = NULL".to_string());
    } else if let Some(ref pid) = parent_map_entity_id {
        set_clauses.push(format!("parent_map_entity_id = ?{}", idx));
        params.push(Box::new(pid.clone()));
        idx += 1;
    }

    if let Some(xv) = x {
        set_clauses.push(format!("x = ?{}", idx));
        params.push(Box::new(xv));
        idx += 1;
    }
    if let Some(yv) = y {
        set_clauses.push(format!("y = ?{}", idx));
        params.push(Box::new(yv));
        idx += 1;
    }

    if let Some(true) = clear_image {
        set_clauses.push("image_asset_id = NULL".to_string());
    } else if let Some(ref img) = image_asset_id {
        set_clauses.push(format!("image_asset_id = ?{}", idx));
        params.push(Box::new(img.clone()));
        idx += 1;
    }

    let _ = idx;

    let sql = format!(
        "UPDATE map_entities SET {} WHERE id = ?{} AND deleted_at IS NULL",
        set_clauses.join(", "),
        params.len() + 1
    );
    params.push(Box::new(entity_id.clone()));

    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, param_refs.as_slice())
        .map_err(|e| format!("Failed to update map entity: {}", e))?;

    query_entity_full(conn, &entity_id)
}

#[tauri::command]
pub fn delete_map_entity(
    entity_id: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<(), String> {
    let mut db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_mut()
        .ok_or("No world is currently open")?;

    let now = chrono::Utc::now().to_rfc3339();

    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    // Collect entity + descendants
    let descendants = descendants_of(&tx, &entity_id)?;
    let mut all_ids: Vec<String> = Vec::with_capacity(descendants.len() + 1);
    all_ids.push(entity_id.clone());
    all_ids.extend(descendants);

    for id in &all_ids {
        tx.execute(
            "UPDATE map_entities SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND deleted_at IS NULL",
            rusqlite::params![now, id],
        )
        .map_err(|e| format!("Failed to soft-delete map entity: {}", e))?;

        tx.execute(
            "UPDATE entity_links SET deleted_at = ?1 WHERE deleted_at IS NULL AND \
             ((source_type = 'map_entity' AND source_id = ?2) OR \
              (target_type = 'map_entity' AND target_id = ?2))",
            rusqlite::params![now, id],
        )
        .map_err(|e| format!("Failed to soft-delete entity links: {}", e))?;

        // Remove from any shared node membership (hard delete; this is just
        // group membership metadata and has no soft-delete column)
        tx.execute(
            "DELETE FROM graph_shared_node_members WHERE entity_type = 'map_entity' AND entity_id = ?1",
            [id],
        )
        .map_err(|e| format!("Failed to remove shared node membership: {}", e))?;
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit delete: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn restore_map_entity(
    entity_id: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<MapEntityFull, String> {
    let mut db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_mut()
        .ok_or("No world is currently open")?;

    let now = chrono::Utc::now().to_rfc3339();

    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    // Symmetric to delete: restore the entity AND all descendants that were
    // soft-deleted, plus their entity_links.
    let descendants = soft_deleted_descendants_of(&tx, &entity_id)?;
    let mut all_ids: Vec<String> = Vec::with_capacity(descendants.len() + 1);
    all_ids.push(entity_id.clone());
    all_ids.extend(descendants);

    for id in &all_ids {
        tx.execute(
            "UPDATE map_entities SET deleted_at = NULL, updated_at = ?1 WHERE id = ?2",
            rusqlite::params![now, id],
        )
        .map_err(|e| format!("Failed to restore map entity: {}", e))?;

        tx.execute(
            "UPDATE entity_links SET deleted_at = NULL WHERE deleted_at IS NOT NULL AND \
             ((source_type = 'map_entity' AND source_id = ?1) OR \
              (target_type = 'map_entity' AND target_id = ?1))",
            [id],
        )
        .map_err(|e| format!("Failed to restore entity links: {}", e))?;
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit restore: {}", e))?;

    query_entity_full(conn, &entity_id)
}

// ─── Paint Layer commands ────────────────────────────────────────────────────

#[tauri::command]
pub fn get_paint_layer(
    state: State<Mutex<AppDatabase>>,
) -> Result<PaintLayerData, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (world_id, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let result = conn.query_row(
        "SELECT layer_data, updated_at FROM canvas_paint_layers WHERE world_id = ?1",
        [world_id],
        |row| {
            let data: Vec<u8> = row.get(0)?;
            let updated_at: String = row.get(1)?;
            Ok((data, updated_at))
        },
    );

    match result {
        Ok((data, updated_at)) => {
            let data_base64 = base64::engine::general_purpose::STANDARD.encode(&data);
            Ok(PaintLayerData {
                data_base64: Some(data_base64),
                mime_type: "image/png".to_string(),
                updated_at: Some(updated_at),
            })
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(PaintLayerData {
            data_base64: None,
            mime_type: "image/png".to_string(),
            updated_at: None,
        }),
        Err(e) => Err(format!("Failed to load paint layer: {}", e)),
    }
}

#[tauri::command]
pub fn save_paint_layer(
    png_base64: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<(), String> {
    let png_bytes = base64::engine::general_purpose::STANDARD
        .decode(png_base64.as_bytes())
        .map_err(|e| format!("Invalid base64 payload: {}", e))?;

    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (world_id, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let now = chrono::Utc::now().to_rfc3339();

    // Upsert by (world_id) — guaranteed unique by migration v3
    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM canvas_paint_layers WHERE world_id = ?1",
            [world_id],
            |row| row.get::<_, String>(0),
        )
        .ok();

    if let Some(id) = existing {
        conn.execute(
            "UPDATE canvas_paint_layers SET layer_data = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![png_bytes, now, id],
        )
        .map_err(|e| format!("Failed to update paint layer: {}", e))?;
    } else {
        let new_id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO canvas_paint_layers (id, world_id, layer_data, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?4)",
            rusqlite::params![new_id, world_id, png_bytes, now],
        )
        .map_err(|e| format!("Failed to insert paint layer: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn clear_paint_layer(
    state: State<Mutex<AppDatabase>>,
) -> Result<(), String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (world_id, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    conn.execute(
        "DELETE FROM canvas_paint_layers WHERE world_id = ?1",
        [world_id],
    )
    .map_err(|e| format!("Failed to clear paint layer: {}", e))?;
    Ok(())
}

// ─── Base Map commands ───────────────────────────────────────────────────────

#[tauri::command]
pub fn get_atlas_base_map(
    state: State<Mutex<AppDatabase>>,
) -> Result<Option<String>, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (world_id, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let asset_id: Option<String> = conn
        .query_row(
            "SELECT atlas_base_map_asset_id FROM worlds WHERE id = ?1",
            [world_id],
            |row| row.get::<_, Option<String>>(0),
        )
        .map_err(|e| format!("Failed to read base map: {}", e))?;

    Ok(asset_id)
}

#[tauri::command]
pub fn set_atlas_base_map(
    asset_id: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<(), String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (world_id, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE worlds SET atlas_base_map_asset_id = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![asset_id, now, world_id],
    )
    .map_err(|e| format!("Failed to set base map: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn clear_atlas_base_map(
    state: State<Mutex<AppDatabase>>,
) -> Result<(), String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (world_id, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE worlds SET atlas_base_map_asset_id = NULL, updated_at = ?1 WHERE id = ?2",
        rusqlite::params![now, world_id],
    )
    .map_err(|e| format!("Failed to clear base map: {}", e))?;
    Ok(())
}

// ─── Recycle Bin ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct DeletedMapEntity {
    pub id: String,
    pub title: String,
    pub deleted_at: String,
}

#[tauri::command]
pub fn list_deleted_map_entities(
    state: State<Mutex<AppDatabase>>,
) -> Result<Vec<DeletedMapEntity>, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let mut stmt = conn
        .prepare(
            "SELECT id, title, deleted_at FROM map_entities \
             WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(DeletedMapEntity {
                id: row.get(0)?,
                title: row.get(1)?,
                deleted_at: row.get(2)?,
            })
        })
        .map_err(|e| format!("Failed to query deleted map entities: {}", e))?;

    Ok(rows.flatten().collect())
}

#[tauri::command]
pub fn purge_map_entity(
    entity_id: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<(), String> {
    let mut db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_mut()
        .ok_or("No world is currently open")?;

    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    // Collect the entity + any soft-deleted descendants (the cascade from
    // delete_map_entity). They all get hard-purged together.
    let soft_descendants = soft_deleted_descendants_of(&tx, &entity_id)?;
    let mut all_ids: Vec<String> = Vec::with_capacity(soft_descendants.len() + 1);
    all_ids.push(entity_id.clone());
    all_ids.extend(soft_descendants);

    for id in &all_ids {
        tx.execute(
            "DELETE FROM entity_links WHERE \
             (source_type = 'map_entity' AND source_id = ?1) OR \
             (target_type = 'map_entity' AND target_id = ?1)",
            [id],
        )
        .map_err(|e| format!("Failed to purge entity links: {}", e))?;

        tx.execute(
            "DELETE FROM graph_shared_node_members WHERE entity_type = 'map_entity' AND entity_id = ?1",
            [id],
        )
        .map_err(|e| format!("Failed to remove shared node membership: {}", e))?;

        tx.execute("DELETE FROM map_entities WHERE id = ?1", [id])
            .map_err(|e| format!("Failed to purge map entity: {}", e))?;
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit purge: {}", e))?;

    Ok(())
}
