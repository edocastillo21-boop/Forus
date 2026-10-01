// Medidas corporales y % de grasa estimado (fórmula de la Marina de EE. UU., en cm).
import type { Sex } from '../data/types';

export type MeasureKey = 'waist' | 'hip' | 'chest' | 'arm' | 'thigh' | 'neck';

export const MEASURES: { key: MeasureKey; label: string; how: string }[] = [
  { key: 'waist', label: 'Cintura', how: 'A la altura del ombligo, relajado y al final de una exhalación' },
  { key: 'hip', label: 'Cadera', how: 'En la parte más ancha de los glúteos, pies juntos' },
  { key: 'chest', label: 'Pecho', how: 'A la altura de los pezones, brazos abajo' },
  { key: 'arm', label: 'Brazo', how: 'En la parte más gruesa del bíceps, contraído' },
  { key: 'thigh', label: 'Muslo', how: 'En la parte más gruesa, a media distancia entre cadera y rodilla' },
  { key: 'neck', label: 'Cuello', how: 'Justo bajo la nuez, cinta horizontal' },
];

/** % de grasa con la fórmula de la Marina (error típico ±3–4 puntos; útil para ver la tendencia). */
export function navyBodyFat(sex: Sex, heightCm: number, m: { waist?: number | null; neck?: number | null; hip?: number | null }): number | null {
  const { waist, neck, hip } = m;
  if (!waist || !neck || !heightCm) return null;
  let bf: number;
  if (sex === 'm') {
    if (waist - neck <= 0) return null;
    bf = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(heightCm)) - 450;
  } else {
    if (!hip || waist + hip - neck <= 0) return null;
    bf = 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.221 * Math.log10(heightCm)) - 450;
  }
  return bf > 2 && bf < 70 ? Math.round(bf * 10) / 10 : null;
}
