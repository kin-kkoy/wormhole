use crate::db::AppDatabase;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

// ─── Data types ───────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct AtlasNodeData {
    pub id: String,
    pub title: String,
    pub entity_type: String,
    pub parent_map_entity_id: Option<String>,
    pub image_asset_id: Option<String>,
    pub tags_text: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EntityLinkData {
    pub id: String,
    pub source_type: String,
    pub source_id: String,
    pub target_type: String,
    pub target_id: String,
    pub link_type: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SharedNodeData {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
    pub font_style: String,
    pub font_size: f64,
    pub auto_generated: bool,
    pub source_tag: Option<String>,
    pub hidden: bool,
    pub member_ids: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AtlasGraphData {
    pub entities: Vec<AtlasNodeData>,
    pub links: Vec<EntityLinkData>,
    pub shared_nodes: Vec<SharedNodeData>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CharacterNodeData {
    pub id: String,
    pub name: String,
    pub image_asset_id: Option<String>,
    pub tags_text: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CharacterLocationLink {
    pub character_id: String,
    pub map_entity_id: String,
    pub map_entity_title: String,
    pub link_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CharactersGraphData {
    pub characters: Vec<CharacterNodeData>,
    pub location_links: Vec<CharacterLocationLink>,
    pub shared_nodes: Vec<SharedNodeData>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoreFolderData {
    pub id: String,
    pub title: String,
    pub parent_folder_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoreDocumentData {
    pub id: String,
    pub title: String,
    pub folder_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoreGraphData {
    pub folders: Vec<LoreFolderData>,
    pub documents: Vec<LoreDocumentData>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AssetBatchItem {
    pub id: String,
    pub file_name: String,
    pub mime_type: String,
    pub data_base64: String,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn query_shared_nodes(
    conn: &rusqlite::Connection,
    graph_type: &str,
) -> Result<Vec<SharedNodeData>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, color, font_style, font_size, auto_generated, source_tag, hidden \
             FROM graph_shared_nodes WHERE graph_type = ?1 ORDER BY name",
        )
        .map_err(|e| format!("Failed to prepare shared nodes query: {}", e))?;

    let nodes: Vec<(String, String, Option<String>, String, f64, bool, Option<String>, bool)> =
        stmt.query_map([graph_type], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, f64>(4)?,
                row.get::<_, bool>(5)?,
                row.get::<_, Option<String>>(6)?,
                row.get::<_, bool>(7)?,
            ))
        })
        .map_err(|e| format!("Failed to query shared nodes: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let mut result = Vec::new();
    for (id, name, color, font_style, font_size, auto_gen, source_tag, hidden) in nodes {
        let mut member_stmt = conn
            .prepare(
                "SELECT entity_id FROM graph_shared_node_members WHERE shared_node_id = ?1",
            )
            .map_err(|e| format!("Failed to prepare members query: {}", e))?;

        let member_ids: Vec<String> = member_stmt
            .query_map([&id], |row| row.get(0))
            .map_err(|e| format!("Failed to query members: {}", e))?
            .filter_map(|r| r.ok())
            .collect();

        result.push(SharedNodeData {
            id,
            name,
            color,
            font_style,
            font_size,
            auto_generated: auto_gen,
            source_tag,
            hidden,
            member_ids,
        });
    }

    Ok(result)
}

// ─── Graph data queries ───────────────────────────────────────────────────────

#[tauri::command]
pub fn get_atlas_graph_data(
    state: State<Mutex<AppDatabase>>,
) -> Result<AtlasGraphData, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    // All non-deleted map entities
    let mut entity_stmt = conn
        .prepare(
            "SELECT id, title, type, parent_map_entity_id, image_asset_id, tags_text \
             FROM map_entities WHERE deleted_at IS NULL ORDER BY title",
        )
        .map_err(|e| format!("Failed to prepare atlas query: {}", e))?;

    let entities: Vec<AtlasNodeData> = entity_stmt
        .query_map([], |row| {
            Ok(AtlasNodeData {
                id: row.get(0)?,
                title: row.get(1)?,
                entity_type: row.get(2)?,
                parent_map_entity_id: row.get(3)?,
                image_asset_id: row.get(4)?,
                tags_text: row.get(5)?,
            })
        })
        .map_err(|e| format!("Failed to query atlas entities: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    // Entity links between map entities only
    let mut link_stmt = conn
        .prepare(
            "SELECT id, source_type, source_id, target_type, target_id, link_type \
             FROM entity_links \
             WHERE source_type = 'map_entity' AND target_type = 'map_entity' \
             AND deleted_at IS NULL",
        )
        .map_err(|e| format!("Failed to prepare atlas links query: {}", e))?;

    let links: Vec<EntityLinkData> = link_stmt
        .query_map([], |row| {
            Ok(EntityLinkData {
                id: row.get(0)?,
                source_type: row.get(1)?,
                source_id: row.get(2)?,
                target_type: row.get(3)?,
                target_id: row.get(4)?,
                link_type: row.get(5)?,
            })
        })
        .map_err(|e| format!("Failed to query atlas links: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let shared_nodes = query_shared_nodes(conn, "atlas")?;

    Ok(AtlasGraphData {
        entities,
        links,
        shared_nodes,
    })
}

#[tauri::command]
pub fn get_characters_graph_data(
    state: State<Mutex<AppDatabase>>,
) -> Result<CharactersGraphData, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    // All non-deleted characters
    let mut char_stmt = conn
        .prepare(
            "SELECT id, name, image_asset_id, tags_text \
             FROM characters WHERE deleted_at IS NULL ORDER BY name",
        )
        .map_err(|e| format!("Failed to prepare characters query: {}", e))?;

    let characters: Vec<CharacterNodeData> = char_stmt
        .query_map([], |row| {
            Ok(CharacterNodeData {
                id: row.get(0)?,
                name: row.get(1)?,
                image_asset_id: row.get(2)?,
                tags_text: row.get(3)?,
            })
        })
        .map_err(|e| format!("Failed to query characters: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    // Character → map_entity links (for Location Affiliation)
    let mut loc_stmt = conn
        .prepare(
            "SELECT el.source_id, el.target_id, me.title, el.link_type \
             FROM entity_links el \
             JOIN map_entities me ON me.id = el.target_id \
             WHERE el.source_type = 'character' AND el.target_type = 'map_entity' \
             AND el.deleted_at IS NULL AND me.deleted_at IS NULL \
             UNION ALL \
             SELECT el.target_id, el.source_id, me.title, el.link_type \
             FROM entity_links el \
             JOIN map_entities me ON me.id = el.source_id \
             WHERE el.target_type = 'character' AND el.source_type = 'map_entity' \
             AND el.deleted_at IS NULL AND me.deleted_at IS NULL",
        )
        .map_err(|e| format!("Failed to prepare location links query: {}", e))?;

    let location_links: Vec<CharacterLocationLink> = loc_stmt
        .query_map([], |row| {
            Ok(CharacterLocationLink {
                character_id: row.get(0)?,
                map_entity_id: row.get(1)?,
                map_entity_title: row.get(2)?,
                link_type: row.get(3)?,
            })
        })
        .map_err(|e| format!("Failed to query location links: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let shared_nodes = query_shared_nodes(conn, "characters")?;

    Ok(CharactersGraphData {
        characters,
        location_links,
        shared_nodes,
    })
}

#[tauri::command]
pub fn get_lore_graph_data(
    state: State<Mutex<AppDatabase>>,
) -> Result<LoreGraphData, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let mut folder_stmt = conn
        .prepare(
            "SELECT id, title, parent_folder_id FROM lore_folders \
             WHERE deleted_at IS NULL ORDER BY sort_order, title",
        )
        .map_err(|e| format!("Failed to prepare folders query: {}", e))?;

    let folders: Vec<LoreFolderData> = folder_stmt
        .query_map([], |row| {
            Ok(LoreFolderData {
                id: row.get(0)?,
                title: row.get(1)?,
                parent_folder_id: row.get(2)?,
            })
        })
        .map_err(|e| format!("Failed to query folders: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let mut doc_stmt = conn
        .prepare(
            "SELECT id, title, folder_id FROM lore_documents \
             WHERE deleted_at IS NULL ORDER BY title",
        )
        .map_err(|e| format!("Failed to prepare documents query: {}", e))?;

    let documents: Vec<LoreDocumentData> = doc_stmt
        .query_map([], |row| {
            Ok(LoreDocumentData {
                id: row.get(0)?,
                title: row.get(1)?,
                folder_id: row.get(2)?,
            })
        })
        .map_err(|e| format!("Failed to query documents: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(LoreGraphData { folders, documents })
}

// ─── Shared node CRUD ─────────────────────────────────────────────────────────

#[tauri::command]
pub fn create_shared_node(
    graph_type: String,
    name: String,
    color: Option<String>,
    font_style: Option<String>,
    font_size: Option<f64>,
    state: State<Mutex<AppDatabase>>,
) -> Result<SharedNodeData, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (world_id, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let fs = font_style.unwrap_or_else(|| "normal".to_string());
    let fsz = font_size.unwrap_or(14.0);

    conn.execute(
        "INSERT INTO graph_shared_nodes (id, world_id, graph_type, name, color, font_style, font_size, auto_generated, hidden, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, 0, ?8, ?9)",
        rusqlite::params![id, world_id, graph_type, name, color, fs, fsz, now, now],
    )
    .map_err(|e| format!("Failed to create shared node: {}", e))?;

    Ok(SharedNodeData {
        id,
        name,
        color,
        font_style: fs,
        font_size: fsz,
        auto_generated: false,
        source_tag: None,
        hidden: false,
        member_ids: vec![],
    })
}

#[tauri::command]
pub fn update_shared_node(
    id: String,
    name: Option<String>,
    color: Option<String>,
    font_style: Option<String>,
    font_size: Option<f64>,
    hidden: Option<bool>,
    state: State<Mutex<AppDatabase>>,
) -> Result<SharedNodeData, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let now = chrono::Utc::now().to_rfc3339();

    let mut set_clauses = vec!["updated_at = ?1".to_string()];
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(now)];
    let mut idx = 2;

    if let Some(ref n) = name {
        set_clauses.push(format!("name = ?{}", idx));
        params.push(Box::new(n.clone()));
        idx += 1;
    }
    if let Some(ref c) = color {
        set_clauses.push(format!("color = ?{}", idx));
        params.push(Box::new(c.clone()));
        idx += 1;
    }
    if let Some(ref fs) = font_style {
        set_clauses.push(format!("font_style = ?{}", idx));
        params.push(Box::new(fs.clone()));
        idx += 1;
    }
    if let Some(fsz) = font_size {
        set_clauses.push(format!("font_size = ?{}", idx));
        params.push(Box::new(fsz));
        idx += 1;
    }
    if let Some(h) = hidden {
        set_clauses.push(format!("hidden = ?{}", idx));
        params.push(Box::new(h));
        idx += 1;
    }
    let _ = idx;

    let sql = format!(
        "UPDATE graph_shared_nodes SET {} WHERE id = ?{}",
        set_clauses.join(", "),
        params.len() + 1
    );
    params.push(Box::new(id.clone()));

    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, param_refs.as_slice())
        .map_err(|e| format!("Failed to update shared node: {}", e))?;

    // Return updated data
    let node = conn
        .query_row(
            "SELECT id, name, color, font_style, font_size, auto_generated, source_tag, hidden \
             FROM graph_shared_nodes WHERE id = ?1",
            [&id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, f64>(4)?,
                    row.get::<_, bool>(5)?,
                    row.get::<_, Option<String>>(6)?,
                    row.get::<_, bool>(7)?,
                ))
            },
        )
        .map_err(|e| format!("Shared node not found: {}", e))?;

    let mut member_stmt = conn
        .prepare("SELECT entity_id FROM graph_shared_node_members WHERE shared_node_id = ?1")
        .map_err(|e| format!("Failed to prepare members query: {}", e))?;
    let member_ids: Vec<String> = member_stmt
        .query_map([&id], |row| row.get(0))
        .map_err(|e| format!("Failed to query members: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(SharedNodeData {
        id: node.0,
        name: node.1,
        color: node.2,
        font_style: node.3,
        font_size: node.4,
        auto_generated: node.5,
        source_tag: node.6,
        hidden: node.7,
        member_ids,
    })
}

#[tauri::command]
pub fn delete_shared_node(
    id: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<(), String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    conn.execute("DELETE FROM graph_shared_nodes WHERE id = ?1", [&id])
        .map_err(|e| format!("Failed to delete shared node: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn add_shared_node_member(
    shared_node_id: String,
    entity_type: String,
    entity_id: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<String, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    // Check for duplicate
    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM graph_shared_node_members \
             WHERE shared_node_id = ?1 AND entity_id = ?2",
            rusqlite::params![shared_node_id, entity_id],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if exists {
        return Err("Entity is already a member of this shared node".to_string());
    }

    let member_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO graph_shared_node_members (id, shared_node_id, entity_type, entity_id, created_at) \
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![member_id, shared_node_id, entity_type, entity_id, now],
    )
    .map_err(|e| format!("Failed to add member: {}", e))?;

    Ok(member_id)
}

#[tauri::command]
pub fn remove_shared_node_member(
    shared_node_id: String,
    entity_id: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<(), String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    conn.execute(
        "DELETE FROM graph_shared_node_members WHERE shared_node_id = ?1 AND entity_id = ?2",
        rusqlite::params![shared_node_id, entity_id],
    )
    .map_err(|e| format!("Failed to remove member: {}", e))?;

    Ok(())
}

// ─── Auto-detection ───────────────────────────────────────────────────────────

#[tauri::command]
pub fn auto_detect_shared_nodes(
    graph_type: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<Vec<SharedNodeData>, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (world_id, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let now = chrono::Utc::now().to_rfc3339();

    // Collect tags from the relevant table
    let (query, entity_type_str) = match graph_type.as_str() {
        "atlas" => (
            "SELECT id, tags_text FROM map_entities WHERE deleted_at IS NULL AND tags_text IS NOT NULL",
            "map_entity",
        ),
        "characters" => (
            "SELECT id, tags_text FROM characters WHERE deleted_at IS NULL AND tags_text IS NOT NULL",
            "character",
        ),
        _ => return Err("Invalid graph_type".to_string()),
    };

    let mut stmt = conn
        .prepare(query)
        .map_err(|e| format!("Failed to prepare tags query: {}", e))?;

    let rows: Vec<(String, String)> = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| format!("Failed to query tags: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    // Group entity IDs by tag
    let mut tag_groups: HashMap<String, Vec<String>> = HashMap::new();
    for (entity_id, tags_text) in &rows {
        for tag in tags_text.split(',') {
            let tag = tag.trim().to_lowercase();
            if !tag.is_empty() {
                tag_groups
                    .entry(tag)
                    .or_default()
                    .push(entity_id.clone());
            }
        }
    }

    // For tags with 3+ entities, create or update shared nodes
    for (tag, entity_ids) in &tag_groups {
        if entity_ids.len() < 3 {
            continue;
        }

        // Check if auto-generated node for this tag already exists
        let existing_id: Option<String> = conn
            .query_row(
                "SELECT id FROM graph_shared_nodes \
                 WHERE graph_type = ?1 AND auto_generated = 1 AND source_tag = ?2",
                rusqlite::params![graph_type, tag],
                |row| row.get(0),
            )
            .ok();

        let node_id = if let Some(eid) = existing_id {
            // Update timestamp
            conn.execute(
                "UPDATE graph_shared_nodes SET updated_at = ?1 WHERE id = ?2",
                rusqlite::params![now, eid],
            )
            .ok();
            eid
        } else {
            // Create new auto-generated shared node
            let nid = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO graph_shared_nodes (id, world_id, graph_type, name, auto_generated, source_tag, hidden, created_at, updated_at) \
                 VALUES (?1, ?2, ?3, ?4, 1, ?5, 0, ?6, ?7)",
                rusqlite::params![nid, world_id, graph_type, tag, tag, now, now],
            )
            .map_err(|e| format!("Failed to create auto shared node: {}", e))?;
            nid
        };

        // Sync members: remove stale, add new
        conn.execute(
            "DELETE FROM graph_shared_node_members WHERE shared_node_id = ?1",
            [&node_id],
        )
        .ok();

        for eid in entity_ids {
            let mid = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO graph_shared_node_members (id, shared_node_id, entity_type, entity_id, created_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![mid, node_id, entity_type_str, eid, now],
            )
            .ok();
        }
    }

    query_shared_nodes(conn, &graph_type)
}

// ─── Batch image loading ──────────────────────────────────────────────────────

#[tauri::command]
pub fn get_asset_batch(
    asset_ids: Vec<String>,
    state: State<Mutex<AppDatabase>>,
) -> Result<Vec<AssetBatchItem>, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    if asset_ids.is_empty() {
        return Ok(vec![]);
    }

    let placeholders: Vec<String> = (1..=asset_ids.len()).map(|i| format!("?{}", i)).collect();
    let sql = format!(
        "SELECT id, file_name, mime_type, data FROM assets WHERE id IN ({})",
        placeholders.join(", ")
    );

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("Failed to prepare batch query: {}", e))?;

    let params: Vec<&dyn rusqlite::types::ToSql> =
        asset_ids.iter().map(|s| s as &dyn rusqlite::types::ToSql).collect();

    let items: Vec<AssetBatchItem> = stmt
        .query_map(params.as_slice(), |row| {
            let id: String = row.get(0)?;
            let file_name: String = row.get(1)?;
            let mime_type: String = row.get(2)?;
            let data: Vec<u8> = row.get(3)?;
            let data_base64 =
                base64::engine::general_purpose::STANDARD.encode(&data);
            Ok(AssetBatchItem {
                id,
                file_name,
                mime_type,
                data_base64,
            })
        })
        .map_err(|e| format!("Failed to query asset batch: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(items)
}
