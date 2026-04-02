export interface Family {
  id: number;
  name: string;
  stateRegion: string;
  languagePreference: string;
  householdDietaryBaseline: string;
  mealsPerDay: string;
  cookingSkillLevel: string;
  appliances: unknown;
  pincode?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
