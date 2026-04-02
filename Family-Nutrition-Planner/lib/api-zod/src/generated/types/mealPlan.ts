export interface MealPlan {
  id: number;
  familyId: number;
  weeklyContextId?: number | null;
  harmonyScore?: number | null;
  generationStatus: string;
  harmonyScoreBreakdown: unknown;
  generationLog: unknown;
  days: unknown;
  nutritionalSummary: unknown;
  createdAt: Date;
  updatedAt: Date;
}
