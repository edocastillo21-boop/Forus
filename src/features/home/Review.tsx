// Tarjeta de la revisión semanal (aparece el domingo y queda hasta que decides qué hacer).
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../../data/app';
import { useCheckin } from '../../data/hooks';
import { adjustedPhase, blockStartOf, saveCheckin, startPhase } from '../../data/actions';
import { fmt, fmtKg, totals } from '../../data/logic';
import type { Targeter } from '../../data/targets';
import type { BodyWeight, FoodLog, Phase } from '../../data/types';
import { DAMPING, MAX_STEP, reviewAnchor, weeklyReview, type Review } from '../../core/review';
import { KCAL_PER_KG, kcalFloor } from '../../core/plan';
import { addDays, shortDate } from '../../core/dates';
import { Icon } from '../../ui/Icon';
import { Sheet, confetti, useToast } from '../../ui/kit';

export const fmtRate = (x: number) => `${x >= 0 ? '+' : '−'}${fmt(Math.abs(x), 2)} kg/sem`;

export function useWeeklyReview(o: { today: string; phase: Phase | undefined; phases: Phase[]; weights: BodyWeight[]; logs: FoodLog[]; targetFor: Targeter }): Review | null {
  const { profile } = useApp();
  const anchor = reviewAnchor(o.today);
  return useMemo(() => {
    const ph = o.phase;
    if (!ph) return null;
    const byDate = new Map<string, FoodLog[]>();
    for (const l of o.logs) { if (!byDate.has(l.date)) byDate.set(l.date, []); byDate.get(l.date)!.push(l); }
    const days: { date: string; kcal: number; target: number }[] = [];
    for (const [date, ls] of byDate) {
      const tg = o.targetFor(date);
      if (tg) days.push({ date, kcal: totals(ls).kcal, target: tg.kcal });
    }
    return weeklyReview({
      anchor, blockStart: blockStartOf(ph), expectedRate: ph.type === 'volumen' || ph.type === 'definicion' ? ph.rate_kg_week : 0,
      goalWeight: ph.goal_weight, currentKcal: ph.kcal, floorKcal: kcalFloor(profile.sex),
      weights: o.weights.map((w) => ({ date: w.date, weight: w.weight_kg })), days,
    });
  }, [o.phase, o.logs, o.weights, o.targetFor, anchor, profile.sex]);
}

export function ReviewCard({ review: r, phase, phases, today }: { review: Review | null; phase: Phase | undefined; phases: Phase[]; today: string }) {
  const anchor = reviewAnchor(today);
  const checkin = useCheckin(anchor);
  const nav = useNavigate();
  const toast = useToast();
  const [why, setWhy] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!r || !phase || checkin !== null || r.status === 'pronto') return null;

  const data = { ...r } as unknown as Record<string, unknown>;
  const close = (status: 'visto' | 'esperar') => saveCheckin(anchor, { phase_id: phase.id, status, delta_kcal: 0, data });
  async function apply() {
    if (!r || !phase) return;
    setBusy(true);
    try {
      const next = adjustedPhase(phase, r.delta, today);
      await startPhase(phases, next, addDays(today, -1));
      await saveCheckin(anchor, { phase_id: next.id, status: 'aplicado', delta_kcal: r.delta, data });
      toast(`Plan ajustado: ${fmt(next.kcal)} kcal de promedio`);
    } finally { setBusy(false); }
  }

  const period = `${shortDate(r.from)} – ${shortDate(r.to)}`;
  let icon = 'chart';
  let title = 'Revisión semanal';
  let body: React.ReactNode = null;
  let actions: React.ReactNode = <button className="btn btn-soft btn-sm grow" onClick={() => void close('visto')}>Entendido</button>;

  if (r.status === 'faltan_datos') {
    body = <>Para ajustar tu plan con datos reales necesitamos más registros. En las últimas 2 semanas: <b>{r.weighIns} de {r.needWeighIns} pesajes</b> y <b>{r.loggedDays} de {r.needLogged} días</b> con la comida anotada. Esta semana intenta pesarte 4 veces y registrar al menos 5 días.</>;
  } else if (r.status === 'comer_objetivo') {
    body = <>Comiste en promedio <b>{fmt(r.intake!)} kcal</b>, lejos de tu objetivo ({fmt(r.targetAvg!)}). Antes de cambiar el plan, intenta acercarte a tu objetivo esta semana: así sabremos si el número es el correcto.</>;
  } else if (r.status === 'en_rango') {
    icon = 'check';
    title = 'Vas en línea';
    body = <>Tu peso va a <b>{fmtRate(r.rate!)}</b> (objetivo {r.expected ? fmtRate(r.expected) : 'mantener'}). Seguimos con el mismo plan.</>;
  } else if (r.status === 'meta') {
    icon = 'trophy';
    title = '¡Llegaste a tu meta!';
    body = <>Tu promedio está en <b>{fmtKg(Math.round(r.weight! * 10) / 10)} kg</b> y tu objetivo era {fmtKg(phase.goal_weight)} kg. Es buen momento para una fase de mantención que consolide lo logrado.</>;
    actions = (
      <>
        <button className="btn btn-primary btn-sm grow" onClick={async () => { await close('visto'); confetti(); nav('/perfil?fase=1'); }}>Cambiar objetivo</button>
        <button className="btn btn-soft btn-sm grow" onClick={() => void close('visto')}>Seguir igual</button>
      </>
    );
  } else if (r.status === 'ajuste') {
    const up = r.delta > 0;
    body = (
      <>
        Tu peso va a <b>{fmtRate(r.rate!)}</b> y el objetivo es {r.expected ? fmtRate(r.expected) : 'mantenerlo'}. Te proponemos <b className="accent">{up ? '+' : '−'}{fmt(Math.abs(r.delta))} kcal al día</b>, todo en carbohidratos ({up ? '+' : '−'}{fmt(Math.abs(r.delta / 4))} g).
      </>
    );
    actions = (
      <>
        <button className="btn btn-primary btn-sm grow" disabled={busy} onClick={() => void apply()}>Aplicar</button>
        <button className="btn btn-soft btn-sm grow" onClick={() => void close('esperar')}>Esperar una semana</button>
      </>
    );
  }

  return (
    <div className={`card${r.status === 'ajuste' || r.status === 'meta' ? ' hero' : ''}`}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <span className="icon-btn" style={{ width: 40, height: 40, color: 'var(--primary-text)' }}><Icon name={icon} size={20} /></span>
        <div className="grow">
          <div className="row between"><b>{title}</b>{r.rate != null && <button className="link" onClick={() => setWhy(true)}>¿Por qué?</button>}</div>
          <div className="xs faint">Revisión del {period}</div>
          <p className="small muted" style={{ marginTop: 6 }}>{body}</p>
        </div>
      </div>
      <div className="row" style={{ marginTop: 12 }}>{actions}</div>
      <Sheet open={why} onClose={() => setWhy(false)} title="Cómo se calcula">
        <ReviewDetail r={r} />
      </Sheet>
    </div>
  );
}

function ReviewDetail({ r }: { r: Review }) {
  const rows: [string, string][] = [
    ['Período revisado', `${shortDate(r.from)} – ${shortDate(r.to)} (${r.days} días)`],
    ['Pesajes · días con comida', `${r.weighIns} · ${r.loggedDays}`],
  ];
  if (r.rate != null) rows.push(['Tendencia del peso', `${fmtRate(r.rate)} (objetivo ${r.expected ? fmtRate(r.expected) : '0'})`]);
  if (r.intake != null) rows.push(['Comiste en promedio', `${fmt(r.intake)} kcal (objetivo ${fmt(r.targetAvg ?? 0)})`]);
  if (r.tdee != null) rows.push(['Tu gasto real estimado', `${fmt(r.tdee)} kcal`]);
  if (r.tdee != null && r.status === 'ajuste') {
    rows.push([`Para ${r.expected ? fmtRate(r.expected) : 'mantener el peso'} necesitas`, `~${fmt(r.tdee + (r.expected * KCAL_PER_KG) / 7)} kcal`]);
    rows.push(['Propuesta', `${r.delta > 0 ? '+' : '−'}${fmt(Math.abs(r.delta))} kcal → ${fmt(r.newKcal ?? 0)} kcal de promedio`]);
  }
  return (
    <>
      {rows.map(([l, v]) => <div key={l} className="row between small" style={{ padding: '6px 0' }}><span className="muted grow">{l}</span><b style={{ textAlign: 'right' }}>{v}</b></div>)}
      <div className="divider" />
      <p className="small muted">
        El gasto real sale de lo que comiste y de cuánto cambió tu peso: cada kilo equivale a unas {fmt(KCAL_PER_KG)} kcal. Si comiste {fmt(r.intake ?? 0)} kcal y tu peso cambió {r.rate != null ? fmtRate(r.rate) : '–'}, tu cuerpo gastó unas {fmt(r.tdee ?? 0)} kcal al día.
      </p>
      <p className="small muted" style={{ marginTop: 8 }}>
        Para no reaccionar a cambios de agua o sal, el ajuste corrige el {fmt(DAMPING * 100)} % de la diferencia y como máximo {MAX_STEP} kcal por semana. Todo el cambio va a los carbohidratos; la proteína y la grasa se mantienen.
        Solo se propone un ajuste con al menos 4 pesajes y 5 días de comida registrados por semana, y si lo que comiste estuvo cerca de tu objetivo.
      </p>
    </>
  );
}
