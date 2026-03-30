import { describe, it, expect } from 'vitest';
import { getICMRNINTargets } from '../../artifacts/api-server/src/lib/icmr-nin';

describe('ICMR-NIN Nutrient Targets', () => {
  it('adult male sedentary gets ~2000-2400 kcal', () => {
    const targets = getICMRNINTargets(35, 'male', 'sedentary');
    expect(targets.calories).toBeGreaterThan(1900);
    expect(targets.calories).toBeLessThan(2500);
  });

  it('adult female sedentary gets ~1600-2000 kcal', () => {
    const targets = getICMRNINTargets(35, 'female', 'sedentary');
    expect(targets.calories).toBeGreaterThan(1500);
    expect(targets.calories).toBeLessThan(2100);
  });

  it('very active male gets more calories than sedentary', () => {
    const sedentary = getICMRNINTargets(35, 'male', 'sedentary');
    const active = getICMRNINTargets(35, 'male', 'active');
    expect(active.calories).toBeGreaterThan(sedentary.calories);
  });

  it('woman has higher iron requirement than man', () => {
    const male = getICMRNINTargets(35, 'male', 'sedentary');
    const female = getICMRNINTargets(35, 'female', 'sedentary');
    expect(female.iron).toBeGreaterThan(male.iron);
  });

  it('child age 8 has lower calories than adult', () => {
    const child = getICMRNINTargets(8, 'male', 'moderate');
    const adult = getICMRNINTargets(35, 'male', 'sedentary');
    expect(child.calories).toBeLessThan(adult.calories);
  });

  it('returns protein, carbs, fat, iron, calcium', () => {
    const targets = getICMRNINTargets(35, 'male', 'sedentary');
    expect(targets.protein).toBeGreaterThan(0);
    expect(targets.carbs).toBeGreaterThan(0);
    expect(targets.fat).toBeGreaterThan(0);
    expect(targets.iron).toBeGreaterThan(0);
    expect(targets.calcium).toBeGreaterThan(0);
  });

  it('macros add up to approximately 100% of calories', () => {
    const t = getICMRNINTargets(35, 'male', 'sedentary');
    const proteinCals = t.protein * 4;
    const carbCals = t.carbs * 4;
    const fatCals = t.fat * 9;
    const total = proteinCals + carbCals + fatCals;
    const ratio = total / t.calories;
    expect(ratio).toBeGreaterThan(0.85);
    expect(ratio).toBeLessThan(1.15);
  });

  it('diabetes condition reduces carbs and increases fiber', () => {
    const normal = getICMRNINTargets(35, 'male', 'sedentary');
    const diabetic = getICMRNINTargets(35, 'male', 'sedentary', ['diabetes']);
    expect(diabetic.carbs).toBeLessThan(normal.carbs);
    expect(diabetic.fiber).toBeGreaterThanOrEqual(normal.fiber);
  });

  it('obesity condition reduces calories', () => {
    const normal = getICMRNINTargets(35, 'male', 'sedentary');
    const obese = getICMRNINTargets(35, 'male', 'sedentary', ['obesity']);
    expect(obese.calories).toBeLessThan(normal.calories);
  });

  it('senior male gets appropriate calories (1800-2200)', () => {
    const senior = getICMRNINTargets(65, 'male', 'sedentary');
    expect(senior.calories).toBeGreaterThan(1800);
    expect(senior.calories).toBeLessThan(2200);
  });

  it('toddler gets appropriate low calories', () => {
    const toddler = getICMRNINTargets(2, 'male', 'moderate');
    expect(toddler.calories).toBeLessThan(1200);
    expect(toddler.calories).toBeGreaterThan(800);
  });
});
