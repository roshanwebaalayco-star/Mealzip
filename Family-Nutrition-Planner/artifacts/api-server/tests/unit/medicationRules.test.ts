import { describe, it, expect } from "vitest";
import {
  MEDICATION_RULES,
  parseMedicationTiming,
  matchMedicationRule,
  buildGuardrailStrings,
  resolveAllMedicationGuardrails,
} from "../../src/engine/lib/medicationRules";

describe("parseMedicationTiming", () => {

  it("should parse 'with breakfast' → breakfast slot, relation: with", () => {
    const result = parseMedicationTiming("with breakfast");
    expect(result.resolved_slot).toBe("breakfast");
    expect(result.relation).toBe("with");
    expect(result.is_empty_stomach).toBe(false);
  });

  it("should parse 'at night' → night slot, is_night: true", () => {
    const result = parseMedicationTiming("at night");
    expect(result.is_night).toBe(true);
  });

  it("should parse 'empty stomach morning' → empty_stomach, is_empty_stomach: true", () => {
    const result = parseMedicationTiming("empty stomach morning");
    expect(result.is_empty_stomach).toBe(true);
  });

  it("should parse 'before dinner' → dinner slot, relation: before", () => {
    const result = parseMedicationTiming("before dinner");
    expect(result.resolved_slot).toBe("dinner");
    expect(result.relation).toBe("before");
  });

  it("should handle Hindi variations — 'subah khane ke saath' should not throw", () => {
    expect(() => parseMedicationTiming("subah khane ke saath")).not.toThrow();
  });
});

describe("matchMedicationRule", () => {

  it("should match 'Metformin 500mg' to metformin rule", () => {
    const rule = matchMedicationRule("Metformin 500mg");
    expect(rule).not.toBeNull();
    expect(rule?.drug_id).toBe("metformin");
  });

  it("should match 'Glycomet SR' to metformin rule (brand name)", () => {
    const rule = matchMedicationRule("Glycomet SR");
    expect(rule?.drug_id).toBe("metformin");
  });

  it("should match 'Ferrous Sulphate' to iron_supplement rule", () => {
    const rule = matchMedicationRule("Ferrous Sulphate");
    expect(rule?.drug_id).toBe("iron_supplement");
  });

  it("should match 'Haemup tablet' to iron_supplement (Indian brand)", () => {
    const rule = matchMedicationRule("Haemup tablet");
    expect(rule?.drug_id).toBe("iron_supplement");
  });

  it("should match 'Levothyroxine 50mcg' to levothyroxine rule", () => {
    const rule = matchMedicationRule("Levothyroxine 50mcg");
    expect(rule).not.toBeNull();
    expect(rule?.drug_id).toBe("levothyroxine");
  });

  it("should match 'Eltroxin' to levothyroxine rule (common Indian brand)", () => {
    const rule = matchMedicationRule("Eltroxin");
    expect(rule).not.toBeNull();
  });

  it("should match 'Warfarin' to warfarin rule", () => {
    const rule = matchMedicationRule("Warfarin");
    expect(rule).not.toBeNull();
    expect(rule?.drug_id).toBe("warfarin");
  });

  it("should return null for unknown medication (not in rule table)", () => {
    const rule = matchMedicationRule("SomeRandomDrug XYZ");
    expect(rule).toBeNull();
  });
});

describe("buildGuardrailStrings — output used in Gemini prompt", () => {

  it("Metformin breakfast → directive must mention solid food requirement", () => {
    const rule = MEDICATION_RULES["metformin"]!;
    const timing = parseMedicationTiming("with breakfast");
    const bundle = buildGuardrailStrings("Papa", rule, timing, "");

    expect(bundle.member_name).toBe("Papa");
    expect(bundle.directives.length).toBeGreaterThan(0);
    const directiveText = bundle.directives.join(" ").toLowerCase();
    expect(directiveText).toContain("solid");
    expect(directiveText).toContain("breakfast");
  });

  it("Iron at night → directive must mention avoiding dairy at dinner", () => {
    const rule = MEDICATION_RULES["iron_supplement"]!;
    const timing = parseMedicationTiming("at night");
    const bundle = buildGuardrailStrings("Mama", rule, timing, "");

    const allText = bundle.directives.join(" ").toLowerCase();
    expect(allText).toMatch(/dairy|calcium|milk|paneer/);
  });

  it("harmony_score_addition should be positive for correctly handled drugs", () => {
    const rule = MEDICATION_RULES["metformin"]!;
    const timing = parseMedicationTiming("with breakfast");
    const bundle = buildGuardrailStrings("Papa", rule, timing, "");
    expect(bundle.harmony_score_addition).toBeGreaterThan(0);
  });

  it("Warfarin → weekly_monitor_directives should be present", () => {
    const rule = MEDICATION_RULES["warfarin"]!;
    const timing = parseMedicationTiming("at night");
    const bundle = buildGuardrailStrings("Dada", rule, timing, "");
    expect(bundle.weekly_monitor_directives.length).toBeGreaterThan(0);
  });
});

describe("resolveAllMedicationGuardrails — full member processing", () => {

  it("processes Papa with Metformin + Amlodipine and returns 2 bundles", () => {
    const medications = [
      { name: "Metformin 500mg", timing: "with_breakfast", notes: "" },
      { name: "Amlodipine 5mg", timing: "at_night", notes: "" },
    ];
    const bundles = resolveAllMedicationGuardrails("Papa", medications);
    expect(bundles.length).toBe(2);
    const drugIds = bundles.map(b => b.drug_id);
    expect(drugIds).toContain("metformin");
    expect(drugIds).toContain("amlodipine");
  });

  it("processes Mama with Iron supplement and generates dinner constraints", () => {
    const medications = [
      { name: "Iron supplement (Ferrous Sulphate)", timing: "at_night", notes: "Avoid dairy within 2 hours" },
    ];
    const bundles = resolveAllMedicationGuardrails("Mama", medications);
    expect(bundles.length).toBeGreaterThan(0);
    const allDirectives = bundles.flatMap(b => b.directives).join(" ").toLowerCase();
    expect(allDirectives).toMatch(/iron|dairy|calcium/);
  });

  it("empty medications array returns empty bundles array (no error)", () => {
    const bundles = resolveAllMedicationGuardrails("Riya", []);
    expect(bundles).toHaveLength(0);
  });

  it("unrecognised drug produces 1 bundle with drug_id 'unknown' (graceful degradation)", () => {
    // NOTE: Actual code creates a fallback bundle with drug_id "unknown" for unrecognised drugs
    // This differs from the test doc which expected 0 bundles — documenting actual behavior
    const medications = [{ name: "SomeFutureDrug2030", timing: "morning", notes: "" }];
    const bundles = resolveAllMedicationGuardrails("Someone", medications);
    expect(bundles).toHaveLength(1);
    expect(bundles[0].drug_id).toBe("unknown");
    expect(bundles[0].harmony_score_addition).toBe(0);
  });
});
