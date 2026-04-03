import { describe, it, expect } from "vitest";
import { runConflictEngine } from "../../src/engine/conflict-engine";
import {
  BOKARO_FAMILY,
  MEMBER_PAPA_DIABETIC,
  MEMBER_MAMA_ANAEMIC,
  MEMBER_DADI_JAIN_SENIOR,
  MEMBER_CHILD_SCHOOL,
  MEMBER_TODDLER,
  MEMBER_NONVEG_ADULT,
  WEEKLY_CTX_NORMAL,
  BUDGET_10000_BOKARO,
  MWC_PAPA_WITH_METFORMIN,
  MWC_MAMA_WITH_IRON,
  MWC_DADI_FASTING,
  MWC_CHILD_NO_CHANGES,
} from "../fixtures/familyFixtures";

function buildFullPacket() {
  return runConflictEngine({
    family: BOKARO_FAMILY,
    members: [MEMBER_PAPA_DIABETIC, MEMBER_MAMA_ANAEMIC, MEMBER_DADI_JAIN_SENIOR, MEMBER_CHILD_SCHOOL],
    memberWeeklyContexts: [MWC_PAPA_WITH_METFORMIN, MWC_MAMA_WITH_IRON, MWC_DADI_FASTING, MWC_CHILD_NO_CHANGES],
    weeklyContext: WEEKLY_CTX_NORMAL,
    budget: BUDGET_10000_BOKARO,
  });
}

describe("Conflict Engine — Effective Profile Building", () => {

  it("should return an effective profile for each member", () => {
    const packet = buildFullPacket();
    expect(packet.effectiveProfiles).toHaveLength(4);
  });

  it("Papa's weekly weight update (81kg) should override profile weight (82kg)", () => {
    const packet = buildFullPacket();
    const papa = packet.effectiveProfiles.find(p => p.name === "Papa");
    expect(papa?.effectiveWeightKg).toBe(81);
  });

  it("Mama's fasting days (Monday from weekly + profile) should be merged", () => {
    const packet = buildFullPacket();
    const mama = packet.effectiveProfiles.find(p => p.name === "Mama");
    expect(mama?.effectiveFastingDays).toContain("monday");
  });

  it("Dadi's fasting days should include Thursday (from weekly context)", () => {
    const packet = buildFullPacket();
    const dadi = packet.effectiveProfiles.find(p => p.name === "Dadi");
    expect(dadi?.effectiveFastingDays).toContain("thursday");
  });

  it("Mama's ekadashi_this_week flag should be true", () => {
    const packet = buildFullPacket();
    const mama = packet.effectiveProfiles.find(p => p.name === "Mama");
    expect(mama?.ekadashiThisWeek).toBe(true);
  });

  it("Papa's active medications should include Metformin", () => {
    const packet = buildFullPacket();
    const papa = packet.effectiveProfiles.find(p => p.name === "Papa");
    const medNames = papa?.activeMedications.map(m => m.name.toLowerCase()) ?? [];
    expect(medNames.some(n => n.includes("metformin"))).toBe(true);
  });

  it("child Riya should have isSchoolAge flag set", () => {
    const packet = buildFullPacket();
    const riya = packet.effectiveProfiles.find(p => p.name === "Riya");
    expect(riya?.isSchoolAge).toBe(true);
  });

  it("Dadi (68) should have isSenior flag set", () => {
    const packet = buildFullPacket();
    const dadi = packet.effectiveProfiles.find(p => p.name === "Dadi");
    expect(dadi?.isSenior).toBe(true);
  });
});

describe("Conflict Engine — Level 1: Allergy Conflicts", () => {

  it("should detect Riya's peanut allergy as a Level 1 conflict", () => {
    const packet = buildFullPacket();
    const allergyConflicts = packet.conflicts.filter(c => c.priority_level === 1);
    const peanutConflict = allergyConflicts.find(c =>
      c.description.toLowerCase().includes("peanut") && c.member_names.includes("Riya")
    );
    expect(peanutConflict).toBeDefined();
    expect(peanutConflict!.member_ids).toContain("mem-004");
  });

  it("baby with dairy allergy in veg family should trigger a Level 1 conflict", () => {
    const packet = runConflictEngine({
      family: BOKARO_FAMILY,
      members: [MEMBER_MAMA_ANAEMIC, MEMBER_TODDLER],
      memberWeeklyContexts: [MWC_MAMA_WITH_IRON, {
        id: "mwc-t",
        weeklyContextId: "wc-001",
        familyMemberId: MEMBER_TODDLER.id,
        currentGoalOverride: null,
        currentWeightKg: null,
        feelingThisWeek: null,
        spiceToleranceOverride: null,
        tiffinNeededOverride: null,
        ekadashiThisWeek: false,
        festivalFastThisWeek: false,
        healthConditionsOverride: null,
        activeMedications: [],
        fastingDaysThisWeek: [],
        nonvegDaysThisWeek: [],
        nonvegTypesThisWeek: [],
      }],
      weeklyContext: WEEKLY_CTX_NORMAL,
      budget: BUDGET_10000_BOKARO,
    });
    const level1 = packet.conflicts.filter(c => c.priority_level === 1);
    expect(level1.length).toBeGreaterThan(0);
  });
});

describe("Conflict Engine — Level 2: Religious Conflicts", () => {

  it("Dadi's Jain rules should be reflected in her effective profile", () => {
    const packet = buildFullPacket();
    const dadi = packet.effectiveProfiles.find(p => p.name === "Dadi");
    expect(dadi?.religiousCulturalRules.type).toBe("jain_rules");
  });

  it("should detect Jain-NonVeg conflict when Jain member is in a household with non-veg members", () => {
    const packet = runConflictEngine({
      family: BOKARO_FAMILY,
      members: [MEMBER_DADI_JAIN_SENIOR, MEMBER_NONVEG_ADULT],
      memberWeeklyContexts: [MWC_DADI_FASTING, {
        id: "mwc-nv",
        weeklyContextId: "wc-001",
        familyMemberId: MEMBER_NONVEG_ADULT.id,
        currentGoalOverride: null,
        currentWeightKg: null,
        feelingThisWeek: null,
        spiceToleranceOverride: null,
        tiffinNeededOverride: null,
        ekadashiThisWeek: false,
        festivalFastThisWeek: false,
        healthConditionsOverride: null,
        activeMedications: [],
        fastingDaysThisWeek: [],
        nonvegDaysThisWeek: ["wednesday", "saturday"],
        nonvegTypesThisWeek: ["chicken", "fish"],
      }],
      weeklyContext: WEEKLY_CTX_NORMAL,
      budget: BUDGET_10000_BOKARO,
    });
    const religiousConflicts = packet.conflicts.filter(c => c.priority_level === 2);
    const jainConflict = religiousConflicts.find(c =>
      c.description.toLowerCase().includes("jain") && c.member_names.includes("Dadi")
    );
    expect(jainConflict).toBeDefined();
  });
});

describe("Conflict Engine — Level 4: Clinical Condition Conflicts", () => {

  it("Papa with diabetes should have diabetes rules in effectiveHealthConditions", () => {
    const packet = buildFullPacket();
    const papa = packet.effectiveProfiles.find(p => p.name === "Papa");
    expect(papa?.effectiveHealthConditions).toContain("diabetes_type_2");
    expect(papa?.effectiveHealthConditions).toContain("hypertension");
  });

  it("constraint packet should contain medication guardrail bundles for Papa", () => {
    const packet = buildFullPacket();
    expect(packet.medicationGuardrailBundles.length).toBeGreaterThan(0);
  });
});

describe("Conflict Engine — Pantry Zero Waste", () => {

  it("perishable pantry items should appear in pantryZeroWasteItems", () => {
    const packet = buildFullPacket();
    expect(packet.pantryZeroWasteItems.length).toBeGreaterThan(0);
    const names = packet.pantryZeroWasteItems.map(i => i.name);
    expect(names).toContain("spinach");
    expect(names).toContain("cabbage");
  });

  it("non-perishable pantry items should NOT appear in zero waste list", () => {
    const packet = buildFullPacket();
    const names = packet.pantryZeroWasteItems.map(i => i.name);
    expect(names).not.toContain("basmati rice");
  });
});

describe("Conflict Engine — Harmony Score", () => {

  it("harmony score should be between 0 and 100", () => {
    const packet = buildFullPacket();
    expect(packet.harmonyScore.final_score).toBeGreaterThanOrEqual(0);
    expect(packet.harmonyScore.final_score).toBeLessThanOrEqual(100);
  });

  it("harmony score base should always be 100", () => {
    const packet = buildFullPacket();
    expect(packet.harmonyScore.base).toBe(100);
  });

  it("each pantry item used should add to harmony score additions", () => {
    const packet = buildFullPacket();
    const pantryAdditions = packet.harmonyScore.additions.filter(a =>
      a.reason.toLowerCase().includes("pantry") || a.reason.toLowerCase().includes("zero-waste")
    );
    if (packet.pantryZeroWasteItems.length > 0) {
      const totalPantryPoints = pantryAdditions.reduce((s, a) => s + a.points, 0);
      expect(totalPantryPoints).toBeGreaterThan(0);
    }
  });

  it("plate modifications should exist in deductions", () => {
    const packet = buildFullPacket();
    expect(packet.harmonyScore.deductions).toBeDefined();
  });
});
