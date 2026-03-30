import fs from "fs";
import path from "path";
import { pool } from "@workspace/db";
import { generateEmbedding, isEmbeddingConfigured } from "./embedding.js";

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

function chunkTextSectionAware(
  text: string,
  chunkSize: number = 300,
  overlap: number = 100,
): string[] {
  const sectionBreaks = text.split(
    /(?:\n\n+|(?=Table \d+:|RDA for|Recommended|Energy requirements|Protein requirements|Iron requirements|Calcium requirements|Dietary guidelines|Chapter \d+))/,
  );

  const chunks: string[] = [];

  for (const section of sectionBreaks) {
    if (section.trim().length < 30) continue;

    if (section.split(" ").length <= chunkSize) {
      chunks.push(section.trim());
    } else {
      const subChunks = chunkText(section, chunkSize, overlap);
      chunks.push(...subChunks);
    }
  }

  return chunks.filter((c) => c.length > 30);
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

  const isICMRDoc =
    sourceName.includes("icmr") || sourceName.includes("rda");

  const chunks = isICMRDoc
    ? chunkTextSectionAware(text, 300, 100)
    : chunkText(text, 600, 100);
  console.log(`Created ${chunks.length} chunks from ${filename} (${isICMRDoc ? "section-aware" : "standard"} chunking)`);

  const existingResult = await pool.query<{ chunk_index: number }>(
    `SELECT chunk_index FROM knowledge_chunks WHERE source = $1`,
    [sourceName],
  );
  const existingIndices = new Set(existingResult.rows.map(r => r.chunk_index));

  let ingested = 0;
  for (let i = 0; i < chunks.length; i++) {
    if (existingIndices.has(i)) continue;
    try {
      const embedding = await generateEmbedding(chunks[i]);
      const embeddingStr = `[${embedding.join(",")}]`;
      await pool.query(
        `INSERT INTO knowledge_chunks
          (source, chunk_index, content, embedding, metadata)
        VALUES ($1, $2, $3, $4::vector, $5)
        ON CONFLICT (source, chunk_index) DO NOTHING`,
        [sourceName, i, chunks[i], embeddingStr, JSON.stringify({ filename, page_estimate: i })],
      );
      ingested++;
      if (i < chunks.length - 1) await new Promise((r) => setTimeout(r, 21000));
    } catch (err) {
      console.warn(`Failed to embed PDF chunk ${i}:`, err);
      await new Promise((r) => setTimeout(r, 30000));
    }
  }

  console.log(`Ingested ${ingested} new chunks from ${filename}`);
}

async function ingestCSV(
  filename: string,
  sourceName: string,
): Promise<void> {
  const filePath = path.join(KNOWLEDGE_BASE_PATH, filename);

  if (!fs.existsSync(filePath)) {
    console.warn(`CSV not found: ${filePath}. Skipping.`);
    return;
  }

  console.log(`Ingesting CSV: ${filename}`);
  const text = fs.readFileSync(filePath, "utf-8");

  const rows = text.split("\n").filter((row) => row.trim().length > 10);
  const header = rows[0];
  const dataRows = rows.slice(1);

  const chunks: string[] = [];
  const ROWS_PER_CHUNK = 15;

  for (let i = 0; i < dataRows.length; i += ROWS_PER_CHUNK) {
    const chunkRows = dataRows.slice(i, i + ROWS_PER_CHUNK);
    const chunkText = `${header}\n${chunkRows.join("\n")}`;
    if (chunkText.trim().length > 50) {
      chunks.push(chunkText.trim());
    }
  }

  console.log(`Created ${chunks.length} chunks from ${filename}`);

  const existingResult = await pool.query<{ chunk_index: number }>(
    `SELECT chunk_index FROM knowledge_chunks WHERE source = $1`,
    [sourceName],
  );
  const existingIndices = new Set(existingResult.rows.map(r => r.chunk_index));

  let ingested = 0;
  for (let i = 0; i < chunks.length; i++) {
    if (existingIndices.has(i)) continue;
    try {
      const embedding = await generateEmbedding(chunks[i]);
      const embeddingStr = `[${embedding.join(",")}]`;
      await pool.query(
        `INSERT INTO knowledge_chunks
          (source, chunk_index, content, embedding, metadata)
        VALUES ($1, $2, $3, $4::vector, $5)
        ON CONFLICT (source, chunk_index) DO NOTHING`,
        [sourceName, i, chunks[i], embeddingStr, JSON.stringify({ filename, chunk_offset: i })],
      );
      ingested++;
      if (i < chunks.length - 1) await new Promise((r) => setTimeout(r, 21000));
    } catch (err) {
      console.warn(`Failed to embed CSV chunk ${i}:`, err);
      await new Promise((r) => setTimeout(r, 30000));
    }
  }

  console.log(`Ingested ${ingested} new chunks from ${filename}`);
}

async function ingestTextFile(
  filename: string,
  sourceName: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const filePath = path.join(KNOWLEDGE_BASE_PATH, filename);

  if (!fs.existsSync(filePath)) {
    console.warn(`Text file not found: ${filePath}. Skipping.`);
    return;
  }

  console.log(`Ingesting text file: ${filename} as source "${sourceName}"`);
  const text = fs.readFileSync(filePath, "utf-8");

  const isICMRDoc = sourceName.includes("icmr") || sourceName.includes("rda");
  const sections = isICMRDoc
    ? chunkTextSectionAware(text, 300, 100)
    : text.split(/\n\n+/).filter((s) => s.trim().length > 50);

  console.log(`Created ${sections.length} sections from ${filename}`);

  const existingResult = await pool.query<{ chunk_index: number }>(
    `SELECT chunk_index FROM knowledge_chunks WHERE source = $1`,
    [sourceName],
  );
  const existingIndices = new Set(existingResult.rows.map(r => r.chunk_index));

  let ingested = 0;
  let skipped = 0;

  for (let i = 0; i < sections.length; i++) {
    if (existingIndices.has(i)) {
      skipped++;
      continue;
    }

    try {
      const embedding = await generateEmbedding(sections[i]);
      const embeddingStr = `[${embedding.join(",")}]`;

      await pool.query(
        `INSERT INTO knowledge_chunks
          (source, chunk_index, content, embedding, metadata)
        VALUES ($1, $2, $3, $4::vector, $5)
        ON CONFLICT (source, chunk_index) DO NOTHING`,
        [
          sourceName,
          i,
          sections[i],
          embeddingStr,
          JSON.stringify({ filename, ...metadata }),
        ],
      );

      ingested++;
      if (ingested % 10 === 0) {
        console.log(`Ingested ${ingested}/${sections.length} chunks from ${filename}`);
      }

      if (i < sections.length - 1) {
        await new Promise((r) => setTimeout(r, 21000));
      }
    } catch (err) {
      console.warn(`Failed to embed chunk ${i} of ${filename}:`, err);
      await new Promise((r) => setTimeout(r, 30000));
    }
  }

  console.log(`Ingested ${ingested} new sections from ${filename} (${skipped} already existed)`);
}

async function ingestMealPatterns(): Promise<void> {
  await ingestTextFile("meal_patterns.txt", "meal_patterns", { type: "clinical_pattern" });
}

async function ingestAllCSVs(): Promise<void> {
  if (!fs.existsSync(KNOWLEDGE_BASE_PATH)) return;

  const files = fs.readdirSync(KNOWLEDGE_BASE_PATH).filter((f) => f.endsWith(".csv"));
  if (files.length === 0) {
    console.log("No CSV files found in knowledge_base/. Skipping CSV ingestion.");
    return;
  }

  for (const file of files) {
    const sourceName = `csv_${path.basename(file, ".csv")}`;
    await ingestCSV(file, sourceName);
  }
}

async function embedRecipes(): Promise<void> {
  console.log("Embedding recipes...");

  const FETCH_SIZE = 128;
  let totalEmbedded = 0;

  while (true) {
    const result = await pool.query(
      `SELECT id, name, cuisine, course, diet,
              ingredients, instructions
      FROM recipes
      WHERE embedding IS NULL
      LIMIT $1`,
      [FETCH_SIZE],
    );

    const recipes = result.rows;
    if (recipes.length === 0) {
      break;
    }

    console.log(`Embedding batch of ${recipes.length} recipes via Voyage AI (total so far: ${totalEmbedded})`);

    const recipeTexts = recipes.map((recipe) =>
      [
        `Recipe: ${recipe.name}`,
        `Zone: ${recipe.cuisine}`,
        `Course: ${recipe.course}`,
        `Diet: ${recipe.diet}`,
        `Ingredients: ${recipe.ingredients}`,
        `Instructions: ${recipe.instructions}`,
      ].join(". "),
    );

    try {
      const embeddings = await generateEmbeddingsBatch(recipeTexts);

      for (let i = 0; i < recipes.length; i++) {
        const embeddingStr = `[${embeddings[i].join(",")}]`;
        await pool.query(
          `UPDATE recipes SET embedding = $1::vector WHERE id = $2`,
          [embeddingStr, recipes[i].id],
        );
        totalEmbedded++;
      }

      console.log(`Batch complete. Total embedded: ${totalEmbedded}`);
    } catch (err) {
      console.warn(`Failed to embed recipe batch starting at index ${totalEmbedded}:`, err);
      break;
    }
  }

  if (totalEmbedded === 0) {
    console.log("All recipes already embedded.");
  } else {
    console.log(`Finished embedding ${totalEmbedded} recipes.`);
  }
}

async function ingestPDFOrText(
  pdfFilename: string,
  txtFilename: string,
  sourceName: string,
): Promise<void> {
  const pdfPath = path.join(KNOWLEDGE_BASE_PATH, pdfFilename);
  if (fs.existsSync(pdfPath)) {
    await ingestPDF(pdfFilename, sourceName);
  } else {
    await ingestTextFile(txtFilename, sourceName);
  }
}

export async function ingestKnowledgeBase(): Promise<void> {
  console.log("Starting knowledge base ingestion...");

  if (!isEmbeddingConfigured()) {
    console.log("Embedding API not configured. Skipping knowledge base ingestion. Set VOYAGE_API_KEY or GEMINI_API_KEY.");
    return;
  }

  await ingestPDFOrText("icmr_nin_guidelines.pdf", "icmr_nin_guidelines.txt", "icmr_guidelines");
  await ingestPDFOrText("icmr_nin_rda.pdf", "icmr_nin_rda.txt", "icmr_rda");
  await ingestMealPatterns();
  await ingestAllCSVs();

  console.log("Knowledge base ingestion complete.");
}

export async function forceReingestKnowledgeBase(): Promise<void> {
  console.log("Force re-ingesting knowledge base...");

  await pool.query("DELETE FROM knowledge_chunks");
  await pool.query("UPDATE recipes SET embedding = NULL");

  await ingestKnowledgeBase();
}

export async function reingestICMROnly(): Promise<void> {
  console.log("Re-ingesting ICMR documents only...");

  await pool.query(
    "DELETE FROM knowledge_chunks WHERE source IN ('icmr_guidelines', 'icmr_rda')",
  );

  if (!isEmbeddingConfigured()) {
    console.warn("Embedding not configured — skipping ICMR re-ingestion.");
    return;
  }

  await ingestPDFOrText("icmr_nin_guidelines.pdf", "icmr_nin_guidelines.txt", "icmr_guidelines");
  await ingestPDFOrText("icmr_nin_rda.pdf", "icmr_nin_rda.txt", "icmr_rda");

  const result = await pool.query<{ source: string; count: string }>(
    "SELECT source, COUNT(*) as count FROM knowledge_chunks WHERE source IN ('icmr_guidelines', 'icmr_rda') GROUP BY source",
  );

  console.log("ICMR re-ingestion complete:");
  result.rows.forEach((r) =>
    console.log(`  ${r.source}: ${r.count} chunks`),
  );
}
