// Runs in the phone's browser: looks a course up in OpenStreetMap, and saves
// satellite map pictures ahead of time for when there's no signal.
import { overpassQuery, parseOverpass } from './geo.js';
import { TILE_URL } from '../HoleMap.jsx';

const OVERPASS = 'https://overpass-api.de/api/interpreter';

// The words OpenStreetMap most likely uses for each course's name.
export function courseRegex(name) {
  const n = name.toLowerCase();
  if (n.includes('world tour')) return 'World Tour';
  if (n.includes('south creek') || n.includes('southcreek')) return 'South ?Creek';
  if (n.includes('king')) return "King.?s North";
  if (n.includes('arrowhead')) return 'Arrowhead';
  return name.replace(/[^a-z0-9 ]/gi, '').split(' ').slice(0, 2).join(' ');
}

export async function lookUpCourse(round) {
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(overpassQuery(courseRegex(round.name)))}`,
  });
  if (!res.ok) throw new Error(`map lookup failed (${res.status})`);
  return parseOverpass(await res.json());
}

// Puts the found tees and greens onto the round's holes. Holes it didn't
// find keep whatever pins they already had.
export function mergeLookup(holes, found) {
  return holes.map((h, i) => (found.holes[i + 1] ? { ...h, ...found.holes[i + 1] } : h));
}

function tileXY(lat, lng, z) {
  const n = 2 ** z;
  const r = (lat * Math.PI) / 180;
  return {
    x: Math.floor(((lng + 180) / 360) * n),
    y: Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n),
  };
}

// Every map picture covering each mapped hole (plus a margin), zoom 16-19.
export function tileUrls(holes) {
  const urls = new Set();
  const pad = 0.0012; // about 130 yards
  for (const h of holes) {
    const pts = [h.tee, h.green].filter(Boolean);
    if (!pts.length) continue;
    const lats = pts.map((p) => p.lat), lngs = pts.map((p) => p.lng);
    const box = { n: Math.max(...lats) + pad, s: Math.min(...lats) - pad, e: Math.max(...lngs) + pad, w: Math.min(...lngs) - pad };
    for (let z = 16; z <= 19; z++) {
      const a = tileXY(box.n, box.w, z), b = tileXY(box.s, box.e, z);
      for (let x = a.x; x <= b.x; x++) for (let y = a.y; y <= b.y; y++) {
        urls.add(TILE_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y));
      }
    }
  }
  return [...urls];
}

// Downloads the pictures so the service worker keeps them for offline use.
export async function saveMapsOffline(holes, onProgress) {
  const urls = tileUrls(holes);
  let done = 0;
  const queue = [...urls];
  const worker = async () => {
    while (queue.length) {
      const url = queue.shift();
      try { await fetch(url, { mode: 'no-cors' }); } catch { /* skip, try the rest */ }
      onProgress?.(++done, urls.length);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return urls.length;
}
