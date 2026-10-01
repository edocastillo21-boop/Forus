import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { LOCAL_MODE, supabase } from './data/supabase';
import { getDb, openStore } from './data/store';
import { startSync, stopSync, syncNow, useSyncState } from './data/sync';
import { useCatalog } from './data/catalog';
import { useProfile } from './data/hooks';
import { AppProvider } from './data/app';
import type { Profile } from './data/types';
import { Login, NewPassword } from './features/auth/Login';
import { Onboarding } from './features/onboarding/Onboarding';
import { Home } from './features/home/Home';
import { TrainHome } from './features/train/TrainHome';
import { SessionScreen } from './features/train/Session';
import { Summary } from './features/train/Summary';
import { Routines } from './features/train/Routines';
import { RoutineEditor } from './features/train/RoutineEditor';
import { Library, ExerciseDetail } from './features/train/Library';
import { History } from './features/train/History';
import { Diary } from './features/eat/Diary';
import { AddFood } from './features/eat/AddFood';
import { CustomFoodForm } from './features/eat/CustomFood';
import { Progress } from './features/progress/Progress';
import { ProfileScreen } from './features/profile/Profile';
import { Icon } from './ui/Icon';
import { Logo } from './ui/Logo';
import { Spinner, ToastProvider } from './ui/kit';

type Auth = { uid: string; email: string | null } | null | undefined;

// Errores que Supabase deja en la URL (p. ej. un enlace de confirmación vencido).
const hash = new URLSearchParams(location.hash.slice(1));
const linkError = hash.get('error_description');
if (hash.has('error') || hash.has('error_description')) history.replaceState(null, '', location.pathname + location.search);

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Root />
      </ToastProvider>
    </BrowserRouter>
  );
}

function Root() {
  const [auth, setAuth] = useState<Auth>(LOCAL_MODE ? { uid: 'local', email: null } : undefined);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const apply = (u: { id: string; email?: string } | null | undefined) =>
      setAuth((prev) => (u ? (prev && prev.uid === u.id ? prev : { uid: u.id, email: u.email ?? null }) : null));
    supabase.auth.getSession().then(({ data }) => {
      apply(data.session?.user);
      if (location.hash.includes('access_token')) history.replaceState(null, '', location.pathname + location.search);
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      apply(session?.user);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (auth === undefined) return <Splash />;
  if (recovery) return <NewPassword onDone={() => setRecovery(false)} />;
  if (!auth) return <Login notice={linkError ? 'El enlace venció o ya se usó. Vuelve a pedirlo.' : null} />;
  return <UserApp key={auth.uid} uid={auth.uid} email={auth.email} />;
}

function UserApp({ uid, email }: { uid: string; email: string | null }) {
  useState(() => openStore(uid)); // la base local se abre antes de cualquier consulta
  useEffect(() => { startSync(); return () => stopSync(); }, []);
  const profile = useProfile();
  const cat = useCatalog();
  const pulled = useLiveQuery(async () => LOCAL_MODE || !!(await getDb().meta.get('pulled')), [], undefined);
  const signOut = useCallback(async () => {
    try { await syncNow(); } catch { /* se intenta subir lo pendiente antes de salir */ }
    stopSync();
    await supabase?.auth.signOut();
  }, []);

  if (profile === undefined || pulled === undefined || !cat) return <Splash />;
  if (!profile && !pulled) return <FirstSync />;
  if (!profile?.onboarded_at) return <Onboarding profile={profile} uid={uid} cat={cat} />;
  return (
    <AppProvider value={{ profile, cat, uid, email, signOut }}>
      <Shell profile={profile} />
    </AppProvider>
  );
}

function useTheme(theme: 'dark' | 'light' | undefined) {
  useEffect(() => {
    const light = theme === 'light';
    if (light) document.documentElement.dataset.theme = 'light';
    else delete document.documentElement.dataset.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#F6F6F8' : '#0C0C0F');
    try { localStorage.setItem('forus-theme', light ? 'light' : 'dark'); } catch { /* sin almacenamiento */ }
  }, [theme]);
}

const NO_TABS = /^\/(entrenar\/(sesion|resumen|rutina\/)|comer\/(agregar|nuevo))/;

function Shell({ profile }: { profile: Profile }) {
  const loc = useLocation();
  useTheme(profile.prefs?.theme);
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  const hideTabs = useMemo(() => NO_TABS.test(loc.pathname), [loc.pathname]);
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/entrenar" element={<TrainHome />} />
        <Route path="/entrenar/sesion/:id" element={<SessionScreen />} />
        <Route path="/entrenar/resumen/:id" element={<Summary />} />
        <Route path="/entrenar/rutinas" element={<Routines />} />
        <Route path="/entrenar/rutina/:id" element={<RoutineEditor />} />
        <Route path="/entrenar/ejercicios" element={<Library />} />
        <Route path="/entrenar/ejercicio/:id" element={<ExerciseDetail />} />
        <Route path="/entrenar/historial" element={<History />} />
        <Route path="/comer" element={<Diary />} />
        <Route path="/comer/agregar" element={<AddFood />} />
        <Route path="/comer/nuevo" element={<CustomFoodForm />} />
        <Route path="/progreso" element={<Progress />} />
        <Route path="/perfil" element={<ProfileScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!hideTabs && <TabBar />}
    </div>
  );
}

function TabBar() {
  const tabs: [string, string, string][] = [['/', 'home', 'Inicio'], ['/entrenar', 'dumbbell', 'Entrenar'], ['/comer', 'food', 'Comer'], ['/progreso', 'trend', 'Progreso'], ['/perfil', 'user', 'Perfil']];
  return (
    <nav className="tabbar" aria-label="Navegación principal">
      {tabs.map(([to, icon, label]) => (
        <NavLink key={to} to={to} end={to === '/'}><Icon name={icon} size={24} />{label}</NavLink>
      ))}
    </nav>
  );
}

function Splash() {
  return (
    <div className="center-screen">
      <div><Logo size={64} /><div style={{ marginTop: 18, display: 'grid', placeItems: 'center' }}><Spinner /></div></div>
    </div>
  );
}

function FirstSync() {
  const { state, lastError } = useSyncState();
  const offline = state === 'offline' || !navigator.onLine;
  return (
    <div className="center-screen">
      <div style={{ maxWidth: 320 }}>
        <Logo size={56} />
        {offline || state === 'error' ? (
          <>
            <p className="h2" style={{ marginTop: 16 }}>{offline ? 'Sin conexión' : 'No pudimos cargar tus datos'}</p>
            <p className="muted small" style={{ margin: '8px 0 18px' }}>
              {offline ? 'La primera vez en este dispositivo necesitas internet para descargar tus datos. Después funciona sin señal.' : lastError}
            </p>
            <button className="btn btn-primary" onClick={() => void syncNow()}>Reintentar</button>
          </>
        ) : (
          <>
            <div style={{ margin: '18px 0 10px', display: 'grid', placeItems: 'center' }}><Spinner /></div>
            <p className="muted small">Cargando tus datos…</p>
          </>
        )}
      </div>
    </div>
  );
}
