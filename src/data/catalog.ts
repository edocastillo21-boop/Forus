// Catálogos globales (alimentos y ejercicios): archivos estáticos dentro de la app.
// Búsqueda instantánea y disponibles sin señal. Los alimentos propios viven en la tabla `foods`.
import { useEffect, useState } from 'react';
import type { CustomFood } from './types';

export interface CatalogFood {
  id: string; n: string; g: string;
  k: number; p: number; c: number; f: number; fb: number; su: number; na: number;
  mi: (number | null)[];
  por: [string, number][];
  src: string; ref?: string;
  ing?: [string, number][]; rend?: number;
}
export interface CatalogExercise {
  id: string; n: string; p: string; e: string;
  m: string[]; s: string[]; img: string[]; t: string[]; x: string[]; u?: 1;
}
interface FoodsFile { v: number; groups: Record<string, string>; micros: [string, string, string][]; items: CatalogFood[] }
interface ExFile { v: number; imgBase: string; items: CatalogExercise[] }

export interface Catalog {
  foods: CatalogFood[];
  foodById: Map<string, CatalogFood>;
  groups: Record<string, string>;
  micros: [string, string, string][];
  exercises: CatalogExercise[];
  exById: Map<string, CatalogExercise>;
  imgBase: string;
}

let cache: Catalog | null = null;
let loading: Promise<Catalog> | null = null;

export function loadCatalog(): Promise<Catalog> {
  if (cache) return Promise.resolve(cache);
  if (!loading) {
    loading = Promise.all([
      fetch('/data/foods.json').then((r) => r.json() as Promise<FoodsFile>),
      fetch('/data/exercises.json').then((r) => r.json() as Promise<ExFile>),
    ]).then(([fo, ex]) => {
      const foods = fo.items.map((f) => ({ ...f, _n: norm(f.n) }));
      cache = {
        foods, foodById: new Map(foods.map((f) => [f.id, f])), groups: fo.groups, micros: fo.micros,
        exercises: ex.items, exById: new Map(ex.items.map((e) => [e.id, e])), imgBase: ex.imgBase,
      };
      return cache;
    }).catch((e) => { loading = null; throw e; });
  }
  return loading;
}

export function useCatalog(): Catalog | null {
  const [c, setC] = useState<Catalog | null>(cache);
  useEffect(() => { if (!c) loadCatalog().then(setC).catch(() => setTimeout(() => loadCatalog().then(setC), 3000)); }, [c]);
  return c;
}

export function catalogSync(): Catalog | null { return cache; }

export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Alimento unificado para la interfaz (catálogo o propio). Valores por 100 g. */
export interface FoodView {
  ref: string; name: string; group: string; kcal: number; protein: number; carbs: number; fat: number; fiber: number;
  portions: [string, number][]; note?: string; unit: string; custom?: boolean;
}

export function viewCatalogFood(f: CatalogFood): FoodView {
  const note = f.src === 'receta' ? 'Preparación calculada desde sus ingredientes' : f.src.startsWith('usda') ? `USDA: ${f.ref}` : 'Valor de referencia';
  const liquid = f.g === 'bebidas' || /^leche|^yogur-bebible|jugo|nectar/.test(f.id);
  return { ref: `g:${f.id}`, name: f.n, group: f.g, kcal: f.k, protein: f.p, carbs: f.c, fat: f.f, fiber: f.fb, portions: f.por, note, unit: liquid ? 'ml' : 'g' };
}

export function viewCustomFood(f: CustomFood): FoodView {
  return { ref: `c:${f.id}`, name: f.brand ? `${f.name} (${f.brand})` : f.name, group: f.group_code, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, fiber: f.fiber, portions: f.portions, note: 'Alimento creado por ti', unit: 'g', custom: true };
}

/** Búsqueda con tolerancia a tildes: primero coincidencias al inicio, luego al inicio de palabra, luego dentro. */
export function searchFoods(cat: Catalog, custom: CustomFood[], q: string, boost: Set<string>, limit = 60): FoodView[] {
  const nq = norm(q);
  if (!nq) return [];
  const words = nq.split(/\s+/);
  const scored: [number, FoodView][] = [];
  const score = (name: string, ref: string): number | null => {
    const n = norm(name);
    if (!words.every((w) => n.includes(w))) return null;
    let s = 0;
    if (n.startsWith(nq)) s += 100;
    else if (n.includes(' ' + words[0]) || n.startsWith(words[0])) s += 50;
    s -= n.length / 10;
    if (boost.has(ref)) s += 80;
    return s;
  };
  for (const f of custom) {
    if (f.deleted_at) continue;
    const v = viewCustomFood(f);
    const s = score(v.name, v.ref);
    if (s !== null) scored.push([s + 20, v]);
  }
  for (const f of cat.foods) {
    const s = score(f.n, `g:${f.id}`);
    if (s !== null) scored.push([s, viewCatalogFood(f)]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  return scored.slice(0, limit).map(([, v]) => v);
}

export function resolveFood(cat: Catalog | null, custom: CustomFood[], ref: string): FoodView | null {
  if (ref.startsWith('g:')) { const f = cat?.foodById.get(ref.slice(2)); return f ? viewCatalogFood(f) : null; }
  if (ref.startsWith('c:')) { const f = custom.find((x) => x.id === ref.slice(2)); return f && !f.deleted_at ? viewCustomFood(f) : null; }
  return null;
}

export function exerciseImage(cat: Catalog, ex: CatalogExercise, i = 0): string | null {
  return ex.img[i] ? cat.imgBase + ex.img[i] : null;
}

export const PATTERNS: Record<string, string> = {
  sentadilla: 'Sentadilla', bisagra: 'Bisagra de cadera', zancada: 'Zancada', empuje_h: 'Empuje horizontal', empuje_v: 'Empuje vertical',
  tiron_h: 'Tirón horizontal', tiron_v: 'Tirón vertical', aislamiento: 'Aislamiento', core: 'Core', acarreo: 'Acarreo',
};
export const EQUIPMENT: Record<string, string> = {
  barra: 'Barra', mancuerna: 'Mancuernas', polea: 'Polea', maquina: 'Máquina', smith: 'Smith', corporal: 'Peso corporal',
  kettlebell: 'Kettlebell', ez: 'Barra Z', banda: 'Banda', otro: 'Otro',
};
