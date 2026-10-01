// Medidas corporales: cintura, cadera, pecho, brazo, muslo y cuello, con % de grasa estimado.
import { useMemo, useState } from 'react';
import { useApp, useToday } from '../../data/app';
import { useMeasurements } from '../../data/hooks';
import { saveMeasurement } from '../../data/actions';
import { fmt } from '../../data/logic';
import { remove } from '../../data/store';
import type { BodyMeasurement } from '../../data/types';
import { MEASURES, navyBodyFat, type MeasureKey } from '../../core/body';
import { daysBetween, relativeDay } from '../../core/dates';
import { Icon } from '../../ui/Icon';
import { Sheet, useToast } from '../../ui/kit';
import { LineChart } from '../../ui/chart';

type Series = MeasureKey | 'bf';

export function Measures() {
  const { profile } = useApp();
  const today = useToday();
  const toast = useToast();
  const rows = useMeasurements();
  const [series, setSeries] = useState<Series>('waist');
  const [edit, setEdit] = useState<string | null>(null);

  const bf = (m: BodyMeasurement) => navyBodyFat(profile.sex, profile.height_cm, m);
  const valueOf = (m: BodyMeasurement, s: Series) => (s === 'bf' ? bf(m) : m[s]);
  const pts = useMemo(() => rows.map((m) => ({ date: m.date, y: valueOf(m, series) })).filter((p): p is { date: string; y: number } => p.y != null), [rows, series]); // eslint-disable-line react-hooks/exhaustive-deps
  const last = rows[rows.length - 1];
  const lastBf = [...rows].reverse().map(bf).find((v) => v != null) ?? null;
  const due = !last || daysBetween(last.date, today) >= 14;

  const change = (key: MeasureKey) => {
    const withVal = rows.filter((m) => m[key] != null);
    if (withVal.length < 2) return null;
    return (withVal[withVal.length - 1][key] as number) - (withVal[0][key] as number);
  };

  return (
    <>
      <div className="grid3">
        <div className="stat"><div className="xs muted">Cintura</div><div className="num">{last?.waist != null ? fmt(last.waist, 1) : '–'}</div></div>
        <div className="stat"><div className="xs muted">% grasa est.</div><div className="num">{lastBf != null ? fmt(lastBf, 1) : '–'}</div></div>
        <div className="stat"><div className="xs muted">Última vez</div><div className="num" style={{ fontSize: 18 }}>{last ? relativeDay(last.date, today) : '–'}</div></div>
      </div>

      <div className="card">
        <div className="chips" style={{ flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 6, marginBottom: 8 }}>
          {[...MEASURES.map((m) => [m.key, m.label] as [Series, string]), ['bf', '% grasa'] as [Series, string]].map(([k, l]) => (
            <button key={k} className={series === k ? 'on' : ''} style={{ whiteSpace: 'nowrap', padding: '6px 11px', fontSize: 13 }} onClick={() => setSeries(k)}>{l}</button>
          ))}
        </div>
        <LineChart points={pts} unit={series === 'bf' ? '%' : 'cm'} />
        {series === 'bf' && (
          <p className="xs muted" style={{ marginTop: 8 }}>
            Fórmula de la Marina de EE. UU. con cintura, cuello{profile.sex === 'f' ? ', cadera' : ''} y estatura. Puede errar 3–4 puntos, pero sirve para ver si la tendencia baja.
          </p>
        )}
      </div>

      <button className={`btn ${due ? 'btn-primary' : 'btn-soft'}`} onClick={() => setEdit(today)}><Icon name="plus" size={18} />{last?.date === today ? 'Editar las medidas de hoy' : 'Registrar medidas'}</button>
      <p className="xs muted" style={{ margin: '8px 0 0', textAlign: 'center' }}>Mídete cada 2 semanas, en ayunas, con la cinta ajustada sin apretar.{due && last ? ' Ya te toca.' : ''}</p>

      {rows.length > 0 && (
        <>
          <div className="eyebrow" style={{ margin: '18px 0 8px' }}>Cambio desde la primera medición</div>
          <div className="list">
            {MEASURES.map((m) => {
              const c = change(m.key);
              const cur = [...rows].reverse().find((r) => r[m.key] != null)?.[m.key];
              if (cur == null) return null;
              return (
                <div key={m.key} className="li" style={{ padding: '11px 16px' }}>
                  <span className="grow">{m.label}</span>
                  <b className="num" style={{ fontSize: 18 }}>{fmt(cur, 1)} cm</b>
                  <span className="xs" style={{ width: 62, textAlign: 'right', color: c == null || c === 0 ? 'var(--faint)' : undefined }}>{c == null ? '–' : `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmt(Math.abs(c), 1)}`}</span>
                </div>
              );
            })}
          </div>

          <div className="eyebrow" style={{ margin: '18px 0 8px' }}>Registros</div>
          <div className="list">
            {[...rows].reverse().slice(0, 20).map((m) => (
              <div key={m.id} className="li">
                <button className="grow" style={{ textAlign: 'left', minWidth: 0 }} onClick={() => setEdit(m.date)}>
                  <b>{relativeDay(m.date, today)}</b>
                  <div className="xs muted truncate">{MEASURES.filter((x) => m[x.key] != null).map((x) => `${x.label} ${fmt(m[x.key]!, 1)}`).join(' · ')}</div>
                </button>
                <button className="icon-btn" style={{ width: 36, height: 36 }} aria-label="Eliminar medición" onClick={async () => { await remove('body_measurements', m.id); toast('Medición eliminada', 'Deshacer', () => void saveMeasurement({ ...m })); }}><Icon name="trash" size={16} /></button>
              </div>
            ))}
          </div>
        </>
      )}

      {edit && <MeasureSheet key={edit} date={edit} rows={rows} onClose={() => setEdit(null)} />}
    </>
  );
}

function MeasureSheet({ date, rows, onClose }: { date: string; rows: BodyMeasurement[]; onClose: () => void }) {
  const { profile } = useApp();
  const toast = useToast();
  const existing = rows.find((r) => r.date === date);
  const prev = [...rows].reverse().find((r) => r.date < date);
  const [v, setV] = useState<Record<MeasureKey, string>>(() => Object.fromEntries(MEASURES.map((m) => [m.key, existing?.[m.key] != null ? String(existing[m.key]).replace('.', ',') : ''])) as Record<MeasureKey, string>);
  const [help, setHelp] = useState<MeasureKey | null>(null);
  const n = (s: string) => { const x = parseFloat(s.replace(',', '.')); return Number.isFinite(x) && x > 10 && x < 250 ? Math.round(x * 10) / 10 : null; };
  const vals = Object.fromEntries(MEASURES.map((m) => [m.key, n(v[m.key])])) as Record<MeasureKey, number | null>;
  const bf = navyBodyFat(profile.sex, profile.height_cm, vals);
  const any = Object.values(vals).some((x) => x != null);
  return (
    <Sheet open onClose={onClose} title={existing ? 'Editar medidas' : 'Medidas de hoy'}>
      <p className="small muted" style={{ marginTop: -6, marginBottom: 12 }}>En centímetros. Llena solo las que quieras; toca el nombre para ver cómo medir.</p>
      <div className="grid2">
        {MEASURES.map((m) => (
          <label key={m.key} className="field" style={{ margin: 0 }}>
            <span><button type="button" className="link" style={{ fontSize: 13 }} onClick={(e) => { e.preventDefault(); setHelp(help === m.key ? null : m.key); }}>{m.label}</button>{prev?.[m.key] != null && <span className="faint"> · antes {fmt(prev[m.key]!, 1)}</span>}</span>
            <input className="input" inputMode="decimal" value={v[m.key]} placeholder={prev?.[m.key] != null ? String(prev[m.key]).replace('.', ',') : 'cm'} onChange={(e) => setV({ ...v, [m.key]: e.target.value })} />
          </label>
        ))}
      </div>
      {help && <div className="hint" style={{ marginBottom: 12 }}><Icon name="info" size={18} /><span><b>{MEASURES.find((m) => m.key === help)!.label}:</b> {MEASURES.find((m) => m.key === help)!.how}.</span></div>}
      {bf != null && <div className="hint" style={{ marginBottom: 12 }}><Icon name="chart" size={18} /><span>% de grasa estimado: <b>{fmt(bf, 1)} %</b></span></div>}
      <button className="btn btn-primary" disabled={!any} onClick={async () => {
        await saveMeasurement({ date, ...vals, note: existing?.note ?? null });
        toast('Medidas guardadas');
        onClose();
      }}>Guardar</button>
    </Sheet>
  );
}
