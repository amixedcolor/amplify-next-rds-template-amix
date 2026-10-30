-- Migrations run once, in file-name order: on first query locally (PGlite)
-- and on deploy in AWS (Aurora PostgreSQL). Never edit an applied migration;
-- add a new numbered file instead.
CREATE TABLE todos (
  id         TEXT PRIMARY KEY,
  owner      TEXT NOT NULL,
  content    TEXT NOT NULL,
  done       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX todos_owner_created_at ON todos (owner, created_at DESC);
