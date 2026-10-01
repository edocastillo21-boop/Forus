// Genera public/data/exercises.json a partir de scripts/exercises-es.mjs
// y valida que cada imagen exista en free-exercise-db (data-src/free-exercise-db.json).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { EXERCISES } from './exercises-es.mjs';

const SHA = 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5';
const fedb = JSON.parse(readFileSync(new URL('../data-src/free-exercise-db.json', import.meta.url)));
const byId = new Map(fedb.map((e) => [e.id, e]));

const MUSCLES = ['pecho', 'dorsal', 'esp_media', 'lumbar', 'trapecio', 'delt_ant', 'delt_lat', 'delt_post', 'biceps', 'triceps', 'antebrazo', 'abdomen', 'cuadriceps', 'isquios', 'gluteos', 'aductores', 'abductores', 'gemelos'];
const PATTERNS = ['sentadilla', 'bisagra', 'zancada', 'empuje_h', 'empuje_v', 'tiron_h', 'tiron_v', 'aislamiento', 'core', 'acarreo'];
const EQUIP = ['barra', 'mancuerna', 'polea', 'maquina', 'smith', 'corporal', 'kettlebell', 'ez', 'banda', 'otro'];

const ids = new Set();
const errors = [];
const items = EXERCISES.map(([id, img, n, p, e, m, s, t, x, u]) => {
  if (ids.has(id)) errors.push(`id repetido: ${id}`);
  ids.add(id);
  if (img && !byId.has(img)) errors.push(`imagen inexistente: ${id} → ${img}`);
  if (!PATTERNS.includes(p)) errors.push(`patrón inválido: ${id} → ${p}`);
  if (!EQUIP.includes(e)) errors.push(`equipo inválido: ${id} → ${e}`);
  const list = (v) => (v ? v.split(',').map((z) => z.trim()).filter(Boolean) : []);
  for (const mm of [...list(m), ...list(s)]) if (!MUSCLES.includes(mm)) errors.push(`músculo inválido: ${id} → ${mm}`);
  const src = img ? byId.get(img) : null;
  return {
    id, n, p, e,
    m: list(m), s: list(s),
    img: src ? src.images.slice(0, 2) : [],
    t: t ? t.split('|').map((z) => z.trim()) : [],
    x: x ? x.split('|').map((z) => z.trim()) : [],
    ...(u ? { u: 1 } : {}),
  };
});

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
mkdirSync(new URL('../public/data/', import.meta.url), { recursive: true });
const out = { v: 1, imgBase: `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@${SHA}/exercises/`, items };
writeFileSync(new URL('../public/data/exercises.json', import.meta.url), JSON.stringify(out));
console.log(`exercises.json: ${items.length} ejercicios`);
