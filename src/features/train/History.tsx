import { useNavigate } from 'react-router';
import { useSessions } from '../../data/hooks';
import { fmt } from '../../data/logic';
import { parseISODate, relativeDay, todayISO } from '../../core/dates';
import { Icon } from '../../ui/Icon';
import { Header } from '../../ui/kit';
import { elapsedText } from './today';

export function History() {
  const nav = useNavigate();
  const today = todayISO();
  const list = useSessions().filter((s) => s.status === 'terminada').sort((a, b) => b.started_at.localeCompare(a.started_at));
  const groups: [string, typeof list][] = [];
  for (const s of list) {
    const label = parseISODate(s.date).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
    const g = groups[groups.length - 1];
    if (g && g[0] === label) g[1].push(s); else groups.push([label, [s]]);
  }
  return (
    <div className="page">
      <Header title="Historial" sub={`${list.length} sesiones`} back="/entrenar" />
      {!list.length && <div className="empty">Aún no terminas ninguna sesión. Cuando lo hagas, aparecerán aquí.</div>}
      {groups.map(([label, items]) => (
        <div key={label}>
          <div className="eyebrow" style={{ margin: '16px 0 8px' }}>{label} · {items.length}</div>
          <div className="list">
            {items.map((s) => (
              <button key={s.id} className="li" onClick={() => nav(`/entrenar/resumen/${s.id}`)}>
                <div className="grow">
                  <b>{s.day_name}</b>
                  <div className="xs muted">{relativeDay(s.date, today)} · {elapsedText(s.started_at, s.ended_at)} · {fmt(s.volume_kg)} kg · {s.sets_done} series</div>
                </div>
                {s.prs.length > 0 && <span className="badge"><Icon name="trophy" size={12} style={{ display: 'inline', verticalAlign: -2 }} /> {s.prs.length}</span>}
                <Icon name="chev-r" className="faint" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
