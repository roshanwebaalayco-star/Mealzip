export interface CreateFamilyBody {
  name: string;
  stateRegion: string;
  languagePreference?: string;
  householdDietaryBaseline?: string;
  mealsPerDay?: string;
  cookingSkillLevel?: string;
  appliances?: unknown;
  pincode?: string;
}
