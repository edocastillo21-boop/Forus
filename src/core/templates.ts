// Plantillas de rutina. Cada ejercicio indica alternativas en orden de preferencia,
// y se elige la primera compatible con el equipamiento del usuario.
import type { Level, Routine, RoutineDay, RoutineExercise, SetPlan } from '../data/types';

type Slot = [alts: string, sets: number, reps: string, rir: number, rest: number, extra?: { warm?: number; group?: string }];
interface TDay { name: string; slots: Slot[] }
export interface Template { id: string; name: string; split: string; days: number; level: string; description: string; plan: TDay[] }

const SQ = 'sentadilla-barra|sentadilla-smith|sentadilla-goblet|sentadilla-mancuernas|sentadilla-peso-corporal';
const BENCH = 'press-banca|press-mancuernas|press-maquina|flexiones';
const INC = 'press-mancuernas-inclinado|press-banca-inclinado|press-maquina-inclinado|flexiones-pies-elevados';
const ROW = 'remo-barra|remo-mancuernas|remo-sentado-polea|remo-invertido';
const ROW1 = 'remo-mancuerna|remo-kettlebell|remo-sentado-polea|remo-invertido';
const PULL = 'dominadas|jalon-pecho|dominadas-asistidas|remo-invertido';
const PULLDOWN = 'jalon-pecho|dominadas|dominadas-asistidas|remo-invertido';
const OHP = 'press-militar|press-hombro-mancuernas|press-hombro-maquina|press-hombro-kettlebell|flexiones-pies-elevados';
const DBOHP = 'press-hombro-mancuernas|press-militar|press-hombro-maquina|press-hombro-kettlebell|flexiones-pies-elevados';
const RDL = 'peso-muerto-rumano|peso-muerto-rumano-mancuernas|peso-muerto-una-pierna|puente-gluteo-1';
const DL = 'peso-muerto|peso-muerto-trap-bar|peso-muerto-rumano-mancuernas|swing-kettlebell';
const LEGPRESS = 'prensa|sentadilla-hack|bulgara|sentadilla-goblet';
const HACK = 'sentadilla-hack|prensa|sentadilla-frontal|bulgara';
const LUNGE = 'bulgara|estocada-mancuernas|estocada-caminando-corporal';
const HIP = 'hip-thrust|puente-gluteo|puente-gluteo-1';
const LEGCURL = 'curl-femoral-tumbado|curl-femoral-sentado|nordico|peso-muerto-una-pierna';
const LEGCURL2 = 'curl-femoral-sentado|curl-femoral-tumbado|nordico|peso-muerto-una-pierna';
const LEGEXT = 'extension-cuadriceps|sentadilla-sissy|bulgara';
const CALF = 'gemelos-pie-maquina|gemelos-smith|gemelos-mancuerna|gemelos-barra';
const CALF2 = 'gemelos-sentado|gemelos-prensa|gemelos-mancuerna';
const LAT = 'elevaciones-laterales|elevaciones-laterales-polea|separacion-banda';
const REAR = 'face-pull|pajaros|pec-deck-inverso|separacion-banda';
const FLY = 'pec-deck|cruce-poleas|aperturas-mancuernas|flexiones-abiertas';
const CURL = 'curl-barra|curl-ez|curl-mancuernas|curl-polea';
const CURL2 = 'curl-martillo|curl-mancuernas|curl-polea-cuerda';
const CURL3 = 'curl-inclinado|curl-predicador|curl-concentrado';
const TRI = 'extension-triceps-polea|extension-triceps-cuerda|extension-triceps-mancuerna|fondos-banco';
const TRI2 = 'press-frances|press-frances-mancuernas|extension-triceps-mancuerna|flexiones-diamante';
const TRI3 = 'extension-triceps-trasnuca-cuerda|extension-triceps-mancuerna|fondos-banco';
const ABS = 'crunch-polea|elevacion-piernas-colgado|crunch-maquina|crunch-inverso';
const ABS2 = 'elevacion-piernas-colgado|rueda-abdominal|crunch-inverso|plancha';
const DIP = 'fondos-pecho|fondos-maquina|flexiones-pies-elevados';
const SHRUG = 'encogimientos-mancuernas|encogimientos-barra|encogimientos-polea';

export const TEMPLATES: Template[] = [
  {
    id: 'full-body', name: 'Full Body', split: 'full_body', days: 3, level: 'Principiante e intermedio',
    description: 'Todo el cuerpo en cada sesión. Ideal con 2 o 3 días por semana.',
    plan: [
      { name: 'Full Body A', slots: [[SQ, 3, '6-8', 2, 150, { warm: 1 }], [BENCH, 3, '6-8', 2, 120], [ROW, 3, '8-10', 2, 120], [DBOHP, 2, '8-12', 2, 90], [LEGCURL, 2, '10-12', 2, 90], [ABS, 2, '10-15', 2, 60]] },
      { name: 'Full Body B', slots: [[RDL, 3, '8-10', 2, 120], [INC, 3, '8-12', 2, 120], [PULLDOWN, 3, '8-12', 2, 90], [LUNGE, 2, '10-12', 2, 90], [LAT, 2, '12-15', 2, 60], [CURL, 2, '10-12', 2, 60]] },
      { name: 'Full Body C', slots: [[LEGPRESS, 3, '10-12', 2, 120], [OHP, 3, '6-8', 2, 120], [ROW1, 3, '8-12', 2, 90], [HIP, 3, '8-12', 2, 90], [TRI, 2, '10-15', 2, 60], [ABS2, 2, '10-15', 2, 60]] },
    ],
  },
  {
    id: 'torso-pierna', name: 'Torso-Pierna', split: 'torso_pierna', days: 4, level: 'Todos los niveles',
    description: 'Dos días de torso y dos de pierna. El equilibrio clásico para 4 días.',
    plan: [
      { name: 'Torso A', slots: [[BENCH, 3, '6-8', 2, 150, { warm: 1 }], [ROW, 3, '6-8', 2, 120], [DBOHP, 3, '8-10', 2, 90], [PULLDOWN, 3, '8-12', 2, 90], [CURL, 2, '8-12', 2, 60], [TRI, 2, '10-12', 2, 60]] },
      { name: 'Pierna A', slots: [[SQ, 3, '6-8', 2, 150, { warm: 1 }], [RDL, 3, '8-10', 2, 120], [LEGPRESS, 3, '10-12', 2, 120], [LEGCURL2, 3, '12-15', 1, 0, { group: 'A' }], [LEGEXT, 3, '12-15', 1, 90, { group: 'A' }], [CALF, 4, '10-15', 2, 60]] },
      { name: 'Torso B', slots: [[INC, 3, '8-10', 2, 120, { warm: 1 }], [PULL, 3, '6-10', 2, 120], [ROW1, 3, '8-12', 2, 90], [LAT, 3, '12-15', 1, 60], [CURL2, 2, '10-12', 2, 60], [TRI2, 2, '10-12', 2, 60], [REAR, 2, '12-15', 1, 60]] },
      { name: 'Pierna B', slots: [[HIP, 3, '8-12', 2, 120, { warm: 1 }], [LUNGE, 3, '8-12', 2, 90], [HACK, 3, '10-12', 2, 120], [LEGCURL, 3, '10-12', 2, 90], [CALF2, 3, '12-15', 2, 60], [ABS, 3, '10-15', 2, 60]] },
    ],
  },
  {
    id: 'ppl', name: 'Push-Pull-Legs', split: 'ppl', days: 6, level: 'Intermedio y avanzado',
    description: 'Empuje, tirón y pierna. Se hace 2 veces por semana con 6 días, o 1 vez con 3.',
    plan: [
      { name: 'Push A', slots: [[BENCH, 3, '6-8', 2, 150, { warm: 1 }], [DBOHP, 3, '8-10', 2, 120], [INC, 3, '8-12', 2, 90], [LAT, 3, '12-15', 1, 60], [TRI, 3, '10-12', 2, 60]] },
      { name: 'Pull A', slots: [[PULL, 3, '6-10', 2, 150, { warm: 1 }], [ROW, 3, '8-10', 2, 120], [ROW1, 2, '10-12', 2, 90], [REAR, 3, '12-15', 1, 60], [CURL, 3, '8-12', 2, 60]] },
      { name: 'Legs A', slots: [[SQ, 3, '6-8', 2, 180, { warm: 1 }], [RDL, 3, '8-10', 2, 120], [LEGPRESS, 3, '10-12', 2, 120], [LEGCURL, 3, '10-12', 2, 90], [CALF, 4, '10-15', 2, 60]] },
      { name: 'Push B', slots: [[OHP, 3, '6-8', 2, 150, { warm: 1 }], [INC, 3, '8-10', 2, 120], [DIP, 3, '8-12', 2, 90], [FLY, 3, '12-15', 1, 60], [TRI2, 3, '10-12', 2, 60]] },
      { name: 'Pull B', slots: [[ROW, 3, '6-8', 2, 150, { warm: 1 }], [PULLDOWN, 3, '8-12', 2, 120], [SHRUG, 3, '10-12', 2, 60], [REAR, 3, '12-15', 1, 60], [CURL2, 3, '10-12', 2, 60]] },
      { name: 'Legs B', slots: [[DL, 3, '5-6', 2, 180, { warm: 1 }], [LUNGE, 3, '8-12', 2, 90], [LEGEXT, 3, '12-15', 1, 60], [LEGCURL2, 3, '12-15', 1, 60], [CALF2, 3, '12-15', 2, 60], [ABS, 3, '10-15', 2, 60]] },
    ],
  },
  {
    id: 'weider', name: 'Weider', split: 'weider', days: 5, level: 'Intermedio',
    description: 'Un grupo muscular por día. Clásico de gimnasio, con mucho volumen por sesión.',
    plan: [
      { name: 'Pecho', slots: [[BENCH, 4, '6-10', 2, 150, { warm: 1 }], [INC, 3, '8-12', 2, 120], [DIP, 3, '8-12', 2, 90], [FLY, 3, '12-15', 1, 60]] },
      { name: 'Espalda', slots: [[PULL, 4, '6-10', 2, 150, { warm: 1 }], [ROW, 3, '8-10', 2, 120], [ROW1, 3, '10-12', 2, 90], [PULLDOWN, 3, '10-12', 2, 90]] },
      { name: 'Piernas', slots: [[SQ, 4, '6-8', 2, 180, { warm: 1 }], [RDL, 3, '8-10', 2, 120], [LEGPRESS, 3, '10-12', 2, 120], [LEGCURL, 3, '10-12', 2, 90], [CALF, 4, '10-15', 2, 60]] },
      { name: 'Hombros', slots: [[OHP, 4, '6-10', 2, 150, { warm: 1 }], [LAT, 4, '12-15', 1, 60], [REAR, 3, '12-15', 1, 60], [SHRUG, 3, '10-12', 2, 60], [ABS, 3, '10-15', 2, 60]] },
      { name: 'Brazos', slots: [[CURL, 3, '8-12', 2, 90], [TRI2, 3, '8-12', 2, 90], [CURL3, 3, '10-12', 1, 60], [TRI, 3, '10-15', 1, 60], [CURL2, 2, '10-12', 1, 60], [TRI3, 2, '12-15', 1, 60]] },
    ],
  },
  {
    id: 'phul', name: 'PHUL', split: 'phul', days: 4, level: 'Intermedio y avanzado',
    description: 'Fuerza e hipertrofia: 2 días pesados (torso y pierna) y 2 días de más repeticiones.',
    plan: [
      { name: 'Torso fuerza', slots: [[BENCH, 4, '4-6', 2, 180, { warm: 1 }], [ROW, 4, '4-6', 2, 180], [OHP, 3, '5-8', 2, 150], [PULL, 3, '6-8', 2, 120], [CURL, 2, '6-10', 2, 90], [TRI2, 2, '6-10', 2, 90]] },
      { name: 'Pierna fuerza', slots: [[SQ, 4, '4-6', 2, 180, { warm: 1 }], [DL, 3, '4-6', 2, 180], [LEGPRESS, 3, '8-10', 2, 120], [LEGCURL, 3, '8-10', 2, 90], [CALF, 4, '8-10', 2, 60]] },
      { name: 'Torso hipertrofia', slots: [[INC, 4, '8-12', 2, 120], [FLY, 3, '10-15', 1, 60], [ROW1, 4, '8-12', 2, 90], [PULLDOWN, 3, '10-12', 2, 90], [LAT, 3, '12-15', 1, 60], [CURL2, 3, '10-12', 1, 60], [TRI, 3, '10-12', 1, 60]] },
      { name: 'Pierna hipertrofia', slots: [[HACK, 4, '8-12', 2, 120], [LUNGE, 3, '10-12', 2, 90], [LEGEXT, 3, '12-15', 1, 60], [LEGCURL2, 3, '12-15', 1, 60], [CALF2, 4, '12-15', 1, 60], [ABS, 3, '10-15', 2, 60]] },
    ],
  },
  {
    id: 'phat', name: 'PHAT', split: 'phat', days: 5, level: 'Intermedio y avanzado',
    description: 'Dos días de fuerza y tres de hipertrofia por grupos. Muy completo para 5 días.',
    plan: [
      { name: 'Torso fuerza', slots: [[ROW, 3, '3-5', 2, 180, { warm: 1 }], [PULL, 2, '6-10', 2, 150], [BENCH, 3, '3-5', 2, 180], [DIP, 2, '6-10', 2, 120], [OHP, 3, '6-10', 2, 120], [CURL, 3, '6-10', 2, 90], [TRI2, 3, '6-10', 2, 90]] },
      { name: 'Pierna fuerza', slots: [[SQ, 3, '3-5', 2, 180, { warm: 1 }], [HACK, 2, '6-10', 2, 150], [LEGEXT, 2, '6-10', 2, 90], [RDL, 3, '5-8', 2, 150], [LEGCURL, 2, '6-10', 2, 90], [CALF, 3, '6-10', 2, 60]] },
      { name: 'Espalda y hombros', slots: [[ROW, 4, '8-12', 2, 120], [PULLDOWN, 3, '8-12', 2, 90], [ROW1, 3, '12-15', 1, 90], [DBOHP, 3, '8-12', 2, 90], [LAT, 3, '12-20', 1, 60], [SHRUG, 2, '12-15', 1, 60]] },
      { name: 'Pierna hipertrofia', slots: [[SQ, 4, '8-12', 2, 150], [HACK, 3, '12-15', 2, 120], [LEGEXT, 3, '15-20', 1, 60], [LUNGE, 3, '10-12', 2, 90], [LEGCURL2, 3, '12-15', 1, 60], [CALF2, 4, '10-15', 1, 60]] },
      { name: 'Pecho y brazos', slots: [[INC, 4, '8-12', 2, 120], [BENCH, 3, '10-12', 2, 120], [FLY, 3, '12-15', 1, 60], [CURL3, 3, '8-12', 1, 60], [TRI, 3, '8-12', 1, 60], [CURL2, 2, '12-15', 1, 60], [TRI3, 2, '12-15', 1, 60]] },
    ],
  },
  {
    id: '5x5', name: '5x5', split: '5x5', days: 3, level: 'Principiante (fuerza)',
    description: 'Básicos con barra, 5 series de 5. Alterna A y B en días no consecutivos.',
    plan: [
      { name: '5x5 A', slots: [['sentadilla-barra|sentadilla-smith|sentadilla-goblet', 5, '5-5', 2, 180, { warm: 2 }], ['press-banca|press-mancuernas|press-maquina', 5, '5-5', 2, 180, { warm: 1 }], ['remo-barra|remo-mancuernas|remo-sentado-polea', 5, '5-5', 2, 150]] },
      { name: '5x5 B', slots: [['sentadilla-barra|sentadilla-smith|sentadilla-goblet', 5, '5-5', 2, 180, { warm: 2 }], ['press-militar|press-hombro-mancuernas|press-hombro-maquina', 5, '5-5', 2, 180, { warm: 1 }], ['peso-muerto|peso-muerto-trap-bar|peso-muerto-rumano-mancuernas', 1, '5-5', 2, 180, { warm: 2 }]] },
    ],
  },
];

export const EQUIPMENT_OPTIONS: [string, string, string[]][] = [
  ['gimnasio', 'Gimnasio completo', ['barra', 'mancuerna', 'polea', 'maquina', 'smith', 'corporal', 'kettlebell', 'ez', 'banda', 'otro']],
  ['mancuernas', 'Mancuernas', ['mancuerna']],
  ['barra', 'Barra y discos', ['barra', 'ez']],
  ['kettlebell', 'Kettlebells', ['kettlebell']],
  ['bandas', 'Bandas elásticas', ['banda']],
  ['corporal', 'Solo peso corporal', ['corporal']],
];

export function allowedEquipment(selected: string[]): Set<string> {
  const out = new Set<string>(['corporal']);
  for (const [id, , codes] of EQUIPMENT_OPTIONS) if (selected.includes(id)) codes.forEach((c) => out.add(c));
  return out;
}

export function suggestTemplate(days: number, level: Level): { template: Template; dayCount: number } {
  const t = (id: string) => TEMPLATES.find((x) => x.id === id)!;
  if (days <= 2) return { template: t('full-body'), dayCount: 2 };
  if (days === 3) return { template: t(level === 'principiante' ? 'full-body' : 'full-body'), dayCount: 3 };
  if (days === 4) return { template: t(level === 'avanzado' ? 'phul' : 'torso-pierna'), dayCount: 4 };
  if (days === 5) return { template: t(level === 'principiante' ? 'torso-pierna' : 'phat'), dayCount: level === 'principiante' ? 4 : 5 };
  return { template: t('ppl'), dayCount: 6 };
}

let counter = 0;
export const uid = () => (globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${counter++}-${Math.random().toString(16).slice(2)}`);

export function templateToDays(tpl: Template, allowed: Set<string>, exEquip: (id: string) => string | undefined, dayCount = tpl.plan.length): RoutineDay[] {
  const plan = tpl.plan.slice(0, Math.min(dayCount, tpl.plan.length));
  return plan.map((d) => ({
    id: uid(),
    name: d.name,
    exercises: d.slots
      .map(([alts, sets, reps, rir, rest, extra]): RoutineExercise | null => {
        const options = alts.split('|');
        const exId = options.find((o) => { const e = exEquip(o); return e != null && allowed.has(e); }) ?? null;
        if (!exId) return null;
        const [min, max] = reps.split('-').map(Number);
        const work: SetPlan[] = Array.from({ length: sets }, () => ({ type: 'E', repsMin: min, repsMax: max, rir }));
        const warm: SetPlan[] = Array.from({ length: extra?.warm ?? 0 }, () => ({ type: 'C', repsMin: 5, repsMax: 8, rir: null }));
        return { uid: uid(), exId, group: extra?.group ?? null, rest, sets: [...warm, ...work] };
      })
      .filter((x): x is RoutineExercise => x !== null),
  }));
}

export function routineFromTemplate(tpl: Template, allowed: Set<string>, exEquip: (id: string) => string | undefined, dayCount?: number): Pick<Routine, 'name' | 'split' | 'level' | 'days' | 'notes'> {
  const days = templateToDays(tpl, allowed, exEquip, dayCount);
  return { name: `${tpl.name}${dayCount && dayCount < tpl.plan.length ? ` · ${dayCount} días` : ''}`, split: tpl.split, level: tpl.level, days, notes: null };
}
