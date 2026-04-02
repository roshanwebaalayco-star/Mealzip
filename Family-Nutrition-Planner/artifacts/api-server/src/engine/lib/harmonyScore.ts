import type {
  HarmonyScoreBreakdown,
  HarmonyScoreDeduction,
  HarmonyScoreAddition,
  ConflictPriorityLevel,
  ConstraintPacket,
  PromptChainResult,
  PromptChainTimings,
  DetectedConflict,
  ResolvedConflict,
} from "../types";

export const PRIORITY_LABELS: Record<ConflictPriorityLevel, string> = {
  1: "Allergy (Critical)",
  2: "Religious / Dietary Rule (Critical)",
  3: "Medication Interaction Window",
  4: "Clinical Condition",
  5: "Personal Goal",
  6: "Preference",
};

const PRIORITY_COLORS: Record<ConflictPriorityLevel, string> = {
  1: "#dc2626",
  2: "#dc2626",
  3: "#ea580c",
  4: "#d97706",
  5: "#65a30d",
  6: "#0284c7",
};

export interface ConflictSummaryForUI {
  total_detected: number;
  total_resolved: number;
  harmony_score: number;
  harmony_score_label: string;
  score_breakdown_text: string;
  conflict_cards: {
    priority_level: ConflictPriorityLevel;
    priority_label: string;
    description: string;
    resolution: string;
    resolution_type: string;
  }[];
}

export interface HarmonyScoreCard {
  score: number;
  label: string;
  emoji: string;
  color: string;
  tier_description: string;
  score_summary_text: string;
  deductions: HarmonyScoreDeduction[];
  additions: HarmonyScoreAddition[];
  total_deducted: number;
  total_added: number;
  conflict_cards: {
    priority_level: ConflictPriorityLevel;
    priority_label: string;
    priority_color: string;
    description: string;
    resolution: string;
    resolution_type: string;
    member_names: string[];
  }[];
  medication_bonus_pts: number;
  medication_bonus_text: string;
  zero_waste_bonus_pts: number;
  zero_waste_bonus_text: string;
}

export interface MealPlanFinalResult {
  harmonyScore: {
    score: number;
    label: string;
    emoji: string;
    color: string;
    breakdown: HarmonyScoreBreakdown;
  };
  constraints: {
    total_conflicts_detected: number;
    total_conflicts_resolved: number;
    medication_guardrails_applied: number;
    fasting_members: number;
    pantry_zero_waste_items: number;
  };
  mealPlan: {
    days: any[];
    nutritional_summary: any;
    staples: any[];
    weekly_perishables: any[];
    buffer_items: any[];
    budget_summary: {
      staples_total: number;
      weekly_perishables_total: number;
      buffer_total: number;
      grand_total: number;
    };
  };
  timings: PromptChainTimings;
}

function getScoreTier(score: number): {
  label: string;
  emoji: string;
  color: string;
  tier_description: string;
} {
  if (score >= 90) {
    return {
      label: "Excellent",
      emoji: "\u{1F7E2}",
      color: "#16a34a",
      tier_description:
        "Minimal dietary conflicts. All family members' needs are well-aligned with shared cooking.",
    };
  }
  if (score >= 75) {
    return {
      label: "Good",
      emoji: "\u{1F7E1}",
      color: "#65a30d",
      tier_description:
        "Some conflicts detected and resolved. Plate-level modifications keep everyone on track.",
    };
  }
  if (score >= 60) {
    return {
      label: "Moderate",
      emoji: "\u{1F7E0}",
      color: "#d97706",
      tier_description:
        "Multiple dietary conflicts. The plan uses creative base-dish strategies and separate sides to accommodate everyone.",
    };
  }
  return {
    label: "Challenging",
    emoji: "\u{1F534}",
    color: "#dc2626",
    tier_description:
      "Significant dietary diversity in the household. Base dishes are heavily constrained; many plate-level modifications required.",
  };
}

export function buildHarmonyScoreCard(
  rawBreakdown: HarmonyScoreBreakdown
): HarmonyScoreCard {
  const score = rawBreakdown.final_score ?? 0;
  const tier = getScoreTier(score);

  const deductions = rawBreakdown.deductions ?? [];
  const additions = rawBreakdown.additions ?? [];
  const conflictsDetected = rawBreakdown.conflicts_detected ?? [];
  const conflictsResolved = rawBreakdown.conflicts_resolved ?? [];

  const totalDeducted = deductions.reduce((s, d) => s + d.points, 0);
  const totalAdded = additions.reduce((s, a) => s + a.points, 0);

  const medAdditions = additions.filter((a) =>
    a.reason.toLowerCase().includes("medication")
  );
  const medBonusPts = medAdditions.reduce((s, a) => s + a.points, 0);
  const medBonusText =
    medAdditions.length > 0
      ? medAdditions.map((a) => a.reason).join("; ")
      : "No active medication guardrails this week.";

  const zeroWasteAdditions = additions.filter(
    (a) =>
      a.reason.toLowerCase().includes("pantry") ||
      a.reason.toLowerCase().includes("zero-waste")
  );
  const zeroWastePts = zeroWasteAdditions.reduce((s, a) => s + a.points, 0);
  const zeroWasteText =
    zeroWasteAdditions.length > 0
      ? zeroWasteAdditions.map((a) => a.reason).join("; ")
      : "No perishable pantry items queued this week.";

  const conflictCards = conflictsDetected.map(
    (conflict, i) => {
      const resolution = conflictsResolved[i];
      const level = conflict.priority_level as ConflictPriorityLevel;
      return {
        priority_level: level,
        priority_label: PRIORITY_LABELS[level] ?? "Unknown",
        priority_color: PRIORITY_COLORS[level] ?? "#6b7280",
        description: conflict.description,
        resolution: resolution?.resolution ?? "Resolved by constraint engine.",
        resolution_type: resolution?.resolution_type ?? "plate_modification",
        member_names: conflict.member_names ?? [],
      };
    }
  );

  const deductionSummary = deductions
    .map((d) => `${d.points} pts: ${d.reason}`)
    .join("; ");
  const additionSummary = additions
    .filter((a) => a.points > 0)
    .map((a) => `+${a.points} pts: ${a.reason}`)
    .join("; ");

  return {
    score,
    label: tier.label,
    emoji: tier.emoji,
    color: tier.color,
    tier_description: tier.tier_description,
    score_summary_text:
      `${score}/100 (${tier.label}) — ` +
      `${deductions.length} deduction(s): ${deductionSummary || "none"}. ` +
      `${additions.filter((a) => a.points > 0).length} bonus(es): ${additionSummary || "none"}.`,
    deductions,
    additions,
    total_deducted: totalDeducted,
    total_added: totalAdded,
    conflict_cards: conflictCards,
    medication_bonus_pts: medBonusPts,
    medication_bonus_text: medBonusText,
    zero_waste_bonus_pts: zeroWastePts,
    zero_waste_bonus_text: zeroWasteText,
  };
}

export function formatHarmonyScorePlainText(
  rawBreakdown: HarmonyScoreBreakdown
): string {
  const card = buildHarmonyScoreCard(rawBreakdown);
  const lines: string[] = [
    `${card.emoji} Family Harmony Score: ${card.score}/100 (${card.label})`,
    card.tier_description,
    "",
  ];

  if (card.deductions.length > 0) {
    lines.push("Deductions:");
    for (const d of card.deductions) {
      lines.push(`  ${d.points} pts — ${d.reason}`);
    }
  }

  if (card.additions.length > 0) {
    lines.push("Bonuses:");
    for (const a of card.additions) {
      lines.push(`  +${a.points} pts — ${a.reason}`);
    }
  }

  if (card.conflict_cards.length > 0) {
    lines.push("");
    lines.push(`Conflicts Detected: ${card.conflict_cards.length}`);
    for (const c of card.conflict_cards) {
      lines.push(`  [${c.priority_label}] ${c.description}`);
      lines.push(`    Resolution: ${c.resolution}`);
    }
  }

  return lines.join("\n");
}

export function assembleFinalResult(
  constraintPacket: ConstraintPacket,
  promptResult: PromptChainResult,
  timings: PromptChainTimings
): MealPlanFinalResult {
  const { harmonyScore, conflicts, resolutions, medicationGuardrailBundles, pantryZeroWasteItems, effectiveProfiles } =
    constraintPacket;
  const score = harmonyScore.final_score;
  const tier = getScoreTier(score);

  const fastingMembers = effectiveProfiles.filter(
    (p) => p.effectiveFastingDays.length > 0 || p.ekadashiThisWeek || p.festivalFastThisWeek
  );

  return {
    harmonyScore: {
      score,
      label: tier.label,
      emoji: tier.emoji,
      color: tier.color,
      breakdown: harmonyScore,
    },
    constraints: {
      total_conflicts_detected: conflicts.length,
      total_conflicts_resolved: resolutions.length,
      medication_guardrails_applied: medicationGuardrailBundles.length,
      fasting_members: fastingMembers.length,
      pantry_zero_waste_items: pantryZeroWasteItems.length,
    },
    mealPlan: {
      days: promptResult.weeklyMealPlan,
      nutritional_summary: promptResult.nutritional_summary,
      staples: promptResult.staples,
      weekly_perishables: promptResult.weeklyPerishables,
      buffer_items: promptResult.bufferItems,
      budget_summary: {
        staples_total: promptResult.staples_total_cost,
        weekly_perishables_total: promptResult.weeklyPerishables_total_cost,
        buffer_total: promptResult.buffer_total_cost,
        grand_total:
          promptResult.staples_total_cost +
          promptResult.weeklyPerishables_total_cost +
          promptResult.buffer_total_cost,
      },
    },
    timings,
  };
}

export function formatConflictSummaryForUI(
  harmonyScore: HarmonyScoreBreakdown,
  conflicts: { description: string; priority_level: ConflictPriorityLevel }[],
  resolutions: { resolution: string; resolution_type: string }[]
): ConflictSummaryForUI {
  const score = harmonyScore.final_score;
  const tier = getScoreTier(score);

  const deductionText = harmonyScore.deductions
    .map((d) => `${d.points} pts: ${d.reason}`)
    .join("; ");
  const additionText = harmonyScore.additions
    .filter((a) => a.points > 0)
    .map((a) => `+${a.points} pts: ${a.reason}`)
    .join("; ");

  return {
    total_detected: conflicts.length,
    total_resolved: resolutions.length,
    harmony_score: score,
    harmony_score_label: tier.label,
    score_breakdown_text:
      `${score}/100 — ${harmonyScore.deductions.length} deduction(s): ${deductionText || "none"}. ` +
      `${harmonyScore.additions.filter((a) => a.points > 0).length} addition(s): ${additionText || "none"}.`,
    conflict_cards: conflicts
      .filter((c) => c.priority_level <= 5)
      .map((conflict, i) => {
        const resolution = resolutions[i];
        return {
          priority_level: conflict.priority_level,
          priority_label: PRIORITY_LABELS[conflict.priority_level],
          description: conflict.description,
          resolution: resolution?.resolution ?? "Resolved by constraint engine.",
          resolution_type: resolution?.resolution_type ?? "plate_modification",
        };
      }),
  };
}
