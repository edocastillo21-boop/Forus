import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { bmrMifflin, computePlan, paceOptions } from './plan';
import { e1rm, plates, detectPRs, sessionVolume } from './strength';
import { suggestSets } from './progression';
import { plannedFor, defaultRirPlan, buildSchedule } from './schedule';
import { movingAverage, weeklyRate } from './trend';
import { evaluateDay, streak } from './day';
import { TEMPLATES, templateToDays, allowedEquipment } from './templates';
import { addDays, weekday, ageFrom } from './dates';
import type { Mesocycle, RoutineExercise, SessionExercise, WorkoutSession } from '../data/types';

describe('energía y macros', () => {
  it('TMB Mifflin-St Jeor', () => {
    expect(bmrMifflin('m', 75, 178, 30)).toBeCloseTo(1717.5, 1);
    expect(bmrMifflin('f', 60, 165, 28)).toBeCloseTo(1330.25, 1);
  });
  it('plan de volumen cuadra kcal con macros', () => {
    const p = computePlan({ sex: 'm', age: 30, heightCm: 178, weightKg: 75, activity: 'moderado', goal: 'volumen', rateKgWeek: 0.25, sessionsPerWeek: 4, sessionMin: 60 });
    expect(p.protein).toBe(135);
    expect(p.delta).toBe(275);
    const fromMacros = p.protein * 4 + p.carbs * 4 + p.fat * 9;
    expect(Math.abs(fromMacros - p.kcal)).toBeLessThan(10);
    expect(p.kcal % 10).toBe(0);
  });
  it('respeta el piso de calorías', () => {
    const p = computePlan({ sex: 'f', age: 40, heightCm: 150, weightKg: 48, activity: 'sedentario', goal: 'definicion', rateKgWeek: -1, sessionsPerWeek: 2, sessionMin: 45 });
    expect(p.kcal).toBe(1200);
    expect(p.warnings.length).toBeGreaterThan(0);
  });
  it('con % de grasa alto la proteína usa peso de referencia menor', () => {
    const a = computePlan({ sex: 'm', age: 35, heightCm: 175, weightKg: 100, bodyFatPct: 32, goalWeightKg: 85, activity: 'ligero', goal: 'definicion', rateKgWeek: -0.7, sessionsPerWeek: 3, sessionMin: 60 });
    expect(a.protein).toBe(Math.round(85 * 2.2));
  });
  it('ritmos de definición en torno al 0,7 % del peso', () => {
    const [, rec] = paceOptions('definicion', 'intermedio', 80)!;
    expect(rec).toBeCloseTo(-0.55, 2);
  });
});

describe('fuerza', () => {
  it('1RM Epley', () => {
    expect(e1rm(82.5, 8)).toBe(104.5);
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(50, 20)).toBeNull();
  });
  it('calculadora de discos', () => {
    expect(plates(82.5).perSide).toEqual([25, 5, 1.25]);
    expect(plates(20).perSide).toEqual([]);
    expect(plates(101, 20).missing).toBe(1);
  });
  it('volumen y récords', () => {
    const ex = (kg: number, reps: number): SessionExercise => ({ uid: 'u', exId: 'sentadilla-barra', rest: 120, sets: [{ type: 'E', kg, reps, rir: 2, done: true }] });
    const mk = (id: string, e: SessionExercise): WorkoutSession => ({ id, user_id: 'x', updated_at: '', deleted_at: null, date: '2026-09-01', routine_id: null, mesocycle_id: null, day_index: null, day_name: '', week: null, started_at: '', ended_at: '', status: 'terminada', bodyweight: null, notes: null, exercises: [e], volume_kg: 0, sets_done: 0, prs: [] });
    const old = mk('a', ex(80, 8));
    const now = mk('b', ex(82.5, 8));
    expect(sessionVolume(now.exercises)).toEqual({ volume: 660, sets: 1 });
    const prs = detectPRs(now, [old, now]);
    expect(prs).toHaveLength(1);
    expect(prs[0].e1rm).toBe(104.5);
    expect(detectPRs(old, [old])).toHaveLength(0);
  });
});

describe('progresión', () => {
  const plan: RoutineExercise = { uid: 'p', exId: 'sentadilla-barra', rest: 150, sets: [{ type: 'C', repsMin: 5, repsMax: 8, rir: null }, ...Array.from({ length: 3 }, () => ({ type: 'E' as const, repsMin: 6, repsMax: 8, rir: 2 }))] };
  const last = (reps: number[], kg = 80): SessionExercise => ({ uid: 'l', exId: 'sentadilla-barra', rest: 150, sets: reps.map((r) => ({ type: 'E' as const, kg, reps: r, rir: 2, done: true })) });
  it('sube el peso al completar el tope del rango', () => {
    const s = suggestSets(plan, last([8, 8, 8]), { increment: 2.5, rir: 2, deload: false });
    const work = s.sets.filter((x) => x.type === 'E');
    expect(work.map((x) => x.kg)).toEqual([82.5, 82.5, 82.5]);
    expect(work.map((x) => x.reps)).toEqual([6, 6, 6]);
    expect(s.sets[0].type).toBe('C');
    expect(s.last).toContain('80 kg × 8 · 8 · 8');
  });
  it('mantiene el peso y busca +1 repetición', () => {
    const s = suggestSets(plan, last([8, 7, 6]), { increment: 2.5, rir: 2, deload: false });
    expect(s.sets.filter((x) => x.type === 'E').map((x) => x.reps)).toEqual([8, 8, 7]);
  });
  it('descarga: la mitad de las series y RIR 4', () => {
    const s = suggestSets(plan, last([8, 8, 8]), { increment: 2.5, rir: 2, deload: true });
    const work = s.sets.filter((x) => x.type === 'E');
    expect(work).toHaveLength(2);
    expect(work[0].rir).toBe(4);
    expect(work[0].kg).toBe(80);
  });
});

describe('calendario', () => {
  const meso: Mesocycle = { id: 'm', user_id: 'x', updated_at: '', deleted_at: null, routine_id: 'r', name: '', start_date: '2026-09-14', weeks: 6, deload_week: 6, rir_plan: defaultRirPlan(6, true), schedule: buildSchedule([0, 2, 4, 5], { days: [1, 2, 3, 4].map((i) => ({ id: String(i), name: '', exercises: [] })) }), status: 'activo' };
  it('plan de RIR con descarga', () => {
    expect(defaultRirPlan(6, true)).toEqual([3, 3, 2, 2, 1, 4]);
  });
  it('miércoles 30-09-2026 es semana 3, día 2 de la rutina', () => {
    expect(weekday('2026-09-30')).toBe(2);
    expect(plannedFor(meso, '2026-09-30')).toMatchObject({ dayIndex: 1, week: 3, deload: false, rir: 2 });
    expect(plannedFor(meso, '2026-09-29')).toBeNull();
    expect(plannedFor(meso, addDays('2026-09-14', 35))).toMatchObject({ week: 6, deload: true });
  });
});

describe('tendencia de peso', () => {
  it('promedio móvil y ritmo semanal', () => {
    const pts = Array.from({ length: 35 }, (_, i) => ({ date: addDays('2026-08-27', i), weight: 75 + (i * 0.25) / 7 }));
    const t = movingAverage(pts);
    expect(weeklyRate(t)).toBeCloseTo(0.25, 2);
  });
});

describe('día cumplido y racha', () => {
  it('evalúa kcal, proteína y entrenamiento', () => {
    expect(evaluateDay({ targetKcal: 3000, targetProtein: 135, kcal: 2800, protein: 125, logged: true, scheduled: true, trained: true }).ok).toBe(true);
    expect(evaluateDay({ targetKcal: 3000, targetProtein: 135, kcal: 2600, protein: 140, logged: true, scheduled: false, trained: false }).ok).toBe(false);
    expect(evaluateDay({ targetKcal: 3000, targetProtein: 135, kcal: 3000, protein: 140, logged: true, scheduled: true, trained: false }).ok).toBe(false);
  });
  it('racha hasta ayer', () => {
    const r = [{ date: '2026-09-27', ok: true }, { date: '2026-09-28', ok: true }, { date: '2026-09-29', ok: true }, { date: '2026-09-30', ok: false }];
    expect(streak(r, '2026-09-30')).toBe(3);
  });
  it('edad', () => { expect(ageFrom('1996-10-01', '2026-09-30')).toBe(29); });
});

describe('plantillas', () => {
  const catalog = JSON.parse(readFileSync(new URL('../../public/data/exercises.json', import.meta.url), 'utf8')) as { items: { id: string; e: string }[] };
  const equip = new Map(catalog.items.map((e) => [e.id, e.e]));
  it('todas las alternativas existen en la biblioteca', () => {
    for (const t of TEMPLATES) for (const d of t.plan) for (const [alts] of d.slots) for (const a of alts.split('|')) expect(equip.has(a), `${t.id}: ${a}`).toBe(true);
  });
  it('con solo mancuernas no aparecen ejercicios con barra', () => {
    const allowed = allowedEquipment(['mancuernas']);
    for (const t of TEMPLATES) {
      const days = templateToDays(t, allowed, (id) => equip.get(id));
      for (const d of days) for (const ex of d.exercises) expect(allowed.has(equip.get(ex.exId)!), ex.exId).toBe(true);
    }
  });
});
