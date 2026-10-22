import { useEffect, useState } from 'react';
import { foursomes, shuffleFoursomes, cardFor, played, courseHandicap, strokesOnHole, playerRoundLine, toParLabel } from '../lib/golf.js';
import { defaultRoundId, formatIndex } from '../ui.jsx';

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

  const roundHasScores = trip.scores.some((s) => s.round_id === round.id);
  const makeGroups = () => {
    if (roundHasScores && !confirm('Scores are already in for this round. Reshuffle the groups anyway? Scores are kept.')) return;
    api.setFoursomes(round.id, shuffleFoursomes(trip.players));
  };

  const h = round.holes[hole];
  const allDone = (i) => group.length > 0 && group.every((p) => played(cardFor(trip.scoreMap, round.id, p.id)[i]));

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
          <h3 className="card-title">{round.name}</h3>
          <p className="muted">No foursomes yet for this round. Shuffle them to start scoring. Each group gets two players from each team.</p>
          <button className="btn btn-primary btn-block" onClick={makeGroups} disabled={trip.players.length === 0}>Make foursomes</button>
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

          <div className="card">
            <div className="hole-head">
              <button className="arrow" aria-label="Previous hole" onClick={() => setHole(Math.max(0, hole - 1))} disabled={hole === 0}>‹</button>
              <div className="hole-title">
                <div className="num">Hole {hole + 1}</div>
                <div className="meta">Par {h.par} · Handicap {h.si}</div>
              </div>
              <button className="arrow" aria-label="Next hole" onClick={() => setHole(Math.min(17, hole + 1))} disabled={hole === 17}>›</button>
            </div>
            <div className="hole-strip">
              {round.holes.map((_, i) => (
                <button key={i} className={i === hole ? 'cur' : allDone(i) ? 'done' : ''} onClick={() => setHole(i)}>{i + 1}</button>
              ))}
            </div>

            {group.map((p) => (
              <PlayerHole key={p.id} player={p} trip={trip} round={round} hole={hole} isMe={p.id === meId} onSet={(v) => api.setScore(round.id, p.id, hole + 1, v)} />
            ))}

            <button
              className="btn btn-primary btn-block"
              style={{ marginTop: 14 }}
              onClick={() => setHole(Math.min(17, hole + 1))}
              disabled={hole === 17}
            >
              {hole === 17 ? 'Last hole' : `Next: hole ${hole + 2} →`}
            </button>
            <div className="save-status">
              {api.pendingCount ? `Saving ${api.pendingCount}…` : 'All scores saved'}
              {!me && ' · Tap “Who are you?” up top to jump to your group'}
            </div>
          </div>

          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn btn-sm" onClick={makeGroups}>Reshuffle foursomes</button>
          </div>
        </>
      )}
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
          {line.thru ? `${toParLabel(line.grossToPar)} thru ${line.thru} · net ${toParLabel(line.netToPar)}` : `HCP ${formatIndex(index)} · ${ch >= 0 ? `gets ${ch}` : `gives back ${-ch}`}`}
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
