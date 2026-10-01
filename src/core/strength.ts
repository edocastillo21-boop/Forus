// Fuerza: 1RM estimado, calculadora de discos, volumen y récords.
import type { PR, SessionExercise, SetLog, WorkoutSession } from '../data/types';

/** 1RM estimado con Epley. Solo es fiable hasta ~12 repeticiones. */
export function e1rm(kg: number, reps: number): number | null {
  if (!kg || !reps || reps < 1 || reps > 12) return null;
  if (reps === 1) return kg;
  return Math.round(kg * (1 + reps / 30) * 10) / 10;
}

/** 1RM estimado con Brzycki (alternativa). */
export function e1rmBrzycki(kg: number, reps: number): number | null {
  if (!kg || !reps || reps < 1 || reps > 12) return null;
  return Math.round(((kg * 36) / (37 - reps)) * 10) / 10;
}

export const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

export interface PlateResult { perSide: number[]; loaded: number; missing: number }

/** Discos por lado para llegar a `total` con una barra de `bar` kg (algoritmo voraz). */
export function plates(total: number, bar = 20, available: number[] = DEFAULT_PLATES): PlateResult {
  const sorted = [...available].sort((a, b) => b - a);
  let side = Math.max(0, (total - bar) / 2);
  const perSide: number[] = [];
  for (const p of sorted) {
    while (side >= p - 1e-9) {
      perSide.push(p);
      side = Math.round((side - p) * 1000) / 1000;
    }
  }
  const loaded = bar + perSide.reduce((a, b) => a + b, 0) * 2;
  return { perSide, loaded, missing: Math.round((total - loaded) * 100) / 100 };
}

export const isWorkSet = (s: SetLog) => s.type !== 'C';

export function sessionVolume(exs: SessionExercise[]): { volume: number; sets: number } {
  let volume = 0;
  let sets = 0;
  for (const ex of exs) {
    for (const s of ex.sets) {
      if (!s.done || s.failed) continue;
      if (isWorkSet(s)) sets++;
      if (isWorkSet(s) && s.kg && s.reps) volume += s.kg * s.reps;
    }
  }
  return { volume: Math.round(volume), sets };
}

export function bestE1rm(ex: SessionExercise): { e1rm: number; kg: number; reps: number } | null {
  let best: { e1rm: number; kg: number; reps: number } | null = null;
  for (const s of ex.sets) {
    if (!s.done || s.failed || !isWorkSet(s) || !s.kg || !s.reps) continue;
    const v = e1rm(s.kg, s.reps);
    if (v != null && (!best || v > best.e1rm)) best = { e1rm: v, kg: s.kg, reps: s.reps };
  }
  return best;
}

/** Mejor 1RM estimado histórico por ejercicio (sesiones terminadas, excluyendo `exceptId`). */
export function historicBest(sessions: WorkoutSession[], exceptId?: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of sessions) {
    if (s.id === exceptId || s.status !== 'terminada' || s.deleted_at) continue;
    for (const ex of s.exercises) {
      const b = bestE1rm(ex);
      if (b && b.e1rm > (map.get(ex.exId) ?? 0)) map.set(ex.exId, b.e1rm);
    }
  }
  return map;
}

/** Récords de una sesión respecto al historial. Un primer registro no cuenta como récord. */
export function detectPRs(session: WorkoutSession, history: WorkoutSession[]): PR[] {
  const prev = historicBest(history, session.id);
  const prs: PR[] = [];
  for (const ex of session.exercises) {
    const b = bestE1rm(ex);
    if (!b) continue;
    const before = prev.get(ex.exId);
    if (before != null && b.e1rm > before + 0.05) prs.push({ exId: ex.exId, e1rm: b.e1rm, prev: before, kg: b.kg, reps: b.reps });
  }
  return prs;
}
