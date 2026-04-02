import type { ParsedVoiceMember } from "./parsedVoiceMember";

export interface ParsedVoiceProfile {
  familyName?: string | null;
  stateRegion?: string | null;
  languagePreference?: string | null;
  householdDietaryBaseline?: string | null;
  members: ParsedVoiceMember[];
  confidence: number;
  unparsedInfo?: string | null;
}
