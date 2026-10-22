import { toParLabel, played, cardFor } from './lib/golf.js';

export function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0].toUpperCase()).join('');
}

export function Avatar({ player, size = 36 }) {
  return (
    <div className={`avatar ${player?.team === 'B' ? 'b' : ''}`} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials(player?.name)}
    </div>
  );
}

export function ToPar({ value, className = '' }) {
  const cls = value < 0 ? 'under' : value > 0 ? 'over' : 'even';
  return <span className={`${cls} ${className}`}>{toParLabel(value)}</span>;
}

export function TeamPill({ team, settings }) {
  return <span className={`pill ${team === 'A' ? 'pill-a' : 'pill-b'}`}>{teamName(team, settings)}</span>;
}

export function teamName(team, settings) {
  return team === 'A' ? settings.team_a_name || 'Team A' : settings.team_b_name || 'Team B';
}

export function Sheet({ title, onClose, children }) {
  return (
    <div className="sheet-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-label={title}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

// Round to show by default: today's round, else the first one not finished, else the first.
export function defaultRoundId(trip) {
  const today = new Date().toLocaleDateString('en-CA');
  const todays = trip.rounds.filter((r) => r.play_date === today);
  const unfinished = (r) => trip.players.some((p) => !cardFor(trip.scoreMap, r.id, p.id).every(played));
  const pick = todays.find(unfinished) || todays[0] || trip.rounds.find(unfinished) || trip.rounds[0];
  return pick?.id;
}

export function formatIndex(n) {
  return n < 0 ? `+${Math.abs(n).toFixed(1)}` : Number(n).toFixed(1);
}

// Course art for each round.
const COURSE_ART = { 1: '/courses/r1.jpg', 2: '/courses/r2.jpg', 3: '/courses/r3.jpg', 4: '/courses/r4.jpg' };
export function CourseArt({ round }) {
  const src = COURSE_ART[round?.round_no];
  return src ? <img className="course-art" src={src} alt={`${round.name} course map`} loading="lazy" /> : null;
}
