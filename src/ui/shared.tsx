// Piezas de interfaz compartidas entre pantallas.
import { useMemo, useState } from 'react';
import { useApp } from '../data/app';
import { exerciseImage, norm, EQUIPMENT, type CatalogExercise } from '../data/catalog';
import { setWeight } from '../data/actions';
import { plates, DEFAULT_PLATES } from '../core/strength';
import { VOLUME_GROUPS, MUSCLE_NAMES } from '../core/volume';
import { shortDate, todayISO } from '../core/dates';
import { fmt, fmtKg } from '../data/logic';
import { Icon } from './Icon';
import { Sheet, Stepper, useToast } from './kit';

export function Thumb({ ex, size }: { ex: CatalogExercise | undefined; size?: number }) {
  const { cat } = useApp();
  const [err, setErr] = useState(false);
  const src = ex && !err ? exerciseImage(cat, ex, 0) : null;
  return (
    <div className="thumb" style={size ? { width: size, height: size } : undefined}>
      {src ? <img src={src} alt="" loading="lazy" onError={() => setErr(true)} /> : <Icon name="dumbbell" />}
    </div>
  );
}

export function musclesText(ex: CatalogExercise): string {
  return ex.m.map((m) => MUSCLE_NAMES[m] ?? m).join(', ');
}

/** Selector de ejercicios con búsqueda y filtro por grupo muscular. */
export function ExercisePicker({ open, onClose, onPick, title = 'Agregar ejercicio', similarTo }: {
  open: boolean; onClose: () => void; onPick: (exId: string) => void; title?: string; similarTo?: string | null;
}) {
  const { cat } = useApp();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const base = similarTo ? cat.exById.get(similarTo) : undefined;
  const list = useMemo(() => {
    const nq = norm(q);
    const muscles = group ? VOLUME_GROUPS.find(([g]) => g === group)?.[1] ?? [] : null;
    let items = cat.exercises.filter((e) => (!nq || nq.split(/\s+/).every((w) => norm(e.n).includes(w))) && (!muscles || e.m.some((m) => muscles.includes(m))));
    if (base) {
      const score = (e: CatalogExercise) => (e.p === base.p ? 2 : 0) + (e.m.some((m) => base.m.includes(m)) ? 1 : 0);
      items = items.filter((e) => e.id !== base.id).sort((a, b) => score(b) - score(a) || a.n.localeCompare(b.n));
    } else items = [...items].sort((a, b) => a.n.localeCompare(b.n));
    return items.slice(0, 120);
  }, [cat, q, group, base]);
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="search"><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ejercicio" /></div>
      <div className="chips" style={{ margin: '12px 0 4px', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 4 }}>
        <button className={!group ? 'on' : ''} onClick={() => setGroup(null)}>Todos</button>
        {VOLUME_GROUPS.map(([g]) => <button key={g} className={group === g ? 'on' : ''} onClick={() => setGroup(g === group ? null : g)} style={{ whiteSpace: 'nowrap' }}>{g}</button>)}
      </div>
      {base && !q && !group && <p className="xs muted" style={{ margin: '8px 0 0' }}>Primero los que trabajan lo mismo que <b>{base.n}</b>.</p>}
      <div>
        {list.map((e) => (
          <button key={e.id} className="res" onClick={() => { onPick(e.id); setQ(''); }}>
            <Thumb ex={e} size={44} />
            <div className="grow"><div className="truncate"><b>{e.n}</b></div><div className="xs muted truncate">{EQUIPMENT[e.e]} · {musclesText(e)}</div></div>
            <span className="plus"><Icon name="plus" size={18} /></span>
          </button>
        ))}
        {!list.length && <div className="empty" style={{ marginTop: 12 }}>No encontramos ese ejercicio.</div>}
      </div>
    </Sheet>
  );
}

/** Hoja para registrar el peso de un día. */
export function WeightSheet({ open, onClose, date, initial }: { open: boolean; onClose: () => void; date: string; initial: number }) {
  const [kg, setKg] = useState(initial);
  const toast = useToast();
  return (
    <Sheet open={open} onClose={onClose} title={date === todayISO() ? 'Peso de hoy' : `Peso del ${shortDate(date)}`}>
      <p className="small muted">Pésate en ayunas, después de ir al baño. Lo que importa es la tendencia, no el número de un día.</p>
      <Stepper value={kg} onChange={setKg} step={0.1} bigStep={1} min={30} max={300} decimals={1} unit="kg" />
      <button className="btn btn-primary" onClick={async () => { await setWeight(date, kg); onClose(); toast(`Peso guardado: ${fmtKg(kg)} kg`); }}>Guardar</button>
    </Sheet>
  );
}

const PLATE_STYLE: Record<string, [string, number, string]> = {
  '25': ['#E53935', 118, '#fff'], '20': ['#1E88E5', 118, '#fff'], '15': ['#FDD835', 102, '#1a1a1a'], '10': ['#43A047', 88, '#fff'],
  '5': ['#F5F5F5', 66, '#1a1a1a'], '2.5': ['#3A3A44', 54, '#fff'], '1.25': ['#BDBDBD', 46, '#1a1a1a'],
};

/** Calculadora de discos: qué poner a cada lado de la barra. */
export function PlatesView({ total, bar = 20, available = DEFAULT_PLATES }: { total: number; bar?: number; available?: number[] }) {
  const r = plates(total, bar, available);
  if (total < bar) return <div className="hint"><Icon name="info" size={18} /><span>El peso es menor que la barra ({fmtKg(bar)} kg).</span></div>;
  return (
    <div>
      <div className="plates" aria-label={`Por lado: ${r.perSide.map((p) => fmtKg(p)).join(', ') || 'nada'}`}>
        <div className="barend" />
        <div className="collar" />
        {r.perSide.map((p, i) => {
          const [bg, h, fg] = PLATE_STYLE[String(p)] ?? ['#888', 60, '#fff'];
          return <div key={i} className="plate" style={{ background: bg, height: h, width: p >= 10 ? 20 : 15, color: fg, border: p === 5 ? '1px solid #ccc' : undefined }}>{p >= 5 ? fmtKg(p) : ''}</div>;
        })}
      </div>
      <p style={{ textAlign: 'center' }}>
        <b>Por lado:</b> {r.perSide.length ? r.perSide.map((p) => fmtKg(p)).join(' + ') : 'solo la barra'}
        <span className="muted"> · barra {fmtKg(bar)} kg</span>
      </p>
      {Math.abs(r.missing) > 0.01 && <p className="small" style={{ textAlign: 'center', color: 'var(--warn)' }}>Con tus discos llegas a {fmtKg(r.loaded)} kg (faltan {fmt(r.missing, 2)} kg).</p>}
    </div>
  );
}

export function PlatesSheet({ open, onClose, kg }: { open: boolean; onClose: () => void; kg: number | null }) {
  const { profile } = useApp();
  const [total, setTotal] = useState(kg ?? 60);
  const bar = profile.prefs?.bar ?? 20;
  return (
    <Sheet open={open} onClose={onClose} title="Calculadora de discos">
      <Stepper value={total} onChange={setTotal} step={2.5} bigStep={10} min={0} max={500} decimals={2} unit="kg en total" />
      <PlatesView total={total} bar={bar} available={profile.prefs?.plates ?? DEFAULT_PLATES} />
    </Sheet>
  );
}

/** Nombre del ejercicio, o un texto genérico si ya no está en el catálogo. */
export function exName(cat: ReturnType<typeof useApp>['cat'], id: string): string {
  return cat.exById.get(id)?.n ?? 'Ejercicio';
}
