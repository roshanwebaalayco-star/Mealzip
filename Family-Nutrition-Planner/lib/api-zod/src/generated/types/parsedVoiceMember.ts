import type { ParsedVoiceMemberGender } from "./parsedVoiceMemberGender";

export interface ParsedVoiceMember {
  name?: string | null;
  age?: number | null;
  gender: ParsedVoiceMemberGender;
  healthConditions: string[];
  dietaryType?: string | null;
}
