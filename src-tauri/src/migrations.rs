use rusqlite::Connection;

fn get_schema_version(conn: &Connection) -> i32 {
    conn.query_row(
        "SELECT version FROM schema_version LIMIT 1",
        [],
        |row| row.get(0),
    )
    .unwrap_or(0)
}

pub fn run_registry_migrations(conn: &Connection) -> Result<(), rusqlite::Error> {
    let version = get_schema_version(conn);
    if version < 1 {
        conn.execute_batch(include_str!("migrations/registry/001_init.sql"))?;
    }
    if version < 2 {
        conn.execute_batch(include_str!(
            "migrations/registry/002_add_summary_world_type.sql"
        ))?;
    }
    if version < 3 {
        conn.execute_batch(include_str!(
            "migrations/registry/003_add_last_position.sql"
        ))?;
    }
    Ok(())
}

pub fn run_world_migrations(conn: &Connection) -> Result<(), rusqlite::Error> {
    let version = get_schema_version(conn);
    if version < 1 {
        conn.execute_batch(include_str!("migrations/world/001_init.sql"))?;
    }
    if version < 2 {
        conn.execute_batch(include_str!(
            "migrations/world/002_graph_shared_nodes.sql"
        ))?;
    }
    if version < 3 {
        conn.execute_batch(include_str!(
            "migrations/world/003_atlas_canvas.sql"
        ))?;
    }
    if version < 4 {
        conn.execute_batch(include_str!(
            "migrations/world/004_card_block_type.sql"
        ))?;
    }
    if version < 5 {
        conn.execute_batch(include_str!(
            "migrations/world/005_cinematic_preview.sql"
        ))?;
    }
    if version < 6 {
        conn.execute_batch(include_str!(
            "migrations/world/006_drop_dead_character_columns.sql"
        ))?;
    }
    if version < 7 {
        conn.execute_batch(include_str!(
            "migrations/world/007_character_lock_face.sql"
        ))?;
    }
    if version < 8 {
        conn.execute_batch(include_str!(
            "migrations/world/008_atlas_canvas_v2.sql"
        ))?;
    }
    if version < 9 {
        conn.execute_batch(include_str!(
            "migrations/world/009_lore_doc_typography.sql"
        ))?;
    }
    if version < 10 {
        conn.execute_batch(include_str!(
            "migrations/world/010_atlas_terrain_fields.sql"
        ))?;
    }
    if version < 11 {
        // Atlas Canvas detached for redesign — drops every atlas table the
        // earlier migrations created (001/003/008/010 remain as history so
        // worlds at any version migrate identically).
        conn.execute_batch(include_str!(
            "migrations/world/011_detach_atlas.sql"
        ))?;
    }
    if version < 12 {
        // Atlas detachment, part 2: strip stale inline `[[links]]` to map
        // entities out of stored rich text (lore docs, character fields, card
        // blocks, detail sections). Each inlineLink node with
        // entityType == "map_entity" becomes a plain text node carrying its
        // label — content reads the same, just without the dead link. Runs in
        // Rust because the spans live arbitrarily deep inside TipTap JSON.
        strip_map_entity_inline_links(conn)?;
        conn.execute("UPDATE schema_version SET version = 12", [])?;
    }
    if version < 13 {
        conn.execute_batch(include_str!(
            "migrations/world/013_character_shelves.sql"
        ))?;
    }
    if version < 14 {
        conn.execute_batch(include_str!(
            "migrations/world/014_ribbon_icon.sql"
        ))?;
    }
    if version < 15 {
        conn.execute_batch(include_str!(
            "migrations/world/015_shelf_icon.sql"
        ))?;
    }
    if version < 16 {
        conn.execute_batch(include_str!(
            "migrations/world/016_lore_doc_status.sql"
        ))?;
    }
    if version < 17 {
        conn.execute_batch(include_str!(
            "migrations/world/017_read_progress.sql"
        ))?;
    }
    Ok(())
}

// ─── v12 helper: remove map_entity inline links from stored rich text ───────

/// Tables/columns that store rich text (TipTap JSON, or JSON that may embed
/// stringified TipTap docs inside section entries).
const RICH_TEXT_COLUMNS: [(&str, &str); 5] = [
    ("lore_documents", "content"),
    ("characters", "objective_summary"),
    ("characters", "in_character_intro"),
    ("character_card_blocks", "content"),
    ("character_detail_sections", "content"),
];

fn strip_map_entity_inline_links(conn: &Connection) -> Result<(), rusqlite::Error> {
    for (table, column) in RICH_TEXT_COLUMNS {
        // Cheap pre-filter: only rows that even mention map_entity.
        let sql = format!(
            "SELECT id, {column} FROM {table} \
             WHERE {column} LIKE '%map_entity%' AND {column} LIKE '%inlineLink%'"
        );
        let mut stmt = conn.prepare(&sql)?;
        let rows: Vec<(String, String)> = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
            .filter_map(|r| r.ok())
            .collect();

        for (id, content) in rows {
            let Ok(mut value) = serde_json::from_str::<serde_json::Value>(&content) else {
                continue; // not JSON — leave untouched
            };
            if strip_map_links_in_value(&mut value) {
                let update = format!("UPDATE {table} SET {column} = ?1 WHERE id = ?2");
                conn.execute(&update, rusqlite::params![value.to_string(), id])?;
            }
        }
    }
    Ok(())
}

/// Recursively walk a JSON value, replacing every
/// `{"type":"inlineLink","attrs":{"entityType":"map_entity",...}}` node with
/// a plain text node carrying its label (or removing it when the label is
/// empty). Also descends into string fields that themselves contain
/// stringified TipTap JSON (section entries). Returns true if anything changed.
fn strip_map_links_in_value(value: &mut serde_json::Value) -> bool {
    let mut changed = false;
    match value {
        serde_json::Value::Array(items) => {
            let mut i = 0;
            while i < items.len() {
                if let Some(label) = map_entity_link_label(&items[i]) {
                    if label.is_empty() {
                        items.remove(i);
                    } else {
                        items[i] = serde_json::json!({ "type": "text", "text": label });
                        i += 1;
                    }
                    changed = true;
                } else {
                    if strip_map_links_in_value(&mut items[i]) {
                        changed = true;
                    }
                    i += 1;
                }
            }
        }
        serde_json::Value::Object(map) => {
            for (_, v) in map.iter_mut() {
                if strip_map_links_in_value(v) {
                    changed = true;
                }
            }
        }
        serde_json::Value::String(s) => {
            // Nested stringified rich text (e.g. inside section entry JSON).
            if s.contains("inlineLink") && s.contains("map_entity") {
                if let Ok(mut inner) = serde_json::from_str::<serde_json::Value>(s.as_str()) {
                    if strip_map_links_in_value(&mut inner) {
                        *s = inner.to_string();
                        changed = true;
                    }
                }
            }
        }
        _ => {}
    }
    changed
}

/// If `value` is an inlineLink node pointing at a map entity, return its
/// (trimmed) label; otherwise None.
fn map_entity_link_label(value: &serde_json::Value) -> Option<String> {
    let obj = value.as_object()?;
    if obj.get("type")?.as_str()? != "inlineLink" {
        return None;
    }
    let attrs = obj.get("attrs")?.as_object()?;
    if attrs.get("entityType")?.as_str()? != "map_entity" {
        return None;
    }
    Some(
        attrs
            .get("label")
            .and_then(|l| l.as_str())
            .unwrap_or("")
            .trim()
            .to_string(),
    )
}

#[cfg(test)]
mod tests {
    use super::strip_map_links_in_value;
    use serde_json::json;

    #[test]
    fn replaces_map_links_keeps_others() {
        let mut doc = json!({
            "type": "doc",
            "content": [{
                "type": "paragraph",
                "content": [
                    { "type": "text", "text": "Born in " },
                    { "type": "inlineLink",
                      "attrs": { "entityType": "map_entity", "entityId": "x", "label": "Thornwatch Keep" } },
                    { "type": "text", "text": " with " },
                    { "type": "inlineLink",
                      "attrs": { "entityType": "character", "entityId": "y", "label": "Kira" } }
                ]
            }]
        });
        assert!(strip_map_links_in_value(&mut doc));
        let para = &doc["content"][0]["content"];
        assert_eq!(para[1], json!({ "type": "text", "text": "Thornwatch Keep" }));
        assert_eq!(para[3]["type"], "inlineLink"); // character link untouched
        // Idempotent: second pass changes nothing.
        assert!(!strip_map_links_in_value(&mut doc));
    }

    #[test]
    fn drops_empty_label_and_handles_nested_strings() {
        let mut doc = json!({
            "content": [{
                "type": "inlineLink",
                "attrs": { "entityType": "map_entity", "entityId": "x", "label": "  " }
            }]
        });
        assert!(strip_map_links_in_value(&mut doc));
        assert_eq!(doc["content"].as_array().unwrap().len(), 0);

        let inner = r#"{"type":"doc","content":[{"type":"inlineLink","attrs":{"entityType":"map_entity","entityId":"z","label":"The Spiral Gate"}}]}"#;
        let mut entries = json!({ "entries": [{ "body": inner }] });
        assert!(strip_map_links_in_value(&mut entries));
        let body = entries["entries"][0]["body"].as_str().unwrap();
        assert!(!body.contains("map_entity"));
        assert!(body.contains("The Spiral Gate"));
    }
}
