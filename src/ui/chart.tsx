// Gráfico de línea simple en SVG (peso, 1RM). Sin librerías: liviano y funciona sin señal.
import { daysBetween, shortDate } from '../core/dates';
import { fmt } from '../data/logic';

export interface Pt { date: string; y: number; line?: number }

export function LineChart({ points, unit = 'kg', height = 150, dots = true, decimals = 1 }: { points: Pt[]; unit?: string; height?: number; dots?: boolean; decimals?: number }) {
  if (points.length < 2) return <div className="empty" style={{ textAlign: 'center' }}>Faltan datos para el gráfico: se dibuja con 2 registros o más.</div>;
  const W = 320, H = height, L = 34, R = 8, T = 10, B = 22;
  const first = points[0].date, last = points[points.length - 1].date;
  const span = Math.max(1, daysBetween(first, last));
  const ys = points.flatMap((p) => (p.line != null ? [p.y, p.line] : [p.y]));
  let min = Math.min(...ys), max = Math.max(...ys);
  if (max - min < 1) { min -= 0.5; max += 0.5; }
  const pad = (max - min) * 0.1;
  min -= pad; max += pad;
  const x = (d: string) => L + (daysBetween(first, d) / span) * (W - L - R);
  const y = (v: number) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const linePts = points.filter((p) => p.line != null);
  const path = (arr: Pt[], key: 'y' | 'line') => arr.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p[key] as number).toFixed(1)}`).join(' ');
  const ticks = [max - pad, (max + min) / 2, min + pad];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Gráfico" style={{ display: 'block' }}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray="3 4" />
          <text x={L - 5} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--faint)">{fmt(t, decimals)}</text>
        </g>
      ))}
      {dots && points.map((p, i) => <circle key={i} cx={x(p.date)} cy={y(p.y)} r={linePts.length ? 2.6 : 3.2} fill={linePts.length ? 'var(--faint)' : 'var(--primary)'} />)}
      {!linePts.length && <path d={path(points, 'y')} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" />}
      {linePts.length > 1 && <path d={path(linePts, 'line')} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
      <text x={L} y={H - 6} fontSize="10" fill="var(--faint)">{shortDate(first)}</text>
      <text x={W - R} y={H - 6} fontSize="10" fill="var(--faint)" textAnchor="end">{shortDate(last)}</text>
      <text x={W - R} y={T + 2} fontSize="10" fill="var(--faint)" textAnchor="end">{unit}</text>
    </svg>
  );
}
