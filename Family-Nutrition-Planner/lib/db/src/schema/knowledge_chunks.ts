import { pgTable, serial, text, integer, jsonb, timestamp, index, uniqueIndex, customType } from "drizzle-orm/pg-core";

const vector768 = customType<{ data: string }>({
  dataType() {
    return "vector(768)";
  },
});

export const knowledgeChunksTable = pgTable("knowledge_chunks", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  embedding: vector768("embedding"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("knowledge_chunks_source_idx").on(table.source),
  uniqueIndex("knowledge_chunks_source_chunk_idx").on(table.source, table.chunkIndex),
]);

export type KnowledgeChunk = typeof knowledgeChunksTable.$inferSelect;
