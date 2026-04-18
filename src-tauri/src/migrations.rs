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
    Ok(())
}
