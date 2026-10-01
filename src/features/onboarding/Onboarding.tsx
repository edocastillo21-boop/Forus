import { useMemo, useState, type ReactNode } from 'react';
import type { Catalog } from '../../data/catalog';
import type { Activity, Budget, Diet, Goal, Level, Profile, Sex } from '../../data/types';
import { put } from '../../data/store';
import { phaseFromPlan, setWeight } from '../../data/actions';
import { fmt, fmtKg, mealsForCount } from '../../data/logic';
import { ACTIVITY, GOALS, computePlan, paceOptions } from '../../core/plan';
import { ageFrom, todayISO, WEEKDAYS, WEEKDAYS_SHORT } from '../../core/dates';
import { EQUIPMENT_OPTIONS, TEMPLATES, allowedEquipment, routineFromTemplate, suggestTemplate, uid } from '../../core/templates';
import { buildSchedule, defaultRirPlan } from '../../core/schedule';
import { classifyDay, cycleText, kindPreview, weekKindsFrom } from '../../core/cycling';
import { MEAL_SHARE } from '../../core/meals';
import { DEFAULT_PLATES } from '../../core/strength';
import { Icon } from '../../ui/Icon';
import { Logo } from '../../ui/Logo';
import { Opt, Seg, Stepper } from '../../ui/kit';

interface Form {
  name: string; consent: boolean; sex: Sex; birth: string; height: number; weight: number; goalWeight: string; bodyFat: string;
  activity: Activity; experience: Level; goal: Goal; paceIdx: number; days: number[]; sessionMin: number; time: string; equipment: string[];
  diet: Diet; meals: number; dislikes: string; allergies: string; budget: Budget; templateId: string | null;
}

const STEPS = 8;
const num = (s: string) => { const v = parseFloat(s.replace(',', '.')); return Number.isFinite(v) ? v : null; };

const LEVELS: [Level, string, string][] = [
  ['principiante', 'Principiante', 'Menos de 1 año entrenando con constancia'],
  ['intermedio', 'Intermedio', 'Entre 1 y 3 años, conoces los ejercicios básicos'],
  ['avanzado', 'Avanzado', 'Más de 3 años, tu progreso ya es lento'],
];
const GOAL_ICON: Record<Goal, string> = { volumen: 'trend', definicion: 'flame', recomposicion: 'repeat', mantencion: 'target' };

export function Onboarding({ profile, uid: userId, cat }: { profile: Profile | null; uid: string; cat: Catalog }) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState<Form>(() => ({
    name: profile?.name ?? '', consent: !!profile?.consent_at, sex: profile?.sex ?? 'm', birth: profile?.birth_date ?? '1995-01-01',
    height: profile?.height_cm ?? 170, weight: 70, goalWeight: '', bodyFat: '', activity: profile?.activity ?? 'ligero',
    experience: profile?.experience ?? 'intermedio', goal: profile?.goal ?? 'volumen', paceIdx: 1, days: profile?.training_days ?? [0, 1, 3, 4],
    sessionMin: profile?.session_min ?? 60, time: profile?.training_time ?? '19:00', equipment: profile?.equipment ?? ['gimnasio'],
    diet: profile?.diet ?? 'omnivora', meals: profile?.meals_per_day ?? 4, dislikes: profile?.dislikes?.join(', ') ?? '', allergies: profile?.allergies ?? '',
    budget: profile?.budget ?? 'medio', templateId: null,
  }));
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  const age = f.birth ? ageFrom(f.birth) : 0;
  const pace = paceOptions(f.goal, f.experience, f.weight);
  const rate = pace ? pace[f.paceIdx] : 0;
  const plan = useMemo(() => computePlan({
    sex: f.sex, age, heightCm: f.height, weightKg: f.weight, goalWeightKg: num(f.goalWeight), bodyFatPct: num(f.bodyFat),
    activity: f.activity, goal: f.goal, rateKgWeek: rate, sessionsPerWeek: f.days.length, sessionMin: f.sessionMin,
  }), [f, age, rate]);
  const suggestion = suggestTemplate(Math.max(1, f.days.length), f.experience);
  const tpl = TEMPLATES.find((t) => t.id === f.templateId) ?? suggestion.template;
  const dayCount = f.templateId ? Math.min(Math.max(1, f.days.length), tpl.plan.length) : suggestion.dayCount;
  const meals = mealsForCount(f.meals);
  // Vista previa del ciclado: kcal de cada día según lo que toca entrenar.
  const cycle = useMemo(() => {
    const routine = routineFromTemplate(tpl, allowedEquipment(f.equipment), (id) => cat.exById.get(id)?.e, dayCount);
    const kinds = routine.days.map((d) => classifyDay(d.exercises, (id) => cat.exById.get(id)));
    const week = weekKindsFrom(buildSchedule(f.days, routine), kinds);
    const { info, rows } = kindPreview(f.goal, { kcal: plan.kcal, protein: plan.protein, carbs: plan.carbs, fat: plan.fat }, week, f.weight);
    const byKind = new Map(info.scale ? rows.map((r) => [r.kind, r.macros]) : []);
    return { kinds, rest: byKind.get('descanso') ?? null, byKind, info };
  }, [tpl, f.equipment, f.days, f.weight, f.goal, dayCount, plan, cat]);

  const valid: Record<number, string | null> = {
    1: !f.name.trim() ? 'Escribe tu nombre.' : !f.consent ? 'Necesitamos tu autorización para calcular tu plan.' : null,
    2: !f.birth || age < 14 || age > 90 ? 'Revisa tu fecha de nacimiento.' : f.height < 120 || f.height > 230 ? 'Revisa tu estatura.' : null,
    3: f.weight < 35 || f.weight > 300 ? 'Revisa tu peso.' : f.goalWeight && !num(f.goalWeight) ? 'El peso objetivo debe ser un número.' : f.bodyFat && (!num(f.bodyFat) || num(f.bodyFat)! < 3 || num(f.bodyFat)! > 60) ? 'El % de grasa debe estar entre 3 y 60.' : null,
    4: null, 5: null,
    6: !f.days.length ? 'Elige al menos un día para entrenar.' : !f.equipment.length ? 'Elige tu equipamiento.' : null,
    7: null, 8: null,
  };

  function next() {
    const e = valid[step];
    if (e) { setErr(e); return; }
    setErr(null);
    if (step < STEPS) { setStep(step + 1); window.scrollTo(0, 0); } else void finish();
  }

  async function finish() {
    setBusy(true);
    try {
      const today = todayISO();
      const now = new Date().toISOString();
      await setWeight(today, f.weight, num(f.bodyFat));
      await put('phases', phaseFromPlan(plan, { goal: f.goal, start: today, rate, weight: f.weight, goalWeight: num(f.goalWeight) }));
      const allowed = allowedEquipment(f.equipment);
      const routine = { id: uid(), ...routineFromTemplate(tpl, allowed, (id) => cat.exById.get(id)?.e, dayCount) };
      await put('routines', routine);
      await put('mesocycles', {
        id: uid(), routine_id: routine.id, name: 'Mesociclo 1', start_date: today, weeks: 6, deload_week: 6,
        rir_plan: defaultRirPlan(6, true), schedule: buildSchedule(f.days, routine), status: 'activo',
      });
      await put('profiles', {
        id: userId, name: f.name.trim(), sex: f.sex, birth_date: f.birth, height_cm: f.height, activity: f.activity, experience: f.experience,
        goal: f.goal, diet: f.diet, meals_per_day: f.meals, budget: f.budget, training_days: [...f.days].sort(), session_min: f.sessionMin,
        training_time: f.time, equipment: f.equipment, dislikes: f.dislikes.split(',').map((s) => s.trim()).filter(Boolean), allergies: f.allergies.trim(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, consent_at: profile?.consent_at ?? now, onboarded_at: now,
        prefs: {
          theme: 'dark', bar: 20, plates: DEFAULT_PLATES, meals, favorites: [],
          waterGoal: Math.min(4000, Math.max(1500, Math.round((f.weight * 35) / 250) * 250)),
        },
      });
    } catch (e) {
      setErr(`No pudimos guardar: ${e instanceof Error ? e.message : String(e)}`);
      setBusy(false);
    }
  }

  const toggleDay = (d: number) => set('days', f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d].sort());
  const toggleEq = (id: string) => set('equipment', f.equipment.includes(id) ? f.equipment.filter((x) => x !== id) : [...f.equipment, id]);

  return (
    <div className="app">
      <div className="page full">
        <div className="row" style={{ marginBottom: 18 }}>
          {step > 1 ? <button className="icon-btn" onClick={() => { setErr(null); setStep(step - 1); }} aria-label="Volver"><Icon name="chev-l" /></button> : <Logo size={40} />}
          <div className="grow">
            <div className="xs muted" style={{ marginBottom: 6 }}>Paso {step} de {STEPS}</div>
            <div className="progress-steps"><i style={{ width: `${(step / STEPS) * 100}%` }} /></div>
          </div>
        </div>

        {step === 1 && (
          <Step title="Hola, te damos la bienvenida a Forus" sub="Vamos a armar tu plan de entrenamiento y alimentación en unos 3 minutos.">
            <label className="field"><span>¿Cómo te llamas?</span>
              <input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} autoComplete="given-name" placeholder="Tu nombre" />
            </label>
            <div className="card">
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <Icon name="lock" />
                <div className="small muted">
                  Usaremos tu edad, peso, estatura y hábitos <b style={{ color: 'var(--text)' }}>solo para calcular tus objetivos</b>. Tus datos se guardan en tu cuenta privada y nadie más los ve.
                  Forus entrega estimaciones generales: no reemplaza a un médico ni a un nutricionista.
                </div>
              </div>
              <button type="button" className={`opt${f.consent ? ' on' : ''}`} style={{ marginTop: 14, marginBottom: 0 }} onClick={() => set('consent', !f.consent)}>
                <div className="grow"><b>Autorizo el uso de mis datos para calcular mi plan</b></div>
                <div className="radio" />
              </button>
            </div>
          </Step>
        )}

        {step === 2 && (
          <Step title="Sobre ti" sub="Con esto estimamos cuánta energía gasta tu cuerpo en reposo.">
            <div className="field"><span>Sexo (para la fórmula de gasto)</span>
              <Seg options={[{ value: 'm' as Sex, label: 'Hombre' }, { value: 'f' as Sex, label: 'Mujer' }]} value={f.sex} onChange={(v) => set('sex', v)} />
            </div>
            <label className="field"><span>Fecha de nacimiento {age > 0 && age < 120 && <b className="accent">· {age} años</b>}</span>
              <input className="input" type="date" value={f.birth} max={todayISO()} onChange={(e) => set('birth', e.target.value)} />
            </label>
            <div className="field"><span>Estatura</span>
              <Stepper value={f.height} onChange={(v) => set('height', v)} min={120} max={230} unit="cm" bigStep={5} />
            </div>
          </Step>
        )}

        {step === 3 && (
          <Step title="Tu peso" sub="Pésate en ayunas si puedes. Después la app mira la tendencia, no un día suelto.">
            <Stepper value={f.weight} onChange={(v) => set('weight', v)} step={0.1} bigStep={1} min={35} max={300} decimals={1} unit="kg" />
            <div className="grid2">
              <label className="field" style={{ margin: 0 }}><span>Peso objetivo (opcional)</span>
                <input className="input" inputMode="decimal" value={f.goalWeight} onChange={(e) => set('goalWeight', e.target.value)} placeholder="kg" />
              </label>
              <label className="field" style={{ margin: 0 }}><span>% de grasa (opcional)</span>
                <input className="input" inputMode="decimal" value={f.bodyFat} onChange={(e) => set('bodyFat', e.target.value)} placeholder="No sé" />
              </label>
            </div>
            <div className="hint"><Icon name="info" size={18} /><span>El % de grasa solo ajusta la proteína si es alto. Si no lo sabes, déjalo vacío.</span></div>
          </Step>
        )}

        {step === 4 && (
          <Step title="Tu día a día" sub="Sin contar el gimnasio: eso lo sumamos aparte según tus días de entrenamiento.">
            {(Object.keys(ACTIVITY) as Activity[]).map((a) => (
              <Opt key={a} on={f.activity === a} onClick={() => set('activity', a)} title={ACTIVITY[a].label} hint={ACTIVITY[a].hint} />
            ))}
            <div className="eyebrow" style={{ margin: '18px 0 10px' }}>Experiencia en el gimnasio</div>
            {LEVELS.map(([v, t, h]) => <Opt key={v} on={f.experience === v} onClick={() => set('experience', v)} title={t} hint={h} />)}
          </Step>
        )}

        {step === 5 && (
          <Step title="Tu objetivo" sub="Puedes cambiarlo cuando quieras: cada cambio abre una nueva fase.">
            {(Object.keys(GOALS) as Goal[]).map((g) => (
              <Opt key={g} icon={GOAL_ICON[g]} on={f.goal === g} onClick={() => { set('goal', g); set('paceIdx', 1); }} title={GOALS[g].label} hint={GOALS[g].hint} />
            ))}
            {pace && (
              <>
                <div className="eyebrow" style={{ margin: '18px 0 10px' }}>Ritmo</div>
                <Seg
                  options={pace.map((p, i) => ({ value: i, label: ['Suave', 'Recomendado', 'Rápido'][i], sub: `${p > 0 ? '+' : '−'}${fmtKg(Math.abs(p))} kg/sem` }))}
                  value={f.paceIdx} onChange={(v) => set('paceIdx', v)}
                />
                <p className="small muted" style={{ marginTop: 10 }}>
                  {f.goal === 'volumen'
                    ? 'Subir más rápido suma más grasa que músculo. El recomendado depende de tu experiencia.'
                    : 'Cerca de 0,7 % de tu peso por semana cuida la fuerza y el músculo.'}
                  {' '}Equivale a unas <b>{fmt(Math.abs((rate * 7700) / 7))} kcal</b> diarias {rate > 0 ? 'sobre' : 'bajo'} tu gasto.
                </p>
              </>
            )}
            {f.goal === 'recomposicion' && <p className="small muted">Comerás un 10 % bajo tu gasto con proteína alta. Funciona mejor si eres principiante o vuelves después de una pausa.</p>}
          </Step>
        )}

        {step === 6 && (
          <Step title="Tu entrenamiento" sub="Con esto elegimos tu rutina y estimamos lo que gastas entrenando.">
            <div className="field"><span>¿Qué días entrenas? <b className="accent">{f.days.length} {f.days.length === 1 ? 'día' : 'días'}</b></span>
              <div className="week" style={{ marginTop: 0 }}>
                {WEEKDAYS_SHORT.map((d, i) => (
                  <button key={i} type="button" className={`day${f.days.includes(i) ? ' ok' : ''}`} onClick={() => toggleDay(i)} aria-pressed={f.days.includes(i)} aria-label={WEEKDAYS[i]}>
                    <div className="dot" style={{ width: 40, height: 40, fontSize: 14 }}>{d}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="field"><span>Duración de cada sesión</span>
              <Seg options={[45, 60, 75, 90].map((m) => ({ value: m, label: `${m}`, sub: 'min' }))} value={f.sessionMin} onChange={(v) => set('sessionMin', v)} />
            </div>
            <label className="field"><span>Hora habitual</span>
              <input className="input" type="time" value={f.time} onChange={(e) => set('time', e.target.value)} />
            </label>
            <div className="field"><span>Equipamiento disponible</span>
              <div className="chips">
                {EQUIPMENT_OPTIONS.map(([id, label]) => <button key={id} type="button" className={f.equipment.includes(id) ? 'on' : ''} onClick={() => toggleEq(id)}>{label}</button>)}
              </div>
            </div>
          </Step>
        )}

        {step === 7 && (
          <Step title="Tu alimentación" sub="Para ordenar tu diario y, más adelante, proponerte menús.">
            <div className="field"><span>Tipo de dieta</span>
              <Seg options={[{ value: 'omnivora' as Diet, label: 'Omnívora' }, { value: 'vegetariana' as Diet, label: 'Vegetariana' }, { value: 'vegana' as Diet, label: 'Vegana' }]} value={f.diet} onChange={(v) => set('diet', v)} />
            </div>
            <div className="field"><span>Comidas al día</span>
              <Seg options={[3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))} value={f.meals} onChange={(v) => set('meals', v)} />
              <div className="xs muted" style={{ marginTop: 8 }}>{meals.map((m) => m.name).join(' · ')}</div>
            </div>
            <label className="field"><span>Alimentos que no te gustan (separados por coma)</span>
              <input className="input" value={f.dislikes} onChange={(e) => set('dislikes', e.target.value)} placeholder="Ej.: betarraga, hígado" />
            </label>
            <label className="field"><span>Alergias o intolerancias</span>
              <input className="input" value={f.allergies} onChange={(e) => set('allergies', e.target.value)} placeholder="Ej.: lactosa" />
            </label>
            <div className="field"><span>Presupuesto para comida</span>
              <Seg options={[{ value: 'bajo' as Budget, label: 'Ajustado' }, { value: 'medio' as Budget, label: 'Medio' }, { value: 'alto' as Budget, label: 'Holgado' }]} value={f.budget} onChange={(v) => set('budget', v)} />
            </div>
          </Step>
        )}

        {step === 8 && (
          <Step title={`${f.name.trim() || 'Listo'}, este es tu plan`} sub={`${GOALS[f.goal].short}${rate ? ` · ${rate > 0 ? '+' : '−'}${fmtKg(Math.abs(rate))} kg por semana` : ''}`}>
            <div className="card hero" style={{ textAlign: 'center' }}>
              <div className="eyebrow">Calorías diarias</div>
              <div className="num" style={{ fontSize: 56, lineHeight: 1.05 }}>{fmt(plan.kcal)}</div>
              <div className="m4">
                <div><div className="num" style={{ fontSize: 22, color: 'var(--prot)' }}>{plan.protein} g</div><div className="xs muted">Proteína</div></div>
                <div><div className="num" style={{ fontSize: 22, color: 'var(--carb)' }}>{plan.carbs} g</div><div className="xs muted">Carbos</div></div>
                <div><div className="num" style={{ fontSize: 22, color: 'var(--fat)' }}>{plan.fat} g</div><div className="xs muted">Grasa</div></div>
                <div><div className="num" style={{ fontSize: 22 }}>{fmt(plan.proteinPerKg, 1)}</div><div className="xs muted">g prot/kg</div></div>
              </div>
            </div>
            <div className="card">
              <div className="h2" style={{ marginBottom: 8 }}>Cómo lo calculamos</div>
              <Line l="Metabolismo en reposo (Mifflin-St Jeor)" v={`${fmt(plan.bmr)} kcal`} />
              <Line l={`× actividad diaria ${ACTIVITY[f.activity].label.toLowerCase()} (${fmt(plan.activityFactor, 2)})`} v={`${fmt(plan.bmr * plan.activityFactor)} kcal`} />
              <Line l={`+ entrenamiento (${f.days.length} × ${f.sessionMin} min por semana)`} v={`${fmt(plan.trainingKcal)} kcal`} />
              <Line l="= Gasto diario estimado" v={<b>{fmt(plan.tdee)} kcal</b>} />
              {plan.delta !== 0 && <Line l={plan.delta > 0 ? '+ superávit para ganar músculo' : '− déficit para perder grasa'} v={`${plan.delta > 0 ? '+' : '−'}${fmt(Math.abs(plan.delta))} kcal`} />}
              <p className="xs muted" style={{ marginTop: 10 }}>
                Proteína {fmt(plan.proteinPerKg, 1)} g por kg{plan.refWeight !== f.weight ? ` de un peso de referencia de ${fmtKg(plan.refWeight)} kg` : ''}; grasa ≈ 25 % de las calorías; el resto, carbohidratos para rendir.
                Después de 2 semanas de registros la app te propondrá ajustes según tu peso real.
              </p>
            </div>
            {plan.warnings.map((w) => <div key={w} className="hint warn" style={{ marginBottom: 10 }}><Icon name="info" size={18} /><span>{w}</span></div>)}

            <div className="card">
              <div className="row between"><div className="h2">Tu rutina</div><span className="badge">{dayCount} días</span></div>
              <p className="small muted" style={{ margin: '4px 0 10px' }}>{tpl.description}</p>
              <div className="chips" style={{ marginBottom: 12 }}>
                {TEMPLATES.map((t) => <button key={t.id} type="button" className={t.id === tpl.id ? 'on' : ''} onClick={() => set('templateId', t.id)}>{t.name}</button>)}
              </div>
              {[...f.days].sort().map((d, i) => {
                const kind = cycle.kinds[i % dayCount];
                const m = kind ? cycle.byKind.get(kind) : null;
                return (
                  <div key={d} className="row between small" style={{ padding: '6px 0', borderTop: i ? '1px solid var(--border)' : 0 }}>
                    <span className="muted">{WEEKDAYS[d]}</span>
                    <span><b>{tpl.plan[i % dayCount]?.name}</b>{m && <span className="muted"> · {fmt(m.kcal)} kcal</span>}</span>
                  </div>
                );
              })}
              {cycle.rest && (
                <div className="row between small" style={{ padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                  <span className="muted">Días de descanso</span><span className="muted">{fmt(cycle.rest.kcal)} kcal</span>
                </div>
              )}
              <p className="xs muted" style={{ marginTop: 8 }}>
                {cycle.info.scale ? <>Las calorías cambian según lo que entrenas, con el mismo promedio de {fmt(plan.kcal)} kcal y la misma proteína todos los días. </> : null}{cycleText(f.goal, cycle.info)}
              </p>
              <p className="xs muted" style={{ marginTop: 8 }}>Mesociclo de 6 semanas: el esfuerzo sube de a poco (RIR 3 → 1) y la semana 6 es de descarga. Podrás editar todo después.</p>
            </div>

            <div className="card">
              <div className="h2" style={{ marginBottom: 8 }}>Un día de ejemplo</div>
              {meals.map((m) => {
                const share = MEAL_SHARE[m.id] ?? 1 / meals.length;
                const total = meals.reduce((a, x) => a + (MEAL_SHARE[x.id] ?? 1 / meals.length), 0);
                return <Line key={m.id} l={`${m.name} · ${m.time}`} v={`${fmt(Math.round((plan.kcal * share) / total / 10) * 10)} kcal · ${Math.round((plan.protein * share) / total)} g prot`} />;
              })}
              <p className="xs muted" style={{ marginTop: 8 }}>Es solo una guía: lo que cuenta es el total del día.</p>
            </div>
          </Step>
        )}

        {err && <div className="hint warn" style={{ margin: '4px 0 12px' }}><Icon name="info" size={18} /><span>{err}</span></div>}
        <div style={{ position: 'sticky', bottom: 0, padding: '12px 0 calc(8px + env(safe-area-inset-bottom))', background: 'linear-gradient(transparent, var(--bg) 35%)' }}>
          <button className="btn btn-primary" onClick={next} disabled={busy}>{step < STEPS ? 'Continuar' : busy ? 'Creando tu plan…' : 'Empezar'}</button>
        </div>
      </div>
    </div>
  );
}

function Step({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div style={{ animation: 'fade .25s ease' }}>
      <div className="h1" style={{ marginBottom: 6 }}>{title}</div>
      {sub && <p className="muted" style={{ marginBottom: 20 }}>{sub}</p>}
      {children}
    </div>
  );
}

function Line({ l, v }: { l: ReactNode; v: ReactNode }) {
  return <div className="row between small" style={{ padding: '5px 0' }}><span className="muted grow">{l}</span><span style={{ whiteSpace: 'nowrap' }}>{v}</span></div>;
}
