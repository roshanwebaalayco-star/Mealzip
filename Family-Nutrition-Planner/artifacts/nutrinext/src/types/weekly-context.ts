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
  role: string;
  age?: number;
  healthConditions?: string[];
  dietaryRestrictions?: string[];
  primaryGoal?: string;
  nonVegDays?: string[];
  nonVegTypes?: string[];
  tiffinType?: string;
  weightKg?: number;
}
