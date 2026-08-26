-- 1Min1Book Knowledge Graph — initial schema
-- See docs/architecture.md for the reasoning behind this shape.

CREATE TYPE node_type AS ENUM ('BOOK', 'AUTHOR', 'GENRE', 'TOPIC');
CREATE TYPE relationship_type AS ENUM (
  'WRITTEN_BY', 'BELONGS_TO_GENRE', 'DISCUSSES', 'SIMILAR_TO'
);

CREATE TABLE nodes (
  id          BIGSERIAL PRIMARY KEY,
  type        node_type NOT NULL,
  name        TEXT NOT NULL,
  external_id TEXT,              -- stable ID from the 1Min1Book source, when there is one
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_nodes_type_name ON nodes (type, name);
CREATE UNIQUE INDEX idx_nodes_external_id ON nodes (external_id) WHERE external_id IS NOT NULL;

-- Typed detail table for BOOK nodes only. Authors/genres/topics need no
-- detail table — a name on the node row is enough for them.
CREATE TABLE books (
  node_id        BIGINT PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
  summary        TEXT,
  author_text    TEXT,
  published_year INT,
  cover_url      TEXT
);

CREATE TABLE edges (
  id                BIGSERIAL PRIMARY KEY,
  source_node_id    BIGINT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_node_id    BIGINT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  relationship_type relationship_type NOT NULL,
  weight            REAL NOT NULL DEFAULT 1.0,
  explanation       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_edges_source ON edges (source_node_id);
CREATE INDEX idx_edges_target ON edges (target_node_id);
CREATE INDEX idx_edges_source_weight ON edges (source_node_id, weight DESC);
