// Modo sesión: la pantalla del gimnasio. Todo se guarda al instante en el teléfono.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useApp } from '../../data/app';
import { useSession, useSessions } from '../../data/hooks';
import { put, remove } from '../../data/store';
import { buildSessionExercise, fmt, fmtKg, lastPerformance } from '../../data/logic';
import type { SessionExercise, SetLog, SetType, WorkoutSession } from '../../data/types';
import { detectPRs, sessionVolume } from '../../core/strength';
import { describeSets } from '../../core/progression';
import { uid } from '../../core/templates';
import { Icon } from '../../ui/Icon';
import { Seg, Sheet, Spinner, Stepper, useToast, vibrate } from '../../ui/kit';
import { ExercisePicker, PlatesSheet, Thumb } from '../../ui/shared';
import { beep, primeAudio } from '../../ui/audio';
import { TechniqueContent } from './Library';

export function SessionScreen() {
  const { id } = useParams();
  const session = useSession(id);
  if (session === undefined) return <div className="center-screen"><Spinner /></div>;
  if (!session || session.deleted_at) return <Navigate to="/entrenar" replace />;
  if (session.status !== 'en_curso') return <Navigate to={`/entrenar/resumen/${session.id}`} replace />;
  return <SessionView key={session.id} initial={session} />;
}

type Rest = { sid: string; end: number; total: number };
const REST_KEY = 'forus-rest';
const readRest = (sid: string): Rest | null => {
  try { const r = JSON.parse(localStorage.getItem(REST_KEY) ?? 'null') as Rest | null; return r && r.sid === sid && r.end > Date.now() - 5000 ? r : null; } catch { return null; }
};
const writeRest = (r: Rest | null) => { try { if (r) localStorage.setItem(REST_KEY, JSON.stringify(r)); else localStorage.removeItem(REST_KEY); } catch { /* sin almacenamiento */ } };

const KG_STEP: Record<string, number> = { mancuerna: 1, kettlebell: 4, banda: 1, maquina: 2.5, polea: 2.5 };
const isWork = (s: SetLog) => s.type !== 'C';
const exDone = (e: SessionExercise) => e.sets.length > 0 && e.sets.every((s) => s.done);

function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let alive = true;
    const req = async () => {
      try { if (alive && document.visibilityState === 'visible' && 'wakeLock' in navigator) lock = await navigator.wakeLock.request('screen'); } catch { /* no soportado */ }
    };
    void req();
    const onVis = () => { if (document.visibilityState === 'visible') void req(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; document.removeEventListener('visibilitychange', onVis); void lock?.release().catch(() => {}); };
  }, []);
}

function SessionView({ initial }: { initial: WorkoutSession }) {
  const { cat } = useApp();
  const nav = useNavigate();
  const toast = useToast();
  const sessions = useSessions();
  const [s, setS] = useState(initial);
  const [open, setOpen] = useState<string | null>(() => initial.exercises.find((e) => !exDone(e))?.uid ?? null);
  const [edit, setEdit] = useState<{ ex: string; i: number } | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ replace?: string } | null>(null);
  const [plates, setPlates] = useState<number | null | undefined>(undefined);
  const [tech, setTech] = useState<string | null>(null);
  const [memo, setMemo] = useState<string | null>(null);
  const [finish, setFinish] = useState(false);
  const [rest, setRest] = useState<Rest | null>(() => readRest(initial.id));
  useWakeLock();

  // Guardado: estado local inmediato + escritura en la base con una pequeña espera.
  const latest = useRef(s);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; void put('workout_sessions', latest.current); }
  }, []);
  const save = useCallback((next: WorkoutSession) => {
    latest.current = next;
    setS(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; void put('workout_sessions', latest.current); }, 350);
  }, []);
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', flush); flush(); };
  }, [flush]);

  const setExercises = (fn: (exs: SessionExercise[]) => SessionExercise[]) => save({ ...latest.current, exercises: fn(latest.current.exercises) });
  const patchSet = (exUid: string, i: number, patch: Partial<SetLog>) =>
    setExercises((exs) => exs.map((e) => (e.uid === exUid ? { ...e, sets: e.sets.map((x, j) => (j === i ? { ...x, ...patch } : x)) } : e)));

  const startRest = (sec: number) => {
    if (sec <= 0) return;
    const r = { sid: s.id, end: Date.now() + sec * 1000, total: sec };
    writeRest(r);
    setRest(r);
  };

  const labels = useMemo(() => {
    const out = new Map<string, string>();
    const exs = s.exercises;
    for (let i = 0; i < exs.length; i++) {
      const g = exs[i].group;
      if (!g) continue;
      let n = 1;
      for (let k = i - 1; k >= 0 && exs[k].group === g; k--) n++;
      const runLen = (() => { let k = i; while (k + 1 < exs.length && exs[k + 1].group === g) k++; return k; })();
      if (n > 1 || runLen > i) out.set(exs[i].uid, `${g}${n}`);
    }
    return out;
  }, [s.exercises]);

  function afterDone(exs: SessionExercise[], exUid: string, i: number) {
    const k = exs.findIndex((e) => e.uid === exUid);
    const ex = exs[k];
    const next = ex.sets[i + 1];
    if (next && !next.done && next.type === 'D') return; // drop set: sin descanso
    if (next && !next.done && next.type === 'RP') { startRest(20); return; }
    const g = ex.group;
    if (g && labels.has(ex.uid)) {
      // Superserie: pasa al siguiente del grupo sin descanso; el descanso corre al terminar la vuelta.
      let j = k + 1;
      while (j < exs.length && exs[j].group === g) {
        if (exs[j].sets.some((x) => !x.done)) { setOpen(exs[j].uid); scrollTo(exs[j].uid); return; }
        j++;
      }
      let first = k;
      while (first > 0 && exs[first - 1].group === g) first--;
      const group = exs.slice(first, j);
      const pendingFirst = group.find((e) => e.sets.some((x) => !x.done));
      startRest(Math.max(...group.map((e) => e.rest)));
      if (pendingFirst) { setOpen(pendingFirst.uid); return; }
    } else {
      startRest(ex.rest);
    }
    if (exDone(ex)) {
      const nextEx = exs.slice(k + 1).find((e) => !exDone(e)) ?? exs.find((e) => !exDone(e));
      if (nextEx) { setOpen(nextEx.uid); scrollTo(nextEx.uid); }
    }
  }

  function toggleDone(exUid: string, i: number, failed = false) {
    primeAudio();
    const ex = latest.current.exercises.find((e) => e.uid === exUid)!;
    const set = ex.sets[i];
    if (set.done && !failed) {
      patchSet(exUid, i, { done: false, failed: false });
      return;
    }
    vibrate(failed ? [80, 60, 80] : 30);
    const patch: Partial<SetLog> = { done: true, failed, kg: set.kg ?? set.target?.kg ?? null, reps: set.reps ?? set.target?.repsMin ?? null };
    const exs = latest.current.exercises.map((e) => (e.uid === exUid ? { ...e, sets: e.sets.map((x, j) => (j === i ? { ...x, ...patch } : x)) } : e));
    save({ ...latest.current, exercises: exs });
    afterDone(exs, exUid, i);
  }

  function addSet(exUid: string, type?: SetType) {
    setExercises((exs) => exs.map((e) => {
      if (e.uid !== exUid) return e;
      const lastWork = [...e.sets].reverse().find(isWork) ?? e.sets[e.sets.length - 1];
      const base: SetLog = lastWork
        ? { ...lastWork, done: false, failed: false, type: type ?? (lastWork.type === 'C' ? 'E' : lastWork.type) }
        : { type: type ?? 'E', kg: null, reps: 10, rir: 2, done: false, target: { kg: null, repsMin: 8, repsMax: 12, rir: 2 } };
      if (type === 'C') return { ...e, sets: [{ ...base, kg: base.kg ? Math.round(base.kg * 0.6 / 2.5) * 2.5 : null, rir: null }, ...e.sets] };
      if (type === 'D' && base.kg) base.kg = Math.round(base.kg * 0.75 / 2.5) * 2.5;
      return { ...e, sets: [...e.sets, base] };
    }));
  }

  function addExercise(exId: string, replace?: string) {
    const old = replace ? latest.current.exercises.find((e) => e.uid === replace) : undefined;
    const plan = {
      uid: uid(), exId, rest: old?.rest ?? 90, group: old?.group ?? null,
      sets: old ? old.sets.map((x) => ({ type: x.type, repsMin: x.target?.repsMin ?? 8, repsMax: x.target?.repsMax ?? 12, rir: x.target?.rir ?? x.rir })) : Array.from({ length: 3 }, () => ({ type: 'E' as const, repsMin: 8, repsMax: 12, rir: 2 })),
    };
    const built = buildSessionExercise(cat, sessions, plan, null);
    const ex: SessionExercise = { ...built, replacedFrom: old ? old.replacedFrom ?? old.exId : undefined };
    if (old) {
      const before = latest.current.exercises;
      setExercises((exs) => exs.map((e) => (e.uid === replace ? ex : e)));
      toast(`Cambiado por ${cat.exById.get(exId)?.n ?? 'otro ejercicio'}`, 'Deshacer', () => save({ ...latest.current, exercises: before }));
    } else {
      setExercises((exs) => [...exs, ex]);
    }
    setOpen(ex.uid);
    setPicker(null);
    setTimeout(() => scrollTo(ex.uid), 50);
  }

  function removeExercise(exUid: string) {
    const before = latest.current.exercises;
    setExercises((exs) => exs.filter((e) => e.uid !== exUid));
    setMenu(null);
    toast('Ejercicio quitado', 'Deshacer', () => save({ ...latest.current, exercises: before }));
  }

  function move(exUid: string, d: -1 | 1) {
    setExercises((exs) => {
      const i = exs.findIndex((e) => e.uid === exUid);
      const j = i + d;
      if (j < 0 || j >= exs.length) return exs;
      const out = [...exs];
      [out[i], out[j]] = [out[j], out[i]];
      return out;
    });
  }

  const doneSets = s.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done && isWork(x)).length, 0);
  const totalSets = s.exercises.reduce((a, e) => a + e.sets.filter(isWork).length, 0);
  const editing = edit ? s.exercises.find((e) => e.uid === edit.ex) : undefined;
  const menuEx = menu ? s.exercises.find((e) => e.uid === menu) : undefined;

  return (
    <div className="page session">
      <div className="row between" style={{ marginBottom: 10 }}>
        <button className="icon-btn" onClick={() => { flush(); nav('/entrenar'); }} aria-label="Minimizar"><Icon name="chev-d" /></button>
        <div className="grow" style={{ textAlign: 'center' }}>
          <b className="truncate" style={{ display: 'block' }}>{s.day_name}</b>
          <div className="xs muted"><Elapsed start={s.started_at} />{s.week ? ` · semana ${s.week}` : ''}</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setFinish(true)}>Terminar</button>
      </div>
      <div className="progress-steps" style={{ marginBottom: 14 }}><i style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }} /></div>

      {s.exercises.length === 0 && <div className="empty" style={{ marginBottom: 12 }}>Entrenamiento libre: agrega tu primer ejercicio.</div>}

      {s.exercises.map((e) => {
        const cex = cat.exById.get(e.exId);
        const last = lastPerformance(sessions, e.exId, s.id);
        const isOpen = open === e.uid;
        const complete = exDone(e);
        const nDone = e.sets.filter((x) => x.done).length;
        const lastWork = last?.sets.filter((x) => x.done && isWork(x)) ?? [];
        const lastWarm = last?.sets.filter((x) => x.done && !isWork(x)) ?? [];
        let wi = 0, ci = 0;
        return (
          <div key={e.uid} id={`ex-${e.uid}`} className={`ex${isOpen ? ' active' : ''}${complete && !isOpen ? ' complete' : ''}`}>
            <div className="ex-h">
              <button className="row grow" style={{ textAlign: 'left', minWidth: 0 }} onClick={() => setOpen(isOpen ? null : e.uid)}>
                {complete && !isOpen ? <div className="thumb"><Icon name="check" /></div> : <Thumb ex={cex} />}
                <div className="grow">
                  <div className="truncate">{labels.has(e.uid) && <span className="tag-ss">{labels.get(e.uid)}</span>}<b>{cex?.n ?? 'Ejercicio'}</b></div>
                  <div className="xs muted truncate">{nDone}/{e.sets.length} series · {last ? `Última: ${describeSets(last.sets)}` : 'Primera vez'}</div>
                </div>
              </button>
              <button className="icon-btn" onClick={() => setMenu(e.uid)} aria-label="Opciones del ejercicio"><Icon name="more" /></button>
            </div>
            {isOpen && (
              <>
                {e.note && <div className="sug"><Icon name="zap" size={16} /><span>{e.note}</span></div>}
                {e.memo && <div className="hint" style={{ marginTop: 8 }}><Icon name="note" size={16} /><span>{e.memo}</span></div>}
                <div className="sets">
                  <div className="set head"><span>Serie</span><span>Anterior</span><span>kg</span><span>Reps</span><span>RIR</span><span>✓</span></div>
                  {e.sets.map((x, i) => {
                    const prev = isWork(x) ? lastWork[wi++] : lastWarm[ci++];
                    const label = x.type === 'C' ? 'C' : x.type === 'D' ? 'D' : x.type === 'RP' ? 'RP' : String(e.sets.slice(0, i + 1).filter((y) => y.type === 'E').length);
                    const bw = cex?.e === 'corporal';
                    return (
                      <div key={i} className={`set${x.done ? ' done' : ''}${x.failed ? ' fail' : ''}`}>
                        <span className={`n${x.type === 'C' ? ' w' : x.type !== 'E' ? ' d' : ''}`}>{label}</span>
                        <span className="prev">{prev ? `${prev.kg ? fmtKg(prev.kg) : bw ? 'PC' : '–'}×${prev.reps ?? '–'}` : '–'}</span>
                        <button className={`cell${x.kg == null ? ' empty' : ''}`} onClick={() => setEdit({ ex: e.uid, i })}>{x.kg != null && x.kg !== 0 ? fmtKg(x.kg) : bw ? 'PC' : '–'}</button>
                        <button className={`cell${x.reps == null ? ' empty' : ''}`} onClick={() => setEdit({ ex: e.uid, i })}>{x.reps ?? '–'}</button>
                        <button className="cell sm" onClick={() => setEdit({ ex: e.uid, i })}>{x.rir ?? '–'}</button>
                        <CheckButton done={x.done} failed={!!x.failed} onTap={() => toggleDone(e.uid, i)} onLong={() => toggleDone(e.uid, i, true)} />
                      </div>
                    );
                  })}
                </div>
                <div className="tools">
                  <button className="btn btn-soft btn-sm" onClick={() => addSet(e.uid)}><Icon name="plus" size={16} />Serie</button>
                  {cex && ['barra', 'smith', 'ez'].includes(cex.e) && (
                    <button className="btn btn-soft btn-sm" onClick={() => setPlates(e.sets.find((x) => !x.done && isWork(x))?.kg ?? e.sets.find(isWork)?.kg ?? null)}><Icon name="calc" size={16} />Discos</button>
                  )}
                  <button className="btn btn-soft btn-sm" onClick={() => setTech(e.exId)}><Icon name="book" size={16} />Técnica</button>
                  <button className="btn btn-soft btn-sm" onClick={() => setPicker({ replace: e.uid })}><Icon name="repeat" size={16} />Cambiar</button>
                </div>
                <p className="xs faint" style={{ marginTop: 10 }}>Toca ✓ si la hiciste como dice. Mantén presionado ✓ si fallaste. {e.rest ? `Descanso ${fmtRest(e.rest)}.` : 'Sin descanso: pasa al siguiente.'}</p>
              </>
            )}
          </div>
        );
      })}

      <button className="btn btn-soft" style={{ marginTop: 4 }} onClick={() => setPicker({})}><Icon name="plus" size={18} />Agregar ejercicio</button>

      {rest && <RestBar rest={rest} onChange={(r) => { writeRest(r); setRest(r); }} />}

      {editing && edit && (
        <SetEditor
          key={`${edit.ex}-${edit.i}`}
          ex={editing} index={edit.i} step={KG_STEP[cat.exById.get(editing.exId)?.e ?? ''] ?? 2.5}
          onClose={() => setEdit(null)}
          onSave={(patch, markDone) => {
            const exs = latest.current.exercises.map((e) => {
              if (e.uid !== editing.uid) return e;
              const sets = e.sets.map((x, j) => {
                if (j === edit.i) return { ...x, ...patch };
                // Un cambio de peso se copia a las series siguientes del mismo tipo que aún no se hacen.
                if (j > edit.i && !x.done && patch.kg !== undefined && patch.kg !== e.sets[edit.i].kg && isWork(x) === isWork(e.sets[edit.i]) && x.type !== 'D') return { ...x, kg: patch.kg };
                return x;
              });
              return { ...e, sets };
            });
            save({ ...latest.current, exercises: exs });
            setEdit(null);
            if (markDone && !editing.sets[edit.i].done) { primeAudio(); vibrate(30); afterDone(exs, editing.uid, edit.i); }
          }}
          onDelete={() => {
            const before = latest.current.exercises;
            setExercises((exs) => exs.map((e) => (e.uid === editing.uid ? { ...e, sets: e.sets.filter((_, j) => j !== edit.i) } : e)));
            setEdit(null);
            toast('Serie eliminada', 'Deshacer', () => save({ ...latest.current, exercises: before }));
          }}
        />
      )}

      <Sheet open={!!menuEx} onClose={() => setMenu(null)} title={menuEx ? cat.exById.get(menuEx.exId)?.n : ''}>
        {menuEx && (
          <>
            <div className="field"><span>Descanso entre series</span>
              <Seg options={[60, 90, 120, 180, 240].map((v) => ({ value: v, label: fmtRest(v) }))} value={menuEx.rest} onChange={(v) => setExercises((exs) => exs.map((e) => (e.uid === menuEx.uid ? { ...e, rest: v } : e)))} />
            </div>
            <div className="list">
              <button className="li" onClick={() => { addSet(menuEx.uid, 'C'); setMenu(null); }}><span className="ico"><Icon name="flame" /></span><span className="grow">Agregar serie de calentamiento</span></button>
              <button className="li" onClick={() => { addSet(menuEx.uid, 'D'); setMenu(null); }}><span className="ico"><Icon name="chev-d" /></span><span className="grow">Agregar drop set<div className="xs muted">Bajas el peso ~25 % y sigues sin descanso</div></span></button>
              <button className="li" onClick={() => { addSet(menuEx.uid, 'RP'); setMenu(null); }}><span className="ico"><Icon name="clock" /></span><span className="grow">Agregar rest-pause<div className="xs muted">Mismo peso tras 20 s de pausa</div></span></button>
              <button className="li" onClick={() => { setPlates(menuEx.sets.find(isWork)?.kg ?? null); setMenu(null); }}><span className="ico"><Icon name="calc" /></span><span className="grow">Calculadora de discos</span></button>
              <button className="li" onClick={() => { setMemo(menuEx.uid); setMenu(null); }}><span className="ico"><Icon name="note" /></span><span className="grow">{menuEx.memo ? 'Editar nota' : 'Agregar nota'}</span></button>
              <button className="li" onClick={() => { setPicker({ replace: menuEx.uid }); setMenu(null); }}><span className="ico"><Icon name="repeat" /></span><span className="grow">Cambiar por otro ejercicio</span></button>
              <button className="li" onClick={() => move(menuEx.uid, -1)}><span className="ico"><Icon name="chev-u" /></span><span className="grow">Subir</span></button>
              <button className="li" onClick={() => move(menuEx.uid, 1)}><span className="ico"><Icon name="chev-d" /></span><span className="grow">Bajar</span></button>
              <button className="li" onClick={() => removeExercise(menuEx.uid)}><span className="ico" style={{ color: 'var(--danger)' }}><Icon name="trash" /></span><span className="grow danger">Quitar de esta sesión</span></button>
            </div>
          </>
        )}
      </Sheet>

      {memo && <MemoSheet initial={s.exercises.find((e) => e.uid === memo)?.memo ?? ''} onClose={() => setMemo(null)} onSave={(t) => { setExercises((exs) => exs.map((e) => (e.uid === memo ? { ...e, memo: t || undefined } : e))); setMemo(null); }} />}

      <ExercisePicker
        open={!!picker} onClose={() => setPicker(null)}
        title={picker?.replace ? 'Cambiar ejercicio' : 'Agregar ejercicio'}
        similarTo={picker?.replace ? s.exercises.find((e) => e.uid === picker.replace)?.exId : null}
        onPick={(exId) => addExercise(exId, picker?.replace)}
      />

      {plates !== undefined && <PlatesSheet open onClose={() => setPlates(undefined)} kg={plates} />}

      <Sheet open={!!tech} onClose={() => setTech(null)} title={tech ? cat.exById.get(tech)?.n : ''}>
        {tech && cat.exById.get(tech) && <TechniqueContent ex={cat.exById.get(tech)!} />}
      </Sheet>

      {finish && (
        <FinishSheet
          session={s} doneSets={doneSets} totalSets={totalSets}
          onClose={() => setFinish(false)}
          onFinish={async (notes) => {
            flush();
            const cur = { ...latest.current, notes: notes || null };
            const { volume, sets } = sessionVolume(cur.exercises);
            const prs = detectPRs(cur, sessions);
            await put('workout_sessions', { ...cur, status: 'terminada', ended_at: new Date().toISOString(), volume_kg: volume, sets_done: sets, prs });
            writeRest(null);
            nav(`/entrenar/resumen/${cur.id}?nuevo=1`, { replace: true });
          }}
          onDiscard={async () => {
            if (timer.current) clearTimeout(timer.current);
            timer.current = null;
            await put('workout_sessions', { ...latest.current, status: 'descartada' });
            await remove('workout_sessions', latest.current.id);
            writeRest(null);
            toast('Sesión descartada');
            nav('/entrenar', { replace: true });
          }}
        />
      )}
    </div>
  );
}

function scrollTo(exUid: string) {
  setTimeout(() => document.getElementById(`ex-${exUid}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
}

const fmtRest = (sec: number) => (sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : `${sec} s`);

function Elapsed({ start }: { start: string }) {
  const [, t] = useState(0);
  useEffect(() => { const iv = setInterval(() => t((x) => x + 1), 1000); return () => clearInterval(iv); }, []);
  const sec = Math.max(0, Math.floor((Date.now() - new Date(start).getTime()) / 1000));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), ss = sec % 60;
  return <span className="num" style={{ fontSize: 14 }}>{h ? `${h}:${String(m).padStart(2, '0')}` : m}:{String(ss).padStart(2, '0')}</span>;
}

function CheckButton({ done, failed, onTap, onLong }: { done: boolean; failed: boolean; onTap: () => void; onLong: () => void }) {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const clear = () => { if (t.current) clearTimeout(t.current); t.current = null; };
  return (
    <button
      className="chk" aria-label={done ? (failed ? 'Serie fallida' : 'Serie hecha') : 'Marcar serie'}
      onPointerDown={() => { fired.current = false; clear(); t.current = setTimeout(() => { fired.current = true; onLong(); }, 550); }}
      onPointerUp={clear} onPointerLeave={clear} onPointerCancel={clear}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => { if (fired.current) { fired.current = false; return; } onTap(); }}
    >
      <Icon name={failed ? 'x' : 'check'} size={22} />
    </button>
  );
}

function RestBar({ rest, onChange }: { rest: Rest; onChange: (r: Rest | null) => void }) {
  const [now, setNow] = useState(Date.now());
  const rang = useRef(false);
  useEffect(() => { rang.current = rest.end <= Date.now(); const iv = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(iv); }, [rest]);
  const left = Math.ceil((rest.end - now) / 1000);
  const fin = left <= 0;
  useEffect(() => {
    if (fin && !rang.current) { rang.current = true; vibrate([200, 100, 200]); beep(2); }
    if (fin) { const t = setTimeout(() => onChange(null), 6000); return () => clearTimeout(t); }
  }, [fin, onChange]);
  const shift = (d: number) => onChange({ ...rest, end: Math.max(Date.now(), rest.end + d * 1000), total: Math.max(1, rest.total + d) });
  return (
    <div className={`rest${fin ? ' fin' : ''}`} role="timer" aria-live="polite">
      <div className="prog" style={{ width: `${Math.max(0, Math.min(100, (left / rest.total) * 100))}%` }} />
      <div className="row between">
        <div>
          <div className="xs" style={{ opacity: 0.8, fontWeight: 600 }}>{fin ? '¡A la siguiente serie!' : 'Descanso'}</div>
          <div className="time">{fin ? '0:00' : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}</div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {!fin && <button className="rb" onClick={() => shift(-15)}>−15</button>}
          {!fin && <button className="rb" onClick={() => shift(15)}>+15</button>}
          <button className="rb" onClick={() => onChange(null)}>{fin ? 'Ok' : 'Saltar'}</button>
        </div>
      </div>
    </div>
  );
}

function SetEditor({ ex, index, step, onClose, onSave, onDelete }: {
  ex: SessionExercise; index: number; step: number; onClose: () => void; onSave: (p: Partial<SetLog>, markDone: boolean) => void; onDelete: () => void;
}) {
  const set = ex.sets[index];
  const [kg, setKg] = useState(set.kg ?? set.target?.kg ?? 0);
  const [reps, setReps] = useState(set.reps ?? set.target?.repsMin ?? 8);
  const [rir, setRir] = useState<number | null>(set.rir);
  const [type, setType] = useState<SetType>(set.type);
  const [failed, setFailed] = useState(!!set.failed);
  const t = set.target;
  const title = set.type === 'C' ? 'Serie de calentamiento' : set.type === 'D' ? 'Drop set' : set.type === 'RP' ? 'Rest-pause' : `Serie ${ex.sets.slice(0, index + 1).filter((x) => x.type === 'E').length}`;
  return (
    <Sheet open onClose={onClose} title={title}>
      {t && <p className="small muted" style={{ marginTop: -6 }}>Objetivo: {t.kg ? `${fmtKg(t.kg)} kg · ` : ''}{t.repsMin === t.repsMax ? t.repsMin : `${t.repsMin}–${t.repsMax}`} reps{t.rir != null ? ` · RIR ${t.rir}` : ''}</p>}
      <div className="xs muted" style={{ marginTop: 8 }}>Peso</div>
      <Stepper value={kg} onChange={setKg} step={step} bigStep={step >= 2.5 ? 10 : 5} min={0} max={600} decimals={2} unit="kg" />
      <div className="xs muted">Repeticiones</div>
      <Stepper value={reps} onChange={setReps} step={1} min={0} max={100} unit="reps" />
      <div className="field"><span>RIR: repeticiones que te quedaban en reserva</span>
        <Seg options={[0, 1, 2, 3, 4, 5].map((v) => ({ value: v, label: v === 5 ? '5+' : String(v) }))} value={rir ?? -1} onChange={(v) => setRir(v)} />
      </div>
      <div className="field"><span>Tipo de serie</span>
        <Seg options={[{ value: 'C' as SetType, label: 'Calent.' }, { value: 'E' as SetType, label: 'Efectiva' }, { value: 'D' as SetType, label: 'Drop' }, { value: 'RP' as SetType, label: 'R-pause' }]} value={type} onChange={setType} />
      </div>
      <button type="button" className={`opt${failed ? ' on' : ''}`} onClick={() => setFailed(!failed)}>
        <div className="grow"><b>Serie fallida</b><div className="xs muted">No llegaste a las repeticiones: la próxima vez se mantiene el peso</div></div>
        <div className="radio" />
      </button>
      <div className="row" style={{ marginTop: 6 }}>
        <button className="btn btn-danger" style={{ width: 64, flex: 'none' }} onClick={onDelete} aria-label="Eliminar serie"><Icon name="trash" /></button>
        <button className="btn btn-soft grow" onClick={() => onSave({ kg, reps, rir, type, failed }, false)}>Guardar</button>
        {!set.done && <button className="btn btn-primary grow" onClick={() => onSave({ kg, reps, rir, type, failed, done: true }, true)}><Icon name="check" size={18} />Hecha</button>}
      </div>
    </Sheet>
  );
}

function MemoSheet({ initial, onClose, onSave }: { initial: string; onClose: () => void; onSave: (t: string) => void }) {
  const [t, setT] = useState(initial);
  return (
    <Sheet open onClose={onClose} title="Nota del ejercicio">
      <textarea className="input" autoFocus value={t} onChange={(e) => setT(e.target.value)} placeholder="Ej.: asiento en 4, agarre cerrado" />
      <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => onSave(t.trim())}>Guardar nota</button>
    </Sheet>
  );
}

function FinishSheet({ session, doneSets, totalSets, onClose, onFinish, onDiscard }: {
  session: WorkoutSession; doneSets: number; totalSets: number; onClose: () => void; onFinish: (notes: string) => Promise<void>; onDiscard: () => Promise<void>;
}) {
  const [notes, setNotes] = useState(session.notes ?? '');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = totalSets - doneSets;
  return (
    <Sheet open onClose={onClose} title="¿Terminar entrenamiento?">
      <div className="grid2">
        <div className="stat"><div className="xs muted">Series hechas</div><div className="num">{doneSets}<span className="small muted"> / {totalSets}</span></div></div>
        <div className="stat"><div className="xs muted">Volumen</div><div className="num">{fmt(sessionVolume(session.exercises).volume)}<span className="small muted"> kg</span></div></div>
      </div>
      {pending > 0 && doneSets > 0 && <div className="hint" style={{ marginBottom: 12 }}><Icon name="info" size={18} /><span>Quedan {pending} series sin marcar: no cuentan para tu progreso.</span></div>}
      {doneSets === 0 && <div className="hint warn" style={{ marginBottom: 12 }}><Icon name="info" size={18} /><span>No marcaste ninguna serie. Si no entrenaste, mejor descarta la sesión.</span></div>}
      <label className="field"><span>¿Cómo te sentiste? (opcional)</span>
        <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Energía, sueño, molestias…" />
      </label>
      <button className="btn btn-primary" disabled={busy || doneSets === 0} onClick={async () => { setBusy(true); await onFinish(notes.trim()); }}>Terminar y guardar</button>
      <button className="btn btn-danger" style={{ marginTop: 10 }} disabled={busy} onClick={async () => { if (!confirmDiscard) { setConfirmDiscard(true); return; } setBusy(true); await onDiscard(); }}>
        {confirmDiscard ? 'Toca de nuevo para descartar' : 'Descartar sesión'}
      </button>
      <button className="btn btn-soft" style={{ marginTop: 10 }} onClick={onClose}>Seguir entrenando</button>
    </Sheet>
  );
}
