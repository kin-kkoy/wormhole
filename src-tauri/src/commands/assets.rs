use crate::db::AppDatabase;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct AssetData {
    pub id: String,
    pub file_name: String,
    pub mime_type: String,
    pub data_base64: String,
}

fn mime_from_extension(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("svg") => "image/svg+xml",
        Some("bmp") => "image/bmp",
        _ => "application/octet-stream",
    }
}

#[tauri::command]
pub fn import_asset(
    file_path: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<String, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    let (world_id, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let path = Path::new(&file_path);

    let data =
        std::fs::read(path).map_err(|e| format!("Failed to read file: {}", e))?;

    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let mime_type = mime_from_extension(path);
    let asset_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO assets (id, world_id, file_name, mime_type, data, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![asset_id, world_id, file_name, mime_type, data, now],
    )
    .map_err(|e| format!("Failed to insert asset: {}", e))?;

    Ok(asset_id)
}

#[tauri::command]
pub fn get_asset(
    asset_id: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<AssetData, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    conn.query_row(
        "SELECT id, file_name, mime_type, data FROM assets WHERE id = ?1",
        [&asset_id],
        |row| {
            let id: String = row.get(0)?;
            let file_name: String = row.get(1)?;
            let mime_type: String = row.get(2)?;
            let data: Vec<u8> = row.get(3)?;
            let data_base64 =
                base64::engine::general_purpose::STANDARD.encode(&data);

            Ok(AssetData {
                id,
                file_name,
                mime_type,
                data_base64,
            })
        },
    )
    .map_err(|e| format!("Asset not found: {}", e))
}
