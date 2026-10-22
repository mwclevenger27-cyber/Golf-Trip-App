import { useState } from 'react';
import { Avatar, TeamPill, Sheet, formatIndex, teamName } from '../ui.jsx';
import { balanceTeams } from '../lib/golf.js';

export default function Players({ trip, api, meId, onChooseMe }) {
  const [editing, setEditing] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const { players, indexes, settings } = trip;
  const byTeam = (t) => players.filter((p) => (p.team === 'A') === (t === 'A'));
  const flip = (p) => api.updatePlayers([{ id: p.id, team: p.team === 'A' ? 'B' : 'A' }]);
  const balance = () => {
    if (!confirm('Split everyone into two even teams based on their starting handicaps? This replaces the current teams.')) return;
    api.updatePlayers(balanceTeams(players));
  };

  return (
    <>
      {assigning ? (
        <div className="card" style={{ background: 'var(--green-tint)' }}>
          <div className="between">
            <strong>Tap a player to move them to the other team</strong>
            <button className="btn btn-primary btn-sm" onClick={() => setAssigning(false)}>Done</button>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <span className="mono">{byTeam('A').length} vs {byTeam('B').length}</span>
            <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={balance}>Balance by handicap</button>
          </div>
        </div>
      ) : (
        <div className="between" style={{ marginBottom: 12 }}>
          <span className="muted">{players.length} players · tap to edit</span>
          <div className="row">
            <button className="btn btn-sm" onClick={() => setAssigning(true)}>Assign teams</button>
            <button className="btn btn-primary btn-sm" onClick={() => setEditing({ name: '', team: 'A', start_index: '', notes: '' })}>+ Add</button>
          </div>
        </div>
      )}
      {['A', 'B'].map((t) => (
        <div className="card" key={t}>
          <h3 className="card-title">{teamName(t, settings)} <span className="muted">({byTeam(t).length})</span></h3>
          {byTeam(t).map((p) => {
            const idx = indexes[p.id];
            const diff = Math.round((idx.current - idx.start) * 10) / 10;
            return (
              <button key={p.id} className={`lb-row ${p.id === meId ? 'me-row' : ''}`} onClick={() => (assigning ? flip(p) : setEditing(p))}>
                <Avatar player={p} />
                <div>
                  <div className="lb-name">{p.name}</div>
                  <div className="lb-sub">{p.notes || `Started at ${formatIndex(idx.start)}`}</div>
                </div>
                {assigning ? (
                  <span className="lb-score btn btn-sm">→ {teamName(t === 'A' ? 'B' : 'A', settings)}</span>
                ) : (
                <div className="lb-score">
                  <div className="tp mono">{formatIndex(idx.current)}</div>
                  <div className="thru">{diff === 0 ? 'handicap' : `${diff > 0 ? '▲' : '▼'} ${Math.abs(diff).toFixed(1)} on trip`}</div>
                </div>
                )}
              </button>
            );
          })}
          {byTeam(t).length === 0 && <div className="empty">Nobody on this team yet.</div>}
        </div>
      ))}
      <p className="muted small" style={{ textAlign: 'center' }}>
        Handicaps update after every finished round. Your starting number counts as 20 rounds, so one bad day only nudges it, and no round moves it more than 1 stroke.
      </p>
      {editing && (
        <PlayerSheet
          player={editing}
          settings={settings}
          isMe={editing.id === meId}
          onChooseMe={() => { onChooseMe(editing.id); setEditing(null); }}
          onSave={async (p) => { await api.savePlayer(p); setEditing(null); }}
          onDelete={async () => {
            if (!confirm(`Remove ${editing.name} from the trip? Their scores go too.`)) return;
            await api.deletePlayer(editing.id);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function PlayerSheet({ player, settings, isMe, onChooseMe, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({ ...player, start_index: player.start_index ?? '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    if (!form.name.trim()) return setError('Give them a name.');
    const idx = Number(form.start_index || 0);
    if (Number.isNaN(idx) || idx < -10 || idx > 54) return setError('Handicap should be between +10 and 54.');
    setBusy(true);
    try {
      const { id, name, team, notes } = form;
      await onSave({ ...(id ? { id } : {}), name: name.trim(), team, notes: notes || '', start_index: Math.round(idx * 10) / 10 });
    } catch (e) {
      setError(`Couldn't save: ${e.message}`);
      setBusy(false);
    }
  };

  return (
    <Sheet title={player.id ? 'Edit player' : 'Add player'} onClose={onClose}>
      <div className="field"><label className="lbl">Name</label><input className="inp" value={form.name} onChange={set('name')} placeholder="Full name" /></div>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <div className="field" style={{ flex: 1 }}>
          <label className="lbl">Starting handicap</label>
          <input className="inp" type="number" inputMode="decimal" step="0.1" value={form.start_index} onChange={set('start_index')} placeholder="e.g. 8" />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label className="lbl">Team</label>
          <select className="inp" value={form.team} onChange={set('team')}>
            <option value="A">{teamName('A', settings)}</option>
            <option value="B">{teamName('B', settings)}</option>
          </select>
        </div>
      </div>
      <div className="muted small" style={{ marginTop: -6, marginBottom: 12 }}>For a plus handicap, type a negative number (+2 is −2).</div>
      <div className="field"><label className="lbl">Notes</label><textarea className="inp" value={form.notes} onChange={set('notes')} placeholder="Bombs it off the tee, can't putt under pressure…" /></div>
      {error && <div className="warn">{error}</div>}
      <div className="sheet-actions">
        {player.id && !isMe && <button className="btn" onClick={onChooseMe} style={{ marginRight: 'auto' }}>This is me</button>}
        {player.id && <button className="btn btn-danger" onClick={onDelete}>Remove</button>}
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
      {player.id && <div style={{ marginTop: 10 }}><TeamPill team={player.team} settings={settings} /></div>}
    </Sheet>
  );
}
