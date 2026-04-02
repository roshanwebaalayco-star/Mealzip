export interface GroceryList {
  id: number;
  familyId: number;
  mealPlanId?: number | null;
  listType: string;
  monthYear?: string | null;
  weekStartDate?: string | null;
  totalEstimatedCost?: string | null;
  status: string;
  items: unknown;
  createdAt: Date;
  updatedAt: Date;
}
