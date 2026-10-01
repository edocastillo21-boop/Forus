import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useApp, useToday } from '../../data/app';
import { useCustomFoods, useDayLog, useFoodLogs, usePhases } from '../../data/hooks';
import { addWater, foodLogFrom } from '../../data/actions';
import { currentPhase, fmt, mealsFor, totals } from '../../data/logic';
import { getDb, put, putMany, remove } from '../../data/store';
import { resolveFood } from '../../data/catalog';
import type { FoodLog, MealSlot } from '../../data/types';
import { addDays, longDate, relativeDay } from '../../core/dates';
import { uid } from '../../core/templates';
import { Icon } from '../../ui/Icon';
import { MacroBars, Ring, Sheet, SyncBadge, useToast } from '../../ui/kit';
import { QtySheet, portionText } from './QtySheet';

export function Diary() {
  const { profile, cat } = useApp();
  const today = useToday();
  const nav = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const date = params.get('d') ?? today;
  const logs = useFoodLogs(date);
  const yesterdayLogs = useFoodLogs(addDays(date, -1));
  const custom = useCustomFoods();
  const phases = usePhases();
  const dayLog = useDayLog(date);
  const [editing, setEditing] = useState<FoodLog | null>(null);
  const [menu, setMenu] = useState<MealSlot | null>(null);
  const [saveName, setSaveName] = useState<{ meal: MealSlot; name: string } | null>(null);

  const ph = currentPhase(phases, date);
  const target = ph ? { kcal: ph.kcal, protein: ph.protein_g, carbs: ph.carbs_g, fat: ph.fat_g } : { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const t = totals(logs);
  const meals = mealsFor(profile);
  const byMeal = useMemo(() => {
    const m = new Map<string, FoodLog[]>();
    for (const l of logs) { if (!m.has(l.meal)) m.set(l.meal, []); m.get(l.meal)!.push(l); }
    return m;
  }, [logs]);
  const orphan = logs.filter((l) => !meals.some((m) => m.id === l.meal));
  const water = dayLog && !dayLog.deleted_at ? dayLog.water_ml : 0;
  const waterGoal = profile.prefs?.waterGoal ?? 2500;
  const left = target.kcal - t.kcal;

  const go = (d: string) => setParams(d === today ? {} : { d }, { replace: true });

  async function copyFrom(src: FoodLog[], meal?: string) {
    const now = Date.now();
    const rows = src.filter((l) => !meal || l.meal === meal).map((l, i) => ({ ...l, id: uid(), date, created_at: new Date(now + i).toISOString() }));
    if (!rows.length) return;
    await putMany('food_log_entries', rows);
    toast(`${rows.length} ${rows.length === 1 ? 'alimento copiado' : 'alimentos copiados'}`, 'Deshacer', () => { rows.forEach((r) => void remove('food_log_entries', r.id)); });
  }

  const editFood = editing ? resolveFood(cat, custom, editing.food_ref) : null;

  return (
    <div className="page">
      <div className="row between" style={{ marginBottom: 12 }}>
        <div className="h1">Comer</div>
        <SyncBadge />
      </div>

      <div className="row between" style={{ marginBottom: 12 }}>
        <button className="icon-btn" onClick={() => go(addDays(date, -1))} aria-label="Día anterior"><Icon name="chev-l" /></button>
        <div style={{ textAlign: 'center' }}>
          <b>{relativeDay(date, today)}</b>
          <div className="xs muted">{longDate(date)}</div>
        </div>
        <button className="icon-btn" onClick={() => go(addDays(date, 1))} disabled={date >= addDays(today, 7)} aria-label="Día siguiente"><Icon name="chev-r" /></button>
      </div>

      <div className="card">
        <div className="row" style={{ gap: 16 }}>
          <Ring value={t.kcal} max={target.kcal} size={108}>
            <div className="num" style={{ fontSize: 26, lineHeight: 1, color: left < 0 ? 'var(--danger)' : undefined }}>{fmt(Math.abs(left))}</div>
            <div className="xs muted">{left >= 0 ? 'quedan' : 'de más'}</div>
          </Ring>
          <div className="grow">
            <div className="small muted"><b style={{ color: 'var(--text)' }}>{fmt(t.kcal)}</b> de {fmt(target.kcal)} kcal</div>
            <MacroBars t={t} target={target} />
          </div>
        </div>
      </div>

      {logs.length === 0 && yesterdayLogs.length > 0 && (
        <button className="card row" style={{ width: '100%', textAlign: 'left' }} onClick={() => copyFrom(yesterdayLogs)}>
          <span className="icon-btn"><Icon name="copy" /></span>
          <div className="grow"><b>Copiar el día anterior</b><div className="xs muted">{yesterdayLogs.length} alimentos · {fmt(totals(yesterdayLogs).kcal)} kcal</div></div>
        </button>
      )}

      {meals.map((m) => {
        const items = byMeal.get(m.id) ?? [];
        const mt = totals(items);
        return (
          <div key={m.id} className="card">
            <div className="meal-h">
              <div><b className="h2">{m.name}</b> <span className="xs faint">{m.time}</span></div>
              <div className="row" style={{ gap: 6 }}>
                {items.length > 0 && <span className="small muted"><b className="num" style={{ fontSize: 17, color: 'var(--text)' }}>{fmt(mt.kcal)}</b> kcal</span>}
                <button className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => setMenu(m)} aria-label={`Opciones de ${m.name}`}><Icon name="more" size={18} /></button>
              </div>
            </div>
            {items.length > 0 && <div className="xs muted" style={{ marginTop: -2, marginBottom: 4 }}>P {fmt(mt.protein)} · C {fmt(mt.carbs)} · G {fmt(mt.fat)} g</div>}
            <div>
              {items.map((l) => <Entry key={l.id} l={l} onClick={() => setEditing(l)} />)}
            </div>
            <button className="add-row" onClick={() => nav(`/comer/agregar?d=${date}&m=${m.id}`)}><Icon name="plus" size={18} />Agregar</button>
          </div>
        );
      })}

      {orphan.length > 0 && (
        <div className="card">
          <div className="meal-h"><b className="h2">Otros</b><span className="small muted">{fmt(totals(orphan).kcal)} kcal</span></div>
          {orphan.map((l) => <Entry key={l.id} l={l} onClick={() => setEditing(l)} />)}
        </div>
      )}

      <div className="card">
        <div className="row between">
          <div><b className="h2">Agua</b><div className="xs muted">{fmt(water / 1000, 2)} de {fmt(waterGoal / 1000, 1)} L</div></div>
          <div className="row" style={{ gap: 6 }}>
            <button className="icon-btn" onClick={() => water > 0 && void addWater(date, -250)} aria-label="Quitar un vaso"><Icon name="minus" /></button>
            <button className="btn btn-primary btn-sm" onClick={() => void addWater(date, 250)}><Icon name="drop" size={16} />+250 ml</button>
          </div>
        </div>
        <div className="row wrap" style={{ gap: 6, marginTop: 12 }}>
          {Array.from({ length: Math.max(Math.ceil(waterGoal / 250), Math.ceil(water / 250)) }, (_, i) => (
            <div key={i} style={{ width: 22, height: 28, borderRadius: '4px 4px 8px 8px', border: '2px solid var(--prot)', background: i < water / 250 ? 'var(--prot)' : 'transparent', opacity: i < water / 250 ? 1 : 0.35 }} />
          ))}
        </div>
      </div>

      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu?.name}>
        {menu && (
          <div className="list">
            <button className="li" onClick={() => { void copyFrom(yesterdayLogs, menu.id); setMenu(null); }} disabled={!yesterdayLogs.some((l) => l.meal === menu.id)}>
              <span className="ico"><Icon name="copy" /></span><span className="grow">Copiar {menu.name.toLowerCase()} del día anterior</span>
            </button>
            <button className="li" disabled={!byMeal.get(menu.id)?.length} onClick={() => { setSaveName({ meal: menu, name: `Mi ${menu.name.toLowerCase()}` }); setMenu(null); }}>
              <span className="ico"><Icon name="star" /></span><span className="grow">Guardar como comida frecuente</span>
            </button>
            <button className="li" disabled={!byMeal.get(menu.id)?.length} onClick={() => {
              const items = byMeal.get(menu.id) ?? [];
              items.forEach((l) => void remove('food_log_entries', l.id));
              setMenu(null);
              toast(`${menu.name} vaciado`, 'Deshacer', () => { void putMany('food_log_entries', items.map((l) => ({ ...l, deleted_at: null }))); });
            }}>
              <span className="ico" style={{ color: 'var(--danger)' }}><Icon name="trash" /></span><span className="grow danger">Borrar todo</span>
            </button>
          </div>
        )}
      </Sheet>

      <Sheet open={!!saveName} onClose={() => setSaveName(null)} title="Guardar comida">
        {saveName && (
          <>
            <p className="small muted" style={{ marginTop: -6, marginBottom: 12 }}>La encontrarás en "Mis comidas" para agregarla con un toque.</p>
            <label className="field"><span>Nombre</span><input className="input" autoFocus value={saveName.name} onChange={(e) => setSaveName({ ...saveName, name: e.target.value })} /></label>
            <button className="btn btn-primary" disabled={!saveName.name.trim()} onClick={async () => {
              const items = (byMeal.get(saveName.meal.id) ?? []).map((l) => ({ food_ref: l.food_ref, name: l.name, grams: l.grams, portion: l.portion, qty: l.qty }));
              await put('saved_meals', { id: uid(), name: saveName.name.trim(), items });
              setSaveName(null);
              toast('Comida guardada');
            }}>Guardar</button>
          </>
        )}
      </Sheet>

      {editing && editFood && (
        <QtySheet
          key={editing.id} food={editFood} initial={{ grams: editing.grams, portion: editing.portion, qty: editing.qty }}
          meals={meals} meal={editing.meal} confirmLabel={() => 'Guardar'}
          onClose={() => setEditing(null)}
          onConfirm={async (a, meal) => {
            const next = foodLogFrom(editFood, a.grams, { date: editing.date, meal: meal ?? editing.meal, portion: a.portion, qty: a.qty });
            await put('food_log_entries', { ...next, id: editing.id, created_at: editing.created_at, source: editing.source });
            setEditing(null);
          }}
          onDelete={async () => { const l = editing; await remove('food_log_entries', l.id); setEditing(null); toast('Eliminado', 'Deshacer', () => void put('food_log_entries', { ...l, deleted_at: null })); }}
        />
      )}
      {editing && !editFood && <QuickEdit log={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Entry({ l, onClick }: { l: FoodLog; onClick: () => void }) {
  return (
    <button className="fi" onClick={onClick}>
      <div className="grow">
        <div className="truncate">{l.name}</div>
        <div className="xs muted">{l.food_ref.startsWith('q:') ? `P ${fmt(l.protein)} · C ${fmt(l.carbs)} · G ${fmt(l.fat)} g` : portionText(l)}</div>
      </div>
      <span className="k">{fmt(l.kcal)}</span>
    </button>
  );
}

/** Edición de un registro rápido (sin alimento de referencia). */
function QuickEdit({ log, onClose }: { log: FoodLog; onClose: () => void }) {
  const toast = useToast();
  const [v, setV] = useState({ name: log.name, kcal: String(log.kcal), protein: String(log.protein), carbs: String(log.carbs), fat: String(log.fat) });
  const n = (s: string) => Math.max(0, parseFloat(s.replace(',', '.')) || 0);
  return (
    <Sheet open onClose={onClose} title="Registro rápido">
      <label className="field"><span>Descripción</span><input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
      <div className="grid2">
        {(['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => (
          <label key={k} className="field" style={{ margin: 0 }}><span>{{ kcal: 'Calorías', protein: 'Proteína (g)', carbs: 'Carbohidratos (g)', fat: 'Grasa (g)' }[k]}</span>
            <input className="input" inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
          </label>
        ))}
      </div>
      <div className="row">
        <button className="btn btn-danger" style={{ width: 64, flex: 'none' }} aria-label="Eliminar" onClick={async () => { await remove('food_log_entries', log.id); onClose(); toast('Eliminado', 'Deshacer', () => void put('food_log_entries', { ...log, deleted_at: null })); }}><Icon name="trash" /></button>
        <button className="btn btn-primary grow" onClick={async () => {
          const row = await getDb().food_log_entries.get(log.id);
          if (row) await put('food_log_entries', { ...row, name: v.name.trim() || 'Registro rápido', kcal: Math.round(n(v.kcal)), protein: n(v.protein), carbs: n(v.carbs), fat: n(v.fat) });
          onClose();
        }}>Guardar</button>
      </div>
    </Sheet>
  );
}
