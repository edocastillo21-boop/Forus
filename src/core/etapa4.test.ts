import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { GOAL_AMPLITUDE, KIND_INFO, classifyDay, cycleInfo, cycleScale, cycledDay, kindPreview, minCarbsFor, weekKindsFrom, weekMean, type DayKind } from './cycling';
import { mealTargets, periMeals } from './meals';
import { reviewAnchor, slopePerWeek, weeklyReview, type ReviewInput } from './review';
import { navyBodyFat } from './body';
import { TEMPLATES, routineFromTemplate } from './templates';
import { buildSchedule } from './schedule';
import { addDays } from './dates';

const catalog = JSON.parse(readFileSync(new URL('../../public/data/exercises.json', import.meta.url), 'utf8')) as { items: { id: string; e: string; m: string[] }[] };
const byId = new Map(catalog.items.map((e) => [e.id, e]));
const lookup = (id: string) => byId.get(id);
const ALL_EQ = new Set(['barra', 'mancuerna', 'polea', 'maquina', 'smith', 'corporal', 'kettlebell', 'ez', 'banda', 'otro']);

describe('tipo de día', () => {
  it('Torso-Pierna: torso, pierna, torso, pierna', () => {
    const tpl = TEMPLATES.find((t) => t.id === 'torso-pierna')!;
    const r = routineFromTemplate(tpl, ALL_EQ, (id) => byId.get(id)?.e, 4);
    expect(r.days.map((d) => classifyDay(d.exercises, lookup))).toEqual(['torso', 'pierna', 'torso', 'pierna']);
  });
  it('Full Body se reconoce como cuerpo completo', () => {
    const tpl = TEMPLATES.find((t) => t.id === 'full-body')!;
    const r = routineFromTemplate(tpl, ALL_EQ, (id) => byId.get(id)?.e, 3);
    for (const d of r.days) expect(classifyDay(d.exercises, lookup)).toBe('full');
  });
  it('los calentamientos no cuentan', () => {
    const ex = [{ exId: 'sentadilla-barra', sets: [{ type: 'C' }, { type: 'C' }, { type: 'C' }] }, { exId: 'press-banca', sets: [{ type: 'E' }] }];
    expect(classifyDay(ex, lookup)).toBe('torso');
  });
});

describe('ciclado de carbohidratos', () => {
  const base = { kcal: 2710, protein: 141, carbs: 368, fat: 75 };
  // Torso-Pierna lunes, martes, jueves y viernes.
  const week: DayKind[] = ['torso', 'pierna', 'descanso', 'torso', 'pierna', 'descanso', 'descanso'];
  const mean = weekMean(week);
  const scale = cycleScale('definicion', base.carbs, minCarbsFor(78), mean);

  it('el promedio semanal se mantiene (±5 g de carbohidratos por redondeo)', () => {
    const days = week.map((k) => cycledDay(base, KIND_INFO[k].factor, mean, scale));
    const avgCarbs = days.reduce((a, d) => a + d.carbs, 0) / 7;
    expect(Math.abs(avgCarbs - base.carbs)).toBeLessThanOrEqual(5);
    const avgKcal = days.reduce((a, d) => a + d.kcal, 0) / 7;
    expect(Math.abs(avgKcal - base.kcal)).toBeLessThanOrEqual(20);
  });
  it('pierna > torso > descanso; proteína y grasa no cambian', () => {
    const [p, t, r] = (['pierna', 'torso', 'descanso'] as DayKind[]).map((k) => cycledDay(base, KIND_INFO[k].factor, mean, scale));
    expect(p.kcal).toBeGreaterThan(t.kcal);
    expect(t.kcal).toBeGreaterThan(r.kcal);
    expect(p.protein).toBe(141);
    expect(r.fat).toBe(75);
    expect(p.delta).toBeGreaterThanOrEqual(60); // ~ +20 % de carbohidratos en pierna
    expect(r.carbs).toBeGreaterThanOrEqual(minCarbsFor(78));
  });
  it('la intensidad depende del objetivo: volumen suave, recomposición marcada', () => {
    const pierna = (g: 'volumen' | 'definicion' | 'recomposicion') => cycledDay(base, 1, mean, cycleScale(g, base.carbs, minCarbsFor(78), mean)).delta;
    expect(pierna('volumen')).toBeLessThan(pierna('definicion'));
    expect(pierna('definicion')).toBeLessThan(pierna('recomposicion'));
    expect(cycleInfo('volumen', 368, 117, mean).level).toBe('suave');
    expect(cycleInfo('recomposicion', 368, 117, mean).level).toBe('marcado');
  });
  it('con pocos carbohidratos la amplitud se achica para no bajar del piso', () => {
    const info = cycleInfo('recomposicion', 160, minCarbsFor(80), mean);
    expect(info.limit).toBe('achicado');
    expect(info.scale).toBeLessThan(GOAL_AMPLITUDE.recomposicion);
    const rest = cycledDay({ kcal: 1800, protein: 176, carbs: 160, fat: 60 }, 0, mean, info.scale);
    expect(rest.carbs).toBeGreaterThanOrEqual(minCarbsFor(80) - 5);
  });
  it('si las calorías no dan margen, no se aplica', () => {
    // 1.200 kcal en definición, 55 kg: ~104 g de carbohidratos y piso de 100 g
    const info = cycleInfo('definicion', 104, minCarbsFor(55), mean);
    expect(info.limit).toBe('carbos_bajos');
    expect(info.scale).toBe(0);
  });
  it('sin rutina no hay ciclado', () => {
    expect(cycleInfo('volumen', 368, 117, 0)).toMatchObject({ scale: 0, limit: 'sin_rutina' });
    expect(cycledDay(base, 1, 0, 0)).toEqual({ ...base, delta: 0 });
  });
  it('vista previa por tipo de día y calendario', () => {
    const kinds = weekKindsFrom(buildSchedule([0, 1, 3, 4], { days: [{}, {}, {}, {}] as never }), ['torso', 'pierna', 'torso', 'pierna']);
    expect(kinds).toEqual(week);
    expect(kindPreview('volumen', base, kinds, 78).rows.map((r) => r.kind)).toEqual(['pierna', 'torso', 'descanso']);
  });
});

describe('reparto por comida', () => {
  const meals = [
    { id: 'desayuno', name: 'Desayuno', time: '08:00' },
    { id: 'almuerzo', name: 'Almuerzo', time: '13:30' },
    { id: 'once', name: 'Once', time: '18:00' },
    { id: 'cena', name: 'Cena', time: '21:00' },
  ];
  const day = { kcal: 3000, protein: 141, carbs: 440, fat: 75 };
  it('detecta pre y post entreno', () => {
    expect(periMeals(meals, '19:00')).toEqual({ pre: 'once', post: 'cena' });
    expect(periMeals(meals, '07:00')).toEqual({ pre: null, post: 'desayuno' });
    expect(periMeals(meals, null)).toEqual({ pre: null, post: null });
  });
  it('la suma de las comidas da el total del día', () => {
    const m = mealTargets(day, meals, '19:00');
    const sum = (k: 'protein' | 'carbs' | 'fat') => m.reduce((a, x) => a + x[k], 0);
    expect(Math.abs(sum('protein') - 141)).toBeLessThanOrEqual(2);
    expect(Math.abs(sum('carbs') - 440)).toBeLessThanOrEqual(2);
    expect(Math.abs(sum('fat') - 75)).toBeLessThanOrEqual(2);
  });
  it('la comida post-entreno lleva más carbohidratos que sin entrenar', () => {
    const train = mealTargets(day, meals, '19:00').find((x) => x.id === 'cena')!;
    const rest = mealTargets(day, meals, null).find((x) => x.id === 'cena')!;
    expect(train.tag).toBe('post');
    expect(train.carbs).toBeGreaterThan(rest.carbs);
    expect(train.fat).toBeLessThan(rest.fat);
  });
});

describe('revisión semanal', () => {
  const sunday = '2026-10-18';
  it('se hace el domingo y vale hasta el sábado siguiente', () => {
    expect(reviewAnchor('2026-10-18')).toBe('2026-10-18');
    expect(reviewAnchor('2026-10-19')).toBe('2026-10-18');
    expect(reviewAnchor('2026-10-24')).toBe('2026-10-18');
    expect(reviewAnchor('2026-10-25')).toBe('2026-10-25');
  });
  const mk = (o: { rate: number; intake: number; weighEvery?: number; logEvery?: number; target?: number; noise?: boolean }): ReviewInput => {
    const weights: { date: string; weight: number }[] = [];
    const days: { date: string; kcal: number; target: number }[] = [];
    for (let i = 21; i >= 1; i--) {
      const date = addDays(sunday, -i);
      const k = 21 - i;
      if (k % (o.weighEvery ?? 1) === 0) weights.push({ date, weight: 78 + (o.rate / 7) * k + (o.noise === false ? 0 : k % 2 ? 0.15 : -0.15) });
      if (k % (o.logEvery ?? 1) === 0) days.push({ date, kcal: o.intake, target: o.target ?? 2710 });
    }
    return { anchor: sunday, blockStart: '2026-09-01', expectedRate: 0.25, goalWeight: null, currentKcal: 2710, floorKcal: 1500, weights, days };
  };
  it('pendiente en kg por semana', () => {
    const pts = [0, 7, 14].map((d, i) => ({ date: addDays('2026-01-01', d), weight: 80 + i * 0.3 }));
    expect(slopePerWeek(pts)).toBeCloseTo(0.3, 5);
  });
  it('sube poco con buena adherencia → propone +150 kcal', () => {
    // gasto real = 2.710 − 0,05 × 1.100 = 2.655; para +0,25 kg/sem hacen falta 2.930 → 75 % de +220 ≈ +150
    const r = weeklyReview(mk({ rate: 0.05, intake: 2710, noise: false }));
    expect(r.status).toBe('ajuste');
    expect(r.rate!).toBeCloseTo(0.05, 3);
    expect(r.tdee).toBe(2655);
    expect(r.delta).toBe(150);
    expect(r.newKcal).toBe(2860);
  });
  it('con el ruido diario del agua igual propone un ajuste razonable', () => {
    const r = weeklyReview(mk({ rate: 0.05, intake: 2710 }));
    expect(r.status).toBe('ajuste');
    expect(r.delta).toBeGreaterThanOrEqual(100);
    expect(r.delta).toBeLessThanOrEqual(200);
  });
  it('en línea → sin cambios', () => {
    expect(weeklyReview(mk({ rate: 0.24, intake: 2710 })).status).toBe('en_rango');
  });
  it('pocos pesajes → pide más datos', () => {
    const r = weeklyReview(mk({ rate: 0.05, intake: 2710, weighEvery: 4 }));
    expect(r.status).toBe('faltan_datos');
    expect(r.needWeighIns).toBe(8);
  });
  it('comió lejos del objetivo → primero cumplir', () => {
    expect(weeklyReview(mk({ rate: 0.05, intake: 2200 })).status).toBe('comer_objetivo');
  });
  it('el ajuste nunca supera 300 kcal', () => {
    const r = weeklyReview(mk({ rate: -0.6, intake: 2710 }));
    expect(r.delta).toBe(300);
  });
  it('fase recién empezada → aún no', () => {
    expect(weeklyReview({ ...mk({ rate: 0.05, intake: 2710 }), blockStart: addDays(sunday, -6) }).status).toBe('pronto');
  });
});

describe('% de grasa (Marina de EE. UU.)', () => {
  it('hombre 178 cm, cintura 85, cuello 38', () => {
    expect(navyBodyFat('m', 178, { waist: 85, neck: 38 })).toBeCloseTo(16.4, 0);
  });
  it('mujer necesita cadera', () => {
    expect(navyBodyFat('f', 165, { waist: 72, neck: 32 })).toBeNull();
    const bf = navyBodyFat('f', 165, { waist: 72, neck: 32, hip: 98 })!;
    expect(bf).toBeGreaterThan(20);
    expect(bf).toBeLessThan(32);
  });
});
