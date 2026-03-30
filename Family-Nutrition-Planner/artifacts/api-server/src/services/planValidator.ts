interface ValidationResult {
  passed: boolean;
  score: number;
  failures: string[];
  warnings: string[];
}

export function validatePlanClinically(
  plan: Record<string, unknown>,
  members: Array<{ name: string; healthConditions?: string[] }>,
): ValidationResult {
  const failures: string[] = [];
  const warnings: string[] = [];

  const days = (plan.days as Array<Record<string, unknown>>) ?? [];

  for (const member of members) {
    const conditions = member.healthConditions ?? [];

    if (conditions.includes("diabetes")) {
      let proteinAtLunchCount = 0;

      for (const day of days) {
        const meals = day.meals as Record<string, Record<string, unknown>> | undefined;
        if (!meals) continue;

        const lunch = meals.lunch;
        if (!lunch) continue;

        const memberPlate = (lunch.member_plates as Record<string, Record<string, unknown>>)?.[member.name];
        const lunchContent = [
          (lunch.base_dish_name as string) ?? "",
          (lunch.recipeName as string) ?? "",
          (memberPlate?.modification as string) ?? "",
          (memberPlate?.clinicalNote as string) ?? "",
          JSON.stringify(lunch.ingredients ?? ""),
        ]
          .join(" ")
          .toLowerCase();

        if (
          lunchContent.includes("dal") ||
          lunchContent.includes("dahi") ||
          lunchContent.includes("paneer") ||
          lunchContent.includes("makhana") ||
          lunchContent.includes("groundnut") ||
          lunchContent.includes("chana") ||
          lunchContent.includes("rajma") ||
          lunchContent.includes("moong") ||
          lunchContent.includes("protein")
        ) {
          proteinAtLunchCount++;
        }
      }

      if (days.length > 0 && proteinAtLunchCount < days.length * 0.7) {
        failures.push(
          `${member.name}: Protein source at lunch only ${proteinAtLunchCount}/${days.length} days. Diabetic rule requires protein at every lunch.`,
        );
      }
    }

    if (conditions.includes("anaemia")) {
      let vitCPairingCount = 0;
      const totalMainMeals = days.length * 3;

      for (const day of days) {
        const meals = day.meals as Record<string, Record<string, unknown>> | undefined;
        if (!meals) continue;

        for (const mealType of ["breakfast", "lunch", "dinner"]) {
          const meal = meals[mealType];
          if (!meal) continue;

          const memberPlate = (meal.member_plates as Record<string, Record<string, unknown>>)?.[member.name];

          const mealContent = [
            JSON.stringify(memberPlate ?? ""),
            (meal.base_dish_name as string) ?? "",
            JSON.stringify(meal.ingredients ?? ""),
          ]
            .join(" ")
            .toLowerCase();

          if (
            mealContent.includes("lemon") ||
            mealContent.includes("nimbu") ||
            mealContent.includes("amla") ||
            mealContent.includes("vitamin c") ||
            mealContent.includes("orange") ||
            mealContent.includes("guava")
          ) {
            vitCPairingCount++;
          }
        }
      }

      if (totalMainMeals > 0 && vitCPairingCount < totalMainMeals * 0.4) {
        warnings.push(
          `${member.name}: Vitamin C paired with iron only ${vitCPairingCount}/${totalMainMeals} meals. Target is 40%+.`,
        );
      }
    }
  }

  const score = Math.max(
    0,
    100 - failures.length * 15 - warnings.length * 5,
  );

  return {
    passed: failures.length === 0,
    score,
    failures,
    warnings,
  };
}
