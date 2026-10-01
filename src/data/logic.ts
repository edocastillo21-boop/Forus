// Lógica de la app que combina datos guardados con el núcleo de cálculo.
import type { Catalog } from './catalog';
import type { FoodLog, Mesocycle, Phase, Profile, Routine, SessionExercise, WorkoutSession } from './types';
import { suggestSets, INCREMENT } from '../core/progression';
import { plannedFor, type Planned } from '../core/schedule';
import { evaluateDay } from '../core/day';
import { addDays } from '../core/dates';
import { uid } from '../core/templates';
import { nowISO } from './store';

export const DEFAULT_MEALS = [
  { id: 'desayuno', name: 'Desayuno', time: '08:00' },
  { id: 'almuerzo', name: 'Almuerzo', time: '13:30' },
  { id: 'once', name: 'Once', time: '18:00' },
  { id: 'cena', name: 'Cena', time: '21:00' },
  { id: 'colacion', name: 'Colación', time: '11:00' },
];

/** Comidas del día según cuántas se hacen (orden cronológico). */
export function mealsForCount(n: number) {
  const pick: Record<number, string[]> = {
    3: ['desayuno', 'almuerzo', 'cena'],
    4: ['desayuno', 'almuerzo', 'once', 'cena'],
    5: ['desayuno', 'colacion', 'almuerzo', 'once', 'cena'],
    6: ['desayuno', 'colacion', 'almuerzo', 'once', 'cena', 'colacion-noche'],
  };
  const all = [...DEFAULT_MEALS, { id: 'colacion-noche', name: 'Colación nocturna', time: '22:30' }];
  return (pick[n] ?? pick[4]).map((id) => all.find((m) => m.id === id)!).sort((a, b) => a.time.localeCompare(b.time));
}

export function mealsFor(profile: Profile | undefined) {
  return profile?.prefs?.meals?.length ? profile.prefs.meals : mealsForCount(profile?.meals_per_day ?? 4);
}

export function phaseFor(phases: Phase[], date: string): Phase | undefined {
  return phases
    .filter((p) => !p.deleted_at && p.start_date <= date && (!p.end_date || p.end_date >= date))
    .sort((a, b) => b.start_date.localeCompare(a.start_date) || b.updated_at.localeCompare(a.updated_at))[0];
}

export function currentPhase(phases: Phase[], date: string): Phase | undefined {
  return phaseFor(phases, date) ?? phases.filter((p) => !p.deleted_at && p.status === 'activa').sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
}

export function activeMeso(mesos: Mesocycle[]): Mesocycle | undefined {
  return mesos.filter((m) => !m.deleted_at && m.status === 'activo').sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
}

export interface Totals { kcal: number; protein: number; carbs: number; fat: number; fiber: number }
export function totals(logs: FoodLog[]): Totals {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  for (const l of logs) {
    if (l.deleted_at) continue;
    t.kcal += l.kcal; t.protein += l.protein; t.carbs += l.carbs; t.fat += l.fat; t.fiber += l.fiber;
  }
  return t;
}

/** Última vez que se hizo un ejercicio (sesiones terminadas, la más reciente primero). */
export function lastPerformance(sessions: WorkoutSession[], exId: string, excludeId?: string): SessionExercise | null {
  const sorted = sessions
    .filter((s) => s.id !== excludeId && s.status === 'terminada' && !s.deleted_at)
    .sort((a, b) => b.started_at.localeCompare(a.started_at));
  for (const s of sorted) {
    const ex = s.exercises.find((e) => e.exId === exId && e.sets.some((x) => x.done));
    if (ex) return ex;
  }
  return null;
}

export function buildSessionExercise(cat: Catalog, sessions: WorkoutSession[], plan: Routine['days'][number]['exercises'][number], planned: Planned | null): SessionExercise & { hint?: string | null } {
  const ex = cat.exById.get(plan.exId);
  const inc = INCREMENT[ex?.e ?? 'otro'] ?? 2.5;
  const last = lastPerformance(sessions, plan.exId);
  const sug = suggestSets(plan, last, { increment: inc, rir: planned?.rir ?? null, deload: planned?.deload ?? false });
  return { uid: uid(), exId: plan.exId, group: plan.group ?? null, rest: plan.rest, note: sug.note ?? undefined, memo: plan.note || undefined, sets: sug.sets };
}

export function newSession(opts: {
  cat: Catalog; sessions: WorkoutSession[]; routine: Routine | null; meso: Mesocycle | null; dayIndex: number | null; date: string; planned: Planned | null; bodyweight: number | null;
}): Omit<WorkoutSession, 'user_id' | 'updated_at' | 'deleted_at'> {
  const day = opts.routine && opts.dayIndex != null ? opts.routine.days[opts.dayIndex] : null;
  const exercises = day ? day.exercises.map((p) => buildSessionExercise(opts.cat, opts.sessions, p, opts.planned)) : [];
  return {
    id: uid(), date: opts.date, routine_id: opts.routine?.id ?? null, mesocycle_id: opts.meso?.id ?? null,
    day_index: opts.dayIndex, day_name: day?.name ?? 'Entrenamiento libre', week: opts.planned?.week ?? null,
    started_at: nowISO(), ended_at: null, status: 'en_curso', bodyweight: opts.bodyweight, notes: null,
    exercises, volume_kg: 0, sets_done: 0, prs: [],
  };
}

/** Estado de cada día (para la racha y la semana en Inicio). El objetivo de cada día viene del targeter (ciclado). */
export function dayResults(opts: {
  from: string; to: string; meso: Mesocycle | undefined; logs: FoodLog[]; sessions: WorkoutSession[];
  target: (date: string) => { kcal: number; protein: number } | null;
}) {
  const byDate = new Map<string, FoodLog[]>();
  for (const l of opts.logs) {
    if (l.deleted_at) continue;
    if (!byDate.has(l.date)) byDate.set(l.date, []);
    byDate.get(l.date)!.push(l);
  }
  const trainedDates = new Set(opts.sessions.filter((s) => s.status === 'terminada' && !s.deleted_at).map((s) => s.date));
  const out: { date: string; ok: boolean; scheduled: boolean; trained: boolean; logged: boolean; kcal: number }[] = [];
  for (let d = opts.from; d <= opts.to; d = addDays(d, 1)) {
    const tg = opts.target(d);
    const dayLogs = byDate.get(d) ?? [];
    const t = totals(dayLogs);
    const scheduled = plannedFor(opts.meso, d) != null;
    const trained = trainedDates.has(d);
    const r = tg ? evaluateDay({ targetKcal: tg.kcal, targetProtein: tg.protein, kcal: t.kcal, protein: t.protein, logged: dayLogs.length > 0, scheduled, trained }) : { ok: false };
    out.push({ date: d, ok: r.ok, scheduled, trained, logged: dayLogs.length > 0, kcal: t.kcal });
  }
  return out;
}

export const fmt = (n: number, d = 0) => (Number.isFinite(n) ? n : 0).toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtKg = (n: number | null | undefined) => (n == null ? '–' : n.toLocaleString('es-CL', { maximumFractionDigits: 2 }));
