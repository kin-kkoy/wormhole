use crate::db::AppDatabase;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

// ─── Structs ─────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct EntityLink {
    pub id: String,
    pub world_id: String,
    pub source_type: String,
    pub source_id: String,
    pub target_type: String,
    pub target_id: String,
    pub link_type: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LinkedRecordDisplay {
    pub link_id: String,
    pub entity_type: String,
    pub entity_id: String,
    pub entity_name: String,
    pub link_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LinkableRecord {
    pub id: String,
    pub entity_type: String,
    pub name: String,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn resolve_entity_name(
    conn: &rusqlite::Connection,
    entity_type: &str,
    entity_id: &str,
) -> String {
    match entity_type {
        "character" => conn
            .query_row(
                "SELECT name FROM characters WHERE id = ?1 AND deleted_at IS NULL",
                [entity_id],
                |row| row.get::<_, String>(0),
            )
            .unwrap_or_else(|_| "[deleted]".to_string()),
        "map_entity" => conn
            .query_row(
                "SELECT title FROM map_entities WHERE id = ?1 AND deleted_at IS NULL",
                [entity_id],
                |row| row.get::<_, String>(0),
            )
            .unwrap_or_else(|_| "[deleted]".to_string()),
        "lore_document" => conn
            .query_row(
                "SELECT title FROM lore_documents WHERE id = ?1 AND deleted_at IS NULL",
                [entity_id],
                |row| row.get::<_, String>(0),
            )
            .unwrap_or_else(|_| "[deleted]".to_string()),
        _ => "[unknown]".to_string(),
    }
}

// ─── Commands ────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_entity_links(
    entity_type: String,
    entity_id: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<Vec<LinkedRecordDisplay>, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let mut stmt = conn
        .prepare(
            "SELECT id, source_type, source_id, target_type, target_id, link_type \
             FROM entity_links WHERE deleted_at IS NULL AND \
             ((source_type = ?1 AND source_id = ?2) OR (target_type = ?1 AND target_id = ?2))",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let links: Vec<LinkedRecordDisplay> = stmt
        .query_map(rusqlite::params![entity_type, entity_id], |row| {
            let link_id: String = row.get(0)?;
            let src_type: String = row.get(1)?;
            let src_id: String = row.get(2)?;
            let tgt_type: String = row.get(3)?;
            let tgt_id: String = row.get(4)?;
            let link_type: String = row.get(5)?;
            Ok((link_id, src_type, src_id, tgt_type, tgt_id, link_type))
        })
        .map_err(|e| format!("Failed to query links: {}", e))?
        .filter_map(|r| r.ok())
        .map(|(link_id, src_type, src_id, tgt_type, tgt_id, link_type)| {
            // Determine the "other" side
            let (other_type, other_id) = if src_type == entity_type && src_id == entity_id {
                (tgt_type, tgt_id)
            } else {
                (src_type, src_id)
            };
            let entity_name = resolve_entity_name(conn, &other_type, &other_id);
            LinkedRecordDisplay {
                link_id,
                entity_type: other_type,
                entity_id: other_id,
                entity_name,
                link_type,
            }
        })
        .collect();

    Ok(links)
}

#[tauri::command]
pub fn create_entity_link(
    source_type: String,
    source_id: String,
    target_type: String,
    target_id: String,
    link_type: Option<String>,
    state: State<Mutex<AppDatabase>>,
) -> Result<EntityLink, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (world_id, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    // Check for duplicate (either direction)
    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM entity_links WHERE deleted_at IS NULL AND \
             ((source_type = ?1 AND source_id = ?2 AND target_type = ?3 AND target_id = ?4) OR \
              (source_type = ?3 AND source_id = ?4 AND target_type = ?1 AND target_id = ?2))",
            rusqlite::params![source_type, source_id, target_type, target_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to check duplicate: {}", e))?;

    if exists {
        return Err("A link between these entities already exists".to_string());
    }

    let link_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let lt = link_type.unwrap_or_else(|| "related_to".to_string());

    conn.execute(
        "INSERT INTO entity_links (id, world_id, source_type, source_id, target_type, target_id, link_type, created_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![link_id, world_id, source_type, source_id, target_type, target_id, lt, now],
    )
    .map_err(|e| format!("Failed to create entity link: {}", e))?;

    Ok(EntityLink {
        id: link_id,
        world_id: world_id.clone(),
        source_type,
        source_id,
        target_type,
        target_id,
        link_type: lt,
        created_at: now,
    })
}

#[tauri::command]
pub fn delete_entity_link(
    link_id: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<(), String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE entity_links SET deleted_at = ?1 WHERE id = ?2 AND deleted_at IS NULL",
        rusqlite::params![now, link_id],
    )
    .map_err(|e| format!("Failed to delete entity link: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn search_linkable_records(
    query: String,
    exclude_type: Option<String>,
    exclude_id: Option<String>,
    state: State<Mutex<AppDatabase>>,
) -> Result<Vec<LinkableRecord>, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (world_id, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let pattern = format!("%{}%", query);
    let mut results: Vec<LinkableRecord> = Vec::new();

    // Search characters
    {
        let mut stmt = conn
            .prepare(
                "SELECT id, name FROM characters \
                 WHERE world_id = ?1 AND deleted_at IS NULL AND name LIKE ?2 COLLATE NOCASE \
                 ORDER BY name ASC LIMIT 10",
            )
            .map_err(|e| format!("Failed to search characters: {}", e))?;

        let chars: Vec<LinkableRecord> = stmt
            .query_map(rusqlite::params![world_id, pattern], |row| {
                Ok(LinkableRecord {
                    id: row.get(0)?,
                    entity_type: "character".to_string(),
                    name: row.get(1)?,
                })
            })
            .map_err(|e| format!("Failed to read character results: {}", e))?
            .filter_map(|r| r.ok())
            .collect();
        results.extend(chars);
    }

    // Search map entities
    {
        let mut stmt = conn
            .prepare(
                "SELECT id, title FROM map_entities \
                 WHERE world_id = ?1 AND deleted_at IS NULL AND title LIKE ?2 COLLATE NOCASE \
                 ORDER BY title ASC LIMIT 10",
            )
            .map_err(|e| format!("Failed to search map entities: {}", e))?;

        let entities: Vec<LinkableRecord> = stmt
            .query_map(rusqlite::params![world_id, pattern], |row| {
                Ok(LinkableRecord {
                    id: row.get(0)?,
                    entity_type: "map_entity".to_string(),
                    name: row.get(1)?,
                })
            })
            .map_err(|e| format!("Failed to read map entity results: {}", e))?
            .filter_map(|r| r.ok())
            .collect();
        results.extend(entities);
    }

    // Search lore documents
    {
        let mut stmt = conn
            .prepare(
                "SELECT id, title FROM lore_documents \
                 WHERE world_id = ?1 AND deleted_at IS NULL AND title LIKE ?2 COLLATE NOCASE \
                 ORDER BY title ASC LIMIT 10",
            )
            .map_err(|e| format!("Failed to search lore documents: {}", e))?;

        let docs: Vec<LinkableRecord> = stmt
            .query_map(rusqlite::params![world_id, pattern], |row| {
                Ok(LinkableRecord {
                    id: row.get(0)?,
                    entity_type: "lore_document".to_string(),
                    name: row.get(1)?,
                })
            })
            .map_err(|e| format!("Failed to read lore document results: {}", e))?
            .filter_map(|r| r.ok())
            .collect();
        results.extend(docs);
    }

    // Exclude self if specified
    if let (Some(ref ex_type), Some(ref ex_id)) = (&exclude_type, &exclude_id) {
        results.retain(|r| !(r.entity_type == *ex_type && r.id == *ex_id));
    }

    // Sort by name and truncate to 10
    results.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    results.truncate(10);

    Ok(results)
}
