use crate::db::AppDatabase;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct AppConfig {
    pub storage_folder: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorldSummary {
    pub id: String,
    pub title: String,
    pub world_type: String,
    pub summary: Option<String>,
    pub cover_thumbnail_base64: Option<String>,
    pub last_opened: Option<String>,
    /// JSON snapshot {tab, entity_type, entity_id, entity_title, saved_at}
    /// written by `update_last_position`; powers the index resume pill.
    pub last_position: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WorldDetail {
    pub id: String,
    pub title: String,
    pub world_type: String,
    pub summary: Option<String>,
    pub cover_asset_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[tauri::command]
pub fn get_app_config(state: State<Mutex<AppDatabase>>) -> Result<AppConfig, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    Ok(AppConfig {
        storage_folder: db.storage_folder.clone(),
    })
}

#[tauri::command]
pub fn set_storage_folder(
    path: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<(), String> {
    let mut db = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    let resolved_path = if path == "__default__" {
        db.app_data_dir.join("Worlds").to_string_lossy().to_string()
    } else {
        path
    };

    std::fs::create_dir_all(&resolved_path)
        .map_err(|e| format!("Failed to create storage folder: {}", e))?;

    db.registry
        .execute(
            "INSERT OR REPLACE INTO app_config (key, value) VALUES ('storage_folder', ?1)",
            [&resolved_path],
        )
        .map_err(|e| format!("Failed to save storage folder: {}", e))?;

    db.storage_folder = Some(resolved_path);
    Ok(())
}

#[tauri::command]
pub fn create_world(
    title: String,
    world_type: String,
    summary: Option<String>,
    state: State<Mutex<AppDatabase>>,
) -> Result<WorldSummary, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    let storage_folder = db
        .storage_folder
        .as_ref()
        .ok_or("Storage folder not configured")?
        .clone();

    let world_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let file_name = format!("{}.wormhole", world_id);
    let file_path = PathBuf::from(&storage_folder).join(&file_name);

    let world_conn = db.create_world_db(&file_path)?;

    world_conn
        .execute(
            "INSERT INTO worlds (id, title, world_type, summary, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![world_id, title, world_type, summary, now, now],
        )
        .map_err(|e| format!("Failed to insert world: {}", e))?;

    db.registry
        .execute(
            "INSERT INTO registry_worlds (id, path, title, world_type, summary, last_opened, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![world_id, file_path.to_string_lossy().to_string(), title, world_type, summary, now, now, now],
        )
        .map_err(|e| format!("Failed to register world: {}", e))?;

    Ok(WorldSummary {
        id: world_id,
        title,
        world_type,
        summary,
        cover_thumbnail_base64: None,
        last_opened: Some(now.clone()),
        last_position: None,
        created_at: now,
    })
}

#[tauri::command]
pub fn list_worlds(state: State<Mutex<AppDatabase>>) -> Result<Vec<WorldSummary>, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    let mut stmt = db
        .registry
        .prepare(
            "SELECT id, title, world_type, summary, cover_thumbnail, last_opened, last_position, created_at \
             FROM registry_worlds ORDER BY last_opened DESC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let worlds = stmt
        .query_map([], |row| {
            let cover_blob: Option<Vec<u8>> = row.get(4)?;
            let cover_thumbnail_base64 = cover_blob.map(|bytes| {
                base64::engine::general_purpose::STANDARD.encode(&bytes)
            });

            Ok(WorldSummary {
                id: row.get(0)?,
                title: row.get(1)?,
                world_type: row.get(2)?,
                summary: row.get(3)?,
                cover_thumbnail_base64,
                last_opened: row.get(5)?,
                last_position: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| format!("Failed to query worlds: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(worlds)
}

/// Snapshot the user's current position inside the open world so the world
/// index can offer "Resume". Resolves the entity's display title from the
/// active world DB (the world must still be open); a vanished or deleted
/// entity downgrades the snapshot to tab-only.
#[tauri::command]
pub fn update_last_position(
    world_id: String,
    tab: String,
    entity_type: Option<String>,
    entity_id: Option<String>,
    state: State<Mutex<AppDatabase>>,
) -> Result<(), String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    let mut resolved: Option<(String, String, String)> = None;
    if let (Some(etype), Some(eid)) = (entity_type.as_deref(), entity_id.as_deref()) {
        if let Some((_, conn)) = db.active_world.as_ref() {
            let title: Option<String> = match etype {
                "character" => conn
                    .query_row(
                        "SELECT name FROM characters WHERE id = ?1 AND deleted_at IS NULL",
                        [eid],
                        |row| row.get(0),
                    )
                    .ok(),
                "lore_document" => conn
                    .query_row(
                        "SELECT title FROM lore_documents WHERE id = ?1 AND deleted_at IS NULL",
                        [eid],
                        |row| row.get(0),
                    )
                    .ok(),
                _ => None,
            };
            if let Some(title) = title {
                resolved = Some((etype.to_string(), eid.to_string(), title));
            }
        }
    }

    let position = serde_json::json!({
        "tab": tab,
        "entity_type": resolved.as_ref().map(|r| r.0.clone()),
        "entity_id": resolved.as_ref().map(|r| r.1.clone()),
        "entity_title": resolved.as_ref().map(|r| r.2.clone()),
        "saved_at": chrono::Utc::now().to_rfc3339(),
    });

    db.registry
        .execute(
            "UPDATE registry_worlds SET last_position = ?1 WHERE id = ?2",
            rusqlite::params![position.to_string(), world_id],
        )
        .map_err(|e| format!("Failed to update last_position: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn open_world(
    world_id: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<WorldDetail, String> {
    let mut db = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    let path: String = db
        .registry
        .query_row(
            "SELECT path FROM registry_worlds WHERE id = ?1",
            [&world_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("World not found in registry: {}", e))?;

    let now = chrono::Utc::now().to_rfc3339();
    db.registry
        .execute(
            "UPDATE registry_worlds SET last_opened = ?1 WHERE id = ?2",
            rusqlite::params![now, world_id],
        )
        .map_err(|e| format!("Failed to update last_opened: {}", e))?;

    let conn = db.open_world_db(&PathBuf::from(&path))?;

    let detail = conn
        .query_row(
            "SELECT id, title, world_type, summary, cover_asset_id, created_at, updated_at FROM worlds LIMIT 1",
            [],
            |row| {
                Ok(WorldDetail {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    world_type: row.get(2)?,
                    summary: row.get(3)?,
                    cover_asset_id: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            },
        )
        .map_err(|e| format!("Failed to read world data: {}", e))?;

    db.active_world = Some((world_id, conn));

    Ok(detail)
}

#[tauri::command]
pub fn close_world(state: State<Mutex<AppDatabase>>) -> Result<(), String> {
    let mut db = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    db.active_world = None;
    Ok(())
}

#[tauri::command]
pub fn delete_world(
    world_id: String,
    state: State<Mutex<AppDatabase>>,
) -> Result<(), String> {
    let mut db = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    // Close if this world is currently active
    if let Some((ref active_id, _)) = db.active_world {
        if active_id == &world_id {
            db.active_world = None;
        }
    }

    let path: String = db
        .registry
        .query_row(
            "SELECT path FROM registry_worlds WHERE id = ?1",
            [&world_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("World not found: {}", e))?;

    // Remove from registry first
    db.registry
        .execute("DELETE FROM registry_worlds WHERE id = ?1", [&world_id])
        .map_err(|e| format!("Failed to remove from registry: {}", e))?;

    // Delete the .wormhole file
    if std::path::Path::new(&path).exists() {
        std::fs::remove_file(&path)
            .map_err(|e| format!("Failed to delete world file: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn seed_example_world(
    state: State<Mutex<AppDatabase>>,
) -> Result<WorldSummary, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    let storage_folder = db
        .storage_folder
        .as_ref()
        .ok_or("Storage folder not configured")?
        .clone();

    let world_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let file_path = PathBuf::from(&storage_folder).join(format!("{}.wormhole", world_id));

    let conn = db.create_world_db(&file_path)?;

    // Insert world
    conn.execute(
        "INSERT INTO worlds (id, title, world_type, summary, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            world_id,
            "Eldoria",
            "Fantasy",
            "A vast realm of ancient magic, warring kingdoms, and forgotten ruins. The land is shaped by the echoes of a cataclysm known as the Sundering, which shattered the great empire that once unified all peoples under a single banner.",
            now,
            now
        ],
    ).map_err(|e| format!("Failed to insert world: {}", e))?;

    // Insert characters
    let char1_id = uuid::Uuid::new_v4().to_string();
    let char2_id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO characters (id, world_id, name, short_role, objective_summary, in_character_intro, brief_details_json, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![
            char1_id, world_id,
            "Kira Voss",
            "Fleet Commander",
            r#"{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Commander of the Thornwatch Rangers. A seasoned tactician who rose through the ranks after leading a daring defense of the keep against a marshland incursion. Known for her pragmatic leadership and refusal to leave anyone behind."}]}]}"#,
            r#"{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"\"I didn't choose the Ashenmoor. The Ashenmoor chose me — and I've been arguing with it ever since.\""}]}]}"#,
            r#"[{"key":"Title","value":"Fleet Commander"},{"key":"Born","value":"Year 412, Third Age"},{"key":"Status","value":"Active"},{"key":"Affiliation","value":"Thornwatch Rangers"}]"#,
            0,
            now, now
        ],
    ).map_err(|e| format!("Failed to insert character 1: {}", e))?;

    conn.execute(
        "INSERT INTO characters (id, world_id, name, short_role, objective_summary, in_character_intro, brief_details_json, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![
            char2_id, world_id,
            "Thane Ashford",
            "Keeper of the Archive",
            r#"{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"The appointed guardian of Eldoria's Great Archive, a vast underground library containing records from before the Sundering. Thane has spent decades cataloguing forbidden texts and is one of the few who can read the Old Script."}]}]}"#,
            r#"{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"\"Every page I turn reveals another lie we've been told about our history. The truth isn't hidden — it's just inconvenient.\""}]}]}"#,
            r#"[{"key":"Title","value":"Keeper of the Archive"},{"key":"Age","value":"67"},{"key":"Status","value":"Active"},{"key":"Affiliation","value":"The Great Archive"}]"#,
            1,
            now, now
        ],
    ).map_err(|e| format!("Failed to insert character 2: {}", e))?;

    // Insert character card blocks for Kira
    let block1_id = uuid::Uuid::new_v4().to_string();
    let block2_id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO character_card_blocks (id, character_id, title, content, grid_column, grid_row, col_span, row_span, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        rusqlite::params![
            block1_id, char1_id,
            "Personality",
            r#"{"type":"doc","content":[{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Pragmatic and decisive under pressure"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Dry sense of humor"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Fiercely loyal to her rangers"}]}]}]}]}"#,
            1, 1, 1, 1, 0, now, now
        ],
    ).map_err(|e| format!("Failed to insert block 1: {}", e))?;

    conn.execute(
        "INSERT INTO character_card_blocks (id, character_id, title, content, grid_column, grid_row, col_span, row_span, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        rusqlite::params![
            block2_id, char1_id,
            "Goals",
            r#"{"type":"doc","content":[{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Secure the eastern frontier against the growing threats from the Ashenmoor"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Discover the source of the corruption spreading through the marshland"}]}]}]}]}"#,
            2, 1, 2, 1, 1, now, now
        ],
    ).map_err(|e| format!("Failed to insert block 2: {}", e))?;

    // ---- Character detail sections for Kira (showcases all 4 layout types) ----

    // 1. Overview (prose) — always-present base tab, sort_order = 0
    let kira_overview_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO character_detail_sections (id, character_id, title, layout_type, content, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            kira_overview_id, char1_id,
            "Overview",
            "prose",
            r#"{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kira Voss is the current Fleet Commander of the Thornwatch Rangers, stationed at Thornwatch Keep on the edge of the Ashenmoor Expanse. She earned her position through years of service and a legendary defense of the keep."}]}]}"#,
            0, now, now
        ],
    ).map_err(|e| format!("Failed to insert Kira Overview: {}", e))?;

    // 2. Background (prose)
    let kira_background_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO character_detail_sections (id, character_id, title, layout_type, content, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            kira_background_id, char1_id,
            "Background",
            "prose",
            r#"{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Born to a family of saltmarsh fishers along the eastern coast, Kira grew up watching the corruption of the Ashenmoor creep closer to her village each year. By the time she was sixteen, the marsh had swallowed her family's docks and most of their livelihood."}]},{"type":"paragraph","content":[{"type":"text","text":"She enlisted with the Thornwatch Rangers the day she turned eighteen — not out of patriotism, but out of a quiet, sustained anger at what she had watched the marsh take. Her superiors quickly noted her composure under fire and her refusal to abandon a position once committed to it."}]}]}"#,
            1, now, now
        ],
    ).map_err(|e| format!("Failed to insert Kira Background: {}", e))?;

    // 3. Relationships (cards)
    let kira_relationships_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO character_detail_sections (id, character_id, title, layout_type, structured_content_json, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            kira_relationships_id, char1_id,
            "Relationships",
            "cards",
            r#"[{"id":"k-rel-1","title":"Captain Selene Marsh","subtitle":"Second-in-Command","description":"Kira's right hand and oldest friend in the Rangers. Quietly disagrees with about half of Kira's decisions but follows them to the letter."},{"id":"k-rel-2","title":"Vorn Hask","subtitle":"Rival Commander","description":"Commander of the Stoneward Garrison to the north. They have a long-running cold war over jurisdiction and resource allocation."},{"id":"k-rel-3","title":"Old Wren","subtitle":"Mentor","description":"The previous Fleet Commander, now retired to a fishing shack. Kira visits her once a season to argue about strategy and drink terrible tea."}]"#,
            2, now, now
        ],
    ).map_err(|e| format!("Failed to insert Kira Relationships: {}", e))?;

    // 4. Timeline (timeline)
    let kira_timeline_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO character_detail_sections (id, character_id, title, layout_type, structured_content_json, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            kira_timeline_id, char1_id,
            "Timeline",
            "timeline",
            r#"[{"id":"k-tl-1","date":"Year 430","title":"Enlistment","description":"Joins the Thornwatch Rangers at age eighteen. Posted to a remote watch-tower on the marsh's edge."},{"id":"k-tl-2","date":"Year 435","title":"The Defense of the Keep","description":"Leads a holding action during a sudden marshland incursion. The keep holds; Kira is one of only nineteen survivors from the original eighty-strong garrison."},{"id":"k-tl-3","date":"Year 439","title":"Promoted to Fleet Commander","description":"Appointed against the wishes of two competing factions. Old Wren reportedly says only \"finally\" before going back to her tea."}]"#,
            3, now, now
        ],
    ).map_err(|e| format!("Failed to insert Kira Timeline: {}", e))?;

    // 5. Vitals (grid / key-value)
    let kira_vitals_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO character_detail_sections (id, character_id, title, layout_type, structured_content_json, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            kira_vitals_id, char1_id,
            "Vitals",
            "grid",
            r#"[{"id":"k-v-1","label":"Height","value":"5'9\""},{"id":"k-v-2","label":"Eye Color","value":"Slate gray"},{"id":"k-v-3","label":"Dominant Hand","value":"Left"},{"id":"k-v-4","label":"Weapon","value":"Ranger's saber, fitted for left-hand draw"},{"id":"k-v-5","label":"Allegiance","value":"Thornwatch Rangers"},{"id":"k-v-6","label":"Distinguishing Mark","value":"Burn scar across the right forearm from the Defense of the Keep"}]"#,
            4, now, now
        ],
    ).map_err(|e| format!("Failed to insert Kira Vitals: {}", e))?;

    // ---- Thane's mandatory Overview section (was missing in earlier seed) ----
    let thane_overview_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO character_detail_sections (id, character_id, title, layout_type, content, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            thane_overview_id, char2_id,
            "Overview",
            "prose",
            r#"{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Thane Ashford has served as Keeper of the Great Archive for thirty-one years. He was apprenticed to the previous Keeper at fourteen and has not slept above ground for any prolonged stretch since. He insists this is a coincidence."}]},{"type":"paragraph","content":[{"type":"text","text":"His role is officially apolitical, but in practice he has refused four kings access to specific shelves and outlived two of them. The remaining two no longer ask."}]}]}"#,
            0, now, now
        ],
    ).map_err(|e| format!("Failed to insert Thane Overview: {}", e))?;

    // Insert lore folder and documents
    let folder_id = uuid::Uuid::new_v4().to_string();
    let doc1_id = uuid::Uuid::new_v4().to_string();
    let doc2_id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO lore_folders (id, world_id, title, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![folder_id, world_id, "History", 0, now, now],
    ).map_err(|e| format!("Failed to insert folder: {}", e))?;

    conn.execute(
        "INSERT INTO lore_documents (id, world_id, folder_id, title, content, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            doc1_id, world_id, folder_id,
            "The Sundering",
            r#"{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"The Sundering"}]},{"type":"paragraph","content":[{"type":"text","text":"The Sundering was the cataclysmic event that shattered the Eldorian Empire and reshaped the continent. Occurring approximately 500 years before the present day, it began when the Imperial Mages attempted to harness the raw energy of the Spiral Gates — ancient portals connecting Eldoria to other realms."}]},{"type":"paragraph","content":[{"type":"text","text":"The resulting magical backlash tore through the land, corrupting entire regions and severing the connections between the Spiral Gates. The empire fractured into dozens of independent kingdoms, each claiming sovereignty over the ruins of what came before."}]}]}"#,
            now, now
        ],
    ).map_err(|e| format!("Failed to insert doc 1: {}", e))?;

    conn.execute(
        "INSERT INTO lore_documents (id, world_id, folder_id, title, content, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            doc2_id, world_id, folder_id,
            "The Thornwatch Rangers",
            r#"{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"The Thornwatch Rangers"}]},{"type":"paragraph","content":[{"type":"text","text":"Founded in the aftermath of the Sundering, the Thornwatch Rangers are a paramilitary order dedicated to monitoring and containing the threats emerging from the Ashenmoor Expanse. Their headquarters, Thornwatch Keep, serves as both fortress and early warning system for the settlements along the eastern frontier."}]},{"type":"paragraph","content":[{"type":"text","text":"Rangers undergo rigorous training in survival, combat, and the identification of corrupted flora and fauna. The order operates with significant autonomy from the local kingdoms, funded by a mutual defense compact signed by the three nearest city-states."}]}]}"#,
            now, now
        ],
    ).map_err(|e| format!("Failed to insert doc 2: {}", e))?;

    // Insert entity links
    let link1_id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO entity_links (id, world_id, source_type, source_id, target_type, target_id, link_type, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![link1_id, world_id, "character", char1_id, "lore_document", doc2_id, "appears_in", now],
    ).map_err(|e| format!("Failed to insert link: {}", e))?;

    // Register in registry
    let seed_summary = "A vast realm of ancient magic, warring kingdoms, and forgotten ruins. The land is shaped by the echoes of a cataclysm known as the Sundering, which shattered the great empire that once unified all peoples under a single banner.";
    db.registry
        .execute(
            "INSERT INTO registry_worlds (id, path, title, world_type, summary, last_opened, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![world_id, file_path.to_string_lossy().to_string(), "Eldoria", "Fantasy", seed_summary, now, now, now],
        )
        .map_err(|e| format!("Failed to register seed world: {}", e))?;

    Ok(WorldSummary {
        id: world_id,
        title: "Eldoria".to_string(),
        world_type: "Fantasy".to_string(),
        summary: Some(seed_summary.to_string()),
        cover_thumbnail_base64: None,
        last_opened: Some(now.clone()),
        last_position: None,
        created_at: now,
    })
}

#[tauri::command]
pub fn update_world(
    title: Option<String>,
    summary: Option<String>,
    world_type: Option<String>,
    cover_asset_id: Option<String>,
    state: State<Mutex<AppDatabase>>,
) -> Result<WorldDetail, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    let (world_id, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    let now = chrono::Utc::now().to_rfc3339();

    // Build dynamic UPDATE for the world DB
    let mut set_clauses = vec!["updated_at = ?1".to_string()];
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(now.clone())];
    let mut idx = 2;

    if let Some(ref t) = title {
        set_clauses.push(format!("title = ?{}", idx));
        params.push(Box::new(t.clone()));
        idx += 1;
    }
    if let Some(ref s) = summary {
        set_clauses.push(format!("summary = ?{}", idx));
        params.push(Box::new(s.clone()));
        idx += 1;
    }
    if let Some(ref wt) = world_type {
        set_clauses.push(format!("world_type = ?{}", idx));
        params.push(Box::new(wt.clone()));
        idx += 1;
    }
    if let Some(ref cid) = cover_asset_id {
        if cid.is_empty() {
            // Empty string means "clear the cover"
            set_clauses.push(format!("cover_asset_id = ?{}", idx));
            params.push(Box::new(None::<String>));
        } else {
            set_clauses.push(format!("cover_asset_id = ?{}", idx));
            params.push(Box::new(cid.clone()));
        }
        idx += 1;
    }
    let _ = idx; // suppress unused warning

    let sql = format!("UPDATE worlds SET {} WHERE id = ?{}", set_clauses.join(", "), params.len() + 1);
    params.push(Box::new(world_id.clone()));

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, param_refs.as_slice())
        .map_err(|e| format!("Failed to update world: {}", e))?;

    // Sync to registry
    let mut reg_sets = vec!["updated_at = ?1".to_string()];
    let mut reg_params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(now.clone())];
    let mut ridx = 2;

    if let Some(ref t) = title {
        reg_sets.push(format!("title = ?{}", ridx));
        reg_params.push(Box::new(t.clone()));
        ridx += 1;
    }
    if let Some(ref s) = summary {
        reg_sets.push(format!("summary = ?{}", ridx));
        reg_params.push(Box::new(s.clone()));
        ridx += 1;
    }
    if let Some(ref wt) = world_type {
        reg_sets.push(format!("world_type = ?{}", ridx));
        reg_params.push(Box::new(wt.clone()));
        ridx += 1;
    }

    // If cover_asset_id provided, sync thumbnail to registry
    if let Some(ref cid) = cover_asset_id {
        if cid.is_empty() {
            // Clear the cover thumbnail
            reg_sets.push(format!("cover_thumbnail = ?{}", ridx));
            reg_params.push(Box::new(None::<Vec<u8>>));
            ridx += 1;
        } else {
            // Read the asset BLOB and store as thumbnail in registry
            let cover_blob: Result<Vec<u8>, _> = conn.query_row(
                "SELECT data FROM assets WHERE id = ?1",
                [cid],
                |row| row.get(0),
            );
            if let Ok(blob) = cover_blob {
                reg_sets.push(format!("cover_thumbnail = ?{}", ridx));
                reg_params.push(Box::new(blob));
                ridx += 1;
            }
        }
    }
    let _ = ridx;

    let reg_sql = format!(
        "UPDATE registry_worlds SET {} WHERE id = ?{}",
        reg_sets.join(", "),
        reg_params.len() + 1
    );
    reg_params.push(Box::new(world_id.clone()));

    let reg_refs: Vec<&dyn rusqlite::types::ToSql> =
        reg_params.iter().map(|p| p.as_ref()).collect();
    db.registry
        .execute(&reg_sql, reg_refs.as_slice())
        .map_err(|e| format!("Failed to update registry: {}", e))?;

    // Return updated world detail
    let detail = conn
        .query_row(
            "SELECT id, title, world_type, summary, cover_asset_id, created_at, updated_at FROM worlds LIMIT 1",
            [],
            |row| {
                Ok(WorldDetail {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    world_type: row.get(2)?,
                    summary: row.get(3)?,
                    cover_asset_id: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            },
        )
        .map_err(|e| format!("Failed to read updated world: {}", e))?;

    Ok(detail)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OverviewRecord {
    pub id: String,
    pub title: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemOverview {
    pub count: u32,
    pub recent: Vec<OverviewRecord>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WorldOverviewData {
    pub characters: SystemOverview,
    pub lore: SystemOverview,
}

#[tauri::command]
pub fn get_world_overview(
    state: State<Mutex<AppDatabase>>,
) -> Result<WorldOverviewData, String> {
    let db = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    let (_, conn) = db
        .active_world
        .as_ref()
        .ok_or("No world is currently open")?;

    // Characters
    let char_count: u32 = conn
        .query_row(
            "SELECT COUNT(*) FROM characters WHERE deleted_at IS NULL",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to count characters: {}", e))?;

    let mut char_stmt = conn
        .prepare(
            "SELECT id, name, updated_at FROM characters \
             WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT 5",
        )
        .map_err(|e| format!("Failed to prepare characters query: {}", e))?;

    let char_recent: Vec<OverviewRecord> = char_stmt
        .query_map([], |row| {
            Ok(OverviewRecord {
                id: row.get(0)?,
                title: row.get(1)?,
                updated_at: row.get(2)?,
            })
        })
        .map_err(|e| format!("Failed to query characters: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    // Lore documents
    let lore_count: u32 = conn
        .query_row(
            "SELECT COUNT(*) FROM lore_documents WHERE deleted_at IS NULL",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to count lore documents: {}", e))?;

    let mut lore_stmt = conn
        .prepare(
            "SELECT id, title, updated_at FROM lore_documents \
             WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT 5",
        )
        .map_err(|e| format!("Failed to prepare lore query: {}", e))?;

    let lore_recent: Vec<OverviewRecord> = lore_stmt
        .query_map([], |row| {
            Ok(OverviewRecord {
                id: row.get(0)?,
                title: row.get(1)?,
                updated_at: row.get(2)?,
            })
        })
        .map_err(|e| format!("Failed to query lore documents: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(WorldOverviewData {
        characters: SystemOverview {
            count: char_count,
            recent: char_recent,
        },
        lore: SystemOverview {
            count: lore_count,
            recent: lore_recent,
        },
    })
}
