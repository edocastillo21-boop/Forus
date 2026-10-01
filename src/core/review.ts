// Revisión semanal: compara el ritmo real del peso con el de la fase y, si hay datos suficientes,
// propone un ajuste de calorías calculado con lo que realmente comiste (balance energético).
import { addDays, daysBetween, weekday } from './dates';
import { KCAL_PER_KG } from './plan';

/** Día de la revisión: domingo (0 = lunes … 6 = domingo). */
export const REVIEW_WEEKDAY = 6;

/** Domingo de la revisión vigente: la tarjeta aparece ese día y queda hasta que decides (o hasta el domingo siguiente). */
export function reviewAnchor(today: string): string {
  return addDays(today, -((weekday(today) - REVIEW_WEEKDAY + 7) % 7));
}

export interface ReviewInput {
  /** Día de la revisión (domingo): se revisan los 14 días anteriores, sin contar ese día. */
  anchor: string;
  /** Inicio del bloque de la fase (no cambia con los ajustes). */
  blockStart: string;
  expectedRate: number;
  goalWeight: number | null;
  /** Objetivo promedio actual (kcal de la fase). */
  currentKcal: number;
  /** Mínimo seguro de calorías. */
  floorKcal: number;
  weights: { date: string; weight: number }[];
  /** Un registro por día con comida: lo comido y el objetivo de ese día. */
  days: { date: string; kcal: number; target: number }[];
}

export type ReviewStatus = 'pronto' | 'faltan_datos' | 'comer_objetivo' | 'en_rango' | 'ajuste' | 'meta';

export interface Review {
  status: ReviewStatus;
  from: string;
  to: string;
  days: number;
  weighIns: number;
  needWeighIns: number;
  loggedDays: number;
  needLogged: number;
  rate: number | null;
  expected: number;
  tolerance: number;
  weight: number | null;
  intake: number | null;
  targetAvg: number | null;
  tdee: number | null;
  delta: number;
  newKcal: number | null;
}

/** Fracción de la diferencia que se corrige de una vez (el resto se confirma la semana siguiente). */
export const DAMPING = 0.75;
export const MAX_STEP = 300;

/** Pendiente por mínimos cuadrados, en kg por semana. */
export function slopePerWeek(points: { date: string; weight: number }[]): number | null {
  if (points.length < 3) return null;
  const x0 = points[0].date;
  const xs = points.map((p) => daysBetween(x0, p.date));
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = points.reduce((a, p) => a + p.weight, 0) / points.length;
  let num = 0, den = 0;
  points.forEach((p, i) => { num += (xs[i] - mx) * (p.weight - my); den += (xs[i] - mx) ** 2; });
  return den ? (num / den) * 7 : null;
}

export function weeklyReview(i: ReviewInput): Review {
  const to = addDays(i.anchor, -1);
  const from = i.blockStart > addDays(to, -13) ? i.blockStart : addDays(to, -13);
  const days = daysBetween(from, to) + 1;
  const base: Review = {
    status: 'pronto', from, to, days, weighIns: 0, needWeighIns: Math.ceil((days * 4) / 7), loggedDays: 0, needLogged: Math.ceil((days * 5) / 7),
    rate: null, expected: i.expectedRate, tolerance: Math.max(0.1, Math.abs(i.expectedRate) * 0.3), weight: null, intake: null, targetAvg: null, tdee: null, delta: 0, newKcal: null,
  };
  if (days < 10) return base;

  const pts = i.weights.filter((w) => w.date >= from && w.date <= to).sort((a, b) => a.date.localeCompare(b.date));
  // Día registrado = al menos la mitad de su objetivo (un día a medio anotar no sirve para estimar el gasto).
  const logged = i.days.filter((d) => d.date >= from && d.date <= to && d.kcal >= d.target * 0.5);
  const r: Review = { ...base, weighIns: pts.length, loggedDays: logged.length };
  const recent = pts.slice(-4);
  r.weight = recent.length ? recent.reduce((a, p) => a + p.weight, 0) / recent.length : null;
  if (pts.length < r.needWeighIns || logged.length < r.needLogged) return { ...r, status: 'faltan_datos' };

  const rate = slopePerWeek(pts)!;
  const intake = logged.reduce((a, d) => a + d.kcal, 0) / logged.length;
  const targetAvg = logged.reduce((a, d) => a + d.target, 0) / logged.length;
  const tdee = intake - (rate * KCAL_PER_KG) / 7;
  Object.assign(r, { rate, intake: Math.round(intake), targetAvg: Math.round(targetAvg), tdee: Math.round(tdee) });

  if (i.goalWeight && r.weight != null && ((i.expectedRate > 0 && r.weight >= i.goalWeight) || (i.expectedRate < 0 && r.weight <= i.goalWeight))) {
    return { ...r, status: 'meta' };
  }
  if (Math.abs(intake - targetAvg) > targetAvg * 0.12) return { ...r, status: 'comer_objetivo' };
  if (Math.abs(rate - i.expectedRate) <= r.tolerance) return { ...r, status: 'en_rango' };

  const desired = tdee + (i.expectedRate * KCAL_PER_KG) / 7;
  let delta = Math.round(((desired - i.currentKcal) * DAMPING) / 50) * 50;
  delta = Math.max(-MAX_STEP, Math.min(MAX_STEP, delta));
  if (i.currentKcal + delta < i.floorKcal) delta = Math.min(0, Math.ceil((i.floorKcal - i.currentKcal) / 10) * 10);
  if (Math.abs(delta) < 50) return { ...r, status: 'en_rango' };
  return { ...r, status: 'ajuste', delta, newKcal: i.currentKcal + delta };
}
