// Fotos de progreso: frente, perfil y espalda, con comparación lado a lado.
import { useMemo, useRef, useState } from 'react';
import { useToday } from '../../data/app';
import { usePhotos, useWeights } from '../../data/hooks';
import { addPhoto, deletePhoto, usePhotoUrl } from '../../data/photos';
import { fmtKg } from '../../data/logic';
import type { Pose, ProgressPhoto } from '../../data/types';
import { daysBetween, longDate, relativeDay, shortDate } from '../../core/dates';
import { Icon } from '../../ui/Icon';
import { Seg, Sheet, Spinner, useToast } from '../../ui/kit';

const POSES: { value: Pose; label: string }[] = [{ value: 'frente', label: 'Frente' }, { value: 'perfil', label: 'Perfil' }, { value: 'espalda', label: 'Espalda' }];

export function Photos() {
  const today = useToday();
  const toast = useToast();
  const photos = usePhotos();
  const weights = useWeights();
  const [pose, setPose] = useState<Pose>('frente');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<ProgressPhoto | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const dates = useMemo(() => [...new Set(photos.map((p) => p.date))].sort((a, b) => b.localeCompare(a)), [photos]);
  const ofPose = photos.filter((p) => p.pose === pose).sort((a, b) => a.date.localeCompare(b.date));
  const [aId, setAId] = useState<string | null>(null);
  const [bId, setBId] = useState<string | null>(null);
  const a = ofPose.find((p) => p.id === aId) ?? ofPose[0];
  const b = ofPose.find((p) => p.id === bId) ?? ofPose[ofPose.length - 1];
  const weightNear = (date: string) => {
    let best: { d: number; w: number } | null = null;
    for (const w of weights) { const d = Math.abs(daysBetween(w.date, date)); if (d <= 3 && (!best || d < best.d)) best = { d, w: w.weight_kg }; }
    return best?.w ?? null;
  };

  async function onFile(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    try {
      await addPhoto(today, pose, f);
      toast(`Foto de ${pose} guardada`);
      setAId(null);
      setBId(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No pudimos guardar la foto');
    } finally {
      setBusy(false);
      if (file.current) file.current.value = '';
    }
  }

  return (
    <>
      <div style={{ marginBottom: 12 }}><Seg options={POSES} value={pose} onChange={(p) => { setPose(p); setAId(null); setBId(null); }} /></div>

      {ofPose.length >= 2 && a && b && (
        <div className="card">
          <div className="row between" style={{ marginBottom: 8 }}><b>Antes y ahora</b><span className="xs muted">{daysBetween(a.date, b.date)} días</span></div>
          <div className="compare">
            {[a, b].map((p, i) => (
              <div key={i}>
                <PhotoThumb p={p} onClick={() => setView(p)} />
                <select className="input" style={{ height: 40, fontSize: 13, marginTop: 6, padding: '0 8px' }} value={p.id} onChange={(e) => (i ? setBId(e.target.value) : setAId(e.target.value))} aria-label={i ? 'Foto de después' : 'Foto de antes'}>
                  {ofPose.map((x) => <option key={x.id} value={x.id}>{shortDate(x.date)}{weightNear(x.date) ? ` · ${fmtKg(weightNear(x.date))} kg` : ''}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
      <button className="btn btn-primary" disabled={busy} onClick={() => file.current?.click()}>
        {busy ? <Spinner /> : <><Icon name="camera" size={18} />Agregar foto de {pose}</>}
      </button>
      <p className="xs muted" style={{ margin: '8px 0 0', textAlign: 'center' }}>
        Misma luz, misma hora y misma distancia cada 2–4 semanas. Tus fotos son privadas: solo tú las ves y se guardan sin ubicación.
      </p>

      {dates.length > 0 && <div className="eyebrow" style={{ margin: '18px 0 8px' }}>Tus fotos</div>}
      {dates.map((d) => (
        <div key={d} style={{ marginBottom: 14 }}>
          <div className="small muted" style={{ marginBottom: 6 }}>{relativeDay(d, today)}{weightNear(d) ? ` · ${fmtKg(weightNear(d))} kg` : ''}</div>
          <div className="photo-grid">
            {photos.filter((p) => p.date === d).map((p) => <PhotoThumb key={p.id} p={p} label onClick={() => setView(p)} />)}
          </div>
        </div>
      ))}
      {!photos.length && <div className="empty" style={{ marginTop: 14 }}>Una foto de frente, perfil y espalda hoy te va a mostrar cambios que la balanza no ve.</div>}

      <Sheet open={!!view} onClose={() => setView(null)} title={view ? `${POSES.find((x) => x.value === view.pose)?.label} · ${longDate(view.date)}` : ''}>
        {view && <PhotoFull p={view} onDelete={async () => { const p = view; setView(null); await deletePhoto(p); toast('Foto eliminada'); }} />}
      </Sheet>
    </>
  );
}

function PhotoThumb({ p, label, onClick }: { p: ProgressPhoto; label?: boolean; onClick: () => void }) {
  const { url, failed } = usePhotoUrl(p);
  return (
    <button className="photo" onClick={onClick} aria-label={`Foto de ${p.pose} del ${shortDate(p.date)}`}>
      {url ? <img src={url} alt="" loading="lazy" /> : failed ? <Icon name="cloud" /> : <Spinner />}
      {label && <span className="lbl">{p.pose}</span>}
    </button>
  );
}

function PhotoFull({ p, onDelete }: { p: ProgressPhoto; onDelete: () => void }) {
  const { url, failed } = usePhotoUrl(p);
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <div style={{ borderRadius: 16, overflow: 'hidden', background: 'var(--surface-2)', minHeight: 200, display: 'grid', placeItems: 'center', marginBottom: 12 }}>
        {url ? <img src={url} alt="" style={{ width: '100%', display: 'block' }} /> : failed ? <span className="small muted">Aún no se descarga (¿sin señal?).</span> : <Spinner />}
      </div>
      <button className="btn btn-danger" onClick={() => (confirm ? onDelete() : setConfirm(true))}>{confirm ? 'Toca de nuevo para eliminar' : 'Eliminar foto'}</button>
    </>
  );
}
