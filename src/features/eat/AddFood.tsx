import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useApp, useToday } from '../../data/app';
import { useCustomFoods, useFoodLogs, usePhases, useRecentFoodLogs, useSavedMeals } from '../../data/hooks';
import { foodLogFrom, toggleFavorite } from '../../data/actions';
import { currentPhase, fmt, mealsFor, totals } from '../../data/logic';
import { put, putMany, remove } from '../../data/store';
import { resolveFood, searchFoods, viewCustomFood, type FoodView } from '../../data/catalog';
import type { FoodLog } from '../../data/types';
import { uid } from '../../core/templates';
import { Icon } from '../../ui/Icon';
import { Sheet, useToast } from '../../ui/kit';
import { QtySheet, portionText, type Amount } from './QtySheet';

type Tab = 'recientes' | 'favoritos' | 'comidas' | 'propios';

export function AddFood() {
  const { cat, profile } = useApp();
  const today = useToday();
  const nav = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const date = params.get('d') ?? today;
  const meals = mealsFor(profile);
  const mealId = params.get('m') && meals.some((m) => m.id === params.get('m')) ? params.get('m')! : meals[0].id;
  const meal = meals.find((m) => m.id === mealId)!;
  const custom = useCustomFoods();
  const recentLogs = useRecentFoodLogs(500);
  const saved = useSavedMeals();
  const dayLogs = useFoodLogs(date);
  const phases = usePhases();
  const ph = currentPhase(phases, date);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('recientes');
  const [sel, setSel] = useState<{ food: FoodView; amount: Amount | null } | null>(null);
  const [quick, setQuick] = useState(false);
  const [added, setAdded] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const favs = profile.prefs?.favorites ?? [];
  const chipsRef = useRef<HTMLDivElement>(null);
  useEffect(() => { chipsRef.current?.querySelector('.on')?.scrollIntoView({ inline: 'center', block: 'nearest' }); }, [mealId]);

  const recent = useMemo(() => {
    const seen = new Map<string, { food: FoodView; last: FoodLog; count: number }>();
    for (const l of recentLogs) {
      if (l.food_ref.startsWith('q:')) continue;
      const cur = seen.get(l.food_ref);
      if (cur) { cur.count++; continue; }
      const food = resolveFood(cat, custom, l.food_ref);
      if (food) seen.set(l.food_ref, { food, last: l, count: 1 });
    }
    return [...seen.values()];
  }, [recentLogs, cat, custom]);
  const boost = useMemo(() => new Set([...recent.slice(0, 80).map((r) => r.food.ref), ...favs]), [recent, favs]);
  const results = useMemo(() => (q.trim() ? searchFoods(cat, custom, q, boost) : []), [q, cat, custom, boost]);
  const lastFor = (ref: string) => recent.find((r) => r.food.ref === ref)?.last;

  async function add(food: FoodView, a: Amount, toMeal = mealId) {
    const row = foodLogFrom(food, a.grams, { date, meal: toMeal, portion: a.portion, qty: a.qty });
    await put('food_log_entries', row);
    setAdded((n) => n + 1);
    const mName = meals.find((m) => m.id === toMeal)?.name ?? meal.name;
    toast(`${food.name.split(',')[0]} → ${mName}`, 'Deshacer', () => { void remove('food_log_entries', row.id); setAdded((n) => Math.max(0, n - 1)); });
  }

  function open(food: FoodView) {
    const last = lastFor(food.ref);
    setSel({ food, amount: last ? { grams: last.grams, portion: last.portion, qty: last.qty } : null });
  }

  async function addSaved(items: { food_ref: string; name: string; grams: number; portion: string | null; qty: number | null }[], name: string) {
    const now = Date.now();
    const rows = items.map((it, i) => {
      const food = resolveFood(cat, custom, it.food_ref);
      return food ? { ...foodLogFrom(food, it.grams, { date, meal: mealId, portion: it.portion, qty: it.qty }), created_at: new Date(now + i).toISOString(), source: 'comida' } : null;
    }).filter((r): r is NonNullable<typeof r> => r !== null);
    if (!rows.length) return;
    await putMany('food_log_entries', rows);
    setAdded((n) => n + rows.length);
    toast(`${name} → ${meal.name}`, 'Deshacer', () => { rows.forEach((r) => void remove('food_log_entries', r.id)); setAdded((n) => Math.max(0, n - rows.length)); });
  }

  const row = (food: FoodView, sub: string, key?: string, quickAmount?: Amount) => (
    <div key={key ?? food.ref} className="res" style={{ padding: '10px 0' }}>
      <button className="grow" style={{ textAlign: 'left', minWidth: 0 }} onClick={() => open(food)}>
        <div className="truncate"><b>{food.name}</b>{favs.includes(food.ref) && <Icon name="star" size={13} style={{ display: 'inline', marginLeft: 6, color: 'var(--warn)', fill: 'currentColor', verticalAlign: -1 }} />}</div>
        <div className="xs muted truncate">{sub}</div>
      </button>
      <button className="plus" onClick={() => (quickAmount ? void add(food, quickAmount) : open(food))} aria-label={`Agregar ${food.name}`}><Icon name="plus" size={18} /></button>
    </div>
  );

  const per100 = (f: FoodView) => `${fmt(f.kcal)} kcal · P ${fmt(f.protein, 1)} · C ${fmt(f.carbs, 1)} · G ${fmt(f.fat, 1)} por 100 ${f.unit}`;

  return (
    <div className="page full">
      <div className="row between" style={{ marginBottom: 12 }}>
        <button className="icon-btn" onClick={() => nav(date === today ? '/comer' : `/comer?d=${date}`)} aria-label="Volver"><Icon name="chev-l" /></button>
        <div className="grow" style={{ textAlign: 'center' }}><b>Agregar a {meal.name}</b><div className="xs muted">{fmt(totals(dayLogs).kcal)} de {fmt(ph?.kcal ?? 0)} kcal hoy</div></div>
        <button className="icon-btn" onClick={() => setQuick(true)} aria-label="Registro rápido"><Icon name="zap" /></button>
      </div>
      <div ref={chipsRef} className="chips" style={{ flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 6, marginBottom: 8 }}>
        {meals.map((m) => <button key={m.id} className={m.id === mealId ? 'on' : ''} style={{ whiteSpace: 'nowrap' }} onClick={() => setParams({ d: date, m: m.id }, { replace: true })}>{m.name}</button>)}
      </div>
      <div className="search">
        <Icon name="search" />
        <input ref={inputRef} autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar: marraqueta, pollo, porotos…" enterKeyHint="search" />
        {q && <button onClick={() => { setQ(''); inputRef.current?.focus(); }} aria-label="Borrar búsqueda"><Icon name="x" size={18} /></button>}
      </div>

      {q.trim() ? (
        <div style={{ marginTop: 6 }}>
          {results.map((f) => row(f, `${f.custom ? 'Tuyo · ' : ''}${per100(f)}`))}
          {!results.length && (
            <div className="empty" style={{ marginTop: 12 }}>
              No encontramos "{q}". Prueba con otra palabra, o <button className="link" onClick={() => nav(`/comer/nuevo?d=${date}&m=${mealId}&n=${encodeURIComponent(q)}`)}>créalo como alimento propio</button>.
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="tabs">
            {([['recientes', 'Recientes'], ['favoritos', 'Favoritos'], ['comidas', 'Mis comidas'], ['propios', 'Mis alimentos']] as [Tab, string][]).map(([k, l]) => (
              <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
          {tab === 'recientes' && (
            recent.length ? recent.slice(0, 40).map(({ food, last }) => row(food, `${portionText(last, food.unit)} · ${fmt(last.kcal)} kcal`, food.ref, { grams: last.grams, portion: last.portion, qty: last.qty }))
              : <div className="empty" style={{ marginTop: 12 }}>Lo que registres aparecerá aquí para agregarlo con un toque. Empieza buscando arriba.</div>
          )}
          {tab === 'favoritos' && (
            favs.length ? favs.map((ref) => { const f = resolveFood(cat, custom, ref); return f ? row(f, per100(f)) : null; })
              : <div className="empty" style={{ marginTop: 12 }}>Marca con ★ los alimentos que más usas (dentro de cada alimento).</div>
          )}
          {tab === 'comidas' && (
            saved.length ? saved.map((s) => {
              const kcal = s.items.reduce((a, it) => { const f = resolveFood(cat, custom, it.food_ref); return a + (f ? (f.kcal * it.grams) / 100 : 0); }, 0);
              return (
                <div key={s.id} className="res" style={{ padding: '10px 0' }}>
                  <div className="grow"><b>{s.name}</b><div className="xs muted truncate">{s.items.map((i) => i.name).join(', ')} · {fmt(kcal)} kcal</div></div>
                  <button className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => { void remove('saved_meals', s.id); toast('Comida eliminada', 'Deshacer', () => void put('saved_meals', { ...s, deleted_at: null })); }} aria-label={`Eliminar ${s.name}`}><Icon name="trash" size={16} /></button>
                  <button className="plus" onClick={() => void addSaved(s.items, s.name)} aria-label={`Agregar ${s.name}`}><Icon name="plus" size={18} /></button>
                </div>
              );
            }) : <div className="empty" style={{ marginTop: 12 }}>En el diario, usa ⋯ en una comida y "Guardar como comida frecuente" (ej.: "Mi desayuno de siempre").</div>
          )}
          {tab === 'propios' && (
            <>
              <button className="btn btn-soft" style={{ margin: '12px 0 4px' }} onClick={() => nav(`/comer/nuevo?d=${date}&m=${mealId}`)}><Icon name="plus" size={18} />Crear alimento</button>
              {custom.map((c) => {
                const f = viewCustomFood(c);
                return (
                  <div key={c.id} className="res" style={{ padding: '10px 0' }}>
                    <button className="grow" style={{ textAlign: 'left', minWidth: 0 }} onClick={() => open(f)}><div className="truncate"><b>{f.name}</b></div><div className="xs muted truncate">{per100(f)}</div></button>
                    <button className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => nav(`/comer/nuevo?id=${c.id}&d=${date}&m=${mealId}`)} aria-label={`Editar ${f.name}`}><Icon name="note" size={16} /></button>
                    <button className="plus" onClick={() => open(f)} aria-label={`Agregar ${f.name}`}><Icon name="plus" size={18} /></button>
                  </div>
                );
              })}
            </>
          )}
        </>
      )}

      {added > 0 && (
        <div style={{ position: 'sticky', bottom: 0, padding: '14px 0 calc(8px + env(safe-area-inset-bottom))', background: 'linear-gradient(transparent, var(--bg) 35%)' }}>
          <button className="btn btn-primary" onClick={() => nav(date === today ? '/comer' : `/comer?d=${date}`)}><Icon name="check" size={18} />Listo · {added} {added === 1 ? 'agregado' : 'agregados'}</button>
        </div>
      )}

      {sel && (
        <QtySheet
          key={sel.food.ref} food={sel.food} initial={sel.amount} meals={meals} meal={mealId}
          day={totals(dayLogs)} target={ph ? { kcal: ph.kcal, protein: ph.protein_g } : null}
          favorite={favs.includes(sel.food.ref)}
          onFavorite={async () => { const on = await toggleFavorite(profile, sel.food.ref); toast(on ? 'Agregado a favoritos' : 'Quitado de favoritos'); }}
          confirmLabel={(m) => `Agregar a ${m?.name ?? meal.name}`}
          onClose={() => setSel(null)}
          onConfirm={async (a, m) => { await add(sel.food, a, m ?? mealId); setSel(null); setQ(''); }}
        />
      )}

      {quick && <QuickAdd onClose={() => setQuick(false)} onAdd={async (row) => {
        const log = { id: uid(), date, meal: mealId, food_ref: 'q:', grams: 0, portion: null, qty: null, fiber: 0, source: 'rapido', created_at: new Date().toISOString(), ...row };
        await put('food_log_entries', log);
        setAdded((n) => n + 1);
        setQuick(false);
        toast(`Registro rápido → ${meal.name}`, 'Deshacer', () => void remove('food_log_entries', log.id));
      }} />}
    </div>
  );
}

function QuickAdd({ onClose, onAdd }: { onClose: () => void; onAdd: (r: { name: string; kcal: number; protein: number; carbs: number; fat: number }) => void }) {
  const [v, setV] = useState({ name: '', kcal: '', protein: '', carbs: '', fat: '' });
  const n = (s: string) => Math.max(0, parseFloat(s.replace(',', '.')) || 0);
  const fromMacros = Math.round(n(v.protein) * 4 + n(v.carbs) * 4 + n(v.fat) * 9);
  const kcal = v.kcal ? Math.round(n(v.kcal)) : fromMacros;
  return (
    <Sheet open onClose={onClose} title="Registro rápido">
      <p className="small muted" style={{ marginTop: -6, marginBottom: 12 }}>Para cuando comes fuera y solo sabes un aproximado. Si dejas las calorías vacías, se calculan con los macros.</p>
      <label className="field"><span>Descripción</span><input className="input" autoFocus value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Ej.: almuerzo en el casino" /></label>
      <div className="grid2">
        {(['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => (
          <label key={k} className="field" style={{ margin: 0 }}><span>{{ kcal: 'Calorías', protein: 'Proteína (g)', carbs: 'Carbohidratos (g)', fat: 'Grasa (g)' }[k]}</span>
            <input className="input" inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} placeholder={k === 'kcal' && fromMacros ? String(fromMacros) : '0'} />
          </label>
        ))}
      </div>
      <button className="btn btn-primary" disabled={!kcal} onClick={() => onAdd({ name: v.name.trim() || 'Registro rápido', kcal, protein: n(v.protein), carbs: n(v.carbs), fat: n(v.fat) })}>Agregar {kcal ? `${fmt(kcal)} kcal` : ''}</button>
    </Sheet>
  );
}
