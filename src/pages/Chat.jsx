import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../ui.jsx';

function timeLabel(iso) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return sameDay ? time : `${d.toLocaleDateString([], { weekday: 'short' })} ${time}`;
}

export default function Chat({ trip, api, me, onPickMe }) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottom = useRef(null);
  const byId = Object.fromEntries(trip.players.map((p) => [p.id, p]));
  const messages = trip.messages;

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const send = async (e) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !me) return;
    setSending(true);
    setError('');
    try {
      await api.postMessage(me.id, body.slice(0, 1000));
      setDraft('');
    } catch (err) {
      setError(`Didn't send: ${err.message}. Check your signal and try again.`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="chat">
      {messages.map((m, i) => {
        const who = byId[m.player_id];
        if (m.kind === 'event') {
          return (
            <div key={m.id} className="chat-event">
              <span>{m.body}</span>
              <span className="chat-time">{timeLabel(m.created_at)}</span>
            </div>
          );
        }
        const mine = me && m.player_id === me.id;
        const prev = messages[i - 1];
        const grouped = prev && prev.kind === 'chat' && prev.player_id === m.player_id
          && new Date(m.created_at) - new Date(prev.created_at) < 5 * 60 * 1000;
        return (
          <div key={m.id} className={`chat-msg ${mine ? 'mine' : ''} ${grouped ? 'grouped' : ''}`}>
            {!mine && <div className="chat-av">{!grouped && <Avatar player={who} size={30} />}</div>}
            <div>
              {!grouped && !mine && <div className="chat-name">{who?.name || 'Someone'}</div>}
              <div className="bubble">{m.body}</div>
              {!grouped && <div className="chat-time">{timeLabel(m.created_at)}</div>}
            </div>
          </div>
        );
      })}
      <div ref={bottom} />

      <form className="chat-input" onSubmit={send}>
        {me ? (
          <>
            <input
              className="inp"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Say something, ${me.name.split(' ')[0]}…`}
              maxLength={1000}
              enterKeyHint="send"
            />
            <button className="btn btn-primary" disabled={sending || !draft.trim()}>Send</button>
          </>
        ) : (
          <button type="button" className="btn btn-primary btn-block" onClick={onPickMe}>Pick your name to start chatting</button>
        )}
      </form>
      {error && <div className="warn">{error}</div>}
    </div>
  );
}
