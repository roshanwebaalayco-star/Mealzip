CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT knowledge_chunks_source_chunk_idx UNIQUE (source, chunk_index)
);

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS embedding vector(768);

ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS icmr_compliance JSONB;
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS rag_context_used JSONB;

CREATE INDEX IF NOT EXISTS knowledge_chunks_source_idx ON knowledge_chunks (source);
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS recipes_embedding_idx ON recipes USING hnsw (embedding vector_cosine_ops);
