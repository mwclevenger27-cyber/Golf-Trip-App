// Pure golf math: handicaps, net scores, leaderboards and team formats.
// Nothing in here talks to the database, so it is easy to test.

export const HOLES = 18;
export const GHOST_ROUNDS = 20; // starting handicap counts as this many rounds of history
export const MAX_MOVE_PER_ROUND = 1; // a single round can move a handicap at most this much

export const round1 = (n) => Math.round(n * 10) / 10;

export function coursePar(round) {
  return round.holes.reduce((sum, h) => sum + Number(h.par), 0);
}

export function selectedTee(round) {
  return round.tees.find((t) => t.name === round.tee_name) || round.tees[0];
}

// USGA course handicap: index x slope / 113 + (rating - par), rounded.
export function courseHandicap(index, round) {
  const tee = selectedTee(round);
  return Math.round((index * tee.slope) / 113 + (tee.rating - coursePar(round)));
}

// Strokes a player gets on a hole, from their course handicap and the hole's
// stroke index (1 = hardest). Plus handicaps give strokes back on the easiest holes.
export function strokesOnHole(courseHcp, si) {
  if (courseHcp >= 0) {
    return Math.floor(courseHcp / 18) + (si <= courseHcp % 18 ? 1 : 0);
  }
  const plus = -courseHcp;
  return 0 - (Math.floor(plus / 18) + (si > 18 - (plus % 18) ? 1 : 0));
}

export const played = (s) => s !== null && s !== undefined;

// Turns score rows into { [roundId]: { [playerId]: [18 strokes or null] } }.
export function buildScoreMap(scoreRows) {
  const map = {};
  for (const row of scoreRows) {
    map[row.round_id] ??= {};
    map[row.round_id][row.player_id] ??= Array(HOLES).fill(null);
    map[row.round_id][row.player_id][row.hole - 1] = row.strokes;
  }
  return map;
}

export function cardFor(scoreMap, roundId, playerId) {
  return scoreMap[roundId]?.[playerId] || Array(HOLES).fill(null);
}

export function isComplete(card) {
  return card.every(played);
}

// Net double bogey cap used for handicap posting: no hole counts for more
// than par + 2 + the strokes the player gets there.
export function adjustedGross(card, round, courseHcp) {
  return card.reduce((sum, s, i) => {
    const hole = round.holes[i];
    const cap = hole.par + 2 + strokesOnHole(courseHcp, hole.si);
    return sum + Math.min(s, cap);
  }, 0);
}

export function scoreDifferential(card, round, courseHcp) {
  const tee = selectedTee(round);
  return round1((113 / tee.slope) * (adjustedGross(card, round, courseHcp) - tee.rating));
}

// Trip handicap: the starting index counts as 20 rounds at that number. Each
// finished trip round replaces the oldest one, the index is the average of the
// last 20, and it never moves more than 1 stroke in a single round.
// Returns the index each round was played off, plus the current index.
export function handicapHistory(player, rounds, scoreMap) {
  const start = Number(player.start_index) || 0;
  let history = Array(GHOST_ROUNDS).fill(start);
  let index = start;
  const before = {};
  const changes = [];
  for (const round of sortRounds(rounds)) {
    before[round.id] = index;
    const card = cardFor(scoreMap, round.id, player.id);
    if (!isComplete(card)) continue;
    const diff = scoreDifferential(card, round, courseHandicap(index, round));
    history = [...history, diff].slice(-GHOST_ROUNDS);
    const avg = history.reduce((a, b) => a + b, 0) / history.length;
    const next = round1(Math.min(index + MAX_MOVE_PER_ROUND, Math.max(index - MAX_MOVE_PER_ROUND, avg)));
    changes.push({ roundId: round.id, differential: diff, from: index, to: next });
    index = next;
  }
  return { start, current: index, before, changes };
}

export function sortRounds(rounds) {
  return [...rounds].sort((a, b) => a.round_no - b.round_no);
}

// One player's line for one round.
export function playerRoundLine(card, round, index) {
  const ch = courseHandicap(index, round);
  let thru = 0, gross = 0, grossToPar = 0, netToPar = 0;
  card.forEach((s, i) => {
    if (!played(s)) return;
    const hole = round.holes[i];
    thru++;
    gross += s;
    grossToPar += s - hole.par;
    netToPar += s - strokesOnHole(ch, hole.si) - hole.par;
  });
  return { thru, gross, net: gross - (grossToPar - netToPar), grossToPar, netToPar, courseHcp: ch };
}

export function toParLabel(n) {
  if (n === 0) return 'E';
  return n > 0 ? `+${n}` : String(n);
}

// Leaderboard rows for a single round, best first. Players with no scores sink.
export function roundLeaderboard(players, round, scoreMap, indexes, type = 'net') {
  const key = type === 'net' ? 'netToPar' : 'grossToPar';
  return players
    .map((p) => ({ player: p, ...playerRoundLine(cardFor(scoreMap, round.id, p.id), round, indexes[p.id]?.before[round.id] ?? 0) }))
    .sort((a, b) => (a.thru === 0) - (b.thru === 0) || a[key] - b[key] || b.thru - a.thru);
}

// Whole-trip totals, adding each round's to-par so far.
export function tripLeaderboard(players, rounds, scoreMap, indexes, type = 'net') {
  const key = type === 'net' ? 'netToPar' : 'grossToPar';
  return players
    .map((p) => {
      let toPar = 0, holes = 0, gross = 0, roundsStarted = 0;
      for (const r of rounds) {
        const line = playerRoundLine(cardFor(scoreMap, r.id, p.id), r, indexes[p.id]?.before[r.id] ?? 0);
        if (line.thru === 0) continue;
        roundsStarted++;
        toPar += line[key];
        holes += line.thru;
        gross += line.gross;
      }
      return { player: p, toPar, holes, gross, roundsStarted };
    })
    .sort((a, b) => (a.holes === 0) - (b.holes === 0) || a.toPar - b.toPar || b.holes - a.holes);
}

// Group rows -> [[playerId, ...], ...] for one round, ordered by group number.
export function foursomes(groupRows, roundId) {
  const byNo = {};
  for (const g of groupRows) {
    if (g.round_id !== roundId) continue;
    (byNo[g.group_no] ??= []).push(g.player_id);
  }
  return Object.keys(byNo).sort((a, b) => a - b).map((k) => byNo[k]);
}

// Shuffle players into foursomes with two from each team where possible.
export function shuffleFoursomes(players, random = Math.random) {
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const a = shuffle(players.filter((p) => p.team === 'A'));
  const b = shuffle(players.filter((p) => p.team !== 'A'));
  const count = Math.ceil(players.length / 4);
  const groups = Array.from({ length: count }, () => []);
  let gi = 0;
  while (a.length || b.length) {
    const g = groups[gi % count];
    if (g.length < 4) {
      if (a.length && g.filter((p) => p.team === 'A').length < 2) g.push(a.shift());
      else if (b.length && g.filter((p) => p.team !== 'A').length < 2) g.push(b.shift());
      else if (a.length) g.push(a.shift());
      else g.push(b.shift());
    }
    gi++;
    if (gi > players.length * 8) break;
  }
  return groups.map((g) => g.map((p) => p.id));
}

// Team scoring for one round. Every format is measured against par so a team
// that has played more holes is never made to look worse.
//   aggregate: sum of every player's net to par
//   bestball:  in each foursome, each team's best net score on each hole, to par
//   matchplay: in each foursome, best net A vs best net B per hole, 1 point a win, 1/2 a tie
export function teamRoundScore(format, players, round, groups, scoreMap, indexes) {
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  const netOn = (pid, i) => {
    const s = cardFor(scoreMap, round.id, pid)[i];
    if (!played(s)) return null;
    const ch = courseHandicap(indexes[pid]?.before[round.id] ?? 0, round);
    return s - strokesOnHole(ch, round.holes[i].si);
  };

  if (format === 'aggregate') {
    const out = { A: 0, B: 0 };
    for (const p of players) {
      const line = playerRoundLine(cardFor(scoreMap, round.id, p.id), round, indexes[p.id]?.before[round.id] ?? 0);
      out[p.team === 'A' ? 'A' : 'B'] += line.netToPar;
    }
    return out;
  }

  const out = { A: 0, B: 0 };
  for (const fullGroup of groups) {
    const group = fullGroup.filter((id) => byId[id]);
    const sides = { A: group.filter((id) => byId[id]?.team === 'A'), B: group.filter((id) => byId[id] && byId[id].team !== 'A') };
    for (let i = 0; i < HOLES; i++) {
      const par = round.holes[i].par;
      const best = {};
      for (const t of ['A', 'B']) {
        const nets = sides[t].map((id) => netOn(id, i)).filter((n) => n !== null);
        best[t] = nets.length ? Math.min(...nets) : null;
      }
      if (format === 'bestball') {
        for (const t of ['A', 'B']) if (best[t] !== null) out[t] += best[t] - par;
      } else if (format === 'matchplay') {
        // Only score a hole once everyone in the foursome has a number on it.
        const allIn = group.every((id) => netOn(id, i) !== null);
        if (!allIn || !sides.A.length || !sides.B.length) continue;
        if (best.A < best.B) out.A += 1;
        else if (best.B < best.A) out.B += 1;
        else { out.A += 0.5; out.B += 0.5; }
      }
    }
  }
  return out;
}

export function teamTripScore(format, players, rounds, groupRows, scoreMap, indexes) {
  const total = { A: 0, B: 0 };
  for (const r of rounds) {
    const s = teamRoundScore(format, players, r, foursomes(groupRows, r.id), scoreMap, indexes);
    total.A += s.A;
    total.B += s.B;
  }
  return total;
}
