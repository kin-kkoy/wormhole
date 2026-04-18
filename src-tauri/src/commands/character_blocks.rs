use crate::db::AppDatabase;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct CardBlock {
    pub id: String,
    pub character_id: String,
    pub title: String,
    pub content: String,
    pub grid_column: i32,
    pub grid_row: i32,
    pub col_span: i32,
    pub row_span: i32,
    pub sort_order: i32,
    /// 'standard' (title + content), 'label' (title-only), or 'text'
    /// (content-only). Fixed at creation — not changed by update_card_block.
    pub block_type: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BlockPositionUpdate {
    pub id: String,
    pub grid_column: i32,
    pub grid_row: i32,
    pub col_span: i32,
    pub row_span: i32,
}

fn row_to_block(row: &rusqlite::Row) -> rusqlite::Result<CardBlock> {
    Ok(CardBlock {
        id: row.get(0)?,
        character_id: row.get(1)?,
        title: row.get(2)?,
        content: row.get(3)?,
        grid_column: row.get(4)?,
        grid_row: row.get(5)?,
        col_span: row.get(6)?,
        row_span: row.get(7)?,
        sort_order: row.get(8)?,
        block_type: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
    })
}

const BLOCK_COLUMNS: &str = "id, character_id, title, content, grid_column, grid_row, \
    col_span, row_span, sort_order, block_type, created_at, updated_at";

fn query_block(conn: &rusqlite::Connection, block_id: &str) -> Result<CardBlock, String> {
    conn.query_row(
        &format!("SELECT {} FROM character_card_blocks WHERE id = ?1", BLOCK_COLUMNS),
        [block_id],
        row_to_block,
    )
    .map_err(|e| format!("Block not found: {}", e))
}

#[tauri::command]
pub fn list_card_blocks(
    character_id: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<Vec<CardBlock>, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let mut stmt = conn
        .prepare(&format!(
            "SELECT {} FROM character_card_blocks WHERE character_id = ?1 ORDER BY sort_order ASC",
            BLOCK_COLUMNS
        ))
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let blocks = stmt
        .query_map([&character_id], row_to_block)
        .map_err(|e| format!("Failed to query blocks: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(blocks)
}

#[tauri::command]
pub fn create_card_block(
    character_id: String,
    title: String,
    grid_column: i32,
    grid_row: i32,
    col_span: Option<i32>,
    row_span: Option<i32>,
    block_type: Option<String>,
    state: State<Mutex<AppDatabase>>,
) -> Result<CardBlock, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let block_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let cs = col_span.unwrap_or(1);
    let rs = row_span.unwrap_or(1);
    let bt = match block_type.as_deref() {
        Some("label") => "label",
        Some("text") => "text",
        _ => "standard",
    };

    let max_sort: Option<i32> = conn
        .query_row(
            "SELECT MAX(sort_order) FROM character_card_blocks WHERE character_id = ?1",
            [&character_id],
            |row| row.get(0),
        )
        .unwrap_or(None);
    let sort_order = max_sort.map_or(0, |m| m + 1);

    conn.execute(
        "INSERT INTO character_card_blocks (id, character_id, title, content, grid_column, \
         grid_row, col_span, row_span, sort_order, block_type, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        rusqlite::params![
            block_id,
            character_id,
            title,
            "{}",
            grid_column,
            grid_row,
            cs,
            rs,
            sort_order,
            bt,
            now,
            now
        ],
    )
    .map_err(|e| format!("Failed to create block: {}", e))?;

    query_block(conn, &block_id)
}

#[tauri::command]
pub fn update_card_block(
    block_id: String,
    title: Option<String>,
    content: Option<String>,
    grid_column: Option<i32>,
    grid_row: Option<i32>,
    col_span: Option<i32>,
    row_span: Option<i32>,
    state: State<Mutex<AppDatabase>>,
) -> Result<CardBlock, String> {
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
    add_field!("content", content);
    add_field!("grid_column", grid_column);
    add_field!("grid_row", grid_row);
    add_field!("col_span", col_span);
    add_field!("row_span", row_span);

    let _ = idx;

    let sql = format!(
        "UPDATE character_card_blocks SET {} WHERE id = ?{}",
        set_clauses.join(", "),
        params.len() + 1
    );
    params.push(Box::new(block_id.clone()));

    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, param_refs.as_slice())
        .map_err(|e| format!("Failed to update block: {}", e))?;

    query_block(conn, &block_id)
}

#[tauri::command]
pub fn delete_card_block(
    block_id: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<(), String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    conn.execute(
        "DELETE FROM character_card_blocks WHERE id = ?1",
        [&block_id],
    )
    .map_err(|e| format!("Failed to delete block: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn batch_update_block_positions(
    updates: Vec<BlockPositionUpdate>,
    state: State<Mutex<AppDatabase>>,
) -> Result<(), String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let now = chrono::Utc::now().to_rfc3339();

    for update in &updates {
        conn.execute(
            "UPDATE character_card_blocks SET grid_column = ?1, grid_row = ?2, \
             col_span = ?3, row_span = ?4, updated_at = ?5 WHERE id = ?6",
            rusqlite::params![
                update.grid_column,
                update.grid_row,
                update.col_span,
                update.row_span,
                now,
                update.id
            ],
        )
        .map_err(|e| format!("Failed to update block position: {}", e))?;
    }

    Ok(())
}
