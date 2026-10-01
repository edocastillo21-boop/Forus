import { useNavigate } from 'react-router';
import { useApp, useToday } from '../../data/app';
import { useTodayPlan } from '../../data/today';
import { useTargets } from '../../data/targets';
import { fmt } from '../../data/logic';
import { relativeDay, WEEKDAYS } from '../../core/dates';
import { plannedForDay } from '../../core/schedule';
import { Icon } from '../../ui/Icon';
import { SyncBadge } from '../../ui/kit';
import { ActiveSessionBanner, TodayWorkoutCard, elapsedText } from './today';

export function TrainHome() {
  const today = useToday();
  const tp = useTodayPlan(today);
  const targetFor = useTargets(today);
  const nav = useNavigate();
  const { cat } = useApp();
  const recent = tp.sessions.filter((s) => s.status === 'terminada').sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 3);
  const meso = tp.meso;
  const routine = tp.routine;
  const week = meso ? tp.planned?.week ?? plannedForDay(meso, today, 0).week : null;

  return (
    <div className="page">
      <div className="row between" style={{ marginBottom: 16 }}>
        <div className="h1">Entrenar</div>
        <SyncBadge />
      </div>

      <ActiveSessionBanner session={tp.active} />
      <TodayWorkoutCard tp={tp} today={today} target={targetFor(today)} />

      {meso && routine && (
        <button className="card" style={{ width: '100%', textAlign: 'left' }} onClick={() => nav(`/entrenar/rutina/${routine.id}`)}>
          <div className="row between">
            <div className="grow">
              <div className="eyebrow">Mesociclo</div>
              <div className="h2 truncate" style={{ marginTop: 2 }}>{routine.name}</div>
            </div>
            <Icon name="chev-r" className="faint" />
          </div>
          <div className="row" style={{ gap: 4, margin: '12px 0 10px' }}>
            {Array.from({ length: meso.weeks }, (_, i) => {
              const w = i + 1;
              const cur = week === w;
              return (
                <div key={i} className="grow" style={{ textAlign: 'center' }}>
                  <div style={{ height: 6, borderRadius: 9, background: cur ? 'var(--primary)' : week && w < week ? 'var(--primary-line)' : 'var(--surface-3)' }} />
                  <div className="xs" style={{ marginTop: 4, color: cur ? 'var(--primary-text)' : 'var(--faint)' }}>{meso.deload_week === w ? 'Desc.' : `RIR ${meso.rir_plan[i] ?? '–'}`}</div>
                </div>
              );
            })}
          </div>
          <div className="small muted">
            {Object.entries(meso.schedule).sort(([a], [b]) => Number(a) - Number(b)).map(([d, idx]) => `${WEEKDAYS[Number(d)].slice(0, 3)}: ${routine.days[idx]?.name ?? '–'}`).join(' · ')}
          </div>
        </button>
      )}

      <div className="list">
        <button className="li" onClick={() => nav('/entrenar/rutinas')}><span className="ico"><Icon name="list" /></span><span className="grow"><b>Mis rutinas</b><div className="xs muted">Plantillas, editor y mesociclo</div></span><Icon name="chev-r" className="faint" /></button>
        <button className="li" onClick={() => nav('/entrenar/ejercicios')}><span className="ico"><Icon name="book" /></span><span className="grow"><b>Ejercicios</b><div className="xs muted">{cat.exercises.length} ejercicios con técnica y errores comunes</div></span><Icon name="chev-r" className="faint" /></button>
        <button className="li" onClick={() => nav('/entrenar/historial')}><span className="ico"><Icon name="history" /></span><span className="grow"><b>Historial</b><div className="xs muted">Todas tus sesiones</div></span><Icon name="chev-r" className="faint" /></button>
      </div>

      {recent.length > 0 && (
        <>
          <div className="eyebrow" style={{ margin: '18px 0 8px' }}>Últimas sesiones</div>
          <div className="list">
            {recent.map((s) => (
              <button key={s.id} className="li" onClick={() => nav(`/entrenar/resumen/${s.id}`)}>
                <div className="grow">
                  <b>{s.day_name}</b>
                  <div className="xs muted">{relativeDay(s.date, today)} · {elapsedText(s.started_at, s.ended_at)} · {fmt(s.volume_kg)} kg · {s.sets_done} series</div>
                </div>
                {s.prs.length > 0 && <span className="badge"><Icon name="trophy" size={12} style={{ display: 'inline', verticalAlign: -2 }} /> {s.prs.length}</span>}
                <Icon name="chev-r" className="faint" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
