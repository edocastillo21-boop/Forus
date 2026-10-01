import { describe, expect, it } from 'vitest';
import { mainFound, parseLabel, parseNum, type OcrWord } from './label';

/**
 * Arma las palabras de una tabla como las entrega el OCR. Cada fila es "celda | celda | …" y las celdas
 * van en las columnas `xs`. Con `split`, las etiquetas y los números salen en líneas separadas (como cuando
 * el OCR lee la tabla en dos bloques).
 */
function table(rows: string[], { xs = [0, 420, 560, 700], split = false, skew = 0 } = {}): OcrWord[][] {
  const lines: OcrWord[][] = [];
  rows.forEach((row, i) => {
    const cells = row.split('|').map((c) => c.trim());
    const words = cells.flatMap((cell, c) => {
      let x = xs[c];
      return cell.split(/\s+/).filter(Boolean).map((t) => {
        const y = i * 40 + x * skew;
        const w = { text: t, x0: x, y0: y, x1: x + t.length * 12, y1: y + 24, cell: c };
        x += t.length * 12 + 10;
        return w;
      });
    });
    if (split) {
      const a = words.filter((w) => w.cell === 0), b = words.filter((w) => w.cell > 0);
      if (a.length) lines.push(a);
      if (b.length) lines.push(b);
    } else lines.push(words);
  });
  return lines;
}

const NUTELLA = [
  'INFORMACIÓN NUTRICIONAL',
  'Porción: 2 cucharadas (15 g)',
  'Porciones por envase: aprox. 23',
  ' | 100 g | 1 porción',
  'Energía (kcal) | 539 | 81',
  'Proteínas (g) | 6,3 | 0,9',
  'Grasas totales (g) | 30,9 | 4,6',
  'Grasas saturadas (g) | 10,6 | 1,6',
  'Grasas trans (g) | 0,0 | 0,0',
  'Colesterol (mg) | 0 | 0',
  'H. de C. disponibles (g) | 57,5 | 8,6',
  'Azúcares totales (g) | 56,3 | 8,4',
  'Fibra dietética total (g) | 3,4 | 0,5',
  'Sodio (mg) | 41 | 6',
];

describe('parseNum', () => {
  it('lee decimales con coma o punto, unidades y letras confundidas', () => {
    expect(parseNum('6,3')).toMatchObject({ n: 6.3, unit: null });
    expect(parseNum('30,9g')).toMatchObject({ n: 30.9, unit: 'g' });
    expect(parseNum('<0,5')).toMatchObject({ n: 0.5 });
    expect(parseNum('O,9')).toMatchObject({ n: 0.9 });
    expect(parseNum('12%')).toMatchObject({ n: 12, pct: true });
    expect(parseNum('1.234')).toMatchObject({ n: 1.234, thousands: true });
    expect(parseNum('1.234,5')).toMatchObject({ n: 1234.5 });
    expect(parseNum('(g)')).toBeNull();
    expect(parseNum('(9)')).toBeNull();
    expect(parseNum('(0')).toBeNull();
    expect(parseNum('Sodio')).toBeNull();
  });
});

describe('parseLabel', () => {
  it('etiqueta chilena: toma la columna de 100 g y la porción', () => {
    const r = parseLabel(table(NUTELLA))!;
    expect(r).toMatchObject({ basis: '100', sure: true, portion: { name: '2 cucharadas', grams: 15 } });
    expect(r.values).toEqual({ kcal: 539, protein: 6.3, fat: 30.9, carbs: 57.5, sugar: 56.3, fiber: 3.4, sodium: 41 });
    expect(mainFound(r)).toBe(4);
  });

  it('porción con la "g" leída como "9"', () => {
    const rows = [...NUTELLA];
    rows[1] = 'Porción: 2 cucharadas (15 9)';
    expect(parseLabel(table(rows))!.portion).toEqual({ name: '2 cucharadas', grams: 15 });
  });

  it('columnas al revés ("1 porción | 100 g")', () => {
    const rows = NUTELLA.map((l) => { const c = l.split('|'); return c.length === 3 ? [c[0], c[2], c[1]].join('|') : l; });
    expect(parseLabel(table(rows))!.values).toMatchObject({ kcal: 539, protein: 6.3, carbs: 57.5 });
  });

  it('el OCR leyó la tabla en dos bloques y con la foto algo chueca', () => {
    expect(parseLabel(table(NUTELLA, { split: true, skew: 0.01 }))!.values).toMatchObject({ kcal: 539, fat: 30.9, sodium: 41 });
  });

  it('sin encabezados: decide la columna de 100 g con la porción', () => {
    const rows = NUTELLA.filter((l) => !l.includes('100 g')).map((l) => { const c = l.split('|'); return c.length === 3 ? [c[0], c[2], c[1]].join('|') : l; });
    const r = parseLabel(table(rows))!;
    expect(r).toMatchObject({ basis: '100', sure: true });
    expect(r.values).toMatchObject({ kcal: 539, protein: 6.3 });
  });

  it('errores típicos del OCR: coma perdida, decimal partido y O por 0', () => {
    const rows = [...NUTELLA];
    rows[6] = 'Grasas totales (g) | 30, 9 | 4,6';
    rows[10] = 'H. de C. disponibles (g) | 575 | 8,6';
    rows[5] = 'Proteinas (g) | 6,3 | O,9';
    expect(parseLabel(table(rows))!.values).toMatchObject({ fat: 30.9, carbs: 57.5, protein: 6.3 });
  });

  it('sin encabezados, "(g)" leído como "(9)" no se toma como valor', () => {
    const rows = ['Energía (kcal) | 539 | 81', 'Proteínas (9) | 6,3 | 0,9', 'Fibra dietética total (9) | 3,4 | 0,5', 'Grasas totales (0) | 30,9 | 4,6'];
    expect(parseLabel(table(rows))!.values).toMatchObject({ protein: 6.3, fiber: 3.4, fat: 30.9 });
  });

  it('coma perdida en un valor chico: la otra columna lo delata ("6,3" → "63", "3,4" → "34")', () => {
    const rows = [...NUTELLA];
    rows[5] = 'Proteínas (g) | 63 | 0,9';
    rows[12] = 'Fibra dietética total (g) | 34 | 0,5';
    expect(parseLabel(table(rows))!.values).toMatchObject({ protein: 6.3, fiber: 3.4, kcal: 539, carbs: 57.5 });
  });

  it('coma perdida con una sola columna: las kcal no calzan con los macros', () => {
    const rows = [' | 100 g', 'Energía (kcal) | 539', 'Proteínas (g) | 63', 'Grasas totales (g) | 30,9', 'H. de C. disponibles (g) | 57,5'];
    expect(parseLabel(table(rows))!.values).toMatchObject({ protein: 6.3, fat: 30.9, carbs: 57.5 });
  });

  it('etiqueta en dos líneas ("Hidratos de carbono" / "disponibles (g)")', () => {
    const rows = [' | 100 g | 1 porción', 'Energía (kcal) | 380 | 114', 'Hidratos de carbono', 'disponibles (g) | 75 | 22,5', 'Proteínas (g) | 8 | 2,4', 'Grasas totales (g) | 3 | 0,9'];
    expect(parseLabel(table(rows))!.values).toMatchObject({ kcal: 380, carbs: 75, protein: 8, fat: 3 });
  });

  it('etiqueta europea: kJ/kcal en la misma fila y sal en vez de sodio', () => {
    const rows = ['Información nutricional | Por 100 g | Por porción (30 g)', 'Valor energético | 2255 kJ / 539 kcal | 677 kJ / 162 kcal', 'Grasas | 30,9 g | 9,3 g', 'de las cuales saturadas | 10,6 g | 3,2 g', 'Hidratos de carbono | 57,5 g | 17,3 g', 'de los cuales azúcares | 56,3 g | 16,9 g', 'Proteínas | 6,3 g | 1,9 g', 'Sal | 0,107 g | 0,032 g'];
    const r = parseLabel(table(rows))!;
    expect(r.values).toMatchObject({ kcal: 539, fat: 30.9, carbs: 57.5, sugar: 56.3, protein: 6.3, sodium: 43 });
    expect(r.portion).toMatchObject({ grams: 30 });
  });

  it('etiqueta de EE. UU.: valores por porción, con % que se ignoran', () => {
    const rows = ['Nutrition Facts', 'Serving size 2/3 cup (55g)', 'Amount per serving', 'Calories | 230', 'Total Fat 8g | 10%', 'Saturated Fat 1g | 5%', 'Sodium 160mg | 7%', 'Total Carbohydrate 37g | 13%', 'Dietary Fiber 4g | 14%', 'Total Sugars 12g', 'Protein 3g'];
    const r = parseLabel(table(rows))!;
    expect(r).toMatchObject({ basis: 'porcion', portion: { grams: 55 } });
    expect(r.values).toMatchObject({ kcal: 230, fat: 8, sodium: 160, carbs: 37, fiber: 4, sugar: 12, protein: 3 });
  });

  it('sin tabla nutricional → null', () => {
    expect(parseLabel(table(['Nutella', 'Crema de avellanas con cacao', 'Hecho en Italia']))).toBeNull();
  });
});
