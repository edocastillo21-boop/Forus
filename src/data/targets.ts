// Objetivo nutricional de cada fecha = fase activa + lo que entrenas ese día (ciclado de carbohidratos).
// Pasado: manda lo que hiciste (sesión registrada o descanso). Hoy y futuro: manda el calendario,
// salvo que ya hayas entrenado. Así, si mueves un entrenamiento, cambian las dos fechas.
import { useMemo } from 'react';
import type { Catalog } from './catalog';
import type { Mesocycle, Phase, Routine, WorkoutSession } from './types';
import { activeMeso, currentPhase, phaseFor } from './logic';
import { useMesocycles, usePhases, useRoutines, useSessions, useWeights } from './hooks';
import { useApp } from './app';
import { DELOAD_FACTOR, KIND_INFO, classifyDay, cycleInfo, cycledDay, minCarbsFor, weekKindsFrom, weekMean, type CycleInfo, type DayKind, type Macros } from '../core/cycling';
import { plannedFor } from '../core/schedule';
import { addDays } from '../core/dates';

export interface DayTarget extends Macros {
  date: string;
  phase: Phase;
  /** Objetivo promedio de la fase (sin ciclado). */
  base: Macros;
  kind: DayKind;
  dayName: string | null;
  deload: boolean;
  /** De dónde sale el tipo de día. */
  from: 'sesion' | 'plan' | 'descanso';
  /** Gramos de carbohidratos respecto del promedio. */
  delta: number;
  cycled: boolean;
  /** Intensidad del ciclado y por qué (según el objetivo y las calorías). */
  cycle: CycleInfo;
  training: boolean;
  trainingTime: string | null;
  water: number;
}

export interface TargetCtx {
  phases: Phase[]; mesos: Mesocycle[]; routines: Routine[]; sessions: WorkoutSession[]; cat: Catalog;
  today: string; weightKg: number; waterGoal: number; trainingTime: string | null;
}

export type Targeter = (date: string) => DayTarget | null;

const hhmm = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const doneSets = (s: WorkoutSession) => s.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0);

export function makeTargeter(c: TargetCtx): Targeter {
  const routineById = new Map(c.routines.map((r) => [r.id, r]));
  const lookup = (id: string) => c.cat.exById.get(id);
  const kindsCache = new Map<string, DayKind[]>();
  const routineKinds = (r: Routine) => {
    let k = kindsCache.get(r.id);
    if (!k) { k = r.days.map((d) => classifyDay(d.exercises, lookup)); kindsCache.set(r.id, k); }
    return k;
  };
  const active = activeMeso(c.mesos);
  const mesos = c.mesos.filter((m) => !m.deleted_at).sort((a, b) => b.start_date.localeCompare(a.start_date));
  const mesoAt = (date: string) => (date >= c.today ? active : mesos.find((m) => m.start_date <= date));
  const byDate = new Map<string, WorkoutSession>();
  for (const s of c.sessions) {
    if (s.deleted_at || s.status === 'descartada') continue;
    const cur = byDate.get(s.date);
    if (!cur || doneSets(s) > doneSets(cur)) byDate.set(s.date, s);
  }
  const minCarbs = minCarbsFor(c.weightKg);
  const cache = new Map<string, DayTarget | null>();

  return (date: string) => {
    if (cache.has(date)) return cache.get(date)!;
    const phase = date < c.today ? phaseFor(c.phases, date) : currentPhase(c.phases, date);
    if (!phase) { cache.set(date, null); return null; }
    const base: Macros = { kcal: phase.kcal, protein: phase.protein_g, carbs: phase.carbs_g, fat: phase.fat_g };
    const meso = mesoAt(date);
    const routine = meso ? routineById.get(meso.routine_id) : undefined;
    const kinds = routine ? routineKinds(routine) : [];
    const mean = meso && routine ? weekMean(weekKindsFrom(meso.schedule, kinds)) : 0;

    let kind: DayKind = 'descanso';
    let from: DayTarget['from'] = 'descanso';
    let dayName: string | null = null;
    let deload = false;
    let trainingTime: string | null = null;
    const s = byDate.get(date);
    if (s) {
      const ex = s.status === 'terminada' ? s.exercises.map((e) => ({ exId: e.exId, sets: e.sets.filter((x) => x.done) })) : s.exercises;
      kind = classifyDay(ex, lookup);
      from = 'sesion';
      dayName = s.day_name;
      deload = !!meso && s.mesocycle_id === meso.id && s.week != null && s.week === meso.deload_week;
      trainingTime = hhmm(s.started_at);
    } else if (date >= c.today && routine) {
      const p = plannedFor(active, date);
      if (p) {
        kind = kinds[p.dayIndex] ?? 'torso';
        from = 'plan';
        dayName = routine.days[p.dayIndex]?.name ?? null;
        deload = p.deload;
        trainingTime = c.trainingTime;
      }
    }

    const factor = KIND_INFO[kind].factor * (deload ? DELOAD_FACTOR : 1);
    const cycle = cycleInfo(phase.type, base.carbs, minCarbs, mean);
    const scale = phase.cycling ? cycle.scale : 0;
    const d = cycledDay(base, factor, mean, scale);
    const training = kind !== 'descanso';
    const t: DayTarget = {
      ...d, date, phase, base, kind, dayName, deload, from, cycled: scale > 0, cycle, training, trainingTime,
      water: c.waterGoal + (training ? 500 : 0),
    };
    cache.set(date, t);
    return t;
  };
}

/** Targeter con los datos del usuario, para usar en pantallas. */
export function useTargets(today: string): Targeter {
  const { cat, profile } = useApp();
  const phases = usePhases();
  const mesos = useMesocycles();
  const routines = useRoutines();
  const sessions = useSessions();
  const weights = useWeights();
  const weightKg = weights[weights.length - 1]?.weight_kg ?? phases[0]?.start_weight ?? 70;
  return useMemo(
    () => makeTargeter({ phases, mesos, routines, sessions, cat, today, weightKg, waterGoal: profile.prefs?.waterGoal ?? 2500, trainingTime: profile.training_time || null }),
    [phases, mesos, routines, sessions, cat, today, weightKg, profile.prefs?.waterGoal, profile.training_time],
  );
}

/** Los 7 objetivos de la semana que empieza en `monday`. */
export function weekTargets(t: Targeter, monday: string): (DayTarget | null)[] {
  return Array.from({ length: 7 }, (_, i) => t(addDays(monday, i)));
}
