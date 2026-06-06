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

#[derive(Debug, Serialize, Deserialize)]
pub struct InlineLinkRef {
    pub entity_type: String,
    pub entity_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InlineLinkResolution {
    pub entity_type: String,
    pub entity_id: String,
    pub exists: bool,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NextPageLink {
    pub source_id: String,
    pub target_id: String,
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

    if source_type == target_type && source_id == target_id {
        return Err("Cannot link an entity to itself".to_string());
    }

    let valid_types = ["character", "lore_document"];
    if !valid_types.contains(&source_type.as_str())
        || !valid_types.contains(&target_type.as_str())
    {
        return Err("Invalid entity type".to_string());
    }

    let link_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let raw_lt = link_type
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "related_to".to_string());

    if raw_lt.len() > 50 {
        return Err("Link type must be 50 characters or fewer".to_string());
    }
    if !raw_lt
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
    {
        return Err("Link type may only contain letters, numbers, underscore, or hyphen".to_string());
    }
    let lt = raw_lt;

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

// ─── Next-page override commands ─────────────────────────────────────────────
//
// A "next-page" link is a regular entity_links row with link_type='next_page'
// and both source_type/target_type = 'lore_document'. At most one non-deleted
// outgoing next_page link per source doc (enforced in set_next_page_link).
// Read mode uses it to override the default flat-order "next doc" when the
// user reaches the end of a document.

#[tauri::command]
pub fn get_next_page_link(
    source_document_id: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<Option<String>, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let target: Option<String> = conn
        .query_row(
            "SELECT target_id FROM entity_links \
             WHERE deleted_at IS NULL AND link_type = 'next_page' \
               AND source_type = 'lore_document' AND source_id = ?1 \
             LIMIT 1",
            [source_document_id],
            |row| row.get::<_, String>(0),
        )
        .ok();
    Ok(target)
}

#[tauri::command]
pub fn set_next_page_link(
    source_document_id: String,
    target_document_id: Option<String>,
    state: State<Mutex<AppDatabase>>,
) -> Result<(), String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (world_id, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    // Source must exist in this world and be live.
    let src_world: Option<String> = conn
        .query_row(
            "SELECT world_id FROM lore_documents WHERE id = ?1 AND deleted_at IS NULL",
            [&source_document_id],
            |row| row.get(0),
        )
        .ok();
    let src_world = src_world.ok_or_else(|| "Source document not found".to_string())?;
    if &src_world != world_id {
        return Err("Source document does not belong to the active world".to_string());
    }

    if let Some(ref tid) = target_document_id {
        if tid == &source_document_id {
            return Err("A document cannot reference itself as its next page".to_string());
        }
        let tgt_world: Option<String> = conn
            .query_row(
                "SELECT world_id FROM lore_documents WHERE id = ?1 AND deleted_at IS NULL",
                [tid],
                |row| row.get(0),
            )
            .ok();
        let tgt_world = tgt_world.ok_or_else(|| "Target document not found".to_string())?;
        if &tgt_world != world_id {
            return Err("Target document does not belong to the active world".to_string());
        }
    }

    let now = chrono::Utc::now().to_rfc3339();

    // Soft-delete any existing non-deleted next_page outgoing from this source.
    conn.execute(
        "UPDATE entity_links SET deleted_at = ?1 \
         WHERE deleted_at IS NULL AND link_type = 'next_page' \
           AND source_type = 'lore_document' AND source_id = ?2",
        rusqlite::params![now, source_document_id],
    )
    .map_err(|e| format!("Failed to clear prior next-page link: {}", e))?;

    // Insert new row when target is Some; None = clear only.
    if let Some(tid) = target_document_id {
        let link_id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO entity_links \
             (id, world_id, source_type, source_id, target_type, target_id, link_type, created_at) \
             VALUES (?1, ?2, 'lore_document', ?3, 'lore_document', ?4, 'next_page', ?5)",
            rusqlite::params![link_id, world_id, source_document_id, tid, now],
        )
        .map_err(|e| format!("Failed to set next-page link: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn list_next_page_links(
    state: State<Mutex<AppDatabase>>,
) -> Result<Vec<NextPageLink>, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let mut stmt = conn
        .prepare(
            "SELECT source_id, target_id FROM entity_links \
             WHERE deleted_at IS NULL AND link_type = 'next_page' \
               AND source_type = 'lore_document' AND target_type = 'lore_document'",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let links: Vec<NextPageLink> = stmt
        .query_map([], |row| {
            Ok(NextPageLink {
                source_id: row.get(0)?,
                target_id: row.get(1)?,
            })
        })
        .map_err(|e| format!("Failed to query next-page links: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(links)
}

/// Resolve a batch of inline-link references to (exists, name) tuples so the
/// frontend can render broken links as grayed-out text. A reference is
/// considered "broken" if the target row does not exist OR is soft-deleted.
#[tauri::command]
pub fn resolve_inline_links(
    refs: Vec<InlineLinkRef>,
    state: State<Mutex<AppDatabase>>,
) -> Result<Vec<InlineLinkResolution>, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let mut out: Vec<InlineLinkResolution> = Vec::with_capacity(refs.len());

    for r in refs.into_iter() {
        let lookup: Option<String> = match r.entity_type.as_str() {
            "character" => conn
                .query_row(
                    "SELECT name FROM characters WHERE id = ?1 AND deleted_at IS NULL",
                    [&r.entity_id],
                    |row| row.get::<_, String>(0),
                )
                .ok(),
            "lore_document" => conn
                .query_row(
                    "SELECT title FROM lore_documents WHERE id = ?1 AND deleted_at IS NULL",
                    [&r.entity_id],
                    |row| row.get::<_, String>(0),
                )
                .ok(),
            _ => None,
        };

        out.push(match lookup {
            Some(name) => InlineLinkResolution {
                entity_type: r.entity_type,
                entity_id: r.entity_id,
                exists: true,
                name,
            },
            None => InlineLinkResolution {
                entity_type: r.entity_type,
                entity_id: r.entity_id,
                exists: false,
                name: String::new(),
            },
        });
    }

    Ok(out)
}
