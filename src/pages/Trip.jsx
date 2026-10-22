import { useEffect, useState } from 'react';
import { coursePar, selectedTee } from '../lib/golf.js';

// Text box that only saves when you leave it, so typing never loses focus.
function SavingInput({ value, onSave, ...props }) {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => setDraft(value ?? ''), [value]);
  return (
    <input
      {...props}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => String(draft) !== String(value ?? '') && onSave(draft)}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  );
}

export default function Trip({ trip, api }) {
  const { settings, rounds } = trip;
  const saveSetting = (k) => (v) => api.saveSettings({ [k]: v.trim() || settings[k] });

  return (
    <>
      <div className="card">
        <h3 className="card-title">Trip settings</h3>
        <div className="field"><label className="lbl">Trip name</label><SavingInput className="inp" value={settings.trip_name} onSave={saveSetting('trip_name')} /></div>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <div className="field" style={{ flex: 1 }}><label className="lbl">Team A name</label><SavingInput className="inp" value={settings.team_a_name} onSave={saveSetting('team_a_name')} /></div>
          <div className="field" style={{ flex: 1 }}><label className="lbl">Team B name</label><SavingInput className="inp" value={settings.team_b_name} onSave={saveSetting('team_b_name')} /></div>
        </div>
        <div className="field">
          <label className="lbl">Team format</label>
          <select className="inp" value={settings.team_format} onChange={(e) => api.saveSettings({ team_format: e.target.value })}>
            <option value="bestball">Best ball: each team's best net score in each foursome</option>
            <option value="matchplay">Match play: 1 point per hole won in each foursome</option>
            <option value="aggregate">Aggregate: everyone's net score added up</option>
          </select>
        </div>
      </div>

      {rounds.map((r) => <RoundCard key={r.id} round={r} api={api} />)}
    </>
  );
}

function RoundCard({ round, api }) {
  const [open, setOpen] = useState(false);
  const tee = selectedTee(round);
  const save = (patch) => api.saveRound({ id: round.id, ...patch });
  const setHole = (i, key, raw) => {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > (key === 'par' ? 6 : 18)) return;
    save({ holes: round.holes.map((h, j) => (j === i ? { ...h, [key]: n } : h)) });
  };
  const sis = round.holes.map((h) => h.si);
  const siOk = new Set(sis).size === 18;

  const holeInputs = (key, from) => (
    <div className="hole-grid" style={{ marginBottom: 4 }}>
      {round.holes.slice(from, from + 9).map((h, i) => (
        <label key={i}>
          {from + i + 1}
          <SavingInput type="number" inputMode="numeric" value={h[key]} onSave={(v) => setHole(from + i, key, v)} />
        </label>
      ))}
    </div>
  );

  return (
    <div className="card">
      <div className="between">
        <div>
          <div className="lbl" style={{ marginBottom: 2 }}>Round {round.round_no} · {round.day_label} · {round.tee_time}</div>
          <h3 className="card-title" style={{ margin: 0 }}>{round.name}</h3>
          <div className="muted">Par {coursePar(round)} · {tee.name} tees {tee.yards ? `${tee.yards} yds` : ''} · rating {tee.rating} / slope {tee.slope}</div>
        </div>
        <button className="btn btn-sm" onClick={() => setOpen(!open)}>{open ? 'Done' : 'Edit'}</button>
      </div>
      {round.note && <div className="warn">{round.note}</div>}
      {!siOk && <div className="warn">Two holes share a handicap number. Each of 1–18 should be used once.</div>}

      {open && (
        <div style={{ marginTop: 12 }}>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <div className="field" style={{ flex: 2 }}>
              <label className="lbl">Course name</label>
              <SavingInput className="inp" value={round.name} onSave={(v) => v.trim() && save({ name: v.trim() })} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label className="lbl">Tee time</label>
              <SavingInput className="inp" value={round.tee_time} onSave={(v) => save({ tee_time: v })} />
            </div>
          </div>
          <div className="field">
            <label className="lbl">Tees we're playing</label>
            <select className="inp" value={round.tee_name} onChange={(e) => save({ tee_name: e.target.value })}>
              {round.tees.map((t) => <option key={t.name} value={t.name}>{t.name}: {t.yards} yds, {t.rating} / {t.slope}</option>)}
            </select>
          </div>
          <label className="lbl">Par</label>
          {holeInputs('par', 0)}
          {holeInputs('par', 9)}
          <label className="lbl" style={{ marginTop: 10 }}>Hole handicap (1 = hardest)</label>
          {holeInputs('si', 0)}
          {holeInputs('si', 9)}
          {round.note && (
            <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => save({ note: '' })}>I checked the scorecard, hide the warning</button>
          )}
        </div>
      )}
    </div>
  );
}
