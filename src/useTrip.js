import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createStore } from './lib/store.js';
import { buildScoreMap, handicapHistory, sortRounds } from './lib/golf.js';

const PENDING_KEY = 'golf-trip-pending-scores';
const keyOf = (r, p, h) => `${r}|${p}|${h}`;

function readPending() {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY)) || {}; } catch { return {}; }
}
function writePending(pending) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(pending)); } catch { /* blocked storage */ }
}

// Loads the whole trip, keeps it live, and saves scores one hole at a time.
// Scores that fail to save (bad signal on the course) wait in this phone's
// storage and are retried until they go through. Nothing is ever overwritten
// with a blank trip: if loading fails we show an error and try again.
export function useTrip() {
  const store = useMemo(() => createStore(), []);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [live, setLive] = useState(false);
  const [pending, setPending] = useState(readPending);
  const pendingRef = useRef(pending);
  const flushing = useRef(false);

  const updatePending = (fn) => {
    pendingRef.current = fn(pendingRef.current);
    writePending(pendingRef.current);
    setPending(pendingRef.current);
  };

  const reload = useCallback(async () => {
    try {
      const fresh = await store.load();
      setData(fresh);
      setLoadError(null);
    } catch (e) {
      setLoadError(e.message || 'Could not reach the database');
    }
  }, [store]);

  const applyScore = useCallback((type, row) => setData((d) => {
    if (!d) return d;
    const rest = d.scores.filter((s) => !(s.round_id === row.round_id && s.player_id === row.player_id && s.hole === row.hole));
    return { ...d, scores: type === 'delete' ? rest : [...rest, row] };
  }), []);

  useEffect(() => {
    reload();
    const unsubscribe = store.subscribe({
      onScore: ({ type, row }) => applyScore(type, row),
      onTable: (table, rows) => setData((d) => (d ? { ...d, [table]: rows } : d)),
      onStatus: (status) => {
        setLive(status === 'SUBSCRIBED');
        // Catch up on anything missed while the connection was down.
        if (status === 'SUBSCRIBED') reload();
      },
    });
    const wake = () => document.visibilityState === 'visible' && reload();
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', reload);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', reload);
    };
  }, [store, reload, applyScore]);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      for (const [key, strokes] of Object.entries(pendingRef.current)) {
        const [r, p, h] = key.split('|');
        try {
          await store.setScore(r, p, Number(h), strokes);
          // Put the saved score into our copy now rather than waiting for the live echo.
          applyScore(strokes === null ? 'delete' : 'upsert', { round_id: r, player_id: p, hole: Number(h), strokes });
          // Only clear it if nobody changed this hole again while we were saving.
          updatePending((cur) => {
            if (cur[key] !== strokes) return cur;
            const { [key]: _, ...rest } = cur;
            return rest;
          });
        } catch {
          break; // still offline; try again on the next tick
        }
      }
    } finally {
      flushing.current = false;
    }
  }, [store, applyScore]);

  useEffect(() => {
    if (!Object.keys(pending).length) return;
    const t = setTimeout(flush, 300);
    const retry = setInterval(flush, 5000);
    return () => { clearTimeout(t); clearInterval(retry); };
  }, [pending, flush]);

  const setScore = useCallback((roundId, playerId, hole, strokes) => {
    updatePending((cur) => ({ ...cur, [keyOf(roundId, playerId, hole)]: strokes }));
  }, []);

  // Scores as everyone sees them, with this phone's unsaved ones laid on top.
  const derived = useMemo(() => {
    if (!data) return null;
    const scores = data.scores.filter((s) => !(keyOf(s.round_id, s.player_id, s.hole) in pending));
    for (const [key, strokes] of Object.entries(pending)) {
      if (strokes === null) continue;
      const [round_id, player_id, h] = key.split('|');
      scores.push({ round_id, player_id, hole: Number(h), strokes });
    }
    const rounds = sortRounds(data.rounds);
    const scoreMap = buildScoreMap(scores);
    const indexes = Object.fromEntries(data.players.map((p) => [p.id, handicapHistory(p, rounds, scoreMap)]));
    return {
      settings: data.settings[0] || {},
      players: data.players,
      rounds,
      foursomes: data.foursomes,
      messages: data.messages,
      scores,
      scoreMap,
      indexes,
    };
  }, [data, pending]);

  // Run a change, then refresh so this phone sees it even if the live update is slow.
  const act = (fn) => async (...args) => {
    const result = await fn(...args);
    reload();
    return result;
  };

  return {
    trip: derived,
    demo: store.demo,
    loadError,
    live,
    pendingCount: Object.keys(pending).length,
    reload,
    setScore,
    savePlayer: act(store.savePlayer),
    deletePlayer: act(store.deletePlayer),
    saveRound: act(store.saveRound),
    saveSettings: act(store.saveSettings),
    setFoursomes: act(store.setFoursomes),
  };
}
