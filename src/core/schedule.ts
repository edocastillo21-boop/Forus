// Calendario de entrenamiento a partir del mesociclo activo.
import type { Mesocycle, Routine } from '../data/types';
import { daysBetween, startOfWeek, weekday } from './dates';

export interface Planned { dayIndex: number; week: number; deload: boolean; rir: number | null; ended: boolean }

export function weekOf(meso: Mesocycle, date: string): number {
  return Math.floor(daysBetween(startOfWeek(meso.start_date), date) / 7) + 1;
}

/** Qué día de la rutina toca en `date` (null = descanso). Al terminar el mesociclo, el ciclo se repite. */
export function plannedFor(meso: Mesocycle | null | undefined, date: string): Planned | null {
  if (!meso || meso.deleted_at || meso.status !== 'activo' || date < meso.start_date) return null;
  const idx = meso.schedule[String(weekday(date))];
  if (idx == null) return null;
  const raw = weekOf(meso, date);
  const week = ((raw - 1) % meso.weeks) + 1;
  return { dayIndex: idx, week, deload: meso.deload_week === week, rir: meso.rir_plan[week - 1] ?? null, ended: raw > meso.weeks };
}

/** Plan de RIR por semana: baja hacia el fallo y termina con una semana de descarga. */
export function defaultRirPlan(weeks: number, deload: boolean): number[] {
  const work = deload ? weeks - 1 : weeks;
  const plan: number[] = [];
  for (let i = 0; i < work; i++) plan.push(Math.max(1, 3 - Math.floor((i * 3) / Math.max(1, work))));
  if (deload) plan.push(4);
  return plan;
}

/** Reparte los días de la rutina entre los días de la semana elegidos (en orden, cíclico). */
export function buildSchedule(trainingDays: number[], routine: Pick<Routine, 'days'>): Record<string, number> {
  const out: Record<string, number> = {};
  const days = [...trainingDays].sort((a, b) => a - b);
  days.forEach((d, i) => { out[String(d)] = i % Math.max(1, routine.days.length); });
  return out;
}

/** Datos de la semana actual del mesociclo para entrenar un día elegido a mano (p. ej. en un día de descanso). */
export function plannedForDay(meso: Mesocycle, date: string, dayIndex: number): Planned {
  const raw = Math.max(1, weekOf(meso, date));
  const week = ((raw - 1) % meso.weeks) + 1;
  return { dayIndex, week, deload: meso.deload_week === week, rir: meso.rir_plan[week - 1] ?? null, ended: raw > meso.weeks };
}

/** Día de la rutina que sigue al último entrenado (para sugerir en días libres). */
export function nextDayIndex(routineDays: number, lastDayIndex: number | null | undefined): number {
  if (!routineDays) return 0;
  return lastDayIndex == null ? 0 : (lastDayIndex + 1) % routineDays;
}
