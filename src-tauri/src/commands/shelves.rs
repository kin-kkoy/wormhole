use crate::db::AppDatabase;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct CharacterShelf {
    pub id: String,
    pub world_id: String,
    pub name: String,
    pub icon_asset_id: Option<String>,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

fn row_to_shelf(row: &rusqlite::Row) -> rusqlite::Result<CharacterShelf> {
    Ok(CharacterShelf {
        id: row.get(0)?,
        world_id: row.get(1)?,
        name: row.get(2)?,
        icon_asset_id: row.get(3)?,
        sort_order: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
    })
}

#[tauri::command]
pub fn list_character_shelves(
    state: State<Mutex<AppDatabase>>,
) -> Result<Vec<CharacterShelf>, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let mut stmt = conn
        .prepare(
            "SELECT id, world_id, name, icon_asset_id, sort_order, created_at, updated_at \
             FROM character_shelves \
             ORDER BY sort_order ASC, name ASC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let shelves = stmt
        .query_map([], row_to_shelf)
        .map_err(|e| format!("Failed to query shelves: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(shelves)
}

#[tauri::command]
pub fn create_character_shelf(
    name: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<CharacterShelf, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (world_id, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let max_sort: Option<i64> = conn
        .query_row(
            "SELECT MAX(sort_order) FROM character_shelves WHERE world_id = ?1",
            [world_id],
            |row| row.get(0),
        )
        .unwrap_or(None);
    let sort_order = max_sort.map_or(0, |m| m + 1);

    conn.execute(
        "INSERT INTO character_shelves (id, world_id, name, icon_asset_id, sort_order, created_at, updated_at) \
         VALUES (?1, ?2, ?3, NULL, ?4, ?5, ?6)",
        rusqlite::params![id, world_id, name, sort_order, now, now],
    )
    .map_err(|e| format!("Failed to create shelf: {}", e))?;

    Ok(CharacterShelf {
        id,
        world_id: world_id.clone(),
        name,
        icon_asset_id: None,
        sort_order,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub fn rename_character_shelf(
    shelf_id: String,
    name: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<(), String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE character_shelves SET name = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![name, now, shelf_id],
    )
    .map_err(|e| format!("Failed to rename shelf: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn delete_character_shelf(
    shelf_id: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<(), String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    // Unshelve all characters first
    conn.execute(
        "UPDATE characters SET shelf_id = NULL WHERE shelf_id = ?1",
        [&shelf_id],
    )
    .map_err(|e| format!("Failed to unshelve characters: {}", e))?;

    conn.execute(
        "DELETE FROM character_shelves WHERE id = ?1",
        [&shelf_id],
    )
    .map_err(|e| format!("Failed to delete shelf: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn assign_character_to_shelf(
    character_id: String,
    shelf_id: Option<String>,
    state: State<Mutex<AppDatabase>>,
) -> Result<(), String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    conn.execute(
        "UPDATE characters SET shelf_id = ?1 WHERE id = ?2 AND deleted_at IS NULL",
        rusqlite::params![shelf_id, character_id],
    )
    .map_err(|e| format!("Failed to assign character to shelf: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn reorder_shelves(
    shelf_ids: Vec<String>,
    state: State<Mutex<AppDatabase>>,
) -> Result<(), String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    for (index, id) in shelf_ids.iter().enumerate() {
        conn.execute(
            "UPDATE character_shelves SET sort_order = ?1 WHERE id = ?2",
            rusqlite::params![index as i64, id],
        )
        .map_err(|e| format!("Failed to reorder shelf: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn update_shelf_icon(
    shelf_id: String,
    icon_asset_id: Option<String>,
    state: State<Mutex<AppDatabase>>,
) -> Result<(), String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE character_shelves SET icon_asset_id = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![icon_asset_id, now, shelf_id],
    )
    .map_err(|e| format!("Failed to update shelf icon: {}", e))?;

    Ok(())
}
