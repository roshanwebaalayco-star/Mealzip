import { findSimilarChunks, isEmbeddingConfigured, type ChunkResult, type RecipeResult } from "./embedding.js";
import { logger } from "../lib/logger.js";

export interface FamilyContext {
  zone: string;
  memberSummaries: Array<{
    name: string;
    age: number;
    gender: string;
    healthConditions: string[];
    dietaryRestrictions: string[];
  }>;
  diet?: string;
  cuisinePreferences?: string[];
  isFasting?: boolean;
}

export interface RetrievalResult {
  icmrGuidelines: string;
  recipeContext: string;
  sources: string[];
  chunkCount: number;
  recipeCount: number;
}

export async function retrieveContextForMealPlan(
  family: FamilyContext,
): Promise<RetrievalResult> {
  if (!isEmbeddingConfigured()) {
    return { icmrGuidelines: "", recipeContext: "", sources: [], chunkCount: 0, recipeCount: 0 };
  }

  const conditions = family.memberSummaries.flatMap(m => m.healthConditions);
  const uniqueConditions = [...new Set(conditions)];

  const queryParts: string[] = [
    "ICMR NIN 2024 dietary guidelines India",
    `${family.zone} zone Indian cuisine nutrition`,
  ];
  if (uniqueConditions.length > 0) {
    queryParts.push(`nutrition management for ${uniqueConditions.join(", ")}`);
  }
  if (family.isFasting) {
    queryParts.push("Indian fasting foods nutritional adequacy");
  }

  const memberAges = family.memberSummaries.map(m => m.age);
  const hasChildren = memberAges.some(a => a < 18);
  const hasElderly = memberAges.some(a => a >= 60);
  if (hasChildren) queryParts.push("child nutrition requirements India ICMR");
  if (hasElderly) queryParts.push("elderly nutrition calcium vitamin D India");

  const query = queryParts.join(". ");

  const recipeQuery = [
    `${family.zone} Indian ${family.diet ?? "vegetarian"} recipes`,
    family.cuisinePreferences?.join(" ") ?? "",
    uniqueConditions.length > 0 ? `suitable for ${uniqueConditions.join(" ")}` : "",
  ].filter(Boolean).join(" ");

  const [chunks, recipes] = await Promise.all([
    findSimilarChunks(query, "knowledge_chunks", 6).catch((err) => {
      logger.warn({ err }, "RAG: knowledge_chunks retrieval failed (non-fatal)");
      return [] as ChunkResult[];
    }),
    findSimilarChunks(recipeQuery, "recipes", 10, {
      zone: family.zone,
      diet: family.diet,
    }).catch((err) => {
      logger.warn({ err }, "RAG: recipe similarity search failed (non-fatal)");
      return [] as RecipeResult[];
    }),
  ]);

  const relevantChunks = chunks.filter(c => c.similarity > 0.3);
  const relevantRecipes = recipes.filter(r => r.similarity > 0.25);

  const icmrGuidelines = relevantChunks.length > 0
    ? formatChunksForPrompt(relevantChunks)
    : "";

  const recipeContext = relevantRecipes.length > 0
    ? formatRecipesForPrompt(relevantRecipes)
    : "";

  const sources = [...new Set(relevantChunks.map(c => c.source))];

  return {
    icmrGuidelines,
    recipeContext,
    sources,
    chunkCount: relevantChunks.length,
    recipeCount: relevantRecipes.length,
  };
}

export async function retrieveContextForChat(
  userMessage: string,
  zone?: string,
): Promise<{ knowledgeContext: string; recipeContext: string; sources: string[] }> {
  if (!isEmbeddingConfigured()) {
    return { knowledgeContext: "", recipeContext: "", sources: [] };
  }

  const [chunks, recipes] = await Promise.all([
    findSimilarChunks(userMessage, "knowledge_chunks", 4).catch(() => [] as ChunkResult[]),
    findSimilarChunks(userMessage, "recipes", 5, zone ? { zone } : undefined).catch(() => [] as RecipeResult[]),
  ]);

  const relevantChunks = chunks.filter(c => c.similarity > 0.35);
  const relevantRecipes = recipes.filter(r => r.similarity > 0.3);

  const knowledgeContext = relevantChunks.length > 0
    ? `\n\nICMR/NUTRITION KNOWLEDGE BASE (retrieved via RAG — cite these when relevant):\n${relevantChunks.map(c => `• [${c.source}]: ${c.content.slice(0, 400)}`).join("\n")}`
    : "";

  const recipeContext = relevantRecipes.length > 0
    ? `\n\nMATCHED RECIPES FROM DATABASE (vector similarity):\n${JSON.stringify(relevantRecipes.map(r => ({
        name: r.name,
        cuisine: r.cuisine,
        diet: r.diet,
        course: r.course,
        similarity: Math.round(r.similarity * 100) / 100,
      })), null, 2)}\n\nUse these specific recipes when answering the user's question.`
    : "";

  const sources = [...new Set(relevantChunks.map(c => c.source))];

  return { knowledgeContext, recipeContext, sources };
}

function formatChunksForPrompt(chunks: ChunkResult[]): string {
  const lines = chunks.map(c =>
    `[${c.source}] (relevance: ${Math.round(c.similarity * 100)}%): ${c.content.slice(0, 500)}`
  );
  return `
══════════════════════════════════════════════════════════════════
RAG — ICMR/NUTRITION KNOWLEDGE BASE (retrieved guidelines)
══════════════════════════════════════════════════════════════════
The following excerpts are retrieved from authoritative ICMR-NIN documents
and nutrition knowledge sources. USE these to inform your meal plan design.
Cite specific guidelines where applicable in icmr_rationale fields.

${lines.join("\n\n")}`;
}

function formatRecipesForPrompt(recipes: RecipeResult[]): string {
  const recipeLines = recipes.map(r =>
    `• ${r.name} (${r.diet}, ${r.cuisine}) — similarity: ${Math.round(r.similarity * 100)}%`
  );
  return `
RAG RECIPE SUGGESTIONS (vector-similar to family profile):
${recipeLines.join("\n")}
PREFER these recipes when they match the family's dietary needs.`;
}
