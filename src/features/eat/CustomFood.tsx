import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useApp } from '../../data/app';
import { useCustomFoods } from '../../data/hooks';
import { put, remove } from '../../data/store';
import { fmt } from '../../data/logic';
import type { CustomFood } from '../../data/types';
import { uid } from '../../core/templates';
import { Icon } from '../../ui/Icon';
import { Header, Seg, useToast } from '../../ui/kit';

const FIELDS = [
  ['kcal', 'Calorías', 'kcal'], ['protein', 'Proteína', 'g'], ['carbs', 'Carbohidratos', 'g'], ['fat', 'Grasa', 'g'],
  ['fiber', 'Fibra', 'g'], ['sugar', 'Azúcares', 'g'], ['sodium', 'Sodio', 'mg'],
] as const;
type Key = (typeof FIELDS)[number][0];

export function CustomFoodForm() {
  const [params] = useSearchParams();
  const id = params.get('id');
  const all = useCustomFoods();
  const existing = id ? all.find((f) => f.id === id) : undefined;
  if (id && !existing) return <div className="page full"><Header title="Alimento" /><div className="empty">Cargando…</div></div>;
  return <Form key={existing?.id ?? 'new'} existing={existing} />;
}

function Form({ existing }: { existing?: CustomFood }) {
  const { cat } = useApp();
  const nav = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const back = () => (params.get('d') ? nav(`/comer/agregar?d=${params.get('d')}&m=${params.get('m') ?? ''}`, { replace: true }) : nav(-1));
  const [name, setName] = useState(existing?.name ?? params.get('n') ?? '');
  const [brand, setBrand] = useState(existing?.brand ?? '');
  const [group, setGroup] = useState(existing?.group_code ?? 'snacks');
  const [mode, setMode] = useState<'100' | 'porcion'>(existing && !existing.portions.length ? '100' : 'porcion');
  const [pName, setPName] = useState(existing?.portions[0]?.[0] ?? 'Porción');
  const [pGrams, setPGrams] = useState(String(existing?.portions[0]?.[1] ?? ''));
  const base = (k: Key) => {
    if (!existing) return '';
    const g = existing.portions[0]?.[1];
    const v = mode === 'porcion' && g ? (existing[k] * g) / 100 : existing[k];
    return String(Math.round(v * 10) / 10);
  };
  const [vals, setVals] = useState<Record<Key, string>>(() => Object.fromEntries(FIELDS.map(([k]) => [k, base(k)])) as Record<Key, string>);
  const [confirmDel, setConfirmDel] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const n = (s: string) => Math.max(0, parseFloat(s.replace(',', '.')) || 0);
  const grams = n(pGrams);
  const fromMacros = Math.round(n(vals.protein) * 4 + n(vals.carbs) * 4 + n(vals.fat) * 9);
  const kcal = vals.kcal ? n(vals.kcal) : fromMacros;
  const mismatch = vals.kcal && fromMacros > 0 && Math.abs(kcal - fromMacros) > Math.max(20, kcal * 0.15);

  async function save() {
    if (!name.trim()) { setErr('Escribe el nombre.'); return; }
    if (mode === 'porcion' && !grams) { setErr('Indica cuántos gramos pesa la porción de la etiqueta.'); return; }
    if (!kcal) { setErr('Indica las calorías o los macros.'); return; }
    const f = mode === 'porcion' ? 100 / grams : 1;
    const per = (k: Key) => Math.round((k === 'kcal' ? kcal : n(vals[k])) * f * 10) / 10;
    const portions: [string, number][] = grams ? [[pName.trim() || 'Porción', grams]] : [];
    await put('foods', {
      id: existing?.id ?? uid(), name: name.trim(), brand: brand.trim() || null, barcode: existing?.barcode ?? null, group_code: group,
      kcal: per('kcal'), protein: per('protein'), carbs: per('carbs'), fat: per('fat'), fiber: per('fiber'), sugar: per('sugar'), sodium: per('sodium'), portions,
    });
    toast(existing ? 'Alimento actualizado' : 'Alimento creado: búscalo o míralo en "Mis alimentos"');
    back();
  }

  return (
    <div className="page full">
      <Header title={existing ? 'Editar alimento' : 'Nuevo alimento'} />
      <label className="field"><span>Nombre</span><input className="input" autoFocus={!existing} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Barra de proteína" /></label>
      <label className="field"><span>Marca (opcional)</span><input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} /></label>
      <label className="field"><span>Grupo</span>
        <select className="input" value={group} onChange={(e) => setGroup(e.target.value)}>
          {Object.entries(cat.groups).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <div className="field"><span>Los valores de la etiqueta son…</span>
        <Seg options={[{ value: 'porcion' as const, label: 'Por porción' }, { value: '100' as const, label: 'Por 100 g' }]} value={mode} onChange={setMode} />
      </div>
      <div className="grid2">
        <label className="field" style={{ margin: 0 }}><span>{mode === 'porcion' ? 'Porción' : 'Porción habitual (opcional)'}</span><input className="input" value={pName} onChange={(e) => setPName(e.target.value)} /></label>
        <label className="field" style={{ margin: 0 }}><span>Gramos de la porción</span><input className="input" inputMode="decimal" value={pGrams} onChange={(e) => setPGrams(e.target.value)} placeholder="g" /></label>
      </div>
      <div className="eyebrow" style={{ margin: '6px 0 10px' }}>Información nutricional {mode === 'porcion' ? `por porción${grams ? ` (${fmt(grams)} g)` : ''}` : 'por 100 g'}</div>
      <div className="grid2">
        {FIELDS.map(([k, l, u]) => (
          <label key={k} className="field" style={{ margin: 0 }}><span>{l} ({u})</span>
            <input className="input" inputMode="decimal" value={vals[k]} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} placeholder={k === 'kcal' && fromMacros ? String(fromMacros) : '0'} />
          </label>
        ))}
      </div>
      {mismatch && <div className="hint warn" style={{ marginBottom: 12 }}><Icon name="info" size={18} /><span>Las calorías no calzan con los macros ({fmt(fromMacros)} kcal). Revisa la etiqueta.</span></div>}
      {err && <div className="hint warn" style={{ marginBottom: 12 }}><Icon name="info" size={18} /><span>{err}</span></div>}
      <button className="btn btn-primary" onClick={save}>Guardar</button>
      {existing && (
        <button className="btn btn-danger" style={{ marginTop: 10 }} onClick={async () => {
          if (!confirmDel) { setConfirmDel(true); return; }
          await remove('foods', existing.id);
          toast('Alimento eliminado');
          back();
        }}>{confirmDel ? 'Toca de nuevo para eliminar' : 'Eliminar alimento'}</button>
      )}
    </div>
  );
}
