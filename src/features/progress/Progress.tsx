import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp, useToday } from '../../data/app';
import { usePhases, useSessions, useWeights } from '../../data/hooks';
import { currentPhase, fmt, fmtKg } from '../../data/logic';
import { remove } from '../../data/store';
import type { BodyWeight } from '../../data/types';
import { addDays, daysBetween, relativeDay, shortDate, startOfWeek } from '../../core/dates';
import { GOALS } from '../../core/plan';
import { bestE1rm } from '../../core/strength';
import { movingAverage, weeklyRate } from '../../core/trend';
import { weeklySets } from '../../core/volume';
import { Icon } from '../../ui/Icon';
import { Seg, SyncBadge, useToast } from '../../ui/kit';
import { LineChart } from '../../ui/chart';
import { Thumb, WeightSheet } from '../../ui/shared';
import { blockStartOf } from '../../data/actions';
import { Measures } from './Measures';
import { Photos } from './Photos';

type Tab = 'cuerpo' | 'medidas' | 'fotos' | 'fuerza' | 'musculos';

const TABS: [Tab, string][] = [['cuerpo', 'Peso'], ['medidas', 'Medidas'], ['fotos', 'Fotos'], ['fuerza', 'Fuerza'], ['musculos', 'Series']];

export function Progress() {
  const [tab, setTab] = useState<Tab>(() => { try { return (sessionStorage.getItem('forus-prog-tab') as Tab) || 'cuerpo'; } catch { return 'cuerpo'; } });
  const pick = (t: Tab) => { setTab(t); try { sessionStorage.setItem('forus-prog-tab', t); } catch { /* sin almacenamiento */ } };
  return (
    <div className="page">
      <div className="row between" style={{ marginBottom: 14 }}>
        <div className="h1">Progreso</div>
        <SyncBadge />
      </div>
      <div className="tabs" style={{ margin: '0 0 14px' }}>
        {TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => pick(k)}>{l}</button>)}
      </div>
      {tab === 'cuerpo' && <Body />}
      {tab === 'medidas' && <Measures />}
      {tab === 'fotos' && <Photos />}
      {tab === 'fuerza' && <Strength />}
      {tab === 'musculos' && <Muscles />}
    </div>
  );
}

function Body() {
  const today = useToday();
  const toast = useToast();
  const weights = useWeights();
  const phases = usePhases();
  const ph = currentPhase(phases, today);
  const [range, setRange] = useState<30 | 90 | 0>(90);
  const [sheet, setSheet] = useState<{ date: string; kg: number } | null>(null);
  const trend = useMemo(() => movingAverage(weights.map((w) => ({ date: w.date, weight: w.weight_kg }))), [weights]);
  const rate = weeklyRate(trend);
  const last = trend[trend.length - 1];
  const from = range ? addDays(today, -range) : '0000';
  const pts = trend.filter((p) => p.date >= from).map((p) => ({ date: p.date, y: p.weight, line: Math.round(p.avg * 100) / 100 }));
  const sincePhase = ph && last ? last.avg - ph.start_weight : null;
  const phaseWeek = ph ? Math.floor(daysBetween(blockStartOf(ph), today) / 7) + 1 : null;
  const target = ph?.rate_kg_week ?? 0;
  const onTrack = rate != null && ph ? (target === 0 ? Math.abs(rate) <= 0.15 : target > 0 ? rate >= target * 0.5 && rate <= target * 1.6 : rate <= target * 0.5 && rate >= target * 1.6) : null;

  return (
    <>
      <div className="grid3">
        <div className="stat"><div className="xs muted">Promedio 7 d</div><div className="num">{last ? fmtKg(Math.round(last.avg * 10) / 10) : '–'}</div></div>
        <div className="stat"><div className="xs muted">Ritmo/sem</div><div className="num" style={{ color: onTrack == null ? undefined : onTrack ? 'var(--ok)' : 'var(--warn)' }}>{rate != null ? `${rate >= 0 ? '+' : '−'}${fmt(Math.abs(rate), 2)}` : '–'}</div></div>
        <div className="stat"><div className="xs muted">En la fase{phaseWeek ? ` (sem ${phaseWeek})` : ''}</div><div className="num">{sincePhase != null ? `${sincePhase >= 0 ? '+' : '−'}${fmt(Math.abs(sincePhase), 1)}` : '–'}</div></div>
      </div>
      <div className="card">
        <div className="row between" style={{ marginBottom: 8 }}>
          <span className="xs muted">Puntos: pesajes · línea: promedio de 7 días</span>
          <div className="chips">
            {([30, 90, 0] as const).map((r) => <button key={r} className={range === r ? 'on' : ''} style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => setRange(r)}>{r ? `${r} d` : 'Todo'}</button>)}
          </div>
        </div>
        <LineChart points={pts} />
        {ph && (
          <p className="small muted" style={{ marginTop: 10 }}>
            {GOALS[ph.type].short}: objetivo {target ? `${target > 0 ? '+' : '−'}${fmt(Math.abs(target), 2)} kg/sem` : 'mantener'}.
            {rate == null ? ' El ritmo real aparece con al menos 10 días de pesajes.' : onTrack ? ' Vas en línea con tu plan.' : ' Vas fuera del rango: la revisión del domingo te propondrá un ajuste si se mantiene.'}
          </p>
        )}
      </div>
      <button className="btn btn-primary" onClick={() => setSheet({ date: today, kg: weights[weights.length - 1]?.weight_kg ?? 70 })}><Icon name="weight" size={18} />Registrar peso de hoy</button>

      {weights.length > 0 && (
        <>
          <div className="eyebrow" style={{ margin: '18px 0 8px' }}>Pesajes</div>
          <div className="list">
            {[...weights].reverse().slice(0, 30).map((w: BodyWeight) => (
              <div key={w.id} className="li">
                <button className="grow row" style={{ textAlign: 'left' }} onClick={() => setSheet({ date: w.date, kg: w.weight_kg })}>
                  <span className="grow">{relativeDay(w.date, today)}</span>
                  <b className="num" style={{ fontSize: 18 }}>{fmtKg(w.weight_kg)} kg</b>
                </button>
                <button className="icon-btn" style={{ width: 36, height: 36 }} aria-label="Eliminar pesaje" onClick={async () => { await remove('body_weights', w.id); toast('Pesaje eliminado'); }}><Icon name="trash" size={16} /></button>
              </div>
            ))}
          </div>
        </>
      )}

      {phases.length > 0 && (
        <>
          <div className="eyebrow" style={{ margin: '18px 0 8px' }}>Fases</div>
          <div className="list">
            {[...phases].sort((a, b) => b.start_date.localeCompare(a.start_date)).map((p) => (
              <div key={p.id} className="li">
                <div className="grow"><b>{p.notes?.startsWith('Ajuste') ? p.notes : GOALS[p.type].short}</b><div className="xs muted">{shortDate(p.start_date)} – {p.end_date ? shortDate(p.end_date) : 'hoy'} · {fmt(p.kcal)} kcal · {p.protein_g} g prot.</div></div>
                {p.status === 'activa' && <span className="badge">Actual</span>}
              </div>
            ))}
          </div>
        </>
      )}
      {sheet && <WeightSheet key={sheet.date} open onClose={() => setSheet(null)} date={sheet.date} initial={sheet.kg} />}
    </>
  );
}

function Strength() {
  const { cat } = useApp();
  const nav = useNavigate();
  const today = useToday();
  const sessions = useSessions();
  const rows = useMemo(() => {
    const map = new Map<string, { exId: string; best: number; last: number; lastDate: string; before: number | null; count: number }>();
    const cutoff = addDays(today, -28);
    const done = sessions.filter((s) => s.status === 'terminada').sort((a, b) => a.started_at.localeCompare(b.started_at));
    for (const s of done) {
      for (const e of s.exercises) {
        const b = bestE1rm(e);
        if (!b) continue;
        const cur = map.get(e.exId) ?? { exId: e.exId, best: 0, last: 0, lastDate: s.date, before: null, count: 0 };
        cur.best = Math.max(cur.best, b.e1rm);
        cur.last = b.e1rm;
        cur.lastDate = s.date;
        cur.count++;
        if (s.date <= cutoff) cur.before = Math.max(cur.before ?? 0, b.e1rm);
        map.set(e.exId, cur);
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count || b.best - a.best);
  }, [sessions, today]);
  const prs = sessions.filter((s) => s.status === 'terminada').flatMap((s) => s.prs.map((p) => ({ ...p, date: s.date, sid: s.id }))).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  if (!rows.length) return <div className="empty">Termina tu primera sesión para ver tu 1RM estimado por ejercicio.</div>;
  return (
    <>
      <p className="xs muted" style={{ marginBottom: 10 }}>1RM estimado con Epley a partir de tu mejor serie (hasta 12 repeticiones). Cambio respecto de hace 4 semanas.</p>
      <div className="list">
        {rows.map((r) => {
          const ex = cat.exById.get(r.exId);
          const diff = r.before ? r.best - r.before : null;
          return (
            <button key={r.exId} className="li" onClick={() => nav(`/entrenar/ejercicio/${r.exId}`)}>
              <Thumb ex={ex} size={40} />
              <div className="grow"><div className="truncate"><b>{ex?.n ?? 'Ejercicio'}</b></div><div className="xs muted">{r.count} {r.count === 1 ? 'sesión' : 'sesiones'} · última {relativeDay(r.lastDate, today)}</div></div>
              <div style={{ textAlign: 'right' }}>
                <div className="num" style={{ fontSize: 20 }}>{fmtKg(r.best)}</div>
                {diff != null && <div className={`xs ${diff > 0 ? 'ok' : 'muted'}`}>{diff > 0 ? '+' : diff < 0 ? '−' : ''}{fmt(Math.abs(diff), 1)} kg</div>}
              </div>
            </button>
          );
        })}
      </div>
      {prs.length > 0 && (
        <>
          <div className="eyebrow" style={{ margin: '18px 0 8px' }}>Últimos récords</div>
          <div className="list">
            {prs.map((p, i) => (
              <button key={i} className="li" onClick={() => nav(`/entrenar/resumen/${p.sid}`)}>
                <span className="ico" style={{ color: 'var(--primary-text)' }}><Icon name="trophy" /></span>
                <div className="grow"><b className="truncate">{cat.exById.get(p.exId)?.n}</b><div className="xs muted">{fmtKg(p.kg)} kg × {p.reps} · {relativeDay(p.date, today)}</div></div>
                <span className="num" style={{ fontSize: 18 }}>{fmtKg(p.e1rm)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function Muscles() {
  const { cat } = useApp();
  const today = useToday();
  const sessions = useSessions();
  const [which, setWhich] = useState<0 | 1>(0);
  const from = addDays(startOfWeek(today), -7 * which);
  const to = addDays(from, 6);
  const sets = useMemo(() => weeklySets(sessions.filter((s) => s.date >= from && s.date <= to), (id) => cat.exById.get(id)), [sessions, from, to, cat]);
  const MAX = 24;
  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Seg options={[{ value: 0 as const, label: 'Esta semana' }, { value: 1 as const, label: 'Semana pasada' }]} value={which} onChange={setWhich} />
      </div>
      <div className="card">
        <div className="xs muted" style={{ marginBottom: 6 }}>{shortDate(from)} – {shortDate(to)} · franja verde: 10 a 20 series</div>
        {[...sets.entries()].map(([name, n]) => (
          <div key={name} className="vol">
            <span className="truncate">{name}</span>
            <div className="vtrack">
              <div className="vband" style={{ left: `${(10 / MAX) * 100}%`, width: `${(10 / MAX) * 100}%` }} />
              <div className={`vfill${n < 10 ? ' low' : ''}`} style={{ width: `${Math.min(100, (n / MAX) * 100)}%` }} />
            </div>
            <b className="num" style={{ fontSize: 16, textAlign: 'right' }}>{fmt(n, n % 1 ? 1 : 0)}</b>
          </div>
        ))}
      </div>
      <p className="small muted">
        Cuentan las series efectivas terminadas con RIR 4 o menos: 1 si el músculo es el principal del ejercicio y 0,5 si es secundario.
        Para crecer, la mayoría de las personas necesita entre 10 y 20 por semana por grupo.
      </p>
    </>
  );
}
