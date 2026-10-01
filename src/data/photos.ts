// Fotos de progreso: se achican y se guardan primero en el teléfono; después se suben a un bucket
// privado de Supabase (carpeta del usuario). Al volver a codificar la imagen se eliminan los metadatos
// EXIF (ubicación GPS, modelo del teléfono).
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { getDb, getUid, put, remove } from './store';
import type { Pose, ProgressPhoto } from './types';
import { uid } from '../core/templates';

export const BUCKET = 'progress-photos';
const MAX_SIDE = 1280;

async function decode(file: Blob): Promise<{ source: CanvasImageSource; w: number; h: number; done: () => void }> {
  if ('createImageBitmap' in window) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bmp, w: bmp.width, h: bmp.height, done: () => bmp.close() };
    } catch { /* algunos navegadores no aceptan opciones: se usa <img> */ }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  return { source: img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
}

/** Achica a 1280 px por lado y guarda como JPEG (sin EXIF). */
export async function compressPhoto(file: Blob): Promise<{ blob: Blob; width: number; height: number }> {
  const img = await decode(file);
  const k = Math.min(1, MAX_SIDE / Math.max(img.w, img.h));
  const width = Math.round(img.w * k);
  const height = Math.round(img.h * k);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(img.source, 0, 0, width, height);
  img.done();
  const blob = await new Promise<Blob>((ok, bad) => canvas.toBlob((b) => (b ? ok(b) : bad(new Error('No se pudo procesar la foto'))), 'image/jpeg', 0.82));
  return { blob, width, height };
}

export async function addPhoto(date: string, pose: Pose, file: Blob): Promise<ProgressPhoto> {
  const { blob, width, height } = await compressPhoto(file);
  const id = uid();
  const path = `${getUid()}/${id}.jpg`;
  await getDb().blobs.put({ id, path, blob, state: supabase ? 'subir' : 'ok' });
  return put('progress_photos', { id, date, pose, path, width, height });
}

export async function deletePhoto(p: ProgressPhoto) {
  // Sin nube (modo local) basta con borrar el archivo del teléfono.
  if (supabase) await getDb().blobs.put({ id: p.id, path: p.path, state: 'borrar' });
  else await getDb().blobs.delete(p.id);
  forget(p.id);
  await remove('progress_photos', p.id);
}

/** Sube las fotos pendientes y borra de la nube las eliminadas. Lo llama la sincronización. */
export async function syncPhotos(): Promise<void> {
  if (!supabase) return;
  const db = getDb();
  const queue = await db.blobs.where('state').anyOf('subir', 'borrar').toArray();
  for (const b of queue) {
    if (b.state === 'borrar') {
      const { error } = await supabase.storage.from(BUCKET).remove([b.path]);
      if (error) throw new Error(`fotos: ${error.message}`);
      await db.blobs.delete(b.id);
      continue;
    }
    const row = await db.progress_photos.get(b.id);
    if (!row || row.deleted_at || !b.blob) { await db.blobs.delete(b.id); continue; }
    const { error } = await supabase.storage.from(BUCKET).upload(b.path, b.blob, { contentType: 'image/jpeg', upsert: true });
    if (error) throw new Error(`fotos: ${error.message}`);
    await db.blobs.update(b.id, { state: 'ok' });
  }
}

/** Borra todas las fotos del usuario en la nube (antes de eliminar la cuenta). */
export async function purgeCloudPhotos(userId: string) {
  if (!supabase) return;
  for (;;) {
    const { data, error } = await supabase.storage.from(BUCKET).list(userId, { limit: 100 });
    if (error) throw error;
    if (!data?.length) return;
    const { error: e2 } = await supabase.storage.from(BUCKET).remove(data.map((f) => `${userId}/${f.name}`));
    if (e2) throw e2;
    if (data.length < 100) return;
  }
}

// URLs locales (blob:) ya creadas, para no repetir trabajo al volver a una pantalla.
const urls = new Map<string, string>();
function forget(id: string) {
  const u = urls.get(id);
  if (u) URL.revokeObjectURL(u);
  urls.delete(id);
}

async function resolveUrl(p: ProgressPhoto): Promise<string | null> {
  const cached = urls.get(p.id);
  if (cached) return cached;
  const db = getDb();
  let blob = (await db.blobs.get(p.id))?.blob;
  if (!blob && supabase) {
    // Otra persona no puede llegar aquí: el bucket es privado y la ruta empieza con el id del usuario.
    const { data, error } = await supabase.storage.from(BUCKET).download(p.path);
    if (error || !data) return null;
    blob = data;
    await db.blobs.put({ id: p.id, path: p.path, blob, state: 'ok' });
  }
  if (!blob) return null;
  const u = URL.createObjectURL(blob);
  urls.set(p.id, u);
  return u;
}

/** URL para mostrar una foto: del teléfono si está, si no se descarga (y queda guardada). */
export function usePhotoUrl(p: ProgressPhoto | null | undefined): { url: string | null; failed: boolean } {
  const [state, setState] = useState<{ id: string | null; url: string | null; failed: boolean }>({ id: null, url: null, failed: false });
  useEffect(() => {
    if (!p) return;
    let alive = true;
    resolveUrl(p).then((url) => { if (alive) setState({ id: p.id, url, failed: !url }); }).catch(() => { if (alive) setState({ id: p.id, url: null, failed: true }); });
    return () => { alive = false; };
  }, [p]);
  return state.id === p?.id ? { url: state.url, failed: state.failed } : { url: null, failed: false };
}
