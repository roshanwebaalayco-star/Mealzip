import { describe, it, expect } from "vitest";
import {
  calculateBudgetSplit,
  validateBudgetAdequacy,
  calculateRollingDailyLimit,
} from "../../src/engine/budget-engine";

describe("Budget Engine", () => {

  describe("calculateBudgetSplit — base split", () => {
    it("splits ₹10000 into 40:50:10 (staples:perishables:buffer)", () => {
      const result = calculateBudgetSplit({
        total_monthly_budget: 10000,
        month_year: "2025-07",
        state_region: "Delhi",
        meals_per_day: "3_meals",
        eating_out_frequency: "none",
        family_id: "fam-001",
      });
      expect(result.staples_budget).toBe(4000);
      expect(result.perishables_budget).toBe(5000);
      expect(result.buffer_budget).toBe(1000);
    });

    it("daily perishable limit = perishables_budget / days_in_month", () => {
      const result = calculateBudgetSplit({
        total_monthly_budget: 10000,
        month_year: "2025-07",
        state_region: "Delhi",
        meals_per_day: "3_meals",
        eating_out_frequency: "none",
        family_id: "fam-001",
      });
      expect(result.daily_perishable_limit).toBeCloseTo(5000 / 31, 1);
    });
  });

  describe("Meal weight splits", () => {
    it("3_meals: breakfast=28%, lunch=36%, dinner=36%", () => {
      const result = calculateBudgetSplit({
        total_monthly_budget: 10000,
        month_year: "2025-07",
        state_region: "Delhi",
        meals_per_day: "3_meals",
        eating_out_frequency: "none",
        family_id: "fam-001",
      });
      const daily = result.effective_daily_perishable_limit;
      expect(result.budget_breakdown.breakfast_weight).toBeCloseTo(0.28, 2);
      expect(result.budget_breakdown.lunch_weight).toBeCloseTo(0.36, 2);
      expect(result.budget_breakdown.dinner_weight).toBeCloseTo(0.36, 2);
      expect(result.budget_breakdown.daily_limits.breakfast).toBeCloseTo(daily * 0.28, 0);
    });

    it("3_meals_snacks: breakfast+snack+lunch+dinner weights sum to 1.0", () => {
      const result = calculateBudgetSplit({
        total_monthly_budget: 10000,
        month_year: "2025-07",
        state_region: "Delhi",
        meals_per_day: "3_meals_snacks",
        eating_out_frequency: "none",
        family_id: "fam-001",
      });
      const sum = result.budget_breakdown.breakfast_weight +
                  result.budget_breakdown.lunch_weight +
                  result.budget_breakdown.dinner_weight +
                  result.budget_breakdown.snack_weight;
      expect(sum).toBeCloseTo(1.0, 2);
    });

    it("2_meals: lunch=50%, dinner=50%, breakfast=0%", () => {
      const result = calculateBudgetSplit({
        total_monthly_budget: 10000,
        month_year: "2025-07",
        state_region: "Delhi",
        meals_per_day: "2_meals",
        eating_out_frequency: "none",
        family_id: "fam-001",
      });
      expect(result.budget_breakdown.breakfast_weight).toBe(0);
      expect(result.budget_breakdown.lunch_weight).toBeCloseTo(0.5, 2);
      expect(result.budget_breakdown.dinner_weight).toBeCloseTo(0.5, 2);
    });
  });

  describe("Eating out adjustment", () => {
    const BASE_INPUT = {
      total_monthly_budget: 10000,
      month_year: "2025-07",
      state_region: "Delhi",
      meals_per_day: "3_meals" as const,
      family_id: "fam-001",
    };

    it("none → effective daily limit equals base daily limit", () => {
      const result = calculateBudgetSplit({ ...BASE_INPUT, eating_out_frequency: "none" });
      expect(result.effective_daily_perishable_limit).toBe(result.daily_perishable_limit);
    });

    it("1_to_2_times → effective limit should be less than base limit", () => {
      const none = calculateBudgetSplit({ ...BASE_INPUT, eating_out_frequency: "none" });
      const sometimes = calculateBudgetSplit({ ...BASE_INPUT, eating_out_frequency: "1_to_2_times" });
      expect(sometimes.effective_daily_perishable_limit).toBeLessThan(none.effective_daily_perishable_limit);
    });

    it("frequently → effective limit should be less than 1_to_2_times limit", () => {
      const sometimes = calculateBudgetSplit({ ...BASE_INPUT, eating_out_frequency: "1_to_2_times" });
      const often = calculateBudgetSplit({ ...BASE_INPUT, eating_out_frequency: "frequently" });
      expect(often.effective_daily_perishable_limit).toBeLessThan(sometimes.effective_daily_perishable_limit);
    });

    it("effective daily limit should never be zero or negative", () => {
      const result = calculateBudgetSplit({ ...BASE_INPUT, eating_out_frequency: "frequently" });
      expect(result.effective_daily_perishable_limit).toBeGreaterThan(0);
    });
  });

  describe("Regional price suggestions", () => {
    it("Bokaro should return 7260 (explicitly set in spec)", () => {
      const result = calculateBudgetSplit({
        total_monthly_budget: 10000,
        month_year: "2025-07",
        state_region: "bokaro",
        meals_per_day: "3_meals",
        eating_out_frequency: "none",
        family_id: "fam-001",
      });
      expect(result.regional_price_suggestion).toBe(7260);
    });

    it("Delhi should be higher than Jharkhand (metro vs tier-3)", () => {
      const delhi = calculateBudgetSplit({ total_monthly_budget: 10000, month_year: "2025-07", state_region: "Delhi", meals_per_day: "3_meals", eating_out_frequency: "none", family_id: "fam-001" });
      const jharkhand = calculateBudgetSplit({ total_monthly_budget: 10000, month_year: "2025-07", state_region: "Jharkhand", meals_per_day: "3_meals", eating_out_frequency: "none", family_id: "fam-001" });
      expect(delhi.regional_price_suggestion).toBeGreaterThan(jharkhand.regional_price_suggestion);
    });

    it("unknown region should return a reasonable default (not 0)", () => {
      const result = calculateBudgetSplit({
        total_monthly_budget: 10000,
        month_year: "2025-07",
        state_region: "UnknownDistrictXYZ",
        meals_per_day: "3_meals",
        eating_out_frequency: "none",
        family_id: "fam-001",
      });
      expect(result.regional_price_suggestion).toBeGreaterThan(0);
    });
  });

  describe("validateBudgetAdequacy", () => {
    it("should flag a budget of ₹1000/month for family of 4 as inadequate", () => {
      const result = validateBudgetAdequacy(1000, "Delhi", 4);
      expect(result.is_adequate).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.adjusted_budget).not.toBeNull();
      expect(result.adjusted_budget!).toBeGreaterThan(1000);
    });

    it("should pass a realistic budget for Delhi family of 4", () => {
      const result = validateBudgetAdequacy(14850, "Delhi", 4);
      expect(result.is_adequate).toBe(true);
    });

    it("adjusted_budget should be null when budget is adequate", () => {
      const result = validateBudgetAdequacy(10000, "Jharkhand", 3);
      expect(result.adjusted_budget).toBeNull();
    });
  });

  describe("calculateRollingDailyLimit", () => {
    it("after 3 days with ₹700 spent of ₹1167 weekly budget → ~₹116.67/day remaining", () => {
      const result = calculateRollingDailyLimit({
        original_weekly_budget: 1166.67,
        days_elapsed: 3,
        actual_spent: 700,
      });
      expect(result.remaining_days).toBe(4);
      expect(result.remaining_budget).toBeCloseTo(466.67, 0);
      expect(result.adjusted_daily_limit).toBeCloseTo(116.67, 0);
    });

    it("remaining_days should never go below 1 even if days_elapsed >= 7", () => {
      const result = calculateRollingDailyLimit({
        original_weekly_budget: 1000,
        days_elapsed: 8,
        actual_spent: 900,
      });
      expect(result.remaining_days).toBeGreaterThanOrEqual(1);
    });
  });
});
