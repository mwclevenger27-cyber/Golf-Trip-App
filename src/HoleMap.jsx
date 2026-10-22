import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { distanceYards } from './lib/geo.js';

export const TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const MYRTLE = [33.72, -78.92];

const dot = (cls, html = '') => L.divIcon({ className: '', html: `<div class="${cls}">${html}</div>`, iconSize: [0, 0] });
const label = (text) => L.divIcon({ className: '', html: `<div class="map-label">${text}</div>`, iconSize: [0, 0] });
const mid = (a, b) => ({ lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 });

// Satellite view of one hole: tee, green, you, and a line to the green.
// Tap anywhere to measure: you → that spot → green, like a layup planner.
// In setup mode a tap is handed to onTap instead, to place pins.
export default function HoleMap({ hole, holeNo, gps, setup, onTap, fallbackCenter }) {
  const el = useRef(null);
  const map = useRef(null);
  const layers = useRef(null);
  const tapRef = useRef(null);
  const target = useRef(null);
  const props = useRef({});
  props.current = { setup, onTap };

  useEffect(() => {
    const m = L.map(el.current, { zoomControl: false, attributionControl: true, tap: true }).setView(MYRTLE, 13);
    L.tileLayer(TILE_URL, { maxNativeZoom: 19, maxZoom: 20, attribution: 'Imagery © Esri' }).addTo(m);
    layers.current = L.layerGroup().addTo(m);
    tapRef.current = L.layerGroup().addTo(m);
    m.on('click', (e) => {
      const p = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (props.current.setup) props.current.onTap?.(p);
      else { target.current = p; props.current.draw(); }
    });
    map.current = m;
    // The map's box settles after the screen opens; tell Leaflet when it does.
    const ro = new ResizeObserver(() => { m.invalidateSize(); frame(); });
    ro.observe(el.current);
    return () => { ro.disconnect(); m.remove(); };
  }, []);

  // Frame the hole whenever it changes.
  const holeKey = hole ? `${hole.green?.lat},${hole.tee?.lat}` : '';
  const frameRef = useRef(null);
  frameRef.current = () => {
    const m = map.current;
    if (!m) return;
    const pts = [hole?.tee, hole?.green].filter(Boolean);
    if (pts.length === 2) m.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lng])), { padding: [50, 70], maxZoom: 19 });
    else if (pts.length === 1) m.setView([pts[0].lat, pts[0].lng], 18);
    else if (gps?.pos) m.setView([gps.pos.lat, gps.pos.lng], 17);
    else if (fallbackCenter) m.setView([fallbackCenter.lat, fallbackCenter.lng], 16);
  };
  const frame = () => frameRef.current();
  // New hole: frame it. New pins on the same hole: reframe, except while
  // placing pins, where jumping around would make the next tap miss.
  useEffect(() => {
    target.current = null;
    frame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holeNo]);
  useEffect(() => {
    if (!props.current.setup) frame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holeKey]);

  function draw() {
    const g = layers.current;
    const t = tapRef.current;
    if (!g) return;
    g.clearLayers();
    t.clearLayers();
    if (hole?.green_shape) L.polygon(hole.green_shape.map((p) => [p.lat, p.lng]), { color: '#E8D9AE', weight: 2, fillOpacity: 0.12 }).addTo(g);
    if (hole?.tee) L.marker([hole.tee.lat, hole.tee.lng], { icon: dot('map-tee') }).addTo(g);
    if (hole?.green) L.marker([hole.green.lat, hole.green.lng], { icon: dot('map-flag', '⛳') }).addTo(g);
    const me = gps?.pos;
    if (me) {
      if (gps.accuracy) L.circle([me.lat, me.lng], { radius: gps.accuracy / 1.09361, color: '#4da3ff', weight: 1, fillOpacity: 0.1 }).addTo(g);
      L.marker([me.lat, me.lng], { icon: dot('map-me') }).addTo(g);
    }
    const from = me && hole?.green && distanceYards(me, hole.green) < 700 ? me : hole?.tee;
    const tap = target.current;
    if (!setup && tap && from && hole?.green) {
      L.polyline([[from.lat, from.lng], [tap.lat, tap.lng], [hole.green.lat, hole.green.lng]], { color: '#fff', weight: 2, dashArray: '4 6' }).addTo(t);
      L.marker([tap.lat, tap.lng], { icon: dot('map-target') }).addTo(t);
      L.marker([mid(from, tap).lat, mid(from, tap).lng], { icon: label(`${Math.round(distanceYards(from, tap))}`) }).addTo(t);
      L.marker([mid(tap, hole.green).lat, mid(tap, hole.green).lng], { icon: label(`${Math.round(distanceYards(tap, hole.green))}`) }).addTo(t);
    } else if (!setup && from && hole?.green) {
      L.polyline([[from.lat, from.lng], [hole.green.lat, hole.green.lng]], { color: '#fff', weight: 2, opacity: 0.8 }).addTo(t);
    }
  }

  props.current.draw = draw;
  useEffect(draw);

  return <div ref={el} className="hole-map" />;
}
