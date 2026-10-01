// Fechas locales en formato AAAA-MM-DD (el "día" siempre es el del usuario, no UTC).

export const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(now = new Date()): string {
  return toISODate(now);
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86400000);
}

/** 0 = lunes … 6 = domingo */
export function weekday(s: string): number {
  return (parseISODate(s).getDay() + 6) % 7;
}

export function startOfWeek(s: string): string {
  return addDays(s, -weekday(s));
}

export function ageFrom(birth: string, today = todayISO()): number {
  const b = parseISODate(birth);
  const t = parseISODate(today);
  let age = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) age--;
  return age;
}

export const WEEKDAYS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const WEEKDAYS_3 = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function longDate(s: string): string {
  const d = parseISODate(s);
  const txt = d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

export function shortDate(s: string): string {
  return parseISODate(s).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }).replace('.', '');
}

export function relativeDay(s: string, today = todayISO()): string {
  const diff = daysBetween(today, s);
  if (diff === 0) return 'Hoy';
  if (diff === -1) return 'Ayer';
  if (diff === 1) return 'Mañana';
  return `${WEEKDAYS_3[weekday(s)]} ${shortDate(s)}`;
}
