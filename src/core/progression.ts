// Progresión de cargas: sugiere peso y repeticiones de hoy según la sesión anterior (doble progresión).
import type { RoutineExercise, SessionExercise, SetLog } from '../data/types';

export const INCREMENT: Record<string, number> = {
  barra: 2.5, ez: 2.5, smith: 2.5, mancuerna: 2, kettlebell: 4, maquina: 5, polea: 2.5, corporal: 2.5, banda: 0, otro: 2.5,
};

const roundTo = (x: number, step: number) => (step > 0 ? Math.round(x / step) * step : Math.round(x * 2) / 2);
const fmtKg = (x: number) => x.toLocaleString('es-CL', { maximumFractionDigits: 2 });

export function describeSets(sets: SetLog[]): string | null {
  const work = sets.filter((s) => s.done && s.type !== 'C' && s.reps);
  if (!work.length) return null;
  const kgs = new Set(work.map((s) => s.kg ?? 0));
  const reps = work.map((s) => s.reps).join(' · ');
  const rirs = work.map((s) => s.rir).filter((r): r is number => r != null);
  const rir = rirs.length ? ` (RIR ${Math.round(rirs.reduce((a, b) => a + b, 0) / rirs.length)})` : '';
  if (kgs.size === 1) {
    const kg = [...kgs][0];
    return kg ? `${fmtKg(kg)} kg × ${reps}${rir}` : `${reps} reps${rir}`;
  }
  return work.map((s) => `${fmtKg(s.kg ?? 0)}×${s.reps}`).join(' · ') + rir;
}

export interface Suggestion { sets: SetLog[]; note: string | null; last: string | null }

export function suggestSets(
  plan: RoutineExercise,
  last: SessionExercise | null,
  opts: { increment: number; rir: number | null; deload: boolean },
): Suggestion {
  const planWork = plan.sets.filter((s) => s.type !== 'C');
  const planWarm = plan.sets.filter((s) => s.type === 'C');
  const ref = planWork[0] ?? { type: 'E' as const, repsMin: 8, repsMax: 12, rir: 2 };
  const rirTarget = opts.deload ? 4 : (opts.rir ?? ref.rir ?? null);
  const lastWork = last ? last.sets.filter((s) => s.done && s.type !== 'C' && s.reps && s.kg != null) : [];
  const lastText = last ? describeSets(last.sets) : null;

  let kg: number | null = ref.kg ?? null;
  let repsFor = (_i: number) => ref.repsMin;
  let note: string | null = null;

  if (lastWork.length) {
    const topKg = Math.max(...lastWork.map((s) => s.kg ?? 0));
    const atTop = lastWork.filter((s) => (s.kg ?? 0) === topKg);
    const failed = last!.sets.filter((s) => s.failed).length;
    const allAtMax = atTop.length >= planWork.length && atTop.every((s) => (s.reps ?? 0) >= ref.repsMax);
    kg = topKg;
    if (opts.deload) {
      note = 'Semana de descarga: la mitad de las series y lejos del fallo (RIR 4).';
    } else if (allAtMax && opts.increment > 0) {
      kg = roundTo(topKg + opts.increment, opts.increment);
      repsFor = () => ref.repsMin;
      note = `Sube a ${fmtKg(kg)} kg: completaste todas las series en el tope del rango (${ref.repsMax}).`;
    } else if (failed >= 2 || atTop.filter((s) => (s.reps ?? 0) < ref.repsMin).length >= 2) {
      repsFor = () => ref.repsMin;
      note = `Mantén ${fmtKg(topKg)} kg: la última vez quedaste bajo el rango. Prioriza la técnica.`;
    } else {
      const lastReps = atTop.map((s) => s.reps ?? ref.repsMin);
      repsFor = (i) => Math.min(ref.repsMax, (lastReps[i] ?? lastReps[lastReps.length - 1] ?? ref.repsMin) + 1);
      note = `Mantén ${fmtKg(topKg)} kg y busca una repetición más por serie (hasta ${ref.repsMax}).`;
    }
    if (topKg === 0) note = `Busca ${ref.repsMin}–${ref.repsMax} repeticiones; suma lastre cuando sea fácil.`;
  } else {
    note = `Primera vez: elige un peso con el que llegues a ${ref.repsMin}–${ref.repsMax} repeticiones${rirTarget != null ? ` dejando ${rirTarget} en reserva` : ''}.`;
  }

  const workCount = opts.deload ? Math.max(1, Math.ceil(planWork.length / 2)) : planWork.length;
  const sets: SetLog[] = [];
  for (const w of planWarm) {
    sets.push({
      type: 'C', kg: kg ? roundTo(kg * 0.6, opts.increment || 2.5) : null, reps: w.repsMin, rir: null, done: false,
      target: { kg: null, repsMin: w.repsMin, repsMax: w.repsMax, rir: null },
    });
  }
  for (let i = 0; i < workCount; i++) {
    const p = planWork[i] ?? ref;
    sets.push({
      type: p.type, kg, reps: opts.deload ? p.repsMin : repsFor(i), rir: rirTarget, done: false,
      target: { kg, repsMin: p.repsMin, repsMax: p.repsMax, rir: rirTarget },
    });
  }
  return { sets, note, last: lastText };
}
