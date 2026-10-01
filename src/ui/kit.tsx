import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { Icon } from './Icon';
import { fmt } from '../data/logic';
import { useSyncState } from '../data/sync';

/* ── Hoja inferior ── */
export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="grab" />
        {title != null && (
          <div className="row between" style={{ marginBottom: 12 }}>
            <div className="h2 grow">{title}</div>
            <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><Icon name="x" /></button>
          </div>
        )}
        {children}
      </div>
    </>,
    document.body,
  );
}

/* ── Avisos con deshacer ── */
interface ToastItem { id: number; msg: string; action?: string; onAction?: () => void }
const ToastCtx = createContext<(msg: string, action?: string, onAction?: () => void) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<ToastItem | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((msg: string, action?: string, onAction?: () => void) => {
    setT({ id: Date.now(), msg, action, onAction });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setT(null), action ? 4500 : 2600);
  }, []);
  const low = typeof document !== 'undefined' && !document.querySelector('.tabbar');
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {t && createPortal(
        <div className={`toast${low ? ' low' : ''}`} role="status" key={t.id}>
          <span className="grow">{t.msg}</span>
          {t.action && <button onClick={() => { t.onAction?.(); setT(null); }}>{t.action}</button>}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  );
}

/* ── Stepper grande con edición directa ── */
export function Stepper({ value, onChange, step = 1, min = 0, max = 100000, decimals = 0, unit, bigStep, compact }: {
  value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; decimals?: number; unit?: ReactNode; bigStep?: number; compact?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 1000) / 1000));
  const label = (s: number) => `${s > 0 ? '+' : '−'}${fmt(Math.abs(s), s % 1 ? (Math.abs(s) * 10) % 1 ? 2 : 1 : 0)}`;
  return (
    <div>
      <div className={`stepper${compact ? ' sm' : ''}`}>
        <button type="button" onClick={() => onChange(clamp(value - step))} aria-label="Restar">{label(-step)}</button>
        <div className="v">
          {editing ? (
            <input autoFocus inputMode="decimal" value={draft} onChange={(e) => setDraft(e.target.value)}
              onBlur={() => { const v = parseFloat(draft.replace(',', '.')); if (!Number.isNaN(v)) onChange(clamp(v)); setEditing(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
          ) : (
            <button type="button" onClick={() => { setDraft(String(value).replace('.', ',')); setEditing(true); }} style={{ font: 'inherit' }}>{fmt(value, decimals && value % 1 ? decimals : 0)}</button>
          )}
          {unit && <div className="xs muted" style={{ fontFamily: 'Inter', fontWeight: 500 }}>{unit}</div>}
        </div>
        <button type="button" onClick={() => onChange(clamp(value + step))} aria-label="Sumar">{label(step)}</button>
      </div>
      {bigStep && (
        <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: -6, marginBottom: 12 }}>
          <button type="button" className="btn btn-soft btn-sm" onClick={() => onChange(clamp(value - bigStep))}>{label(-bigStep)}</button>
          <button type="button" className="btn btn-soft btn-sm" onClick={() => onChange(clamp(value + bigStep))}>{label(bigStep)}</button>
        </div>
      )}
    </div>
  );
}

/* ── Anillo de calorías ── */
export function Ring({ value, max, size = 136, children }: { value: number; max: number; size?: number; children?: ReactNode }) {
  const C = 2 * Math.PI * 52;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const over = max > 0 && value > max * 1.1;
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="52" stroke="var(--surface-3)" strokeWidth="11" fill="none" />
        <circle cx="60" cy="60" r="52" stroke={over ? 'var(--danger)' : 'var(--primary)'} strokeWidth="11" fill="none" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 60 60)" style={{ transition: 'stroke-dashoffset .6s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>{children}</div>
    </div>
  );
}

/* ── Barras de macros ── */
export function MacroBars({ t, target }: { t: { protein: number; carbs: number; fat: number }; target: { protein: number; carbs: number; fat: number } }) {
  const rows: [string, number, number, string][] = [
    ['Proteína', t.protein, target.protein, 'var(--prot)'],
    ['Carbohidratos', t.carbs, target.carbs, 'var(--carb)'],
    ['Grasa', t.fat, target.fat, 'var(--fat)'],
  ];
  return (
    <>
      {rows.map(([l, v, max, c]) => (
        <div className="macro" key={l}>
          <span className="lbl">{l}</span>
          <div className="bar"><i style={{ width: `${max ? Math.min(100, (v / max) * 100) : 0}%`, background: c }} /></div>
          <span className="val">{fmt(v)} / {fmt(max)} g</span>
        </div>
      ))}
    </>
  );
}

/* ── Selector segmentado ── */
export function Seg<T extends string | number>({ options, value, onChange }: { options: { value: T; label: ReactNode; sub?: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button type="button" key={String(o.value)} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          <b>{o.label}</b>{o.sub && <span className="xs">{o.sub}</span>}
        </button>
      ))}
    </div>
  );
}

/* ── Cabecera con volver ── */
export function Header({ title, sub, back = true, right }: { title: ReactNode; sub?: ReactNode; back?: boolean | string; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <div className="row between" style={{ marginBottom: 14 }}>
      {back ? (
        <button className="icon-btn" onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))} aria-label="Volver"><Icon name="chev-l" /></button>
      ) : <span style={{ width: 44 }} />}
      <div style={{ textAlign: 'center' }} className="grow truncate"><b>{title}</b>{sub && <div className="xs muted">{sub}</div>}</div>
      {right ?? <span style={{ width: 44 }} />}
    </div>
  );
}

/* ── Estado de sincronización ── */
export function SyncBadge() {
  const { state, pending } = useSyncState();
  if (state === 'local') return null;
  if (state === 'offline') return <span className="chip" title="Sin conexión"><Icon name="wifi-off" size={14} />{pending ? `${pending} por subir` : 'Sin señal'}</span>;
  if (state === 'error') return <span className="chip warn" title="Error al sincronizar"><Icon name="refresh" size={14} />Reintentando</span>;
  if (state === 'syncing' || pending) return <span className="chip" title="Sincronizando"><Icon name="cloud" size={14} />…</span>;
  return null;
}

/* ── Confeti ── */
export function confetti() {
  const cols = ['#FF6B1A', '#FACC15', '#38BDF8', '#A3E635', '#C084FC', '#F4F4F5'];
  for (let i = 0; i < 70; i++) {
    const d = document.createElement('div');
    d.className = 'confetti';
    d.style.left = Math.random() * 100 + 'vw';
    d.style.background = cols[i % cols.length];
    d.style.animationDelay = Math.random() * 0.6 + 's';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 3400);
  }
  vibrate([60, 40, 120]);
}

export function vibrate(p: number | number[]) {
  try { navigator.vibrate?.(p); } catch { /* iPhone no permite vibrar desde la web */ }
}

export function Spinner() { return <div className="spinner" aria-label="Cargando" />; }

/* ── Opción grande seleccionable ── */
export function Opt({ on, onClick, icon, title, hint, right }: { on: boolean; onClick: () => void; icon?: string; title: ReactNode; hint?: ReactNode; right?: ReactNode }) {
  return (
    <button type="button" className={`opt${on ? ' on' : ''}`} onClick={onClick} aria-pressed={on}>
      {icon && <div className="ico"><Icon name={icon} /></div>}
      <div className="grow"><b>{title}</b>{hint && <div className="xs muted" style={{ marginTop: 2 }}>{hint}</div>}</div>
      {right ?? <div className="radio" />}
    </button>
  );
}

/* ── Interruptor ── */
export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`switch${on ? ' on' : ''}`} onClick={() => onChange(!on)} />;
}
