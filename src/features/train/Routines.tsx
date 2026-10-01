import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../../data/app';
import { useMesocycles, useRoutines } from '../../data/hooks';
import { activeMeso } from '../../data/logic';
import { put } from '../../data/store';
import { TEMPLATES, allowedEquipment, routineFromTemplate, uid } from '../../core/templates';
import { Icon } from '../../ui/Icon';
import { Header, Sheet } from '../../ui/kit';

export function Routines() {
  const { cat, profile } = useApp();
  const nav = useNavigate();
  const routines = useRoutines();
  const active = activeMeso(useMesocycles());
  const [adding, setAdding] = useState(false);

  async function fromTemplate(tplId: string) {
    const tpl = TEMPLATES.find((t) => t.id === tplId)!;
    const r = { id: uid(), ...routineFromTemplate(tpl, allowedEquipment(profile.equipment), (id) => cat.exById.get(id)?.e) };
    await put('routines', r);
    nav(`/entrenar/rutina/${r.id}`);
  }
  async function blank() {
    const r = { id: uid(), name: 'Mi rutina', split: 'personalizada', level: null, notes: null, days: [{ id: uid(), name: 'Día A', exercises: [] }] };
    await put('routines', r);
    nav(`/entrenar/rutina/${r.id}`);
  }

  return (
    <div className="page">
      <Header title="Mis rutinas" back="/entrenar" />
      {routines.length === 0 && <div className="empty" style={{ marginBottom: 12 }}>Aún no tienes rutinas. Parte con una plantilla.</div>}
      <div className="list">
        {routines.map((r) => (
          <button key={r.id} className="li" onClick={() => nav(`/entrenar/rutina/${r.id}`)}>
            <span className="ico"><Icon name="list" /></span>
            <div className="grow">
              <b>{r.name}</b>
              <div className="xs muted truncate">{r.days.length} {r.days.length === 1 ? 'día' : 'días'} · {r.days.map((d) => d.name).join(', ')}</div>
            </div>
            {active?.routine_id === r.id && <span className="badge">Activa</span>}
            <Icon name="chev-r" className="faint" />
          </button>
        ))}
      </div>
      <button className="btn btn-primary" onClick={() => setAdding(true)}><Icon name="plus" size={18} />Nueva rutina</button>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Nueva rutina">
        <p className="small muted" style={{ marginTop: -6, marginBottom: 12 }}>Los ejercicios se eligen según tu equipamiento. Después puedes cambiar todo.</p>
        {TEMPLATES.map((t) => (
          <button key={t.id} className="opt" onClick={() => { setAdding(false); void fromTemplate(t.id); }}>
            <div className="grow">
              <div className="row between"><b>{t.name}</b><span className="badge gray">{t.plan.length} días</span></div>
              <div className="xs muted" style={{ marginTop: 2 }}>{t.description}</div>
              <div className="xs faint" style={{ marginTop: 2 }}>{t.level}</div>
            </div>
          </button>
        ))}
        <button className="opt" onClick={() => { setAdding(false); void blank(); }}>
          <div className="ico"><Icon name="plus" /></div>
          <div className="grow"><b>Desde cero</b><div className="xs muted">Armas cada día con los ejercicios que quieras</div></div>
        </button>
      </Sheet>
    </div>
  );
}
