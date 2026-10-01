import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useApp, useToday } from '../../data/app';
import { useMesocycles, useRoutine } from '../../data/hooks';
import { activeMeso } from '../../data/logic';
import { put, remove, update } from '../../data/store';
import { activateRoutine } from '../../data/actions';
import type { Mesocycle, Routine, RoutineDay, RoutineExercise, SetPlan, SetType } from '../../data/types';
import { buildSchedule, defaultRirPlan, plannedForDay } from '../../core/schedule';
import { uid } from '../../core/templates';
import { WEEKDAYS } from '../../core/dates';
import { Icon } from '../../ui/Icon';
import { Header, Seg, Sheet, Spinner, Stepper, Switch, useToast } from '../../ui/kit';
import { ExercisePicker, Thumb } from '../../ui/shared';

export function RoutineEditor() {
  const { id } = useParams();
  const routine = useRoutine(id);
  if (routine === undefined) return <div className="center-screen"><Spinner /></div>;
  if (!routine || routine.deleted_at) return <Navigate to="/entrenar/rutinas" replace />;
  return <Editor key={routine.id} initial={routine} />;
}

const fmtRest = (sec: number) => (!sec ? 'sin descanso' : sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : `${sec} s`);

/** Las letras de superserie solo valen si unen ejercicios consecutivos; se re-etiquetan A, B, C… */
function normalizeGroups(exs: RoutineExercise[]): RoutineExercise[] {
  const raw = exs.map((e, i) => {
    const g = e.group;
    if (!g) return null;
    const linked = (i > 0 && exs[i - 1].group === g) || (i + 1 < exs.length && exs[i + 1].group === g);
    return linked ? g : null;
  });
  let letter = 0;
  let current = '';
  return exs.map((e, i) => {
    const g = raw[i];
    if (!g) return e.group ? { ...e, group: null } : e;
    if (i === 0 || raw[i - 1] !== g) current = String.fromCharCode(65 + letter++);
    return e.group === current ? e : { ...e, group: current };
  });
}

function summary(e: RoutineExercise): string {
  const work = e.sets.filter((s) => s.type !== 'C');
  const warm = e.sets.length - work.length;
  const w = work[0];
  if (!w) return 'Sin series';
  const reps = w.repsMin === w.repsMax ? `${w.repsMin}` : `${w.repsMin}–${w.repsMax}`;
  const last = work[work.length - 1]?.type;
  return `${warm ? `${warm}C + ` : ''}${work.length} × ${reps}${w.rir != null ? ` · RIR ${w.rir}` : ''} · ${fmtRest(e.rest)}${last === 'D' ? ' · drop' : last === 'RP' ? ' · rest-pause' : ''}`;
}

function Editor({ initial }: { initial: Routine }) {
  const { cat } = useApp();
  const nav = useNavigate();
  const toast = useToast();
  const today = useToday();
  const mesos = useMesocycles();
  const active = activeMeso(mesos);
  const isActive = active?.routine_id === initial.id;
  const [r, setR] = useState(initial);
  const [dayIdx, setDayIdx] = useState(0);
  const [cfg, setCfg] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ replace?: string } | null>(null);
  const [dayMenu, setDayMenu] = useState(false);
  const [mesoOpen, setMesoOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const latest = useRef(r);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useCallback(() => { if (timer.current) { clearTimeout(timer.current); timer.current = null; void put('routines', latest.current); } }, []);
  useEffect(() => () => flush(), [flush]);
  const save = (next: Routine) => {
    latest.current = next;
    setR(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; void put('routines', latest.current); }, 400);
  };
  const day = r.days[Math.min(dayIdx, r.days.length - 1)];
  const setDay = (fn: (d: RoutineDay) => RoutineDay) => save({ ...latest.current, days: latest.current.days.map((d) => (d.id === day.id ? fn(d) : d)) });
  const setExs = (fn: (exs: RoutineExercise[]) => RoutineExercise[]) => setDay((d) => ({ ...d, exercises: normalizeGroups(fn(d.exercises)) }));

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = (ev: DragEndEvent) => {
    const { active: a, over } = ev;
    if (!over || a.id === over.id) return;
    setExs((exs) => arrayMove(exs, exs.findIndex((e) => e.uid === a.id), exs.findIndex((e) => e.uid === over.id)));
  };

  function addDay() {
    const letter = String.fromCharCode(65 + r.days.length);
    const d: RoutineDay = { id: uid(), name: `Día ${letter}`, exercises: [] };
    save({ ...latest.current, days: [...latest.current.days, d] });
    setDayIdx(r.days.length);
  }

  const cfgEx = cfg ? day?.exercises.find((e) => e.uid === cfg) : undefined;
  const cfgIndex = cfgEx ? day.exercises.indexOf(cfgEx) : -1;

  if (!day) return null;
  return (
    <div className="page full">
      <Header title="Editar rutina" back="/entrenar/rutinas" right={isActive ? <span className="badge">Activa</span> : undefined} />
      <label className="field"><span>Nombre</span>
        <input className="input" value={r.name} onChange={(e) => save({ ...latest.current, name: e.target.value })} />
      </label>

      <div className="chips" style={{ flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 6, marginBottom: 8 }}>
        {r.days.map((d, i) => <button key={d.id} className={i === dayIdx ? 'on' : ''} onClick={() => setDayIdx(i)} style={{ whiteSpace: 'nowrap' }}>{d.name}</button>)}
        <button onClick={addDay} aria-label="Agregar día" style={{ whiteSpace: 'nowrap' }}>+ Día</button>
      </div>

      <div className="row" style={{ marginBottom: 10 }}>
        <input className="input grow" value={day.name} onChange={(e) => setDay((d) => ({ ...d, name: e.target.value }))} aria-label="Nombre del día" />
        <button className="icon-btn" style={{ height: 52, width: 52 }} onClick={() => setDayMenu(true)} aria-label="Opciones del día"><Icon name="more" /></button>
      </div>

      {day.exercises.length === 0 && <div className="empty" style={{ marginBottom: 10 }}>Este día no tiene ejercicios. Agrega el primero.</div>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={day.exercises.map((e) => e.uid)} strategy={verticalListSortingStrategy}>
          {day.exercises.map((e) => {
            const cex = cat.exById.get(e.exId);
            return (
              <SortRow key={e.uid} id={e.uid}>
                <button className="row grow" style={{ textAlign: 'left', minWidth: 0 }} onClick={() => setCfg(e.uid)}>
                  <Thumb ex={cex} size={44} />
                  <div className="grow">
                    <div className="truncate">{e.group && <span className="tag-ss">{e.group}</span>}<b>{cex?.n ?? 'Ejercicio'}</b></div>
                    <div className="xs muted truncate">{summary(e)}</div>
                  </div>
                </button>
              </SortRow>
            );
          })}
        </SortableContext>
      </DndContext>
      <button className="btn btn-soft" onClick={() => setPicker({})}><Icon name="plus" size={18} />Agregar ejercicio</button>
      <p className="xs faint" style={{ marginTop: 8 }}>Arrastra desde ⋮⋮ para reordenar. Para una superserie, abre un ejercicio y únelo con el siguiente.</p>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="h2">Mesociclo</div>
        {isActive && active ? (
          <>
            <p className="small muted" style={{ margin: '4px 0 12px' }}>
              {active.name} · semana {plannedForDay(active, today, 0).week} de {active.weeks}{active.deload_week ? ` · descarga en la semana ${active.deload_week}` : ''}
            </p>
            <button className="btn btn-soft" onClick={() => { flush(); setMesoOpen(true); }}><Icon name="cal" size={18} />Editar calendario</button>
          </>
        ) : (
          <>
            <p className="small muted" style={{ margin: '4px 0 12px' }}>Al usarla, se arma tu calendario semanal y la progresión de esfuerzo (RIR) con semana de descarga.</p>
            <button className="btn btn-primary" onClick={() => { flush(); setMesoOpen(true); }}>Usar esta rutina</button>
          </>
        )}
      </div>

      {!isActive && (
        <button className="btn btn-danger" onClick={async () => {
          if (!confirmDel) { setConfirmDel(true); return; }
          if (timer.current) clearTimeout(timer.current);
          timer.current = null;
          await remove('routines', r.id);
          toast('Rutina eliminada');
          nav('/entrenar/rutinas', { replace: true });
        }}>{confirmDel ? 'Toca de nuevo para eliminar' : 'Eliminar rutina'}</button>
      )}

      <Sheet open={dayMenu} onClose={() => setDayMenu(false)} title={day.name}>
        <div className="list">
          <button className="li" onClick={() => {
            const copy: RoutineDay = { id: uid(), name: `${day.name} (copia)`, exercises: day.exercises.map((e) => ({ ...e, uid: uid() })) };
            save({ ...latest.current, days: [...latest.current.days, copy] });
            setDayIdx(r.days.length);
            setDayMenu(false);
          }}><span className="ico"><Icon name="copy" /></span><span className="grow">Duplicar día</span></button>
          <button className="li" disabled={dayIdx === 0} onClick={() => {
            const days = [...latest.current.days];
            [days[dayIdx - 1], days[dayIdx]] = [days[dayIdx], days[dayIdx - 1]];
            save({ ...latest.current, days }); setDayIdx(dayIdx - 1); setDayMenu(false);
          }}><span className="ico"><Icon name="chev-l" /></span><span className="grow">Mover antes</span></button>
          <button className="li" disabled={dayIdx >= r.days.length - 1} onClick={() => {
            const days = [...latest.current.days];
            [days[dayIdx + 1], days[dayIdx]] = [days[dayIdx], days[dayIdx + 1]];
            save({ ...latest.current, days }); setDayIdx(dayIdx + 1); setDayMenu(false);
          }}><span className="ico"><Icon name="chev-r" /></span><span className="grow">Mover después</span></button>
          <button className="li" disabled={r.days.length <= 1} onClick={() => {
            const before = latest.current;
            save({ ...latest.current, days: latest.current.days.filter((d) => d.id !== day.id) });
            setDayIdx(Math.max(0, dayIdx - 1)); setDayMenu(false);
            toast('Día eliminado', 'Deshacer', () => save(before));
          }}><span className="ico" style={{ color: 'var(--danger)' }}><Icon name="trash" /></span><span className="grow danger">Eliminar día</span></button>
        </div>
        {isActive && <p className="xs muted">Si cambias el orden o la cantidad de días, revisa el calendario del mesociclo.</p>}
      </Sheet>

      {cfgEx && (
        <ExerciseConfig
          key={cfgEx.uid} ex={cfgEx} hasNext={cfgIndex < day.exercises.length - 1}
          linked={!!cfgEx.group && day.exercises[cfgIndex + 1]?.group === cfgEx.group}
          onClose={() => setCfg(null)}
          onChange={(next, link) => setExs((exs) => {
            const i = exs.findIndex((e) => e.uid === next.uid);
            const out = exs.map((e) => (e.uid === next.uid ? next : e));
            if (link !== undefined && i + 1 < out.length) {
              if (link) {
                const g = out[i].group ?? out[i + 1].group ?? 'Z' + uid().slice(0, 4);
                out[i] = { ...out[i], group: g };
                out[i + 1] = { ...out[i + 1], group: g };
              } else if (out[i].group && out[i + 1].group === out[i].group) {
                // Separa: el siguiente pasa a otro grupo (normalize limpia los sueltos).
                out[i] = { ...out[i], rest: out[i].rest || 90 };
                out[i + 1] = { ...out[i + 1], group: 'Y' + uid().slice(0, 4) };
                for (let k = i + 2; k < out.length && exs[k].group === exs[i].group; k++) out[k] = { ...out[k], group: out[i + 1].group };
              }
            }
            return out;
          })}
          onReplace={() => { setPicker({ replace: cfgEx.uid }); setCfg(null); }}
          onRemove={() => {
            const before = latest.current;
            setExs((exs) => exs.filter((e) => e.uid !== cfgEx.uid));
            setCfg(null);
            toast('Ejercicio quitado', 'Deshacer', () => save(before));
          }}
        />
      )}

      <ExercisePicker
        open={!!picker} onClose={() => setPicker(null)}
        title={picker?.replace ? 'Cambiar ejercicio' : 'Agregar ejercicio'}
        similarTo={picker?.replace ? day.exercises.find((e) => e.uid === picker.replace)?.exId : null}
        onPick={(exId) => {
          if (picker?.replace) setExs((exs) => exs.map((e) => (e.uid === picker.replace ? { ...e, exId } : e)));
          else setExs((exs) => [...exs, { uid: uid(), exId, rest: 90, group: null, sets: Array.from({ length: 3 }, () => ({ type: 'E' as const, repsMin: 8, repsMax: 12, rir: 2 })) }]);
          setPicker(null);
        }}
      />

      {mesoOpen && <MesoSheet routine={r} mesos={mesos} existing={isActive ? active ?? null : null} today={today} onClose={() => setMesoOpen(false)} />}
    </div>
  );
}

function SortRow({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} className="ex row" style={{ transform: CSS.Transform.toString(transform), transition, position: 'relative', zIndex: isDragging ? 5 : undefined, boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,.35)' : undefined, padding: '10px 10px 10px 4px', gap: 6 }}>
      <button className="drag" {...attributes} {...listeners} aria-label="Arrastrar para reordenar"><Icon name="grip" /></button>
      {children}
    </div>
  );
}

function ExerciseConfig({ ex, hasNext, linked, onClose, onChange, onReplace, onRemove }: {
  ex: RoutineExercise; hasNext: boolean; linked: boolean; onClose: () => void;
  onChange: (e: RoutineExercise, link?: boolean) => void; onReplace: () => void; onRemove: () => void;
}) {
  const { cat } = useApp();
  const work = ex.sets.filter((s) => s.type !== 'C');
  const first = work[0] ?? { type: 'E' as SetType, repsMin: 8, repsMax: 12, rir: 2 };
  const lastType = work.length > 1 && work[work.length - 1].type !== 'E' ? work[work.length - 1].type : 'E';
  const warm = ex.sets.length - work.length;
  const rebuild = (o: { warm?: number; work?: number; min?: number; max?: number; rir?: number | null; last?: SetType }) => {
    const nWarm = o.warm ?? warm, nWork = o.work ?? work.length;
    let min = o.min ?? first.repsMin, max = o.max ?? first.repsMax;
    if (o.min != null && min > max) max = min;
    if (o.max != null && max < min) min = max;
    const rir = o.rir !== undefined ? o.rir : first.rir;
    const lt = o.last ?? lastType;
    const sets: SetPlan[] = [
      ...Array.from({ length: nWarm }, () => ({ type: 'C' as SetType, repsMin: 5, repsMax: 8, rir: null })),
      ...Array.from({ length: nWork }, (_, i) => ({ type: (i === nWork - 1 && nWork > 1 ? lt : 'E') as SetType, repsMin: min, repsMax: max, rir })),
    ];
    onChange({ ...ex, sets });
  };
  return (
    <Sheet open onClose={onClose} title={cat.exById.get(ex.exId)?.n ?? 'Ejercicio'}>
      <div className="grid2" style={{ marginBottom: 0 }}>
        <div><div className="xs muted">Series efectivas</div><Stepper value={work.length} onChange={(v) => rebuild({ work: v })} min={1} max={10} compact /></div>
        <div><div className="xs muted">Calentamiento</div><Stepper value={warm} onChange={(v) => rebuild({ warm: v })} min={0} max={4} compact /></div>
        <div><div className="xs muted">Reps mínimas</div><Stepper value={first.repsMin} onChange={(v) => rebuild({ min: v })} min={1} max={50} compact /></div>
        <div><div className="xs muted">Reps máximas</div><Stepper value={first.repsMax} onChange={(v) => rebuild({ max: v })} min={1} max={50} compact /></div>
      </div>
      <div className="field"><span>RIR objetivo (lo ajusta el mesociclo cada semana)</span>
        <Seg options={[0, 1, 2, 3, 4].map((v) => ({ value: v, label: String(v) }))} value={first.rir ?? -1} onChange={(v) => rebuild({ rir: v })} />
      </div>
      <div className="field"><span>Descanso</span>
        <Seg options={(linked ? [0, 60, 90, 120, 180] : [60, 90, 120, 150, 180, 240]).map((v) => ({ value: v, label: v ? fmtRest(v) : 'Sin' }))} value={ex.rest} onChange={(v) => onChange({ ...ex, rest: v })} />
      </div>
      <div className="field"><span>Última serie</span>
        <Seg options={[{ value: 'E' as SetType, label: 'Normal' }, { value: 'D' as SetType, label: 'Drop set' }, { value: 'RP' as SetType, label: 'Rest-pause' }]} value={lastType} onChange={(v) => rebuild({ last: v })} />
      </div>
      {hasNext && (
        <div className="row between" style={{ margin: '4px 0 14px' }}>
          <div><b>Superserie con el siguiente</b><div className="xs muted">Se hacen seguidos y se descansa al final</div></div>
          <Switch on={linked} onChange={(v) => onChange(ex, v)} label="Superserie con el siguiente" />
        </div>
      )}
      <label className="field"><span>Nota (se verá en el gimnasio)</span>
        <input className="input" value={ex.note ?? ''} onChange={(e) => onChange({ ...ex, note: e.target.value || undefined })} placeholder="Ej.: agarre neutro, asiento en 4" />
      </label>
      <div className="row">
        <button className="btn btn-soft grow" onClick={onReplace}><Icon name="repeat" size={18} />Cambiar</button>
        <button className="btn btn-danger grow" onClick={onRemove}><Icon name="trash" size={18} />Quitar</button>
      </div>
      <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={onClose}>Listo</button>
    </Sheet>
  );
}

function MesoSheet({ routine, mesos, existing, today, onClose }: { routine: Routine; mesos: Mesocycle[]; existing: Mesocycle | null; today: string; onClose: () => void }) {
  const { profile } = useApp();
  const toast = useToast();
  const [weeks, setWeeks] = useState(existing?.weeks ?? 6);
  const [deload, setDeload] = useState(existing ? existing.deload_week != null : true);
  const [start, setStart] = useState(existing?.start_date ?? today);
  const [schedule, setSchedule] = useState<Record<string, number>>(() => existing?.schedule ?? buildSchedule(profile.training_days.length ? profile.training_days : [0, 2, 4], routine));
  const rir = existing && existing.weeks === weeks && (existing.deload_week != null) === deload ? existing.rir_plan : defaultRirPlan(weeks, deload);
  const n = mesos.filter((m) => m.routine_id === routine.id).length;

  async function saveMeso() {
    const data = { weeks, deload_week: deload ? weeks : null, rir_plan: rir, schedule, start_date: start };
    if (existing) {
      await update('mesocycles', existing.id, data);
      toast('Calendario actualizado');
    } else {
      await activateRoutine(mesos, { id: uid(), routine_id: routine.id, name: `Mesociclo ${n + 1}`, status: 'activo', ...data });
      toast(`${routine.name} es tu rutina activa`);
    }
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={existing ? 'Calendario del mesociclo' : 'Usar esta rutina'}>
      <label className="field"><span>Empieza</span><input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
      <div className="field"><span>Semanas</span>
        <Seg options={[4, 5, 6, 7, 8].map((v) => ({ value: v, label: String(v) }))} value={weeks} onChange={setWeeks} />
      </div>
      <div className="row between" style={{ marginBottom: 12 }}>
        <div><b>Semana de descarga al final</b><div className="xs muted">Mitad de series y lejos del fallo para recuperarte</div></div>
        <Switch on={deload} onChange={setDeload} label="Semana de descarga" />
      </div>
      <div className="chips" style={{ marginBottom: 16 }}>
        {rir.map((v, i) => <span key={i} className={`chip${deload && i === weeks - 1 ? '' : ' hot'}`}>S{i + 1} · {deload && i === weeks - 1 ? 'descarga' : `RIR ${v}`}</span>)}
      </div>
      <div className="eyebrow" style={{ marginBottom: 6 }}>Qué día toca cada día</div>
      {WEEKDAYS.map((w, i) => (
        <div key={i} className="row between" style={{ padding: '6px 0' }}>
          <span>{w}</span>
          <select className="input" style={{ width: 190, height: 44 }} value={schedule[String(i)] ?? -1}
            onChange={(e) => { const v = Number(e.target.value); setSchedule((s) => { const o = { ...s }; if (v < 0) delete o[String(i)]; else o[String(i)] = v; return o; }); }}>
            <option value={-1}>Descanso</option>
            {routine.days.map((d, k) => <option key={d.id} value={k}>{d.name}</option>)}
          </select>
        </div>
      ))}
      <button className="btn btn-primary" style={{ marginTop: 14 }} disabled={!Object.keys(schedule).length} onClick={saveMeso}>{existing ? 'Guardar calendario' : 'Activar rutina'}</button>
      {!existing && <p className="xs muted" style={{ marginTop: 8 }}>Tu rutina activa actual (si tienes una) queda terminada y su historial se conserva.</p>}
    </Sheet>
  );
}
