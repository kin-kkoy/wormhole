use rusqlite::Connection;
use std::path::{Path, PathBuf};

use crate::migrations;

pub struct AppDatabase {
    pub registry: Connection,
    pub active_world: Option<(String, Connection)>,
    pub storage_folder: Option<String>,
    pub app_data_dir: PathBuf,
}

impl AppDatabase {
    pub fn initialize(app_data_dir: PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("Failed to create app data dir: {}", e))?;

        let registry_path = app_data_dir.join("registry.db");
        let registry = Connection::open(&registry_path)
            .map_err(|e| format!("Failed to open registry: {}", e))?;

        registry
            .execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .map_err(|e| format!("Failed to set registry pragmas: {}", e))?;

        migrations::run_registry_migrations(&registry)
            .map_err(|e| format!("Failed to run registry migrations: {}", e))?;

        let storage_folder = registry
            .query_row(
                "SELECT value FROM app_config WHERE key = 'storage_folder'",
                [],
                |row| row.get::<_, String>(0),
            )
            .ok();

        Ok(Self {
            registry,
            active_world: None,
            storage_folder,
            app_data_dir,
        })
    }

    pub fn create_world_db(&self, path: &Path) -> Result<Connection, String> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create world directory: {}", e))?;
        }

        let conn = Connection::open(path)
            .map_err(|e| format!("Failed to create world database: {}", e))?;

        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .map_err(|e| format!("Failed to set world pragmas: {}", e))?;

        migrations::run_world_migrations(&conn)
            .map_err(|e| format!("Failed to run world migrations: {}", e))?;

        Ok(conn)
    }

    pub fn open_world_db(&self, path: &Path) -> Result<Connection, String> {
        if !path.exists() {
            return Err(format!("World file not found: {}", path.display()));
        }

        let conn = Connection::open(path)
            .map_err(|e| format!("Failed to open world database: {}", e))?;

        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .map_err(|e| format!("Failed to set world pragmas: {}", e))?;

        migrations::run_world_migrations(&conn)
            .map_err(|e| format!("Failed to run world migrations: {}", e))?;

        Ok(conn)
    }

    pub fn run_recycle_bin_cleanup(&self) -> Result<(), String> {
        let mut stmt = self
            .registry
            .prepare("SELECT path FROM registry_worlds")
            .map_err(|e| format!("Failed to query worlds: {}", e))?;

        let world_paths: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| format!("Failed to read world paths: {}", e))?
            .filter_map(|r| r.ok())
            .collect();

        drop(stmt);

        for path_str in world_paths {
            let path = Path::new(&path_str);
            if !path.exists() {
                continue;
            }

            if let Ok(conn) = Connection::open(path) {
                let cutoff = chrono::Utc::now()
                    .checked_sub_signed(chrono::Duration::hours(24))
                    .unwrap()
                    .to_rfc3339();

                let tables_with_soft_delete = [
                    "entity_links",
                    "characters",
                    "lore_documents",
                    "lore_folders",
                ];

                for table in &tables_with_soft_delete {
                    let _ = conn.execute(
                        &format!(
                            "DELETE FROM {} WHERE deleted_at IS NOT NULL AND deleted_at < ?1",
                            table
                        ),
                        [&cutoff],
                    );
                }
            }
        }

        Ok(())
    }
}
