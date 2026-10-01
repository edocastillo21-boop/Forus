import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp, useToday } from '../../data/app';
import { useTodayPlan } from '../../data/today';
import { useDayLog, useFoodLogs, useFoodLogsRange } from '../../data/hooks';
import { addWater, blockStartOf } from '../../data/actions';
import { dayResults, fmt, fmtKg, mealsFor, totals } from '../../data/logic';
import { useTargets, weekTargets, type DayTarget } from '../../data/targets';
import { streak } from '../../core/day';
import { addDays, daysBetween, longDate, startOfWeek, weekday, WEEKDAYS, WEEKDAYS_3, WEEKDAYS_SHORT } from '../../core/dates';
import { GOALS, ACTIVITY, formulaKcal } from '../../core/plan';
import { KIND_INFO, cycleText } from '../../core/cycling';
import { mealTargets, type MealTarget } from '../../core/meals';
import { movingAverage, weeklyRate } from '../../core/trend';
import { Icon } from '../../ui/Icon';
import { MacroBars, Ring, Sheet, SyncBadge, useToast } from '../../ui/kit';
import { WeightSheet } from '../../ui/shared';
import { ActiveSessionBanner, TodayWorkoutCard } from '../train/today';
import { ReviewCard, useWeeklyReview } from './Review';

export function Home() {
  const { profile } = useApp();
  const today = useToday();
  const nav = useNavigate();
  const toast = useToast();
  const tp = useTodayPlan(today);
  const logs = useFoodLogs(today);
  const rangeLogs = useFoodLogsRange(addDays(today, -62), today);
  const dayLog = useDayLog(today);
  const targetFor = useTargets(today);
  const [why, setWhy] = useState(false);
  const [weekOpen, setWeekOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);

  const t = totals(logs);
  const ph = tp.phase;
  const tg = targetFor(today);
  const target = tg ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const left = target.kcal - t.kcal;

  const results = useMemo(() => dayResults({ from: addDays(today, -62), to: today, meso: tp.meso, logs: rangeLogs, sessions: tp.sessions, target: targetFor }), [today, tp.meso, rangeLogs, tp.sessions, targetFor]);
  const review = useWeeklyReview({ today, phase: ph, phases: tp.phases, weights: tp.weights, logs: rangeLogs, targetFor });
  const st = streak(results, today);
  const week = startOfWeek(today);
  const byDate = new Map(results.map((r) => [r.date, r]));

  const trend = useMemo(() => movingAverage(tp.weights.map((w) => ({ date: w.date, weight: w.weight_kg }))), [tp.weights]);
  const rate = weeklyRate(trend);
  const avg = trend.length ? trend[trend.length - 1].avg : null;
  const weightToday = tp.weight?.date === today;

  const water = dayLog && !dayLog.deleted_at ? dayLog.water_ml : 0;
  const waterGoal = tg?.water ?? profile.prefs?.waterGoal ?? 2500;
  // Antes de entrenar se muestran las dos comidas clave; después, solo la de recuperación.
  const peri = tg?.training ? mealTargets(tg, mealsFor(profile), tg.trainingTime).filter((m) => m.tag === 'post' || (m.tag === 'pre' && !tp.doneToday.length)) : [];

  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div className="page">
      <div className="row between" style={{ marginBottom: 16 }}>
        <div className="grow">
          <div className="small muted">{longDate(today)}</div>
          <div className="h1 truncate">{hello}, {profile.name.split(' ')[0]}</div>
        </div>
        <SyncBadge />
        <span className={`chip${st > 0 ? ' hot' : ''}`} title="Días cumplidos seguidos"><Icon name="flame" size={16} /><b className="num" style={{ fontSize: 17 }}>{st}</b></span>
      </div>

      <ActiveSessionBanner session={tp.active} />
      <ReviewCard review={review} phase={ph} phases={tp.phases} today={today} />
      <TodayWorkoutCard tp={tp} today={today} target={tg} />

      <div className="card">
        <div className="row between" style={{ marginBottom: 6 }}>
          <div className="h2">Comida de hoy</div>
          <button className="link" onClick={() => setWhy(true)}>¿Por qué {fmt(target.kcal)}?</button>
        </div>
        {tg && <KindChip t={tg} />}
        <div className="row" style={{ gap: 16 }}>
          <Ring value={t.kcal} max={target.kcal} size={124}>
            <div className="num" style={{ fontSize: 30, lineHeight: 1, color: left < 0 ? 'var(--danger)' : undefined }}>{fmt(Math.abs(left))}</div>
            <div className="xs muted">{left >= 0 ? 'kcal quedan' : 'kcal de más'}</div>
          </Ring>
          <div className="grow">
            <div className="small muted">Comido <b style={{ color: 'var(--text)' }}>{fmt(t.kcal)}</b> de {fmt(target.kcal)} kcal</div>
            <MacroBars t={t} target={target} />
          </div>
        </div>
        {peri.map((m) => <PeriRow key={m.id} m={m} />)}
        <button className="btn btn-soft" style={{ marginTop: 14 }} onClick={() => nav('/comer')}><Icon name="plus" size={18} />Registrar comida</button>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="row between"><span className="eyebrow">Agua</span><Icon name="drop" size={18} style={{ color: 'var(--prot)' }} /></div>
          <div className="num" style={{ fontSize: 28, margin: '6px 0 2px' }}>{fmt(water / 1000, 2)} <span className="small muted">/ {fmt(waterGoal / 1000, 1)} L</span></div>
          {tg?.training && <div className="xs faint" style={{ marginTop: -2, marginBottom: 6 }}>+0,5 L por entrenar</div>}
          <div className="bar" style={{ marginBottom: 12 }}><i style={{ width: `${Math.min(100, (water / waterGoal) * 100)}%`, background: 'var(--prot)' }} /></div>
          <button className="btn btn-soft btn-sm" style={{ width: '100%' }} onClick={async () => { await addWater(today, 250); toast('+250 ml de agua', 'Deshacer', () => void addWater(today, -250)); }}>+ 250 ml</button>
        </div>
        <div className="card">
          <div className="row between"><span className="eyebrow">Peso</span><Icon name="weight" size={18} className="faint" /></div>
          <div className="num" style={{ fontSize: 28, margin: '6px 0 2px' }}>{avg != null ? fmtKg(Math.round(avg * 10) / 10) : '–'} <span className="small muted">kg</span></div>
          <div className="xs muted" style={{ marginBottom: 12, minHeight: 16 }}>{rate != null ? `${rate >= 0 ? '+' : '−'}${fmt(Math.abs(rate), 2)} kg/sem (prom. 7 días)` : 'Promedio de 7 días'}</div>
          <button className={`btn btn-sm ${weightToday ? 'btn-soft' : 'btn-primary'}`} style={{ width: '100%' }} onClick={() => setWeightOpen(true)}>{weightToday ? `Hoy ${fmtKg(tp.weight!.weight_kg)} kg` : 'Registrar'}</button>
        </div>
      </div>

      {ph && (
        <button className="card" style={{ width: '100%', textAlign: 'left' }} onClick={() => nav('/progreso')}>
          <div className="row between">
            <div>
              <div className="eyebrow">Fase actual</div>
              <div className="h2" style={{ marginTop: 2 }}>{GOALS[ph.type].short} · semana {Math.floor(daysBetween(blockStartOf(ph), today) / 7) + 1}</div>
            </div>
            <Icon name="chev-r" className="faint" />
          </div>
          <div className="small muted" style={{ marginTop: 6 }}>
            {ph.rate_kg_week ? <>Objetivo {ph.rate_kg_week > 0 ? '+' : '−'}{fmt(Math.abs(ph.rate_kg_week), 2)} kg/sem</> : 'Objetivo: mantener el peso'}
            {rate != null ? <> · real {rate >= 0 ? '+' : '−'}{fmt(Math.abs(rate), 2)} kg/sem</> : <> · el ritmo real aparece con 10 días de pesajes</>}
          </div>
        </button>
      )}

      <div className="card">
        <div className="row between">
          <div className="h2">Tu semana</div>
          <button className="link" onClick={() => setWeekOpen(true)}>Objetivos por día</button>
        </div>
        <div className="xs muted" style={{ marginTop: 2 }}>Día cumplido = kcal ±10 %, proteína y entreno</div>
        <div className="week">
          {WEEKDAYS_SHORT.map((d, i) => {
            const date = addDays(week, i);
            const r = byDate.get(date);
            const isToday = date === today;
            const cls = r?.ok ? ' ok' : isToday ? ' today' : '';
            const planned = tp.meso && date >= today && tp.meso.schedule[String(i)] != null;
            return (
              <div key={i} className={`day${cls}${planned && !r?.ok ? ' train' : ''}`} title={WEEKDAYS[i]}>
                {d}
                <div className="dot">{r?.ok ? <Icon name="check" size={16} /> : r?.trained ? <Icon name="dumbbell" size={15} /> : Number(date.slice(8))}</div>
              </div>
            );
          })}
        </div>
      </div>

      <Sheet open={why} onClose={() => setWhy(false)} title={`¿Por qué ${fmt(target.kcal)} kcal?`}>
        {ph && tg ? <WhyContent tg={tg} activity={ACTIVITY[profile.activity].label.toLowerCase()} sex={profile.sex} /> : <p className="muted">Aún no tienes una fase activa. Créala desde Perfil.</p>}
      </Sheet>
      <Sheet open={weekOpen} onClose={() => setWeekOpen(false)} title="Objetivos de la semana">
        {weekOpen && <WeekPlan days={weekTargets(targetFor, week)} results={byDate} today={today} />}
      </Sheet>
      {weightOpen && <WeightSheet open onClose={() => setWeightOpen(false)} date={today} initial={tp.weight?.weight_kg ?? 70} />}
    </div>
  );
}

function WhyLine({ l, v }: { l: React.ReactNode; v: React.ReactNode }) {
  return <div className="row between small" style={{ padding: '6px 0' }}><span className="muted grow">{l}</span><span className="num" style={{ fontSize: 17 }}>{v}</span></div>;
}

const signed = (n: number, unit = '') => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmt(Math.abs(n))}${unit}`;

/** Chips con el tipo de día y cuánto cambian los carbohidratos. */
export function KindChip({ t }: { t: DayTarget }) {
  const info = KIND_INFO[t.kind];
  const txt = t.cycled && t.delta ? `${signed(t.delta, ' g')} de carbohidratos` : t.training ? 'Entrenas hoy' : 'Comes tu promedio';
  return (
    <div className="row" style={{ gap: 6, margin: '0 0 8px', flexWrap: 'wrap' }}>
      <span className={`chip${t.training ? ' hot' : ''}`}><Icon name={t.training ? 'dumbbell' : 'moon'} size={14} />{t.deload ? `${info.short} · descarga` : info.label}</span>
      <span className="chip" style={{ color: t.delta > 0 ? 'var(--carb)' : undefined }}>{txt}</span>
    </div>
  );
}

function PeriRow({ m }: { m: MealTarget }) {
  return (
    <div className="hint" style={{ marginTop: 10, alignItems: 'flex-start' }}>
      <Icon name="zap" size={18} style={{ color: 'var(--primary-text)', marginTop: 1 }} />
      <span className="grow">
        <b style={{ color: 'var(--text)' }}>{m.tag === 'pre' ? 'Antes de entrenar' : 'Después de entrenar'}</b> · {m.name} {m.time}
        <div className="xs">~{fmt(m.carbs)} g de carbohidratos y {fmt(m.protein)} g de proteína{m.tag === 'pre' ? ', con poca grasa para que no te caiga pesado' : ' para recuperarte'}.</div>
      </span>
    </div>
  );
}

function WhyContent({ tg, activity, sex }: { tg: DayTarget; activity: string; sex: 'm' | 'f' }) {
  const ph = tg.phase;
  const formula = formulaKcal(ph.type, ph.rate_kg_week, ph.tdee, sex);
  const adj = ph.kcal - formula;
  const info = KIND_INFO[tg.kind];
  const goal = GOALS[ph.type].short.toLowerCase();
  return (
    <>
      <WhyLine l="Metabolismo en reposo" v={`${fmt(ph.bmr)} kcal`} />
      <WhyLine l={`× actividad diaria (${fmt(ph.activity_factor, 2)} · ${activity})`} v={`${fmt(ph.bmr * ph.activity_factor)} kcal`} />
      <WhyLine l="+ entrenamiento (promedio diario)" v={`${fmt(ph.training_kcal)} kcal`} />
      <WhyLine l="= gasto estimado" v={<b>{fmt(ph.tdee)} kcal</b>} />
      {formula !== ph.tdee && <WhyLine l={formula > ph.tdee ? `+ superávit (${goal})` : `− déficit (${goal})`} v={`${signed(formula - ph.tdee)} kcal`} />}
      {adj !== 0 && <WhyLine l="± ajustes con tu progreso real" v={`${signed(adj)} kcal`} />}
      <WhyLine l="= promedio diario de tu fase" v={<b>{fmt(ph.kcal)} kcal</b>} />
      {tg.cycled && tg.delta !== 0 && (
        <>
          <WhyLine l={`${tg.delta > 0 ? '+' : '−'} hoy: ${info.label.toLowerCase()}${tg.deload ? ' (descarga)' : ''}`} v={`${signed(tg.delta * 4)} kcal`} />
          <WhyLine l="= objetivo de hoy" v={<b>{fmt(tg.kcal)} kcal</b>} />
        </>
      )}
      <div className="divider" />
      <p className="small muted">
        {!ph.cycling ? 'El ciclado de carbohidratos está apagado: comes lo mismo todos los días (se activa en Perfil → Tu plan).'
          : !tg.cycled ? cycleText(ph.type, tg.cycle)
            : tg.delta > 0 ? <>Hoy toca {tg.dayName ?? info.short.toLowerCase()}: los carbohidratos suben de {fmt(tg.base.carbs)} a <b style={{ color: 'var(--text)' }}>{fmt(tg.carbs)} g</b> para rendir y recuperarte. Los días de descanso bajan, así tu promedio semanal sigue siendo {fmt(ph.kcal)} kcal.</>
              : tg.delta < 0 ? <>Hoy {tg.training ? 'el entrenamiento es liviano' : 'descansas'}: los carbohidratos bajan de {fmt(tg.base.carbs)} a <b style={{ color: 'var(--text)' }}>{fmt(tg.carbs)} g</b>. Los días de entrenamiento suben para compensar, así tu promedio semanal sigue siendo {fmt(ph.kcal)} kcal.</>
                : 'Hoy comes justo tu promedio.'}
      </p>
      <p className="small muted" style={{ marginTop: 8 }}>
        {tg.cycled && <>{cycleText(ph.type, tg.cycle)} </>}
        Proteína: {fmt(ph.protein_per_kg, 1)} g por kg ({ph.protein_g} g) todos los días, para construir y cuidar músculo. Grasa: {ph.fat_g} g para tus hormonas.
        Cada domingo la app compara tu peso real con el plan y, si hace falta, te propone un ajuste.
      </p>
    </>
  );
}

function WeekPlan({ days, results, today }: { days: (DayTarget | null)[]; results: Map<string, { ok: boolean; kcal: number }>; today: string }) {
  const valid = days.filter((d): d is DayTarget => !!d);
  if (!valid.length) return <p className="muted">Aún no tienes una fase activa.</p>;
  const avg = valid.reduce((a, d) => a + d.kcal, 0) / valid.length;
  return (
    <>
      <p className="small muted" style={{ marginTop: -6, marginBottom: 10 }}>Los carbohidratos suben los días que entrenas y bajan en los de descanso. Proteína y grasa son iguales todos los días.</p>
      <div className="list">
        {valid.map((d) => {
          const r = results.get(d.date);
          return (
            <div key={d.date} className="li" style={{ padding: '11px 14px', background: d.date === today ? 'var(--primary-soft)' : undefined }}>
              <span className="ico" style={{ color: d.training ? 'var(--primary-text)' : undefined }}><Icon name={d.training ? 'dumbbell' : 'moon'} size={18} /></span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="truncate"><b>{d.date === today ? 'Hoy' : `${WEEKDAYS_3[weekday(d.date)]} ${Number(d.date.slice(8))}`}</b><span className="xs muted"> · {d.dayName ?? KIND_INFO[d.kind].short}{d.deload ? ' (descarga)' : ''}</span></div>
                <div className="xs muted">C {fmt(d.carbs)} g{d.cycled && d.delta ? ` (${signed(d.delta)})` : ''} · P {fmt(d.protein)} · G {fmt(d.fat)}{d.date < today && r?.kcal ? ` · comiste ${fmt(r.kcal)}` : ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="num" style={{ fontSize: 19 }}>{fmt(d.kcal)}</div>
                {r?.ok ? <span className="xs ok">cumplido</span> : <span className="xs faint">kcal</span>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="xs muted">Promedio de esta semana: {fmt(avg)} kcal al día (tu fase: {fmt(valid[0].base.kcal)}). Si te saltas un entreno, ese día pasa a ser de descanso; si entrenas un día libre, ese día sube.</p>
    </>
  );
}
