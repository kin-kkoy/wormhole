use crate::db::AppDatabase;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub record_type: String,
    pub id: String,
    pub title: String,
    pub snippet: String,
}

const MAX_RESULTS: usize = 50;
const SNIPPET_LEN: usize = 50;

// Best-effort plain-text extraction from TipTap/ProseMirror JSON. If the value
// is not valid JSON, treat it as plain text. We walk the doc tree and join any
// string values under a `text` key, trimmed to SNIPPET_LEN chars.
fn extract_snippet(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    let text = match serde_json::from_str::<serde_json::Value>(trimmed) {
        Ok(value) => {
            let mut buf = String::new();
            collect_text(&value, &mut buf);
            if buf.is_empty() {
                trimmed.to_string()
            } else {
                buf
            }
        }
        Err(_) => trimmed.to_string(),
    };
    let collapsed: String = text
        .chars()
        .map(|c| if c.is_whitespace() { ' ' } else { c })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    collapsed.chars().take(SNIPPET_LEN).collect()
}

fn collect_text(value: &serde_json::Value, buf: &mut String) {
    match value {
        serde_json::Value::Object(map) => {
            if let Some(serde_json::Value::String(s)) = map.get("text") {
                if !buf.is_empty() {
                    buf.push(' ');
                }
                buf.push_str(s);
            }
            if let Some(content) = map.get("content") {
                collect_text(content, buf);
            }
        }
        serde_json::Value::Array(items) => {
            for item in items {
                collect_text(item, buf);
                if buf.chars().count() >= SNIPPET_LEN * 4 {
                    break;
                }
            }
        }
        _ => {}
    }
}

#[tauri::command]
pub fn search_world(
    query: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<Vec<SearchResult>, String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let like_pattern = format!("%{}%", trimmed.to_lowercase());
    let mut results: Vec<SearchResult> = Vec::new();

    // Characters
    {
        let mut stmt = conn
            .prepare(
                "SELECT id, name, objective_summary FROM characters \
                 WHERE deleted_at IS NULL AND LOWER(name) LIKE ?1 \
                 ORDER BY LOWER(name) ASC",
            )
            .map_err(|e| format!("Failed to prepare character search: {}", e))?;
        let rows = stmt
            .query_map([&like_pattern], |row| {
                let id: String = row.get(0)?;
                let title: String = row.get(1)?;
                let summary: Option<String> = row.get(2)?;
                Ok((id, title, summary))
            })
            .map_err(|e| format!("Character search failed: {}", e))?;
        for r in rows.flatten() {
            let (id, title, summary) = r;
            results.push(SearchResult {
                record_type: "character".to_string(),
                id,
                title,
                snippet: summary.map(|s| extract_snippet(&s)).unwrap_or_default(),
            });
        }
    }

    // Lore documents
    {
        let mut stmt = conn
            .prepare(
                "SELECT id, title, content FROM lore_documents \
                 WHERE deleted_at IS NULL AND LOWER(title) LIKE ?1 \
                 ORDER BY LOWER(title) ASC",
            )
            .map_err(|e| format!("Failed to prepare lore document search: {}", e))?;
        let rows = stmt
            .query_map([&like_pattern], |row| {
                let id: String = row.get(0)?;
                let title: String = row.get(1)?;
                let content: Option<String> = row.get(2)?;
                Ok((id, title, content))
            })
            .map_err(|e| format!("Lore document search failed: {}", e))?;
        for r in rows.flatten() {
            let (id, title, content) = r;
            // `extract_snippet` already understands TipTap JSON and falls back
            // to plain text for legacy content.
            results.push(SearchResult {
                record_type: "lore_document".to_string(),
                id,
                title,
                snippet: content.map(|s| extract_snippet(&s)).unwrap_or_default(),
            });
        }
    }

    results.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
    results.truncate(MAX_RESULTS);
    Ok(results)
}
