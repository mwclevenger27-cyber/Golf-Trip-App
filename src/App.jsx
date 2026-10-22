import { useEffect, useState } from 'react';
import { useTrip } from './useTrip.js';
import { Sheet } from './ui.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import Score from './pages/Score.jsx';
import Players from './pages/Players.jsx';
import Trip from './pages/Trip.jsx';
import Chat from './pages/Chat.jsx';

const ME_KEY = 'golf-trip-me';
const TAB_KEY = 'golf-trip-tab';
const SEEN_KEY = 'golf-trip-chat-seen';

const TABS = [
  { id: 'board', label: 'Leaderboard', icon: <path d="M4 20V11M12 20V4M20 20v-6" /> },
  { id: 'score', label: 'Score', icon: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h4" /></> },
  { id: 'chat', label: 'Chat', icon: <path d="M4 5h16v11H9l-5 4V5Z" /> },
  { id: 'players', label: 'Players', icon: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5a3 3 0 0 1 0 6M21 20c0-2.6-1.7-4.8-4-5.6" /></> },
  { id: 'trip', label: 'Trip', icon: <path d="M7 21V4l11 4-11 4" /> },
];

function load(key, fallback) {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, value); } catch { /* private mode */ }
}

export default function App() {
  const api = useTrip();
  const { trip, demo, loadError, live, pendingCount, reload } = api;
  const [tab, setTab] = useState(() => load(TAB_KEY, 'board'));
  const [meId, setMeId] = useState(() => load(ME_KEY, ''));
  const [pickingMe, setPickingMe] = useState(false);

  useEffect(() => save(TAB_KEY, tab), [tab]);
  const me = trip?.players.find((p) => p.id === meId);
  useEffect(() => {
    if (trip && trip.players.length && !me) setPickingMe(true);
  }, [trip, me]);

  const chooseMe = (id) => {
    setMeId(id);
    save(ME_KEY, id);
    setPickingMe(false);
  };

  // Unread chat count for the tab badge, remembered per phone.
  const [seen, setSeen] = useState(() => load(SEEN_KEY, ''));
  const latest = trip?.messages.at(-1)?.created_at || '';
  useEffect(() => {
    if (tab === 'chat' && latest && latest !== seen) {
      setSeen(latest);
      save(SEEN_KEY, latest);
    }
  }, [tab, latest, seen]);
  const unread = tab === 'chat' ? 0 : (trip?.messages || []).filter((m) => m.created_at > seen && m.player_id !== meId).length;

  const settings = trip?.settings || {};
  const page = { trip, api, me, meId };

  return (
    <>
      <header className="top">
        <div className="top-inner">
          <div>
            <div className="eyebrow">
              <span className={`live-dot ${live ? '' : 'off'}`} />
              {demo ? 'Demo mode' : live ? 'Live' : 'Connecting'}
            </div>
            <div className="trip-name">{settings.trip_name || 'The Trip'}</div>
          </div>
          {trip && (
            <button className="me-btn" onClick={() => setPickingMe(true)}>
              {me ? me.name.split(' ')[0] : 'Who are you?'}
            </button>
          )}
        </div>
      </header>

      {demo && (
        <div className="banner">
          Demo mode: scores only save on this device until the database is connected.
        </div>
      )}
      {loadError && (
        <div className="banner error">
          Can't reach the scores right now ({loadError}). Nothing is lost.
          <button className="btn btn-sm" onClick={reload}>Try again</button>
        </div>
      )}
      {pendingCount > 0 && !loadError && (
        <div className="banner">
          {pendingCount} score{pendingCount === 1 ? '' : 's'} waiting for signal. They'll send automatically.
        </div>
      )}

      <main className="wrap">
        {!trip ? (
          <div className="empty">{loadError ? 'Waiting for a connection…' : 'Loading the trip…'}</div>
        ) : tab === 'board' ? (
          <Leaderboard {...page} />
        ) : tab === 'score' ? (
          <Score {...page} />
        ) : tab === 'chat' ? (
          <Chat {...page} onPickMe={() => setPickingMe(true)} />
        ) : tab === 'players' ? (
          <Players {...page} onChooseMe={chooseMe} />
        ) : (
          <Trip {...page} />
        )}
      </main>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            <svg viewBox="0 0 24 24">{t.icon}</svg>
            {t.id === 'chat' && unread > 0 && <span className="badge">{unread > 99 ? '99+' : unread}</span>}
            {t.label}
          </button>
        ))}
      </nav>

      {pickingMe && trip && (
        <Sheet title="Who are you?" onClose={() => me && setPickingMe(false)}>
          <p className="muted" style={{ marginTop: -6 }}>Pick your name so the app opens to your group and highlights you.</p>
          <div className="pick-list">
            {trip.players.map((p) => (
              <button key={p.id} className={`btn ${p.id === meId ? 'btn-primary' : ''}`} onClick={() => chooseMe(p.id)}>
                {p.name}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </>
  );
}
