import type { GroceryItem } from "./groceryItem";

export interface GroceryListData {
  items?: GroceryItem[];
  totalEstimatedCost?: number;
  savingsTips?: string[];
  seasonalSuggestions?: string[];
}
