export interface MemberContextOverride {
  memberId: number;
  feeling_this_week?: string;
  fasting_days?: string[];
  tiffin_override?: boolean;
  spice_override?: "mild" | "medium" | "spicy";
  weight_kg?: number;
  nonveg_days_override?: string[];
  nonveg_type_override?: string;
}

export interface WeeklyContext {
  budget_inr?: number;
  dining_out_freq?: number;
  weekday_prep_time?: "<20" | "20-40" | "nolimit";
  weekend_prep_time?: "quick" | "elaborate" | "nopref";
  special_request?: string;
  member_overrides?: Record<string, MemberContextOverride>;
  pantry_items?: string[];
}

export interface FamilyMember {
  id: number;
  name: string;
  age?: number;
  gender: string;
  healthConditions?: string[];
  dietaryType?: string;
  primaryGoal?: string;
  tiffinNeeded?: string;
  weightKg?: number | string;
  heightCm?: number | string;
  activityLevel: string;
  spiceTolerance?: string;
  occasionalNonvegConfig?: { days?: string[]; types?: string[] };
  fastingConfig?: { baselineDays?: string[]; ekadashi?: boolean };
  religiousCulturalRules?: { primary?: string };
  ingredientDislikes?: string[];
  allergies?: string[];
  dailyCalorieTarget?: number;
  festivalFastingAlerts?: boolean;
  goalPace?: string;
  displayOrder?: number;
}
