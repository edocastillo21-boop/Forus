import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp, useToday } from '../../data/app';
import { useTodayPlan } from '../../data/today';
import { useDayLog, useFoodLogs, useFoodLogsRange } from '../../data/hooks';
import { addWater } from '../../data/actions';
import { dayResults, fmt, fmtKg, totals } from '../../data/logic';
import { streak } from '../../core/day';
import { addDays, daysBetween, longDate, startOfWeek, WEEKDAYS, WEEKDAYS_SHORT } from '../../core/dates';
import { GOALS, ACTIVITY } from '../../core/plan';
import { movingAverage, weeklyRate } from '../../core/trend';
import { Icon } from '../../ui/Icon';
import { MacroBars, Ring, Sheet, SyncBadge, useToast } from '../../ui/kit';
import { WeightSheet } from '../../ui/shared';
import { ActiveSessionBanner, TodayWorkoutCard } from '../train/today';

export function Home() {
  const { profile } = useApp();
  const today = useToday();
  const nav = useNavigate();
  const toast = useToast();
  const tp = useTodayPlan(today);
  const logs = useFoodLogs(today);
  const rangeLogs = useFoodLogsRange(addDays(today, -62), today);
  const dayLog = useDayLog(today);
  const [why, setWhy] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);

  const t = totals(logs);
  const ph = tp.phase;
  const target = ph ? { kcal: ph.kcal, protein: ph.protein_g, carbs: ph.carbs_g, fat: ph.fat_g } : { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const left = target.kcal - t.kcal;

  const results = useMemo(() => dayResults({ from: addDays(today, -62), to: today, phases: tp.phases, meso: tp.meso, logs: rangeLogs, sessions: tp.sessions }), [today, tp.phases, tp.meso, rangeLogs, tp.sessions]);
  const st = streak(results, today);
  const week = startOfWeek(today);
  const byDate = new Map(results.map((r) => [r.date, r]));

  const trend = useMemo(() => movingAverage(tp.weights.map((w) => ({ date: w.date, weight: w.weight_kg }))), [tp.weights]);
  const rate = weeklyRate(trend);
  const avg = trend.length ? trend[trend.length - 1].avg : null;
  const weightToday = tp.weight?.date === today;

  const water = dayLog && !dayLog.deleted_at ? dayLog.water_ml : 0;
  const waterGoal = profile.prefs?.waterGoal ?? 2500;

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
      <TodayWorkoutCard tp={tp} today={today} />

      <div className="card">
        <div className="row between" style={{ marginBottom: 6 }}>
          <div className="h2">Comida de hoy</div>
          <button className="link" onClick={() => setWhy(true)}>¿Por qué {fmt(target.kcal)}?</button>
        </div>
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
        <button className="btn btn-soft" style={{ marginTop: 14 }} onClick={() => nav('/comer')}><Icon name="plus" size={18} />Registrar comida</button>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="row between"><span className="eyebrow">Agua</span><Icon name="drop" size={18} style={{ color: 'var(--prot)' }} /></div>
          <div className="num" style={{ fontSize: 28, margin: '6px 0 2px' }}>{fmt(water / 1000, 2)} <span className="small muted">/ {fmt(waterGoal / 1000, 1)} L</span></div>
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
              <div className="h2" style={{ marginTop: 2 }}>{GOALS[ph.type].short} · semana {Math.floor(daysBetween(ph.start_date, today) / 7) + 1}</div>
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
          <span className="xs muted">Día cumplido = kcal ±10 %, proteína y entreno</span>
        </div>
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
        {ph ? (
          <>
            <WhyLine l="Metabolismo en reposo" v={`${fmt(ph.bmr)} kcal`} />
            <WhyLine l={`× actividad diaria (${fmt(ph.activity_factor, 2)} · ${ACTIVITY[profile.activity].label.toLowerCase()})`} v={`${fmt(ph.bmr * ph.activity_factor)} kcal`} />
            <WhyLine l="+ entrenamiento (promedio diario)" v={`${fmt(ph.training_kcal)} kcal`} />
            <WhyLine l="= gasto estimado" v={<b>{fmt(ph.tdee)} kcal</b>} />
            <WhyLine l={ph.kcal >= ph.tdee ? `+ superávit (${GOALS[ph.type].short.toLowerCase()})` : `− déficit (${GOALS[ph.type].short.toLowerCase()})`} v={`${fmt(ph.kcal - ph.tdee)} kcal`} />
            <div className="divider" />
            <p className="small muted">
              Proteína: {fmt(ph.protein_per_kg, 1)} g por kg ({ph.protein_g} g) para construir y cuidar músculo. Grasa: {ph.fat_g} g para tus hormonas.
              Carbohidratos: el resto ({ph.carbs_g} g), tu combustible para entrenar.
            </p>
            <p className="small muted" style={{ marginTop: 8 }}>Es una estimación: después de 2 semanas registrando peso y comidas, se ajusta con tu tendencia real.</p>
          </>
        ) : <p className="muted">Aún no tienes una fase activa. Créala desde Perfil.</p>}
      </Sheet>
      {weightOpen && <WeightSheet open onClose={() => setWeightOpen(false)} date={today} initial={tp.weight?.weight_kg ?? 70} />}
    </div>
  );
}

function WhyLine({ l, v }: { l: React.ReactNode; v: React.ReactNode }) {
  return <div className="row between small" style={{ padding: '6px 0' }}><span className="muted grow">{l}</span><span className="num" style={{ fontSize: 17 }}>{v}</span></div>;
}
