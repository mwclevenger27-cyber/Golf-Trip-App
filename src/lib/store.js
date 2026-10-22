// Data layer. Two backends with the same shape:
//   - Supabase: the real shared database with live updates.
//   - Demo: lives in this browser only, used until Supabase keys are set.
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';
import { COURSES, ROSTER } from './courses.js';

export const TABLES = ['settings', 'players', 'rounds', 'foursomes', 'scores', 'messages'];

const ORDER = {
  settings: ['id'],
  players: ['created_at'],
  rounds: ['round_no'],
  foursomes: ['group_no'],
  scores: ['hole'],
  messages: ['created_at'],
};

export function createStore() {
  return SUPABASE_URL && SUPABASE_ANON_KEY ? supabaseStore() : demoStore();
}

function supabaseStore() {
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const must = ({ data, error }) => {
    if (error) throw error;
    return data;
  };

  async function fetchTable(table) {
    if (table === 'messages') {
      const latest = must(await db.from('messages').select('*').order('created_at', { ascending: false }).limit(500));
      return latest.reverse();
    }
    // Supabase returns at most 1000 rows per request, so page through scores.
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const page = must(await db.from(table).select('*').order(ORDER[table][0]).range(from, from + 999));
      rows.push(...page);
      if (page.length < 1000) return rows;
    }
  }

  return {
    demo: false,
    async load() {
      const entries = await Promise.all(TABLES.map(async (t) => [t, await fetchTable(t)]));
      return Object.fromEntries(entries);
    },
    // onScore({type, row}) for single score changes; onTable(table, rows) for everything else.
    subscribe({ onScore, onTable, onStatus }) {
      const channel = db.channel('trip');
      for (const table of TABLES) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table }, async (payload) => {
          if (table === 'scores') {
            onScore(payload.eventType === 'DELETE' ? { type: 'delete', row: payload.old } : { type: 'upsert', row: payload.new });
          } else {
            try { onTable(table, await fetchTable(table)); } catch { /* next reload catches up */ }
          }
        });
      }
      channel.subscribe((status) => onStatus?.(status));
      return () => db.removeChannel(channel);
    },
    async setScore(roundId, playerId, hole, strokes) {
      if (strokes === null) {
        must(await db.from('scores').delete().match({ round_id: roundId, player_id: playerId, hole }));
      } else {
        must(await db.from('scores').upsert({ round_id: roundId, player_id: playerId, hole, strokes, updated_at: new Date().toISOString() }));
      }
    },
    async savePlayer(player) {
      return must(await db.from('players').upsert(player).select().single());
    },
    async updatePlayers(patches) {
      await Promise.all(patches.map(({ id, ...patch }) => db.from('players').update(patch).eq('id', id).then(must)));
    },
    async deletePlayer(id) {
      must(await db.from('players').delete().eq('id', id));
    },
    async saveRound(round) {
      must(await db.from('rounds').update(round).eq('id', round.id));
    },
    async saveSettings(settings) {
      must(await db.from('settings').update({ ...settings, updated_at: new Date().toISOString() }).eq('id', 1));
    },
    async setFoursomes(roundId, groups) {
      must(await db.from('foursomes').delete().eq('round_id', roundId));
      const rows = groups.flatMap((g, i) => g.map((player_id) => ({ round_id: roundId, player_id, group_no: i + 1 })));
      if (rows.length) must(await db.from('foursomes').insert(rows));
    },
    async postMessage(playerId, body) {
      must(await db.from('messages').insert({ player_id: playerId, kind: 'chat', body }));
    },
    // Post new automatic messages (skipping any already there) and take down stale ones.
    async syncEvents(add, removeKeys) {
      if (add.length) must(await db.from('messages').upsert(add.map((m) => ({ ...m, kind: 'event' })), { onConflict: 'event_key', ignoreDuplicates: true }));
      if (removeKeys.length) must(await db.from('messages').delete().in('event_key', removeKeys));
    },
  };
}

// Browser-only stand-in so the app can be tried before the database is hooked up.
// Other tabs in the same browser stay in sync through a BroadcastChannel.
function demoStore() {
  const KEY = 'golf-trip-demo-v1';
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
  const seed = () => ({
    settings: [{ id: 1, trip_name: 'BTR Invitational', team_a_name: 'Team A', team_b_name: 'Team B', team_format: 'bestball' }],
    players: ROSTER.map((name, i) => ({ id: uid(), name, team: i % 2 === 0 ? 'A' : 'B', start_index: 0, notes: '', created_at: new Date(Date.now() + i).toISOString() })),
    rounds: COURSES.map((c, i) => ({ id: uid(), round_no: i + 1, ...c })),
    foursomes: [],
    scores: [],
    messages: [],
  });
  let data;
  try { data = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch { data = seed(); }
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(KEY) : null;
  let listeners = null;

  const persist = (table) => {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage full or blocked */ }
    channel?.postMessage({ table });
  };
  const copy = (t) => structuredClone(data[t]);

  return {
    demo: true,
    async load() {
      return Object.fromEntries(TABLES.map((t) => [t, copy(t)]));
    },
    subscribe({ onTable, onStatus }) {
      listeners = { onTable };
      const onMessage = () => {
        try { data = JSON.parse(localStorage.getItem(KEY)) || data; } catch { /* keep what we have */ }
        for (const t of TABLES) onTable(t, copy(t));
      };
      channel?.addEventListener('message', onMessage);
      onStatus?.('SUBSCRIBED');
      return () => channel?.removeEventListener('message', onMessage);
    },
    async setScore(roundId, playerId, hole, strokes) {
      data.scores = data.scores.filter((s) => !(s.round_id === roundId && s.player_id === playerId && s.hole === hole));
      if (strokes !== null) data.scores.push({ round_id: roundId, player_id: playerId, hole, strokes });
      persist('scores');
    },
    async savePlayer(player) {
      const saved = { id: uid(), created_at: new Date().toISOString(), notes: '', ...player };
      data.players = data.players.some((p) => p.id === saved.id)
        ? data.players.map((p) => (p.id === saved.id ? { ...p, ...saved } : p))
        : [...data.players, saved];
      persist('players');
      listeners?.onTable('players', copy('players'));
      return saved;
    },
    async updatePlayers(patches) {
      const byId = Object.fromEntries(patches.map((p) => [p.id, p]));
      data.players = data.players.map((p) => (byId[p.id] ? { ...p, ...byId[p.id] } : p));
      persist('players');
      listeners?.onTable('players', copy('players'));
    },
    async deletePlayer(id) {
      data.players = data.players.filter((p) => p.id !== id);
      data.scores = data.scores.filter((s) => s.player_id !== id);
      data.foursomes = data.foursomes.filter((f) => f.player_id !== id);
      persist('players');
      for (const t of ['players', 'scores', 'foursomes']) listeners?.onTable(t, copy(t));
    },
    async saveRound(round) {
      data.rounds = data.rounds.map((r) => (r.id === round.id ? { ...r, ...round } : r));
      persist('rounds');
      listeners?.onTable('rounds', copy('rounds'));
    },
    async saveSettings(settings) {
      data.settings = [{ ...data.settings[0], ...settings }];
      persist('settings');
      listeners?.onTable('settings', copy('settings'));
    },
    async setFoursomes(roundId, groups) {
      data.foursomes = data.foursomes.filter((f) => f.round_id !== roundId)
        .concat(groups.flatMap((g, i) => g.map((player_id) => ({ round_id: roundId, player_id, group_no: i + 1 }))));
      persist('foursomes');
      listeners?.onTable('foursomes', copy('foursomes'));
    },
    async postMessage(playerId, body) {
      data.messages = [...data.messages, { id: uid(), player_id: playerId, kind: 'chat', body, created_at: new Date().toISOString() }];
      persist('messages');
      listeners?.onTable('messages', copy('messages'));
    },
    async syncEvents(add, removeKeys) {
      const have = new Set(data.messages.map((m) => m.event_key));
      const fresh = add.filter((m) => !have.has(m.event_key)).map((m) => ({ id: uid(), kind: 'event', created_at: new Date().toISOString(), ...m }));
      data.messages = [...data.messages.filter((m) => !removeKeys.includes(m.event_key)), ...fresh];
      persist('messages');
      listeners?.onTable('messages', copy('messages'));
    },
  };
}
