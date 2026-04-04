import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { sql } from "drizzle-orm";
import { localDb as db } from "@workspace/db";
import { recipesTable } from "@workspace/db";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
// Try multiple possible CSV filenames
const CSV_CANDIDATES = [
  "COMBINED_RECIPES_1774509512493.csv",
  "COMBINED_RECIPES_1774599111721.csv",
  "COMBINED_RECIPES_1774609969536.csv",
];
const CSV_PATH = (() => {
  for (const name of CSV_CANDIDATES) {
    const p = path.join(WORKSPACE_ROOT, "attached_assets", name);
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`No recipe CSV found in ${path.join(WORKSPACE_ROOT, "attached_assets")}. Expected one of: ${CSV_CANDIDATES.join(", ")}`);
})();
const BATCH_SIZE = 500;

const CUISINE_MAP: Record<string, string> = {
  "North Indian": "North Indian",
  "South Indian": "South Indian",
  "Bengali": "Bengali",
  "Bihari": "Bihari",
  "Rajasthani": "Rajasthani",
  "Gujarati": "Gujarati",
  "Maharashtrian": "Maharashtrian",
  "Mughlai": "Mughlai",
  "Punjabi": "Punjabi",
  "Karnataka": "Karnataka",
  "Kerala": "Kerala",
  "Tamil": "Tamil Nadu",
  "Andhra Pradesh": "Andhra Pradesh",
  "Hyderabadi": "Hyderabadi",
  "Goan": "Goan",
  "Kashmiri": "Kashmiri",
  "Jharkhand": "Jharkhand",
  "Odisha": "Odisha",
  "Continental": "Continental",
  "Chinese": "Indo-Chinese",
  "Italian": "Italian",
};

const COURSE_CATEGORY_MAP: Record<string, string> = {
  "breakfast": "breakfast",
  "main course": "lunch",
  "lunch": "lunch",
  "dinner": "dinner",
  "snack": "snack",
  "dessert": "dessert",
  "side dish": "lunch",
  "appetizer": "snack",
  "soup": "lunch",
  "salad": "snack",
  "beverage": "snack",
};

function mapCategory(course: string): string {
  if (!course) return "lunch";
  const lower = course.toLowerCase();
  for (const [key, val] of Object.entries(COURSE_CATEGORY_MAP)) {
    if (lower.includes(key)) return val;
  }
  return "lunch";
}

function mapDiet(diet: string): string {
  if (!diet) return "vegetarian";
  const lower = diet.toLowerCase();
  if (lower.includes("non veg") || lower.includes("non-veg")) return "non-vegetarian";
  if (lower.includes("vegan")) return "vegan";
  return "vegetarian";
}

function estimateCostPerServing(cuisine: string, diet: string, servings: number): number {
  const base = diet === "non-vegetarian" ? 80 : 40;
  const cuisineMultiplier = cuisine === "Continental" || cuisine === "Italian" ? 1.5 : 1.0;
  const servingCount = servings || 4;
  return Math.round((base * cuisineMultiplier) / servingCount * servingCount);
}

function estimateNutrition(category: string, diet: string): { calories: number; protein: number; carbs: number; fat: number; fiber: number; iron: number; calcium: number; vitaminC: number } {
  const base = {
    breakfast: { calories: 320, protein: 10, carbs: 55, fat: 8, fiber: 6, iron: 2.5, calcium: 120, vitaminC: 8 },
    lunch: { calories: 450, protein: 15, carbs: 70, fat: 12, fiber: 8, iron: 3.5, calcium: 150, vitaminC: 15 },
    dinner: { calories: 400, protein: 14, carbs: 65, fat: 10, fiber: 7, iron: 3.0, calcium: 130, vitaminC: 10 },
    snack: { calories: 180, protein: 5, carbs: 30, fat: 5, fiber: 3, iron: 1.5, calcium: 80, vitaminC: 5 },
    dessert: { calories: 300, protein: 4, carbs: 55, fat: 10, fiber: 2, iron: 1.0, calcium: 100, vitaminC: 2 },
  };
  const nutritionBase = base[category as keyof typeof base] || base.lunch;
  const proteinMultiplier = diet === "non-vegetarian" ? 1.4 : 1.0;
  return {
    ...nutritionBase,
    protein: Math.round(nutritionBase.protein * proteinMultiplier),
  };
}

async function seed() {
  console.log("Reading CSV file...");
  const fileContent = fs.readFileSync(CSV_PATH, "utf-8");

  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Array<Record<string, string>>;

  console.log(`Total recipes in CSV: ${records.length}`);

  const forceReseed = process.argv.includes("--force");
  const existing = await db.select({ id: recipesTable.id }).from(recipesTable).limit(1);
  if (existing.length > 0) {
    if (!forceReseed) {
      console.log("Recipes already seeded, skipping... (use --force to reseed)");
      return;
    }
    console.log("--force flag set: truncating recipes table before re-seeding...");
    await db.execute(sql`TRUNCATE TABLE recipes CASCADE`);
    console.log("Truncated.");
  }

  let totalInserted = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    const rows = batch.map(r => {
      const cat = mapCategory(r.Course || "");
      const diet = mapDiet(r.Diet || "");
      const isNonIndianZone = r.Zone === "Non-Indian";
      const cuisine = CUISINE_MAP[r.Cuisine || ""] || (isNonIndianZone ? (r.Cuisine || "International") : "Indian");
      const servings = parseInt(r.Servings || "4") || 4;
      const nutrition = estimateNutrition(cat, diet);
      // Preserve TotalTimeInMins directly from CSV; derive prep/cook from that
      const totalTime = parseInt(r.TotalTimeInMins || "0") || 35;
      const prepTime = parseInt(r.PrepTimeInMins || "0") || Math.round(totalTime * 0.4);
      const cookTime = parseInt(r.CookTimeInMins || "0") || Math.round(totalTime * 0.6);
      // Preserve Is_Foreign from CSV explicitly (handles "True"/"False"/1/0/"Yes"/"No")
      const isForeignRaw = (r.Is_Foreign ?? r.is_foreign ?? r["Is_Foreign"] ?? "").toString().toLowerCase();
      const isForeignFromCsv = isForeignRaw === "true" || isForeignRaw === "1" || isForeignRaw === "yes";
      // Fall back to Zone inference only if CSV column is absent/empty
      const isForeignFinal = isForeignRaw ? isForeignFromCsv : (r.Zone === "Non-Indian");

      return {
        name: (r.RecipeName || "").slice(0, 255),
        cuisine,
        category: cat,
        course: r.Course || null,
        zone: r.Zone || "Indian",
        isForeign: isForeignFinal,
        diet,
        ingredients: r.Ingredients || "",
        instructions: (r.Instructions || "").slice(0, 5000),
        calories: nutrition.calories,
        protein: nutrition.protein,
        carbs: nutrition.carbs,
        fat: nutrition.fat,
        fiber: nutrition.fiber,
        iron: nutrition.iron,
        calcium: nutrition.calcium,
        vitaminC: nutrition.vitaminC,
        prepTimeMin: prepTime,
        cookTimeMin: cookTime,
        totalTimeMin: totalTime,
        servings,
        costPerServing: estimateCostPerServing(cuisine, diet, servings),
        tags: [r.Zone || "Indian", r.Cuisine || "Indian"].filter(Boolean),
      };
    });

    await db.insert(recipesTable).values(rows);
    totalInserted += rows.length;
    if (totalInserted % 5000 === 0 || totalInserted === records.length) {
      console.log(`Inserted ${totalInserted}/${records.length} recipes...`);
    }
  }

  console.log(`✅ Seeded ${totalInserted} recipes successfully!`);

  // Post-seed validation: verify required fields are populated correctly
  console.log("\nRunning post-seed validation...");
  const validationRows = await db.execute(sql`
    SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE total_time_min IS NOT NULL AND total_time_min != 35)::int as has_real_total_time,
      COUNT(*) FILTER (WHERE total_time_min = 35)::int as defaulted_total_time,
      COUNT(*) FILTER (WHERE is_foreign = true)::int as foreign_count,
      COUNT(*) FILTER (WHERE is_foreign = false)::int as indian_count,
      MIN(total_time_min)::int as min_time,
      MAX(total_time_min)::int as max_time,
      ROUND(AVG(total_time_min))::int as avg_time
    FROM recipes
  `);
  const counts = validationRows.rows[0] as Record<string, number>;
  console.log("Validation results:");
  console.log(`  Total rows:          ${counts.total}`);
  console.log(`  Real totalTimeMin:   ${counts.has_real_total_time} (non-default 35)`);
  console.log(`  Defaulted (35min):   ${counts.defaulted_total_time}`);
  console.log(`  Foreign recipes:     ${counts.foreign_count}`);
  console.log(`  Indian recipes:      ${counts.indian_count}`);
  console.log(`  Time range:          ${counts.min_time}–${counts.max_time} min (avg: ${counts.avg_time})`);

  // Sample 3 recipes for manual inspection
  const samples = await db.select({
    name: recipesTable.name, totalTimeMin: recipesTable.totalTimeMin,
    isForeign: recipesTable.isForeign, zone: recipesTable.zone,
  }).from(recipesTable).limit(3);
  console.log("\nSample recipes (first 3):");
  samples.forEach((s, i) => console.log(`  ${i + 1}. "${s.name}" — totalTimeMin=${s.totalTimeMin}, isForeign=${s.isForeign}, zone=${s.zone}`));
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
