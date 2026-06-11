-- Read Mode progress + bookmarks (Proposal 03, book-respecting variant).
-- Per-document user reading state; lives in the world file so it travels
-- with the world. Rows are created lazily on first read/bookmark.
CREATE TABLE IF NOT EXISTS read_progress (
    document_id TEXT PRIMARY KEY,
    world_id TEXT NOT NULL,
    read_at TEXT,
    bookmarked INTEGER NOT NULL DEFAULT 0
);

UPDATE schema_version SET version = 17;
