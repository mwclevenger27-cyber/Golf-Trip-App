import { useEffect, useRef, useState } from 'react';
import HoleMap from './HoleMap.jsx';
import { greenYardages, distanceYards } from './lib/geo.js';
import { lookUpCourse, mergeLookup, saveMapsOffline } from './lib/courseLookup.js';
import { useGps } from './useGps.js';

// Full-screen hole map with big yardages, plus the one-time pin setup.
export default function MapSheet({ round, hole, setHole, gps: sharedGps, api, onClose }) {
  const ownGps = useGps(!sharedGps);
  const gps = sharedGps || ownGps;
  const [setup, setSetup] = useState(false);
  const [step, setStep] = useState('green');
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const h = round.holes[hole];
  const mapped = round.holes.filter((x) => x.green).length;
  const near = gps.pos && h.green && distanceYards(gps.pos, h.green) < 700;
  const y = greenYardages(near ? gps.pos : h.tee, h);
  const anyPin = round.holes.find((x) => x.green || x.tee);
  const fallbackCenter = anyPin ? anyPin.green || anyPin.tee : null;

  // Latest pins, so a quick green-then-tee tap never saves over the green.
  const holesRef = useRef(round.holes);
  useEffect(() => { holesRef.current = round.holes; }, [round.holes]);
  const saveHole = (patch) => {
    holesRef.current = holesRef.current.map((x, i) => (i === hole ? { ...x, ...patch } : x));
    return api.saveRound({ id: round.id, holes: holesRef.current });
  };

  const onTap = (p) => {
    if (step === 'green') {
      saveHole({ green: p, green_shape: undefined });
      setStep('tee');
    } else {
      saveHole({ tee: p });
      setStep('green');
      if (hole < 17) setHole(hole + 1);
    }
  };

  const autoFind = async () => {
    setBusy('Looking up the course…');
    setNote('');
    try {
      const found = await lookUpCourse(round);
      const count = Object.keys(found.holes).length;
      if (count) {
        holesRef.current = mergeLookup(holesRef.current, found);
        await api.saveRound({ id: round.id, holes: holesRef.current });
      }
      setNote(count === 18
        ? 'Found all 18 holes. Flip through and check the flags look right.'
        : count
          ? `Found ${count} of 18 holes. Tap "Set pins" to place the rest.`
          : "Couldn't find this course's holes in the public map. Use \"Set pins\" to place them, about 10 minutes.");
    } catch (e) {
      setNote(`Lookup didn't work (${e.message}). Check your connection, or place pins by hand.`);
    }
    setBusy('');
  };

  const offline = async () => {
    setBusy('Saving maps…');
    const n = await saveMapsOffline(round.holes, (d, t) => setBusy(`Saving maps… ${Math.round((d / t) * 100)}%`));
    setBusy('');
    setNote(n ? `Saved ${n} map pictures. This course works without signal now.` : 'Set some pins first, then save.');
  };

  return (
    <div className="map-screen">
      <div className="map-top">
        <button className="map-close" onClick={onClose} aria-label="Close map">✕</button>
        <div className="map-hole">
          <div className="num">Hole {hole + 1}</div>
          <div className="meta">Par {h.par} · Hcp {h.si}</div>
        </div>
        {y && !setup ? (
          <div className="yards">
            <div><span>Front</span><b>{y.front}</b></div>
            <div className="mid"><span>Middle</span><b>{y.middle}</b></div>
            <div><span>Back</span><b>{y.back}</b></div>
          </div>
        ) : <div className="yards" />}
      </div>

      <HoleMap hole={h} holeNo={hole} gps={gps} setup={setup} onTap={onTap} fallbackCenter={fallbackCenter} />

      <div className="map-bottom">
        {setup && (
          <div className="map-instr">
            {step === 'green' ? `Tap the middle of the green on hole ${hole + 1}` : `Now tap the tee on hole ${hole + 1} (or skip)`}
          </div>
        )}
        {!setup && y && (
          <div className="map-instr small">
            {near ? `From you${gps.accuracy ? ` (±${gps.accuracy} yds)` : ''}` : h.tee ? 'From the tee. You\'re not on this hole yet' : 'Turn on location to measure from you'}
            {y.estimated ? ' · front/back estimated' : ''} · tap the map to measure a layup
          </div>
        )}
        {!setup && !h.green && <div className="map-instr">No flag for this hole yet. Tap "Set pins" to place it, or "Find holes" to look the course up.</div>}
        {gps.error && !setup && <div className="map-instr small">{gps.error}</div>}
        {(busy || note) && <div className="map-instr small">{busy || note}</div>}
        <div className="map-actions">
          <button className="btn" onClick={() => setHole(Math.max(0, hole - 1))} disabled={hole === 0}>‹</button>
          {setup ? (
            <>
              {step === 'tee' && <button className="btn" onClick={() => { setStep('green'); if (hole < 17) setHole(hole + 1); }}>Skip tee</button>}
              <button className="btn btn-primary" onClick={() => { setSetup(false); setStep('green'); }}>Done</button>
            </>
          ) : (
            <>
              <button className="btn" onClick={() => setSetup(true)}>Set pins</button>
              {mapped < 18 && <button className="btn" onClick={autoFind} disabled={!!busy}>Find holes</button>}
              {mapped > 0 && <button className="btn" onClick={offline} disabled={!!busy}>Save offline</button>}
            </>
          )}
          <button className="btn" onClick={() => setHole(Math.min(17, hole + 1))} disabled={hole === 17}>›</button>
        </div>
      </div>
    </div>
  );
}
