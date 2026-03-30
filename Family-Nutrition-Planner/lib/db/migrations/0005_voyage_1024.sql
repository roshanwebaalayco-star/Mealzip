-- Migration: Switch embedding provider from Google text-embedding-004 (768 dims)
-- to Voyage AI voyage-3 (1024 dims).
-- Run this migration before starting the server with the new embedding service.

-- Clear stale 768-dim embeddings
UPDATE recipes SET embedding = NULL;
DELETE FROM knowledge_chunks;

-- Drop old 768-dim IVFFlat indexes
DROP INDEX IF EXISTS knowledge_chunks_embedding_idx;
DROP INDEX IF EXISTS recipes_embedding_idx;

-- Alter column dimensions from vector(768) to vector(1024)
ALTER TABLE knowledge_chunks ALTER COLUMN embedding TYPE vector(1024) USING NULL;
ALTER TABLE recipes ALTER COLUMN embedding TYPE vector(1024) USING NULL;

-- Re-create IVFFlat indexes for vector(1024)
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
  ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS recipes_embedding_idx
  ON recipes USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
