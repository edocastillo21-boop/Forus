import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { useApp } from '../../data/app';
import { useFoodLogs, usePhases, useSession, useSessions } from '../../data/hooks';
import { remove } from '../../data/store';
import { fmt, fmtKg, mealsFor, phaseFor, totals } from '../../data/logic';
import { INCREMENT, describeSets, suggestSets } from '../../core/progression';
import { longDate } from '../../core/dates';
import { Icon } from '../../ui/Icon';
import { Header, Spinner, confetti, useToast } from '../../ui/kit';
import { Thumb } from '../../ui/shared';
import { elapsedText } from './today';

export function Summary() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const session = useSession(id);
  const sessions = useSessions();
  const phases = usePhases();
  const logs = useFoodLogs(session?.date ?? '');
  const { cat, profile } = useApp();
  const nav = useNavigate();
  const toast = useToast();
  const fresh = params.get('nuevo') === '1';
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (!fresh || !session || session.status !== 'terminada') return;
    const key = `forus-cel-${session.id}`;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch { /* sin almacenamiento */ }
    if (session.prs.length) confetti();
  }, [fresh, session]);

  const prev = useMemo(() => {
    if (!session) return null;
    return sessions
      .filter((x) => x.id !== session.id && x.status === 'terminada' && x.started_at < session.started_at && (session.routine_id ? x.routine_id === session.routine_id && x.day_index === session.day_index : x.day_name === session.day_name))
      .sort((a, b) => b.started_at.localeCompare(a.started_at))[0] ?? null;
  }, [sessions, session]);

  if (session === undefined) return <div className="center-screen"><Spinner /></div>;
  if (!session || session.deleted_at) return <Navigate to="/entrenar" replace />;
  if (session.status === 'en_curso') return <Navigate to={`/entrenar/sesion/${session.id}`} replace />;

  const ph = phaseFor(phases, session.date);
  const t = totals(logs);
  const kcalLeft = ph ? ph.kcal - t.kcal : null;
  const protLeft = ph ? ph.protein_g - t.protein : null;
  const meals = mealsFor(profile);
  const hhmm = new Date().toTimeString().slice(0, 5);
  const nextMeal = meals.find((m) => m.time >= hhmm) ?? meals[meals.length - 1];
  const volDiff = prev && prev.volume_kg ? ((session.volume_kg - prev.volume_kg) / prev.volume_kg) * 100 : null;

  return (
    <div className="page full">
      {fresh ? <div style={{ height: 8 }} /> : <Header title={session.day_name} sub={longDate(session.date)} />}
      {fresh && (
        <div style={{ textAlign: 'center', margin: '12px 0 18px' }} className="pop">
          <div className="icon-btn" style={{ width: 64, height: 64, borderRadius: 22, margin: '0 auto 12px', background: session.prs.length ? 'var(--primary)' : 'var(--ok)', color: 'var(--on-primary)' }}>
            <Icon name={session.prs.length ? 'trophy' : 'check'} size={30} />
          </div>
          <div className="h1">{session.prs.length ? '¡Nuevo récord!' : '¡Entrenamiento listo!'}</div>
          <p className="muted">{session.day_name} · {longDate(session.date)}</p>
        </div>
      )}

      <div className="grid2">
        <div className="stat"><div className="xs muted">Duración</div><div className="num">{elapsedText(session.started_at, session.ended_at)}</div></div>
        <div className="stat"><div className="xs muted">Volumen</div><div className="num">{fmt(session.volume_kg)} <span className="small muted">kg</span></div>
          {volDiff != null && <div className={`xs ${volDiff >= 0 ? 'ok' : 'muted'}`}>{volDiff >= 0 ? '+' : ''}{fmt(volDiff)} % vs. la vez anterior</div>}
        </div>
        <div className="stat"><div className="xs muted">Series efectivas</div><div className="num">{session.sets_done}</div></div>
        <div className="stat"><div className="xs muted">Récords</div><div className="num">{session.prs.length}</div></div>
      </div>

      {session.prs.length > 0 && (
        <div className="card hero">
          <div className="h2" style={{ marginBottom: 8 }}>Récords de hoy</div>
          {session.prs.map((p) => (
            <div key={p.exId} className="row" style={{ padding: '6px 0' }}>
              <Icon name="trophy" style={{ color: 'var(--primary-text)' }} />
              <div className="grow"><b>{cat.exById.get(p.exId)?.n ?? 'Ejercicio'}</b><div className="xs muted">{fmtKg(p.kg)} kg × {p.reps} · 1RM estimado {fmtKg(p.e1rm)} kg</div></div>
              {p.prev != null && <span className="badge">+{fmtKg(Math.round((p.e1rm - p.prev) * 10) / 10)} kg</span>}
            </div>
          ))}
        </div>
      )}

      {fresh && ph && kcalLeft != null && protLeft != null && (
        <div className="card">
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <Icon name="food" style={{ color: 'var(--primary-text)', marginTop: 2 }} />
            <div className="grow">
              <b>Post-entreno</b>
              <p className="small muted" style={{ marginTop: 2 }}>
                {kcalLeft > 0 ? <>Te quedan <b style={{ color: 'var(--text)' }}>{fmt(kcalLeft)} kcal</b> y <b style={{ color: 'var(--text)' }}>{fmt(Math.max(0, protLeft))} g de proteína</b> hoy.</> : 'Ya llegaste a tus calorías de hoy.'}
                {protLeft > 25 ? ' Una comida con 30–40 g de proteína y carbohidratos te ayuda a recuperarte.' : ''}
              </p>
            </div>
          </div>
          <button className="btn btn-soft" style={{ marginTop: 12 }} onClick={() => nav(`/comer/agregar?d=${session.date}&m=${nextMeal.id}`)}>Registrar en {nextMeal.name}</button>
        </div>
      )}

      <div className="eyebrow" style={{ margin: '16px 0 8px' }}>Ejercicios</div>
      {session.exercises.map((e) => {
        const cex = cat.exById.get(e.exId);
        const done = e.sets.filter((x) => x.done);
        if (!done.length) return null;
        const plan = { uid: e.uid, exId: e.exId, rest: e.rest, sets: e.sets.map((x) => ({ type: x.type, repsMin: x.target?.repsMin ?? x.reps ?? 8, repsMax: x.target?.repsMax ?? x.reps ?? 12, rir: x.target?.rir ?? null })) };
        const next = suggestSets(plan, e, { increment: INCREMENT[cex?.e ?? 'otro'] ?? 2.5, rir: null, deload: false });
        return (
          <div key={e.uid} className="card" style={{ padding: 14 }}>
            <div className="row">
              <Thumb ex={cex} size={44} />
              <div className="grow">
                <b>{cex?.n ?? 'Ejercicio'}</b>
                <div className="small">{describeSets(e.sets) ?? '–'}</div>
                {e.replacedFrom && <div className="xs faint">En lugar de {cat.exById.get(e.replacedFrom)?.n}</div>}
              </div>
            </div>
            {next.note && <div className="xs muted" style={{ marginTop: 8 }}><b className="accent">Próxima vez:</b> {next.note.replace(/^Mantén/, 'mantén').replace(/^Sube/, 'sube').replace(/^Busca/, 'busca')}</div>}
          </div>
        );
      })}

      {session.notes && <div className="hint" style={{ marginBottom: 12 }}><Icon name="note" size={18} /><span>{session.notes}</span></div>}

      <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => (fresh ? nav('/') : nav(-1))}>{fresh ? 'Listo' : 'Volver'}</button>
      {!fresh && (
        <button className="btn btn-danger" style={{ marginTop: 10 }} onClick={async () => {
          if (!confirmDel) { setConfirmDel(true); return; }
          await remove('workout_sessions', session.id);
          toast('Sesión eliminada');
          nav('/entrenar/historial', { replace: true });
        }}>{confirmDel ? 'Toca de nuevo para eliminar' : 'Eliminar sesión'}</button>
      )}
    </div>
  );
}
