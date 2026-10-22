import { useState } from 'react';
import { roundLeaderboard, tripLeaderboard, teamTripScore, teamRoundScore, foursomes, cardFor, played, coursePar, playerRoundLine } from '../lib/golf.js';
import { Avatar, ToPar, Sheet, teamName, defaultRoundId, formatIndex } from '../ui.jsx';

const FORMAT_LABEL = { aggregate: 'Aggregate net strokes', bestball: 'Best ball (net)', matchplay: 'Match play points' };

// Ranks with ties: 1, T2, T2, 4 ...
function ranks(rows, scoreOf) {
  return rows.map((row, i) => {
    if (!row.started) return '';
    const s = scoreOf(row);
    const first = rows.findIndex((r) => r.started && scoreOf(r) === s);
    const tied = rows.filter((r) => r.started && scoreOf(r) === s).length > 1;
    return `${tied ? 'T' : ''}${first + 1}`;
  });
}

export default function Leaderboard({ trip, meId }) {
  const [scope, setScope] = useState('trip');
  const [type, setType] = useState('net');
  const [viewing, setViewing] = useState(null);
  const { players, rounds, scoreMap, indexes, settings } = trip;
  const format = settings.team_format || 'bestball';

  const round = scope === 'trip' ? null : rounds.find((r) => r.id === scope);
  const team = round
    ? teamRoundScore(format, players, round, foursomes(trip.foursomes, round.id), scoreMap, indexes)
    : teamTripScore(format, players, rounds, trip.foursomes, scoreMap, indexes);

  let rows;
  if (round) {
    rows = roundLeaderboard(players, round, scoreMap, indexes, type).map((r) => ({
      ...r, started: r.thru > 0, score: type === 'net' ? r.netToPar : r.grossToPar,
      sub: r.thru === 18 ? `Shot ${r.gross}` : `${r.gross || 0} through ${r.thru}`,
      status: r.thru === 18 ? 'F' : r.thru ? `thru ${r.thru}` : '',
    }));
  } else {
    rows = tripLeaderboard(players, rounds, scoreMap, indexes, type).map((r) => ({
      ...r, started: r.holes > 0, score: r.toPar,
      sub: `HCP ${formatIndex(indexes[r.player.id].current)}`,
      status: r.holes ? `${r.holes} holes` : '',
    }));
  }
  const rankLabels = ranks(rows, (r) => r.score);

  const isPoints = format === 'matchplay';
  // Share of the bar for team A: points won, or strokes better than the other side.
  const share = isPoints
    ? (team.A + team.B ? team.A / (team.A + team.B) : 0.5)
    : Math.min(0.9, Math.max(0.1, 0.5 + (team.B - team.A) / 40));
  const myRowIndex = rows.findIndex((r) => r.player.id === meId);
  const mine = rows[myRowIndex];
  const lead = team.A === team.B ? 'All square' : (isPoints ? team.A > team.B : team.A < team.B) ? `${teamName('A', settings)} lead` : `${teamName('B', settings)} lead`;

  return (
    <>
      <div className="chips">
        <button className={`chip ${scope === 'trip' ? 'on' : ''}`} onClick={() => setScope('trip')}>Whole trip</button>
        {rounds.map((r) => (
          <button key={r.id} className={`chip ${scope === r.id ? 'on' : ''}`} onClick={() => setScope(r.id)}>
            R{r.round_no} · {r.name.replace('Myrtle Beach National ', 'MBN ')}
          </button>
        ))}
      </div>

      {mine?.started && (
        <div className="you-card">
          <div className="pos">{rankLabels[myRowIndex]}</div>
          <div className="what">
            <b>You, {type}</b>
            {round ? (mine.thru === 18 ? `Finished · shot ${mine.gross}` : `Through ${mine.thru} holes`) : `${mine.holes} holes on the trip`}
          </div>
          <div className="tp"><ToPar value={mine.score} /></div>
        </div>
      )}

      <div className="card">
        <div className="hero">
          <div>
            <div className="team-name" style={{ color: 'var(--green)' }}>{teamName('A', settings)}</div>
            <div className="team-score">{isPoints ? team.A : <ToPar value={team.A} />}</div>
          </div>
          <div className="vs">{isPoints ? 'points' : 'to par'}</div>
          <div>
            <div className="team-name" style={{ color: 'var(--team-b)' }}>{teamName('B', settings)}</div>
            <div className="team-score">{isPoints ? team.B : <ToPar value={team.B} />}</div>
          </div>
        </div>
        <div className="tug"><div style={{ width: `${share * 100}%` }} /></div>
        <div className="muted" style={{ textAlign: 'center', marginTop: 10 }}>{lead} · {FORMAT_LABEL[format]}</div>
      </div>

      <div className="card">
        <div className="between" style={{ marginBottom: 4 }}>
          <h3 className="card-title" style={{ margin: 0 }}>{round ? round.name : 'Trip leaderboard'}</h3>
          <div className="seg">
            <button className={type === 'net' ? 'on' : ''} onClick={() => setType('net')}>Net</button>
            <button className={type === 'gross' ? 'on' : ''} onClick={() => setType('gross')}>Gross</button>
          </div>
        </div>
        {!rows.some((r) => r.started) && <div className="empty">No scores yet. Tap Score to start your round.</div>}
        {rows.map((r, i) => (
          <button
            key={r.player.id}
            className={`lb-row ${r.player.id === meId ? 'me-row' : ''}`}
            onClick={() => setViewing({ playerId: r.player.id, roundId: round?.id || defaultRoundId(trip) })}
          >
            <div className="lb-rank">{rankLabels[i]}</div>
            <Avatar player={r.player} />
            <div>
              <div className="lb-name">{r.player.name}</div>
              <div className="lb-sub">{r.sub}</div>
            </div>
            <div className="lb-score">
              <div className="tp">{r.started ? <ToPar value={r.score} /> : '–'}</div>
              <div className="thru">{r.status}</div>
            </div>
          </button>
        ))}
      </div>

      {viewing && <CardSheet trip={trip} {...viewing} onPickRound={(roundId) => setViewing({ ...viewing, roundId })} onClose={() => setViewing(null)} />}
    </>
  );
}

function CardSheet({ trip, playerId, roundId, onPickRound, onClose }) {
  const player = trip.players.find((p) => p.id === playerId);
  const round = trip.rounds.find((r) => r.id === roundId);
  const idx = trip.indexes[playerId];
  const card = cardFor(trip.scoreMap, roundId, playerId);
  const line = playerRoundLine(card, round, idx.before[roundId]);
  const nine = (from) => {
    const holes = round.holes.slice(from, from + 9);
    const sc = card.slice(from, from + 9);
    const sum = (arr) => arr.reduce((a, b) => a + (b || 0), 0);
    return (
      <table className="grid9">
        <thead><tr><th className="lab" />{holes.map((_, i) => <th key={i}>{from + i + 1}</th>)}<th>{from ? 'In' : 'Out'}</th></tr></thead>
        <tbody>
          <tr><td className="lab">Par</td>{holes.map((h, i) => <td key={i}>{h.par}</td>)}<td>{sum(holes.map((h) => h.par))}</td></tr>
          <tr>
            <td className="lab">Score</td>
            {sc.map((s, i) => <td key={i} className={played(s) ? (s < holes[i].par ? 'under' : '') : 'muted'}>{played(s) ? s : '·'}</td>)}
            <td>{sc.some(played) ? sum(sc) : ''}</td>
          </tr>
        </tbody>
      </table>
    );
  };
  return (
    <Sheet title={player.name} onClose={onClose}>
      <div className="chips">
        {trip.rounds.map((r) => (
          <button key={r.id} className={`chip ${r.id === roundId ? 'on' : ''}`} onClick={() => onPickRound(r.id)}>R{r.round_no}</button>
        ))}
      </div>
      <div className="muted" style={{ marginBottom: 8 }}>
        {round.name} · par {coursePar(round)} · played off {formatIndex(idx.before[roundId])} (gets {line.courseHcp} strokes)
      </div>
      {nine(0)}
      {nine(9)}
      <div className="between" style={{ marginTop: 8 }}>
        <span>Gross {line.gross || '–'} (<ToPar value={line.grossToPar} />)</span>
        <span>Net <ToPar value={line.netToPar} /></span>
      </div>
      <div className="rule-gold" />
      <div className="muted">
        Trip handicap: started at {formatIndex(idx.start)}, now {formatIndex(idx.current)}.
        {idx.changes.map((c) => {
          const r = trip.rounds.find((x) => x.id === c.roundId);
          return <div key={c.roundId}>R{r.round_no}: round rated {c.differential} → {formatIndex(c.from)} to {formatIndex(c.to)}</div>;
        })}
      </div>
      <div className="sheet-actions"><button className="btn" onClick={onClose}>Close</button></div>
    </Sheet>
  );
}
