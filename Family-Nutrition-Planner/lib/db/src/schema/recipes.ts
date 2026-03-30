import { pgTable, serial, text, real, integer, boolean, timestamp, index, customType } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

const vector768 = customType<{ data: string }>({
  dataType() {
    return "vector(768)";
  },
});

export const recipesTable = pgTable("recipes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameHindi: text("name_hindi"),
  cuisine: text("cuisine").notNull().default("Indian"),
  category: text("category").notNull().default("lunch"),
  course: text("course"),
  diet: text("diet").notNull().default("vegetarian"),
  zone: text("zone"),
  isForeign: boolean("is_foreign").notNull().default(false),
  ingredients: text("ingredients"),
  instructions: text("instructions"),
  calories: real("calories").default(0),
  protein: real("protein").default(0),
  carbs: real("carbs").default(0),
  fat: real("fat").default(0),
  fiber: real("fiber").default(0),
  iron: real("iron").default(0),
  calcium: real("calcium").default(0),
  vitaminC: real("vitamin_c").default(0),
  prepTimeMin: integer("prep_time_min").default(15),
  cookTimeMin: integer("cook_time_min").default(20),
  totalTimeMin: integer("total_time_min").default(35),
  servings: integer("servings").default(4),
  costPerServing: real("cost_per_serving").default(50),
  tags: text("tags").array(),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  searchVector: tsvector("search_vector"),
  embedding: vector768("embedding"),
}, (table) => [
  index("recipes_cuisine_idx").on(table.cuisine),
  index("recipes_category_idx").on(table.category),
  index("recipes_diet_idx").on(table.diet),
  index("recipes_name_idx").on(table.name),
  index("recipes_zone_idx").on(table.zone),
  index("recipes_search_idx").using("gin", sql`to_tsvector('simple', coalesce(${table.name}, '') || ' ' || coalesce(${table.nameHindi}, '') || ' ' || coalesce(${table.ingredients}, ''))`),
  index("recipes_embedding_idx").using("hnsw", sql`${table.embedding} vector_cosine_ops`),
]);

export const insertRecipeSchema = createInsertSchema(recipesTable).omit({ id: true, createdAt: true, searchVector: true, embedding: true });
export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type Recipe = typeof recipesTable.$inferSelect;
