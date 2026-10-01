// Hoja de cantidad: porción casera o gramos, con vista previa de cómo queda el día.
import { useState } from 'react';
import type { FoodView } from '../../data/catalog';
import type { MealSlot } from '../../data/types';
import type { Totals } from '../../data/logic';
import { fmt } from '../../data/logic';
import { Icon } from '../../ui/Icon';
import { Sheet, Stepper } from '../../ui/kit';

export interface Amount { grams: number; portion: string | null; qty: number | null }

export function portionText(a: Amount, unit = 'g'): string {
  if (a.portion && a.qty) return `${fmt(a.qty, a.qty % 1 ? 1 : 0)} ${a.qty === 1 ? a.portion.toLowerCase() : plural(a.portion.toLowerCase())} (${fmt(a.grams)} ${unit})`;
  return `${fmt(a.grams)} ${unit}`;
}

function plural(s: string): string {
  const one = (w: string) => (/[aeiouáéó]$/.test(w) ? w + 's' : /ón$/.test(w) ? w.slice(0, -2) + 'ones' : /z$/.test(w) ? w.slice(0, -1) + 'ces' : /[^s]$/.test(w) ? w + 'es' : w);
  const words = s.split(' ');
  const stop = words.findIndex((w) => w === 'de' || w.startsWith('('));
  return words.map((w, i) => (stop < 0 || i < stop ? one(w) : w)).join(' ');
}

export function QtySheet({ food, initial, meals, meal, day, target, favorite, onFavorite, confirmLabel, onConfirm, onDelete, onClose }: {
  food: FoodView; initial?: Amount | null; meals?: MealSlot[]; meal?: string; day?: Totals; target?: { kcal: number; protein: number } | null;
  favorite?: boolean; onFavorite?: () => void; confirmLabel?: (meal: MealSlot | undefined) => string;
  onConfirm: (a: Amount, meal: string | undefined) => void; onDelete?: () => void; onClose: () => void;
}) {
  const first = food.portions[0];
  const [portion, setPortion] = useState<string | null>(initial ? initial.portion : first ? first[0] : null);
  const [qty, setQty] = useState<number>(initial?.qty ?? 1);
  const [grams, setGrams] = useState<number>(initial?.grams ?? (first ? first[1] : 100));
  const [mealId, setMealId] = useState(meal);
  const pg = portion ? food.portions.find((p) => p[0] === portion)?.[1] ?? null : null;
  const g = pg ? pg * qty : grams;
  const f = g / 100;
  const k = Math.round(food.kcal * f);
  const u = food.unit;
  const selMeal = meals?.find((m) => m.id === mealId);

  return (
    <Sheet open onClose={onClose} title={
      <span className="row" style={{ gap: 8 }}>
        <span className="grow truncate">{food.name}</span>
        {onFavorite && <button className="icon-btn" onClick={onFavorite} aria-label={favorite ? 'Quitar de favoritos' : 'Agregar a favoritos'} style={{ color: favorite ? 'var(--warn)' : undefined }}><Icon name="star" style={favorite ? { fill: 'currentColor' } : undefined} /></button>}
      </span>
    }>
      {food.note && <p className="xs faint" style={{ marginTop: -8, marginBottom: 10 }}>{food.note}</p>}
      <div className="chips">
        {food.portions.map(([name, pgr]) => (
          <button key={name} className={portion === name ? 'on' : ''} onClick={() => { setPortion(name); if (!pg) setQty(1); }}>{name} · {fmt(pgr)} {u}</button>
        ))}
        <button className={!portion ? 'on' : ''} onClick={() => { setGrams(Math.round(g)); setPortion(null); }}>{u === 'ml' ? 'Mililitros' : 'Gramos'}</button>
      </div>
      {portion && pg
        ? <Stepper value={qty} onChange={setQty} step={0.5} min={0.5} max={50} decimals={1} unit={`${qty === 1 ? portion.toLowerCase() : plural(portion.toLowerCase())} · ${fmt(g)} ${u}`} />
        : <Stepper value={grams} onChange={setGrams} step={10} bigStep={50} min={1} max={3000} unit={u} />}
      <div className="m4" style={{ marginTop: 0 }}>
        <div><div className="num" style={{ fontSize: 22 }}>{fmt(k)}</div><div className="xs muted">kcal</div></div>
        <div><div className="num" style={{ fontSize: 22, color: 'var(--prot)' }}>{fmt(food.protein * f, 1)}</div><div className="xs muted">prot. g</div></div>
        <div><div className="num" style={{ fontSize: 22, color: 'var(--carb)' }}>{fmt(food.carbs * f, 1)}</div><div className="xs muted">carbos g</div></div>
        <div><div className="num" style={{ fontSize: 22, color: 'var(--fat)' }}>{fmt(food.fat * f, 1)}</div><div className="xs muted">grasa g</div></div>
      </div>
      {day && target && target.kcal > 0 && (
        <div style={{ margin: '14px 0 4px' }}>
          <div className="row between xs muted"><span>Tu día quedaría en</span><span><b style={{ color: 'var(--text)' }}>{fmt(day.kcal + k)}</b> / {fmt(target.kcal)} kcal · prot. {fmt(day.protein + food.protein * f)} / {fmt(target.protein)} g</span></div>
          <div className="bar" style={{ marginTop: 6 }}><i style={{ width: `${Math.min(100, ((day.kcal + k) / target.kcal) * 100)}%`, background: day.kcal + k > target.kcal * 1.1 ? 'var(--danger)' : 'var(--primary)' }} /></div>
        </div>
      )}
      {meals && (
        <div className="chips" style={{ margin: '14px 0 4px' }}>
          {meals.map((m) => <button key={m.id} className={mealId === m.id ? 'on' : ''} onClick={() => setMealId(m.id)}>{m.name}</button>)}
        </div>
      )}
      <div className="row" style={{ marginTop: 14 }}>
        {onDelete && <button className="btn btn-danger" style={{ width: 64, flex: 'none' }} onClick={onDelete} aria-label="Eliminar"><Icon name="trash" /></button>}
        <button className="btn btn-primary grow" onClick={() => onConfirm({ grams: Math.round(g * 10) / 10, portion: pg ? portion : null, qty: pg ? qty : null }, mealId)}>
          {confirmLabel ? confirmLabel(selMeal) : 'Agregar'}
        </button>
      </div>
    </Sheet>
  );
}
