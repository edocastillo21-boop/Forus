import { useState } from 'react';
import { supabase } from '../../data/supabase';
import { Icon } from '../../ui/Icon';
import { Logo } from '../../ui/Logo';

function translate(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return 'Correo o contraseña incorrectos.';
  if (m.includes('email not confirmed')) return 'Falta confirmar tu correo: revisa el enlace que te enviamos.';
  if (m.includes('database error saving new user') || m.includes('no autorizado')) return 'Este correo no está autorizado para usar Forus.';
  if (m.includes('already registered')) return 'Ese correo ya tiene cuenta: usa "Entrar".';
  if (m.includes('password should be')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (m.includes('rate limit') || m.includes('security purposes')) return 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.';
  if (m.includes('fetch')) return 'No hay conexión con el servidor. Revisa tu internet.';
  return msg;
}

export function Login({ notice }: { notice?: string | null }) {
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(notice ? { ok: false, text: notice } : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
        if (error) throw error;
      } else if (mode === 'up') {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password: pass, options: { emailRedirectTo: location.origin } });
        if (error) throw error;
        setMsg({ ok: true, text: 'Listo. Te enviamos un correo: abre el enlace para confirmar tu cuenta y luego entra.' });
        setMode('in');
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin });
        if (error) throw error;
        setMsg({ ok: true, text: 'Te enviamos un correo con un enlace para crear una contraseña nueva.' });
      }
    } catch (err) {
      setMsg({ ok: false, text: translate(err instanceof Error ? err.message : String(err)) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <div className="page full" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 56px)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Logo size={72} />
          <div className="h1" style={{ marginTop: 14 }}>Forus</div>
          <p className="muted">Entrenamiento y alimentación, conectados.</p>
        </div>
        {mode !== 'reset' && (
          <div className="seg" style={{ marginBottom: 18 }}>
            <button type="button" className={mode === 'in' ? 'on' : ''} onClick={() => { setMode('in'); setMsg(null); }}><b>Entrar</b></button>
            <button type="button" className={mode === 'up' ? 'on' : ''} onClick={() => { setMode('up'); setMsg(null); }}><b>Crear cuenta</b></button>
          </div>
        )}
        <form onSubmit={submit}>
          <label className="field"><span>Correo</span>
            <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {mode !== 'reset' && (
            <label className="field"><span>Contraseña</span>
              <input className="input" type="password" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} required minLength={6} value={pass} onChange={(e) => setPass(e.target.value)} />
            </label>
          )}
          {msg && <div className={`hint${msg.ok ? '' : ' warn'}`} style={{ marginBottom: 14 }}><Icon name={msg.ok ? 'mail' : 'info'} size={18} /><span>{msg.text}</span></div>}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Un momento…' : mode === 'in' ? 'Entrar' : mode === 'up' ? 'Crear cuenta' : 'Enviar enlace'}
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: 18 }}>
          {mode === 'reset'
            ? <button className="link" onClick={() => { setMode('in'); setMsg(null); }}>Volver a entrar</button>
            : <button className="link" onClick={() => { setMode('reset'); setMsg(null); }}>Olvidé mi contraseña</button>}
        </div>
        {mode === 'up' && <p className="xs faint" style={{ textAlign: 'center', marginTop: 14 }}>Solo los correos autorizados pueden crear cuenta.</p>}
      </div>
    </div>
  );
}

export function NewPassword({ onDone }: { onDone: () => void }) {
  const [pass, setPass] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="app">
      <form className="page full" style={{ paddingTop: 80 }} onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const { error } = await supabase!.auth.updateUser({ password: pass });
        setBusy(false);
        if (error) setErr(translate(error.message)); else onDone();
      }}>
        <div className="h1" style={{ marginBottom: 18 }}>Nueva contraseña</div>
        <label className="field"><span>Contraseña nueva</span>
          <input className="input" type="password" autoComplete="new-password" minLength={6} required value={pass} onChange={(e) => setPass(e.target.value)} />
        </label>
        {err && <div className="hint warn" style={{ marginBottom: 14 }}>{err}</div>}
        <button className="btn btn-primary" disabled={busy}>Guardar</button>
      </form>
    </div>
  );
}
