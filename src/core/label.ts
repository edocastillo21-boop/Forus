// Lectura de la tabla nutricional a partir de las palabras que entrega el OCR, con su posición.
// Reconstruye las filas, reconoce cada nutriente y elige la columna "100 g" (o la de la porción).
// Pensado para las etiquetas chilenas ("100 g | 1 porción"), pero también lee las europeas y las de EE. UU.

export interface OcrWord { text: string; x0: number; y0: number; x1: number; y1: number }
export type LabelKey = 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'sugar' | 'sodium';

export interface LabelRead {
  /** En qué base vienen los valores. */
  basis: '100' | 'porcion';
  values: Partial<Record<LabelKey, number>>;
  portion: { name: string; grams: number } | null;
  /** false si no se vieron los encabezados de las columnas y se supuso cuál era la de 100 g. */
  sure: boolean;
}

interface Tok { x: number; norm: string; num: number | null; unit: string | null; pct: boolean; thousands: boolean }
interface Row { y0: number; y1: number; x0: number; x1: number; words: OcrWord[] }
type RowKey = LabelKey | 'kj' | 'salt';

export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const UNIT = /^(kcal|kj|mg|mcg|µg|ug|g|gr|ml|cc|cal)$/;

/** Número de una palabra del OCR ("6,3", "30,9g", "<0,5", "1.234", "12%"), corrigiendo letras confundidas con dígitos. */
export function parseNum(raw: string): { n: number; unit: string | null; pct: boolean; thousands: boolean } | null {
  // "(g)" leído como "(9)" o "(0)": entre paréntesis es la unidad, no un valor.
  if (/^\(.*\)$|^\([09]$|^[09]\)$/.test(raw.trim())) return null;
  let t = raw.trim().replace(/^[([{"'*]+|[)\]}"':;*]+$/g, '');
  const pct = /%$/.test(t);
  if (pct) t = t.slice(0, -1);
  const m = /^[<≤~]?([0-9OoIl|.,]+?)(kcal|kj|mg|mcg|µg|ug|g|gr|ml|cc|cal)?$/i.exec(t);
  if (!m || !/\d/.test(m[1])) return null;
  let d = m[1].replace(/[Oo]/g, '0').replace(/[Il|]/g, '1').replace(/^[.,]+|[.,]+$/g, '');
  if (!d) return null;
  const thousands = /^\d{1,3}\.\d{3}$/.test(d);
  if (/[.,].*[.,]/.test(d)) d = d.replace(/\.(?=.*[.,])/g, '').replace(/,(?=.*[.,])/g, ''); // 1.234,5 → 1234,5
  const n = Number(d.replace(',', '.'));
  return Number.isFinite(n) ? { n, unit: m[2]?.toLowerCase() ?? null, pct, thousands } : null;
}

/** Une las líneas que el OCR separó (etiquetas a la izquierda, números a la derecha) cuando están a la misma altura. */
function toRows(lines: OcrWord[][]): Row[] {
  const rows: Row[] = lines.filter((l) => l.length).map((l) => ({
    y0: Math.min(...l.map((w) => w.y0)), y1: Math.max(...l.map((w) => w.y1)),
    x0: Math.min(...l.map((w) => w.x0)), x1: Math.max(...l.map((w) => w.x1)), words: [...l],
  })).sort((a, b) => a.y0 + a.y1 - b.y0 - b.y1);
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i], b = rows[j];
      const overlap = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      if (overlap < 0.5 * Math.min(a.y1 - a.y0, b.y1 - b.y0)) continue;
      if (b.x0 < a.x1 && a.x0 < b.x1) continue; // se cruzan en horizontal: son filas distintas
      Object.assign(a, { y0: Math.min(a.y0, b.y0), y1: Math.max(a.y1, b.y1), x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), words: [...a.words, ...b.words] });
      rows.splice(j--, 1);
    }
  }
  for (const r of rows) r.words.sort((a, b) => a.x0 - b.x0);
  return rows;
}

function tokens(row: Row): Tok[] {
  // Decimales que el OCR partió en dos palabras: "30," + "9" → "30,9".
  const ws: OcrWord[] = [];
  for (const w of row.words) {
    const prev = ws[ws.length - 1];
    if (prev && /\d[.,]$/.test(prev.text) && /^\d/.test(w.text) && w.x0 - prev.x1 < (w.y1 - w.y0) * 0.8) {
      ws[ws.length - 1] = { ...prev, text: prev.text + w.text, x1: w.x1 };
    } else ws.push(w);
  }
  const out: Tok[] = [];
  for (const w of ws) {
    const x = (w.x0 + w.x1) / 2;
    for (const part of w.text.split('/')) {
      if (!part.trim()) continue;
      const p = parseNum(part);
      const n = norm(part);
      const last = out[out.length - 1];
      // Unidad suelta después del número ("539 kcal").
      if (!p && last?.num != null && !last.unit && UNIT.test(n.replace(/[().,:]/g, ''))) { last.unit = n.replace(/[().,:]/g, ''); continue; }
      out.push(p ? { x, norm: n, num: p.n, unit: p.unit, pct: p.pct, thousands: p.thousands } : { x, norm: n, num: null, unit: null, pct: n.includes('%'), thousands: false });
    }
  }
  return out;
}

const FAT_SUB = /satur|trans|mono|poli|insat|colest/;
function rowKey(label: string): RowKey | null {
  if (/az.?car|sugar/.test(label)) return 'sugar';
  if (/fibra|fiber|fibre/.test(label)) return 'fiber';
  if (/sodio|sodium/.test(label)) return 'sodium';
  if (/(^|\s)(sal|salt)(\s|\(|$)/.test(label)) return 'salt';
  if (/prot/.test(label)) return 'protein';
  if (/hidrat|carbohid|carbohyd|(^|\s)h\.?\s*(de\s*)?c\b|(^|\s)hdc\b|carbo/.test(label)) return 'carbs';
  if (/grasa|lipid|(^|\s)fat\b/.test(label)) return FAT_SUB.test(label) ? null : 'fat';
  if (/energ|calor|kcal|(^|\s)kj\b/.test(label)) return /kj/.test(label) && !/kcal|calor/.test(label) ? 'kj' : 'kcal';
  return null;
}

// "Porción: 1 unidad (30 g)" · "Porción: 30 g (1 unidad)" · "Serving size 2/3 cup (55g)".
// El OCR suele leer la "g" antes del paréntesis como "9": "(15 9)".
const PORTION_A = /(?:porci.n(?!es)|serving size|racion(?!es))\s*:?\s*([^()]*?)\s*\(\s*(\d+(?:[.,]\d+)?)\s*(?:g|gr|ml|cc|9(?=\s*\)))\b/;
const PORTION_B = /(?:porci.n(?!es)|serving size|racion(?!es))\s*:?\s*(\d+(?:[.,]\d+)?)\s*(?:g|gr|ml|cc)\b\s*(?:\(([^()]*)\))?/;

export function parseLabel(lines: OcrWord[][]): LabelRead | null {
  const rows = toRows(lines).map((r) => ({ toks: tokens(r), text: norm(r.words.map((w) => w.text).join(' ')) }));

  // Porción: "Porción: 1 unidad (30 g)".
  let portion: LabelRead['portion'] = null;
  for (const r of rows) {
    const a = PORTION_A.exec(r.text);
    const b = a ? null : PORTION_B.exec(r.text);
    if (!a && !b) continue;
    const grams = Number((a ? a[2] : b![1]).replace(',', '.'));
    if (!(grams > 0 && grams < 2000)) continue;
    const name = ((a ? a[1] : b![2]) ?? '').replace(/[:.]/g, ' ').replace(/\s+/g, ' ').trim();
    portion = { name: name && name.length <= 24 ? name[0].toUpperCase() + name.slice(1) : 'Porción', grams };
    break;
  }

  // Filas de nutrientes (la primera de cada uno manda; "grasas saturadas" no es la grasa total).
  type NRow = { key: RowKey; toks: Tok[]; label: string };
  const nrows: NRow[] = [];
  const seen = new Set<RowKey>();
  rows.forEach((r, i) => {
    const label = r.toks.filter((t) => t.num == null).map((t) => t.norm).join(' ');
    const key = rowKey(label);
    if (!key || seen.has(key)) return;
    let toks = r.toks.filter((t) => t.num != null && !t.pct);
    // Etiqueta en dos líneas ("Hidratos de carbono / disponibles (g)"): los números quedan en la otra.
    if (!toks.length) {
      const next = rows[i + 1];
      const nextLabel = next?.toks.filter((t) => t.num == null).map((t) => t.norm).join(' ') ?? '';
      if (next && !rowKey(nextLabel)) toks = next.toks.filter((t) => t.num != null && !t.pct);
    }
    if (!toks.length) return;
    seen.add(key);
    nrows.push({ key, toks, label });
  });
  if (!nrows.length) return null;

  // Encabezados: "100 g" y "1 porción" (y columnas de % que se ignoran).
  type Col = { x: number; kind: '100' | 'porcion' | 'pct' };
  let cols: Col[] = [];
  for (const r of rows) {
    if (rowKey(r.toks.filter((t) => t.num == null).map((t) => t.norm).join(' '))) continue;
    const c100 = r.toks.find((t, i) => t.num === 100 && (t.unit === 'g' || t.unit === 'ml' || t.unit === 'gr' || /^(g|ml|gr)\.?$/.test(r.toks[i + 1]?.norm ?? '')));
    if (!c100) continue;
    cols = [{ x: c100.x, kind: '100' }];
    const por = r.toks.find((t) => /porci|serving|racion/.test(t.norm));
    if (por) cols.push({ x: por.x, kind: 'porcion' });
    for (const t of r.toks) if (t.pct || /^(vd|idr|gda|dv|%vd)$/.test(t.norm)) cols.push({ x: t.x, kind: 'pct' });
    break;
  }

  // El número más cercano a la columna pedida, entre los que quedan más cerca de ella que de otra.
  const pick = (toks: Tok[], kind: Col['kind']): Tok | undefined => {
    const col = cols.find((c) => c.kind === kind);
    if (!col) return undefined;
    const near = (t: Tok) => cols.reduce((best, c) => (Math.abs(c.x - t.x) < Math.abs(best.x - t.x) ? c : best));
    return toks.filter((t) => near(t) === col).sort((a, b) => Math.abs(a.x - col.x) - Math.abs(b.x - col.x))[0];
  };

  // Energía: si viene "kJ / kcal" en la misma fila, quedan solo las kcal.
  const energyToks = (r: NRow) => {
    if (r.key !== 'kcal') return r.toks;
    if (r.toks.some((t) => t.unit === 'kcal')) return r.toks.filter((t) => t.unit === 'kcal');
    return r.toks.filter((t) => t.unit !== 'kj' && !r.toks.some((o) => o !== t && o.num! > 0 && Math.abs(t.num! / o.num! - 4.184) < 0.25));
  };

  let basis: LabelRead['basis'] = '100';
  let sure = false;
  let take: (r: NRow) => Tok | undefined;
  let other: (r: NRow) => Tok | undefined;
  if (cols.some((c) => c.kind === '100')) {
    sure = true;
    take = (r) => pick(energyToks(r), '100');
    other = (r) => pick(energyToks(r), 'porcion');
  } else {
    // Sin encabezados: con dos columnas se decide con la porción (la de 100 g es 100/porción veces la otra).
    const two = nrows.filter((r) => energyToks(r).length >= 2);
    let first = true;
    if (two.length && portion && portion.grams !== 100) {
      const ratios = two.map((r) => { const [a, b] = energyToks(r); return b.num! > 0.5 && a.num! > 0.5 ? a.num! / b.num! : NaN; }).filter(Number.isFinite).sort((a, b) => a - b);
      const med = ratios[Math.floor(ratios.length / 2)];
      const k = 100 / portion.grams;
      if (med && Math.abs(med * k - 1) < 0.2) { first = false; sure = true; } // a = porción, b = 100 g
      else if (med && Math.abs(med / k - 1) < 0.2) sure = true;
    }
    if (!two.length) {
      const all = rows.map((r) => r.text).join(' ');
      basis = /100\s*(g|ml|gr)\b/.test(all) || !/porci.n(?!es)|serving/.test(all) ? '100' : 'porcion';
    }
    take = (r) => { const ts = energyToks(r); return ts.length >= 2 ? ts[first ? 0 : 1] : ts[0]; };
    other = (r) => { const ts = energyToks(r); return ts.length >= 2 ? ts[first ? 1 : 0] : undefined; };
  }

  const raw: Partial<Record<RowKey, Tok>> = {};
  for (const r of nrows) { const t = take(r); if (t) raw[r.key] = t; }
  // Comas que el OCR no vio ("6,3" → "63"): con dos columnas, la razón entre ellas es la misma en todas
  // las filas (100 / gramos de la porción); la fila que se sale por 10 veces tenía coma.
  const fixed: Partial<Record<RowKey, number>> = {};
  const both = nrows.map((r) => ({ key: r.key, a: raw[r.key], b: other(r) })).filter((p) => p.a && p.b && p.a.num! > 0.3 && p.b.num! > 0.3);
  if (both.length >= 3) {
    const ratios = both.map((p) => p.a!.num! / p.b!.num!).sort((x, y) => x - y);
    const ratio = ratios[Math.floor(ratios.length / 2)];
    for (const p of both) {
      const q = p.a!.num! / p.b!.num!;
      if (Math.abs(q / ratio - 1) > 0.35 && Number.isInteger(p.a!.num!) && Math.abs(q / 10 / ratio - 1) < 0.2) fixed[p.key] = p.a!.num! / 10;
    }
  }
  const val = (k: RowKey) => { if (fixed[k] != null) return fixed[k]; const t = raw[k]; return t ? t.num! * (t.thousands && (k === 'kcal' || k === 'kj' || k === 'sodium') ? 1000 : 1) : undefined; };

  const v: LabelRead['values'] = {};
  let kcal = val('kcal') ?? (val('kj') != null ? val('kj')! / 4.184 : undefined);
  for (const k of ['protein', 'carbs', 'fat', 'fiber', 'sugar'] as const) {
    let x = val(k);
    if (x == null) continue;
    // Coma que el OCR no vio: más de 100 g en 100 g es imposible ("575" era "57,5").
    if (basis === '100' && x > 100 && Number.isInteger(x)) x /= 10;
    v[k] = Math.round(x * 10) / 10;
  }
  let sodium = val('sodium');
  if (sodium != null && (raw.sodium!.unit === 'g' || /\(g\)/.test(nrows.find((r) => r.key === 'sodium')!.label))) sodium *= 1000;
  if (sodium == null && val('salt') != null) sodium = val('salt')! * 400;
  if (sodium != null) v.sodium = Math.round(sodium);
  if (kcal != null) {
    // Con una sola columna, las comas perdidas se notan porque las kcal no calzan con los macros:
    // se prueba qué macros enteros, divididos por 10, las hacen calzar.
    const kc = kcal;
    const fromM = (p: number, c: number, f: number) => p * 4 + c * 4 + f * 9;
    const off = (m: number) => Math.abs(kc - m) > Math.max(20, kc * 0.12);
    const [p0, c0, f0] = [v.protein ?? 0, v.carbs ?? 0, v.fat ?? 0];
    if (off(fromM(p0, c0, f0))) {
      const opts = [p0, c0, f0].map((x) => (Number.isInteger(x) && x >= 10 ? [x, x / 10] : [x]));
      let bestM: number[] | null = null;
      for (const p of opts[0]) for (const c of opts[1]) for (const f of opts[2]) {
        if (!off(fromM(p, c, f)) && (!bestM || Math.abs(kc - fromM(p, c, f)) < Math.abs(kc - fromM(bestM[0], bestM[1], bestM[2])))) bestM = [p, c, f];
      }
      if (bestM) (['protein', 'carbs', 'fat'] as const).forEach((k, i) => { if (v[k] != null) v[k] = bestM![i]; });
    }
    const macros = (v.protein ?? 0) * 4 + (v.carbs ?? 0) * 4 + (v.fat ?? 0) * 9;
    // Si las "kcal" son en realidad kJ (≈ 4,18 veces lo que dan los macros), se convierten.
    if (macros > 0 && Math.abs(kcal / 4.184 - macros) < Math.max(15, macros * 0.15) && Math.abs(kcal - macros) > macros * 0.5) kcal /= 4.184;
    v.kcal = Math.round(kcal);
  }
  if (!Object.keys(v).length) return null;
  return { basis, values: v, portion, sure };
}

/** Cuántos de los cuatro valores principales se leyeron. */
export const mainFound = (r: LabelRead | null) => (r ? (['kcal', 'protein', 'carbs', 'fat'] as const).filter((k) => r.values[k] != null).length : 0);
