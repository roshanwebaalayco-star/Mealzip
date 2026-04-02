import { findSimilarChunks, isEmbeddingConfigured, type ChunkResult, type RecipeResult } from "./embedding.js";
import { logger } from "../lib/logger.js";

const RAG_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export interface FamilyContext {
  zone: string;
  memberSummaries: Array<{
    name: string;
    age: number;
    gender: string;
    healthConditions: string[];
    dietaryType: string;
  }>;
  diet?: string;
  cuisinePreferences?: string[];
  isFasting?: boolean;
  budget?: number;
}

export interface RetrievalResult {
  icmrGuidelines: string;
  mealPatterns: string;
  nutritionRules: string;
  relevantRecipes: string;
  contextSummary: string;
  sources: string[];
  chunkCount: number;
  recipeCount: number;
}

export async function retrieveContextForMealPlan(
  family: FamilyContext,
): Promise<RetrievalResult> {
  const emptyResult: RetrievalResult = {
    icmrGuidelines: "", mealPatterns: "", nutritionRules: "",
    relevantRecipes: "", contextSummary: "", sources: [],
    chunkCount: 0, recipeCount: 0,
  };

  if (!isEmbeddingConfigured()) {
    return emptyResult;
  }

  logger.info({ zone: family.zone, memberCount: family.memberSummaries.length }, "Starting RAG retrieval for meal plan generation...");

  const conditions = family.memberSummaries.flatMap(m => m.healthConditions);
  const uniqueConditions = [...new Set(conditions)];
  const dietaryTypes = family.memberSummaries.map(m => m.dietaryType);
  const uniqueRestrictions = [...new Set(dietaryTypes)];

  const memberAges = family.memberSummaries.map(m => m.age);
  const hasChildren = memberAges.some(a => a < 18);
  const hasElderly = memberAges.some(a => a >= 60);

  const icmrQuery = [
    "ICMR NIN 2024 dietary guidelines recommended daily allowance India",
    uniqueConditions.length > 0 ? `nutrition for ${uniqueConditions.join(", ")}` : "",
    hasChildren ? "child nutrition requirements India" : "",
    hasElderly ? "elderly nutrition calcium vitamin D India" : "",
  ].filter(Boolean).join(". ");

  const mealPatternQuery = [
    `Indian ${family.zone} zone meal pattern`,
    `${family.diet ?? "vegetarian"} balanced diet schedule`,
    family.isFasting ? "fasting meal pattern sabudana kuttu singhara" : "",
    uniqueConditions.includes("diabetes") ? "low GI meal pattern diabetic" : "",
  ].filter(Boolean).join(". ");

  const rdaQuery = [
    "RDA recommended dietary allowance protein calories iron calcium",
    uniqueConditions.length > 0 ? `nutrient targets for ${uniqueConditions.join(", ")}` : "",
    hasChildren ? "pediatric RDA calorie protein" : "",
  ].filter(Boolean).join(". ");

  const recipeQuery = [
    `${family.zone} Indian ${family.diet ?? "vegetarian"} recipes`,
    family.cuisinePreferences?.join(" ") ?? "",
    uniqueConditions.length > 0 ? `suitable for ${uniqueConditions.join(" ")}` : "",
    family.budget ? `budget friendly under ${family.budget} rupees` : "",
  ].filter(Boolean).join(" ");

  const emptyChunks: ChunkResult[] = [];
  const emptyRecipes: RecipeResult[] = [];

  const [icmrChunks, mealPatternChunks, rdaChunks, recipes] = await Promise.all([
    withTimeout(findSimilarChunks(icmrQuery, "knowledge_chunks", 4), RAG_TIMEOUT_MS, emptyChunks).catch((err) => {
      logger.warn({ err }, "RAG: ICMR guideline retrieval failed (non-fatal)");
      return emptyChunks;
    }),
    withTimeout(findSimilarChunks(mealPatternQuery, "knowledge_chunks", 3), RAG_TIMEOUT_MS, emptyChunks).catch((err) => {
      logger.warn({ err }, "RAG: meal pattern retrieval failed (non-fatal)");
      return emptyChunks;
    }),
    withTimeout(findSimilarChunks(rdaQuery, "knowledge_chunks", 3), RAG_TIMEOUT_MS, emptyChunks).catch((err) => {
      logger.warn({ err }, "RAG: RDA/nutrition rules retrieval failed (non-fatal)");
      return emptyChunks;
    }),
    withTimeout(findSimilarChunks(recipeQuery, "recipes", 10, {
      zone: family.zone,
      diet: family.diet,
    }), RAG_TIMEOUT_MS, emptyRecipes).catch((err) => {
      logger.warn({ err }, "RAG: recipe similarity search failed (non-fatal)");
      return emptyRecipes;
    }),
  ]);

  const relevantIcmr = icmrChunks.filter(c => c.similarity > 0.3);
  const relevantPatterns = mealPatternChunks.filter(c => c.similarity > 0.3);
  const relevantRda = rdaChunks.filter(c => c.similarity > 0.3);
  const relevantRecipes = recipes.filter(r => r.similarity > 0.25);

  const allChunks = [...relevantIcmr, ...relevantPatterns, ...relevantRda];
  const uniqueChunks = deduplicateChunks(allChunks);

  const sources = [...new Set(uniqueChunks.map(c => c.source))];

  logger.info({
    icmrChunks: relevantIcmr.length,
    mealPatternChunks: relevantPatterns.length,
    rdaChunks: relevantRda.length,
    totalUniqueChunks: uniqueChunks.length,
    recipesRetrieved: relevantRecipes.length,
    sources,
  }, "RAG retrieval complete");

  const icmrGuidelines = relevantIcmr.length > 0
    ? formatChunksSection("ICMR-NIN 2024 GUIDELINES", relevantIcmr)
    : "";

  const mealPatterns = relevantPatterns.length > 0
    ? formatChunksSection("CLINICAL MEAL PATTERNS", relevantPatterns)
    : "";

  const nutritionRules = relevantRda.length > 0
    ? formatChunksSection("RDA / NUTRITION RULES", relevantRda)
    : "";

  const recipeContext = relevantRecipes.length > 0
    ? formatRecipesForPrompt(relevantRecipes)
    : "";

  const contextSummary = [
    uniqueChunks.length > 0 ? `Retrieved ${uniqueChunks.length} knowledge chunks from ${sources.length} source(s)` : "",
    relevantRecipes.length > 0 ? `Found ${relevantRecipes.length} similar recipes` : "",
    uniqueConditions.length > 0 ? `Health conditions addressed: ${uniqueConditions.join(", ")}` : "",
  ].filter(Boolean).join(". ");

  return {
    icmrGuidelines,
    mealPatterns,
    nutritionRules,
    relevantRecipes: recipeContext,
    contextSummary,
    sources,
    chunkCount: uniqueChunks.length,
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
    withTimeout(findSimilarChunks(userMessage, "knowledge_chunks", 4), RAG_TIMEOUT_MS, [] as ChunkResult[]).catch(() => [] as ChunkResult[]),
    withTimeout(findSimilarChunks(userMessage, "recipes", 8, zone ? { zone } : undefined), RAG_TIMEOUT_MS, [] as RecipeResult[]).catch(() => [] as RecipeResult[]),
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

function deduplicateChunks(chunks: ChunkResult[]): ChunkResult[] {
  const seen = new Set<number>();
  return chunks.filter(c => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

function formatChunksSection(title: string, chunks: ChunkResult[]): string {
  const lines = chunks.map(c =>
    `[${c.source}] (relevance: ${Math.round(c.similarity * 100)}%): ${c.content.slice(0, 500)}`
  );
  return `
══════════════════════════════════════════════════════════════════
RAG — ${title}
══════════════════════════════════════════════════════════════════
${lines.join("\n\n")}`;
}

export function formatRecipesForPrompt(recipes: RecipeResult[]): string {
  const recipeLines = recipes.map(r =>
    `• ${r.name} (${r.diet}, ${r.cuisine}) — similarity: ${Math.round(r.similarity * 100)}%`
  );
  return `
RAG RECIPE SUGGESTIONS (vector-similar to family profile):
${recipeLines.join("\n")}
PREFER these recipes when they match the family's dietary needs.`;
}
