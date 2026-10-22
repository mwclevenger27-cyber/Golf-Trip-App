import { describe, it, expect } from 'vitest';
import {
  strokesOnHole, courseHandicap, handicapHistory, buildScoreMap, playerRoundLine,
  teamRoundScore, shuffleFoursomes, tripLeaderboard,
} from './golf.js';
import { COURSES } from './courses.js';

const worldTour = { id: 'r1', round_no: 1, ...COURSES[0] };

function cardRows(roundId, playerId, strokes) {
  return strokes.map((s, i) => ({ round_id: roundId, player_id: playerId, hole: i + 1, strokes: s }));
}
const parCard = (round, plus = 0) => round.holes.map((h) => h.par + plus);

describe('course data', () => {
  it('every course has 18 holes with stroke indexes 1-18 used once', () => {
    for (const c of COURSES) {
      expect(c.holes).toHaveLength(18);
      expect([...c.holes.map((h) => h.si)].sort((a, b) => a - b)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
      expect(c.tees.find((t) => t.name === c.tee_name)).toBeTruthy();
    }
  });
});

describe('strokesOnHole', () => {
  it('gives strokes on the hardest holes first', () => {
    expect(strokesOnHole(8, 1)).toBe(1);
    expect(strokesOnHole(8, 8)).toBe(1);
    expect(strokesOnHole(8, 9)).toBe(0);
    expect(strokesOnHole(20, 2)).toBe(2);
    expect(strokesOnHole(20, 3)).toBe(1);
    expect(strokesOnHole(0, 1)).toBe(0);
  });
  it('plus handicaps give a stroke back on the easiest holes', () => {
    expect(strokesOnHole(-2, 18)).toBe(-1);
    expect(strokesOnHole(-2, 17)).toBe(-1);
    expect(strokesOnHole(-2, 16)).toBe(0);
  });
});

describe('handicapHistory', () => {
  const player = { id: 'p1', start_index: 8 };

  it('stays put with no finished rounds', () => {
    const h = handicapHistory(player, [worldTour], {});
    expect(h.current).toBe(8);
    expect(h.before.r1).toBe(8);
  });

  it('one bad round (94 for an 8) only nudges it up a little', () => {
    const card = parCard(worldTour, 1);
    for (let i = 0; i < 4; i++) card[i] += 1; // 14 bogeys + 4 doubles = 94
    const map = buildScoreMap(cardRows('r1', 'p1', card));
    const h = handicapHistory(player, [worldTour], map);
    expect(h.current).toBeGreaterThan(8);
    expect(h.current).toBeLessThan(9);
  });

  it('never moves more than 1 stroke in a round', () => {
    const card = worldTour.holes.map((h) => h.par + 4); // capped hard, still a huge round
    const rounds = [1, 2, 3].map((n) => ({ ...worldTour, id: `r${n}`, round_no: n }));
    const rows = rounds.flatMap((r) => cardRows(r.id, 'p1', card));
    const h = handicapHistory({ id: 'p1', start_index: 0 }, rounds, buildScoreMap(rows));
    expect(h.changes.map((c) => c.to)).toEqual([1, 2, 3]);
  });

  it('a great round brings it down', () => {
    const map = buildScoreMap(cardRows('r1', 'p1', parCard(worldTour, 0)));
    expect(handicapHistory(player, [worldTour], map).current).toBeLessThan(8);
  });

  it('ignores rounds that are not finished', () => {
    const card = parCard(worldTour, 3);
    card[17] = null;
    const map = buildScoreMap(cardRows('r1', 'p1', card).filter((r) => r.strokes !== null));
    expect(handicapHistory(player, [worldTour], map).current).toBe(8);
  });
});

describe('playerRoundLine', () => {
  it('works out gross and net to par through the holes played', () => {
    const ch = courseHandicap(8, worldTour);
    const card = Array(18).fill(null);
    card[0] = worldTour.holes[0].par + 1;
    card[1] = worldTour.holes[1].par + 1;
    const line = playerRoundLine(card, worldTour, 8);
    expect(line.thru).toBe(2);
    expect(line.grossToPar).toBe(2);
    const given = strokesOnHole(ch, worldTour.holes[0].si) + strokesOnHole(ch, worldTour.holes[1].si);
    expect(line.netToPar).toBe(2 - given);
  });
});

describe('team formats', () => {
  const players = [
    { id: 'a1', team: 'A', start_index: 0 }, { id: 'a2', team: 'A', start_index: 0 },
    { id: 'b1', team: 'B', start_index: 0 }, { id: 'b2', team: 'B', start_index: 0 },
  ];
  const flat = { ...worldTour, tees: [{ name: 'X', rating: 72, slope: 113 }], tee_name: 'X' };
  const indexes = Object.fromEntries(players.map((p) => [p.id, { before: { r1: 0 } }]));
  const groups = [['a1', 'a2', 'b1', 'b2']];
  const p = (i) => flat.holes[i].par;
  const rows = [
    { round_id: 'r1', player_id: 'a1', hole: 1, strokes: p(0) - 1 },
    { round_id: 'r1', player_id: 'a2', hole: 1, strokes: p(0) + 2 },
    { round_id: 'r1', player_id: 'b1', hole: 1, strokes: p(0) },
    { round_id: 'r1', player_id: 'b2', hole: 1, strokes: p(0) },
    { round_id: 'r1', player_id: 'a1', hole: 2, strokes: p(1) },
    { round_id: 'r1', player_id: 'b1', hole: 2, strokes: p(1) - 1 },
  ];
  const map = buildScoreMap(rows);

  it('aggregate sums everyone to par', () => {
    expect(teamRoundScore('aggregate', players, flat, groups, map, indexes)).toEqual({ A: 1, B: -1 });
  });
  it('best ball takes the best score per hole', () => {
    expect(teamRoundScore('bestball', players, flat, groups, map, indexes)).toEqual({ A: -1, B: -1 });
  });
  it('match play only scores holes the whole foursome has finished', () => {
    expect(teamRoundScore('matchplay', players, flat, groups, map, indexes)).toEqual({ A: 1, B: 0 });
  });
  it('trip leaderboard ranks by to-par', () => {
    const rows2 = tripLeaderboard(players, [flat], map, indexes, 'gross');
    expect(rows2[0].toPar).toBe(-1);
    expect(rows2.at(-1).player.id).toBe('a2');
  });
});

describe('shuffleFoursomes', () => {
  it('puts 16 players into 4 groups of 2 + 2', () => {
    const players = Array.from({ length: 16 }, (_, i) => ({ id: `p${i}`, team: i % 2 ? 'B' : 'A' }));
    const groups = shuffleFoursomes(players);
    expect(groups).toHaveLength(4);
    for (const g of groups) {
      expect(g).toHaveLength(4);
      expect(g.filter((id) => Number(id.slice(1)) % 2 === 0)).toHaveLength(2);
    }
    expect(new Set(groups.flat()).size).toBe(16);
  });
});
