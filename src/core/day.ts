// "Día cumplido": kcal dentro de ±10 % del objetivo, proteína ≥ 90 % y sesión registrada si tocaba entrenar.

export interface DayInput {
  targetKcal: number;
  targetProtein: number;
  kcal: number;
  protein: number;
  logged: boolean;
  scheduled: boolean;
  trained: boolean;
}

export interface DayResult { ok: boolean; kcalOk: boolean; proteinOk: boolean; trainOk: boolean }

export function evaluateDay(d: DayInput): DayResult {
  const kcalOk = d.logged && d.targetKcal > 0 && Math.abs(d.kcal - d.targetKcal) <= d.targetKcal * 0.1;
  const proteinOk = d.logged && d.protein >= d.targetProtein * 0.9;
  const trainOk = !d.scheduled || d.trained;
  return { ok: kcalOk && proteinOk && trainOk, kcalOk, proteinOk, trainOk };
}

/** Racha: días cumplidos consecutivos terminando ayer (hoy suma solo si ya está cumplido). */
export function streak(results: { date: string; ok: boolean }[], today: string): number {
  const byDate = new Map(results.map((r) => [r.date, r.ok]));
  let n = byDate.get(today) ? 1 : 0;
  const d = new Date(today + 'T12:00:00');
  for (;;) {
    d.setDate(d.getDate() - 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!byDate.get(key)) break;
    n++;
  }
  return n;
}
