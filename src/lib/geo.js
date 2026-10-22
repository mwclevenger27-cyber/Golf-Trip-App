// GPS math and course map data. Points are { lat, lng }.

const EARTH_M = 6371000;
const M_TO_YD = 1.09361;
const rad = (d) => (d * Math.PI) / 180;

export function distanceYards(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.sqrt(h)) * M_TO_YD;
}

// A typical green is about 30 yards deep, so without its outline we call the
// front and back 12 yards either side of the middle.
const HALF_GREEN_YD = 12;

// Front / middle / back yardages from where you're standing to a hole's green.
// With the green's outline (from public map data) front and back are the
// nearest and farthest edge; otherwise they're estimated.
export function greenYardages(from, hole) {
  if (!from || !hole?.green) return null;
  const middle = distanceYards(from, hole.green);
  const shape = hole.green_shape;
  if (shape?.length >= 3) {
    const pts = densify(shape);
    const ds = pts.map((p) => distanceYards(from, p));
    return { front: Math.round(Math.min(...ds)), middle: Math.round(middle), back: Math.round(Math.max(...ds)), estimated: false };
  }
  return { front: Math.round(Math.max(0, middle - HALF_GREEN_YD)), middle: Math.round(middle), back: Math.round(middle + HALF_GREEN_YD), estimated: true };
}

// Add points along each edge so the nearest edge isn't missed between corners.
function densify(shape, steps = 4) {
  const out = [];
  for (let i = 0; i < shape.length; i++) {
    const a = shape[i];
    const b = shape[(i + 1) % shape.length];
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      out.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });
    }
  }
  return out;
}

export function centroid(points) {
  const n = points.length;
  return { lat: points.reduce((s, p) => s + p.lat, 0) / n, lng: points.reduce((s, p) => s + p.lng, 0) / n };
}

function insidePolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.lat > p.lat) !== (b.lat > p.lat) && p.lng < ((b.lng - a.lng) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lng) inside = !inside;
  }
  return inside;
}

// Box around Myrtle Beach that the course lookup searches in.
const AREA = '33.45,-79.35,34.05,-78.55';

// OpenStreetMap query for a course by name: the course outline, each hole's
// line of play (tee to green, tagged with its number) and every green outline.
export function overpassQuery(nameRegex) {
  return `[out:json][timeout:25];
(way["leisure"="golf_course"]["name"~"${nameRegex}",i](${AREA});relation["leisure"="golf_course"]["name"~"${nameRegex}",i](${AREA});)->.c;
.c out center tags;
.c map_to_area->.a;
(way["golf"="hole"](area.a);way["golf"="green"](area.a););
out geom tags;`;
}

// Turns an Overpass answer into { center, holes: { 1: { tee, green, green_shape }, ... }, duplicates }.
// A hole number that shows up more than once (27-hole clubs, or several
// courses sharing one outline) is listed in duplicates and left out.
export function parseOverpass(json) {
  const els = json?.elements || [];
  const course = els.find((e) => e.tags?.leisure === 'golf_course');
  const center = course?.center ? { lat: course.center.lat, lng: course.center.lon } : null;
  const toPts = (geom) => (geom || []).map((g) => ({ lat: g.lat, lng: g.lon }));
  const greens = els.filter((e) => e.tags?.golf === 'green' && e.geometry).map((e) => toPts(e.geometry));
  const byRef = {};
  for (const e of els) {
    if (e.tags?.golf !== 'hole' || !e.geometry?.length) continue;
    const ref = parseInt(e.tags.ref, 10);
    if (!(ref >= 1 && ref <= 18)) continue;
    (byRef[ref] ??= []).push(toPts(e.geometry));
  }
  const holes = {};
  const duplicates = [];
  for (const [ref, lines] of Object.entries(byRef)) {
    if (lines.length > 1) { duplicates.push(Number(ref)); continue; }
    const line = lines[0];
    const end = line[line.length - 1];
    const shape = greens.find((g) => insidePolygon(end, g))
      || greens.map((g) => ({ g, d: distanceYards(end, centroid(g)) })).filter((x) => x.d < 45).sort((a, b) => a.d - b.d)[0]?.g;
    holes[ref] = {
      tee: line[0],
      green: shape ? centroid(shape) : end,
      ...(shape ? { green_shape: shape.map((p) => ({ lat: round6(p.lat), lng: round6(p.lng) })) } : {}),
    };
  }
  return { center, holes, duplicates: duplicates.sort((a, b) => a - b) };
}

const round6 = (n) => Math.round(n * 1e6) / 1e6;
