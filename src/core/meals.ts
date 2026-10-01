// Reparto del objetivo del día entre las comidas. En días de entrenamiento, la comida anterior
// y la posterior al gimnasio llevan más carbohidratos y menos grasa (se digieren mejor y rinden más).
import type { Macros } from './cycling';

export interface MealLike { id: string; name: string; time: string }
export type PeriTag = 'pre' | 'post' | null;
export interface MealTarget extends MealLike, Macros { tag: PeriTag }

/** Peso de cada comida en las calorías del día (patrón chileno: almuerzo grande, once liviana). */
export const MEAL_SHARE: Record<string, number> = { desayuno: 0.22, colacion: 0.1, almuerzo: 0.32, once: 0.16, cena: 0.2, 'colacion-noche': 0.08 };

const isSnack = (m: MealLike) => m.id.startsWith('colacion') || /colaci/i.test(m.name);
const shareOf = (m: MealLike) => MEAL_SHARE[m.id] ?? (isSnack(m) ? 0.1 : 0.2);

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Comida pre-entreno (30 min a 3 h antes) y post-entreno (45 min a 4 h después). */
export function periMeals(meals: MealLike[], trainingTime: string | null): { pre: string | null; post: string | null } {
  if (!trainingTime) return { pre: null, post: null };
  const t = toMin(trainingTime);
  const sorted = [...meals].sort((a, b) => toMin(a.time) - toMin(b.time));
  const pre = [...sorted].reverse().find((m) => toMin(m.time) <= t - 30 && toMin(m.time) >= t - 180)?.id ?? null;
  const post = sorted.find((m) => toMin(m.time) >= t + 45 && toMin(m.time) <= t + 240)?.id ?? null;
  return { pre, post };
}

export function mealTargets(day: Macros, meals: MealLike[], trainingTime: string | null): MealTarget[] {
  if (!meals.length) return [];
  const { pre, post } = periMeals(meals, trainingTime);
  const rows = meals.map((m) => {
    const share = shareOf(m);
    const tag: PeriTag = m.id === pre ? 'pre' : m.id === post ? 'post' : null;
    return {
      m, tag,
      p: isSnack(m) ? 0.5 : 1, // la proteína se reparte parejo entre las comidas principales
      c: share * (tag ? 1.6 : 1),
      f: share * (tag ? 0.5 : 1),
    };
  });
  const sum = (k: 'p' | 'c' | 'f') => rows.reduce((a, r) => a + r[k], 0);
  const P = sum('p'), C = sum('c'), F = sum('f');
  return rows.map(({ m, tag, p, c, f }) => {
    const protein = Math.round((day.protein * p) / P);
    const carbs = Math.round((day.carbs * c) / C);
    const fat = Math.round((day.fat * f) / F);
    return { ...m, tag, protein, carbs, fat, kcal: Math.round((protein * 4 + carbs * 4 + fat * 9) / 10) * 10 };
  });
}
