import { describe, it, expect } from "vitest";
import { runConflictEngine } from "../../src/engine/conflict-engine";
import { calculateBudgetSplit } from "../../src/engine/budget-engine";
import {
  BOKARO_FAMILY,
  MEMBER_PAPA_DIABETIC,
  MEMBER_MAMA_ANAEMIC,
  MEMBER_DADI_JAIN_SENIOR,
  MEMBER_CHILD_SCHOOL,
  WEEKLY_CTX_NORMAL,
  BUDGET_10000_BOKARO,
  MWC_PAPA_WITH_METFORMIN,
  MWC_MAMA_WITH_IRON,
  MWC_DADI_FASTING,
  MWC_CHILD_NO_CHANGES,
} from "../fixtures/familyFixtures";

describe("Full Pipeline Integration (without AI)", () => {

  it("should complete constraint packet assembly without throwing", () => {
    expect(() => {
      runConflictEngine({
        family: BOKARO_FAMILY,
        members: [MEMBER_PAPA_DIABETIC, MEMBER_MAMA_ANAEMIC, MEMBER_DADI_JAIN_SENIOR, MEMBER_CHILD_SCHOOL],
        memberWeeklyContexts: [MWC_PAPA_WITH_METFORMIN, MWC_MAMA_WITH_IRON, MWC_DADI_FASTING, MWC_CHILD_NO_CHANGES],
        weeklyContext: WEEKLY_CTX_NORMAL,
        budget: BUDGET_10000_BOKARO,
      });
    }).not.toThrow();
  });

  it("budget split + conflict engine → effective daily budget equals budget.dailyPerishableLimit when no override", () => {
    const packet = runConflictEngine({
      family: BOKARO_FAMILY,
      members: [MEMBER_PAPA_DIABETIC, MEMBER_MAMA_ANAEMIC],
      memberWeeklyContexts: [MWC_PAPA_WITH_METFORMIN, MWC_MAMA_WITH_IRON],
      weeklyContext: WEEKLY_CTX_NORMAL,
      budget: BUDGET_10000_BOKARO,
    });

    expect(packet.effectiveDailyBudget).toBe(BUDGET_10000_BOKARO.dailyPerishableLimit);
  });

  it("ConstraintPacket should have all required top-level keys", () => {
    const packet = runConflictEngine({
      family: BOKARO_FAMILY,
      members: [MEMBER_PAPA_DIABETIC],
      memberWeeklyContexts: [MWC_PAPA_WITH_METFORMIN],
      weeklyContext: WEEKLY_CTX_NORMAL,
      budget: BUDGET_10000_BOKARO,
    });

    expect(packet).toHaveProperty("family");
    expect(packet).toHaveProperty("effectiveProfiles");
    expect(packet).toHaveProperty("budget");
    expect(packet).toHaveProperty("weeklyContext");
    expect(packet).toHaveProperty("harmonyScore");
    expect(packet).toHaveProperty("conflicts");
    expect(packet).toHaveProperty("resolutions");
    expect(packet).toHaveProperty("pantryZeroWasteItems");
    expect(packet).toHaveProperty("medicationGuardrailBundles");
    expect(packet).toHaveProperty("medicationWeeklyMonitorDirectives");
    expect(packet).toHaveProperty("effectiveDailyBudget");
  });

  it("medication guardrail bundles should all have non-empty directives", () => {
    const packet = runConflictEngine({
      family: BOKARO_FAMILY,
      members: [MEMBER_PAPA_DIABETIC, MEMBER_MAMA_ANAEMIC],
      memberWeeklyContexts: [MWC_PAPA_WITH_METFORMIN, MWC_MAMA_WITH_IRON],
      weeklyContext: WEEKLY_CTX_NORMAL,
      budget: BUDGET_10000_BOKARO,
    });

    for (const bundle of packet.medicationGuardrailBundles) {
      expect(bundle.directives.length).toBeGreaterThan(0);
      expect(bundle.member_name).toBeTruthy();
      expect(bundle.drug_id).toBeTruthy();
    }
  });

  it("nonvegDaysByMember should be empty object for strictly veg family", () => {
    const packet = runConflictEngine({
      family: BOKARO_FAMILY,
      members: [MEMBER_PAPA_DIABETIC, MEMBER_MAMA_ANAEMIC, MEMBER_DADI_JAIN_SENIOR, MEMBER_CHILD_SCHOOL],
      memberWeeklyContexts: [MWC_PAPA_WITH_METFORMIN, MWC_MAMA_WITH_IRON, MWC_DADI_FASTING, MWC_CHILD_NO_CHANGES],
      weeklyContext: WEEKLY_CTX_NORMAL,
      budget: BUDGET_10000_BOKARO,
    });
    expect(Object.keys(packet.nonvegDaysByMember)).toHaveLength(0);
  });

  it("pipeline with single-member family should not throw", () => {
    expect(() => {
      runConflictEngine({
        family: BOKARO_FAMILY,
        members: [MEMBER_PAPA_DIABETIC],
        memberWeeklyContexts: [MWC_PAPA_WITH_METFORMIN],
        weeklyContext: WEEKLY_CTX_NORMAL,
        budget: BUDGET_10000_BOKARO,
      });
    }).not.toThrow();
  });

  it("pipeline with empty member weekly contexts array should not throw", () => {
    expect(() => {
      runConflictEngine({
        family: BOKARO_FAMILY,
        members: [MEMBER_PAPA_DIABETIC, MEMBER_MAMA_ANAEMIC],
        memberWeeklyContexts: [],
        weeklyContext: WEEKLY_CTX_NORMAL,
        budget: BUDGET_10000_BOKARO,
      });
    }).not.toThrow();
  });
});
