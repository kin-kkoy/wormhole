mod commands;
mod db;
mod migrations;

use std::sync::Mutex;

use tauri::Manager;

use commands::{
    assets, atlas, character_blocks, character_sections, characters, graph, links, lore, search,
    worlds,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data directory");

            let app_db = db::AppDatabase::initialize(app_data_dir)
                .expect("Failed to initialize database");

            // Run recycle bin cleanup on startup
            if let Err(e) = app_db.run_recycle_bin_cleanup() {
                eprintln!("Warning: recycle bin cleanup failed: {}", e);
            }

            app.manage(Mutex::new(app_db));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            worlds::get_app_config,
            worlds::set_storage_folder,
            worlds::create_world,
            worlds::list_worlds,
            worlds::open_world,
            worlds::close_world,
            worlds::delete_world,
            worlds::seed_example_world,
            worlds::update_world,
            worlds::get_world_overview,
            assets::import_asset,
            assets::get_asset,
            assets::get_asset_bytes,
            graph::get_atlas_graph_data,
            graph::get_characters_graph_data,
            graph::get_lore_graph_data,
            graph::create_shared_node,
            graph::update_shared_node,
            graph::delete_shared_node,
            graph::add_shared_node_member,
            graph::remove_shared_node_member,
            graph::auto_detect_shared_nodes,
            graph::get_asset_batch,
            // Characters
            characters::list_characters,
            characters::get_character,
            characters::create_character,
            characters::update_character,
            characters::delete_character,
            characters::restore_character,
            characters::reorder_characters,
            characters::list_deleted_characters,
            characters::purge_character,
            // Character card blocks
            character_blocks::list_card_blocks,
            character_blocks::create_card_block,
            character_blocks::update_card_block,
            character_blocks::delete_card_block,
            character_blocks::batch_update_block_positions,
            // Character detail sections
            character_sections::list_detail_sections,
            character_sections::create_detail_section,
            character_sections::update_detail_section,
            character_sections::delete_detail_section,
            character_sections::reorder_detail_sections,
            // Lore
            lore::list_lore_folders,
            lore::create_lore_folder,
            lore::rename_lore_folder,
            lore::delete_lore_folder,
            lore::get_folder_doc_count,
            lore::move_lore_folder,
            lore::reorder_lore_folders,
            lore::list_lore_documents,
            lore::create_lore_document,
            lore::get_lore_document,
            lore::update_lore_document,
            lore::delete_lore_document,
            lore::restore_lore_document,
            lore::move_lore_document,
            lore::list_deleted_lore_documents,
            lore::list_deleted_lore_folders,
            lore::restore_lore_folder,
            lore::purge_lore_document,
            lore::purge_lore_folder,
            // Entity Links
            links::list_entity_links,
            links::create_entity_link,
            links::delete_entity_link,
            links::search_linkable_records,
            links::resolve_inline_links,
            links::get_next_page_link,
            links::set_next_page_link,
            links::list_next_page_links,
            // Atlas Canvas (Stage 5)
            atlas::list_map_entities,
            atlas::get_map_entity,
            atlas::create_map_entity,
            atlas::update_map_entity,
            atlas::update_map_entity_position,
            atlas::delete_map_entity,
            atlas::restore_map_entity,
            atlas::get_paint_layer,
            atlas::save_paint_layer,
            atlas::clear_paint_layer,
            atlas::get_atlas_base_map,
            atlas::set_atlas_base_map,
            atlas::clear_atlas_base_map,
            atlas::list_deleted_map_entities,
            atlas::purge_map_entity,
            // Search
            search::search_world,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
