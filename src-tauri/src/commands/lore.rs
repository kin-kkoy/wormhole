use crate::db::AppDatabase;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

// ─── Structs ─────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct LoreFolder {
    pub id: String,
    pub world_id: String,
    pub parent_folder_id: Option<String>,
    pub title: String,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoreDocumentSummary {
    pub id: String,
    pub world_id: String,
    pub folder_id: Option<String>,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoreDocumentFull {
    pub id: String,
    pub world_id: String,
    pub folder_id: Option<String>,
    pub title: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
}

// ─── Row mappers ─────────────────────────────────────────────────────────────

fn row_to_folder(row: &rusqlite::Row) -> rusqlite::Result<LoreFolder> {
    Ok(LoreFolder {
        id: row.get(0)?,
        world_id: row.get(1)?,
        parent_folder_id: row.get(2)?,
        title: row.get(3)?,
        sort_order: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
    })
}

fn row_to_doc_summary(row: &rusqlite::Row) -> rusqlite::Result<LoreDocumentSummary> {
    Ok(LoreDocumentSummary {
        id: row.get(0)?,
        world_id: row.get(1)?,
        folder_id: row.get(2)?,
        title: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })
}

fn row_to_doc_full(row: &rusqlite::Row) -> rusqlite::Result<LoreDocumentFull> {
    Ok(LoreDocumentFull {
        id: row.get(0)?,
        world_id: row.get(1)?,
        folder_id: row.get(2)?,
        title: row.get(3)?,
        content: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
    })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FOLDER_COLUMNS: &str = "id, world_id, parent_folder_id, title, sort_order, created_at, updated_at";
const DOC_SUMMARY_COLUMNS: &str = "id, world_id, folder_id, title, created_at, updated_at";
const DOC_FULL_COLUMNS: &str = "id, world_id, folder_id, title, content, created_at, updated_at";

fn query_folder(conn: &rusqlite::Connection, folder_id: &str) -> Result<LoreFolder, String> {
    conn.query_row(
        &format!(
            "SELECT {} FROM lore_folders WHERE id = ?1 AND deleted_at IS NULL",
            FOLDER_COLUMNS
        ),
        [folder_id],
        row_to_folder,
    )
    .map_err(|e| format!("Folder not found: {}", e))
}

fn query_document_full(
    conn: &rusqlite::Connection,
    doc_id: &str,
) -> Result<LoreDocumentFull, String> {
    conn.query_row(
        &format!(
            "SELECT {} FROM lore_documents WHERE id = ?1 AND deleted_at IS NULL",
            DOC_FULL_COLUMNS
        ),
        [doc_id],
        row_to_doc_full,
    )
    .map_err(|e| format!("Document not found: {}", e))
}

/// Returns the depth of a folder (root-level = 1). Returns 0 for None (root).
fn get_folder_depth(conn: &rusqlite::Connection, folder_id: Option<&str>) -> Result<i32, String> {
    let Some(fid) = folder_id else {
        return Ok(0);
    };

    let mut depth = 0;
    let mut current_id = Some(fid.to_string());

    while let Some(ref cid) = current_id {
        depth += 1;
        if depth > 5 {
            return Err("Folder hierarchy exceeds maximum depth".to_string());
        }
        let parent: Option<String> = conn
            .query_row(
                "SELECT parent_folder_id FROM lore_folders WHERE id = ?1 AND deleted_at IS NULL",
                [cid.as_str()],
                |row| row.get(0),
            )
            .map_err(|e| format!("Failed to query folder depth: {}", e))?;
        current_id = parent;
    }

    Ok(depth)
}

/// Check if `potential_ancestor_id` is an ancestor of `folder_id` (or is `folder_id` itself).
fn is_descendant_of(
    conn: &rusqlite::Connection,
    folder_id: &str,
    potential_ancestor_id: &str,
) -> Result<bool, String> {
    if folder_id == potential_ancestor_id {
        return Ok(true);
    }

    let mut current_id = Some(folder_id.to_string());
    let mut steps = 0;

    while let Some(ref cid) = current_id {
        if steps > 5 {
            break;
        }
        let parent: Option<String> = conn
            .query_row(
                "SELECT parent_folder_id FROM lore_folders WHERE id = ?1 AND deleted_at IS NULL",
                [cid.as_str()],
                |row| row.get(0),
            )
            .map_err(|e| format!("Failed to check ancestry: {}", e))?;

        match parent {
            Some(ref pid) if pid == potential_ancestor_id => return Ok(true),
            Some(pid) => {
                current_id = Some(pid);
            }
            None => {
                current_id = None;
            }
        }
        steps += 1;
    }

    Ok(false)
}

/// Get the max depth of a folder's subtree (including itself). Returns 1 for a leaf folder.
fn get_subtree_depth(conn: &rusqlite::Connection, folder_id: &str) -> Result<i32, String> {
    let children: Vec<String> = {
        let mut stmt = conn
            .prepare(
                "SELECT id FROM lore_folders WHERE parent_folder_id = ?1 AND deleted_at IS NULL",
            )
            .map_err(|e| format!("Failed to query children: {}", e))?;
        let result = stmt
            .query_map([folder_id], |row| row.get::<_, String>(0))
            .map_err(|e| format!("Failed to read children: {}", e))?
            .filter_map(|r| r.ok())
            .collect();
        result
    };

    if children.is_empty() {
        return Ok(1);
    }

    let mut max_child_depth = 0;
    for child_id in &children {
        let child_depth = get_subtree_depth(conn, child_id)?;
        if child_depth > max_child_depth {
            max_child_depth = child_depth;
        }
    }

    Ok(1 + max_child_depth)
}

// ─── Folder commands ─────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_lore_folders(state: State<Mutex<AppDatabase>>) -> Result<Vec<LoreFolder>, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let mut stmt = conn
        .prepare(&format!(
            "SELECT {} FROM lore_folders WHERE world_id = ?1 AND deleted_at IS NULL \
             ORDER BY sort_order ASC, title ASC",
            FOLDER_COLUMNS
        ))
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let folders = stmt
        .query_map([db.active_world.as_ref().unwrap().0.as_str()], row_to_folder)
        .map_err(|e| format!("Failed to query folders: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(folders)
}

#[tauri::command]
pub fn create_lore_folder(
    title: String,
    parent_folder_id: Option<String>,
    state: State<Mutex<AppDatabase>>,
) -> Result<LoreFolder, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (world_id, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    // Validate depth
    if let Some(ref pid) = parent_folder_id {
        let parent_depth = get_folder_depth(conn, Some(pid))?;
        if parent_depth >= 5 {
            return Err("Maximum folder nesting depth (5 levels) reached".to_string());
        }
    }

    let folder_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    // Get next sort_order among siblings
    let max_sort: Option<i64> = if parent_folder_id.is_some() {
        conn.query_row(
            "SELECT MAX(sort_order) FROM lore_folders \
             WHERE world_id = ?1 AND parent_folder_id = ?2 AND deleted_at IS NULL",
            rusqlite::params![world_id, parent_folder_id],
            |row| row.get(0),
        )
        .unwrap_or(None)
    } else {
        conn.query_row(
            "SELECT MAX(sort_order) FROM lore_folders \
             WHERE world_id = ?1 AND parent_folder_id IS NULL AND deleted_at IS NULL",
            [world_id],
            |row| row.get(0),
        )
        .unwrap_or(None)
    };
    let sort_order = max_sort.map_or(0, |m| m + 1);

    conn.execute(
        "INSERT INTO lore_folders (id, world_id, parent_folder_id, title, sort_order, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![folder_id, world_id, parent_folder_id, title, sort_order, now, now],
    )
    .map_err(|e| format!("Failed to create folder: {}", e))?;

    query_folder(conn, &folder_id)
}

#[tauri::command]
pub fn rename_lore_folder(
    folder_id: String,
    title: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<LoreFolder, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE lore_folders SET title = ?1, updated_at = ?2 WHERE id = ?3 AND deleted_at IS NULL",
        rusqlite::params![title, now, folder_id],
    )
    .map_err(|e| format!("Failed to rename folder: {}", e))?;

    query_folder(conn, &folder_id)
}

#[tauri::command]
pub fn delete_lore_folder(
    folder_id: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<(), String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let now = chrono::Utc::now().to_rfc3339();

    // Soft-delete the folder
    conn.execute(
        "UPDATE lore_folders SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND deleted_at IS NULL",
        rusqlite::params![now, folder_id],
    )
    .map_err(|e| format!("Failed to delete folder: {}", e))?;

    // Move child documents to root
    conn.execute(
        "UPDATE lore_documents SET folder_id = NULL, updated_at = ?1 \
         WHERE folder_id = ?2 AND deleted_at IS NULL",
        rusqlite::params![now, folder_id],
    )
    .map_err(|e| format!("Failed to move documents to root: {}", e))?;

    // Move child folders to root
    conn.execute(
        "UPDATE lore_folders SET parent_folder_id = NULL, updated_at = ?1 \
         WHERE parent_folder_id = ?2 AND deleted_at IS NULL",
        rusqlite::params![now, folder_id],
    )
    .map_err(|e| format!("Failed to move child folders to root: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn get_folder_doc_count(
    folder_id: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<i64, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    conn.query_row(
        "SELECT COUNT(*) FROM lore_documents WHERE folder_id = ?1 AND deleted_at IS NULL",
        [&folder_id],
        |row| row.get(0),
    )
    .map_err(|e| format!("Failed to count documents: {}", e))
}

#[tauri::command]
pub fn move_lore_folder(
    folder_id: String,
    new_parent_folder_id: Option<String>,
    sort_order: i64,
    state: State<Mutex<AppDatabase>>,
) -> Result<LoreFolder, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    // Validate: cannot move folder into itself or a descendant
    if let Some(ref new_pid) = new_parent_folder_id {
        if is_descendant_of(conn, new_pid, &folder_id)? {
            return Err("Cannot move a folder into itself or one of its descendants".to_string());
        }

        // Validate depth: new parent depth + moved folder subtree depth <= 5
        let parent_depth = get_folder_depth(conn, Some(new_pid))?;
        let subtree_depth = get_subtree_depth(conn, &folder_id)?;
        if parent_depth + subtree_depth > 5 {
            return Err("Moving this folder would exceed the maximum nesting depth (5 levels)".to_string());
        }
    }

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE lore_folders SET parent_folder_id = ?1, sort_order = ?2, updated_at = ?3 \
         WHERE id = ?4 AND deleted_at IS NULL",
        rusqlite::params![new_parent_folder_id, sort_order, now, folder_id],
    )
    .map_err(|e| format!("Failed to move folder: {}", e))?;

    query_folder(conn, &folder_id)
}

#[tauri::command]
pub fn reorder_lore_folders(
    folder_ids: Vec<String>,
    state: State<Mutex<AppDatabase>>,
) -> Result<(), String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    for (index, id) in folder_ids.iter().enumerate() {
        conn.execute(
            "UPDATE lore_folders SET sort_order = ?1 WHERE id = ?2",
            rusqlite::params![index as i64, id],
        )
        .map_err(|e| format!("Failed to reorder folder: {}", e))?;
    }

    Ok(())
}

// ─── Document commands ───────────────────────────────────────────────────────

#[tauri::command]
pub fn list_lore_documents(
    state: State<Mutex<AppDatabase>>,
) -> Result<Vec<LoreDocumentSummary>, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let mut stmt = conn
        .prepare(&format!(
            "SELECT {} FROM lore_documents WHERE world_id = ?1 AND deleted_at IS NULL \
             ORDER BY title ASC",
            DOC_SUMMARY_COLUMNS
        ))
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let docs = stmt
        .query_map([db.active_world.as_ref().unwrap().0.as_str()], row_to_doc_summary)
        .map_err(|e| format!("Failed to query documents: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(docs)
}

#[tauri::command]
pub fn create_lore_document(
    title: String,
    folder_id: Option<String>,
    state: State<Mutex<AppDatabase>>,
) -> Result<LoreDocumentFull, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (world_id, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let doc_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO lore_documents (id, world_id, folder_id, title, content, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![doc_id, world_id, folder_id, title, "{}", now, now],
    )
    .map_err(|e| format!("Failed to create document: {}", e))?;

    query_document_full(conn, &doc_id)
}

#[tauri::command]
pub fn get_lore_document(
    document_id: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<LoreDocumentFull, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    query_document_full(conn, &document_id)
}

#[tauri::command]
pub fn update_lore_document(
    document_id: String,
    title: Option<String>,
    content: Option<String>,
    folder_id: Option<String>,
    state: State<Mutex<AppDatabase>>,
) -> Result<LoreDocumentFull, String> {
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
    add_field!("folder_id", folder_id);

    let _ = idx;

    let sql = format!(
        "UPDATE lore_documents SET {} WHERE id = ?{} AND deleted_at IS NULL",
        set_clauses.join(", "),
        params.len() + 1
    );
    params.push(Box::new(document_id.clone()));

    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, param_refs.as_slice())
        .map_err(|e| format!("Failed to update document: {}", e))?;

    query_document_full(conn, &document_id)
}

#[tauri::command]
pub fn delete_lore_document(
    document_id: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<(), String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let now = chrono::Utc::now().to_rfc3339();

    // Soft-delete the document
    conn.execute(
        "UPDATE lore_documents SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND deleted_at IS NULL",
        rusqlite::params![now, document_id],
    )
    .map_err(|e| format!("Failed to delete document: {}", e))?;

    // Soft-delete related entity links
    conn.execute(
        "UPDATE entity_links SET deleted_at = ?1 WHERE deleted_at IS NULL AND \
         ((source_type = 'lore_document' AND source_id = ?2) OR \
          (target_type = 'lore_document' AND target_id = ?2))",
        rusqlite::params![now, document_id],
    )
    .map_err(|e| format!("Failed to soft-delete entity links: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn restore_lore_document(
    document_id: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<LoreDocumentFull, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let now = chrono::Utc::now().to_rfc3339();

    // Restore the document
    conn.execute(
        "UPDATE lore_documents SET deleted_at = NULL, updated_at = ?1 WHERE id = ?2",
        rusqlite::params![now, document_id],
    )
    .map_err(|e| format!("Failed to restore document: {}", e))?;

    // Restore related entity links
    conn.execute(
        "UPDATE entity_links SET deleted_at = NULL WHERE \
         ((source_type = 'lore_document' AND source_id = ?1) OR \
          (target_type = 'lore_document' AND target_id = ?1))",
        [&document_id],
    )
    .map_err(|e| format!("Failed to restore entity links: {}", e))?;

    query_document_full(conn, &document_id)
}

#[tauri::command]
pub fn move_lore_document(
    document_id: String,
    folder_id: Option<String>,
    state: State<Mutex<AppDatabase>>,
) -> Result<(), String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE lore_documents SET folder_id = ?1, updated_at = ?2 WHERE id = ?3 AND deleted_at IS NULL",
        rusqlite::params![folder_id, now, document_id],
    )
    .map_err(|e| format!("Failed to move document: {}", e))?;

    Ok(())
}

// ─── Recycle Bin ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct DeletedLoreDocument {
    pub id: String,
    pub title: String,
    pub deleted_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeletedLoreFolder {
    pub id: String,
    pub title: String,
    pub deleted_at: String,
}

#[tauri::command]
pub fn list_deleted_lore_documents(
    state: State<Mutex<AppDatabase>>,
) -> Result<Vec<DeletedLoreDocument>, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let mut stmt = conn
        .prepare(
            "SELECT id, title, deleted_at FROM lore_documents \
             WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(DeletedLoreDocument {
                id: row.get(0)?,
                title: row.get(1)?,
                deleted_at: row.get(2)?,
            })
        })
        .map_err(|e| format!("Failed to query deleted documents: {}", e))?;

    Ok(rows.flatten().collect())
}

#[tauri::command]
pub fn list_deleted_lore_folders(
    state: State<Mutex<AppDatabase>>,
) -> Result<Vec<DeletedLoreFolder>, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let mut stmt = conn
        .prepare(
            "SELECT id, title, deleted_at FROM lore_folders \
             WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(DeletedLoreFolder {
                id: row.get(0)?,
                title: row.get(1)?,
                deleted_at: row.get(2)?,
            })
        })
        .map_err(|e| format!("Failed to query deleted folders: {}", e))?;

    Ok(rows.flatten().collect())
}

#[tauri::command]
pub fn restore_lore_folder(
    folder_id: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<LoreFolder, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let now = chrono::Utc::now().to_rfc3339();

    // If the folder's original parent was also soft-deleted, move the restored
    // folder to root so the user can always see it.
    let parent_missing: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM lore_folders f \
             WHERE f.id = (SELECT parent_folder_id FROM lore_folders WHERE id = ?1) \
             AND f.deleted_at IS NULL)",
            [&folder_id],
            |row| row.get::<_, i64>(0),
        )
        .unwrap_or(1)
        == 0;

    if parent_missing {
        conn.execute(
            "UPDATE lore_folders SET parent_folder_id = NULL, deleted_at = NULL, updated_at = ?1 \
             WHERE id = ?2",
            rusqlite::params![now, folder_id],
        )
        .map_err(|e| format!("Failed to restore folder: {}", e))?;
    } else {
        conn.execute(
            "UPDATE lore_folders SET deleted_at = NULL, updated_at = ?1 WHERE id = ?2",
            rusqlite::params![now, folder_id],
        )
        .map_err(|e| format!("Failed to restore folder: {}", e))?;
    }

    query_folder(conn, &folder_id)
}

#[tauri::command]
pub fn purge_lore_document(
    document_id: String,
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
         (source_type = 'lore_document' AND source_id = ?1) OR \
         (target_type = 'lore_document' AND target_id = ?1)",
        [&document_id],
    )
    .map_err(|e| format!("Failed to purge entity links: {}", e))?;

    tx.execute(
        "DELETE FROM graph_shared_node_members WHERE entity_type = 'lore_document' AND entity_id = ?1",
        [&document_id],
    )
    .map_err(|e| format!("Failed to remove shared node membership: {}", e))?;

    tx.execute("DELETE FROM lore_documents WHERE id = ?1", [&document_id])
        .map_err(|e| format!("Failed to purge document: {}", e))?;

    tx.commit()
        .map_err(|e| format!("Failed to commit purge: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn purge_lore_folder(
    folder_id: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<(), String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    // Children were re-parented to root at soft-delete time, so a simple
    // DELETE is enough. Folders are not link participants.
    conn.execute("DELETE FROM lore_folders WHERE id = ?1", [&folder_id])
        .map_err(|e| format!("Failed to purge folder: {}", e))?;

    Ok(())
}
