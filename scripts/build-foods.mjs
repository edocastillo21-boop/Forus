// Genera public/data/foods.json cruzando scripts/foods-es.mjs con USDA FoodData Central (SR Legacy).
// Uso: node scripts/build-foods.mjs [--report]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { FOODS, CUSTOM, RECIPES, GROUPS } from './foods-es.mjs';

const DIR = new URL('../data-src/sr/FoodData_Central_sr_legacy_food_csv_2018-04/', import.meta.url);
const REPORT = process.argv.includes('--report');

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}
const load = (f) => {
  const [head, ...rows] = parseCsv(readFileSync(new URL(f, DIR), 'utf8'));
  return rows.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
};

// Macros y micronutrientes que se guardan (id de nutriente USDA → código Forus)
const MACROS = { k: 1008, p: 1003, c: 1005, f: 1004, fb: 1079, su: 2000, na: 1093 };
const MICROS = [
  ['sat', 1258, 'g', 'Grasa saturada'], ['mono', 1292, 'g', 'Grasa monoinsaturada'], ['poli', 1293, 'g', 'Grasa poliinsaturada'],
  ['col', 1253, 'mg', 'Colesterol'], ['ca', 1087, 'mg', 'Calcio'], ['fe', 1089, 'mg', 'Hierro'], ['mg', 1090, 'mg', 'Magnesio'],
  ['p', 1091, 'mg', 'Fósforo'], ['k', 1092, 'mg', 'Potasio'], ['zn', 1095, 'mg', 'Zinc'], ['cu', 1098, 'mg', 'Cobre'],
  ['mn', 1101, 'mg', 'Manganeso'], ['se', 1103, 'µg', 'Selenio'], ['vita', 1106, 'µg', 'Vitamina A'], ['vite', 1109, 'mg', 'Vitamina E'],
  ['vitd', 1114, 'µg', 'Vitamina D'], ['vitc', 1162, 'mg', 'Vitamina C'], ['b1', 1165, 'mg', 'Tiamina (B1)'], ['b2', 1166, 'mg', 'Riboflavina (B2)'],
  ['b3', 1167, 'mg', 'Niacina (B3)'], ['b6', 1175, 'mg', 'Vitamina B6'], ['fol', 1177, 'µg', 'Folato'], ['b12', 1178, 'µg', 'Vitamina B12'],
  ['vitk', 1185, 'µg', 'Vitamina K'], ['caf', 1057, 'mg', 'Cafeína'],
];
const WANTED = new Set([...Object.values(MACROS), ...MICROS.map((m) => m[1])]);
const EXCLUDED_CATS = new Set(['3', '24', '25', '26', '27']);

console.time('csv');
const foods = load('food.csv').filter((f) => !EXCLUDED_CATS.has(f.food_category_id));
const byFdc = new Map(foods.map((f) => [f.fdc_id, f]));
const nut = new Map();
for (const r of load('food_nutrient.csv')) {
  const nid = +r.nutrient_id;
  if (!WANTED.has(nid) || !byFdc.has(r.fdc_id)) continue;
  if (!nut.has(r.fdc_id)) nut.set(r.fdc_id, {});
  nut.get(r.fdc_id)[nid] = +r.amount;
}
const portions = new Map();
for (const r of load('food_portion.csv')) {
  if (!byFdc.has(r.fdc_id)) continue;
  if (!portions.has(r.fdc_id)) portions.set(r.fdc_id, []);
  portions.get(r.fdc_id).push(r);
}
console.timeEnd('csv');

const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
function match(keys) {
  const exact = foods.filter((f) => norm(f.description) === norm(keys));
  if (exact.length) return { f: exact[0], n: 1 };
  const toks = keys.split(',').map(norm).filter(Boolean);
  const cands = foods.filter((f) => { const d = norm(f.description); return toks.every((t) => d.includes(t)); });
  cands.sort((a, b) => a.description.length - b.description.length);
  return { f: cands[0], n: cands.length };
}

const PORTION_WORDS = [
  [/^nlea serving|^serving/, 'Porción'], [/^cup/, 'Taza'], [/^tbsp/, 'Cucharada'], [/^tsp/, 'Cucharadita'], [/^slice/, 'Rebanada'],
  [/^large/, 'Unidad grande'], [/^medium/, 'Unidad mediana'], [/^small/, 'Unidad pequeña'], [/^piece/, 'Trozo'], [/^fruit/, 'Unidad'],
  [/^fillet/, 'Filete'], [/^container/, 'Envase'], [/^packet/, 'Sobre'], [/^stalk/, 'Tallo'], [/^clove/, 'Diente'], [/^leaf/, 'Hoja'],
  [/^patty/, 'Unidad'], [/^link/, 'Unidad'], [/^bar\b/, 'Barra'], [/^can\b/, 'Lata'], [/^bottle/, 'Botella'], [/^ear/, 'Mazorca'],
];
function usdaPortions(fdc) {
  const out = [];
  for (const r of portions.get(fdc) || []) {
    if (+r.amount !== 1) continue;
    const mod = norm(r.modifier || r.portion_description || '');
    if (/^(oz|lb|fl oz)/.test(mod)) continue;
    const hit = PORTION_WORDS.find(([re]) => re.test(mod));
    if (hit) out.push([hit[1], Math.round(+r.gram_weight * 10) / 10]);
  }
  return out;
}
const parsePor = (s) => (s ? s.split('|').map((p) => { const i = p.lastIndexOf(':'); return [p.slice(0, i).trim(), +p.slice(i + 1)]; }) : []);
function mergePor(own, usda) {
  const seen = new Set(own.map(([n]) => n.toLowerCase()));
  const extra = usda.filter(([n]) => !seen.has(n.toLowerCase()) && (seen.add(n.toLowerCase()), true));
  return [...own, ...extra].slice(0, 5);
}

const r1 = (x) => Math.round(x * 10) / 10;
const sig = (x) => (x == null ? null : x === 0 ? 0 : +x.toPrecision(3));
const items = [];
const byId = new Map();
const problems = [];
const report = [];

for (const [id, n, g, keys, por] of FOODS) {
  if (byId.has(id)) problems.push(`id repetido: ${id}`);
  if (!GROUPS[g]) problems.push(`grupo inválido: ${id} → ${g}`);
  const { f, n: count } = match(keys);
  if (!f) { problems.push(`sin coincidencia: ${id} ← "${keys}"`); continue; }
  const v = nut.get(f.fdc_id) || {};
  if (v[1008] == null) problems.push(`sin kcal: ${id} (${f.description})`);
  const item = {
    id, n, g,
    k: Math.round(v[1008] ?? 0), p: r1(v[1003] ?? 0), c: r1(v[1005] ?? 0), f: r1(v[1004] ?? 0),
    fb: r1(v[1079] ?? 0), su: r1(v[2000] ?? 0), na: Math.round(v[1093] ?? 0),
    mi: MICROS.map(([, nid]) => sig(v[nid])),
    por: mergePor(parsePor(por), usdaPortions(f.fdc_id)),
    src: `usda:${f.fdc_id}`, ref: f.description,
  };
  items.push(item);
  byId.set(id, item);
  report.push(`${id.padEnd(26)} ${String(count).padStart(3)}  ${f.description}`);
}

for (const [id, n, g, [k, p, c, f, fb], por] of CUSTOM) {
  const item = { id, n, g, k, p, c, f, fb, su: 0, na: 0, mi: MICROS.map(() => null), por: parsePor(por), src: 'forus' };
  items.push(item); byId.set(id, item);
}

for (const [id, n, por, yieldF, ingr] of RECIPES) {
  const parts = ingr.split(',').map((s) => { const [k, gr] = s.trim().split(':'); return [k.trim(), +gr]; });
  const tot = { k: 0, p: 0, c: 0, f: 0, fb: 0, su: 0, na: 0, mi: MICROS.map(() => 0) };
  let weight = 0;
  for (const [k, gr] of parts) {
    const it = byId.get(k);
    if (!it) { problems.push(`receta ${id}: ingrediente desconocido ${k}`); continue; }
    const r = gr / 100;
    for (const key of ['k', 'p', 'c', 'f', 'fb', 'su', 'na']) tot[key] += it[key] * r;
    it.mi.forEach((m, i) => { tot.mi[i] += (m ?? 0) * r; });
    weight += gr;
  }
  const fin = weight * yieldF;
  const per = (x) => (x * 100) / fin;
  const item = {
    id, n, g: 'preparaciones',
    k: Math.round(per(tot.k)), p: r1(per(tot.p)), c: r1(per(tot.c)), f: r1(per(tot.f)),
    fb: r1(per(tot.fb)), su: r1(per(tot.su)), na: Math.round(per(tot.na)),
    mi: tot.mi.map((m) => sig(per(m))),
    por: parsePor(por), src: 'receta',
    ing: parts.map(([k, gr]) => [byId.get(k)?.n ?? k, gr]), rend: yieldF,
  };
  items.push(item); byId.set(id, item);
}

if (REPORT) console.log(report.join('\n'));
if (problems.length) { console.error('PROBLEMAS:\n' + problems.join('\n')); process.exitCode = 1; }

mkdirSync(new URL('../public/data/', import.meta.url), { recursive: true });
const out = { v: 1, groups: GROUPS, micros: MICROS.map(([code, , unit, name]) => [code, name, unit]), items };
writeFileSync(new URL('../public/data/foods.json', import.meta.url), JSON.stringify(out));
console.log(`foods.json: ${items.length} alimentos (${FOODS.length} USDA, ${CUSTOM.length} propios, ${RECIPES.length} preparaciones)`);
