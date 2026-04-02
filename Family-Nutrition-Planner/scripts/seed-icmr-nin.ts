import { localDb as db } from "@workspace/db";
import { icmrNinRdaTable } from "@workspace/db";

const RDA_DATA = [
  { ageGroup: "0-1", ageMin: 0, ageMax: 1, gender: "both", activityLevel: "moderate", calories: 800, proteinG: 10, fatG: 28, carbsG: 95, fiberG: 8, calciumMg: 500, ironMg: 9, vitaminCMg: 25, vitaminAMcg: 350, vitaminD3Mcg: 5, zincMg: 3.0 },
  { ageGroup: "1-3", ageMin: 1, ageMax: 3, gender: "both", activityLevel: "moderate", calories: 1060, proteinG: 16, fatG: 35, carbsG: 140, fiberG: 10, calciumMg: 500, ironMg: 9, vitaminCMg: 25, vitaminAMcg: 400, vitaminD3Mcg: 5, zincMg: 3.0 },
  { ageGroup: "4-6", ageMin: 4, ageMax: 6, gender: "both", activityLevel: "moderate", calories: 1350, proteinG: 20, fatG: 40, carbsG: 175, fiberG: 14, calciumMg: 600, ironMg: 13, vitaminCMg: 25, vitaminAMcg: 400, vitaminD3Mcg: 5, zincMg: 5.0 },
  { ageGroup: "7-9", ageMin: 7, ageMax: 9, gender: "both", activityLevel: "moderate", calories: 1690, proteinG: 29, fatG: 44, carbsG: 225, fiberG: 17, calciumMg: 700, ironMg: 16, vitaminCMg: 30, vitaminAMcg: 600, vitaminD3Mcg: 5, zincMg: 7.0 },
  { ageGroup: "10-12", ageMin: 10, ageMax: 12, gender: "male", activityLevel: "moderate", calories: 2190, proteinG: 40, fatG: 55, carbsG: 295, fiberG: 22, calciumMg: 800, ironMg: 21, vitaminCMg: 40, vitaminAMcg: 600, vitaminD3Mcg: 5, zincMg: 8.0 },
  { ageGroup: "10-12", ageMin: 10, ageMax: 12, gender: "female", activityLevel: "moderate", calories: 2190, proteinG: 40, fatG: 55, carbsG: 295, fiberG: 22, calciumMg: 800, ironMg: 27, vitaminCMg: 40, vitaminAMcg: 600, vitaminD3Mcg: 5, zincMg: 8.0 },
  { ageGroup: "13-15", ageMin: 13, ageMax: 15, gender: "male", activityLevel: "moderate", calories: 2750, proteinG: 60, fatG: 67, carbsG: 370, fiberG: 28, calciumMg: 800, ironMg: 28, vitaminCMg: 40, vitaminAMcg: 600, vitaminD3Mcg: 5, zincMg: 11.0 },
  { ageGroup: "13-15", ageMin: 13, ageMax: 15, gender: "female", activityLevel: "moderate", calories: 2330, proteinG: 51, fatG: 58, carbsG: 315, fiberG: 23, calciumMg: 800, ironMg: 27, vitaminCMg: 40, vitaminAMcg: 600, vitaminD3Mcg: 5, zincMg: 11.0 },
  { ageGroup: "16-17", ageMin: 16, ageMax: 17, gender: "male", activityLevel: "moderate", calories: 3020, proteinG: 65, fatG: 72, carbsG: 405, fiberG: 30, calciumMg: 800, ironMg: 32, vitaminCMg: 40, vitaminAMcg: 600, vitaminD3Mcg: 5, zincMg: 12.0 },
  { ageGroup: "16-17", ageMin: 16, ageMax: 17, gender: "female", activityLevel: "moderate", calories: 2440, proteinG: 55, fatG: 60, carbsG: 330, fiberG: 24, calciumMg: 800, ironMg: 27, vitaminCMg: 40, vitaminAMcg: 600, vitaminD3Mcg: 5, zincMg: 12.0 },
  { ageGroup: "18-59", ageMin: 18, ageMax: 59, gender: "male", activityLevel: "sedentary", calories: 2090, proteinG: 60, fatG: 50, carbsG: 285, fiberG: 30, calciumMg: 600, ironMg: 17, vitaminCMg: 40, vitaminAMcg: 600, vitaminD3Mcg: 5, zincMg: 12.0 },
  { ageGroup: "18-59", ageMin: 18, ageMax: 59, gender: "male", activityLevel: "moderate", calories: 2550, proteinG: 60, fatG: 60, carbsG: 345, fiberG: 30, calciumMg: 600, ironMg: 17, vitaminCMg: 40, vitaminAMcg: 600, vitaminD3Mcg: 5, zincMg: 12.0 },
  { ageGroup: "18-59", ageMin: 18, ageMax: 59, gender: "male", activityLevel: "active", calories: 2980, proteinG: 60, fatG: 70, carbsG: 400, fiberG: 30, calciumMg: 600, ironMg: 17, vitaminCMg: 40, vitaminAMcg: 600, vitaminD3Mcg: 5, zincMg: 12.0 },
  { ageGroup: "18-59", ageMin: 18, ageMax: 59, gender: "female", activityLevel: "sedentary", calories: 1660, proteinG: 55, fatG: 40, carbsG: 225, fiberG: 25, calciumMg: 600, ironMg: 21, vitaminCMg: 40, vitaminAMcg: 600, vitaminD3Mcg: 5, zincMg: 10.0 },
  { ageGroup: "18-59", ageMin: 18, ageMax: 59, gender: "female", activityLevel: "moderate", calories: 1900, proteinG: 55, fatG: 50, carbsG: 245, fiberG: 25, calciumMg: 600, ironMg: 21, vitaminCMg: 40, vitaminAMcg: 600, vitaminD3Mcg: 5, zincMg: 10.0 },
  { ageGroup: "18-59", ageMin: 18, ageMax: 59, gender: "female", activityLevel: "active", calories: 2230, proteinG: 55, fatG: 55, carbsG: 305, fiberG: 25, calciumMg: 600, ironMg: 21, vitaminCMg: 40, vitaminAMcg: 600, vitaminD3Mcg: 5, zincMg: 10.0 },
  { ageGroup: "60+", ageMin: 60, ageMax: 120, gender: "male", activityLevel: "sedentary", calories: 1900, proteinG: 60, fatG: 45, carbsG: 255, fiberG: 30, calciumMg: 600, ironMg: 17, vitaminCMg: 40, vitaminAMcg: 600, vitaminD3Mcg: 10, zincMg: 12.0 },
  { ageGroup: "60+", ageMin: 60, ageMax: 120, gender: "male", activityLevel: "moderate", calories: 2110, proteinG: 60, fatG: 55, carbsG: 275, fiberG: 30, calciumMg: 600, ironMg: 17, vitaminCMg: 40, vitaminAMcg: 600, vitaminD3Mcg: 10, zincMg: 12.0 },
  { ageGroup: "60+", ageMin: 60, ageMax: 120, gender: "female", activityLevel: "sedentary", calories: 1680, proteinG: 55, fatG: 40, carbsG: 225, fiberG: 25, calciumMg: 600, ironMg: 17, vitaminCMg: 40, vitaminAMcg: 600, vitaminD3Mcg: 10, zincMg: 10.0 },
  { ageGroup: "60+", ageMin: 60, ageMax: 120, gender: "female", activityLevel: "moderate", calories: 1860, proteinG: 55, fatG: 50, carbsG: 240, fiberG: 25, calciumMg: 600, ironMg: 17, vitaminCMg: 40, vitaminAMcg: 600, vitaminD3Mcg: 10, zincMg: 10.0 },
  { ageGroup: "pregnant", ageMin: 18, ageMax: 45, gender: "female", activityLevel: "moderate", calories: 2175, proteinG: 78, fatG: 55, carbsG: 295, fiberG: 30, calciumMg: 1200, ironMg: 35, vitaminCMg: 60, vitaminAMcg: 800, vitaminD3Mcg: 10, zincMg: 12.0 },
  { ageGroup: "lactating", ageMin: 18, ageMax: 45, gender: "female", activityLevel: "moderate", calories: 2425, proteinG: 74, fatG: 60, carbsG: 320, fiberG: 30, calciumMg: 1200, ironMg: 21, vitaminCMg: 80, vitaminAMcg: 950, vitaminD3Mcg: 10, zincMg: 12.0 },
];

async function seed() {
  const existing = await db.select({ id: icmrNinRdaTable.id }).from(icmrNinRdaTable).limit(1);
  if (existing.length > 0) {
    console.log("ICMR-NIN RDA data already seeded, skipping...");
    return;
  }

  await db.insert(icmrNinRdaTable).values(RDA_DATA);
  console.log(`✅ Seeded ${RDA_DATA.length} ICMR-NIN RDA records successfully!`);
}

seed().catch(err => {
  console.error("ICMR-NIN seed failed:", err);
  process.exit(1);
});
