export interface FamilyMember {
  id: number;
  familyId: number;
  name: string;
  age: number;
  gender: string;
  heightCm?: string | null;
  weightKg?: string | null;
  activityLevel: string;
  primaryGoal: string;
  goalPace?: string | null;
  dailyCalorieTarget?: number | null;
  dietaryType: string;
  spiceTolerance: string;
  tiffinNeeded: string;
  festivalFastingAlerts: boolean;
  displayOrder: number;
  healthConditions: unknown;
  allergies: unknown;
  ingredientDislikes: unknown;
  religiousCulturalRules: unknown;
  occasionalNonvegConfig?: unknown | null;
  fastingConfig: unknown;
  createdAt: Date;
  updatedAt: Date;
}
