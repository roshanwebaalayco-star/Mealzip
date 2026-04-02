export interface ICMRTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  iron: number;
  calcium: number;
  vitaminC: number;
}

export function getICMRNINTargets(
  age: number,
  gender: string,
  activityLevel: string,
  healthConditions: string[] = []
): ICMRTargets {
  let calories = 2000;
  let protein = 60;
  let carbs = 250;
  let fat = 55;
  let fiber = 30;
  let iron = 17;
  let calcium = 800;
  let vitaminC = 40;

  if (age < 3) {
    calories = 1060; protein = 16; carbs = 140; fat = 35; fiber = 10; iron = 9; calcium = 500; vitaminC = 25;
  } else if (age < 7) {
    calories = 1350; protein = 20; carbs = 175; fat = 40; fiber = 14; iron = 13; calcium = 600; vitaminC = 25;
  } else if (age < 10) {
    calories = 1690; protein = 29; carbs = 225; fat = 44; fiber = 17; iron = 16; calcium = 700; vitaminC = 30;
  } else if (age < 13) {
    calories = 2190; protein = 40; carbs = 295; fat = 55; fiber = 22; iron = gender === "female" ? 27 : 21; calcium = 800; vitaminC = 40;
  } else if (age < 16) {
    if (gender === "female") {
      calories = 2330; protein = 51; carbs = 315; fat = 58; fiber = 23; iron = 27; calcium = 800; vitaminC = 40;
    } else {
      calories = 2750; protein = 60; carbs = 370; fat = 67; fiber = 28; iron = 28; calcium = 800; vitaminC = 40;
    }
  } else if (age < 18) {
    if (gender === "female") {
      calories = 2440; protein = 55; carbs = 330; fat = 60; fiber = 24; iron = 27; calcium = 800; vitaminC = 40;
    } else {
      calories = 3020; protein = 65; carbs = 405; fat = 72; fiber = 30; iron = 32; calcium = 800; vitaminC = 40;
    }
  } else if (age < 60) {
    const activityMultiplier = activityLevel === "sedentary" ? 0.9
      : activityLevel === "light" ? 1.0
      : activityLevel === "moderate" ? 1.1
      : activityLevel === "active" ? 1.2
      : 1.3;

    if (gender === "female") {
      calories = Math.round(1900 * activityMultiplier);
      protein = 55; carbs = 245; fat = 50; fiber = 25; iron = 21; calcium = 600; vitaminC = 40;
    } else {
      calories = Math.round(2320 * activityMultiplier);
      protein = 60; carbs = 300; fat = 60; fiber = 30; iron = 17; calcium = 600; vitaminC = 40;
    }
  } else {
    if (gender === "female") {
      calories = 1860; protein = 55; carbs = 240; fat = 50; fiber = 25; iron = 17; calcium = 600; vitaminC = 40;
    } else {
      calories = 2110; protein = 60; carbs = 275; fat = 55; fiber = 30; iron = 17; calcium = 600; vitaminC = 40;
    }
  }

  if (healthConditions.includes("diabetes")) {
    carbs = Math.round(carbs * 0.85);
    fiber = Math.max(fiber, 35);
  }
  if (healthConditions.includes("hypertension")) {
    fat = Math.round(fat * 0.9);
  }
  if (healthConditions.includes("obesity")) {
    calories = Math.round(calories * 0.8);
    fat = Math.round(fat * 0.8);
  }

  return { calories, protein, carbs, fat, fiber, iron, calcium, vitaminC };
}

export function calculateHarmonyScore(
  mealNutrition: ICMRTargets,
  members: Array<{ age: number; gender: string; activityLevel: string; healthConditions: string[]; dietaryType: string }>,
  diet: string,
  budget: number,
  costEstimate: number
): number {
  let totalScore = 0;
  let memberCount = 0;

  for (const member of members) {
    const targets = getICMRNINTargets(member.age, member.gender, member.activityLevel, member.healthConditions);
    let memberScore = 100;

    const calorieRatio = mealNutrition.calories / targets.calories;
    if (calorieRatio < 0.8 || calorieRatio > 1.2) memberScore -= 20;
    else if (calorieRatio < 0.9 || calorieRatio > 1.1) memberScore -= 10;

    const proteinRatio = mealNutrition.protein / targets.protein;
    if (proteinRatio < 0.8) memberScore -= 15;

    const fiberRatio = mealNutrition.fiber / targets.fiber;
    if (fiberRatio < 0.7) memberScore -= 10;

    if ((member.dietaryType === "strictly_vegetarian" || member.dietaryType === "vegetarian") && diet === "non-vegetarian") memberScore -= 30;
    if (member.dietaryType === "vegan" && diet !== "vegan") memberScore -= 30;

    totalScore += Math.max(0, memberScore);
    memberCount++;
  }

  let score = memberCount > 0 ? totalScore / memberCount : 50;

  if (budget > 0 && costEstimate > 0) {
    const budgetRatio = costEstimate / budget;
    if (budgetRatio > 1) score = Math.round(score * (1 / budgetRatio));
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}
