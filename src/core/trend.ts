// Tendencia del peso: promedio móvil de 7 días y ritmo semanal.
import { addDays, daysBetween } from './dates';

export interface WeightPoint { date: string; weight: number }
export interface TrendPoint extends WeightPoint { avg: number }

export function movingAverage(points: WeightPoint[], days = 7): TrendPoint[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((p) => {
    const from = addDays(p.date, -(days - 1));
    const win = sorted.filter((q) => q.date >= from && q.date <= p.date);
    return { ...p, avg: win.reduce((a, q) => a + q.weight, 0) / win.length };
  });
}

/** Ritmo en kg/semana entre el promedio más reciente y el de ~4 semanas antes (mínimo 10 días de datos). */
export function weeklyRate(trend: TrendPoint[], spanDays = 28): number | null {
  if (trend.length < 4) return null;
  const last = trend[trend.length - 1];
  const target = addDays(last.date, -spanDays);
  let base = trend[0];
  for (const p of trend) if (p.date <= target) base = p;
  const days = daysBetween(base.date, last.date);
  if (days < 10) return null;
  return ((last.avg - base.avg) / days) * 7;
}
