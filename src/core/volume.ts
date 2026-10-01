// Series efectivas por grupo muscular (principal = 1, secundario = 0,5).
import type { WorkoutSession } from '../data/types';

export const MUSCLE_NAMES: Record<string, string> = {
  pecho: 'Pecho', dorsal: 'Dorsales', esp_media: 'Espalda media', lumbar: 'Lumbares', trapecio: 'Trapecio',
  delt_ant: 'Deltoide anterior', delt_lat: 'Deltoide lateral', delt_post: 'Deltoide posterior', biceps: 'Bíceps',
  triceps: 'Tríceps', antebrazo: 'Antebrazos', abdomen: 'Abdomen', cuadriceps: 'Cuádriceps', isquios: 'Isquiotibiales',
  gluteos: 'Glúteos', aductores: 'Aductores', abductores: 'Abductores', gemelos: 'Pantorrillas',
};

/** Grupos que se muestran en Progreso, con los músculos que suman a cada uno. */
export const VOLUME_GROUPS: [string, string[]][] = [
  ['Pecho', ['pecho']],
  ['Espalda', ['dorsal', 'esp_media']],
  ['Hombros', ['delt_ant', 'delt_lat', 'delt_post']],
  ['Bíceps', ['biceps']],
  ['Tríceps', ['triceps']],
  ['Cuádriceps', ['cuadriceps']],
  ['Isquiotibiales', ['isquios']],
  ['Glúteos', ['gluteos']],
  ['Pantorrillas', ['gemelos']],
  ['Abdomen', ['abdomen']],
];

export type MuscleLookup = (exId: string) => { m: string[]; s: string[] } | undefined;

export function weeklySets(sessions: WorkoutSession[], lookup: MuscleLookup): Map<string, number> {
  const perMuscle = new Map<string, number>();
  for (const s of sessions) {
    if (s.status !== 'terminada' || s.deleted_at) continue;
    for (const ex of s.exercises) {
      const info = lookup(ex.exId);
      if (!info) continue;
      const n = ex.sets.filter((x) => x.done && !x.failed && x.type !== 'C' && (x.rir == null || x.rir <= 4)).length;
      if (!n) continue;
      const seen = new Set<string>();
      for (const m of info.m) { perMuscle.set(m, (perMuscle.get(m) ?? 0) + n); seen.add(m); }
      for (const m of info.s) if (!seen.has(m)) perMuscle.set(m, (perMuscle.get(m) ?? 0) + n * 0.5);
    }
  }
  const groups = new Map<string, number>();
  for (const [name, muscles] of VOLUME_GROUPS) {
    // Para grupos con varios músculos se usa el que más series recibió (no se suman dos veces las mismas series).
    groups.set(name, Math.max(0, ...muscles.map((m) => perMuscle.get(m) ?? 0)));
  }
  return groups;
}
