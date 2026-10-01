import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useApp } from '../../data/app';
import { useSessions } from '../../data/hooks';
import { EQUIPMENT, PATTERNS, exerciseImage, norm, type CatalogExercise } from '../../data/catalog';
import { fmt, fmtKg } from '../../data/logic';
import { bestE1rm } from '../../core/strength';
import { describeSets } from '../../core/progression';
import { MUSCLE_NAMES, VOLUME_GROUPS } from '../../core/volume';
import { relativeDay, todayISO } from '../../core/dates';
import { Icon } from '../../ui/Icon';
import { Header } from '../../ui/kit';
import { LineChart } from '../../ui/chart';
import { Thumb, musclesText } from '../../ui/shared';

export function Library() {
  const { cat } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const [eq, setEq] = useState<string | null>(null);
  const list = useMemo(() => {
    const nq = norm(q);
    const muscles = group ? VOLUME_GROUPS.find(([g]) => g === group)?.[1] ?? [] : null;
    return cat.exercises
      .filter((e) => (!nq || nq.split(/\s+/).every((w) => norm(e.n).includes(w))) && (!muscles || e.m.some((m) => muscles.includes(m))) && (!eq || e.e === eq))
      .sort((a, b) => a.n.localeCompare(b.n));
  }, [cat, q, group, eq]);
  return (
    <div className="page">
      <Header title="Ejercicios" sub={`${list.length} de ${cat.exercises.length}`} back="/entrenar" />
      <div className="search"><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar: press, sentadilla, remo…" /></div>
      <div className="chips" style={{ margin: '12px 0 6px', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 4 }}>
        <button className={!group ? 'on' : ''} onClick={() => setGroup(null)}>Todos</button>
        {VOLUME_GROUPS.map(([g]) => <button key={g} className={group === g ? 'on' : ''} onClick={() => setGroup(g === group ? null : g)} style={{ whiteSpace: 'nowrap' }}>{g}</button>)}
      </div>
      <div className="chips" style={{ marginBottom: 6, flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 4 }}>
        {Object.entries(EQUIPMENT).map(([k, v]) => <button key={k} className={eq === k ? 'on' : ''} onClick={() => setEq(eq === k ? null : k)} style={{ whiteSpace: 'nowrap' }}>{v}</button>)}
      </div>
      {list.map((e) => (
        <button key={e.id} className="res" onClick={() => nav(`/entrenar/ejercicio/${e.id}`)}>
          <Thumb ex={e} />
          <div className="grow"><div className="truncate"><b>{e.n}</b></div><div className="xs muted truncate">{EQUIPMENT[e.e]} · {musclesText(e)}</div></div>
          <Icon name="chev-r" className="faint" />
        </button>
      ))}
      {!list.length && <div className="empty" style={{ marginTop: 12 }}>No hay ejercicios con esos filtros.</div>}
      <p className="xs faint" style={{ marginTop: 16 }}>Imágenes: free-exercise-db (dominio público).</p>
    </div>
  );
}

export function TechniqueContent({ ex }: { ex: CatalogExercise }) {
  const { cat } = useApp();
  const imgs = ex.img.map((_, i) => exerciseImage(cat, ex, i)).filter(Boolean) as string[];
  return (
    <div>
      {imgs.length > 0 && (
        <div className="grid2">
          {imgs.slice(0, 2).map((src, i) => (
            <div key={i} style={{ borderRadius: 16, overflow: 'hidden', background: '#fff', aspectRatio: '4 / 3', border: '1px solid var(--border)' }}>
              <img src={src} alt={`${ex.n}, posición ${i + 1}`} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ))}
        </div>
      )}
      <div className="chips" style={{ marginBottom: 12 }}>
        {ex.m.map((m) => <span key={m} className="chip hot">{MUSCLE_NAMES[m] ?? m}</span>)}
        {ex.s.map((m) => <span key={m} className="chip">{MUSCLE_NAMES[m] ?? m}</span>)}
      </div>
      <div className="xs muted" style={{ marginBottom: 12 }}>{PATTERNS[ex.p] ?? ex.p} · {EQUIPMENT[ex.e] ?? ex.e}{ex.u ? ' · unilateral' : ''}</div>
      {ex.t.length > 0 && (
        <>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Claves</div>
          {ex.t.map((t, i) => <div key={i} className="row small" style={{ alignItems: 'flex-start', padding: '4px 0' }}><Icon name="check" size={16} className="ok" style={{ marginTop: 2 }} /><span>{t}</span></div>)}
        </>
      )}
      {ex.x.length > 0 && (
        <>
          <div className="eyebrow" style={{ margin: '12px 0 6px' }}>Errores comunes</div>
          {ex.x.map((t, i) => <div key={i} className="row small" style={{ alignItems: 'flex-start', padding: '4px 0' }}><Icon name="x" size={16} className="danger" style={{ marginTop: 2 }} /><span>{t}</span></div>)}
        </>
      )}
    </div>
  );
}

export function ExerciseDetail() {
  const { id } = useParams();
  const { cat } = useApp();
  const sessions = useSessions();
  const ex = id ? cat.exById.get(id) : undefined;
  const history = useMemo(() => sessions
    .filter((s) => s.status === 'terminada')
    .flatMap((s) => s.exercises.filter((e) => e.exId === id && e.sets.some((x) => x.done)).map((e) => ({ s, e, best: bestE1rm(e) })))
    .sort((a, b) => b.s.started_at.localeCompare(a.s.started_at)), [sessions, id]);
  if (!ex) return <div className="page"><Header title="Ejercicio" /><div className="empty">Este ejercicio no existe.</div></div>;
  const points = [...history].reverse().filter((h) => h.best).map((h) => ({ date: h.s.date, y: h.best!.e1rm }));
  const top = history.reduce<{ e1rm: number; kg: number; reps: number; date: string } | null>((acc, h) => (h.best && (!acc || h.best.e1rm > acc.e1rm) ? { ...h.best, date: h.s.date } : acc), null);
  const today = todayISO();
  return (
    <div className="page">
      <Header title={ex.n} />
      <TechniqueContent ex={ex} />
      <div className="divider" style={{ margin: '18px 0' }} />
      <div className="h2" style={{ marginBottom: 10 }}>Tu historial</div>
      {history.length === 0 ? <div className="empty">Aún no registras este ejercicio. Cuando lo hagas, aquí verás tu 1RM estimado y tu progreso.</div> : (
        <>
          <div className="grid2">
            <div className="stat"><div className="xs muted">1RM estimado máx.</div><div className="num">{top ? `${fmtKg(top.e1rm)} kg` : '–'}</div><div className="xs faint">{top ? `${fmtKg(top.kg)} × ${top.reps} · ${relativeDay(top.date, today)}` : ''}</div></div>
            <div className="stat"><div className="xs muted">Sesiones</div><div className="num">{history.length}</div><div className="xs faint">con este ejercicio</div></div>
          </div>
          {points.length > 1 && <div className="card"><div className="xs muted" style={{ marginBottom: 6 }}>1RM estimado (Epley)</div><LineChart points={points} /></div>}
          <div className="list">
            {history.slice(0, 20).map(({ s, e, best }) => (
              <div key={s.id + e.uid} className="li">
                <div className="grow">
                  <b className="small">{relativeDay(s.date, today)}</b> <span className="xs muted">· {s.day_name}</span>
                  <div className="small">{describeSets(e.sets) ?? '–'}</div>
                </div>
                {best && <span className="xs muted" style={{ whiteSpace: 'nowrap' }}>1RM {fmt(best.e1rm, 1)}</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
