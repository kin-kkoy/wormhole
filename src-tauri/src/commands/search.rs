use crate::db::AppDatabase;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub record_type: String,
    pub id: String,
    pub title: String,
    pub snippet: String,
    pub match_field: String,
}

const MAX_RESULTS: usize = 50;
const SNIPPET_LEN: usize = 120;

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
    let mut seen: HashSet<(String, String)> = HashSet::new();

    // Characters — title match (high priority)
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
            seen.insert(("character".to_string(), id.clone()));
            results.push(SearchResult {
                record_type: "character".to_string(),
                id,
                title,
                snippet: summary.map(|s| extract_snippet(&s)).unwrap_or_default(),
                match_field: "title".to_string(),
            });
        }
    }

    // Characters — content match (objective_summary, in_character_intro)
    {
        let mut stmt = conn
            .prepare(
                "SELECT id, name, objective_summary, in_character_intro FROM characters \
                 WHERE deleted_at IS NULL AND LOWER(name) NOT LIKE ?1 \
                 AND (LOWER(COALESCE(objective_summary, '')) LIKE ?1 \
                      OR LOWER(COALESCE(in_character_intro, '')) LIKE ?1) \
                 ORDER BY LOWER(name) ASC",
            )
            .map_err(|e| format!("Failed to prepare character content search: {}", e))?;
        let rows = stmt
            .query_map([&like_pattern], |row| {
                let id: String = row.get(0)?;
                let title: String = row.get(1)?;
                let summary: Option<String> = row.get(2)?;
                let intro: Option<String> = row.get(3)?;
                Ok((id, title, summary, intro))
            })
            .map_err(|e| format!("Character content search failed: {}", e))?;
        for r in rows.flatten() {
            let (id, title, summary, intro) = r;
            let key = ("character".to_string(), id.clone());
            if seen.contains(&key) {
                continue;
            }
            seen.insert(key);
            let snippet = summary
                .map(|s| extract_snippet(&s))
                .filter(|s| !s.is_empty())
                .or_else(|| intro.map(|s| extract_snippet(&s)))
                .unwrap_or_default();
            results.push(SearchResult {
                record_type: "character".to_string(),
                id,
                title,
                snippet,
                match_field: "content".to_string(),
            });
        }
    }

    // Character detail sections — content match
    {
        let mut stmt = conn
            .prepare(
                "SELECT ds.character_id, c.name, ds.content FROM character_detail_sections ds \
                 JOIN characters c ON c.id = ds.character_id AND c.deleted_at IS NULL \
                 WHERE LOWER(COALESCE(ds.content, '')) LIKE ?1 \
                 ORDER BY LOWER(c.name) ASC",
            )
            .map_err(|e| format!("Failed to prepare section search: {}", e))?;
        let rows = stmt
            .query_map([&like_pattern], |row| {
                let char_id: String = row.get(0)?;
                let char_name: String = row.get(1)?;
                let content: Option<String> = row.get(2)?;
                Ok((char_id, char_name, content))
            })
            .map_err(|e| format!("Section search failed: {}", e))?;
        for r in rows.flatten() {
            let (char_id, char_name, content) = r;
            let key = ("character".to_string(), char_id.clone());
            if seen.contains(&key) {
                continue;
            }
            seen.insert(key);
            results.push(SearchResult {
                record_type: "character".to_string(),
                id: char_id,
                title: char_name,
                snippet: content.map(|s| extract_snippet(&s)).unwrap_or_default(),
                match_field: "content".to_string(),
            });
        }
    }

    // Lore documents — title match (high priority)
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
            seen.insert(("lore_document".to_string(), id.clone()));
            results.push(SearchResult {
                record_type: "lore_document".to_string(),
                id,
                title,
                snippet: content.map(|s| extract_snippet(&s)).unwrap_or_default(),
                match_field: "title".to_string(),
            });
        }
    }

    // Lore documents — content match
    {
        let mut stmt = conn
            .prepare(
                "SELECT id, title, content FROM lore_documents \
                 WHERE deleted_at IS NULL AND LOWER(title) NOT LIKE ?1 \
                 AND LOWER(COALESCE(content, '')) LIKE ?1 \
                 ORDER BY LOWER(title) ASC",
            )
            .map_err(|e| format!("Failed to prepare lore content search: {}", e))?;
        let rows = stmt
            .query_map([&like_pattern], |row| {
                let id: String = row.get(0)?;
                let title: String = row.get(1)?;
                let content: Option<String> = row.get(2)?;
                Ok((id, title, content))
            })
            .map_err(|e| format!("Lore content search failed: {}", e))?;
        for r in rows.flatten() {
            let (id, title, content) = r;
            let key = ("lore_document".to_string(), id.clone());
            if seen.contains(&key) {
                continue;
            }
            seen.insert(key);
            results.push(SearchResult {
                record_type: "lore_document".to_string(),
                id,
                title,
                snippet: content.map(|s| extract_snippet(&s)).unwrap_or_default(),
                match_field: "content".to_string(),
            });
        }
    }

    results.sort_by(|a, b| {
        let pri_a = if a.match_field == "title" { 0 } else { 1 };
        let pri_b = if b.match_field == "title" { 0 } else { 1 };
        pri_a
            .cmp(&pri_b)
            .then_with(|| a.title.to_lowercase().cmp(&b.title.to_lowercase()))
    });
    results.truncate(MAX_RESULTS);
    Ok(results)
}
