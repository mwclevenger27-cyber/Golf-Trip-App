import { useState } from 'react';
import { foursomes } from './lib/golf.js';
import { Avatar, Sheet, teamName } from './ui.jsx';

// Pick each player's group for one round by hand.
export default function GroupsSheet({ trip, round, api, onClose }) {
  const { players, rounds, settings } = trip;
  const groupOf = (groups) => {
    const map = {};
    groups.forEach((g, i) => g.forEach((id) => { map[id] = i + 1; }));
    return map;
  };
  const [picks, setPicks] = useState(() => groupOf(foursomes(trip.foursomes, round.id)));
  const [saving, setSaving] = useState(false);
  const count = Math.max(4, Math.ceil(players.length / 4), ...Object.values(picks));
  const numbers = Array.from({ length: count }, (_, i) => i + 1);
  const sizes = numbers.map((n) => players.filter((p) => picks[p.id] === n).length);
  const unassigned = players.filter((p) => !picks[p.id]).length;
  const sorted = [...players].sort((a, b) => (a.team || '').localeCompare(b.team || '') || a.name.localeCompare(b.name));
  const others = rounds.filter((r) => r.id !== round.id && foursomes(trip.foursomes, r.id).length);

  const pick = (id, n) => setPicks((p) => ({ ...p, [id]: p[id] === n ? undefined : n }));
  const save = async () => {
    setSaving(true);
    const groups = numbers.map((n) => players.filter((p) => picks[p.id] === n).map((p) => p.id)).filter((g) => g.length);
    await api.setFoursomes(round.id, groups);
    setSaving(false);
    onClose();
  };

  return (
    <Sheet title={`Foursomes · R${round.round_no}`} onClose={onClose}>
      <p className="muted" style={{ marginTop: 0 }}>Tap a group number next to each player.</p>
      {others.length > 0 && (
        <div className="chips">
          {others.map((r) => (
            <button key={r.id} className="chip" onClick={() => setPicks(groupOf(foursomes(trip.foursomes, r.id)))}>
              Same as R{r.round_no}
            </button>
          ))}
        </div>
      )}
      <div className="group-sizes">
        {numbers.map((n, i) => (
          <span key={n} className={sizes[i] === 4 ? 'full' : sizes[i] > 4 ? 'over' : ''}>Group {n}: {sizes[i]}</span>
        ))}
      </div>
      <div className="group-list">
        {sorted.map((p) => (
          <div key={p.id} className="group-row">
            <Avatar player={p} size={30} />
            <div className="nm">
              {p.name}
              <small>{teamName(p.team, settings)}</small>
            </div>
            <div className="seg">
              {numbers.map((n) => (
                <button key={n} className={picks[p.id] === n ? 'on' : ''} onClick={() => pick(p.id, n)}>{n}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {unassigned > 0 && <div className="muted" style={{ marginTop: 8 }}>{unassigned} not in a group yet.</div>}
      <div className="sheet-actions">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save foursomes'}</button>
      </div>
    </Sheet>
  );
}
