// Productos de marca por código de barras: Open Food Facts (base abierta, licencia ODbL).
// Solo se envía el código; los valores se muestran para revisar antes de guardarlos como alimento propio.

export interface OffProduct {
  code: string;
  name: string;
  brand: string | null;
  /** Por 100 g (sodio en mg). */
  kcal: number; protein: number; carbs: number; fat: number; fiber: number; sugar: number; sodium: number;
  serving: [string, number] | null;
  complete: boolean;
}

export type OffResult = { found: true; product: OffProduct } | { found: false; reason: 'no_existe' | 'sin_datos' | 'sin_senal' | 'error' };

const FIELDS = 'code,product_name,product_name_es,generic_name_es,brands,nutriments,serving_size,serving_quantity';
const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
const r1 = (x: number) => Math.round(x * 10) / 10;

export const validBarcode = (code: string) => /^\d{8,14}$/.test(code);

export async function lookupBarcode(code: string): Promise<OffResult> {
  if (!navigator.onLine) return { found: false, reason: 'sin_senal' };
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`, { headers: { Accept: 'application/json' } });
    if (res.status === 404) return { found: false, reason: 'no_existe' };
    if (!res.ok) return { found: false, reason: 'error' };
    const j = await res.json() as { status?: number; product?: Record<string, unknown> };
    if (j.status !== 1 || !j.product) return { found: false, reason: 'no_existe' };
    const p = j.product;
    const n = (p.nutriments ?? {}) as Record<string, unknown>;
    let kcal = num(n['energy-kcal_100g']);
    if (!Number.isFinite(kcal)) { const kj = num(n['energy_100g']); if (Number.isFinite(kj)) kcal = kj / 4.184; }
    const protein = num(n['proteins_100g']);
    const carbs = num(n['carbohydrates_100g']);
    const fat = num(n['fat_100g']);
    if (![kcal, protein, carbs, fat].every(Number.isFinite)) return { found: false, reason: 'sin_datos' };
    const fiber = num(n['fiber_100g']);
    const sugar = num(n['sugars_100g']);
    const sodium = num(n['sodium_100g']);
    const sq = num(p.serving_quantity);
    const name = String(p.product_name_es || p.product_name || p.generic_name_es || '').trim();
    const brand = String(p.brands ?? '').split(',')[0].trim();
    return {
      found: true,
      product: {
        // Si el nombre ya incluye la marca, no se repite ("Nutella (Nutella)").
        code, name, brand: brand && !name.toLowerCase().includes(brand.toLowerCase()) ? brand : null,
        kcal: Math.round(kcal), protein: r1(protein), carbs: r1(carbs), fat: r1(fat),
        fiber: Number.isFinite(fiber) ? r1(fiber) : 0, sugar: Number.isFinite(sugar) ? r1(sugar) : 0,
        sodium: Number.isFinite(sodium) ? Math.round(sodium * 1000) : 0,
        serving: Number.isFinite(sq) && sq > 0 ? ['Porción', r1(sq)] : null,
        complete: !!name,
      },
    };
  } catch {
    return { found: false, reason: navigator.onLine ? 'error' : 'sin_senal' };
  }
}
