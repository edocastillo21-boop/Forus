// Contexto de la sesión abierta: perfil, catálogo y cuenta. Solo existe dentro de la app ya configurada.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Catalog } from './catalog';
import type { Profile } from './types';
import { todayISO } from '../core/dates';

export interface AppCtx { profile: Profile; cat: Catalog; uid: string; email: string | null; signOut: () => Promise<void> }

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ value, children }: { value: AppCtx; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp fuera de AppProvider');
  return v;
}

/** Fecha de hoy que cambia sola a medianoche o al volver a la app. */
export function useToday(): string {
  const [d, setD] = useState(todayISO);
  useEffect(() => {
    const tick = () => setD((prev) => { const t = todayISO(); return t === prev ? prev : t; });
    const iv = setInterval(tick, 60000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', tick); };
  }, []);
  return d;
}
