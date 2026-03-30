import fs from "fs";
import path from "path";
import { pool } from "@workspace/db";
import { generateEmbedding, generateEmbeddingsBatch, isEmbeddingConfigured } from "./embedding.js";

const KNOWLEDGE_BASE_PATH = path.join(
  process.cwd(),
  "knowledge_base",
);

function chunkText(
  text: string,
  chunkSize: number = 800,
  overlap: number = 150,
): string[] {
  const words = text.split(" ");
  const chunks: string[] = [];

  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    const chunk = words.slice(start, end).join(" ");
    if (chunk.trim().length > 50) {
      chunks.push(chunk.trim());
    }
    start += chunkSize - overlap;
  }

  return chunks;
}

async function ingestPDF(
  filename: string,
  sourceName: string,
): Promise<void> {
  const filePath = path.join(KNOWLEDGE_BASE_PATH, filename);

  if (!fs.existsSync(filePath)) {
    console.warn(`PDF not found: ${filePath}. Skipping.`);
    return;
  }

  console.log(`Ingesting PDF: ${filename}`);
  const { PDFParse } = await import("pdf-parse");
  const buffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const pdfData = await parser.getText();
  const text = pdfData.text;

  const chunks = chunkText(text, 600, 100);
  console.log(`Created ${chunks.length} chunks from ${filename}`);

  const embeddings = await generateEmbeddingsBatch(chunks);

  for (let i = 0; i < chunks.length; i++) {
    const embeddingStr = `[${embeddings[i].join(",")}]`;

    await pool.query(
      `INSERT INTO knowledge_chunks
        (source, chunk_index, content, embedding, metadata)
      VALUES ($1, $2, $3, $4::vector, $5)
      ON CONFLICT DO NOTHING`,
      [
        sourceName,
        i,
        chunks[i],
        embeddingStr,
        JSON.stringify({ filename, page_estimate: i }),
      ],
    );
  }

  console.log(`Ingested ${chunks.length} chunks from ${filename}`);
}

async function ingestMealPatterns(): Promise<void> {
  const filePath = path.join(KNOWLEDGE_BASE_PATH, "meal_patterns.txt");

  if (!fs.existsSync(filePath)) {
    console.warn("meal_patterns.txt not found. Skipping.");
    return;
  }

  console.log("Ingesting meal_patterns.txt");
  const text = fs.readFileSync(filePath, "utf-8");

  const sections = text
    .split(/\n\n+/)
    .filter((s) => s.trim().length > 50);

  const embeddings = await generateEmbeddingsBatch(sections);

  for (let i = 0; i < sections.length; i++) {
    const embeddingStr = `[${embeddings[i].join(",")}]`;

    await pool.query(
      `INSERT INTO knowledge_chunks
        (source, chunk_index, content, embedding, metadata)
      VALUES ($1, $2, $3, $4::vector, $5)
      ON CONFLICT DO NOTHING`,
      [
        "meal_patterns",
        i,
        sections[i],
        embeddingStr,
        JSON.stringify({ type: "clinical_pattern" }),
      ],
    );
  }

  console.log(`Ingested ${sections.length} meal pattern sections`);
}

async function embedRecipes(): Promise<void> {
  console.log("Embedding recipes...");

  const BATCH_SIZE = 500;
  let totalEmbedded = 0;

  while (true) {
    const result = await pool.query(
      `SELECT id, name, cuisine, course, diet,
              ingredients, instructions
      FROM recipes
      WHERE embedding IS NULL
      LIMIT $1`,
      [BATCH_SIZE],
    );

    const recipes = result.rows;
    if (recipes.length === 0) {
      break;
    }

    console.log(`Embedding batch of ${recipes.length} recipes (total so far: ${totalEmbedded})`);

    for (const recipe of recipes) {
      const recipeText = [
        `Recipe: ${recipe.name}`,
        `Zone: ${recipe.cuisine}`,
        `Course: ${recipe.course}`,
        `Diet: ${recipe.diet}`,
        `Ingredients: ${recipe.ingredients}`,
        `Instructions: ${recipe.instructions}`,
      ].join(". ");

      try {
        const embedding = await generateEmbedding(recipeText);
        const embeddingStr = `[${embedding.join(",")}]`;

        await pool.query(
          `UPDATE recipes SET embedding = $1::vector WHERE id = $2`,
          [embeddingStr, recipe.id],
        );
        totalEmbedded++;
      } catch (err) {
        console.warn(`Failed to embed recipe ${recipe.id} (${recipe.name}):`, err);
      }
    }

    console.log(`Batch complete. Total embedded: ${totalEmbedded}`);
  }

  if (totalEmbedded === 0) {
    console.log("All recipes already embedded.");
  } else {
    console.log(`Finished embedding ${totalEmbedded} recipes.`);
  }
}

export async function ingestKnowledgeBase(): Promise<void> {
  console.log("Starting knowledge base ingestion...");

  if (!isEmbeddingConfigured()) {
    console.log("Embedding API not configured. Skipping knowledge base ingestion. Set GEMINI_API_KEY or configure the Gemini integration.");
    return;
  }

  const existing = await pool.query(
    "SELECT COUNT(*) as count FROM knowledge_chunks",
  );

  const count = parseInt(existing.rows[0].count, 10);

  if (count > 0 && process.env.FORCE_REINGEST !== "true") {
    console.log(
      `Knowledge base already has ${count} chunks. Skipping document ingestion. Set FORCE_REINGEST=true to re-ingest.`,
    );
  } else {
    await ingestPDF("icmr_nin_guidelines.pdf", "icmr_guidelines");
    await ingestPDF("icmr_nin_rda.pdf", "icmr_rda");
    await ingestMealPatterns();
  }

  await embedRecipes();

  console.log("Knowledge base ingestion complete.");
}

export async function forceReingestKnowledgeBase(): Promise<void> {
  console.log("Force re-ingesting knowledge base...");

  await pool.query("DELETE FROM knowledge_chunks");
  await pool.query("UPDATE recipes SET embedding = NULL");

  await ingestKnowledgeBase();
}
