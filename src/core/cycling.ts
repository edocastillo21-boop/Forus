// Ciclado de carbohidratos: el objetivo de cada día depende de lo que entrenas.
// La proteína y la grasa no cambian; los carbohidratos suben en los días exigentes y bajan
// en los de descanso, de modo que el promedio de la semana planificada es el de la fase.
// La intensidad depende del objetivo de cada persona, y si sus calorías no dan margen, no se aplica.
import type { Goal } from '../data/types';

export type DayKind = 'descanso' | 'torso' | 'pierna' | 'full';

export const KIND_INFO: Record<DayKind, { label: string; short: string; factor: number; demand: 'alta' | 'media' | 'baja' }> = {
  pierna: { label: 'Día de pierna', short: 'Pierna', factor: 1, demand: 'alta' },
  full: { label: 'Día de cuerpo completo', short: 'Cuerpo completo', factor: 0.85, demand: 'alta' },
  torso: { label: 'Día de torso', short: 'Torso', factor: 0.6, demand: 'media' },
  descanso: { label: 'Día de descanso', short: 'Descanso', factor: 0, demand: 'baja' },
};

/**
 * Cuánto se mueven los carbohidratos según el objetivo (fracción de la distancia al promedio semanal de demanda):
 * - recomposición: marcado, para comer sobre el gasto al entrenar y bajo él al descansar;
 * - definición: medio, protege el rendimiento al entrenar y concentra el déficit en el descanso;
 * - mantención: medio-suave;
 * - volumen: suave, porque ya hay superávit todos los días.
 */
export const GOAL_AMPLITUDE: Record<Goal, number> = { recomposicion: 0.55, definicion: 0.45, mantencion: 0.35, volumen: 0.25 };
/** Bajo esta amplitud efectiva el ciclado no vale la pena (las calorías no dan margen) y no se aplica. */
export const MIN_SCALE = 0.12;
/** En la semana de descarga el entrenamiento pesa la mitad. */
export const DELOAD_FACTOR = 0.5;

const LEG = new Set(['cuadriceps', 'isquios', 'gluteos', 'gemelos', 'aductores', 'abductores']);

type MuscleLookup = (exId: string) => { m: string[] } | undefined;

/** Tipo de día según la proporción de series efectivas cuyo músculo principal es de pierna. */
export function classifyDay(exercises: { exId: string; sets: { type: string }[] }[], lookup: MuscleLookup): Exclude<DayKind, 'descanso'> {
  let leg = 0;
  let total = 0;
  for (const e of exercises) {
    const n = e.sets.filter((s) => s.type !== 'C').length;
    const info = lookup(e.exId);
    if (!info || !n) continue;
    total += n;
    if (info.m.some((m) => LEG.has(m))) leg += n;
  }
  if (!total) return 'torso';
  const share = leg / total;
  return share >= 0.6 ? 'pierna' : share <= 0.25 ? 'torso' : 'full';
}

/** Demanda promedio de una semana (7 días; los que faltan son descanso). */
export function weekMean(kinds: DayKind[]): number {
  return kinds.reduce((a, k) => a + KIND_INFO[k].factor, 0) / 7;
}

export type CycleLevel = 'suave' | 'medio' | 'marcado';
export const levelOf = (amplitude: number): CycleLevel => (amplitude >= 0.5 ? 'marcado' : amplitude >= 0.3 ? 'medio' : 'suave');

export interface CycleInfo {
  /** Amplitud que pide el objetivo. */
  amplitude: number;
  /** Amplitud que se usa (0 = sin ciclado). */
  scale: number;
  level: CycleLevel;
  /** Por qué no se aplica, o se aplica más suave de lo que pide el objetivo. */
  limit: 'sin_rutina' | 'carbos_bajos' | 'achicado' | null;
}

/**
 * Amplitud efectiva. Se achica si el día de descanso quedaría con menos carbohidratos que `minCarbs`
 * (un día sin entrenar tiene factor 0, así que es el más bajo posible). Si queda muy chica, no se aplica.
 */
export function cycleInfo(goal: Goal, baseCarbs: number, minCarbs: number, mean: number): CycleInfo {
  const amplitude = GOAL_AMPLITUDE[goal];
  const base = { amplitude, level: levelOf(amplitude) };
  if (mean <= 0) return { ...base, scale: 0, limit: 'sin_rutina' };
  const max = baseCarbs > minCarbs ? (1 - minCarbs / baseCarbs) / mean : 0;
  const scale = Math.min(amplitude, max);
  if (scale < MIN_SCALE) return { ...base, scale: 0, limit: 'carbos_bajos' };
  return { ...base, scale, level: levelOf(scale), limit: scale < amplitude ? 'achicado' : null };
}

export const cycleScale = (goal: Goal, baseCarbs: number, minCarbs: number, mean: number) => cycleInfo(goal, baseCarbs, minCarbs, mean).scale;

/** Piso de carbohidratos para un día de descanso: 1,5 g/kg y nunca menos de 100 g. */
export const minCarbsFor = (weightKg: number) => Math.max(100, Math.round(1.5 * weightKg));

export interface Macros { kcal: number; protein: number; carbs: number; fat: number }

const round5 = (x: number) => Math.round(x / 5) * 5;

/** Objetivo de un día con demanda `factor` dentro de una semana de demanda promedio `mean`. */
export function cycledDay(base: Macros, factor: number, mean: number, scale: number): Macros & { delta: number } {
  if (!scale) return { ...base, delta: 0 };
  const delta = round5(base.carbs * scale * (factor - mean));
  return { kcal: base.kcal + delta * 4, protein: base.protein, carbs: base.carbs + delta, fat: base.fat, delta };
}

/** Tipo de día por día de la semana (0 = lunes) a partir del calendario y los tipos de cada día de la rutina. */
export function weekKindsFrom(schedule: Record<string, number>, dayKinds: DayKind[]): DayKind[] {
  return Array.from({ length: 7 }, (_, wd) => {
    const idx = schedule[String(wd)];
    return idx == null ? 'descanso' : dayKinds[idx] ?? 'torso';
  });
}

/** Vista previa por tipo de día para una semana planificada de 7 días (onboarding y "Nueva fase"). */
export function kindPreview(goal: Goal, base: Macros, weekKinds: DayKind[], weightKg: number): { info: CycleInfo; rows: { kind: DayKind; macros: Macros & { delta: number } }[] } {
  const mean = weekMean(weekKinds);
  const info = cycleInfo(goal, base.carbs, minCarbsFor(weightKg), mean);
  const rows = (['pierna', 'full', 'torso', 'descanso'] as DayKind[])
    .filter((k) => weekKinds.includes(k))
    .map((kind) => ({ kind, macros: cycledDay(base, KIND_INFO[kind].factor, mean, info.scale) }));
  return { info, rows };
}

/** Explicación corta de la intensidad elegida. */
export function cycleText(goal: Goal, info: CycleInfo): string {
  if (info.limit === 'sin_rutina') return 'Se activa cuando tengas una rutina con calendario.';
  if (info.limit === 'carbos_bajos') return 'Con tus calorías no conviene: los días de descanso quedarían con muy pocos carbohidratos, así que comes lo mismo todos los días.';
  const why: Record<Goal, string> = {
    volumen: 'ya comes en superávit todos los días, así que basta un poco más de combustible al entrenar',
    definicion: 'protege tu rendimiento los días que entrenas y concentra el déficit en el descanso',
    recomposicion: 'comes sobre tu gasto los días de entrenamiento y bajo él al descansar',
    mantencion: 'acompaña lo que entrenas sin cambiar tu peso',
  };
  return `Ciclado ${info.level}${info.limit === 'achicado' ? ' (achicado por tus calorías)' : ''}: ${why[goal]}.`;
}
