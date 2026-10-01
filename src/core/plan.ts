// Cálculo del plan: gasto energético, calorías objetivo y macros.
import type { Activity, Goal, Level, Sex } from '../data/types';

/** Factor de actividad de la vida diaria, SIN contar el entrenamiento (se suma aparte). */
export const ACTIVITY: Record<Activity, { factor: number; label: string; hint: string }> = {
  sedentario: { factor: 1.2, label: 'Sedentaria', hint: 'Trabajo sentado y menos de 5 mil pasos al día' },
  ligero: { factor: 1.3, label: 'Ligera', hint: 'Trabajo sentado pero caminas: 5–8 mil pasos' },
  moderado: { factor: 1.4, label: 'Moderada', hint: 'Pasas parte del día de pie: 8–11 mil pasos' },
  activo: { factor: 1.55, label: 'Activa', hint: 'Trabajo de pie o en movimiento: 11–15 mil pasos' },
  muy_activo: { factor: 1.7, label: 'Muy activa', hint: 'Trabajo físico pesado o más de 15 mil pasos' },
};

export const GOALS: Record<Goal, { label: string; short: string; hint: string }> = {
  volumen: { label: 'Ganar músculo', short: 'Volumen', hint: 'Superávit controlado' },
  definicion: { label: 'Perder grasa', short: 'Definición', hint: 'Déficit cuidando la fuerza' },
  recomposicion: { label: 'Recomposición', short: 'Recomposición', hint: 'Mismo peso, más músculo y menos grasa' },
  mantencion: { label: 'Mantener', short: 'Mantención', hint: 'Consolidar lo logrado entre fases' },
};

/** Opciones de ritmo (kg por semana) según objetivo y nivel: [lento, recomendado, rápido] */
export function paceOptions(goal: Goal, level: Level, weightKg: number): number[] | null {
  if (goal === 'volumen') {
    if (level === 'principiante') return [0.25, 0.35, 0.5];
    if (level === 'intermedio') return [0.15, 0.25, 0.4];
    return [0.1, 0.15, 0.25];
  }
  if (goal === 'definicion') {
    const rec = Math.round(weightKg * 0.007 * 20) / 20; // ≈ 0,7 % del peso por semana
    return [-Math.max(0.2, Math.round(rec * 0.5 * 20) / 20), -rec, -Math.round(Math.min(weightKg * 0.01, 1) * 20) / 20];
  }
  return null;
}

export const PROTEIN_PER_KG: Record<Goal, number> = { volumen: 1.8, mantencion: 1.8, recomposicion: 2.0, definicion: 2.2 };
export const KCAL_PER_KG = 7700;

export function bmrMifflin(sex: Sex, kg: number, cm: number, age: number): number {
  return 10 * kg + 6.25 * cm - 5 * age + (sex === 'm' ? 5 : -161);
}

/** Gasto neto del entrenamiento de fuerza: ~MET 5 → 0,07 kcal por kg por minuto. */
export function trainingKcalPerDay(kg: number, sessionsPerWeek: number, minutes: number): number {
  return (0.07 * kg * minutes * sessionsPerWeek) / 7;
}

export interface PlanInput {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  goalWeightKg?: number | null;
  bodyFatPct?: number | null;
  activity: Activity;
  goal: Goal;
  rateKgWeek: number;
  sessionsPerWeek: number;
  sessionMin: number;
}

export interface Plan {
  bmr: number;
  activityFactor: number;
  trainingKcal: number;
  tdee: number;
  delta: number;
  kcal: number;
  proteinPerKg: number;
  refWeight: number;
  protein: number;
  fat: number;
  carbs: number;
  fatPct: number;
  warnings: string[];
}

const r10 = (x: number) => Math.round(x / 10) * 10;

export function computePlan(i: PlanInput): Plan {
  const warnings: string[] = [];
  const bmr = bmrMifflin(i.sex, i.weightKg, i.heightCm, i.age);
  const activityFactor = ACTIVITY[i.activity].factor;
  const trainingKcal = trainingKcalPerDay(i.weightKg, i.sessionsPerWeek, i.sessionMin);
  const tdee = bmr * activityFactor + trainingKcal;

  let delta = 0;
  if (i.goal === 'volumen' || i.goal === 'definicion') delta = (i.rateKgWeek * KCAL_PER_KG) / 7;
  if (i.goal === 'recomposicion') delta = -0.1 * tdee;

  let kcal = r10(tdee + delta);
  const floor = i.sex === 'm' ? 1500 : 1200;
  if (kcal < floor) {
    warnings.push(`Subimos tu objetivo a ${floor} kcal: menos que eso requiere supervisión profesional.`);
    kcal = floor;
  }
  if (i.goal === 'definicion' && Math.abs(i.rateKgWeek) > i.weightKg * 0.01) {
    warnings.push('Bajar más del 1 % de tu peso por semana aumenta el riesgo de perder músculo.');
  }

  // Con % de grasa alto, la proteína se calcula sobre un peso de referencia menor para no inflarla.
  const highFat = i.bodyFatPct != null && i.bodyFatPct > (i.sex === 'm' ? 25 : 32);
  let refWeight = i.weightKg;
  if (highFat) {
    refWeight = i.goalWeightKg && i.goalWeightKg < i.weightKg ? i.goalWeightKg : i.weightKg * 0.85;
  }
  const proteinPerKg = PROTEIN_PER_KG[i.goal];
  const protein = Math.round(refWeight * proteinPerKg);

  const fatPct = 0.25;
  const fat = Math.round(Math.max((kcal * fatPct) / 9, 0.6 * refWeight));
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  if (carbs < 100) warnings.push('Tus carbohidratos quedan bajos (< 100 g); podrías rendir menos en el gimnasio.');

  return {
    bmr: Math.round(bmr), activityFactor, trainingKcal: Math.round(trainingKcal), tdee: Math.round(tdee),
    delta: Math.round(delta), kcal, proteinPerKg, refWeight: Math.round(refWeight * 10) / 10,
    protein, fat, carbs, fatPct, warnings,
  };
}
