export interface CreateMemberBody {
  name: string;
  age: number;
  gender: string;
  heightCm?: number;
  weightKg?: number;
  activityLevel?: string;
  primaryGoal?: string;
  goalPace?: string;
  dailyCalorieTarget?: number;
  dietaryType?: string;
  spiceTolerance?: string;
  tiffinNeeded?: string;
  festivalFastingAlerts?: boolean;
  displayOrder?: number;
  healthConditions?: unknown;
  allergies?: unknown;
  ingredientDislikes?: unknown;
  religiousCulturalRules?: unknown;
  occasionalNonvegConfig?: unknown;
  fastingConfig?: unknown;
}
