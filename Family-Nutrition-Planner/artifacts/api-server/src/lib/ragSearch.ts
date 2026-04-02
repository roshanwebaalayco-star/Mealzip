/**
 * FILE: server/lib/ragSearch.ts
 * PURPOSE: Retrieves the top-K most relevant ICMR-NIN knowledge chunks
 *          for a given user query.
 *
 * MODES:
 *  1. Vector mode (direct Gemini API key): Uses text-embedding-004 + cosine similarity
 *  2. BM25 mode (Replit modelfarm): Uses BM25 ranking (TF-IDF with
 *     document-length normalization, k1=1.2, b=0.75) since modelfarm
 *     does not support the embedContent endpoint
 */

import { localDb, knowledgeChunksTable } from "@workspace/db";

const MAX_CHUNK_ROWS = 1_000;
const EMBED_TIMEOUT_MS = 5_000;

export interface RagChunk {
  content: string;
  topic: string;
  source: string;
  score: number;
}

interface KnowledgeChunkRow {
  id: number;
  content: string;
  embedding: number[] | string;
  source: string;
  metadata: Record<string, unknown> | null;
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dot  += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }

  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  return magnitude === 0 ? 0 : dot / magnitude;
}

function isModelfarmMode(): boolean {
  return !!(process.env.AI_INTEGRATIONS_GEMINI_BASE_URL && process.env.AI_INTEGRATIONS_GEMINI_API_KEY);
}

const BM25_K1 = 1.2;
const BM25_B = 0.75;

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/\s+/).filter(t => t.length > 2);
}

function countTermFrequency(term: string, tokens: string[]): number {
  let count = 0;
  for (const t of tokens) {
    if (t.includes(term)) count++;
  }
  return count;
}

function bm25Score(
  queryTerms: string[],
  docTokens: string[],
  avgDocLen: number,
  docFreqs: Map<string, number>,
  totalDocs: number
): number {
  if (queryTerms.length === 0 || docTokens.length === 0) return 0;

  const docLen = docTokens.length;
  let score = 0;

  for (const term of queryTerms) {
    const tf = countTermFrequency(term, docTokens);
    if (tf === 0) continue;

    const df = docFreqs.get(term) ?? 0;
    const idf = Math.log((totalDocs - df + 0.5) / (df + 0.5) + 1);
    const tfNorm = (tf * (BM25_K1 + 1)) / (tf + BM25_K1 * (1 - BM25_B + BM25_B * (docLen / avgDocLen)));
    score += idf * tfNorm;
  }

  return score;
}

function buildCorpusStats(
  rows: KnowledgeChunkRow[],
  queryTerms: string[]
): { tokenizedDocs: string[][]; avgDocLen: number; docFreqs: Map<string, number> } {
  const tokenizedDocs = rows.map(r => tokenize(r.content));
  const totalTokens = tokenizedDocs.reduce((sum, d) => sum + d.length, 0);
  const avgDocLen = rows.length > 0 ? totalTokens / rows.length : 1;

  const docFreqs = new Map<string, number>();
  for (const term of queryTerms) {
    let df = 0;
    for (const docTokens of tokenizedDocs) {
      if (docTokens.some(t => t.includes(term))) df++;
    }
    docFreqs.set(term, df);
  }

  return { tokenizedDocs, avgDocLen, docFreqs };
}

async function embedQuery(queryText: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("No direct GEMINI_API_KEY for embeddings");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EMBED_TIMEOUT_MS);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: { parts: [{ text: queryText }] },
        taskType: "RETRIEVAL_QUERY",
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "(unreadable body)");
      throw new Error(`Embedding API failed (HTTP ${response.status}): ${errText}`);
    }

    const data = await response.json();

    if (!data?.embedding?.values || !Array.isArray(data.embedding.values)) {
      throw new Error(
        `Embedding API returned unexpected shape. Body: ${JSON.stringify(data).slice(0, 300)}`
      );
    }

    return data.embedding.values as number[];
  } finally {
    clearTimeout(timeoutId);
  }
}

const HEALTH_KEYWORDS: string[] = [
  "eat", "eating", "drink", "drinking", "cook", "cooking",
  "avoid", "restrict", "substitute", "replace",
  "food", "meal", "diet", "nutrition", "breakfast", "lunch", "dinner", "snack",
  "ghee", "dal", "roti", "sabzi", "khana", "chawal", "atta", "maida",
  "paneer", "curd", "dahi", "oil", "rice", "chapati",
  "protein", "fat", "carb", "carbohydrate", "sugar", "sodium", "salt",
  "vitamin", "mineral", "calcium", "iron", "fibre", "fiber",
  "calorie", "caloric", "kcal",
  "diabetes", "diabetic", "blood pressure", "hypertension",
  "cholesterol", "thyroid", "anemia", "anaemia", "obesity",
  "swasth", "sehat", "peena", "meetha", "namak", "cheeni", "motapa",
  "medicine", "tablet", "supplement", "medication", "drug", "metformin",
  "glycemic", "insulin", "hemoglobin", "absorption", "deficiency",
];

function isHealthRelatedQuery(message: string): boolean {
  const lower = message.toLowerCase();
  return HEALTH_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function runRagSearch(
  userMessage: string,
  topK: number = 4,
  minScore: number = 0.75
): Promise<RagChunk[]> {
  if (!isHealthRelatedQuery(userMessage)) {
    return [];
  }

  let rows: KnowledgeChunkRow[];
  try {
    rows = (await localDb
      .select()
      .from(knowledgeChunksTable)
      .limit(MAX_CHUNK_ROWS)) as KnowledgeChunkRow[];
  } catch (err) {
    console.error("[RAG] DB fetch failed:", err);
    return [];
  }

  if (!rows || rows.length === 0) {
    console.warn("[RAG] knowledge_chunks table is empty. No ICMR data injected.");
    return [];
  }

  if (isModelfarmMode()) {
    return runKeywordRag(userMessage, rows, topK, 0.3);
  }

  return runVectorRag(userMessage, rows, topK, minScore);
}

function runKeywordRag(
  userMessage: string,
  rows: KnowledgeChunkRow[],
  topK: number,
  _minScore: number
): RagChunk[] {
  const queryTerms = tokenize(userMessage).filter(t => t.length > 2);
  if (queryTerms.length === 0) return [];

  const { tokenizedDocs, avgDocLen, docFreqs } = buildCorpusStats(rows, queryTerms);

  const scored: RagChunk[] = [];

  for (let i = 0; i < rows.length; i++) {
    const score = bm25Score(queryTerms, tokenizedDocs[i], avgDocLen, docFreqs, rows.length);
    if (score <= 0) continue;

    const topic = (rows[i].metadata as any)?.topic ?? rows[i].source ?? "general";
    scored.push({
      content: rows[i].content,
      topic,
      source: rows[i].source ?? "ICMR-NIN",
      score,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const results = scored.slice(0, topK);

  if (results.length === 0) {
    console.info("[RAG] BM25 mode: No chunks matched query terms");
  } else {
    console.info(
      `[RAG] BM25 mode: Injecting ${results.length} chunk(s). Top score: ${results[0].score.toFixed(3)}`
    );
  }

  return results;
}

async function runVectorRag(
  userMessage: string,
  rows: KnowledgeChunkRow[],
  topK: number,
  minScore: number
): Promise<RagChunk[]> {
  let queryVector: number[];
  try {
    queryVector = await embedQuery(userMessage);
  } catch (err) {
    console.error("[RAG] Embedding failed, falling back to keyword search:", err);
    return runKeywordRag(userMessage, rows, topK, 0.3);
  }

  const scored = rows
    .map((row): RagChunk | null => {
      let embedding: number[];

      if (typeof row.embedding === "string") {
        try {
          embedding = JSON.parse(row.embedding);
        } catch {
          return null;
        }
      } else if (Array.isArray(row.embedding)) {
        embedding = row.embedding;
      } else {
        return null;
      }

      if (embedding.length === 0) return null;

      const topic = (row.metadata as any)?.topic ?? row.source ?? "general";

      return {
        content: row.content,
        topic,
        source:  row.source ?? "ICMR-NIN",
        score:   cosineSimilarity(queryVector, embedding),
      };
    })
    .filter((item): item is RagChunk => item !== null && item.score >= minScore);

  scored.sort((a, b) => b.score - a.score);
  const results = scored.slice(0, topK);

  if (results.length === 0) {
    console.info("[RAG] Vector mode: No chunks met minScore =", minScore);
  } else {
    console.info(
      `[RAG] Vector mode: Injecting ${results.length} chunk(s). Top score: ${results[0].score.toFixed(3)}`
    );
  }

  return results;
}

export function formatRagChunksForPrompt(chunks: RagChunk[]): string {
  if (chunks.length === 0) return "";

  const lines = chunks.map(
    (chunk, i) =>
      `[ICMR Evidence ${i + 1}] ` +
      `(Topic: ${chunk.topic} | Source: ${chunk.source} | ` +
      `Relevance: ${(chunk.score * 100).toFixed(1)}%)\n${chunk.content}`
  );

  return `### ICMR EVIDENCE\n${lines.join("\n\n")}`;
}
