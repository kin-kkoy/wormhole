use crate::db::AppDatabase;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct CharacterSummary {
    pub id: String,
    pub name: String,
    pub short_role: Option<String>,
    pub image_asset_id: Option<String>,
    pub decorative_ribbon: Option<String>,
    pub tags_text: Option<String>,
    pub sort_order: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CharacterFull {
    pub id: String,
    pub world_id: String,
    pub image_asset_id: Option<String>,
    pub name: String,
    pub short_role: Option<String>,
    pub objective_summary: Option<String>,
    pub in_character_intro: Option<String>,
    pub decorative_ribbon: Option<String>,
    pub brief_details_json: Option<String>,
    pub tags_text: Option<String>,
    pub sort_order: Option<i64>,
    /// Tri-state lock for the front face. NULL = unlocked (card by default,
    /// Preview button enabled). 'card' or 'cinematic' = locked to that face,
    /// Preview button disabled.
    pub locked_face: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

fn row_to_summary(row: &rusqlite::Row) -> rusqlite::Result<CharacterSummary> {
    Ok(CharacterSummary {
        id: row.get(0)?,
        name: row.get(1)?,
        short_role: row.get(2)?,
        image_asset_id: row.get(3)?,
        decorative_ribbon: row.get(4)?,
        tags_text: row.get(5)?,
        sort_order: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

fn row_to_full(row: &rusqlite::Row) -> rusqlite::Result<CharacterFull> {
    Ok(CharacterFull {
        id: row.get(0)?,
        world_id: row.get(1)?,
        image_asset_id: row.get(2)?,
        name: row.get(3)?,
        short_role: row.get(4)?,
        objective_summary: row.get(5)?,
        in_character_intro: row.get(6)?,
        decorative_ribbon: row.get(7)?,
        brief_details_json: row.get(8)?,
        tags_text: row.get(9)?,
        sort_order: row.get(10)?,
        locked_face: row.get(11)?,
        created_at: row.get(12)?,
        updated_at: row.get(13)?,
    })
}

const FULL_COLUMNS: &str = "id, world_id, image_asset_id, name, short_role, objective_summary, \
    in_character_intro, decorative_ribbon, brief_details_json, tags_text, sort_order, \
    locked_face, created_at, updated_at";

fn query_character_full(
    conn: &rusqlite::Connection,
    character_id: &str,
) -> Result<CharacterFull, String> {
    conn.query_row(
        &format!(
            "SELECT {} FROM characters WHERE id = ?1 AND deleted_at IS NULL",
            FULL_COLUMNS
        ),
        [character_id],
        row_to_full,
    )
    .map_err(|e| format!("Character not found: {}", e))
}

#[tauri::command]
pub fn list_characters(state: State<Mutex<AppDatabase>>) -> Result<Vec<CharacterSummary>, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let mut stmt = conn
        .prepare(
            "SELECT id, name, short_role, image_asset_id, decorative_ribbon, \
             tags_text, sort_order, created_at, updated_at \
             FROM characters WHERE deleted_at IS NULL \
             ORDER BY sort_order ASC NULLS LAST, name ASC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let characters = stmt
        .query_map([], row_to_summary)
        .map_err(|e| format!("Failed to query characters: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(characters)
}

#[tauri::command]
pub fn get_character(
    character_id: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<CharacterFull, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    query_character_full(conn, &character_id)
}

#[tauri::command]
pub fn create_character(
    name: String,
    short_role: Option<String>,
    image_asset_id: Option<String>,
    tags_text: Option<String>,
    state: State<Mutex<AppDatabase>>,
) -> Result<CharacterFull, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (world_id, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let character_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    // Get next sort_order
    let max_sort: Option<i64> = conn
        .query_row(
            "SELECT MAX(sort_order) FROM characters WHERE world_id = ?1 AND deleted_at IS NULL",
            [world_id],
            |row| row.get(0),
        )
        .unwrap_or(None);
    let sort_order = max_sort.map_or(0, |m| m + 1);

    conn.execute(
        "INSERT INTO characters (id, world_id, name, short_role, image_asset_id, \
         tags_text, sort_order, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![
            character_id,
            world_id,
            name,
            short_role,
            image_asset_id,
            tags_text,
            sort_order,
            now,
            now
        ],
    )
    .map_err(|e| format!("Failed to create character: {}", e))?;

    // Auto-create the mandatory "Overview" detail section
    let section_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO character_detail_sections (id, character_id, title, layout_type, \
         sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![section_id, character_id, "Overview", "prose", 0, now, now],
    )
    .map_err(|e| format!("Failed to create overview section: {}", e))?;

    query_character_full(conn, &character_id)
}

#[tauri::command]
pub fn update_character(
    character_id: String,
    name: Option<String>,
    short_role: Option<String>,
    objective_summary: Option<String>,
    in_character_intro: Option<String>,
    decorative_ribbon: Option<String>,
    brief_details_json: Option<String>,
    image_asset_id: Option<String>,
    tags_text: Option<String>,
    locked_face: Option<String>,
    state: State<Mutex<AppDatabase>>,
) -> Result<CharacterFull, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

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

    add_field!("name", name);
    add_field!("short_role", short_role);
    add_field!("objective_summary", objective_summary);
    add_field!("in_character_intro", in_character_intro);
    add_field!("decorative_ribbon", decorative_ribbon);
    add_field!("brief_details_json", brief_details_json);
    add_field!("image_asset_id", image_asset_id);
    add_field!("tags_text", tags_text);

    // locked_face is tri-state: None = no change; Some("") = unlock (NULL);
    // Some("card"|"cinematic") = lock to that face.
    if let Some(ref v) = locked_face {
        if v.is_empty() {
            set_clauses.push("locked_face = NULL".to_string());
        } else {
            set_clauses.push(format!("locked_face = ?{}", idx));
            params.push(Box::new(v.clone()));
            idx += 1;
        }
    }

    let _ = idx;

    let sql = format!(
        "UPDATE characters SET {} WHERE id = ?{} AND deleted_at IS NULL",
        set_clauses.join(", "),
        params.len() + 1
    );
    params.push(Box::new(character_id.clone()));

    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, param_refs.as_slice())
        .map_err(|e| format!("Failed to update character: {}", e))?;

    query_character_full(conn, &character_id)
}

#[tauri::command]
pub fn delete_character(
    character_id: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<(), String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let now = chrono::Utc::now().to_rfc3339();

    // Soft-delete the character
    conn.execute(
        "UPDATE characters SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND deleted_at IS NULL",
        rusqlite::params![now, character_id],
    )
    .map_err(|e| format!("Failed to delete character: {}", e))?;

    // Soft-delete related entity links
    conn.execute(
        "UPDATE entity_links SET deleted_at = ?1 WHERE deleted_at IS NULL AND \
         ((source_type = 'character' AND source_id = ?2) OR \
          (target_type = 'character' AND target_id = ?2))",
        rusqlite::params![now, character_id],
    )
    .map_err(|e| format!("Failed to soft-delete entity links: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn restore_character(
    character_id: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<CharacterFull, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let now = chrono::Utc::now().to_rfc3339();

    // Restore the character
    conn.execute(
        "UPDATE characters SET deleted_at = NULL, updated_at = ?1 WHERE id = ?2",
        rusqlite::params![now, character_id],
    )
    .map_err(|e| format!("Failed to restore character: {}", e))?;

    // Restore related entity links
    conn.execute(
        "UPDATE entity_links SET deleted_at = NULL WHERE \
         ((source_type = 'character' AND source_id = ?1) OR \
          (target_type = 'character' AND target_id = ?1))",
        [&character_id],
    )
    .map_err(|e| format!("Failed to restore entity links: {}", e))?;

    query_character_full(conn, &character_id)
}

#[tauri::command]
pub fn reorder_characters(
    character_ids: Vec<String>,
    state: State<Mutex<AppDatabase>>,
) -> Result<(), String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    for (index, id) in character_ids.iter().enumerate() {
        conn.execute(
            "UPDATE characters SET sort_order = ?1 WHERE id = ?2",
            rusqlite::params![index as i64, id],
        )
        .map_err(|e| format!("Failed to reorder character: {}", e))?;
    }

    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeletedCharacter {
    pub id: String,
    pub name: String,
    pub deleted_at: String,
}

#[tauri::command]
pub fn list_deleted_characters(
    state: State<Mutex<AppDatabase>>,
) -> Result<Vec<DeletedCharacter>, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let mut stmt = conn
        .prepare(
            "SELECT id, name, deleted_at FROM characters \
             WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(DeletedCharacter {
                id: row.get(0)?,
                name: row.get(1)?,
                deleted_at: row.get(2)?,
            })
        })
        .map_err(|e| format!("Failed to query deleted characters: {}", e))?;

    Ok(rows.flatten().collect())
}

#[tauri::command]
pub fn purge_character(
    character_id: String,
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

    tx.execute(
        "DELETE FROM entity_links WHERE \
         (source_type = 'character' AND source_id = ?1) OR \
         (target_type = 'character' AND target_id = ?1)",
        [&character_id],
    )
    .map_err(|e| format!("Failed to purge entity links: {}", e))?;

    tx.execute(
        "DELETE FROM character_card_blocks WHERE character_id = ?1",
        [&character_id],
    )
    .map_err(|e| format!("Failed to purge card blocks: {}", e))?;

    tx.execute(
        "DELETE FROM character_detail_sections WHERE character_id = ?1",
        [&character_id],
    )
    .map_err(|e| format!("Failed to purge detail sections: {}", e))?;

    tx.execute(
        "DELETE FROM graph_shared_node_members WHERE entity_type = 'character' AND entity_id = ?1",
        [&character_id],
    )
    .map_err(|e| format!("Failed to remove shared node membership: {}", e))?;

    tx.execute(
        "DELETE FROM characters WHERE id = ?1",
        [&character_id],
    )
    .map_err(|e| format!("Failed to purge character: {}", e))?;

    tx.commit()
        .map_err(|e| format!("Failed to commit purge: {}", e))?;

    Ok(())
}
