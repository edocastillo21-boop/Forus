import { useMemo, useState } from 'react';
import Dexie from 'dexie';
import { useApp, useToday } from '../../data/app';
import { usePhases, useWeights } from '../../data/hooks';
import { download, exportAll, phaseFromPlan, planFor, startPhase, updatePrefs } from '../../data/actions';
import { currentPhase, fmt, fmtKg, mealsFor } from '../../data/logic';
import { closeStore, update } from '../../data/store';
import { LOCAL_MODE, supabase } from '../../data/supabase';
import { stopSync, syncNow, useSyncState } from '../../data/sync';
import type { Activity, Budget, Diet, Goal, Level, MealSlot, Profile, Sex } from '../../data/types';
import { ACTIVITY, GOALS, paceOptions } from '../../core/plan';
import { addDays, ageFrom, WEEKDAYS, WEEKDAYS_SHORT } from '../../core/dates';
import { EQUIPMENT_OPTIONS, uid } from '../../core/templates';
import { DEFAULT_PLATES } from '../../core/strength';
import { movingAverage } from '../../core/trend';
import { Icon } from '../../ui/Icon';
import { Opt, Seg, Sheet, Stepper, Switch, useToast } from '../../ui/kit';

export const VERSION = '0.3.0';
type Panel = 'datos' | 'entreno' | 'comida' | 'comidas' | 'discos' | 'fase' | 'borrar' | null;

export function ProfileScreen() {
  const { profile, email, uid: userId, signOut } = useApp();
  const today = useToday();
  const toast = useToast();
  const phases = usePhases();
  const weights = useWeights();
  const sync = useSyncState();
  const [panel, setPanel] = useState<Panel>(null);
  const ph = currentPhase(phases, today);
  const trend = useMemo(() => movingAverage(weights.map((w) => ({ date: w.date, weight: w.weight_kg }))), [weights]);
  const weightNow = trend.length ? Math.round(trend[trend.length - 1].avg * 10) / 10 : ph?.start_weight ?? 70;
  const light = profile.prefs?.theme === 'light';

  async function recalc(p: Profile = profile, goal: Goal = ph?.type ?? profile.goal, rate = ph?.rate_kg_week ?? 0) {
    const plan = planFor(p, weightNow, goal, rate, ph?.goal_weight ?? null);
    await startPhase(phases, phaseFromPlan(plan, { goal, start: today, rate, weight: weightNow, goalWeight: ph?.goal_weight ?? null }), addDays(today, -1));
    if (goal !== p.goal) await update('profiles', p.id, { goal });
    toast(`Plan actualizado: ${fmt(plan.kcal)} kcal · ${plan.protein} g de proteína`);
  }
  const saveProfile = async (patch: Partial<Profile>, askRecalc = false) => {
    const next = await update('profiles', profile.id, patch);
    setPanel(null);
    if (askRecalc && next) toast('Datos guardados', 'Recalcular plan', () => void recalc(next));
    else toast('Guardado');
  };

  const syncText = sync.state === 'local' ? 'Modo local: los datos quedan solo en este dispositivo'
    : sync.state === 'offline' ? `Sin señal${sync.pending ? ` · ${sync.pending} cambios por subir` : ''}`
      : sync.state === 'error' ? `Error: ${sync.lastError ?? 'desconocido'}`
        : sync.state === 'syncing' ? 'Sincronizando…' : sync.pending ? `${sync.pending} cambios por subir` : 'Todo guardado en la nube';

  return (
    <div className="page">
      <div className="row" style={{ marginBottom: 18 }}>
        <div className="icon-btn" style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--primary)', color: 'var(--on-primary)', fontWeight: 800, fontSize: 22 }}>{profile.name.charAt(0).toUpperCase()}</div>
        <div className="grow">
          <div className="h1 truncate">{profile.name}</div>
          <div className="small muted truncate">{email ?? 'Modo local'} · {ageFrom(profile.birth_date)} años · {profile.height_cm} cm</div>
        </div>
      </div>

      {ph && (
        <div className="card hero">
          <div className="row between">
            <div><div className="eyebrow" style={{ color: 'var(--primary-text)' }}>Tu plan</div><div className="h2">{GOALS[ph.type].label}</div></div>
            <span className="badge">{ph.rate_kg_week ? `${ph.rate_kg_week > 0 ? '+' : '−'}${fmtKg(Math.abs(ph.rate_kg_week))} kg/sem` : 'mantener'}</span>
          </div>
          <div className="m4">
            <div><div className="num" style={{ fontSize: 20 }}>{fmt(ph.kcal)}</div><div className="xs muted">kcal</div></div>
            <div><div className="num" style={{ fontSize: 20, color: 'var(--prot)' }}>{ph.protein_g}</div><div className="xs muted">prot. g</div></div>
            <div><div className="num" style={{ fontSize: 20, color: 'var(--carb)' }}>{ph.carbs_g}</div><div className="xs muted">carbos g</div></div>
            <div><div className="num" style={{ fontSize: 20, color: 'var(--fat)' }}>{ph.fat_g}</div><div className="xs muted">grasa g</div></div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn btn-soft btn-sm grow" onClick={() => void recalc()}><Icon name="refresh" size={16} />Recalcular ({fmtKg(weightNow)} kg)</button>
            <button className="btn btn-primary btn-sm grow" onClick={() => setPanel('fase')}>Cambiar objetivo</button>
          </div>
        </div>
      )}

      <div className="list">
        <Item icon="user" title="Mis datos" sub={`${profile.sex === 'm' ? 'Hombre' : 'Mujer'} · ${ACTIVITY[profile.activity].label} · ${profile.experience}`} onClick={() => setPanel('datos')} />
        <Item icon="dumbbell" title="Entrenamiento" sub={`${profile.training_days.map((d) => WEEKDAYS_SHORT[d]).join(' ')} · ${profile.session_min} min`} onClick={() => setPanel('entreno')} />
        <Item icon="food" title="Alimentación" sub={`${profile.diet} · agua ${fmt((profile.prefs?.waterGoal ?? 2500) / 1000, 1)} L`} onClick={() => setPanel('comida')} />
        <Item icon="clock" title="Comidas del día" sub={mealsFor(profile).map((m) => m.name).join(', ')} onClick={() => setPanel('comidas')} />
        <Item icon="calc" title="Barra y discos" sub={`Barra de ${fmtKg(profile.prefs?.bar ?? 20)} kg`} onClick={() => setPanel('discos')} />
        <div className="li">
          <span className="ico"><Icon name="moon" /></span>
          <span className="grow"><b>Modo oscuro</b></span>
          <Switch on={!light} onChange={(v) => void updatePrefs(profile, { theme: v ? 'dark' : 'light' })} label="Modo oscuro" />
        </div>
      </div>

      <div className="list">
        <div className="li">
          <span className="ico"><Icon name={sync.state === 'offline' ? 'wifi-off' : 'cloud'} /></span>
          <span className="grow"><b>Sincronización</b><div className="xs muted">{syncText}</div></span>
          {!LOCAL_MODE && <button className="btn btn-soft btn-sm" onClick={() => void syncNow()}>Ahora</button>}
        </div>
        <Item icon="download" title="Exportar mis datos" sub="Archivo JSON con todo lo que has registrado" onClick={async () => download(await exportAll(), `forus-${today}.json`)} />
      </div>

      <div className="list">
        {!LOCAL_MODE && <Item icon="logout" title="Cerrar sesión" onClick={() => void signOut()} />}
        <Item icon="trash" title={LOCAL_MODE ? 'Borrar los datos de este dispositivo' : 'Eliminar mi cuenta'} danger onClick={() => setPanel('borrar')} />
      </div>

      <p className="xs faint" style={{ textAlign: 'center', margin: '18px 0 0' }}>
        Forus {VERSION} · Alimentos: USDA FoodData Central y recetas chilenas calculadas · Ejercicios: free-exercise-db.<br />
        Las recomendaciones son estimaciones y no reemplazan a un profesional de la salud.
      </p>

      {panel === 'fase' && ph && <PhaseSheet profile={profile} weight={weightNow} current={ph.type} onClose={() => setPanel(null)} onSave={async (g, r) => { setPanel(null); await recalc(profile, g, r); }} />}
      {panel === 'datos' && <DataSheet profile={profile} onClose={() => setPanel(null)} onSave={(p) => saveProfile(p, true)} />}
      {panel === 'entreno' && <TrainingSheet profile={profile} onClose={() => setPanel(null)} onSave={(p) => saveProfile(p, true)} />}
      {panel === 'comida' && <FoodSheet profile={profile} onClose={() => setPanel(null)} onSave={(p) => saveProfile(p)} />}
      {panel === 'comidas' && <MealsSheet profile={profile} onClose={() => setPanel(null)} onSave={(meals) => saveProfile({ prefs: { ...profile.prefs, meals }, meals_per_day: meals.length })} />}
      {panel === 'discos' && <PlatesPrefs profile={profile} onClose={() => setPanel(null)} onSave={(bar, plates) => saveProfile({ prefs: { ...profile.prefs, bar, plates } })} />}
      {panel === 'borrar' && <DeleteSheet uid={userId} onClose={() => setPanel(null)} />}
    </div>
  );
}

function Item({ icon, title, sub, onClick, danger }: { icon: string; title: string; sub?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button className="li" onClick={onClick}>
      <span className="ico" style={danger ? { color: 'var(--danger)' } : undefined}><Icon name={icon} /></span>
      <span className="grow" style={{ minWidth: 0 }}><b className={danger ? 'danger' : ''}>{title}</b>{sub && <div className="xs muted truncate">{sub}</div>}</span>
      {!danger && <Icon name="chev-r" className="faint" />}
    </button>
  );
}

function PhaseSheet({ profile, weight, current, onClose, onSave }: { profile: Profile; weight: number; current: Goal; onClose: () => void; onSave: (g: Goal, rate: number) => void }) {
  const [goal, setGoal] = useState<Goal>(current);
  const [idx, setIdx] = useState(1);
  const pace = paceOptions(goal, profile.experience, weight);
  const rate = pace ? pace[idx] : 0;
  const plan = planFor(profile, weight, goal, rate);
  return (
    <Sheet open onClose={onClose} title="Nueva fase">
      {(Object.keys(GOALS) as Goal[]).map((g) => <Opt key={g} on={goal === g} onClick={() => { setGoal(g); setIdx(1); }} title={GOALS[g].label} hint={GOALS[g].hint} />)}
      {pace && (
        <div style={{ margin: '6px 0 12px' }}>
          <Seg options={pace.map((p, i) => ({ value: i, label: ['Suave', 'Recomendado', 'Rápido'][i], sub: `${p > 0 ? '+' : '−'}${fmtKg(Math.abs(p))} kg/sem` }))} value={idx} onChange={setIdx} />
        </div>
      )}
      <div className="m4" style={{ marginBottom: 14 }}>
        <div><div className="num" style={{ fontSize: 20 }}>{fmt(plan.kcal)}</div><div className="xs muted">kcal</div></div>
        <div><div className="num" style={{ fontSize: 20 }}>{plan.protein}</div><div className="xs muted">prot. g</div></div>
        <div><div className="num" style={{ fontSize: 20 }}>{plan.carbs}</div><div className="xs muted">carbos g</div></div>
        <div><div className="num" style={{ fontSize: 20 }}>{plan.fat}</div><div className="xs muted">grasa g</div></div>
      </div>
      {plan.warnings.map((w) => <div key={w} className="hint warn" style={{ marginBottom: 10 }}><Icon name="info" size={18} /><span>{w}</span></div>)}
      <button className="btn btn-primary" onClick={() => onSave(goal, rate)}>Empezar desde hoy</button>
      <p className="xs muted" style={{ marginTop: 8 }}>La fase actual se cierra ayer y queda en tu historial.</p>
    </Sheet>
  );
}

function DataSheet({ profile, onClose, onSave }: { profile: Profile; onClose: () => void; onSave: (p: Partial<Profile>) => void }) {
  const [v, setV] = useState({ name: profile.name, sex: profile.sex, birth: profile.birth_date, height: profile.height_cm, activity: profile.activity, experience: profile.experience });
  return (
    <Sheet open onClose={onClose} title="Mis datos">
      <label className="field"><span>Nombre</span><input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
      <div className="field"><span>Sexo</span><Seg options={[{ value: 'm' as Sex, label: 'Hombre' }, { value: 'f' as Sex, label: 'Mujer' }]} value={v.sex} onChange={(sex) => setV({ ...v, sex })} /></div>
      <label className="field"><span>Fecha de nacimiento</span><input className="input" type="date" value={v.birth} onChange={(e) => setV({ ...v, birth: e.target.value })} /></label>
      <div className="field"><span>Estatura</span><Stepper value={v.height} onChange={(height) => setV({ ...v, height })} min={120} max={230} unit="cm" /></div>
      <label className="field"><span>Actividad diaria (sin contar el gimnasio)</span>
        <select className="input" value={v.activity} onChange={(e) => setV({ ...v, activity: e.target.value as Activity })}>
          {(Object.keys(ACTIVITY) as Activity[]).map((a) => <option key={a} value={a}>{ACTIVITY[a].label} — {ACTIVITY[a].hint}</option>)}
        </select>
      </label>
      <div className="field"><span>Experiencia</span>
        <Seg options={[{ value: 'principiante' as Level, label: 'Principiante' }, { value: 'intermedio' as Level, label: 'Intermedio' }, { value: 'avanzado' as Level, label: 'Avanzado' }]} value={v.experience} onChange={(experience) => setV({ ...v, experience })} />
      </div>
      <button className="btn btn-primary" disabled={!v.name.trim() || !v.birth} onClick={() => onSave({ name: v.name.trim(), sex: v.sex, birth_date: v.birth, height_cm: v.height, activity: v.activity, experience: v.experience })}>Guardar</button>
    </Sheet>
  );
}

function TrainingSheet({ profile, onClose, onSave }: { profile: Profile; onClose: () => void; onSave: (p: Partial<Profile>) => void }) {
  const [days, setDays] = useState(profile.training_days);
  const [min, setMin] = useState(profile.session_min);
  const [time, setTime] = useState(profile.training_time);
  const [eq, setEq] = useState(profile.equipment);
  return (
    <Sheet open onClose={onClose} title="Entrenamiento">
      <div className="field"><span>Días de entrenamiento</span>
        <div className="chips">{WEEKDAYS.map((w, i) => <button key={i} className={days.includes(i) ? 'on' : ''} onClick={() => setDays(days.includes(i) ? days.filter((d) => d !== i) : [...days, i].sort())}>{w.slice(0, 3)}</button>)}</div>
      </div>
      <div className="field"><span>Duración</span><Seg options={[45, 60, 75, 90].map((m) => ({ value: m, label: `${m} min` }))} value={min} onChange={setMin} /></div>
      <label className="field"><span>Hora habitual</span><input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
      <div className="field"><span>Equipamiento</span>
        <div className="chips">{EQUIPMENT_OPTIONS.map(([id, label]) => <button key={id} className={eq.includes(id) ? 'on' : ''} onClick={() => setEq(eq.includes(id) ? eq.filter((x) => x !== id) : [...eq, id])}>{label}</button>)}</div>
      </div>
      <p className="xs muted" style={{ marginBottom: 12 }}>Los días de cada rutina se cambian en Entrenar → rutina → Editar calendario. Aquí se usan para calcular tu gasto.</p>
      <button className="btn btn-primary" disabled={!days.length || !eq.length} onClick={() => onSave({ training_days: days, session_min: min, training_time: time, equipment: eq })}>Guardar</button>
    </Sheet>
  );
}

function FoodSheet({ profile, onClose, onSave }: { profile: Profile; onClose: () => void; onSave: (p: Partial<Profile>) => void }) {
  const [diet, setDiet] = useState(profile.diet);
  const [budget, setBudget] = useState(profile.budget);
  const [dislikes, setDislikes] = useState(profile.dislikes.join(', '));
  const [allergies, setAllergies] = useState(profile.allergies);
  const [water, setWater] = useState(profile.prefs?.waterGoal ?? 2500);
  return (
    <Sheet open onClose={onClose} title="Alimentación">
      <div className="field"><span>Dieta</span><Seg options={[{ value: 'omnivora' as Diet, label: 'Omnívora' }, { value: 'vegetariana' as Diet, label: 'Vegetariana' }, { value: 'vegana' as Diet, label: 'Vegana' }]} value={diet} onChange={setDiet} /></div>
      <label className="field"><span>No me gusta</span><input className="input" value={dislikes} onChange={(e) => setDislikes(e.target.value)} /></label>
      <label className="field"><span>Alergias o intolerancias</span><input className="input" value={allergies} onChange={(e) => setAllergies(e.target.value)} /></label>
      <div className="field"><span>Presupuesto</span><Seg options={[{ value: 'bajo' as Budget, label: 'Ajustado' }, { value: 'medio' as Budget, label: 'Medio' }, { value: 'alto' as Budget, label: 'Holgado' }]} value={budget} onChange={setBudget} /></div>
      <div className="field"><span>Meta de agua</span><Stepper value={water} onChange={setWater} step={250} min={1000} max={6000} unit="ml al día" /></div>
      <button className="btn btn-primary" onClick={() => onSave({ diet, budget, allergies: allergies.trim(), dislikes: dislikes.split(',').map((s) => s.trim()).filter(Boolean), prefs: { ...profile.prefs, waterGoal: water } })}>Guardar</button>
    </Sheet>
  );
}

function MealsSheet({ profile, onClose, onSave }: { profile: Profile; onClose: () => void; onSave: (m: MealSlot[]) => void }) {
  const [meals, setMeals] = useState<MealSlot[]>(mealsFor(profile));
  const set = (i: number, patch: Partial<MealSlot>) => setMeals(meals.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  return (
    <Sheet open onClose={onClose} title="Comidas del día">
      {meals.map((m, i) => (
        <div key={m.id} className="row" style={{ marginBottom: 8 }}>
          <input className="input grow" value={m.name} onChange={(e) => set(i, { name: e.target.value })} aria-label="Nombre de la comida" />
          <input className="input" type="time" style={{ width: 118 }} value={m.time} onChange={(e) => set(i, { time: e.target.value })} aria-label="Hora" />
          <button className="icon-btn" disabled={meals.length <= 1} onClick={() => setMeals(meals.filter((_, j) => j !== i))} aria-label={`Quitar ${m.name}`}><Icon name="trash" size={18} /></button>
        </div>
      ))}
      <button className="btn btn-soft" style={{ marginBottom: 12 }} disabled={meals.length >= 8} onClick={() => setMeals([...meals, { id: uid(), name: 'Colación', time: '16:00' }])}><Icon name="plus" size={18} />Agregar comida</button>
      <p className="xs muted" style={{ marginBottom: 12 }}>Si quitas una comida, lo que ya registraste en ella aparece en "Otros".</p>
      <button className="btn btn-primary" disabled={meals.some((m) => !m.name.trim())} onClick={() => onSave([...meals].map((m) => ({ ...m, name: m.name.trim() })).sort((a, b) => a.time.localeCompare(b.time)))}>Guardar</button>
    </Sheet>
  );
}

function PlatesPrefs({ profile, onClose, onSave }: { profile: Profile; onClose: () => void; onSave: (bar: number, plates: number[]) => void }) {
  const [bar, setBar] = useState(profile.prefs?.bar ?? 20);
  const [plates, setPlates] = useState<number[]>(profile.prefs?.plates ?? DEFAULT_PLATES);
  const ALL = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5];
  return (
    <Sheet open onClose={onClose} title="Barra y discos">
      <div className="field"><span>Peso de la barra</span><Seg options={[20, 15, 10, 7].map((b) => ({ value: b, label: `${b} kg` }))} value={bar} onChange={setBar} /></div>
      <div className="field"><span>Discos disponibles (pares)</span>
        <div className="chips">{ALL.map((p) => <button key={p} className={plates.includes(p) ? 'on' : ''} onClick={() => setPlates(plates.includes(p) ? plates.filter((x) => x !== p) : [...plates, p].sort((a, b) => b - a))}>{fmtKg(p)} kg</button>)}</div>
      </div>
      <button className="btn btn-primary" disabled={!plates.length} onClick={() => onSave(bar, plates)}>Guardar</button>
    </Sheet>
  );
}

function DeleteSheet({ uid: userId, onClose }: { uid: string; onClose: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    setErr(null);
    try {
      if (supabase) {
        const { error } = await supabase.rpc('delete_my_account');
        if (error) throw error;
        stopSync();
        await supabase.auth.signOut({ scope: 'local' });
      }
      setTimeout(async () => { closeStore(); await Dexie.delete(`forus-${userId}`); location.replace('/'); }, 300);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }
  return (
    <Sheet open onClose={onClose} title={LOCAL_MODE ? 'Borrar datos' : 'Eliminar mi cuenta'}>
      <p className="small muted" style={{ marginBottom: 12 }}>
        {LOCAL_MODE ? 'Se borra todo lo registrado en este dispositivo.' : 'Se borran tu cuenta y todos tus datos (entrenamientos, comidas, pesajes) de la nube y de este dispositivo.'} No se puede deshacer. Si quieres una copia, primero usa "Exportar mis datos".
      </p>
      <label className="field"><span>Escribe ELIMINAR para confirmar</span><input className="input" value={text} onChange={(e) => setText(e.target.value)} autoCapitalize="characters" /></label>
      {err && <div className="hint warn" style={{ marginBottom: 12 }}><Icon name="info" size={18} /><span>{err}</span></div>}
      <button className="btn btn-danger" disabled={text.trim().toUpperCase() !== 'ELIMINAR' || busy} onClick={go}>{busy ? 'Eliminando…' : 'Eliminar definitivamente'}</button>
    </Sheet>
  );
}
