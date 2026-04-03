import { describe, it, expect } from "vitest";
import {
  getScoreTier,
  buildHarmonyScoreCard,
  formatHarmonyScorePlainText,
  HARMONY_SCORE_TIERS,
} from "../../src/engine/lib/harmonyScore";
import type { HarmonyScoreBreakdown } from "../../src/engine/types";

describe("getScoreTier", () => {

  it("100 → Excellent", () => expect(getScoreTier(100).label).toBe("Excellent"));
  it("90 → Excellent", () => expect(getScoreTier(90).label).toBe("Excellent"));
  it("89 → Good", () => expect(getScoreTier(89).label).toBe("Good"));
  it("75 → Good", () => expect(getScoreTier(75).label).toBe("Good"));
  it("74 → Moderate", () => expect(getScoreTier(74).label).toBe("Moderate"));
  it("60 → Moderate", () => expect(getScoreTier(60).label).toBe("Moderate"));
  // NOTE: Actual code has 4 tiers, not 5. Scores < 60 are "Challenging" (no "Critical" tier).
  it("59 → Challenging", () => expect(getScoreTier(59).label).toBe("Challenging"));
  it("40 → Challenging", () => expect(getScoreTier(40).label).toBe("Challenging"));
  it("39 → Challenging", () => expect(getScoreTier(39).label).toBe("Challenging"));
  it("0 → Challenging", () => expect(getScoreTier(0).label).toBe("Challenging"));
  it("negative should not throw", () => expect(() => getScoreTier(-5)).not.toThrow());

  it("every tier should have non-empty emoji", () => {
    HARMONY_SCORE_TIERS.forEach(tier => {
      expect(tier.emoji).toBeTruthy();
    });
  });

  it("every tier should have a non-empty color code", () => {
    HARMONY_SCORE_TIERS.forEach(tier => {
      expect(tier.color).toMatch(/^#/);
    });
  });
});

describe("buildHarmonyScoreCard", () => {

  const SAMPLE_BREAKDOWN: HarmonyScoreBreakdown = {
    base: 100,
    deductions: [
      { reason: "Papa's low-sodium requirement needs plate modification", points: -2 },
      { reason: "Dadi's Jain rules restricts base dish", points: -5 },
    ],
    additions: [
      { reason: "Spinach pantry item used (zero-waste)", points: 2 },
      { reason: "Metformin window correctly scheduled", points: 3 },
    ],
    conflicts_detected: [
      {
        member_ids: ["mem-001"],
        member_names: ["Papa"],
        description: "Papa has hypertension",
        priority_level: 4,
      },
    ],
    conflicts_resolved: [
      {
        description: "Papa's sodium restriction handled",
        resolution: "Low-sodium base dish with separate salt for others",
        resolution_type: "plate_modification",
      },
    ],
    final_score: 98,
  };

  it("should build a card with correct final_score", () => {
    const card = buildHarmonyScoreCard(SAMPLE_BREAKDOWN);
    expect(card.score).toBe(98);
  });

  it("should return label 'Excellent' for score 98", () => {
    const card = buildHarmonyScoreCard(SAMPLE_BREAKDOWN);
    expect(card.label).toBe("Excellent");
  });

  it("should produce exactly 1 conflict_card (matching conflicts_detected length)", () => {
    const card = buildHarmonyScoreCard(SAMPLE_BREAKDOWN);
    expect(card.conflict_cards).toHaveLength(1);
  });

  it("total_deducted should be −7 (−2 + −5)", () => {
    const card = buildHarmonyScoreCard(SAMPLE_BREAKDOWN);
    expect(card.total_deducted).toBe(-7);
  });

  it("total_added should be +5 (+2 + +3)", () => {
    const card = buildHarmonyScoreCard(SAMPLE_BREAKDOWN);
    expect(card.total_added).toBe(5);
  });

  it("score_summary_text should be a non-empty string", () => {
    const card = buildHarmonyScoreCard(SAMPLE_BREAKDOWN);
    expect(card.score_summary_text).toBeTruthy();
    expect(typeof card.score_summary_text).toBe("string");
  });
});
