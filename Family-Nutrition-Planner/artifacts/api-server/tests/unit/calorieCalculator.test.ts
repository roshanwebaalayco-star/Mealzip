import { describe, it, expect } from "vitest";
import {
  applyAutoAssignmentRules,
  calculateDailyCalorieTarget,
  buildFastingPreloadInstructions,
} from "../../src/engine/calorie-calculator";

import {
  MEMBER_PAPA_DIABETIC,
  MEMBER_MAMA_ANAEMIC,
  MEMBER_DADI_JAIN_SENIOR,
  MEMBER_CHILD_SCHOOL,
  MEMBER_TEEN_WEIGHT_LOSS_ATTEMPT,
  MEMBER_TODDLER,
} from "../fixtures/familyFixtures";

describe("applyAutoAssignmentRules", () => {

  describe("Age < 5 (infant / toddler)", () => {
    it("should force early_childhood_nutrition for age 0", () => {
      const result = applyAutoAssignmentRules(0, "weight_loss");
      expect(result.effective_goal).toBe("early_childhood_nutrition");
      expect(result.is_child_under5).toBe(true);
      expect(result.goal_locked).toBe(true);
    });

    it("should force early_childhood_nutrition for age 4", () => {
      const result = applyAutoAssignmentRules(4, "maintain");
      expect(result.effective_goal).toBe("early_childhood_nutrition");
      expect(result.goal_locked).toBe(true);
    });

    it("should override ANY goal for toddler — even manage_condition", () => {
      const result = applyAutoAssignmentRules(2, "manage_condition");
      expect(result.effective_goal).toBe("early_childhood_nutrition");
    });
  });

  describe("Age 5–12 (school age)", () => {
    it("should force healthy_growth for age 5", () => {
      const result = applyAutoAssignmentRules(5, "weight_loss");
      expect(result.effective_goal).toBe("healthy_growth");
      expect(result.is_school_age).toBe(true);
      expect(result.goal_locked).toBe(true);
    });

    it("should force healthy_growth for age 12", () => {
      const result = applyAutoAssignmentRules(12, "build_muscle");
      expect(result.effective_goal).toBe("healthy_growth");
      expect(result.goal_locked).toBe(true);
    });

    it("should NOT apply school-age rule at age 13 (boundary)", () => {
      const result = applyAutoAssignmentRules(13, "maintain");
      expect(result.effective_goal).toBe("maintain");
      expect(result.is_school_age).toBe(false);
      expect(result.is_teen).toBe(true);
    });
  });

  describe("Age 13–17 (teen — weight loss blocked)", () => {
    it("should block weight_loss and return maintain for a 15-year-old", () => {
      const result = applyAutoAssignmentRules(15, "weight_loss");
      expect(result.effective_goal).toBe("maintain");
      expect(result.is_teen).toBe(true);
    });

    it("should allow maintain for teen", () => {
      const result = applyAutoAssignmentRules(16, "maintain");
      expect(result.effective_goal).toBe("maintain");
    });

    it("should allow build_muscle for teen", () => {
      const result = applyAutoAssignmentRules(14, "build_muscle");
      expect(result.effective_goal).toBe("build_muscle");
    });

    it("should NOT lock goal for teens (only block weight_loss)", () => {
      const result = applyAutoAssignmentRules(17, "manage_condition");
      expect(result.goal_locked).toBe(false);
    });
  });

  describe("Age 60+ (senior)", () => {
    it("should auto-set senior_nutrition when no specific goal (no_specific_goal)", () => {
      const result = applyAutoAssignmentRules(65, "no_specific_goal");
      expect(result.effective_goal).toBe("senior_nutrition");
      expect(result.is_senior).toBe(true);
    });

    it("should respect user override — maintain stays maintain for 70-year-old", () => {
      const result = applyAutoAssignmentRules(70, "maintain");
      expect(result.effective_goal).toBe("maintain");
    });

    it("should respect manage_condition for senior", () => {
      const result = applyAutoAssignmentRules(68, "manage_condition");
      expect(result.effective_goal).toBe("manage_condition");
    });

    it("should override healthy_growth for senior (impossible goal)", () => {
      const result = applyAutoAssignmentRules(72, "healthy_growth");
      expect(result.effective_goal).toBe("senior_nutrition");
    });
  });

  describe("Boundary conditions", () => {
    it("age exactly 17 → teen, weight_loss blocked", () => {
      const result = applyAutoAssignmentRules(17, "weight_loss");
      expect(result.effective_goal).toBe("maintain");
      expect(result.is_teen).toBe(true);
    });

    it("age exactly 18 → adult, weight_loss allowed", () => {
      const result = applyAutoAssignmentRules(18, "weight_loss");
      expect(result.effective_goal).toBe("weight_loss");
      expect(result.is_teen).toBe(false);
    });

    it("age exactly 59 → adult, no senior rule", () => {
      const result = applyAutoAssignmentRules(59, "no_specific_goal");
      expect(result.effective_goal).toBe("no_specific_goal");
      expect(result.is_senior).toBe(false);
    });

    it("age exactly 60 → senior, no_specific_goal → senior_nutrition", () => {
      const result = applyAutoAssignmentRules(60, "no_specific_goal");
      expect(result.effective_goal).toBe("senior_nutrition");
      expect(result.is_senior).toBe(true);
    });
  });
});

describe("calculateDailyCalorieTarget", () => {

  describe("Children — uses ICMR paediatric table (no body metrics needed)", () => {
    it("8-year-old moderately active child should get ~1690-1859 kcal", () => {
      const result = calculateDailyCalorieTarget({
        age: 8,
        gender: "female",
        heightCm: 122,
        weightKg: 25,
        activityLevel: "moderately_active",
        primaryGoal: "healthy_growth",
        goalPace: null,
      });
      expect(result.calculation_method).toBe("icmr_paediatric");
      expect(result.daily_calorie_target).toBeGreaterThanOrEqual(1690);
      expect(result.daily_calorie_target).toBeLessThanOrEqual(1900);
    });

    it("toddler (age 2) should get ~1000-1100 kcal", () => {
      const result = calculateDailyCalorieTarget({
        age: 2,
        gender: "male",
        heightCm: 88,
        weightKg: 13,
        activityLevel: "lightly_active",
        primaryGoal: "early_childhood_nutrition",
        goalPace: null,
      });
      expect(result.calculation_method).toBe("icmr_paediatric");
      expect(result.daily_calorie_target).toBeGreaterThanOrEqual(900);
      expect(result.daily_calorie_target).toBeLessThanOrEqual(1200);
    });

    it("teen (age 15, very active) should get >2400 kcal from ICMR table", () => {
      const result = calculateDailyCalorieTarget({
        age: 15,
        gender: "male",
        heightCm: 170,
        weightKg: 60,
        activityLevel: "very_active",
        primaryGoal: "maintain",
        goalPace: null,
      });
      expect(result.calculation_method).toBe("icmr_paediatric");
      expect(result.daily_calorie_target).toBeGreaterThan(2400);
    });
  });

  describe("Adults — uses Mifflin–St Jeor equation", () => {
    it("48yo sedentary male (Papa fixture) should get 1600–2200 kcal for manage_condition", () => {
      const result = calculateDailyCalorieTarget({
        age: MEMBER_PAPA_DIABETIC.age,
        gender: MEMBER_PAPA_DIABETIC.gender,
        heightCm: MEMBER_PAPA_DIABETIC.heightCm,
        weightKg: MEMBER_PAPA_DIABETIC.weightKg,
        activityLevel: MEMBER_PAPA_DIABETIC.activityLevel,
        primaryGoal: "manage_condition",
        goalPace: null,
      });
      expect(result.calculation_method).toBe("mifflin_st_jeor");
      expect(result.daily_calorie_target).toBeGreaterThan(1600);
      expect(result.daily_calorie_target).toBeLessThan(2200);
    });

    it("weight_loss with slow pace subtracts 275 kcal from TDEE", () => {
      const maintain = calculateDailyCalorieTarget({
        age: 35,
        gender: "male",
        heightCm: 175,
        weightKg: 85,
        activityLevel: "moderately_active",
        primaryGoal: "maintain",
        goalPace: null,
      });
      const loss = calculateDailyCalorieTarget({
        age: 35,
        gender: "male",
        heightCm: 175,
        weightKg: 85,
        activityLevel: "moderately_active",
        primaryGoal: "weight_loss",
        goalPace: "slow_0.25kg",
      });
      expect(maintain.daily_calorie_target! - loss.daily_calorie_target!).toBe(275);
    });

    it("weight_loss with moderate pace subtracts 550 kcal from TDEE", () => {
      const maintain = calculateDailyCalorieTarget({
        age: 35,
        gender: "male",
        heightCm: 175,
        weightKg: 85,
        activityLevel: "moderately_active",
        primaryGoal: "maintain",
        goalPace: null,
      });
      const loss = calculateDailyCalorieTarget({
        age: 35,
        gender: "male",
        heightCm: 175,
        weightKg: 85,
        activityLevel: "moderately_active",
        primaryGoal: "weight_loss",
        goalPace: "moderate_0.5kg",
      });
      expect(maintain.daily_calorie_target! - loss.daily_calorie_target!).toBe(550);
    });

    it("weight_loss should never go below 1200 kcal (floor)", () => {
      const result = calculateDailyCalorieTarget({
        age: 60,
        gender: "female",
        heightCm: 150,
        weightKg: 45,
        activityLevel: "sedentary",
        primaryGoal: "weight_loss",
        goalPace: "moderate_0.5kg",
      });
      expect(result.daily_calorie_target).toBeGreaterThanOrEqual(1200);
    });

    it("build_muscle adds 300 kcal above TDEE", () => {
      const maintain = calculateDailyCalorieTarget({
        age: 30,
        gender: "male",
        heightCm: 178,
        weightKg: 75,
        activityLevel: "very_active",
        primaryGoal: "maintain",
        goalPace: null,
      });
      const build = calculateDailyCalorieTarget({
        age: 30,
        gender: "male",
        heightCm: 178,
        weightKg: 75,
        activityLevel: "very_active",
        primaryGoal: "build_muscle",
        goalPace: null,
      });
      expect(build.daily_calorie_target! - maintain.daily_calorie_target!).toBe(300);
    });

    it("senior_nutrition reduces TDEE by 10%", () => {
      const maintain = calculateDailyCalorieTarget({
        age: 70,
        gender: "female",
        heightCm: 155,
        weightKg: 55,
        activityLevel: "sedentary",
        primaryGoal: "maintain",
        goalPace: null,
      });
      const senior = calculateDailyCalorieTarget({
        age: 70,
        gender: "female",
        heightCm: 155,
        weightKg: 55,
        activityLevel: "sedentary",
        primaryGoal: "senior_nutrition",
        goalPace: null,
      });
      expect(senior.daily_calorie_target).toBeLessThan(maintain.daily_calorie_target!);
      const ratio = senior.daily_calorie_target! / maintain.daily_calorie_target!;
      expect(ratio).toBeCloseTo(0.9, 1);
    });

    it("returns insufficient_data when weight is null", () => {
      const result = calculateDailyCalorieTarget({
        age: 30,
        gender: "male",
        heightCm: 175,
        weightKg: null,
        activityLevel: "moderately_active",
        primaryGoal: "maintain",
        goalPace: null,
      });
      expect(result.calculation_method).toBe("insufficient_data");
      expect(result.daily_calorie_target).toBeNull();
    });
  });
});

describe("buildFastingPreloadInstructions", () => {
  it("generates preload instructions for a member fasting on Thursday", () => {
    const profiles = [{
      id: "mem-003",
      name: "Dadi",
      age: 68,
      gender: "female" as const,
      heightCm: 150,
      effectiveWeightKg: 52,
      activityLevel: "sedentary" as const,
      displayOrder: 2,
      dietaryType: "jain_vegetarian" as const,
      religiousCulturalRules: { type: "jain_rules" as const, details: [] },
      allergies: [] as any,
      ingredientDislikes: [],
      occasionalNonvegConfig: null,
      effectiveGoal: "senior_nutrition" as const,
      goalPace: null,
      effectiveHealthConditions: [],
      effectiveSpiceTolerance: "mild" as const,
      effectiveFastingDays: ["thursday"],
      ekadashiThisWeek: true,
      festivalFastThisWeek: false,
      activeMedications: [],
      feelingThisWeek: null,
      nonvegDaysThisWeek: [],
      nonvegTypesThisWeek: [],
      tiffinNeeded: "no" as const,
      dailyCalorieTarget: 1200,
      isChildUnder5: false,
      isSchoolAge: false,
      isTeen: false,
      isSenior: true,
    }];

    const instructions = buildFastingPreloadInstructions(profiles);
    expect(instructions.length).toBeGreaterThan(0);
    const joined = instructions.join(" ").toLowerCase();
    expect(joined).toContain("dadi");
    expect(joined).toContain("thursday");
  });

  it("returns empty array when no members have fasting days", () => {
    const profiles = [{
      id: "x",
      name: "NoFast",
      age: 30,
      gender: "male" as const,
      heightCm: 175,
      effectiveWeightKg: 75,
      activityLevel: "moderately_active" as const,
      displayOrder: 0,
      dietaryType: "strictly_vegetarian" as const,
      religiousCulturalRules: { type: "none" as const, details: [] },
      allergies: [] as any,
      ingredientDislikes: [],
      occasionalNonvegConfig: null,
      effectiveGoal: "maintain" as const,
      goalPace: null,
      effectiveHealthConditions: [],
      effectiveSpiceTolerance: "medium" as const,
      effectiveFastingDays: [],
      ekadashiThisWeek: false,
      festivalFastThisWeek: false,
      activeMedications: [],
      feelingThisWeek: null,
      nonvegDaysThisWeek: [],
      nonvegTypesThisWeek: [],
      tiffinNeeded: "no" as const,
      dailyCalorieTarget: 2000,
      isChildUnder5: false,
      isSchoolAge: false,
      isTeen: false,
      isSenior: false,
    }];
    const instructions = buildFastingPreloadInstructions(profiles);
    expect(instructions).toHaveLength(0);
  });
});
