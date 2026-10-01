// Escritura local primero: cada cambio se guarda en IndexedDB y se anota en la cola (outbox)
// para subirlo a Supabase cuando haya señal.
import { ForusDB } from './db';
import type { TableMap, TableName } from './types';

let current: { db: ForusDB; uid: string } | null = null;
let onWrite: (() => void) | null = null;

export function openStore(uid: string): ForusDB {
  if (current?.uid === uid) return current.db;
  current?.db.close();
  const db = new ForusDB(`forus-${uid}`);
  current = { db, uid };
  return db;
}

export function closeStore() {
  current?.db.close();
  current = null;
}

export function getDb(): ForusDB {
  if (!current) throw new Error('Store no inicializado');
  return current.db;
}

export function getUid(): string {
  if (!current) throw new Error('Store no inicializado');
  return current.uid;
}

export function setWriteListener(fn: (() => void) | null) {
  onWrite = fn;
}

export const nowISO = () => new Date().toISOString();

type Input<T extends TableName> = Omit<TableMap[T], 'user_id' | 'updated_at' | 'deleted_at'> & Partial<Pick<TableMap[T], 'deleted_at'>>;

export async function put<T extends TableName>(table: T, row: Input<T>): Promise<TableMap[T]> {
  const db = getDb();
  const full = { ...row, user_id: getUid(), updated_at: nowISO(), deleted_at: row.deleted_at ?? null } as TableMap[T];
  await db.transaction('rw', db.table(table), db.outbox, async () => {
    await db.table(table).put(full);
    await db.outbox.add({ table, id: full.id });
  });
  onWrite?.();
  return full;
}

export async function putMany<T extends TableName>(table: T, rows: Input<T>[]): Promise<void> {
  if (!rows.length) return;
  const db = getDb();
  const stamp = nowISO();
  const full = rows.map((r) => ({ ...r, user_id: getUid(), updated_at: stamp, deleted_at: r.deleted_at ?? null })) as TableMap[T][];
  await db.transaction('rw', db.table(table), db.outbox, async () => {
    await db.table(table).bulkPut(full);
    await db.outbox.bulkAdd(full.map((r) => ({ table, id: r.id })));
  });
  onWrite?.();
}

/** Borrado lógico (deleted_at): así un borrado sin señal no "revive" al sincronizar. */
export async function remove<T extends TableName>(table: T, id: string): Promise<void> {
  const row = (await getDb().table(table).get(id)) as TableMap[T] | undefined;
  if (!row) return;
  await put(table, { ...row, deleted_at: nowISO() } as Input<T>);
}

export async function update<T extends TableName>(table: T, id: string, patch: Partial<TableMap[T]>): Promise<TableMap[T] | undefined> {
  const row = (await getDb().table(table).get(id)) as TableMap[T] | undefined;
  if (!row) return undefined;
  return put(table, { ...row, ...patch } as Input<T>);
}

export const alive = <T extends { deleted_at: string | null }>(r: T | undefined | null): r is T => !!r && !r.deleted_at;
