use crate::db::AppDatabase;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct DetailSection {
    pub id: String,
    pub character_id: String,
    pub title: String,
    pub layout_type: String,
    pub content: Option<String>,
    pub structured_content_json: Option<String>,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

fn row_to_section(row: &rusqlite::Row) -> rusqlite::Result<DetailSection> {
    Ok(DetailSection {
        id: row.get(0)?,
        character_id: row.get(1)?,
        title: row.get(2)?,
        layout_type: row.get(3)?,
        content: row.get(4)?,
        structured_content_json: row.get(5)?,
        sort_order: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

const SECTION_COLUMNS: &str = "id, character_id, title, layout_type, content, \
    structured_content_json, sort_order, created_at, updated_at";

fn query_section(conn: &rusqlite::Connection, section_id: &str) -> Result<DetailSection, String> {
    conn.query_row(
        &format!(
            "SELECT {} FROM character_detail_sections WHERE id = ?1",
            SECTION_COLUMNS
        ),
        [section_id],
        row_to_section,
    )
    .map_err(|e| format!("Section not found: {}", e))
}

#[tauri::command]
pub fn list_detail_sections(
    character_id: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<Vec<DetailSection>, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let mut stmt = conn
        .prepare(&format!(
            "SELECT {} FROM character_detail_sections WHERE character_id = ?1 \
             ORDER BY sort_order ASC",
            SECTION_COLUMNS
        ))
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let sections = stmt
        .query_map([&character_id], row_to_section)
        .map_err(|e| format!("Failed to query sections: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(sections)
}

#[tauri::command]
pub fn create_detail_section(
    character_id: String,
    title: String,
    layout_type: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<DetailSection, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let section_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let max_sort: Option<i32> = conn
        .query_row(
            "SELECT MAX(sort_order) FROM character_detail_sections WHERE character_id = ?1",
            [&character_id],
            |row| row.get(0),
        )
        .unwrap_or(None);
    let sort_order = max_sort.map_or(0, |m| m + 1);

    conn.execute(
        "INSERT INTO character_detail_sections (id, character_id, title, layout_type, \
         sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![section_id, character_id, title, layout_type, sort_order, now, now],
    )
    .map_err(|e| format!("Failed to create section: {}", e))?;

    query_section(conn, &section_id)
}

#[tauri::command]
pub fn update_detail_section(
    section_id: String,
    title: Option<String>,
    layout_type: Option<String>,
    content: Option<String>,
    structured_content_json: Option<String>,
    state: State<Mutex<AppDatabase>>,
) -> Result<DetailSection, String> {
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

    add_field!("title", title);
    add_field!("layout_type", layout_type);
    add_field!("content", content);
    add_field!("structured_content_json", structured_content_json);

    let _ = idx;

    let sql = format!(
        "UPDATE character_detail_sections SET {} WHERE id = ?{}",
        set_clauses.join(", "),
        params.len() + 1
    );
    params.push(Box::new(section_id.clone()));

    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, param_refs.as_slice())
        .map_err(|e| format!("Failed to update section: {}", e))?;

    query_section(conn, &section_id)
}

#[tauri::command]
pub fn delete_detail_section(
    section_id: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<(), String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    // Prevent deletion of the Overview section (sort_order = 0)
    let sort_order: i32 = conn
        .query_row(
            "SELECT sort_order FROM character_detail_sections WHERE id = ?1",
            [&section_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Section not found: {}", e))?;

    if sort_order == 0 {
        return Err("Cannot delete the Overview section".to_string());
    }

    conn.execute(
        "DELETE FROM character_detail_sections WHERE id = ?1",
        [&section_id],
    )
    .map_err(|e| format!("Failed to delete section: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn reorder_detail_sections(
    section_ids: Vec<String>,
    state: State<Mutex<AppDatabase>>,
) -> Result<(), String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    for (index, id) in section_ids.iter().enumerate() {
        conn.execute(
            "UPDATE character_detail_sections SET sort_order = ?1 WHERE id = ?2",
            rusqlite::params![index as i32, id],
        )
        .map_err(|e| format!("Failed to reorder section: {}", e))?;
    }

    Ok(())
}
