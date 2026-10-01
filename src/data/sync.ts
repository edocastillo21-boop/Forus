// Sincronización con Supabase: sube la cola local (push) y baja lo nuevo del servidor (pull).
// Conflictos: gana la última escritura; un registro con cambios pendientes nunca se pisa con datos del servidor.
import { useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import { getDb, setWriteListener } from './store';
import { TABLES } from './types';
import { syncPhotos } from './photos';

export type SyncState = 'local' | 'idle' | 'syncing' | 'offline' | 'error';
let state: SyncState = supabase ? 'idle' : 'local';
let pending = 0;
let lastError: string | null = null;
const listeners = new Set<() => void>();
let version = 0;
const emit = () => { version++; listeners.forEach((l) => l()); };
const set = (s: SyncState) => { state = s; emit(); };

let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let again = false;
let retryMs = 5000;
let active = false;

export function scheduleSync(delay = 700) {
  if (!supabase || !active) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delay);
}

async function refreshPending() {
  try {
    const db = getDb();
    pending = (await db.outbox.count()) + (await db.blobs.where('state').anyOf('subir', 'borrar').count());
  } catch { pending = 0; }
  emit();
}

async function push() {
  const db = getDb();
  const entries = await db.outbox.orderBy('seq').toArray();
  if (!entries.length) return;
  const maxSeq = entries[entries.length - 1].seq!;
  const byTable = new Map<string, Set<string>>();
  for (const e of entries) {
    if (!byTable.has(e.table)) byTable.set(e.table, new Set());
    byTable.get(e.table)!.add(e.id);
  }
  for (const [table, ids] of byTable) {
    const rows = (await db.table(table).bulkGet([...ids])).filter(Boolean);
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await supabase!.from(table).upsert(rows.slice(i, i + 200), { onConflict: 'id' });
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  }
  await db.outbox.where('seq').belowOrEqual(maxSeq).delete();
}

async function pull() {
  const db = getDb();
  for (const table of TABLES) {
    const key = `cursor:${table}`;
    let cursor = ((await db.meta.get(key))?.value as string | undefined) ?? '1970-01-01T00:00:00Z';
    for (;;) {
      const { data, error } = await supabase!.from(table).select('*').gt('updated_at', cursor).order('updated_at').limit(500);
      if (error) throw new Error(`${table}: ${error.message}`);
      if (!data?.length) break;
      const pendingIds = new Set((await db.outbox.where('table').equals(table).toArray()).map((e) => e.id));
      const fresh = data.filter((r: { id: string }) => !pendingIds.has(r.id));
      if (fresh.length) await db.table(table).bulkPut(fresh);
      cursor = data[data.length - 1].updated_at;
      await db.meta.put({ key, value: cursor });
      if (data.length < 500) break;
    }
  }
  if (!(await db.meta.get('pulled'))) await db.meta.put({ key: 'pulled', value: new Date().toISOString() });
}

export async function syncNow(): Promise<void> {
  if (!supabase || !active) return;
  if (running) { again = true; return; }
  if (!navigator.onLine) { set('offline'); await refreshPending(); return; }
  running = true;
  set('syncing');
  try {
    await push();
    await pull();
    await syncPhotos();
    lastError = null;
    retryMs = 5000;
    set('idle');
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
    console.warn('[sync]', lastError);
    set(navigator.onLine ? 'error' : 'offline');
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void syncNow(), retryMs);
    retryMs = Math.min(retryMs * 2, 120000);
  } finally {
    running = false;
    await refreshPending();
    if (again) { again = false; scheduleSync(300); }
  }
}

let started = false;
export function startSync() {
  active = true;
  setWriteListener(() => { void refreshPending(); scheduleSync(); });
  void refreshPending();
  if (!supabase || started) { if (supabase) scheduleSync(0); return; }
  started = true;
  window.addEventListener('online', () => scheduleSync(0));
  window.addEventListener('offline', () => set('offline'));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') scheduleSync(0); });
  setInterval(() => { if (document.visibilityState === 'visible') scheduleSync(0); }, 60000);
  scheduleSync(0);
}

/** Al cerrar sesión: deja de sincronizar la base del usuario anterior. */
export function stopSync() {
  active = false;
  if (timer) clearTimeout(timer);
  timer = null;
  setWriteListener(null);
}

export function useSyncState() {
  useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => version);
  return { state, pending, lastError };
}
