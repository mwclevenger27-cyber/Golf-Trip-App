import { describe, it, expect } from 'vitest';
import { distanceYards, greenYardages, parseOverpass } from './geo.js';

// One degree of latitude is about 121,600 yards.
const YD = 1 / 121605;
const at = (north, east = 0) => ({ lat: 33.7 + north * YD, lng: -78.9 + (east * YD) / Math.cos((33.7 * Math.PI) / 180) });

describe('distanceYards', () => {
  it('measures 150 yards north', () => {
    expect(distanceYards(at(0), at(150))).toBeCloseTo(150, 0);
  });
  it('measures a 3-4-5 triangle', () => {
    expect(distanceYards(at(0), at(120, 90))).toBeCloseTo(150, 0);
  });
});

describe('greenYardages', () => {
  const me = at(0);
  it('estimates front and back without an outline', () => {
    const y = greenYardages(me, { green: at(150) });
    expect(y).toMatchObject({ front: 138, middle: 150, back: 162, estimated: true });
  });
  it('uses the green outline when there is one', () => {
    const shape = [at(140, -10), at(140, 10), at(165, 10), at(165, -10)];
    const y = greenYardages(me, { green: at(152), green_shape: shape });
    expect(y.front).toBe(140);
    expect(y.back).toBeGreaterThanOrEqual(165);
    expect(y.estimated).toBe(false);
  });
  it('returns nothing without a location', () => {
    expect(greenYardages(null, { green: at(1) })).toBeNull();
    expect(greenYardages(me, {})).toBeNull();
  });
});

describe('parseOverpass', () => {
  const geom = (pts) => pts.map((p) => ({ lat: p.lat, lon: p.lng }));
  const json = {
    elements: [
      { type: 'way', id: 1, tags: { leisure: 'golf_course', name: 'Test GC' }, center: { lat: 33.7, lon: -78.9 } },
      { type: 'way', id: 2, tags: { golf: 'hole', ref: '1', par: '4' }, geometry: geom([at(0), at(200), at(380)]) },
      { type: 'way', id: 3, tags: { golf: 'green' }, geometry: geom([at(370, -10), at(370, 10), at(392, 10), at(392, -10), at(370, -10)]) },
      { type: 'way', id: 4, tags: { golf: 'hole', ref: '2' }, geometry: geom([at(400), at(560)]) },
      { type: 'way', id: 5, tags: { golf: 'hole', ref: '3' }, geometry: geom([at(0, 300), at(100, 300)]) },
      { type: 'way', id: 6, tags: { golf: 'hole', ref: '3' }, geometry: geom([at(0, 600), at(100, 600)]) },
    ],
  };
  const out = parseOverpass(json);
  it('reads the course center', () => {
    expect(out.center).toEqual({ lat: 33.7, lng: -78.9 });
  });
  it('matches a hole to the green its line ends on', () => {
    expect(out.holes[1].green_shape).toHaveLength(5);
    expect(distanceYards(out.holes[1].tee, at(0))).toBeLessThan(1);
    expect(distanceYards(out.holes[1].green, at(381))).toBeLessThan(5);
  });
  it('falls back to the end of the line when no green is mapped', () => {
    expect(distanceYards(out.holes[2].green, at(560))).toBeLessThan(1);
    expect(out.holes[2].green_shape).toBeUndefined();
  });
  it('skips hole numbers that appear twice', () => {
    expect(out.holes[3]).toBeUndefined();
    expect(out.duplicates).toEqual([3]);
  });
});
