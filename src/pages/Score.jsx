import { useEffect, useState } from 'react';
import { foursomes, cardFor, played, courseHandicap, strokesOnHole, playerRoundLine, toParLabel } from '../lib/golf.js';
import { defaultRoundId, formatIndex, CourseArt } from '../ui.jsx';
import { greenYardages, distanceYards } from '../lib/geo.js';
import { useGps, gpsWanted, useWakeLock } from '../useGps.js';
import MapSheet from '../MapSheet.jsx';
import GroupsSheet from '../GroupsSheet.jsx';

const HOLE_KEY = 'golf-trip-hole';

export default function Score({ trip, api, me, meId }) {
  const [roundId, setRoundId] = useState(() => defaultRoundId(trip));
  const round = trip.rounds.find((r) => r.id === roundId) || trip.rounds[0];
  const groups = foursomes(trip.foursomes, round.id);
  const myGroup = Math.max(0, groups.findIndex((g) => g.includes(meId)));
  const [groupNo, setGroupNo] = useState(myGroup);
  useEffect(() => setGroupNo(myGroup), [round.id, myGroup]);

  const group = (groups[groupNo] || []).map((id) => trip.players.find((p) => p.id === id)).filter(Boolean);
  const firstOpen = () => {
    if (!group.length) return 0;
    for (let h = 0; h < 18; h++) if (group.some((p) => !played(cardFor(trip.scoreMap, round.id, p.id)[h]))) return h;
    return 17;
  };
  const [hole, setHole] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(HOLE_KEY));
      if (saved?.roundId === round.id) return saved.hole;
    } catch { /* ignore */ }
    return firstOpen();
  });
  useEffect(() => {
    try { sessionStorage.setItem(HOLE_KEY, JSON.stringify({ roundId: round.id, hole })); } catch { /* ignore */ }
  }, [round.id, hole]);

  const changeRound = (id) => {
    setRoundId(id);
    setHole(0);
  };

  const [editingGroups, setEditingGroups] = useState(false);

  const h = round.holes[hole];
  const allDone = (i) => group.length > 0 && group.every((p) => played(cardFor(trip.scoreMap, round.id, p.id)[i]));
  const holeDone = allDone(hole);
  const blanks = group.filter((p) => !played(cardFor(trip.scoreMap, round.id, p.id)[hole]));

  const [gpsOn, setGpsOn] = useState(gpsWanted);
  const [mapOpen, setMapOpen] = useState(false);
  const gps = useGps(gpsOn || mapOpen);
  useWakeLock(groups.length > 0);
  const near = gps.pos && h.green && distanceYards(gps.pos, h.green) < 700;
  const yards = near ? greenYardages(gps.pos, h) : null;

  return (
    <>
      <div className="chips">
        {trip.rounds.map((r) => (
          <button key={r.id} className={`chip ${r.id === round.id ? 'on' : ''}`} onClick={() => changeRound(r.id)}>
            R{r.round_no} · {r.day_label}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <div className="card">
          <CourseArt round={round} />
          <h3 className="card-title">{round.name}</h3>
          <p className="muted">No foursomes yet for this round. Put everyone in a group to start scoring.</p>
          <button className="btn btn-primary btn-block" onClick={() => setEditingGroups(true)} disabled={trip.players.length === 0}>Set foursomes</button>
        </div>
      ) : (
        <>
          <div className="chips">
            {groups.map((g, i) => (
              <button key={i} className={`chip ${i === groupNo ? 'on' : ''}`} onClick={() => setGroupNo(i)}>
                Group {i + 1}{g.includes(meId) ? ' (you)' : ''}
              </button>
            ))}
          </div>

          <div className="hole-hero">
            <div className="hole-head">
              <button className="arrow" aria-label="Previous hole" onClick={() => setHole(Math.max(0, hole - 1))} disabled={hole === 0}>‹</button>
              <div className="hole-title">
                <div className="num">Hole {hole + 1}</div>
                <div className="meta">Par {h.par} · Handicap {h.si}</div>
              </div>
              <button className="arrow" aria-label="Next hole" onClick={() => setHole(Math.min(17, hole + 1))} disabled={hole === 17}>›</button>
            </div>
            <button className="yard-bar" onClick={() => (gpsOn || !h.green ? setMapOpen(true) : setGpsOn(true))}>
              {yards ? (
                <>
                  <span><small>F</small>{yards.front}</span>
                  <span className="big"><small>to the middle</small>{yards.middle}</span>
                  <span><small>B</small>{yards.back}</span>
                  <span className="map-link">Map ›</span>
                </>
              ) : !h.green ? (
                <span className="hint">🗺️ Set up the hole map for GPS yardages ›</span>
              ) : !gpsOn ? (
                <span className="hint">📍 Tap to turn on GPS yardages</span>
              ) : gps.error ? (
                <span className="hint">{gps.error}</span>
              ) : gps.pos ? (
                <span className="hint">You're not on this hole yet · Open map ›</span>
              ) : (
                <span className="hint">Finding you…</span>
              )}
            </button>
            <div className="hole-strip">
              {round.holes.map((_, i) => (
                <button key={i} className={i === hole ? 'cur' : allDone(i) ? 'done' : ''} onClick={() => setHole(i)}>{i + 1}</button>
              ))}
            </div>
          </div>

          <div className="card score-card">
            {group.map((p) => (
              <PlayerHole key={p.id} player={p} trip={trip} round={round} hole={hole} isMe={p.id === meId} onSet={(v) => api.setScore(round.id, p.id, hole + 1, v)} />
            ))}
            {blanks.length > 1 && (
              <button className="btn btn-sm all-par" onClick={() => blanks.forEach((p) => api.setScore(round.id, p.id, hole + 1, h.par))}>
                Everyone else made par
              </button>
            )}
          </div>

          <button
            className={`btn btn-primary btn-block next-btn ${holeDone ? 'ready' : ''}`}
            onClick={() => setHole(Math.min(17, hole + 1))}
            disabled={hole === 17}
          >
            {hole === 17 ? (holeDone ? 'Round complete ✓' : 'Last hole') : holeDone ? `✓ Hole ${hole + 1} done · On to ${hole + 2} →` : `Next: hole ${hole + 2} →`}
          </button>
          <div className="save-status">
            {api.pendingCount ? `Saving ${api.pendingCount}…` : '✓ All scores saved'}
            {!me && ' · Tap “Who are you?” up top to jump to your group'}
          </div>

          {mapOpen && <MapSheet round={round} hole={hole} setHole={setHole} gps={gps} api={api} onClose={() => setMapOpen(false)} />}

          <div className="row" style={{ justifyContent: 'center', marginTop: 18 }}>
            <button className="btn btn-sm" onClick={() => setEditingGroups(true)}>Change foursomes</button>
          </div>
        </>
      )}
      {editingGroups && <GroupsSheet trip={trip} round={round} api={api} onClose={() => setEditingGroups(false)} />}
    </>
  );
}

function PlayerHole({ player, trip, round, hole, isMe, onSet }) {
  const index = trip.indexes[player.id].before[round.id];
  const ch = courseHandicap(index, round);
  const h = round.holes[hole];
  const strokes = strokesOnHole(ch, h.si);
  const card = cardFor(trip.scoreMap, round.id, player.id);
  const value = card[hole];
  const line = playerRoundLine(card, round, index);

  const set = (v) => onSet(Math.max(1, Math.min(20, v)));
  const cls = !played(value) ? 'blank' : value < h.par ? 'birdie' : value > h.par ? 'bogey' : '';

  return (
    <div className="score-row">
      <div className="who">
        <div className="nm">
          {player.name}{isMe ? ' (you)' : ''}
          {strokes !== 0 && <span className="dots" title={`${strokes} stroke${Math.abs(strokes) === 1 ? '' : 's'} here`}>{strokes > 0 ? '•'.repeat(strokes) : '−'}</span>}
        </div>
        <div className="tot">
          {line.thru ? `${toParLabel(line.grossToPar)} thru ${line.thru} · net ${toParLabel(line.netToPar)}` : `HCP ${formatIndex(index)} · course ${ch < 0 ? `+${-ch}` : ch}`}
          {played(value) && <button className="clear" onClick={() => onSet(null)}>clear</button>}
        </div>
      </div>
      <div className="stepper">
        <button className="pm" aria-label="One less" onClick={() => set(played(value) ? value - 1 : h.par - 1)}>−</button>
        <button
          className={`val ${cls}`}
          aria-label="Set to par"
          onClick={() => (played(value) ? null : set(h.par))}
        >
          {played(value) ? value : h.par}
        </button>
        <button className="pm" aria-label="One more" onClick={() => set(played(value) ? value + 1 : h.par + 1)}>+</button>
      </div>
    </div>
  );
}
