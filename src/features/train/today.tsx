// Tarjetas de "qué entreno hoy" usadas en Inicio y en Entrenar.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../../data/app';
import type { TodayPlan } from '../../data/today';
import { newSession, fmt } from '../../data/logic';
import { put } from '../../data/store';
import { nextDayIndex, plannedForDay, type Planned } from '../../core/schedule';
import type { RoutineDay, WorkoutSession } from '../../data/types';
import type { DayTarget } from '../../data/targets';
import { KIND_INFO } from '../../core/cycling';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/kit';

export function estimateMinutes(day: RoutineDay): number {
  let s = 0;
  for (const ex of day.exercises) for (const _ of ex.sets) s += 45 + (ex.group ? ex.rest / 2 : ex.rest);
  return Math.max(10, Math.round(s / 60 / 5) * 5);
}

export function elapsedText(startISO: string, endISO?: string | null): string {
  const ms = (endISO ? new Date(endISO).getTime() : Date.now()) - new Date(startISO).getTime();
  const min = Math.max(0, Math.floor(ms / 60000));
  return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`;
}

/** Crea la sesión (o devuelve la que ya está en curso) y abre el modo sesión. */
export function useStartWorkout(tp: TodayPlan, today: string) {
  const { cat } = useApp();
  const nav = useNavigate();
  return async (dayIndex: number | null, planned: Planned | null) => {
    if (tp.active) { nav(`/entrenar/sesion/${tp.active.id}`); return; }
    const s = newSession({
      cat, sessions: tp.sessions, routine: dayIndex == null ? null : tp.routine, meso: dayIndex == null ? null : tp.meso ?? null,
      dayIndex, date: today, planned, bodyweight: tp.weight?.weight_kg ?? null,
    });
    await put('workout_sessions', s);
    nav(`/entrenar/sesion/${s.id}`);
  };
}

export function ActiveSessionBanner({ session }: { session: WorkoutSession | null }) {
  const nav = useNavigate();
  const [, tick] = useState(0);
  useEffect(() => { const iv = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(iv); }, []);
  if (!session) return null;
  return (
    <button className="card hero row" style={{ width: '100%', textAlign: 'left' }} onClick={() => nav(`/entrenar/sesion/${session.id}`)}>
      <div className="icon-btn" style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}><Icon name="play" /></div>
      <div className="grow">
        <div className="eyebrow" style={{ color: 'var(--primary-text)' }}>Sesión en curso</div>
        <b>{session.day_name}</b> <span className="muted small">· {elapsedText(session.started_at)}</span>
      </div>
      <span className="link">Continuar</span>
    </button>
  );
}

export function TodayWorkoutCard({ tp, today, target }: { tp: TodayPlan; today: string; target?: DayTarget | null }) {
  const { cat } = useApp();
  const nav = useNavigate();
  const start = useStartWorkout(tp, today);
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState(false);
  const go = async (dayIndex: number | null, planned: Planned | null) => { setBusy(true); try { await start(dayIndex, planned); } finally { setBusy(false); } };

  if (tp.active) return null; // el banner de sesión en curso ya lo muestra

  const done = tp.doneToday[0];
  if (done) {
    return (
      <button className="card row" style={{ width: '100%', textAlign: 'left' }} onClick={() => nav(`/entrenar/resumen/${done.id}`)}>
        <div className="icon-btn" style={{ background: 'var(--ok)', color: 'var(--on-ok)' }}><Icon name="check" /></div>
        <div className="grow">
          <div className="eyebrow">Entrenamiento hecho</div>
          <b>{done.day_name}</b>
          <div className="xs muted">{fmt(done.volume_kg)} kg de volumen · {done.sets_done} series{done.prs.length ? ` · ${done.prs.length} récord${done.prs.length > 1 ? 's' : ''}` : ''}</div>
        </div>
        <Icon name="chev-r" className="faint" />
      </button>
    );
  }

  if (!tp.meso || !tp.routine) {
    return (
      <div className="card">
        <div className="eyebrow">Entrenamiento</div>
        <div className="h2" style={{ margin: '4px 0 6px' }}>Aún no tienes una rutina activa</div>
        <p className="small muted" style={{ marginBottom: 12 }}>Elige una plantilla o arma la tuya. También puedes registrar un entrenamiento libre.</p>
        <div className="row">
          <button className="btn btn-primary btn-sm grow" onClick={() => nav('/entrenar/rutinas')}>Elegir rutina</button>
          <button className="btn btn-soft btn-sm" onClick={() => go(null, null)} disabled={busy}>Libre</button>
        </div>
      </div>
    );
  }

  const meso = tp.meso;
  const routine = tp.routine;
  const lastIdx = tp.sessions.filter((s) => s.status === 'terminada' && s.routine_id === routine.id).sort((a, b) => b.started_at.localeCompare(a.started_at))[0]?.day_index;
  const suggested = nextDayIndex(routine.days.length, lastIdx);

  const picker = (
    <Sheet open={pick} onClose={() => setPick(false)} title="¿Qué entrenas hoy?">
      {routine.days.map((d, i) => (
        <button key={d.id} className="opt" onClick={() => { setPick(false); void go(i, plannedForDay(meso, today, i)); }}>
          <div className="grow"><b>{d.name}</b><div className="xs muted">{d.exercises.length} ejercicios · ~{estimateMinutes(d)} min</div></div>
          {i === suggested && <span className="badge">Sigue</span>}
        </button>
      ))}
      <button className="opt" onClick={() => { setPick(false); void go(null, null); }}>
        <div className="grow"><b>Entrenamiento libre</b><div className="xs muted">Sin rutina: agregas los ejercicios sobre la marcha</div></div>
      </button>
    </Sheet>
  );

  if (!tp.planned || !tp.day) {
    return (
      <div className="card">
        <div className="eyebrow">Hoy</div>
        <div className="h2" style={{ margin: '4px 0 6px' }}>Día de descanso</div>
        <p className="small muted" style={{ marginBottom: 12 }}>El músculo crece mientras descansas. Si igual quieres entrenar, elige el día.</p>
        <button className="btn btn-soft btn-sm" onClick={() => setPick(true)} disabled={busy}><Icon name="dumbbell" size={18} />Entrenar igual</button>
        {picker}
      </div>
    );
  }

  const p = tp.planned;
  const day = tp.day;
  return (
    <div className="card hero">
      <div className="row between">
        <div className="eyebrow" style={{ color: 'var(--primary-text)' }}>Hoy toca</div>
        <span className="badge">{p.deload ? 'Descarga' : p.rir != null ? `RIR ${p.rir}` : 'Semana ' + p.week}</span>
      </div>
      <div className="h1" style={{ margin: '6px 0 2px' }}>{day.name}</div>
      <div className="small muted">Semana {p.week} de {meso.weeks} · {day.exercises.length} ejercicios · ~{estimateMinutes(day)} min</div>
      {target?.cycled && target.from === 'plan' && target.delta !== 0 && (
        <div className="small" style={{ marginTop: 6 }}>
          <Icon name="zap" size={14} style={{ display: 'inline', verticalAlign: -2, color: 'var(--carb)' }} /> {KIND_INFO[target.kind].label}, demanda {KIND_INFO[target.kind].demand}: {target.delta > 0 ? '+' : '−'}{fmt(Math.abs(target.delta))} g de carbohidratos hoy
        </div>
      )}
      <div className="xs muted" style={{ margin: '10px 0 14px' }}>{day.exercises.slice(0, 5).map((e) => cat.exById.get(e.exId)?.n ?? 'Ejercicio').join(' · ')}{day.exercises.length > 5 ? '…' : ''}</div>
      <button className="btn btn-primary" onClick={() => go(p.dayIndex, p)} disabled={busy}><Icon name="play" size={18} />Empezar entrenamiento</button>
      <div style={{ textAlign: 'center', marginTop: 10 }}><button className="link" onClick={() => setPick(true)}>Hacer otro día</button></div>
      {picker}
    </div>
  );
}
