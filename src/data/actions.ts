// Acciones de escritura reutilizadas por varias pantallas.
import type { FoodView } from './catalog';
import { getDb, getUid, put, update } from './store';
import type { BodyWeight, FoodLog, Mesocycle, Phase, Prefs, Profile, Routine, TableName } from './types';
import { TABLES } from './types';
import { computePlan, type Plan } from '../core/plan';
import { ageFrom } from '../core/dates';
import { uid } from '../core/templates';
import { nowISO } from './store';

export async function setWeight(date: string, weight_kg: number, body_fat: number | null = null) {
  await put('body_weights', { id: `${getUid()}:${date}`, date, weight_kg, body_fat });
}

export async function addWater(date: string, delta: number) {
  const id = `${getUid()}:${date}`;
  const cur = await getDb().day_logs.get(id);
  const base = cur && !cur.deleted_at ? cur.water_ml : 0;
  await put('day_logs', { id, date, water_ml: Math.max(0, base + delta), note: cur?.note ?? null });
}

export async function updatePrefs(profile: Profile, patch: Partial<Prefs>) {
  await update('profiles', profile.id, { prefs: { ...profile.prefs, ...patch } });
}

export async function toggleFavorite(profile: Profile, ref: string): Promise<boolean> {
  const favs = profile.prefs.favorites ?? [];
  const on = !favs.includes(ref);
  await updatePrefs(profile, { favorites: on ? [ref, ...favs] : favs.filter((f) => f !== ref) });
  return on;
}

const r1 = (x: number) => Math.round(x * 10) / 10;

/** Registro del diario a partir de un alimento (valores por 100 g) y los gramos comidos. */
export function foodLogFrom(food: FoodView, grams: number, o: { date: string; meal: string; portion: string | null; qty: number | null }): Omit<FoodLog, 'user_id' | 'updated_at' | 'deleted_at'> {
  const f = grams / 100;
  return {
    id: uid(), date: o.date, meal: o.meal, food_ref: food.ref, name: food.name, grams: r1(grams), portion: o.portion, qty: o.qty,
    kcal: Math.round(food.kcal * f), protein: r1(food.protein * f), carbs: r1(food.carbs * f), fat: r1(food.fat * f), fiber: r1(food.fiber * f),
    source: food.custom ? 'propio' : 'catalogo', created_at: nowISO(),
  };
}

export function latestWeight(weights: BodyWeight[]): BodyWeight | undefined {
  return weights.length ? weights[weights.length - 1] : undefined;
}

/** Plan con los datos actuales del perfil y un peso dado. */
export function planFor(profile: Profile, weightKg: number, goal = profile.goal, rate = 0, goalWeight: number | null = null, bodyFat: number | null = null): Plan {
  return computePlan({
    sex: profile.sex, age: ageFrom(profile.birth_date), heightCm: profile.height_cm, weightKg, goalWeightKg: goalWeight, bodyFatPct: bodyFat,
    activity: profile.activity, goal, rateKgWeek: rate, sessionsPerWeek: profile.training_days.length, sessionMin: profile.session_min,
  });
}

export function phaseFromPlan(plan: Plan, o: { goal: Phase['type']; start: string; rate: number; weight: number; goalWeight: number | null }): Omit<Phase, 'user_id' | 'updated_at' | 'deleted_at'> {
  return {
    id: uid(), type: o.goal, start_date: o.start, end_date: null, rate_kg_week: o.rate, start_weight: o.weight, goal_weight: o.goalWeight,
    bmr: plan.bmr, tdee: plan.tdee, kcal: plan.kcal, protein_g: plan.protein, carbs_g: plan.carbs, fat_g: plan.fat,
    protein_per_kg: plan.proteinPerKg, fat_pct: plan.fatPct, activity_factor: plan.activityFactor, training_kcal: plan.trainingKcal,
    cycling: false, status: 'activa', notes: null,
  };
}

/** Cierra las fases abiertas el día anterior a `start` y guarda la nueva. */
export async function startPhase(phases: Phase[], phase: Omit<Phase, 'user_id' | 'updated_at' | 'deleted_at'>, yesterday: string) {
  for (const p of phases) {
    if (p.deleted_at || p.status !== 'activa') continue;
    if (p.start_date >= phase.start_date) await update('phases', p.id, { status: 'terminada', end_date: p.start_date, deleted_at: p.start_date === phase.start_date ? nowISO() : null });
    else await update('phases', p.id, { status: 'terminada', end_date: yesterday });
  }
  await put('phases', phase);
}

/** Activa una rutina con un mesociclo nuevo (el anterior queda terminado). */
export async function activateRoutine(mesos: Mesocycle[], meso: Omit<Mesocycle, 'user_id' | 'updated_at' | 'deleted_at'>) {
  for (const m of mesos) if (!m.deleted_at && m.status === 'activo') await update('mesocycles', m.id, { status: 'terminado' });
  await put('mesocycles', meso);
}

export async function saveRoutine(r: Omit<Routine, 'user_id' | 'updated_at' | 'deleted_at'>) {
  await put('routines', r);
}

/** Copia de seguridad: todas las tablas del usuario en un JSON. */
export async function exportAll(): Promise<Blob> {
  const db = getDb();
  const out: Record<string, unknown> = { app: 'Forus', exported_at: nowISO(), user_id: getUid() };
  for (const t of TABLES as TableName[]) out[t] = (await db.table(t).toArray()).filter((r: { deleted_at: string | null }) => !r.deleted_at);
  return new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' });
}

export function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
