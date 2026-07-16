import { useState, useEffect, useCallback, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from './lib/supabase'
import HuntSelectionScreen from './HuntSelectionScreen'

// ── Question variety helpers ──────────────────────────────────────────────────
// Persist seen question IDs per user in localStorage so repeated play sessions
// get different questions. Capped at 500 IDs to avoid storage bloat.
function getSeenQuestionIds(userId) {
  try {
    const raw = localStorage.getItem('mtm_seen_' + userId)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function markQuestionsSeenLocal(userId, ids) {
  if (!ids.length) return
  try {
    const existing = getSeenQuestionIds(userId)
    const merged = [...new Set([...existing, ...ids])]
    localStorage.setItem('mtm_seen_' + userId, JSON.stringify(merged.slice(-500)))
  } catch {}
}
// ─────────────────────────────────────────────────────────────────────────────

//  Haversine distance
function haversineMetres(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function bearingDegrees(lat1, lon1, lat2, lon2) {
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const lat1r = (lat1 * Math.PI) / 180
  const lat2r = (lat2 * Math.PI) / 180
  const y = Math.sin(dLon) * Math.cos(lat2r)
  const x = Math.cos(lat1r) * Math.sin(lat2r) - Math.sin(lat1r) * Math.cos(lat2r) * Math.cos(dLon)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function diffGeofence(difficulty) {
  return { casual: 25, classic: 15, expert: 10, cipher: 15 }[difficulty] || 15
}

function formatCountdown(endsAt) {
  if (!endsAt) return null
  const diff = new Date(endsAt) - Date.now()
  if (!isFinite(diff) || diff <= 0) return 'ENDED'
  const days  = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins  = Math.floor((diff % 3600000) / 60000)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

function fmtPounds(pence, fallbackPounds) {
  if (pence != null) return '£' + Math.floor(pence / 100).toLocaleString('en-GB')
  if (fallbackPounds != null) return '£' + Math.floor(fallbackPounds).toLocaleString('en-GB')
  return '£0'
}


function fmtDistance(m) {
  const km = m / 1000
  if (km < 0.05) return `${Math.round(m)} m`
  return `${km.toFixed(1)} km`
}

// accent_color stored without '#' in DB
function hexAccent(raw) {
  if (!raw) return '#7C3AED'
  return raw.startsWith('#') ? raw : '#' + raw
}

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return `rgba(${r},${g},${b},${alpha})`
}

// Temperature layer — deep blue -> purple -> gold, deliberately its own axis
// from the heading system's green/red (see CompassScreen: headingColor).
// Bands are the spec's as-given estimates, not calibrated against real hunt
// data yet — retune after a real-world walk-test.
const TEMPERATURE_TIERS = [
  { max: 20,  key: 'burning', label: 'BURNING HOT!',   color: '#FCD34D', fillPct: 1.00 },
  { max: 50,  key: 'hot',     label: 'HOT',            color: '#F59E0B', fillPct: 0.80 },
  { max: 150, key: 'warm',    label: 'WARM',            color: '#C97BD1', fillPct: 0.60 },
  { max: 400, key: 'warmer',  label: 'GETTING WARMER',  color: '#9D6FFF', fillPct: 0.40 },
  { max: 800, key: 'cold',    label: 'COLD',             color: '#5B5BD6', fillPct: 0.20 },
  { max: Infinity, key: 'freezing', label: 'FREEZING COLD', color: '#2563EB', fillPct: 0.05 },
]
function getTemperatureTier(distanceM) {
  if (distanceM == null) return null
  return TEMPERATURE_TIERS.find(t => distanceM < t.max)
}

// Mercury thermometer icon for the temperature phrase — glass stays a fixed
// neutral colour, only the mercury uses tempTier.color, so there's one
// colour signal across the phrase text/glow/icon instead of a second,
// disconnected one (replaces the old per-tier emoji set).
function ThermometerIcon({ fillPct, color, size = 34 }) {
  const clamped = Math.max(0, Math.min(1, fillPct))
  const innerTop = 14, innerBottom = 80
  const mercuryHeight = clamped * (innerBottom - innerTop)
  const mercuryY = innerBottom - mercuryHeight

  return (
    <svg width={size} height={size * (100 / 40)} viewBox="0 0 40 100" style={{ display: 'block', flexShrink: 0 }}>
      <defs>
        {/* Same recipe as the compass bezel's radial-gradient, for family resemblance */}
        <linearGradient id="thermoGlassGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#38384C" />
          <stop offset="18%" stopColor="#2A2A3C" />
          <stop offset="45%" stopColor="#14141E" />
          <stop offset="100%" stopColor="#08080C" />
        </linearGradient>
        <radialGradient id="thermoBulbGrad" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#3A3A52" />
          <stop offset="55%" stopColor="#1C1C26" />
          <stop offset="100%" stopColor="#08080C" />
        </radialGradient>
        <radialGradient id="thermoInnerShadow" cx="50%" cy="50%" r="65%">
          <stop offset="55%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.45)" />
        </radialGradient>
      </defs>

      {/* Glass tube + bulb — gradient fill instead of flat colour, plus an
          inset vignette overlay to fake an inner shadow */}
      <rect x={15} y={6} width={10} height={74} rx={5} fill="url(#thermoGlassGrad)" stroke="#32324A" strokeWidth={1.5} />
      <circle cx={20} cy={82} r={17} fill="url(#thermoBulbGrad)" stroke="#32324A" strokeWidth={1.5} />
      <rect x={15} y={6} width={10} height={74} rx={5} fill="url(#thermoInnerShadow)" />
      <circle cx={20} cy={82} r={17} fill="url(#thermoInnerShadow)" />

      {/* Glass reflection streak — tube and a short arc on the bulb */}
      <path d="M 17.3 10 L 17.3 74 Q 17.3 78 15.2 80.5" stroke="rgba(255,255,255,0.22)" strokeWidth={1.4} strokeLinecap="round" fill="none" />
      <path d="M 11.5 75 Q 9.5 82 12.5 90" stroke="rgba(255,255,255,0.16)" strokeWidth={1.4} strokeLinecap="round" fill="none" />

      {/* Graduation ticks — decorative, same spirit as the compass distance rings */}
      {[18, 30, 42, 54, 66].map((y, i) => (
        <line key={y} x1={26} y1={y} x2={i % 2 === 0 ? 31 : 29.5} y2={y} stroke="#32324A" strokeWidth={1.5} />
      ))}

      {/* Mercury — bulb always full, column rises with fillPct, soft glow
          matching the glow treatment already used on the compass ring/buttons */}
      <g style={{ filter: `drop-shadow(0 0 4px ${hexToRgba(color, 0.85)}) drop-shadow(0 0 9px ${hexToRgba(color, 0.45)})` }}>
        <circle cx={20} cy={82} r={13} fill={color} />
        <rect x={17} y={mercuryY} width={6} height={mercuryHeight} rx={3} fill={color} />
      </g>
    </svg>
  )
}

// Left-chevron icon for .nav-back — universal nav element, not tied to any
// genre/tier color, so it always uses the same bright text color.
function ChevronLeftIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
      <path d="M15 6 L9 12 L15 18" stroke="#F1F0FF" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Fallback genre detection for packs created before migration 016 added
// the authored `genre` column (theme_tag is seasonal, not a movie genre,
// so it can't stand in for those). Command Center has authored its own
// genre via a picker since that migration — this only ever runs for
// packs where puzzle_packs.genre IS NULL. Matches pack text against
// keywords for each of HuntSelectionScreen's 11 THEMES.
const GENRE_KEYWORDS = {
  horror:   ['horror', 'scream', 'nightmare', 'haunt', 'blood', 'zombie', 'ghost', 'curse'],
  scifi:    ['sci-fi', 'scifi', 'space', 'alien', 'future', 'robot', 'galaxy', 'cyber'],
  action:   ['action', 'chase', 'explosion', 'heist', 'spy', 'mission', 'agent'],
  romance:  ['romance', 'love', 'heart', 'valentine', 'wedding', 'romcom'],
  comedy:   ['comedy', 'laugh', 'funny', 'sitcom', 'comic'],
  thriller: ['thriller', 'suspense', 'conspiracy', 'noir'],
  fantasy:  ['fantasy', 'dragon', 'wizard', 'kingdom', 'magic', 'quest'],
  drama:    ['drama', 'biopic', 'tragedy'],
  mystery:  ['mystery', 'detective', 'whodunit', 'clue', 'sleuth'],
  family:   ['family', 'kids', 'animated', 'pixar', 'disney'],
}
function detectGenre(name, description, tagline) {
  const text = [name, description, tagline].filter(Boolean).join(' ').toLowerCase()
  for (const [genre, words] of Object.entries(GENRE_KEYWORDS)) {
    if (words.some(w => text.includes(w))) return genre
  }
  return 'general'
}

//  CSS 
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Space+Grotesk:wght@400;500;600;700&family=Share+Tech+Mono&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: radial-gradient(ellipse at top, #1A0533 0%, #0A0A0F 60%);
  background-attachment: fixed;
  color: #F1F0FF;
  font-family: 'Space Grotesk', system-ui, sans-serif;
  min-height: 100dvh;
  overflow-x: hidden;
}

.app {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100dvh;
  padding: 0 0 env(safe-area-inset-bottom, 0);
  position: relative;
}

/*  Logo  */
.logo-wrap {
  text-align: center;
  padding: 60px 24px 8px;
}
.logo-wordmark {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  margin-top: 10px;
}
.logo-map {
  font-family: 'Nunito', sans-serif;
  font-size: 56px;
  font-weight: 900;
  color: #F1F0FF;
  line-height: 1;
  letter-spacing: 0;
}
.logo-the {
  font-family: 'Share Tech Mono', monospace;
  font-size: 13px;
  color: #9D5FF5;
  letter-spacing: 10px;
  margin: 4px 0;
}
.logo-movie {
  font-family: 'Nunito', sans-serif;
  font-size: 56px;
  font-weight: 900;
  background: linear-gradient(180deg, #FCD34D 0%, #F59E0B 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1;
  letter-spacing: 0;
}
.logo-sub {
  font-size: 12px;
  letter-spacing: 1.5px;
  color: #8888BB;
  font-family: 'Space Grotesk', system-ui, sans-serif;
  font-weight: 500;
  margin-top: 8px;
}

/*  Discover screen  */
.discover-screen {
  padding: 0 16px 40px;
}
.section-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #8888BB;
  text-transform: uppercase;
  margin-bottom: 12px;
}
.view-toggle {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid #32324A;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  font-family: 'Space Grotesk', system-ui, sans-serif;
  transition: all 0.2s;
}

/*  Hunt card  */
.hunt-card {
  background: #1C1C26;
  border: 1px solid #32324A;
  border-radius: 18px;
  padding: 18px 20px;
  margin-bottom: 14px;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.1s;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  position: relative;
  overflow: hidden;
}
.hunt-card:active { transform: scale(0.98); }
.hunt-card-emoji {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  flex-shrink: 0;
}
.hunt-card-body { flex: 1; min-width: 0; }
.hunt-card-name {
  font-weight: 700;
  font-size: 16px;
  color: #F1F0FF;
  margin-bottom: 4px;
}
.hunt-card-desc {
  font-size: 12px;
  color: #8888BB;
  line-height: 1.4;
  margin-bottom: 8px;
}
.hunt-card-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.badge {
  font-family: 'Share Tech Mono', monospace;
  font-size: 10px;
  letter-spacing: 1.5px;
  padding: 3px 8px;
  border-radius: 6px;
  font-weight: 600;
}
.badge-free { background: rgba(16,185,129,0.12); color: #10B981; }
.badge-premium { background: rgba(245,158,11,0.12); color: #F59E0B; }
.badge-elite { background: rgba(252,211,77,0.12); color: #FCD34D; }
.badge-dist { background: #252533; color: #8888BB; }
.hunt-card-start {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}
.btn-start {
  font-family: 'Share Tech Mono', monospace;
  font-size: 10px;
  letter-spacing: 2px;
  padding: 8px 14px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  font-weight: 700;
}

/*  Hunt card hero  */
.hunt-card-hero {
  position: relative;
  height: 160px;
  overflow: hidden;
}
.hunt-card-hero::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
  background-size: 30px 30px;
  transform: perspective(200px) rotateX(20deg);
  transform-origin: bottom;
  pointer-events: none;
}
/*  Map  */
.leaflet-container {
  background: #1C1C26 !important;
}
.map-wrap {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid #32324A;
  margin-bottom: 16px;
}
.map-legend {
  background: #1C1C26;
  padding: 8px 16px;
  font-size: 11px;
  color: #8888BB;
  font-family: 'Share Tech Mono', monospace;
  letter-spacing: 0.5px;
}

/*  Loading / Error  */
.loading-state {
  text-align: center;
  padding: 48px 20px;
  color: #8888BB;
  font-size: 13px;
}
.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #32324A;
  border-top-color: #7C3AED;
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
  margin: 0 auto 14px;
}
@keyframes spin { to { transform: rotate(360deg); } }
.error-state {
  background: rgba(239,68,68,0.06);
  border: 1px solid rgba(239,68,68,0.2);
  border-radius: 14px;
  padding: 20px;
  text-align: center;
  color: #EF4444;
  font-size: 13px;
  margin-bottom: 16px;
}
.empty-state {
  text-align: center;
  padding: 48px 20px;
  color: #8888BB;
  font-size: 13px;
}

/*  Paywall modal  */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(10,10,18,0.88);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 9999;
  padding-bottom: env(safe-area-inset-bottom, 0);
}
.modal-sheet {
  background: #1C1C26;
  border: 1px solid #32324A;
  border-radius: 24px 24px 0 0;
  padding: 32px 24px 40px;
  width: 100%;
  max-width: 480px;
}
.modal-close {
  float: right;
  background: #32324A;
  border: none;
  color: #B8B4D8;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-title {
  font-family: 'Nunito', sans-serif;
  font-size: 22px;
  font-weight: 800;
  color: #F1F0FF;
  margin: 16px 0 8px;
}
.modal-sub { font-size: 13px; color: #8888BB; margin-bottom: 24px; line-height: 1.5; }
.modal-email-row { display: flex; gap: 8px; margin-bottom: 12px; }
.modal-input {
  flex: 1;
  background: #121218;
  border: 1px solid #32324A;
  border-radius: 10px;
  color: #F1F0FF;
  font-family: 'Space Grotesk', system-ui, sans-serif;
  font-size: 14px;
  padding: 10px 14px;
  outline: none;
}
.modal-input:focus { border-color: #7C3AED; }
.modal-input::placeholder { color: #8888BB; }
.modal-btn-main {
  background: #7C3AED;
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 10px 18px;
  font-family: 'Share Tech Mono', monospace;
  font-size: 12px;
  letter-spacing: 1.5px;
  cursor: pointer;
  white-space: nowrap;
}
.modal-sent { font-size: 13px; color: #10B981; margin-bottom: 16px; }
.modal-divider { text-align: center; font-size: 11px; color: #8888BB; margin: 16px 0; letter-spacing: 2px; }
.modal-free-btn {
  width: 100%;
  background: #252533;
  border: 1px solid #32324A;
  border-radius: 10px;
  color: #B8B4D8;
  font-family: 'Share Tech Mono', monospace;
  font-size: 11px;
  letter-spacing: 2px;
  padding: 12px;
  cursor: pointer;
}

/*  Puzzle screen  */
.puzzle-screen {
  padding: 0 16px 40px;
}
.pack-nav {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 0;
  margin-bottom: 4px;
}
.nav-back {
  background: #252533;
  border: 1px solid #32324A;
  border-radius: 10px;
  color: #B8B4D8;
  font-size: 16px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}
/* Same background/border/rounding language as .nav-back, but for the one
   instance (arrived screen) that needs icon + "All Hunts" text rather than
   an icon alone in a fixed 36px square. */
.nav-back-wide {
  width: auto;
  height: 36px;
  padding: 0 16px;
  gap: 8px;
}
.back-btn {
  background: #252533;
  border: 1px solid #32324A;
  border-radius: 10px;
  color: #F1F0FF;
  font-size: 14px;
  font-weight: 600;
  padding: 8px 16px;
  cursor: pointer;
  flex-shrink: 0;
  transition: border-color 0.15s, color 0.15s;
}
.back-btn:hover { border-color: #7C3AED; color: #9D5FF5; }
.nav-pack-name {
  font-weight: 700;
  font-size: 15px;
  color: #F1F0FF;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nav-count {
  font-family: 'Share Tech Mono', monospace;
  font-size: 11px;
  color: #8888BB;
  white-space: nowrap;
}

/*  Coord display  */
.coord-bar {
  background: #1C1C26;
  border: 1px solid #32324A;
  border-radius: 16px;
  padding: 16px 18px;
  margin-bottom: 14px;
}
.coord-label {
  font-size: 10px;
  letter-spacing: 2px;
  color: #8888BB;
  font-family: 'Share Tech Mono', monospace;
  margin-bottom: 10px;
}
.coord-strings {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-family: 'Share Tech Mono', monospace;
  font-size: 18px;
  letter-spacing: 1px;
  margin-bottom: 14px;
}
.coord-row {
  display: flex;
  align-items: center;
  gap: 3px;
  flex-wrap: nowrap;
}
.coord-fixed {
  color: #B8B4D8;
  min-width: 10px;
  text-align: center;
}
.coord-slot-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 40px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 18px;
  flex-shrink: 0;
}
.coord-slot-box.pending {
  background: #121218;
  border: 1px solid #32324A;
  color: #32324A;
  animation: slot-pulse 2s infinite;
}
.coord-slot-box.solved {
  background: #F59E0B;
  border: 1px solid #F59E0B;
  color: #000;
  animation: slot-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes slot-pulse {
  0%, 100% { border-color: #32324A; box-shadow: none; }
  50%       { border-color: #7C3AED; box-shadow: 0 0 8px rgba(124,58,237,0.4); }
}
@keyframes slot-pop {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.2); }
  100% { transform: scale(1); }
}
.progress-track {
  height: 4px;
  background: #252533;
  border-radius: 2px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.4s ease;
}

/*  Takes bar (director's-slate lives system)  */
.takes-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  padding: 10px 14px;
  background: #1C1C26;
  border: 1px solid #32324A;
  border-radius: 12px;
}
.takes-label {
  font-family: 'Share Tech Mono', monospace;
  font-size: 10px;
  letter-spacing: 1.5px;
  color: #8888BB;
}
.takes-pips { display: flex; gap: 3px; flex: 1; }
.takes-pip {
  flex: 1;
  height: 14px;
  border-radius: 3px;
  background: #252533;
  position: relative;
  overflow: hidden;
  transform-origin: center;
  transition: background 0.25s;
}
.takes-pip-stripe {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 40%;
  background: repeating-linear-gradient(115deg, rgba(0,0,0,0.4) 0 3px, transparent 3px 6px);
}
.takes-count {
  font-family: 'Share Tech Mono', monospace;
  font-size: 12px;
  color: #B8B4D8;
}
@keyframes slateClap {
  0%   { transform: scaleY(1); opacity: 1; }
  35%  { transform: scaleY(0.25); opacity: 0.7; }
  100% { transform: scaleY(1); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .takes-pip { animation: none !important; }
}

/*  Puzzle card  */
.puzzle-card {
  background: #1C1C26;
  border: 1px solid #32324A;
  border-radius: 18px;
  padding: 18px;
  margin-bottom: 12px;
  transition: border-color 0.2s;
}
.puzzle-card.solved { opacity: 0.6; }
.puzzle-slot-tag {
  font-family: 'Share Tech Mono', monospace;
  font-size: 10px;
  letter-spacing: 2px;
  color: #8888BB;
  margin-bottom: 10px;
}
.puzzle-category {
  font-size: 11px;
  color: #8888BB;
  margin-bottom: 8px;
  letter-spacing: 1px;
}
.puzzle-movie {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #B8B4D8;
  background: rgba(124,58,237,0.1);
  border: 1px solid rgba(124,58,237,0.25);
  border-radius: 8px;
  padding: 4px 10px;
  margin-bottom: 10px;
}
.puzzle-question {
  font-size: 15px;
  font-weight: 600;
  color: #F1F0FF;
  line-height: 1.5;
  margin-bottom: 16px;
}
.puzzle-hint {
  font-size: 12px;
  color: #8888BB;
  margin-bottom: 14px;
  font-style: italic;
  line-height: 1.4;
}
.puzzle-input-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}
.puzzle-input {
  width: 100%;
  box-sizing: border-box;
  background: #121218;
  border: 1px solid #32324A;
  border-radius: 10px;
  color: #F1F0FF;
  font-family: 'Share Tech Mono', monospace;
  font-size: 22px;
  padding: 12px 16px;
  outline: none;
  text-align: center;
  transition: border-color 0.2s;
}
.puzzle-input:focus { border-color: #7C3AED; }
.puzzle-input.correct { border-color: #10B981; color: #10B981; }
.puzzle-input.wrong { border-color: #EF4444; animation: shake 0.3s; }
@keyframes shake {
  0%,100%{transform:translateX(0)}
  20%{transform:translateX(-4px)}
  60%{transform:translateX(4px)}
}
.puzzle-submit {
  width: 100%;
  border: none;
  border-radius: 10px;
  font-family: 'Share Tech Mono', monospace;
  font-size: 13px;
  letter-spacing: 2px;
  padding: 16px;
  cursor: pointer;
  font-weight: 700;
  transition: opacity 0.2s;
}
.puzzle-submit:disabled { opacity: 0.4; cursor: default; }
.puzzle-msg {
  margin-top: 10px;
  font-size: 11px;
  font-family: 'Share Tech Mono', monospace;
  letter-spacing: 1px;
}
.puzzle-msg.err { color: #EF4444; }
.puzzle-msg.ok { color: #10B981; }
.puzzle-solved-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Share Tech Mono', monospace;
  font-size: 12px;
  letter-spacing: 1.5px;
  padding: 8px 12px;
  background: rgba(16,185,129,0.06);
  border: 1px solid rgba(16,185,129,0.2);
  border-radius: 10px;
  color: #10B981;
}
.hint-toggle {
  background: none;
  border: none;
  font-size: 11px;
  color: #8888BB;
  cursor: pointer;
  font-family: 'Share Tech Mono', monospace;
  letter-spacing: 1px;
  padding: 0;
  text-decoration: underline;
  margin-bottom: 10px;
  display: block;
}
.lockout-box {
  background: rgba(239,68,68,0.06);
  border: 1px solid rgba(239,68,68,0.2);
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 12px;
  font-family: 'Share Tech Mono', monospace;
  letter-spacing: 1px;
  color: #EF4444;
}

/*  Compass screen  */
.compass-wrap {
  position: relative;
  background: #08080F;
  padding: 20px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
@keyframes temp-toast-pop {
  0%   { opacity: 0; transform: translate(-50%, -90%); }
  15%  { opacity: 1; transform: translate(-50%, -100%); }
  80%  { opacity: 1; transform: translate(-50%, -100%); }
  100% { opacity: 0; transform: translate(-50%, -110%); }
}
.compass-dist {
  font-family: 'Share Tech Mono', monospace;
  font-size: 48px;
  font-weight: 700;
  color: #F1F0FF;
  letter-spacing: -1px;
  line-height: 1;
}
.compass-unit { font-size: 18px; color: #8888BB; font-weight: 700; }
.compass-arrow-wrap {
  position: relative;
  width: 280px;
  height: 280px;
}
.compass-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 3px solid #7C3AED;
  box-shadow: 0 0 24px rgba(124,58,237,0.35), inset 0 0 24px rgba(124,58,237,0.12);
  transition: border-color 0.4s, box-shadow 0.4s;
}
.compass-ring.on-track {
  border-color: #10B981;
  box-shadow: 0 0 30px rgba(16,185,129,0.4), inset 0 0 24px rgba(16,185,129,0.12);
}
/* Radar sweep — rotating line inside the compass ring */
.compass-radar-line {
  transform-box: view-box;
  transform-origin: center;
}
@media (prefers-reduced-motion: no-preference) {
  .compass-radar-line {
    animation: compass-radar-spin 4s linear infinite;
  }
}
@keyframes compass-radar-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.compass-journey-bar {
  width: 200px;
  height: 6px;
  background: #32324A;
  border-radius: 3px;
  overflow: hidden;
  margin: 4px auto 0;
}
.compass-journey-fill {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, #7C3AED, #F59E0B);
  transition: width 1s ease;
}
.compass-dist-label {
  font-family: 'Share Tech Mono', monospace;
  font-size: 12px;
  color: #8888BB;
  letter-spacing: 2px;
  margin-top: 4px;
  text-align: center;
}
.compass-status {
  font-family: 'Share Tech Mono', monospace;
  font-size: 11px;
  letter-spacing: 2px;
  color: #8888BB;
  text-align: center;
}
.compass-msg-box {
  background: rgba(245,158,11,0.08);
  border: 1px solid rgba(245,158,11,0.2);
  border-radius: 10px;
  padding: 10px 16px;
  font-size: 12px;
  color: #F59E0B;
  font-family: 'Share Tech Mono', monospace;
  letter-spacing: 1px;
  text-align: center;
  width: 100%;
}
.compass-permission-btn {
  background: linear-gradient(180deg, #FCD34D 0%, #F59E0B 100%);
  border: none;
  border-radius: 12px;
  color: #000;
  font-family: 'Share Tech Mono', monospace;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 2px;
  padding: 14px 32px;
  cursor: pointer;
}
.compass-fallback {
  background: rgba(124,58,237,0.08);
  border: 1px solid rgba(124,58,237,0.25);
  border-radius: 10px;
  padding: 12px 18px;
  font-size: 14px;
  font-weight: 700;
  color: #9D5FF5;
  text-align: center;
  width: 100%;
}
.compass-calibrating {
  font-family: 'Share Tech Mono', monospace;
  font-size: 11px;
  letter-spacing: 2px;
  color: #F59E0B;
  text-align: center;
}
.sim-btn {
  width: 100%;
  margin-top: 12px;
  background: #252533;
  border: 1px dashed #32324A;
  border-radius: 10px;
  color: #8888BB;
  font-family: 'Share Tech Mono', monospace;
  font-size: 10px;
  letter-spacing: 2px;
  padding: 10px;
  cursor: pointer;
}

/*  Arrived screen  */
.arrived-wrap {
  padding: 24px 16px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  background: #121218;
  min-height: 100dvh;
}

/*  Account prompt  */
.account-prompt {
  margin-top: 20px;
  background: #1C1C26;
  border: 1px solid #32324A;
  border-radius: 14px;
  padding: 20px;
  width: 100%;
  max-width: 340px;
}
.account-prompt-title {
  font-family: 'Nunito', sans-serif;
  font-size: 24px;
  font-weight: 900;
  color: #F1F0FF;
  margin-bottom: 6px;
}
.account-prompt-sub { font-size: 14px; color: #B8B4D8; margin-bottom: 16px; }
.account-email-row { display: flex; flex-direction: column; gap: 10px; }
.account-input {
  width: 100%;
  background: #1C1C26;
  border: 1px solid #32324A;
  border-radius: 10px;
  color: #F1F0FF;
  font-family: 'Space Grotesk', system-ui, sans-serif;
  font-size: 15px;
  padding: 13px 14px;
  outline: none;
}
.account-input:focus { outline: 2px solid #7C3AED; outline-offset: -1px; border-color: transparent; }
.account-submit {
  background: linear-gradient(135deg, #F59E0B, #FCD34D);
  border: none;
  border-radius: 12px;
  color: #121218;
  font-family: 'Share Tech Mono', monospace;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 1.5px;
  padding: 0;
  height: 52px;
  width: 100%;
  cursor: pointer;
}
.account-maybe {
  background: none;
  border: none;
  color: #8888BB;
  font-size: 13px;
  cursor: pointer;
  width: 100%;
  text-align: center;
  margin-top: 10px;
  padding: 4px;
}
.account-sent { font-size: 13px; color: #10B981; }

/*  Arrival reveal — geofence trigger premiere sequence  */
.reveal-flash {
  position: absolute; inset: 0;
  background: #F59E0B;
  opacity: 0;
  pointer-events: none;
  z-index: 30;
}
.reveal-particle-field {
  position: absolute; inset: 0;
  z-index: 25;
  pointer-events: none;
  overflow: hidden;
}
.reveal-particle {
  position: absolute;
  top: 50%; left: 50%;
  opacity: 0;
  border-radius: 1px;
}
.reveal-scanline {
  position: absolute;
  left: 0; right: 0; top: -20px;
  height: 2px;
  background: linear-gradient(90deg, transparent, #9D5FF5 20%, #9D5FF5 80%, transparent);
  box-shadow: 0 0 16px 2px rgba(157,95,245,0.7);
  opacity: 0;
  z-index: 24;
  pointer-events: none;
}
.reveal-locus {
  position: absolute;
  top: 120px; left: 50%;
  width: 0; height: 0;
  z-index: 20;
  pointer-events: none;
}
.reveal-dot {
  position: absolute; top: 0; left: 0;
  width: 10px; height: 10px;
  margin: -5px 0 0 -5px;
  border-radius: 50%;
  background: #F59E0B;
  opacity: 0;
  box-shadow: 0 0 12px 2px rgba(245,158,11,0.7);
}
.reveal-ripple {
  position: absolute; top: 0; left: 0;
  width: 10px; height: 10px;
  margin: -5px 0 0 -5px;
  border-radius: 50%;
  border: 1.5px solid #FCD34D;
  opacity: 0;
}
.reveal-found-bar {
  position: relative;
  background: linear-gradient(135deg, #7C3AED, #9D5FF5);
  color: #fff;
  font-family: 'Share Tech Mono', monospace;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 3px;
  text-align: center;
  padding: 11px 16px;
  border-radius: 10px;
  margin-bottom: 18px;
  overflow: hidden;
  opacity: 0;
  width: 100%;
  max-width: 340px;
  z-index: 5;
}
.reveal-shimmer {
  position: absolute; top: 0; bottom: 0; left: -60%;
  width: 40%;
  background: linear-gradient(100deg, transparent, rgba(255,255,255,0.55), transparent);
  transform: translateX(0);
}
.reveal-biz-name {
  font-family: 'Nunito', sans-serif;
  font-weight: 900;
  font-size: 27px;
  text-align: center;
  line-height: 1.15;
  margin: 0 0 6px;
  opacity: 0;
}
.reveal-location-line {
  font-family: 'Share Tech Mono', monospace;
  font-size: 11.5px;
  letter-spacing: 1px;
  color: #6B67A0;
  text-align: center;
  margin-bottom: 20px;
  opacity: 0;
}
.reveal-voucher-card {
  width: 100%; max-width: 340px;
  background: #1C1C26;
  border: 1px solid #32324A;
  border-radius: 16px;
  padding: 18px 20px;
  opacity: 0;
  margin-bottom: 16px;
}
.reveal-voucher-card .reveal-label {
  font-family: 'Share Tech Mono', monospace;
  font-size: 10px; letter-spacing: 2px;
  color: #9D5FF5; margin-bottom: 8px;
}
.reveal-voucher-card .reveal-headline {
  font-family: 'Nunito', sans-serif;
  font-weight: 800; font-size: 18px;
  color: #F1F0FF; margin-bottom: 5px; line-height: 1.25;
}
.reveal-voucher-card .reveal-detail {
  font-size: 12.5px; color: #B8B4D8; line-height: 1.5; margin-bottom: 14px;
}
.reveal-voucher-card .reveal-code {
  font-family: 'Share Tech Mono', monospace;
  font-size: 20px; font-weight: 700; letter-spacing: 3px;
  color: #F59E0B; text-align: center; padding: 13px; border-radius: 9px;
  background: rgba(245,158,11,0.06);
  border: 1px solid rgba(245,158,11,0.55);
  text-shadow: 0 0 14px rgba(245,158,11,0.35);
}
.reveal-stats-row {
  width: 100%; max-width: 340px;
  display: flex; gap: 10px;
  margin-bottom: 18px;
  opacity: 0;
}
.reveal-stat {
  flex: 1;
  background: rgba(255,255,255,0.03);
  border: 1px solid #32324A;
  border-radius: 10px;
  padding: 10px 8px;
  text-align: center;
}
.reveal-stat .reveal-num {
  font-family: 'Share Tech Mono', monospace;
  font-size: 16px; font-weight: 700; color: #F1F0FF;
  font-variant-numeric: tabular-nums;
}
.reveal-stat .reveal-cap {
  font-size: 9.5px; letter-spacing: 1.5px; color: #6B67A0; margin-top: 2px;
}
.reveal-share-btn {
  width: 100%; max-width: 340px;
  background: linear-gradient(135deg, #FCD34D, #F59E0B);
  color: #1a1200;
  border: none; border-radius: 12px;
  font-family: 'Share Tech Mono', monospace;
  font-weight: 800; font-size: 13px; letter-spacing: 2px;
  padding: 15px; text-align: center;
  margin-bottom: 12px;
  opacity: 0;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(245,158,11,0.25);
}
.reveal-secondary-actions {
  display: flex; gap: 20px;
  opacity: 0;
  margin-bottom: 8px;
}
.reveal-secondary-actions button {
  background: none; border: none; padding: 0;
  font-size: 12px; color: #6B67A0;
  text-decoration: underline; text-underline-offset: 3px;
  text-decoration-color: rgba(107,103,160,0.5);
  cursor: pointer; font-family: inherit;
}

/*  Passport stamp + star strip  */
.reveal-stamp-zone {
  position: relative;
  width: 108px; height: 108px;
  margin: 4px 0 10px;
  display: flex; align-items: center; justify-content: center;
}
.reveal-inkbloom {
  position: absolute;
  width: 96px; height: 96px;
  border-radius: 50%;
  filter: blur(7px);
  opacity: 0;
}
.reveal-stamp-outer {
  position: relative;
  width: 92px; height: 92px;
}
.reveal-stamp {
  position: absolute; inset: 0;
  border-radius: 50%;
  border: 3px solid;
  background: rgba(255,255,255,0.03);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  overflow: hidden;
  opacity: 0;
  transform: translateY(-60px) scale(1.3);
}
.reveal-stamp-emoji { font-size: 22px; line-height: 1; margin-bottom: 2px; }
.reveal-stamp-tier {
  font-family: 'Share Tech Mono', monospace;
  font-size: 9px; font-weight: 800; letter-spacing: 1px;
}
.reveal-stamp-complete {
  font-family: 'Share Tech Mono', monospace;
  font-size: 7px; letter-spacing: 1.5px; opacity: 0.75;
}
.reveal-stamp-sheen {
  position: absolute; top: 0; bottom: 0; left: -60%;
  width: 40%;
  background: linear-gradient(100deg, transparent, rgba(255,255,255,0.65), transparent);
}
.reveal-stamp-caption {
  font-family: 'Share Tech Mono', monospace;
  font-size: 11px; letter-spacing: 1.5px;
  text-align: center;
  margin-bottom: 16px;
  opacity: 0;
}
.reveal-star-strip {
  width: 100%; max-width: 340px;
  text-align: center;
  margin-bottom: 18px;
  opacity: 0;
}
.reveal-star-row {
  display: flex; justify-content: center; gap: 8px;
  margin-bottom: 8px;
}
.reveal-star {
  display: inline-block;
  font-size: 20px; line-height: 1;
  color: #32324A;
  opacity: 0;
  transform: scale(0.4);
}
.reveal-star-caption {
  font-size: 11.5px; color: #8888BB;
  margin-bottom: 8px;
}
.reveal-star-progress-track {
  width: 100%; height: 4px;
  background: #1E1E2E;
  border-radius: 2px;
  overflow: hidden;
}
.reveal-star-progress-fill {
  height: 100%;
  width: 0;
  border-radius: 2px;
  background: linear-gradient(90deg, #7C3AED, #FCD34D);
}

@media (prefers-reduced-motion: no-preference) {
  .reveal-stage.playing .reveal-flash             { animation: revealFlash     350ms ease-out                       0ms    1 forwards; }
  .reveal-stage.playing .reveal-particle           { animation: revealParticle  var(--dur) cubic-bezier(.16,1,.3,1)  var(--delay) 1 forwards; }
  .reveal-stage.playing .reveal-scanline           { animation: revealScan      650ms ease-in                       200ms  1 forwards; }
  .reveal-stage.playing .reveal-dot                { animation: revealDotIn     260ms ease-out                      300ms  1 forwards; }
  .reveal-stage.playing .reveal-ripple.r1          { animation: revealRipple    1100ms ease-out                     300ms  1 forwards; }
  .reveal-stage.playing .reveal-ripple.r2          { animation: revealRipple    1100ms ease-out                     550ms  1 forwards; }
  .reveal-stage.playing .reveal-found-bar          { animation: revealFadeIn    200ms ease-out                      260ms  1 forwards; }
  .reveal-stage.playing .reveal-shimmer            { animation: revealShimmer   750ms ease-in-out                   900ms  1 forwards; }
  .reveal-stage.playing .reveal-biz-name           { animation: revealNameSlam  560ms cubic-bezier(.34,1.56,.64,1)  300ms  1 forwards; }
  .reveal-stage.playing .reveal-location-line      { animation: revealFadeUp    380ms ease-out                      520ms  1 forwards; }
  .reveal-stage.playing .reveal-voucher-card       { animation: revealCardPop   520ms cubic-bezier(.34,1.56,.64,1)  650ms  1 forwards; }
  .reveal-stage.playing .reveal-inkbloom           { animation: revealInkBloom  900ms ease-out                      800ms  1 forwards; }
  .reveal-stage.playing .reveal-stamp              { animation: revealStampDrop 480ms cubic-bezier(.34,1.56,.64,1)  800ms  1 forwards; }
  .reveal-stage.playing .reveal-stamp-sheen        { animation: revealShimmer   700ms ease-in-out                   1250ms 1 forwards; }
  .reveal-stage.playing .reveal-stamp-caption      { animation: revealFadeUp    340ms ease-out                      1300ms 1 forwards; }
  .reveal-stage.playing .reveal-star-strip         { animation: revealFadeIn    380ms ease-out                      1100ms 1 forwards; }
  .reveal-stage.playing .reveal-star               { animation: revealStarPop   320ms cubic-bezier(.34,1.56,.64,1)  var(--star-delay) 1 forwards; }
  .reveal-stage.playing .reveal-star-progress-fill { animation: revealStarBar   700ms ease-out                      1450ms 1 forwards; }
  .reveal-stage.playing .reveal-stats-row          { animation: revealFadeUp    420ms ease-out                      1000ms 1 forwards; }
  .reveal-stage.playing .reveal-share-btn          { animation: revealBtnBounce 560ms cubic-bezier(.34,1.56,.64,1)  1050ms 1 forwards; }
  .reveal-stage.playing .reveal-secondary-actions  { animation: revealFadeIn    380ms ease-out                      1300ms 1 forwards; }
}
@keyframes revealFlash {
  0%   { opacity: 0; }
  28%  { opacity: 0.9; }
  100% { opacity: 0; }
}
@keyframes revealParticle {
  0%   { transform: translate(-50%,-50%) translate(0,0) scale(1); opacity: 1; }
  8%   { opacity: 1; }
  100% { transform: translate(-50%,-50%) translate(var(--tx), var(--ty)) scale(0.3); opacity: 0; }
}
@keyframes revealScan {
  0%   { transform: translateY(0);     opacity: 0; }
  8%   { opacity: 1; }
  88%  { opacity: 1; }
  100% { transform: translateY(700px); opacity: 0; }
}
@keyframes revealDotIn {
  0%   { transform: scale(0.2); opacity: 0; }
  100% { transform: scale(1);   opacity: 1; }
}
@keyframes revealRipple {
  0%   { transform: scale(0.3); opacity: 0.8; }
  100% { transform: scale(9);   opacity: 0; }
}
@keyframes revealFadeIn {
  0%   { opacity: 0; }
  100% { opacity: 1; }
}
@keyframes revealFadeUp {
  0%   { opacity: 0; transform: translateY(14px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes revealNameSlam {
  0%   { opacity: 0; transform: scale(3); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes revealCardPop {
  0%   { opacity: 0; transform: scale(0.7) rotate(-2deg); }
  100% { opacity: 1; transform: scale(1)   rotate(0deg); }
}
@keyframes revealBtnBounce {
  0%   { opacity: 0; transform: translateY(22px) scale(0.85); }
  100% { opacity: 1; transform: translateY(0)     scale(1); }
}
@keyframes revealShimmer {
  0%   { transform: translateX(0); }
  100% { transform: translateX(430%); }
}
@keyframes revealInkBloom {
  0%   { transform: scale(0.3); opacity: 0.55; }
  100% { transform: scale(2.4); opacity: 0; }
}
@keyframes revealStampDrop {
  0%   { opacity: 0; transform: translateY(-60px) scale(1.3); }
  100% { opacity: 1; transform: translateY(0)      scale(1); }
}
@keyframes revealStarPop {
  0%   { opacity: 0; transform: scale(0.4); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes revealStarBar {
  from { width: 0; }
  to   { width: var(--star-pct); }
}

/* Reduced motion: decorative-only elements dropped, content fades in */
@media (prefers-reduced-motion: reduce) {
  .reveal-stage.playing .reveal-flash,
  .reveal-stage.playing .reveal-particle-field,
  .reveal-stage.playing .reveal-scanline,
  .reveal-stage.playing .reveal-ripple,
  .reveal-stage.playing .reveal-shimmer,
  .reveal-stage.playing .reveal-inkbloom,
  .reveal-stage.playing .reveal-stamp-sheen {
    display: none;
  }
  .reveal-stage.playing .reveal-dot,
  .reveal-stage.playing .reveal-found-bar,
  .reveal-stage.playing .reveal-biz-name,
  .reveal-stage.playing .reveal-location-line,
  .reveal-stage.playing .reveal-voucher-card,
  .reveal-stage.playing .reveal-stamp,
  .reveal-stage.playing .reveal-stamp-caption,
  .reveal-stage.playing .reveal-star-strip,
  .reveal-stage.playing .reveal-star,
  .reveal-stage.playing .reveal-stats-row,
  .reveal-stage.playing .reveal-share-btn,
  .reveal-stage.playing .reveal-secondary-actions {
    animation: revealSimpleFade 240ms ease-out both;
    transform: none;
  }
  .reveal-stage.playing .reveal-star-progress-fill {
    width: var(--star-pct);
  }
  .reveal-stage.playing .reveal-dot              { animation-delay: 80ms;  }
  .reveal-stage.playing .reveal-found-bar         { animation-delay: 160ms; }
  .reveal-stage.playing .reveal-biz-name          { animation-delay: 260ms; }
  .reveal-stage.playing .reveal-location-line     { animation-delay: 360ms; }
  .reveal-stage.playing .reveal-voucher-card      { animation-delay: 460ms; }
  .reveal-stage.playing .reveal-stamp             { animation-delay: 560ms; }
  .reveal-stage.playing .reveal-stamp-caption     { animation-delay: 640ms; }
  .reveal-stage.playing .reveal-star-strip        { animation-delay: 700ms; }
  .reveal-stage.playing .reveal-star              { animation-delay: 700ms; }
  .reveal-stage.playing .reveal-stats-row         { animation-delay: 780ms; }
  .reveal-stage.playing .reveal-share-btn         { animation-delay: 860ms; }
  .reveal-stage.playing .reveal-secondary-actions { animation-delay: 940ms; }
}
@keyframes revealSimpleFade {
  0%   { opacity: 0; }
  100% { opacity: 1; }
}

/*  Reset modal  */
.reset-overlay {
  position: fixed;
  inset: 0;
  background: rgba(10,10,18,0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 24px;
}
.reset-sheet {
  background: #1C1C26;
  border: 1px solid #32324A;
  border-radius: 20px;
  padding: 32px 24px;
  text-align: center;
  max-width: 360px;
  width: 100%;
}
.reset-icon { font-size: 48px; margin-bottom: 16px; }
.reset-title {
  font-family: 'Nunito', sans-serif;
  font-size: 22px;
  font-weight: 900;
  color: #EF4444;
  letter-spacing: 2px;
  margin-bottom: 10px;
}
.reset-body { font-size: 13px; color: #8888BB; margin-bottom: 24px; line-height: 1.5; }
.reset-action {
  background: #7C3AED;
  border: none;
  border-radius: 12px;
  color: #fff;
  font-family: 'Share Tech Mono', monospace;
  font-size: 12px;
  letter-spacing: 2px;
  padding: 14px 28px;
  cursor: pointer;
  width: 100%;
}

/*  Footer  */
.app-footer {
  text-align: center;
  padding: 24px 16px 40px;
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}
.footer-link {
  font-family: 'Share Tech Mono', monospace;
  font-size: 10px;
  letter-spacing: 1.5px;
  color: #8888BB;
  text-decoration: none;
}
.footer-link:hover { color: #7C3AED; }

.settings-btn {
  background: none;
  border: 1px solid #32324A;
  border-radius: 8px;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #8888BB;
  font-size: 16px;
  transition: border-color 0.15s, color 0.15s;
  position: absolute;
  top: 16px;
  right: 16px;
  flex-shrink: 0;
}
.settings-btn:hover { border-color: #7C3AED; color: #9D5FF5; }

.pref-option {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #32324A;
  cursor: pointer;
  user-select: none;
}
.pref-option:last-child { border-bottom: none; }
.pref-radio {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid #32324A;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
  transition: border-color 0.15s;
}
.pref-radio.active { border-color: #7C3AED; }
.pref-radio-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #7C3AED;
}
.pref-check {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 2px solid #32324A;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
  transition: border-color 0.15s, background 0.15s;
}
.pref-check.active { border-color: #7C3AED; background: #7C3AED22; }

@keyframes prize-pulse {
  0%, 100% { border-color: #F59E0B; box-shadow: 0 0 10px rgba(245,158,11,0.2), inset 0 0 20px rgba(245,158,11,0.03); }
  50%       { border-color: #FCD34D; box-shadow: 0 0 32px rgba(245,158,11,0.55), inset 0 0 20px rgba(245,158,11,0.07); }
}
.prize-card { animation: prize-pulse 2.4s ease-in-out infinite; }
`

//  Logo 
function LogoSVG() {
  const holes = [0, 45, 90, 135, 180, 225, 270, 315]
  return (
    <svg
      width="64" height="64" viewBox="0 0 64 64" fill="none"
      style={{ filter: 'drop-shadow(0 0 16px rgba(124,58,237,0.7)) drop-shadow(0 0 4px rgba(245,158,11,0.4))' }}
    >
      <defs>
        <linearGradient id="boltGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#FCD34D" />
        </linearGradient>
      </defs>
      {/* Outer ring */}
      <circle cx="32" cy="32" r="28" fill="#1C1C26" stroke="#7C3AED" strokeWidth="2.5" />
      {/* Sprocket holes */}
      {holes.map(deg => {
        const r = (deg * Math.PI) / 180
        return (
          <circle key={deg} cx={32 + 20 * Math.cos(r)} cy={32 + 20 * Math.sin(r)}
            r="3.5" fill="#7C3AED" fillOpacity="0.55" />
        )
      })}
      {/* Inner hub */}
      <circle cx="32" cy="32" r="9" fill="#7C3AED" fillOpacity="0.25" stroke="#7C3AED" strokeWidth="1.5" />
      {/* Lightning bolt */}
      <path d="M37 11 L25 33 L32 33 L27 53 L39 29 L32 29 Z"
        fill="url(#boltGrad)" stroke="#FCD34D" strokeWidth="0.4" strokeLinejoin="round" />
    </svg>
  )
}

// PaywallModal removed  all tiers freely playable until Stripe is integrated

//  Leaflet Hunt Map 
function HuntMap({ hunts, userPos, onHuntSelect }) {
  const mapRef = useRef(null)
  const instanceRef = useRef(null)

  useEffect(() => {
    if (!mapRef.current || instanceRef.current) return

    const center = userPos
      ? [userPos.lat, userPos.lon]
      : [51.3879, 0.5113]

    const zoom = userPos ? 14 : 11

    const map = L.map(mapRef.current, {
      center,
      zoom,
      zoomControl: true,
      attributionControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: ' <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)

    if (userPos) {
      L.circleMarker([userPos.lat, userPos.lon], {
        radius: 8,
        fillColor: '#10B981',
        color: '#fff',
        weight: 2,
        fillOpacity: 1,
      })
        .addTo(map)
        .bindPopup('You are here')
    }

    hunts.forEach(hunt => {
      const tier = hunt.pack_tier
      const color =
        tier === 'elite' ? '#FCD34D' : tier === 'premium' ? '#F59E0B' : '#7C3AED'
      const label = tier === 'elite' ? 'E' : '+'

      const icon = L.divIcon({
        html: `<div style="
          width:38px;height:38px;border-radius:50%;
          background:${color};border:2.5px solid rgba(255,255,255,0.7);
          display:flex;align-items:center;justify-content:center;
          font-size:17px;box-shadow:0 3px 10px rgba(0,0,0,0.5);
          cursor:pointer;">${label}</div>`,
        className: '',
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      })

      L.marker([hunt.approx_lat, hunt.approx_lon], { icon })
        .addTo(map)
        .on('click', () => onHuntSelect(hunt))
        .bindTooltip(hunt.pack_name, { direction: 'top', offset: [0, -22] })
    })

    instanceRef.current = map
    return () => {
      map.remove()
      instanceRef.current = null
    }
  }, [])

  return <div ref={mapRef} style={{ width: '100%', height: '340px' }} />
}

function getCardGradient(hunt) {
  const name  = (hunt.pack_name  || '').toLowerCase()
  const theme = (hunt.theme_tag  || hunt.genre || '').toLowerCase()

  if (name.includes('80s') || name.includes('nostalgia'))
    return { gradient: 'linear-gradient(135deg, #0D0221 0%, #1A0533 30%, #4A0080 60%, #FF006E 100%)', gridColor: 'rgba(255,0,110,0.12)' }

  if (name.includes('castle') || name.includes('keep'))
    return { gradient: 'linear-gradient(135deg, #1A0F00 0%, #2D1800 30%, #5C3000 60%, #C8860A 100%)', gridColor: 'rgba(200,134,10,0.12)' }

  if (name.includes('medway') || name.includes('dockyard') || name.includes('cipher'))
    return { gradient: 'linear-gradient(135deg, #000D1A 0%, #001833 30%, #003366 60%, #4A7FA5 100%)', gridColor: 'rgba(74,127,165,0.12)' }

  if (name.includes('thames') || name.includes('gateway'))
    return { gradient: 'linear-gradient(135deg, #001A1A 0%, #003333 30%, #005C5C 60%, #7ABFBF 100%)', gridColor: 'rgba(122,191,191,0.12)' }

  if (name.includes('market') || name.includes('town') || name.includes('mystery'))
    return { gradient: 'linear-gradient(135deg, #0A1400 0%, #1A2800 30%, #2D4A00 60%, #8B7000 100%)', gridColor: 'rgba(139,112,0,0.12)' }

  if (name.includes('ring') || name.includes('lotr') || name.includes('martello'))
    return { gradient: 'linear-gradient(135deg, #0A0500 0%, #1A0A00 30%, #3D1500 60%, #8B0000 100%)', gridColor: 'rgba(139,0,0,0.12)' }

  if (theme === 'christmas')
    return { gradient: 'linear-gradient(135deg, #001A00 0%, #003300 30%, #006600 60%, #CC0000 100%)', gridColor: 'rgba(204,0,0,0.12)' }

  if (theme === 'halloween')
    return { gradient: 'linear-gradient(135deg, #0D0800 0%, #1A1000 30%, #4A2800 60%, #FF6600 100%)', gridColor: 'rgba(255,102,0,0.12)' }

  if (theme.includes('horror'))
    return { gradient: 'linear-gradient(135deg, #0A0000 0%, #1A0000 30%, #4A0000 60%, #8B0000 100%)', gridColor: 'rgba(139,0,0,0.12)' }

  if (theme.includes('valentin') || theme.includes('romance'))
    return { gradient: 'linear-gradient(135deg, #1A0010 0%, #3D0025 30%, #8B0050 60%, #FF006E 100%)', gridColor: 'rgba(255,0,110,0.12)' }

  if (theme.includes('summer'))
    return { gradient: 'linear-gradient(135deg, #1A0D00 0%, #331A00 30%, #664400 60%, #FF8800 100%)', gridColor: 'rgba(255,136,0,0.12)' }

  if (theme.includes('sci-fi') || theme.includes('scifi'))
    return { gradient: 'linear-gradient(135deg, #000A1A 0%, #001433 30%, #003366 60%, #0066CC 100%)', gridColor: 'rgba(0,102,204,0.12)' }

  return { gradient: 'linear-gradient(135deg, #0D0221 0%, #1A0533 30%, #4A0080 60%, #7C3AED 100%)', gridColor: 'rgba(124,58,237,0.12)' }
}
//  Hunt Card 
function HuntCard({ hunt, onTap, distLabel }) {
  const accent = hexAccent(hunt.accent_color)
  const tier = hunt.pack_tier
  const badgeLabel = tier === 'elite' ? 'ELITE' : tier === 'premium' ? 'PREMIUM' : 'FREE'
  const badgeColor = tier === 'elite' ? '#FCD34D' : tier === 'premium' ? '#F59E0B' : '#10B981'
  const diff = hunt.difficulty || 'classic'
  const diffLabel = diff === 'casual' ? 'CASUAL' : diff === 'expert' ? 'EXPERT' : 'CLASSIC'
  const diffColor = diff === 'casual' ? '#10B981' : diff === 'expert' ? '#EF4444' : '#7C3AED'

  return (
    <div
      style={{
        background: '#1C1C26',
        border: '1px solid #32324A',
        borderRadius: 20,
        marginBottom: 16,
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = accent)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#32324A')}
      onClick={() => onTap(hunt)}
    >
      {/* Synthwave hero */}
      {(() => {
        const { gradient, gridColor } = getCardGradient(hunt)
        return (
          <div style={{ height: 160, background: gradient, position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: `linear-gradient(${gridColor} 1px, transparent 1px), linear-gradient(90deg, ${gridColor} 1px, transparent 1px)`,
              backgroundSize: '30px 30px',
              transform: 'perspective(200px) rotateX(20deg)',
              transformOrigin: 'bottom',
            }} />
          </div>
        )
      })()}

      {/* Pack name  flat, below the tilted hero */}
      <div style={{ padding: '14px 18px 0' }}>
        <div style={{
          fontFamily: "'Nunito', sans-serif",
          fontSize: 21,
          fontWeight: 900,
          color: '#fff',
          lineHeight: 1.2,
        }}>
          {hunt.pack_name}
        </div>
      </div>

      {/* Meta row */}
      <div style={{ padding: '8px 18px 0', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{
          background: badgeColor + '1A',
          color: badgeColor,
          border: '1px solid ' + badgeColor + '44',
          borderRadius: 6,
          padding: '2px 8px',
          fontSize: 10,
          fontFamily: "'Share Tech Mono', monospace",
          letterSpacing: 1.5,
          fontWeight: 700,
        }}>{badgeLabel}</span>
        <span style={{
          background: diffColor + '1A',
          color: diffColor,
          border: '1px solid ' + diffColor + '44',
          borderRadius: 6,
          padding: '2px 8px',
          fontSize: 10,
          fontFamily: "'Share Tech Mono', monospace",
          letterSpacing: 1.5,
          fontWeight: 700,
        }}>{diffLabel}</span>
        <span style={{ color: '#8888BB', fontSize: 11, fontFamily: "'Share Tech Mono', monospace", letterSpacing: 0.8 }}>
          18 MIN
        </span>
        {distLabel && (
          <span style={{ color: '#8888BB', fontSize: 11, fontFamily: "'Share Tech Mono', monospace", letterSpacing: 0.8 }}>
            {distLabel}
          </span>
        )}
        <span style={{ color: '#F59E0B', fontSize: 11, fontFamily: "'Share Tech Mono', monospace" }}>
          4.8 * (124)
        </span>
      </div>

      {/* Bottom row: voucher pill + START HUNT */}
      <div style={{ padding: '10px 18px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{
          background: '#0A0A12',
          border: '1px solid #32324A',
          borderRadius: 20,
          padding: '6px 14px',
          fontSize: 12,
          color: '#B8B4D8',
          fontWeight: 600,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '55%',
        }}>
          {tier === 'elite'
            ? 'Exclusive reward  limited availability'
            : tier === 'premium'
              ? 'Premium reward at destination'
              : 'Reward waiting at destination'}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onTap(hunt) }}
          style={{
            background: 'linear-gradient(135deg, #F59E0B, #FCD34D)',
            color: '#000',
            fontFamily: "'Share Tech Mono', monospace",
            fontWeight: 800,
            fontSize: 11,
            letterSpacing: 2,
            padding: '10px 20px',
            border: 'none',
            borderRadius: 12,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          START HUNT
        </button>
      </div>
    </div>
  )
}

//  Prize Pool Card
function PrizePoolCard({ pool, onTap }) {
  const [countdown, setCountdown] = useState(() => formatCountdown(pool.ends_at))
  useEffect(() => {
    const t = setInterval(() => setCountdown(formatCountdown(pool.ends_at)), 30000)
    return () => clearInterval(t)
  }, [pool.ends_at])

  const poolAmt  = fmtPounds(pool.pool_amount_pence, pool.pool_amount)
  const players  = (pool.player_count ?? 0).toLocaleString('en-GB')

  return (
    <div
      className="prize-card"
      onClick={() => onTap(pool)}
      style={{
        background: 'linear-gradient(135deg, #1A1200 0%, #241A00 50%, #1A1200 100%)',
        border: '2px solid #F59E0B',
        borderRadius: 20,
        marginBottom: 20,
        overflow: 'hidden',
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      {/* Gold shimmer strip */}
      <div style={{
        height: 4,
        background: 'linear-gradient(90deg, #F59E0B, #FCD34D, #F59E0B)',
      }} />

      <div style={{ padding: '16px 20px 20px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #F59E0B, #FCD34D)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, color: '#000', fontWeight: 900, flexShrink: 0,
          }}>&#9733;</div>
          <div>
            <div style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 10,
              letterSpacing: 2,
              color: '#F59E0B',
              fontWeight: 700,
              marginBottom: 2,
            }}>PRIZE HUNT</div>
            <div style={{
              fontFamily: "'Nunito', sans-serif",
              fontSize: 18,
              fontWeight: 900,
              color: '#FCD34D',
              lineHeight: 1.1,
            }}>{pool.title}</div>
          </div>
        </div>

        {/* Prize amount */}
        <div style={{
          fontFamily: "'Nunito', sans-serif",
          fontSize: 36,
          fontWeight: 900,
          color: '#FCD34D',
          letterSpacing: -1,
          marginBottom: 4,
          lineHeight: 1,
        }}>{poolAmt}</div>
        <div style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: 11,
          color: '#B8A050',
          letterSpacing: 1,
          marginBottom: 14,
        }}>PRIZE POOL</div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: '#FCD34D', fontWeight: 700 }}>
              {players}
            </div>
            <div style={{ fontSize: 10, color: '#7A6830', fontFamily: "'Share Tech Mono', monospace", letterSpacing: 0.8, marginTop: 2 }}>
              PLAYERS
            </div>
          </div>
          {countdown && (
            <div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: '#FCD34D', fontWeight: 700 }}>
                {countdown}
              </div>
              <div style={{ fontSize: 10, color: '#7A6830', fontFamily: "'Share Tech Mono', monospace", letterSpacing: 0.8, marginTop: 2 }}>
                REMAINING
              </div>
            </div>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={e => { e.stopPropagation(); onTap(pool) }}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #F59E0B, #FCD34D)',
            color: '#000',
            fontFamily: "'Share Tech Mono', monospace",
            fontWeight: 800,
            fontSize: 13,
            letterSpacing: 2,
            padding: '13px 0',
            border: 'none',
            borderRadius: 12,
            cursor: 'pointer',
          }}
        >
          REGISTER INTEREST
        </button>
      </div>
    </div>
  )
}

//  Prize Pool Screen
function PrizePoolScreen({ pool, onBack }) {
  const [countdown, setCountdown] = useState(() => formatCountdown(pool.ends_at))
  const [email, setEmail] = useState('')
  const [notifySent, setNotifySent] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setCountdown(formatCountdown(pool.ends_at)), 30000)
    return () => clearInterval(t)
  }, [pool.ends_at])

  const poolAmt   = fmtPounds(pool.pool_amount_pence, pool.pool_amount)
  const players   = (pool.player_count ?? 0).toLocaleString('en-GB')

  function handleNotify(e) {
    e.preventDefault()
    if (!email.includes('@')) return
    setNotifySent(true)
  }

  return (
    <div className="puzzle-screen" style={{ background: '#121218', minHeight: '100dvh', color: '#F1F0FF' }}>
      {/* Nav */}
      <div className="pack-nav" style={{ borderBottom: '1px solid #32324A' }}>
        <button className="back-btn" onClick={onBack}>&#8592; Back</button>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, letterSpacing: 2, color: '#F59E0B' }}>
          PRIZE HUNT
        </div>
        <div style={{ width: 56 }} />
      </div>

      <div style={{ padding: '24px 20px 40px', maxWidth: 480, margin: '0 auto' }}>
        {/* Title */}
        <div style={{
          fontFamily: "'Nunito', sans-serif",
          fontSize: 26,
          fontWeight: 900,
          color: '#FCD34D',
          marginBottom: 4,
          lineHeight: 1.2,
        }}>{pool.title}</div>

        {/* Live badge + countdown */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 24 }}>
          <span style={{
            background: 'rgba(16,185,129,0.15)',
            color: '#10B981',
            border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 6,
            padding: '2px 8px',
            fontSize: 10,
            fontFamily: "'Share Tech Mono', monospace",
            letterSpacing: 1.5,
            fontWeight: 700,
          }}>LIVE</span>
          <span style={{ fontSize: 12, color: '#8888BB', fontFamily: "'Share Tech Mono', monospace" }}>
            Ends in {countdown}
          </span>
        </div>

        {/* Big prize */}
        <div style={{
          background: 'linear-gradient(135deg, #1A1200, #241A00)',
          border: '2px solid #F59E0B44',
          borderRadius: 20,
          padding: '24px 20px',
          marginBottom: 20,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 11, fontFamily: "'Share Tech Mono', monospace", letterSpacing: 2, color: '#B8A050', marginBottom: 8 }}>
            TOTAL PRIZE POOL
          </div>
          <div style={{
            fontFamily: "'Nunito', sans-serif",
            fontSize: 56,
            fontWeight: 900,
            color: '#FCD34D',
            letterSpacing: -2,
            lineHeight: 1,
            marginBottom: 8,
          }}>{poolAmt}</div>
        </div>

        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          marginBottom: 20,
        }}>
          {[
            { label: 'PLAYERS', value: players },
            { label: 'ENTRY', value: 'FREE' },
            { label: 'TIME LEFT', value: countdown },
            { label: 'WINNER', value: '1 PLACE' },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: '#1C1C26',
              border: '1px solid #32324A',
              borderRadius: 12,
              padding: '14px 16px',
            }}>
              <div style={{ fontSize: 10, fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1.5, color: '#6B67A0', marginBottom: 6 }}>
                {label}
              </div>
              <div style={{ fontSize: 18, fontFamily: "'Share Tech Mono', monospace", color: '#FCD34D', fontWeight: 700 }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Location hint */}
        {pool.location_hint && (
          <div style={{
            background: '#1C1C26',
            border: '1px solid #32324A',
            borderRadius: 14,
            padding: '16px 18px',
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 10, fontFamily: "'Share Tech Mono', monospace", letterSpacing: 2, color: '#6B67A0', marginBottom: 8 }}>
              LOCATION HINT
            </div>
            <div style={{ fontSize: 14, color: '#B8B4D8', lineHeight: 1.6 }}>
              {pool.location_hint}
            </div>
          </div>
        )}

        {/* Rules */}
        {pool.rules && (
          <div style={{
            background: '#1C1C26',
            border: '1px solid #32324A',
            borderRadius: 14,
            padding: '16px 18px',
            marginBottom: 24,
          }}>
            <div style={{ fontSize: 10, fontFamily: "'Share Tech Mono', monospace", letterSpacing: 2, color: '#6B67A0', marginBottom: 8 }}>
              RULES
            </div>
            <div style={{ fontSize: 13, color: '#B8B4D8', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
              {pool.rules}
            </div>
          </div>
        )}

        {/* Entry CTA — coming soon */}
        <div style={{
          background: 'linear-gradient(135deg, #1A1200, #241A00)',
          border: '1px solid #F59E0B44',
          borderRadius: 16,
          padding: '20px',
        }}>
          <div style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: 11,
            letterSpacing: 2,
            color: '#F59E0B',
            marginBottom: 6,
          }}>PRIZE HUNTS LAUNCHING SOON</div>
          <div style={{ fontSize: 13, color: '#8888BB', marginBottom: 16, lineHeight: 1.5 }}>
            Paid entry with real prize pools is coming. Be the first to know when it goes live.
          </div>
          {notifySent ? (
            <div style={{
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 10,
              padding: '14px 16px',
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 12,
              color: '#10B981',
              textAlign: 'center',
              letterSpacing: 1,
            }}>
              YOU ARE ON THE LIST
            </div>
          ) : (
            <form onSubmit={handleNotify} style={{ display: 'flex', gap: 8 }}>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{
                  flex: 1,
                  background: '#121218',
                  border: '1px solid #32324A',
                  borderRadius: 10,
                  padding: '11px 14px',
                  color: '#F1F0FF',
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 13,
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                style={{
                  background: 'linear-gradient(135deg, #F59E0B, #FCD34D)',
                  color: '#000',
                  fontFamily: "'Share Tech Mono', monospace",
                  fontWeight: 800,
                  fontSize: 11,
                  letterSpacing: 1.5,
                  padding: '11px 16px',
                  border: 'none',
                  borderRadius: 10,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                NOTIFY ME
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

//  Preferences Screen
const VENUE_TYPES = [
  { id: 'food_drink',    label: 'Food & Drink' },
  { id: 'attractions',   label: 'Attractions' },
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'retail',        label: 'Retail' },
  { id: 'sport',         label: 'Sport' },
  { id: 'hospitality',   label: 'Hospitality' },
  { id: 'outdoor',       label: 'Outdoor' },
]
const GENRE_OPTIONS = [
  { id: 'any',     label: 'Any',     note: 'recommended' },
  { id: 'horror',  label: 'Horror',  note: null },
  { id: 'action',  label: 'Action',  note: null },
  { id: 'romance', label: 'Romance', note: null },
  { id: 'sci-fi',  label: 'Sci-Fi',  note: null },
  { id: 'family',  label: 'Family',  note: null },
]

function PreferencesScreen({ initialPrefs, userId, onBack, onSaved }) {
  const [difficulty, setDifficulty]   = useState(initialPrefs.difficulty   || 'classic')
  const [categories, setCategories]   = useState(initialPrefs.categories   || ['food_drink', 'attractions', 'entertainment', 'sport', 'outdoor'])
  const [genres, setGenres]           = useState(initialPrefs.genres       || ['any'])
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)

  function toggleCategory(id) {
    setCategories(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleGenre(id) {
    if (id === 'any') {
      setGenres(['any'])
      return
    }
    setGenres(prev => {
      const without = prev.filter(x => x !== 'any')
      return without.includes(id) ? without.filter(x => x !== id) : [...without, id]
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        preferred_difficulty: difficulty,
        preferred_categories: categories,
        preferred_genres:     genres,
      }
      if (userId) {
        try {
          await supabase.from('profiles').update(payload).eq('id', userId)
        } catch (_) {}
      }
      onSaved({ difficulty, categories, genres })
      setSaved(true)
      setTimeout(onBack, 600)
    } catch {
      setSaving(false)
    }
  }

  const DIFF_OPTIONS = [
    { id: 'casual',  label: 'Casual',  note: 'Mainstream films, helpful hints' },
    { id: 'classic', label: 'Classic', note: 'Mixed films, hints on request' },
    { id: 'expert',  label: 'Expert',  note: 'Deep cuts, no hints' },
  ]
  const DIFF_COLOR = { casual: '#10B981', classic: '#7C3AED', expert: '#EF4444' }

  function SectionHead({ children }) {
    return (
      <div style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: 10,
        letterSpacing: 2.5,
        color: '#6B67A0',
        fontWeight: 700,
        marginBottom: 4,
        marginTop: 28,
      }}>{children}</div>
    )
  }

  return (
    <div style={{ background: '#121218', minHeight: '100dvh', color: '#F1F0FF' }}>
      {/* Nav */}
      <div className="pack-nav" style={{ borderBottom: '1px solid #32324A' }}>
        <button className="back-btn" onClick={onBack}>&#8592; Back</button>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, letterSpacing: 2, color: '#B8B4D8' }}>
          PREFERENCES
        </div>
        <div style={{ width: 56 }} />
      </div>

      <div style={{ padding: '8px 20px 80px', maxWidth: 480, margin: '0 auto' }}>

        {/* Difficulty */}
        <SectionHead>DIFFICULTY</SectionHead>
        <div style={{ background: '#1C1C26', border: '1px solid #32324A', borderRadius: 14, padding: '0 16px', marginBottom: 4 }}>
          {DIFF_OPTIONS.map(opt => (
            <div key={opt.id} className="pref-option" onClick={() => setDifficulty(opt.id)}>
              <div className={`pref-radio${difficulty === opt.id ? ' active' : ''}`}>
                {difficulty === opt.id && <div className="pref-radio-dot" style={{ background: DIFF_COLOR[opt.id] }} />}
              </div>
              <div>
                <div style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: difficulty === opt.id ? DIFF_COLOR[opt.id] : '#F1F0FF',
                  marginBottom: 2,
                }}>{opt.label}</div>
                <div style={{ fontSize: 12, color: '#6B67A0' }}>{opt.note}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Venue Types */}
        <SectionHead>VENUE TYPES I LIKE</SectionHead>
        <div style={{ background: '#1C1C26', border: '1px solid #32324A', borderRadius: 14, padding: '0 16px', marginBottom: 4 }}>
          {VENUE_TYPES.map(v => (
            <div key={v.id} className="pref-option" onClick={() => toggleCategory(v.id)}>
              <div className={`pref-check${categories.includes(v.id) ? ' active' : ''}`}>
                {categories.includes(v.id) && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: categories.includes(v.id) ? '#F1F0FF' : '#8888BB' }}>
                {v.label}
              </div>
            </div>
          ))}
        </div>

        {/* Genres */}
        <SectionHead>FAVOURITE GENRES</SectionHead>
        <div style={{ background: '#1C1C26', border: '1px solid #32324A', borderRadius: 14, padding: '0 16px', marginBottom: 32 }}>
          {GENRE_OPTIONS.map(g => (
            <div key={g.id} className="pref-option" onClick={() => toggleGenre(g.id)}>
              <div className={`pref-check${genres.includes(g.id) ? ' active' : ''}`}>
                {genres.includes(g.id) && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: genres.includes(g.id) ? '#F1F0FF' : '#8888BB' }}>
                  {g.label}
                </span>
                {g.note && (
                  <span style={{ fontSize: 11, color: '#6B67A0', fontFamily: "'Share Tech Mono', monospace" }}>
                    {g.note}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%',
            background: saved
              ? 'rgba(16,185,129,0.15)'
              : saving
                ? '#32324A'
                : 'linear-gradient(135deg, #7C3AED, #9D5FF5)',
            color: saved ? '#10B981' : '#fff',
            border: saved ? '1px solid rgba(16,185,129,0.3)' : 'none',
            borderRadius: 14,
            padding: '15px 0',
            fontFamily: "'Share Tech Mono', monospace",
            fontWeight: 800,
            fontSize: 13,
            letterSpacing: 2,
            cursor: saving ? 'default' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {saved ? 'SAVED' : saving ? 'SAVING...' : 'SAVE PREFERENCES'}
        </button>
      </div>
    </div>
  )
}

function AccessGate({ onSuccess }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  function handleSubmit() {
    if (code.toUpperCase() === 'MAPTEST2026') {
      localStorage.setItem('mtm_access', 'MAPTEST2026')
      onSuccess()
    } else {
      setError(true)
      setShake(true)
      setTimeout(() => setShake(false), 500)
      setCode('')
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at top, #1A0533 0%, #0A0A0F 60%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px', zIndex: 9999,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 32 }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'linear-gradient(135deg, #7C3AED, #9D5FF5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, fontWeight: 900, fontFamily: "'Nunito', sans-serif", color: '#fff',
          boxShadow: '0 0 40px rgba(124,58,237,0.4)',
        }}>M</div>
        <div style={{ textAlign: 'center', lineHeight: 1 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, letterSpacing: 4, color: '#7C3AED', marginBottom: 2 }}>MAP</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, letterSpacing: 4, color: '#9D5FF5', marginBottom: 2 }}>THE</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, letterSpacing: 4, color: '#7C3AED' }}>MOVIE</div>
        </div>
        <div style={{
          marginTop: 12, background: '#7C3AED22', border: '1px solid #7C3AED',
          borderRadius: 6, padding: '4px 12px',
          fontFamily: "'Share Tech Mono', monospace", fontSize: 11, letterSpacing: 3, color: '#9D5FF5',
        }}>PRIVATE BETA</div>
      </div>

      <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="text"
          value={code}
          onChange={e => { setCode(e.target.value.toUpperCase()); setError(false) }}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="ENTER ACCESS CODE"
          autoCapitalize="characters"
          style={{
            background: '#1C1C26', border: `1px solid ${error ? '#EF4444' : '#32324A'}`,
            borderRadius: 10, padding: '14px 16px', color: '#F1F0FF',
            fontFamily: "'Share Tech Mono', monospace", fontSize: 16, letterSpacing: 4,
            textAlign: 'center', outline: 'none', width: '100%', boxSizing: 'border-box',
            animation: shake ? 'shake 0.5s ease' : 'none',
          }}
        />
        {error && (
          <div style={{ color: '#EF4444', fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, textAlign: 'center' }}>
            Invalid access code. Try again.
          </div>
        )}
        <button
          onClick={handleSubmit}
          style={{
            background: 'linear-gradient(135deg, #7C3AED, #9D5FF5)', border: 'none',
            borderRadius: 10, padding: '14px', color: '#fff',
            fontFamily: "'Share Tech Mono', monospace", fontSize: 14, letterSpacing: 3,
            cursor: 'pointer', width: '100%',
          }}
        >ENTER</button>
      </div>
    </div>
  )
}

//  Hunt Discovery
function HuntDiscovery({ hunts, loading, error, onStart, userPos, prizePool, onPrizePool, prefs, onPrefs }) {
  const [viewMode, setViewMode] = useState('list')

  function handleTap(hunt) {
    onStart(hunt)
  }

  function distLabel(hunt) {
    if (!userPos || !hunt.approx_lat) return null
    return fmtDistance(
      haversineMetres(userPos.lat, userPos.lon, hunt.approx_lat, hunt.approx_lon)
    )
  }

  const activeGenres = prefs?.genres || []
  const genreFiltered = (!activeGenres.length || activeGenres.includes('any'))
    ? hunts
    : hunts.filter(h => !h.genre || activeGenres.includes(h.genre))

  return (
    <div className="discover-screen">
      <div className="logo-wrap" style={{ position: 'relative' }}>
        <button className="settings-btn" onClick={onPrefs} title="Preferences" aria-label="Open preferences">
          &#9881;
        </button>
        <LogoSVG />
        <div className="logo-wordmark">
          <span className="logo-map">MAP</span>
          <span className="logo-the"> T H E </span>
          <span className="logo-movie">MOVIE</span>
        </div>
        <div className="logo-sub">Solve the Clue &middot; Find the Location</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '20px 0 14px' }}>
        <div className="section-label" style={{ marginBottom: 0 }}>Hunts available near you</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="view-toggle"
            style={{
              background: viewMode === 'list' ? '#7C3AED' : '#252533',
              color: viewMode === 'list' ? '#fff' : '#8888BB',
            }}
            onClick={() => setViewMode('list')}
          >
            List
          </button>
          <button
            className="view-toggle"
            style={{
              background: viewMode === 'map' ? '#7C3AED' : '#252533',
              color: viewMode === 'map' ? '#fff' : '#8888BB',
            }}
            onClick={() => setViewMode('map')}
          >
            Map
          </button>
        </div>
      </div>

      {loading && (
        <div className="loading-state">
          <div className="spinner" />
          Loading hunts nearby
        </div>
      )}

      {error && !loading && (
        <div className="error-state">
          {'!'} {error}
          <div style={{ fontSize: 11, marginTop: 6, color: '#B8B4D8' }}>
            Check your connection and try again.
          </div>
        </div>
      )}

      {!loading && !error && genreFiltered.length === 0 && hunts.length > 0 && (
        <div className="empty-state">
          No hunts match your genre preferences.
          <div style={{ fontSize: 11, color: '#32324A', marginTop: 6 }}>
            Tap the settings icon to adjust your preferences.
          </div>
        </div>
      )}

      {!loading && !error && hunts.length === 0 && (
        <div className="empty-state">

          No active hunts in this area yet.
          <div style={{ fontSize: 11, color: '#32324A', marginTop: 6 }}>
            Check back soon  more hunts coming your way.
          </div>
        </div>
      )}

      {viewMode === 'map' && !loading && hunts.length > 0 && (
        <div className="map-wrap">
          <HuntMap
            key="hunt-map"
            hunts={hunts}
            userPos={userPos}
            onHuntSelect={hunt => {
              setViewMode('list')
              setTimeout(() => handleTap(hunt), 100)
            }}
          />
          <div className="map-legend">
             Purple = Standard &nbsp;&nbsp;  Gold = Premium &nbsp;&nbsp; {'*'} = Elite
            &nbsp;&nbsp; Locations approximate
          </div>
        </div>
      )}

      {viewMode === 'list' && !loading && prizePool && (
        <PrizePoolCard pool={prizePool} onTap={onPrizePool} />
      )}

      {viewMode === 'list' && !loading && genreFiltered.map(h => (
        <HuntCard
          key={h.campaign_id}
          hunt={h}
          onTap={handleTap}
          distLabel={distLabel(h)}
        />
      ))}

      <div className="app-footer">
        <a className="footer-link" href="/privacy">Privacy</a>
        <a className="footer-link" href="/terms">Terms</a>
        <a className="footer-link" href="/dashboard">Business Login</a>
      </div>
    </div>
  )
}

//  Coord Display 
function CoordDisplay({ hunt, solved }) {
  const slots = hunt?.coordinate_slots || []
  const accent = hexAccent(hunt?.accent_color)
  const solvedCount = Object.keys(solved).length
  const progress = slots.length > 0 ? (solvedCount / slots.length) * 100 : 0

  function renderStr(str) {
    if (!str) return null
    return (
      <div className="coord-row">
        {str.split('').map((ch, i) => {
          if (slots.includes(ch)) {
            const digit = solved[ch]
            return digit !== undefined
              ? <span key={i} className="coord-slot-box solved">{digit}</span>
              : <span key={i} className="coord-slot-box pending">_</span>
          }
          return <span key={i} className="coord-fixed">{ch}</span>
        })}
      </div>
    )
  }

  return (
    <div className="coord-bar">
      <div className="coord-label">TARGET COORDINATES</div>
      <div className="coord-strings">
        {renderStr(hunt?.masked_lat)}
        {renderStr(hunt?.masked_lon)}
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress}%`, background: accent }} />
      </div>
    </div>
  )
}

//  Signal Bar 
function TakesBar({ points, max, accent }) {
  const warn = points <= Math.ceil(max * 0.3)
  const barColor = warn ? '#EF4444' : accent
  const prevPointsRef = useRef(points)
  const [burnedIndex, setBurnedIndex] = useState(null)

  // Identify which specific pip just burned (the last active one before
  // this decrease) so only that one plays the clap animation, not the
  // whole bar re-animating on every wrong answer.
  useEffect(() => {
    if (points < prevPointsRef.current) {
      const burned = prevPointsRef.current - 1
      setBurnedIndex(burned)
      const t = setTimeout(() => setBurnedIndex(null), 400)
      prevPointsRef.current = points
      return () => clearTimeout(t)
    }
    prevPointsRef.current = points
  }, [points])

  return (
    <div className="takes-bar">
      <span className="takes-label">TAKES</span>
      <div className="takes-pips">
        {Array.from({ length: max }, (_, i) => {
          const active = i < points
          return (
            <div
              key={i}
              className="takes-pip"
              style={{
                background: active ? barColor : '#252533',
                animation: i === burnedIndex ? 'slateClap 0.4s ease' : 'none',
              }}
            >
              <div className="takes-pip-stripe" style={{ opacity: active ? 0.55 : 0.3 }} />
            </div>
          )
        })}
      </div>
      <span className="takes-count" style={{ color: warn ? '#EF4444' : '#B8B4D8' }}>
        TAKE {points} OF {max}
      </span>
    </div>
  )
}

//  Lockout Timer 
function LockoutTimer({ until, onExpire }) {
  const [secs, setSecs] = useState(0)

  useEffect(() => {
    function tick() {
      const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000))
      setSecs(remaining)
      if (remaining === 0) onExpire()
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [until, onExpire])

  return (
    <div className="lockout-box">
      {''} LOCKED  Try again in {secs}s
    </div>
  )
}

//  Puzzle Card 
function PuzzleCard({ question, solvedDigit, onSubmitAnswer, accent, difficulty }) {
  const [input, setInput] = useState('')
  const [status, setStatus] = useState('idle')
  const [msg, setMsg] = useState('')
  const [showHint, setShowHint] = useState(difficulty === 'casual')
  const [lockoutUntil, setLockoutUntil] = useState(null)
  const isSolved = solvedDigit !== undefined

  async function handleSubmit() {
    const val = input.trim()
    if (!val || status === 'submitting' || lockoutUntil) return

    setStatus('submitting')
    setMsg('')

    const result = await onSubmitAnswer(question.slot, val)

    if (!result) { setStatus('idle'); return }

    if (result.correct) {
      setStatus('correct')
      setMsg('Correct!')
    } else if (result.locked_out) {
      setLockoutUntil(new Date(result.locked_until).getTime())
      setStatus('idle')
      setInput('')
    } else if (result.signal_points_remaining === 0) {
      setStatus('idle')
      setMsg('Out of takes.')
    } else {
      setStatus('wrong')
      const left = result.attempts_remaining
      setMsg(
        left != null
          ? `Wrong. ${left} attempt${left !== 1 ? 's' : ''} left before lockout.`
          : 'Wrong answer. Try again.'
      )
      setTimeout(() => { setStatus('idle'); setInput('') }, 800)
    }
  }

  if (isSolved) {
    return (
      <div className="puzzle-card solved">
        <div className="puzzle-slot-tag">SLOT {question.slot}</div>
        {(question.movie_title || question.movie_emoji) && (
          <div className="puzzle-movie">
            
            <span>{question.movie_title}{question.movie_year ? ' ' + question.movie_year : ''}</span>
          </div>
        )}
        <div className="puzzle-question">{question.question_text}</div>
        <div className="puzzle-solved-badge">
          <span>{'+'}</span>
          <span>Digit {question.slot} = {solvedDigit}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="puzzle-card" style={{ borderColor: '#32324A' }}>
      {lockoutUntil && lockoutUntil > Date.now() ? (
        <>
          <div className="puzzle-slot-tag">SLOT {question.slot}</div>
          {(question.movie_title || question.movie_emoji) && (
            <div className="puzzle-movie">
              
              <span>{question.movie_title}{question.movie_year ? ' ' + question.movie_year : ''}</span>
            </div>
          )}
          <div className="puzzle-question">{question.question_text}</div>
          <LockoutTimer until={lockoutUntil} onExpire={() => setLockoutUntil(null)} />
        </>
      ) : (
        <>
          <div className="puzzle-slot-tag">SLOT {question.slot}</div>
          {(question.movie_title || question.movie_emoji) && (
            <div className="puzzle-movie">
              
              <span>{question.movie_title}{question.movie_year ? ' ' + question.movie_year : ''}</span>
            </div>
          )}
          {question.category && (
            <div className="puzzle-category">{question.category}</div>
          )}
          <div className="puzzle-question">{question.question_text}</div>
          {question.hint_text && difficulty !== 'expert' && (
            <>
              {difficulty === 'casual'
                ? <div className="puzzle-hint">{question.hint_text}</div>
                : <>
                    <button className="hint-toggle" onClick={() => setShowHint(h => !h)}>
                      {showHint ? 'hide hint' : 'show hint'}
                    </button>
                    {showHint && <div className="puzzle-hint">{question.hint_text}</div>}
                  </>
              }
            </>
          )}
          <div className="puzzle-input-row">
            <input
              className={`puzzle-input ${status === 'wrong' ? 'wrong' : ''}`}
              type="number"
              min="0"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder={question.placeholder || 'e.g. 42'}
              disabled={status === 'submitting'}
            />
            <button
              className="puzzle-submit"
              style={{
                background: !input
                  ? '#32324A'
                  : status === 'correct'
                    ? '#10B981'
                    : status === 'wrong'
                      ? '#EF4444'
                      : 'linear-gradient(135deg, #F59E0B, #FCD34D)',
                color: !input ? '#8888BB' : status === 'correct' || status === 'wrong' ? '#fff' : '#000',
              }}
              onClick={handleSubmit}
              disabled={!input || status === 'submitting'}
            >
              {status === 'submitting' ? '...' : status === 'correct' ? 'Correct!' : 'SUBMIT'}
            </button>
          </div>
          {msg && (
            <div className={`puzzle-msg ${status === 'correct' ? 'ok' : 'err'}`}>{msg}</div>
          )}
        </>
      )}
    </div>
  )
}

//  Compass Screen
// target = { lat, lon, geofence_m, isWaypoint, label }
function CompassScreen({ target, hunt, onArrived, onWaypointReached, compassMsg }) {
  const [playerPos, setPlayerPos] = useState(null)
  const [distance, setDistance] = useState(null)
  const [startDist, setStartDist] = useState(null)
  // null | 'denied' | 'unavailable' — set from getCurrentPosition's error
  // callback. Only surfaced in the UI before a first fix (see gpsStatus
  // below) so a later transient failure doesn't wipe an already-showing
  // distance/flicker the screen every 5s poll.
  const [geoError, setGeoError] = useState(null)
  const intervalRef = useRef(null)
  const [toBearing, setToBearing] = useState(0)
  // orientState: 'init' | 'needs-permission' | 'active' | 'calibrating' | 'denied' | 'unsupported'
  const [orientState, setOrientState] = useState('init')
  const [deviceHeading, setDeviceHeading] = useState(null)
  const orientCleanupRef = useRef(null)
  const arrivedRef = useRef(false)
  const headingHistoryRef = useRef([])
  const smoothedDistRef = useRef(null)
  const toastTimeoutRef = useRef(null)
  const [tempToast, setTempToast] = useState(null) // { type: 'warmer' | 'colder' }
  // Two-slot crossfade for the temperature glow: each slot holds a static
  // colour, and only `active` toggles between them on tier change, so the
  // transition is opacity (GPU-composited) rather than animating the
  // background/gradient string itself (paint-level, unreliable to
  // interpolate across browsers).
  const [glowLayers, setGlowLayers] = useState({ active: 0, colors: [null, null] })
  const [debugTargetOverride, setDebugTargetOverride] = useState(null)
  const [showDebug, setShowDebug] = useState(() => window.location.search.includes('debug=true'))
  const showDebugRef = useRef(showDebug)
  useEffect(() => { showDebugRef.current = showDebug }, [showDebug])
  // TEMP — Safari/iOS heading jitter investigation. Logs raw (pre-smoothing)
  // heading readings with time-since-last-reading and degree-change-since-last
  // -reading, so real firing frequency and jitter magnitude can be read off
  // the debug panel on an actual device instead of guessed at. Remove once
  // the smoothing threshold/outlier-rejection values are picked from real data.
  const [rawHeadingLog, setRawHeadingLog] = useState([])
  const tapTimeRef = useRef([])
  const [manualLat, setManualLat] = useState('')
  const [manualLon, setManualLon] = useState('')
  const [showStuckModal, setShowStuckModal] = useState(false)
  const [stuckReason, setStuckReason] = useState('')
  const [skipCount, setSkipCount] = useState(
    parseInt(localStorage.getItem('mtm_skip_count') || '0')
  )
  const MAX_SKIPS = 2

  const effectiveTarget = debugTargetOverride ?? target

  const targetRef = useRef(effectiveTarget)
  const onArrivedRef = useRef(onArrived)
  const onWaypointReachedRef = useRef(onWaypointReached)
  useEffect(() => { targetRef.current = effectiveTarget }, [effectiveTarget])
  useEffect(() => { onArrivedRef.current = onArrived }, [onArrived])
  useEffect(() => { onWaypointReachedRef.current = onWaypointReached }, [onWaypointReached])

  const accent = hexAccent(hunt?.accent_color)
  const geofence = effectiveTarget?.geofence_m ?? diffGeofence(hunt?.difficulty)

  // WebKit/Safari detection — reused for both the orientation-permission
  // gate below and the GPS acquisition config, since iOS's Core Location
  // stack is slower to reach a high-accuracy fix than Chrome/Android.
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

  function handleDebugTap() {
    const now = Date.now()
    tapTimeRef.current = tapTimeRef.current.filter(t => now - t < 2000)
    tapTimeRef.current.push(now)
    if (tapTimeRef.current.length >= 5) {
      setShowDebug(true)
      tapTimeRef.current = []
    }
  }

  // GPS polling — getCurrentPosition every 5 seconds (Safari-compatible, no watchPosition)
  useEffect(() => {
    function getPosition() {
      if (!navigator.geolocation) return
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGeoError(null)
          const lat = pos.coords.latitude
          const lon = pos.coords.longitude
          setPlayerPos({ lat, lon })
          if (effectiveTarget?.lat) {
            const R = 6371000
            const dLat = (effectiveTarget.lat - lat) * Math.PI / 180
            const dLon = (effectiveTarget.lon - lon) * Math.PI / 180
            const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat * Math.PI / 180) *
              Math.cos(effectiveTarget.lat * Math.PI / 180) *
              Math.sin(dLon / 2) ** 2
            const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
            setDistance(dist)
            setStartDist(prev => prev ?? dist)

            // Warmer/colder toast — compares an EMA of distance, not the raw
            // per-poll reading, so single-poll GPS jitter doesn't flip the
            // toast back and forth. Equal 0.5/0.5 weighting: light damping
            // without adding much lag on top of the already-slow 5s poll.
            // Deliberately separate from `distance` above — the glow/phrase
            // tiers and the geofence arrival check keep using the raw value.
            const prevSmoothed = smoothedDistRef.current
            const smoothed = prevSmoothed == null ? dist : prevSmoothed * 0.5 + dist * 0.5
            smoothedDistRef.current = smoothed
            if (prevSmoothed != null) {
              const delta = smoothed - prevSmoothed
              if (delta <= -5) showTempToast('warmer')
              else if (delta >= 5) showTempToast('colder')
            }
          }
        },
        (err) => {
          // code 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
          // (common on iOS Safari under enableHighAccuracy, especially indoors)
          setGeoError(err.code === 1 ? 'denied' : 'unavailable')
        },
        // iOS Core Location is slower to escalate to a high-accuracy fix than
        // Chrome/Android — a 10s timeout on a cold GPS radio produces
        // repeated TIMEOUT errors on Safari specifically. Longer timeout and
        // maximumAge on Safari reduces forced fresh high-accuracy reads;
        // non-Safari keeps the original values.
        isSafari
          ? { enableHighAccuracy: true, maximumAge: 12000, timeout: 25000 }
          : { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
      )
    }
    getPosition()
    intervalRef.current = setInterval(getPosition, 5000)

    // iOS Safari suspends timers when the screen locks/backgrounds — on
    // resume, get a fresh fix immediately and restart the poll rather than
    // waiting out whatever's left of the old 5s interval (which may itself
    // have been cleared/throttled by the OS while hidden).
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        if (intervalRef.current) clearInterval(intervalRef.current)
        getPosition()
        intervalRef.current = setInterval(getPosition, 5000)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      if (intervalRef.current) clearInterval(intervalRef.current)
      clearTimeout(toastTimeoutRef.current)
    }
  }, [effectiveTarget])

  // Bearing + arrival detection whenever position or distance updates
  useEffect(() => {
    const t = targetRef.current
    if (!playerPos || !t?.lat || !t?.lon) return
    setToBearing(bearingDegrees(playerPos.lat, playerPos.lon, t.lat, t.lon))
    if (distance != null && distance <= (t.geofence_m || 15) && !arrivedRef.current) {
      arrivedRef.current = true
      // startDist is this leg's straight-line distance when GPS first
      // locked — reported up so the parent can accumulate a "distance
      // walked" total across waypoint legs for the arrival reveal screen.
      if (t.isWaypoint) { onWaypointReachedRef.current?.(startDist) }
      else { onArrivedRef.current?.(playerPos.lat, playerPos.lon, startDist) }
    }
  }, [playerPos, distance])

  // Device orientation: Safari iOS requires explicit permission; others auto-start
  useEffect(() => {
    if (isSafari && typeof DeviceOrientationEvent?.requestPermission === 'function') {
      setOrientState('needs-permission')
    } else if ('DeviceOrientationEvent' in window || 'ondeviceorientation' in window) {
      startOrientListener()
    } else {
      setOrientState('unsupported')
    }

    // iOS Safari stops delivering deviceorientation events when the screen
    // locks/backgrounds, even with listeners still attached. On resume,
    // re-attach fresh listeners if we'd already started them (orientCleanupRef
    // is only ever set by startOrientListener, so this is unset for
    // needs-permission/denied/unsupported — we never re-prompt for permission
    // here, only re-attach when it was already granted and running).
    function handleVisibility() {
      if (document.visibilityState === 'visible' && orientCleanupRef.current) {
        orientCleanupRef.current()
        startOrientListener()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      if (orientCleanupRef.current) orientCleanupRef.current()
    }
  }, [])

  function showTempToast(type) {
    clearTimeout(toastTimeoutRef.current)
    setTempToast({ type })
    toastTimeoutRef.current = setTimeout(() => setTempToast(null), 2000)
  }

  function smoothHeading(newHeading) {
    const h = headingHistoryRef.current
    h.push(newHeading)
    if (h.length > 8) h.shift()
    if (h.length === 1) return h[0]
    // Circular mean: adjust values near 0/360 boundary before averaging
    const ref = h[0]
    const adjusted = h.map(v => {
      if (ref > 270 && v < 90) return v + 360
      if (ref < 90 && v > 270) return v - 360
      return v
    })
    return ((adjusted.reduce((a, b) => a + b, 0) / adjusted.length) % 360 + 360) % 360
  }

  function startOrientListener() {
    setOrientState('calibrating')
    let fired = false
    let absoluteFired = false
    const timeoutId = setTimeout(() => { if (!fired) setOrientState('unsupported') }, 3000)

    function handleOrientation(e) {
      if (e.type === 'deviceorientation' && absoluteFired) return

      // webkitCompassHeading is WebKit-only and, when present, is always a
      // number: a real 0-360 heading, or -1 while the compass is uncalibrated
      // (common on older/interference-prone hardware, e.g. iPhone 8). On -1,
      // hold the last known good heading rather than falling through to
      // alpha — alpha on a plain (non-absolute) deviceorientation event is a
      // different, non-north-referenced frame, and switching between the two
      // mid-walk is what causes the needle to appear to spin wildly. Only
      // fall back to alpha when webkitCompassHeading doesn't exist at all
      // (non-WebKit browsers).
      let heading = null
      if (typeof e.webkitCompassHeading === 'number') {
        if (e.webkitCompassHeading < 0) return // uncalibrated — hold last good heading
        heading = e.webkitCompassHeading
      } else if (e.alpha != null) {
        heading = (360 - e.alpha + 360) % 360
      }
      if (heading == null) return

      if (e.type === 'deviceorientationabsolute') absoluteFired = true
      if (!fired) { fired = true; clearTimeout(timeoutId); setOrientState('active') }

      // TEMP — see rawHeadingLog above. Records the raw reading BEFORE
      // smoothHeading touches it, so the log reflects actual sensor jitter.
      if (showDebugRef.current) {
        setRawHeadingLog(prev => {
          const last = prev[prev.length - 1]
          const now = performance.now()
          const dtMs = last ? Math.round(now - last.t) : null
          let dDeg = null
          if (last) {
            const diff = Math.abs(heading - last.heading)
            dDeg = Math.round((diff > 180 ? 360 - diff : diff) * 10) / 10
          }
          const entry = { t: now, heading: Math.round(heading * 10) / 10, dtMs, dDeg }
          return [...prev.slice(-39), entry]
        })
      }

      const smoothed = smoothHeading(heading)
      setDeviceHeading(smoothed)
    }

    window.addEventListener('deviceorientationabsolute', handleOrientation, true)
    window.addEventListener('deviceorientation', handleOrientation, true)
    orientCleanupRef.current = () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation, true)
      window.removeEventListener('deviceorientation', handleOrientation, true)
    }
  }

  async function requestCompassPermission() {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const result = await DeviceOrientationEvent.requestPermission()
        if (result === 'granted') {
          startOrientListener()
        } else {
          setOrientState('denied')
        }
      } catch {
        setOrientState('denied')
      }
    } else {
      // Non-Safari: no permission needed, start directly
      startOrientListener()
    }
  }

  // Arrow rotation: bearing-to-destination minus device heading = screen-relative angle
  const arrowDeg = deviceHeading != null
    ? (toBearing - deviceHeading + 360) % 360
    : toBearing  // fallback: north-relative bearing

  const CARDINAL = ['N','NE','E','SE','S','SW','W','NW']
  const cardinalDir = () => CARDINAL[Math.round(toBearing / 45) % 8]
  const cardinalFull = () => ({
    N:'north', NE:'north-east', E:'east', SE:'south-east',
    S:'south', SW:'south-west', W:'west', NW:'north-west',
  })[cardinalDir()] || 'north'

  // Once a fix has ever landed, stay 'active' even through a later transient
  // error — otherwise a single dropped poll every 5s would flicker the
  // screen back to an error message despite still having a usable position.
  const gpsStatus = playerPos ? 'active' : (geoError || 'searching')
  const gpsStatusText = {
    searching:   'ACQUIRING GPS',
    active:      `GPS ACTIVE  TARGET ~${geofence}m`,
    denied:      'GPS PERMISSION DENIED',
    unavailable: 'GPS UNAVAILABLE',
  }[gpsStatus]

  // Needle rotates as soon as heading is available, independent of distance
  const needleRotation = deviceHeading != null ? toBearing - deviceHeading : 0
  const searching = deviceHeading == null
  // Green state: needle pointing within 20 degrees of destination
  const normalisedAngle = (() => {
    const diff = Math.abs(needleRotation % 360)
    return diff > 180 ? 360 - diff : diff
  })()
  const isFacingDestination = deviceHeading != null && normalisedAngle < 20
  // Red state: needle pointing away from destination (>160 degrees off)
  const isHeadingAway = deviceHeading != null && normalisedAngle > 160
  // Inside the geofence, distance rounds to "0.0 km" (looks like "arrived"),
  // so a directional instruction like TURN AROUND reads as a contradiction
  // rather than guidance -- swap to an arrival-adjacent message instead.
  const isVeryClose = distance != null && distance <= geofence
  const headingColor = isFacingDestination ? '#5DCAA5' : isHeadingAway ? '#E24B4A' : null
  const journeyPct = startDist > 0
    ? Math.min(100, Math.max(0, ((startDist - (distance || 0)) / startDist) * 100))
    : 0
  const distMi = (distance != null && distance >= 0) ? (distance / 1000).toFixed(1) : '--'
  const destLabel = (distance != null && distance >= 0)
    ? (target?.isWaypoint ? 'KM TO WAYPOINT' : 'KM TO DESTINATION')
    : 'CALCULATING...'
  // Temperature ambient glow — separate colour axis from headingColor above
  // (blue -> purple -> gold), never green/red, so the two systems never
  // share a colour. Replaces the old 3-tier near-black wash with the full
  // 6-tier temperature band.
  const tempTier = getTemperatureTier(distance)

  useEffect(() => {
    if (!tempTier) return
    setGlowLayers(prev => {
      if (prev.colors[prev.active] === tempTier.color) return prev
      const next = prev.active === 0 ? 1 : 0
      const colors = [...prev.colors]
      colors[next] = tempTier.color
      return { active: next, colors }
    })
  }, [tempTier?.key])

  return (
    <div className="compass-wrap">
      {/* Temperature glow — two static layers crossfading via opacity
          (GPU-composited) instead of transitioning the background/gradient
          string itself, which paints every frame and doesn't reliably
          interpolate between different gradients across browsers. */}
      {glowLayers.colors.map((c, i) => c && (
        <div key={i} style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(ellipse at 50% 30%, ${hexToRgba(c, 0.30)} 0%, #08080F 70%)`,
          opacity: glowLayers.active === i ? 1 : 0,
          transition: 'opacity 1s ease',
        }} />
      ))}

      {/* Waypoint / destination badge — tap 5× quickly to open debug panel */}
      <div
        onClick={handleDebugTap}
        style={{
          background: effectiveTarget?.isWaypoint ? 'linear-gradient(135deg, #F59E0B, #FCD34D)' : '#10B981',
          color: effectiveTarget?.isWaypoint ? '#000' : '#fff',
          fontFamily: "'Share Tech Mono', monospace",
          fontWeight: 800, fontSize: 13, padding: '6px 16px',
          borderRadius: 20, letterSpacing: 1,
          cursor: 'default', userSelect: 'none',
        }}
      >
        {effectiveTarget?.isWaypoint ? (effectiveTarget?.label || 'WAYPOINT') : 'DESTINATION'}
      </div>

      {/* Film-reel compass ring — 280px */}
      <div className="compass-arrow-wrap">
        {/* Instrument bezel/housing — cosmetic only, sits behind the dial.
            Inserted first in DOM (no z-index) so the existing ring/sweep/
            needle, which also use z-index:auto, paint on top of it. */}
        <div style={{
          position: 'absolute', inset: -18, borderRadius: '50%',
          background: 'radial-gradient(circle at 32% 28%, #3A3A52 0%, #1C1C26 55%, #08080F 100%)',
          border: '1px solid #32324A',
          boxShadow: 'inset 0 2px 5px rgba(255,255,255,0.08), inset 0 -4px 10px rgba(0,0,0,0.6), 0 8px 22px rgba(0,0,0,0.5)',
        }} />

        {/* Distance rings — decorative gradations inside the bezel */}
        <svg viewBox="0 0 316 316" style={{ position: 'absolute', inset: -18, width: 316, height: 316, pointerEvents: 'none' }}>
          <circle cx={158} cy={158} r={132} fill="none" stroke="#32324A" strokeWidth={1} opacity={0.5} />
          <circle cx={158} cy={158} r={108} fill="none" stroke="#32324A" strokeWidth={1} opacity={0.35} />
        </svg>

        {/* Cardinal N/E/S/W tick marks — fixed/decorative, not a rotating
            compass rose. The needle's rotation is relative (turn-this-much-
            from-where-you're-facing), not an absolute magnetic bearing, so
            a rotating ring here would create two contradictory reference
            frames on the same instrument. Static, same as the bezel. */}
        <svg
          viewBox="0 0 316 316"
          style={{ position: 'absolute', inset: -18, width: 316, height: 316, pointerEvents: 'none' }}
        >
          {['N', 'E', 'S', 'W'].map((label, i) => {
            const angle = i * 90
            const rad = (angle - 90) * Math.PI / 180
            const x1 = 158 + 150 * Math.cos(rad), y1 = 158 + 150 * Math.sin(rad)
            const x2 = 158 + 136 * Math.cos(rad), y2 = 158 + 136 * Math.sin(rad)
            const lx = 158 + 120 * Math.cos(rad), ly = 158 + 120 * Math.sin(rad)
            return (
              <g key={label}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#9D5FF5" strokeWidth={3} strokeLinecap="round" />
                <text x={lx} y={ly} fill="#9D5FF5" fontSize={13} fontWeight={800}
                  textAnchor="middle" dominantBaseline="middle"
                  fontFamily="'Share Tech Mono', monospace">{label}</text>
              </g>
            )
          })}
          {[45, 135, 225, 315].map(angle => {
            const rad = (angle - 90) * Math.PI / 180
            const x1 = 158 + 148 * Math.cos(rad), y1 = 158 + 148 * Math.sin(rad)
            const x2 = 158 + 140 * Math.cos(rad), y2 = 158 + 140 * Math.sin(rad)
            return <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#6B67A0" strokeWidth={2} strokeLinecap="round" opacity={0.6} />
          })}
        </svg>

        {/* Outer ring — reactive green/red heading state via inline styles */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: `3px solid ${headingColor || '#7C3AED'}`,
          boxShadow: isFacingDestination
            ? '0 0 30px rgba(93,202,165,0.4), inset 0 0 24px rgba(93,202,165,0.12)'
            : isHeadingAway
              ? '0 0 30px rgba(226,75,74,0.4), inset 0 0 24px rgba(226,75,74,0.12)'
              : '0 0 20px rgba(124,58,237,0.3), inset 0 0 24px rgba(124,58,237,0.12)',
          transition: isHeadingAway ? 'none' : 'border-color 0.4s, box-shadow 0.4s',
        }} />

        {/* Radar sweep — rotating line, sonar/spy feel */}
        <svg viewBox="0 0 280 280" style={{ position: 'absolute', inset: 0, width: 280, height: 280, pointerEvents: 'none' }}>
          <line
            className="compass-radar-line"
            x1={140} y1={140} x2={140} y2={20}
            stroke={headingColor || '#7C3AED'}
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.55}
          />
        </svg>

        {/* Sprocket holes — 11 dark-filled circles via SVG, film-reel perforation motif */}
        <svg style={{ position: 'absolute', inset: 0, width: 280, height: 280 }}>
          {Array.from({ length: 11 }, (_, i) => {
            const angle = (i * (360 / 11) * Math.PI) / 180
            const cx = 140 + 130 * Math.cos(angle - Math.PI / 2)
            const cy = 140 + 130 * Math.sin(angle - Math.PI / 2)
            return <circle key={i} cx={cx} cy={cy} r={4} fill="#2A2A3E" />
          })}
        </svg>

        {/* Needle — tapered, diamond-tipped shape; rotates based on bearing,
            static (north-up) when no data. Same headingColor/gradient/
            drop-shadow logic as before, just SVG polygons instead of two
            plain rectangles. */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 20, height: 140,
          transformOrigin: 'bottom center',
          transform: `translate(-50%, -100%) rotate(${needleRotation}deg)`,
          transition: searching ? 'none' : 'transform 0.5s ease',
          opacity: orientState === 'needs-permission' ? 0.35 : 1,
        }}>
          <svg width={20} height={140} viewBox="-10 0 20 140" style={{ display: 'block' }}>
            <defs>
              <linearGradient id="needleTipGrad" x1="0" y1="0" x2="0" y2="70">
                <stop offset="0%" stopColor="#FCD34D" />
                <stop offset="100%" stopColor="#F59E0B" />
              </linearGradient>
            </defs>
            {/* Diamond-faceted tip tapering into the shaft — gold by default,
                green when facing destination, red when heading away */}
            <polygon
              points="0,0 7,20 4,70 -4,70 -7,20"
              style={{
                fill: headingColor || 'url(#needleTipGrad)',
                filter: isFacingDestination
                  ? 'drop-shadow(0 0 6px rgba(93,202,165,0.8))'
                  : isHeadingAway
                    ? 'drop-shadow(0 0 6px rgba(226,75,74,0.8))'
                    : 'drop-shadow(0 0 6px rgba(245,158,11,0.8))',
                transition: isHeadingAway ? 'none' : 'fill 0.4s, filter 0.4s',
              }}
            />
            {/* Base — grey, flares wider near the hub */}
            <polygon points="4,70 -4,70 -7,140 7,140" fill="#32324A" />
          </svg>
        </div>

        {/* Centre pivot — layered hub, concentric rings like a real compass
            pivot. Same headingColor-driven middle disc as the old single
            dot; outer ring/groove/pin are new decorative layers only. */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 28, height: 28,
          zIndex: 3,
        }}>
          <svg width={28} height={28} viewBox="0 0 28 28">
            <circle cx={14} cy={14} r={13} fill="none" stroke="#9D5FF5" strokeWidth={2} />
            <circle cx={14} cy={14} r={10.5} fill="none" stroke="#32324A" strokeWidth={1} opacity={0.6} />
            <circle
              cx={14} cy={14} r={8}
              style={{ fill: headingColor || '#7C3AED', transition: isHeadingAway ? 'none' : 'fill 0.4s' }}
            />
            <circle cx={14} cy={14} r={3} fill="#0A0A12" opacity={0.85} />
          </svg>
        </div>
      </div>

      {/* Temperature phrase — primary readout; exact distance is secondary */}
      <div style={{ textAlign: 'center', marginTop: 24, position: 'relative' }}>
        {/* Warmer/colder toast — anchored to the phrase, not the whole screen */}
        {tempToast && (
          <div
            key={tempToast.type + Date.now()}
            style={{
              position: 'absolute', top: -14, left: '50%',
              padding: '6px 18px', borderRadius: 20,
              fontFamily: "'Share Tech Mono', monospace", fontSize: 13, fontWeight: 800,
              letterSpacing: 1, whiteSpace: 'nowrap', zIndex: 10,
              background: tempToast.type === 'warmer' ? '#F59E0B' : '#2563EB',
              color: tempToast.type === 'warmer' ? '#000' : '#fff',
              boxShadow: tempToast.type === 'warmer'
                ? '0 0 20px rgba(245,158,11,0.5)'
                : '0 0 20px rgba(37,99,235,0.5)',
              animation: 'temp-toast-pop 2s ease forwards',
            }}
          >
            {tempToast.type === 'warmer' ? 'Warmer!' : 'Colder...'}
          </div>
        )}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: 30, fontWeight: 900, letterSpacing: 1,
          color: tempTier?.color || '#F1F0FF', lineHeight: 1.2, minHeight: 36,
          textShadow: tempTier ? `0 0 20px ${hexToRgba(tempTier.color, 0.5)}` : 'none',
        }}>
          {tempTier && <ThermometerIcon fillPct={tempTier.fillPct} color={tempTier.color} />}
          {tempTier ? tempTier.label : 'LOCATING...'}
        </div>
        <div style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: 20, fontWeight: 700, marginTop: 10,
          color: '#F1F0FF', lineHeight: 1,
        }}>
          {distMi}
        </div>
        <div style={{
          fontSize: 11, letterSpacing: 3, marginTop: 4,
          color: distance != null ? '#8888BB' : '#32324A',
        }}>
          {destLabel}
        </div>
      </div>

      {/* Journey progress bar */}
      <div className="compass-journey-bar">
        <div
          className="compass-journey-fill"
          style={{
            width: `${journeyPct}%`,
            background: headingColor || undefined,
            transition: isHeadingAway ? 'width 1s ease' : 'width 1s ease, background 0.4s',
          }}
        />
      </div>

      {orientState === 'needs-permission' && (
        <button className="compass-permission-btn" onClick={requestCompassPermission}>
          ENABLE COMPASS
        </button>
      )}
      {orientState === 'calibrating' && (
        <div className="compass-calibrating">CALIBRATING COMPASS</div>
      )}
      {distance != null && gpsStatus === 'active' && (
        <div style={{
          fontSize: 12,
          color: headingColor || '#8888BB',
          fontFamily: "'Share Tech Mono', monospace",
          letterSpacing: 1,
          transition: isHeadingAway ? 'none' : 'color 0.4s',
        }}>
          {isVeryClose && isHeadingAway
            ? "YOU'RE VERY CLOSE — look around"
            : isHeadingAway ? 'TURN AROUND' : `HEAD ${cardinalDir()}`}
        </div>
      )}

      {gpsStatus === 'denied' || gpsStatus === 'unavailable' ? (
        <div style={{ textAlign: 'center' }}>
          <div className="compass-status">GPS signal needed</div>
          <div style={{ fontSize: 12, color: '#8888BB', marginTop: 4, lineHeight: 1.5 }}>
            {gpsStatus === 'denied'
              ? 'Location access is off — enable it for this site in Settings and reload'
              : 'Step outside for a clearer signal'}
          </div>
        </div>
      ) : gpsStatus === 'searching' ? (
        <div className="compass-status">ACQUIRING GPS</div>
      ) : (
        <div className="compass-status">GPS ACTIVE  ~{geofence}m geofence</div>
      )}

      {compassMsg && <div className="compass-msg-box">{compassMsg}</div>}

      {!showStuckModal && (
        <div style={{marginTop:'24px',textAlign:'center'}}>
          <button
            onClick={() => setShowStuckModal(true)}
            style={{
              background:'transparent',
              border:'1px solid #32325A',
              color:'#6B67A0',
              padding:'8px 20px',
              borderRadius:'20px',
              fontSize:'12px',
              fontFamily:"'Share Tech Mono', monospace",
              letterSpacing:'2px',
              cursor:'pointer',
            }}
          >I'M STUCK</button>
        </div>
      )}

      {showStuckModal && (
        <div style={{
          position:'fixed',inset:0,
          background:'rgba(6,6,14,0.95)',
          display:'flex',alignItems:'center',
          justifyContent:'center',
          zIndex:200,padding:'24px',
        }}>
          <div style={{
            background:'#0E0E1A',
            border:'1px solid #1E1E2E',
            borderRadius:'16px',
            padding:'28px 24px',
            width:'100%',maxWidth:'360px',
          }}>
            <div style={{
              fontFamily:"'Share Tech Mono', monospace",
              fontSize:'10px',color:'#F59E0B',
              letterSpacing:'3px',marginBottom:'12px',
            }}>REPORT OBSTACLE</div>
            <div style={{
              fontSize:'18px',fontWeight:700,
              color:'#F1F0FF',marginBottom:'8px',
            }}>Can't reach the waypoint?</div>
            <div style={{
              fontSize:'13px',color:'#6B67A0',
              marginBottom:'20px',lineHeight:1.5,
            }}>
              Skipping removes compass guidance.
              You still need to physically arrive
              at the destination to claim your reward.
              {skipCount >= MAX_SKIPS && (
                <span style={{color:'#EF4444',display:'block',marginTop:'8px'}}>
                  Maximum skips reached for this hunt.
                </span>
              )}
            </div>

            {skipCount < MAX_SKIPS && (
              <>
                <div style={{
                  fontFamily:"'Share Tech Mono', monospace",
                  fontSize:'10px',color:'#6B67A0',
                  letterSpacing:'2px',marginBottom:'10px',
                }}>WHY ARE YOU STUCK?</div>

                {[
                  'Road or path is closed',
                  'Building works blocking route',
                  'Private land / no access',
                  'Safety concern',
                  'Other reason',
                ].map(reason => (
                  <div
                    key={reason}
                    onClick={() => setStuckReason(reason)}
                    style={{
                      padding:'10px 14px',
                      borderRadius:'8px',
                      border:`1px solid ${stuckReason===reason?'#7C3AED':'#1E1E2E'}`,
                      background:stuckReason===reason?'rgba(124,58,237,0.1)':'transparent',
                      color:stuckReason===reason?'#F1F0FF':'#6B67A0',
                      fontSize:'14px',
                      cursor:'pointer',
                      marginBottom:'8px',
                      transition:'all .2s',
                    }}
                  >{reason}</div>
                ))}

                <button
                  disabled={!stuckReason}
                  onClick={async () => {
                    try {
                      await supabase.from('obstacle_reports').insert({
                        hunt_name: hunt?.name || 'Unknown',
                        reason: stuckReason,
                        skip_number: skipCount + 1,
                        reported_at: new Date().toISOString(),
                      })
                    } catch(e) {}
                    const newCount = skipCount + 1
                    setSkipCount(newCount)
                    localStorage.setItem('mtm_skip_count', newCount.toString())
                    // Deduct signal point (signal points are server-managed via validate_answer RPC)
                    setShowStuckModal(false)
                    setStuckReason('')
                    alert('No problem — find your own way to the destination. The geofence will trigger when you arrive.')
                  }}
                  style={{
                    width:'100%',
                    padding:'14px',
                    background: stuckReason
                      ? 'linear-gradient(135deg,#F59E0B,#D97706)'
                      : '#1E1E2E',
                    color: stuckReason ? '#000' : '#32325A',
                    border:'none',
                    borderRadius:'10px',
                    fontSize:'14px',
                    fontFamily:"'Share Tech Mono', monospace",
                    letterSpacing:'2px',
                    cursor: stuckReason ? 'pointer' : 'not-allowed',
                    marginTop:'8px',
                    fontWeight:700,
                  }}
                >SKIP THIS WAYPOINT</button>
              </>
            )}

            <button
              onClick={() => { setShowStuckModal(false); setStuckReason('') }}
              style={{
                width:'100%',padding:'12px',
                background:'transparent',
                border:'1px solid #1E1E2E',
                color:'#6B67A0',
                borderRadius:'10px',
                fontSize:'13px',
                fontFamily:"'Share Tech Mono', monospace",
                letterSpacing:'1px',
                cursor:'pointer',
                marginTop:'8px',
              }}
            >CANCEL — I'LL FIND A WAY</button>
          </div>
        </div>
      )}

      {showDebug && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.96)',
          zIndex: 9000, overflowY: 'auto', padding: '20px 16px 48px',
          fontFamily: "'Share Tech Mono', monospace",
        }}>
          <div style={{ maxWidth: 380, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ color: '#7C3AED', fontSize: 11, letterSpacing: 3 }}>&#9724; DEBUG PANEL</div>
              <button
                onClick={() => setShowDebug(false)}
                style={{ background: 'none', border: '1px solid #32324A', borderRadius: 6, color: '#B8B4D8', padding: '4px 14px', cursor: 'pointer', fontSize: 11, letterSpacing: 1, fontFamily: "'Share Tech Mono', monospace" }}
              >CLOSE</button>
            </div>

            <div style={{ marginBottom: 20 }}>
              {[
                ['YOUR LAT',   playerPos?.lat?.toFixed(6) ?? '--'],
                ['YOUR LON',   playerPos?.lon?.toFixed(6) ?? '--'],
                ['TARGET LAT', effectiveTarget?.lat?.toFixed(6) ?? '--'],
                ['TARGET LON', effectiveTarget?.lon?.toFixed(6) ?? '--'],
                ['DISTANCE',   distance != null ? distance.toFixed(1) + ' m' : '--'],
                ['GEOFENCE',   (effectiveTarget?.geofence_m || 15) + ' m'],
                ['BEARING',    toBearing.toFixed(1) + '°'],
                ['HEADING',    deviceHeading != null ? deviceHeading.toFixed(1) + '°' : '--'],
                ['DIFF',       deviceHeading != null ? (((toBearing - deviceHeading) % 360 + 360) % 360).toFixed(1) + '°' : '--'],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1E1E2E' }}>
                  <span style={{ color: '#6B67A0', fontSize: 11, letterSpacing: 1 }}>{label}</span>
                  <span style={{ color: '#F1F0FF', fontSize: 11 }}>{val}</span>
                </div>
              ))}
            </div>

            {/* TEMP — Safari/iOS heading jitter investigation. Remove this
                block once real firing-frequency/jitter data has been used to
                pick the smoothing threshold and outlier-rejection values. */}
            <div style={{ marginBottom: 20, border: '1px solid #32324A', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ color: '#F59E0B', fontSize: 10, letterSpacing: 2 }}>RAW HEADING LOG (TEMP)</span>
                <button
                  onClick={() => setRawHeadingLog([])}
                  style={{ background: 'none', border: '1px solid #32324A', borderRadius: 6, color: '#B8B4D8', padding: '3px 10px', cursor: 'pointer', fontSize: 10, letterSpacing: 1, fontFamily: "'Share Tech Mono', monospace" }}
                >CLEAR</button>
              </div>
              {rawHeadingLog.length < 2 ? (
                <div style={{ color: '#6B67A0', fontSize: 11 }}>Turn/walk with the phone to collect readings...</div>
              ) : (() => {
                const dts = rawHeadingLog.slice(1).map(e => e.dtMs).filter(v => v != null)
                const dDegs = rawHeadingLog.slice(1).map(e => e.dDeg).filter(v => v != null)
                const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length
                return (
                  <>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 11 }}>
                      <span style={{ color: '#8888BB' }}>n=<span style={{ color: '#F1F0FF' }}>{rawHeadingLog.length}</span></span>
                      <span style={{ color: '#8888BB' }}>avg Δt=<span style={{ color: '#F1F0FF' }}>{avg(dts).toFixed(0)}ms</span></span>
                      <span style={{ color: '#8888BB' }}>avg Δ°=<span style={{ color: '#F1F0FF' }}>{avg(dDegs).toFixed(1)}°</span></span>
                      <span style={{ color: '#8888BB' }}>max Δ°=<span style={{ color: '#F1F0FF' }}>{Math.max(...dDegs).toFixed(1)}°</span></span>
                    </div>
                    <div style={{ maxHeight: 160, overflowY: 'auto', fontSize: 10 }}>
                      {rawHeadingLog.slice().reverse().map((e, i) => (
                        <div key={rawHeadingLog.length - i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #1E1E2E', color: '#8888BB' }}>
                          <span>{e.heading.toFixed(1)}°</span>
                          <span>{e.dtMs != null ? `Δt ${e.dtMs}ms` : '--'}</span>
                          <span>{e.dDeg != null ? `Δ° ${e.dDeg}` : '--'}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )
              })()}
            </div>

            {debugTargetOverride && (
              <div style={{ marginBottom: 16, padding: '8px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, fontSize: 11, color: '#F59E0B', letterSpacing: 1 }}>
                TARGET OVERRIDDEN
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => {
                  if (!playerPos) return
                  arrivedRef.current = false
                  setDistance(null)
                  setStartDist(null)
                  setDebugTargetOverride({ ...effectiveTarget, lat: playerPos.lat, lon: playerPos.lon })
                }}
                style={{ background: 'linear-gradient(135deg,#7C3AED,#9D5FF5)', border: 'none', borderRadius: 10, color: '#fff', padding: '13px', fontSize: 12, letterSpacing: 1.5, cursor: 'pointer', fontFamily: "'Share Tech Mono', monospace" }}
              >SET WAYPOINT TO MY LOCATION</button>

              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={manualLat}
                  onChange={e => setManualLat(e.target.value)}
                  placeholder="LAT"
                  style={{ flex: 1, background: '#121218', border: '1px solid #1E1E2E', borderRadius: 8, color: '#F1F0FF', fontFamily: "'Share Tech Mono', monospace", fontSize: 12, padding: '10px', outline: 'none' }}
                />
                <input
                  value={manualLon}
                  onChange={e => setManualLon(e.target.value)}
                  placeholder="LON"
                  style={{ flex: 1, background: '#121218', border: '1px solid #1E1E2E', borderRadius: 8, color: '#F1F0FF', fontFamily: "'Share Tech Mono', monospace", fontSize: 12, padding: '10px', outline: 'none' }}
                />
                <button
                  onClick={() => {
                    const lat = parseFloat(manualLat)
                    const lon = parseFloat(manualLon)
                    if (!isNaN(lat) && !isNaN(lon)) {
                      arrivedRef.current = false
                      setDistance(null)
                      setStartDist(null)
                      setDebugTargetOverride({ ...effectiveTarget, lat, lon })
                    }
                  }}
                  style={{ background: '#0E0E1A', border: '1px solid #1E1E2E', borderRadius: 8, color: '#F1F0FF', fontFamily: "'Share Tech Mono', monospace", fontSize: 12, padding: '10px 14px', cursor: 'pointer' }}
                >SET</button>
              </div>

              <button
                onClick={() => {
                  arrivedRef.current = false
                  if (effectiveTarget?.isWaypoint) onWaypointReachedRef.current?.(startDist)
                  else onArrivedRef.current?.(playerPos?.lat ?? effectiveTarget?.lat, playerPos?.lon ?? effectiveTarget?.lon, startDist)
                }}
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.35)', borderRadius: 10, color: '#10B981', padding: '13px', fontSize: 12, letterSpacing: 1.5, cursor: 'pointer', fontFamily: "'Share Tech Mono', monospace" }}
              >SIMULATE ARRIVAL</button>

              <button
                onClick={() => onWaypointReachedRef.current?.(startDist)}
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, color: '#F59E0B', padding: '13px', fontSize: 12, letterSpacing: 1.5, cursor: 'pointer', fontFamily: "'Share Tech Mono', monospace" }}
              >NEXT WAYPOINT</button>

              {debugTargetOverride && (
                <button
                  onClick={() => { setDebugTargetOverride(null); setManualLat(''); setManualLon(''); setDistance(null); setStartDist(null); arrivedRef.current = false }}
                  style={{ background: 'none', border: '1px solid #32324A', borderRadius: 10, color: '#6B67A0', padding: '10px', fontSize: 11, letterSpacing: 1, cursor: 'pointer', fontFamily: "'Share Tech Mono', monospace" }}
                >RESET TARGET OVERRIDE</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

//  Account Prompt
function AccountPrompt({ onDismiss }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!email.includes('@')) return
    setError('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      // No anonymous (or any) session to link the email to — this is a
      // different bug than the one this fix addresses. Surface it rather
      // than silently falling back to a fresh signInWithOtp sign-in, which
      // would mask the missing-session case instead of fixing it.
      setError('No active session found — please try again.')
      return
    }
    const { error: e } = await supabase.auth.updateUser({ email })
    if (e) { setError('Something went wrong, try again.'); return }
    setSent(true)
  }

  return (
    <div className="account-prompt">
      <div className="account-prompt-title">Save your progress</div>
      <div className="account-prompt-sub">
        Get notified about new hunts near you. Free forever.
      </div>
      {sent ? (
        <div className="account-sent">Check your email to confirm and save your progress.</div>
      ) : (
        <>
          <div className="account-email-row">
            <input
              className="account-input"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
            <button className="account-submit" onClick={handleSave}>SAVE PROGRESS</button>
          </div>
          {error && <div style={{ color: '#EF4444', fontSize: 12, marginTop: 6 }}>{error}</div>}
          <button className="account-maybe" onClick={() => onDismiss?.()}>Continue without saving</button>
        </>
      )}
    </div>
  )
}

function formatWalkedDistance(m) {
  if (m == null) return null
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`
}
function formatTimeTaken(s) {
  if (s == null) return null
  const mins = Math.floor(s / 60)
  const secs = s % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

const REVEAL_GOLD_TONES = ['#F59E0B', '#FCD34D']
const REVEAL_PURPLE_TONES = ['#7C3AED', '#9D5FF5']

// Passport stamp + star strip — cosmetic preview of the star progression
// system (queued as a future project), so "stars earned" is derived purely
// from this hunt's own tier rather than a persisted cross-hunt counter that
// doesn't exist yet.
const TIER_STAMP = {
  casual:  { label: 'CASUAL',  emoji: '🎬', color: '#34D399', rotate: -7 },
  classic: { label: 'CLASSIC', emoji: '🎭', color: '#7C3AED', rotate: 5 },
  expert:  { label: 'EXPERT',  emoji: '🏆', color: '#F59E0B', rotate: -4 },
  cipher:  { label: 'CIPHER',  emoji: '🔐', color: '#F43F5E', rotate: 6 },
}
const TIER_STARS = { casual: 1, classic: 2, expert: 3, cipher: 4 }
function buildRevealParticles() {
  return Array.from({ length: 24 }, () => {
    const angle = Math.random() * Math.PI * 2
    const dist = 70 + Math.random() * 90
    const tx = Math.cos(angle) * dist
    const ty = Math.sin(angle) * dist * 1.3 // stage is taller than wide
    const size = 4 + Math.random() * 6
    const dur = 600 + Math.random() * 300
    const delay = 100 + Math.random() * 70
    const palette = Math.random() < 0.5 ? REVEAL_GOLD_TONES : REVEAL_PURPLE_TONES
    const color = palette[Math.floor(Math.random() * palette.length)]
    return { tx, ty, size, dur, delay, color }
  })
}

//  Arrived Screen
function ArrivedScreen({ voucher }) {
  const pinHash = voucher?.redemption_pin_hash || null
  const businessId = String(voucher?.business_id || '')

  const [entered, setEntered] = useState(false)
  const [step, setStep] = useState('view')
  const [pinEntered, setPinEntered] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [pinMsg, setPinMsg] = useState('')
  const [holdProgress, setHoldProgress] = useState(0)
  const holdTimerRef = useRef(null)
  const lockTimerRef = useRef(null)
  const [particles] = useState(buildRevealParticles)
  const [showSave, setShowSave] = useState(false)
  const [accountPromptDismissed, setAccountPromptDismissed] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [reportText, setReportText] = useState('')
  const [reportSent, setReportSent] = useState(false)

  const walkedLabel = formatWalkedDistance(voucher?.distance_walked_m)
  const timeLabel = formatTimeTaken(voucher?.time_taken_s)

  const tierKey = TIER_STAMP[voucher?.difficulty] ? voucher.difficulty : 'classic'
  const tier = TIER_STAMP[tierKey]
  const starsEarned = TIER_STARS[tierKey] || 0
  const starsRemaining = Math.max(0, 5 - starsEarned)

  function handleShare() {
    const text = `I just found ${voucher?.business_name || 'a hidden spot'} on MapTheMovie and unlocked a reward - app.mapthemovie.co.uk`
    if (navigator.share) {
      navigator.share({ title: 'MapTheMovie', text, url: 'https://app.mapthemovie.co.uk' }).catch(() => {})
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
    }
  }

  async function submitReport() {
    if (!reportText.trim()) return
    try {
      await supabase.from('obstacle_reports').insert({
        hunt_name: voucher?.business_name || 'Unknown',
        reason: 'Reward screen: ' + reportText.trim(),
        reported_at: new Date().toISOString(),
      })
    } catch (e) {}
    setReportSent(true)
  }

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 60)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearInterval(holdTimerRef.current)
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current)
    }
  }, [])

  async function checkPin(digits) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(digits + businessId))
    const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
    return hex === pinHash
  }

  async function handleDigit(d) {
    const next = pinEntered + d
    if (next.length > 4) return
    setPinEntered(next)
    if (next.length < 4) return
    const correct = await checkPin(next)
    if (correct) {
      setStep('success')
      return
    }
    const newAttempts = attempts + 1
    setAttempts(newAttempts)
    setPinEntered('')
    if (newAttempts >= 3) {
      setStep('lockedout')
      setPinMsg('Too many attempts - please contact staff')
      lockTimerRef.current = setTimeout(() => {
        setStep('handoff')
        setAttempts(0)
        setPinMsg('')
      }, 5 * 60 * 1000)
    } else {
      setPinMsg('Incorrect PIN - ' + (3 - newAttempts) + ' attempt' + (3 - newAttempts === 1 ? '' : 's') + ' remaining')
    }
  }

  function startHold() {
    setHoldProgress(0)
    const start = Date.now()
    holdTimerRef.current = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / 3000) * 100)
      setHoldProgress(pct)
      if (pct >= 100) {
        clearInterval(holdTimerRef.current)
        holdTimerRef.current = null
        setStep('success')
      }
    }, 50)
  }

  function endHold() {
    if (holdTimerRef.current) { clearInterval(holdTimerRef.current); holdTimerRef.current = null }
    if (step !== 'success') setHoldProgress(0)
  }

  if (step === 'success') {
    return (
      <div className="arrived-wrap">
        <div style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#10B981', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 28, color: '#fff', fontWeight: 700 }}>OK</div>
          </div>
          <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 26, color: '#F1F0FF', marginBottom: 10 }}>
            Redeemed Successfully
          </div>
          <div style={{ color: '#B8B4D8', fontSize: 14, lineHeight: 1.6 }}>
            Thank you for visiting and playing MapTheMovie
          </div>
        </div>
        {!accountPromptDismissed && (
          <div style={{ width: '100%' }}>
            <AccountPrompt onDismiss={() => setAccountPromptDismissed(true)} />
          </div>
        )}
      </div>
    )
  }

  if (step === 'lockedout') {
    return (
      <div className="arrived-wrap">
        <div style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, letterSpacing: 2, color: '#EF4444', marginBottom: 16 }}>
            ACCESS LOCKED
          </div>
          <div style={{ color: '#B8B4D8', fontSize: 14, lineHeight: 1.6 }}>
            {pinMsg}
          </div>
          <div style={{ marginTop: 16, color: '#8888BB', fontSize: 13 }}>
            Locked for 5 minutes
          </div>
        </div>
      </div>
    )
  }

  if (step === 'pinentry') {
    const KEYS = ['1','2','3','4','5','6','7','8','9','','0','']
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 24 }}>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 15, letterSpacing: 3, color: '#F1F0FF', marginBottom: 8 }}>
          STAFF PIN REQUIRED
        </div>
        <div style={{ color: '#8888BB', fontSize: 13, marginBottom: 32 }}>
          Enter your 4-digit staff PIN
        </div>
        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              width: 16, height: 16, borderRadius: '50%',
              border: '2px solid #7C3AED',
              background: pinEntered.length > i ? '#7C3AED' : 'transparent',
              transition: 'background 0.12s',
            }} />
          ))}
        </div>
        {pinMsg && (
          <div style={{ color: '#EF4444', fontSize: 13, marginBottom: 16, textAlign: 'center' }}>
            {pinMsg}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 72px)', gap: 12, marginBottom: 32 }}>
          {KEYS.map((k, i) => (
            k === '' ? <div key={i} /> :
            <button
              key={i}
              onClick={() => handleDigit(k)}
              style={{
                width: 72, height: 72,
                background: '#1C1C26',
                border: '1px solid #32324A',
                borderRadius: '50%',
                fontSize: 24, color: '#F1F0FF',
                cursor: 'pointer',
                fontFamily: "'Space Grotesk', system-ui, sans-serif",
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >{k}</button>
          ))}
        </div>
        <button
          onClick={() => { setStep('handoff'); setPinEntered(''); setPinMsg('') }}
          style={{ background: 'none', border: 'none', color: '#8888BB', fontSize: 14, cursor: 'pointer', padding: '10px 24px' }}
        >
          Cancel
        </button>
      </div>
    )
  }

  const circumference = 2 * Math.PI * 42

  return (
    <div className="arrived-wrap">
      {step === 'handoff' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 32 }}>
          <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 22, color: '#F1F0FF', textAlign: 'center', marginBottom: 12, lineHeight: 1.3 }}>
            Hand your phone to a member of staff
          </div>
          <div style={{ color: '#B8B4D8', fontSize: 14, marginBottom: 40, textAlign: 'center' }}>
            Staff: tap below to enter your PIN
          </div>
          {pinHash ? (
            <button
              onClick={() => { setPinMsg(''); setPinEntered(''); setStep('pinentry') }}
              style={{ background: 'linear-gradient(135deg, #7C3AED, #9D5FF5)', color: '#fff', border: 'none', borderRadius: 12, fontFamily: "'Share Tech Mono', monospace", fontSize: 13, letterSpacing: 2, fontWeight: 700, padding: '18px 40px', cursor: 'pointer', marginBottom: 24 }}
            >
              STAFF REDEMPTION
            </button>
          ) : (
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ color: '#8888BB', fontSize: 13, marginBottom: 16 }}>Hold to confirm redemption</div>
              <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto' }}>
                <svg width="100" height="100" style={{ transform: 'rotate(-90deg)', position: 'absolute', inset: 0 }}>
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#32324A" strokeWidth="6" />
                  <circle
                    cx="50" cy="50" r="42" fill="none" stroke="#7C3AED" strokeWidth="6"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - holdProgress / 100)}
                    style={{ transition: 'stroke-dashoffset 0.05s linear' }}
                  />
                </svg>
                <button
                  onMouseDown={startHold}
                  onMouseUp={endHold}
                  onMouseLeave={endHold}
                  onTouchStart={e => { e.preventDefault(); startHold() }}
                  onTouchEnd={endHold}
                  style={{ position: 'absolute', inset: 8, background: '#1C1C26', border: 'none', borderRadius: '50%', color: '#F1F0FF', fontSize: 11, fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1, cursor: 'pointer' }}
                >
                  HOLD
                </button>
              </div>
            </div>
          )}
          <button
            onClick={() => setStep('view')}
            style={{ background: 'none', border: 'none', color: '#8888BB', fontSize: 14, cursor: 'pointer', padding: '10px 24px' }}
          >
            Back
          </button>
        </div>
      )}

      <div className={`reveal-stage${entered ? ' playing' : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        <div className="reveal-flash" />
        <div className="reveal-particle-field">
          {particles.map((p, i) => (
            <div
              key={i}
              className="reveal-particle"
              style={{
                width: p.size, height: p.size, background: p.color,
                '--tx': `${p.tx.toFixed(1)}px`,
                '--ty': `${p.ty.toFixed(1)}px`,
                '--dur': `${p.dur.toFixed(0)}ms`,
                '--delay': `${p.delay.toFixed(0)}ms`,
              }}
            />
          ))}
        </div>
        <div className="reveal-scanline" />
        <div className="reveal-locus">
          <div className="reveal-ripple r1" />
          <div className="reveal-ripple r2" />
          <div className="reveal-dot" />
        </div>

        <div className="reveal-found-bar">
          YOU FOUND IT
          <div className="reveal-shimmer" />
        </div>

        <div className="reveal-biz-name">{voucher?.business_name || 'YOUR DESTINATION'}</div>
        <div className="reveal-location-line">You made it</div>

        <div className="reveal-voucher-card">
          <div className="reveal-label">YOUR REWARD</div>
          {voucher && (
            <>
              <div className="reveal-headline">{voucher.voucher_headline}</div>
              <div className="reveal-detail">{voucher.voucher_detail}</div>
            </>
          )}
          <div className="reveal-code">{voucher?.voucher_code || '---'}</div>
        </div>

        <div className="reveal-stamp-zone">
          <div className="reveal-inkbloom" style={{ background: tier.color }} />
          <div className="reveal-stamp-outer" style={{ transform: `rotate(${tier.rotate}deg)` }}>
            <div className="reveal-stamp" style={{ borderColor: tier.color, color: tier.color }}>
              <div className="reveal-stamp-emoji">{tier.emoji}</div>
              <div className="reveal-stamp-tier">{tier.label}</div>
              <div className="reveal-stamp-complete">COMPLETE</div>
              <div className="reveal-stamp-sheen" />
            </div>
          </div>
        </div>
        <div className="reveal-stamp-caption" style={{ color: tier.color }}>Stamped in your Passport</div>

        <div className="reveal-star-strip">
          <div className="reveal-star-row">
            {[0, 1, 2, 3, 4].map(i => (
              <span
                key={i}
                className="reveal-star"
                style={{
                  '--star-delay': `${1150 + i * 70}ms`,
                  ...(i < starsEarned ? { color: tier.color, textShadow: `0 0 10px ${tier.color}` } : null),
                }}
              >★</span>
            ))}
          </div>
          <div className="reveal-star-caption">
            {starsEarned} of 5 stars · {starsRemaining} more to enter the £500 draw
          </div>
          <div className="reveal-star-progress-track">
            <div className="reveal-star-progress-fill" style={{ '--star-pct': `${(starsEarned / 5) * 100}%` }} />
          </div>
        </div>

        {(walkedLabel || timeLabel) && (
          <div className="reveal-stats-row">
            {walkedLabel && (
              <div className="reveal-stat">
                <div className="reveal-num">{walkedLabel}</div>
                <div className="reveal-cap">WALKED</div>
              </div>
            )}
            {timeLabel && (
              <div className="reveal-stat">
                <div className="reveal-num">{timeLabel}</div>
                <div className="reveal-cap">TIME TAKEN</div>
              </div>
            )}
          </div>
        )}

        <button className="reveal-share-btn" onClick={handleShare}>SHARE YOUR WIN</button>

        <button
          onClick={() => setStep('handoff')}
          style={{ background: 'linear-gradient(135deg, #7C3AED, #9D5FF5)', color: '#fff', width: '100%', maxWidth: 340, height: 52, fontFamily: "'Share Tech Mono', monospace", fontWeight: 800, fontSize: 13, letterSpacing: 2, border: 'none', cursor: 'pointer', borderRadius: 12, marginBottom: 18 }}
        >
          PRESENT TO STAFF
        </button>

        <div className="reveal-secondary-actions">
          <button onClick={() => setShowSave(s => !s)}>Save progress</button>
          <button onClick={() => setShowReport(s => !s)}>Report an issue</button>
        </div>

        {showSave && (
          <div style={{ width: '100%', maxWidth: 340, marginTop: 12 }}>
            <AccountPrompt onDismiss={() => setShowSave(false)} />
          </div>
        )}

        {showReport && (
          <div style={{ width: '100%', maxWidth: 340, marginTop: 12 }}>
            {reportSent ? (
              <div style={{ fontSize: 12, color: '#8888BB', textAlign: 'center' }}>Thanks — we'll take a look.</div>
            ) : (
              <>
                <textarea
                  value={reportText}
                  onChange={e => setReportText(e.target.value)}
                  placeholder="What went wrong?"
                  rows={2}
                  style={{ width: '100%', background: '#1C1C26', border: '1px solid #32324A', borderRadius: 10, color: '#F1F0FF', fontSize: 13, padding: 10, fontFamily: 'inherit', resize: 'vertical', marginBottom: 8, boxSizing: 'border-box' }}
                />
                <button
                  onClick={submitReport}
                  disabled={!reportText.trim()}
                  style={{ width: '100%', padding: 10, background: 'transparent', border: '1px solid #32324A', borderRadius: 8, color: reportText.trim() ? '#B8B4D8' : '#4A4A5A', fontSize: 12, cursor: reportText.trim() ? 'pointer' : 'not-allowed' }}
                >Send</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

//  Waypoint helpers
const TIER_COUNT   = { casual: 3, classic: 4, expert: 5, cipher: 6 }
const TIER_SPACING = { casual: 400, classic: 550, expert: 800, cipher: 1600 } // metres between waypoints
const DIFF_TO_TIER = { 1: 'casual', 2: 'classic', 3: 'expert', 4: 'cipher' }

// TAKES (formerly "signal points") starting budget by difficulty. Single
// source of truth used both for the hunt_sessions INSERT (server-side
// truth) and the client's initial display, so they can never disagree.
const STARTING_TAKES = { casual: 10, classic: 10, expert: 7, cipher: 5 }

function generateWaypoints(startLat, startLon, destLat, destLon, tier, difficulty) {
  const count = TIER_COUNT[tier] || 3
  if (count === 0) return []

  const totalDist     = haversineMetres(startLat, startLon, destLat, destLon)
  const targetSpacing = TIER_SPACING[tier] || 400
  // Place waypoints at exact target intervals from start when all fit before the destination
  // (with >=50 m remaining). Fall back to equal fractions on short routes.
  const useTargetSpacing = count * targetSpacing < totalDist - 50

  const pts = []
  for (let i = 1; i <= count; i++) {
    const f = useTargetSpacing
      ? (i * targetSpacing) / totalDist
      : i / (count + 1)
    pts.push({
      index:      i,
      lat:        startLat + (destLat - startLat) * f,
      lon:        startLon + (destLon - startLon) * f,
      geofence_m: diffGeofence(difficulty),
      unlocks_slots: [`${String.fromCharCode(65 + i)}`],
    })
  }
  return pts
}

function getPhaseSlots(phase, questions) {
  const q = questions[phase]
  return q ? [q.slot] : []
}

//  App 
export default function App() {
  const [accessGranted, setAccessGranted] = useState(
    localStorage.getItem('mtm_access') === 'MAPTEST2026'
  )
  // Platform admins bypass the beta gate entirely -- checked once against
  // whatever Supabase session is already persisted for this browser (e.g.
  // a magic-link session from Command Center/Dashboard). Gate render is
  // held until this resolves so admins never see even a flash of it.
  const [adminBypassChecked, setAdminBypassChecked] = useState(false)
  useEffect(() => {
    let cancelled = false
    supabase.rpc('is_platform_admin')
      .then(({ data, error }) => {
        if (cancelled) return
        if (!error && data === true) setAccessGranted(true)
        setAdminBypassChecked(true)
      })
      .catch(() => { if (!cancelled) setAdminBypassChecked(true) })
    return () => { cancelled = true }
  }, [])
  const [screen, setScreen] = useState(() => {
    try {
      const s = localStorage.getItem('mtm_active_reward')
      if (s) { const r = JSON.parse(s); if (r.expiresAt > Date.now()) return 'arrived' }
    } catch {}
    return 'discover'
  })
  const [hunts, setHunts] = useState([])
  const [huntsLoading, setHuntsLoading] = useState(true)
  const [huntsError, setHuntsError] = useState(null)
  const [userPos, setUserPos] = useState(null)

  const [activePack, setActivePack] = useState(null)
  const [activeSession, setActiveSession] = useState(null)
  // Client-side only, for the arrival reveal's "distance walked / time
  // taken" stats — confirm_arrival doesn't return either. huntStartedAt
  // comes from hunt_sessions.started_at (server clock, avoids device skew);
  // huntDistanceRef accumulates each waypoint leg's straight-line start
  // distance as the player progresses.
  const [huntStartedAt, setHuntStartedAt] = useState(null)
  const huntDistanceRef = useRef(0)
  const [activeQuestions, setActiveQuestions] = useState([])
  const [solved, setSolved] = useState({})
  const [signalPoints, setSignalPoints] = useState(10)
  const [maxSignalPoints, setMaxSignalPoints] = useState(10)
  const [realCoords, setRealCoords] = useState(null)
  const [voucher, setVoucher] = useState(() => {
    try {
      const s = localStorage.getItem('mtm_active_reward')
      if (s) { const r = JSON.parse(s); if (r.expiresAt > Date.now()) return r.voucher }
    } catch {}
    return null
  })
  const [showReset, setShowReset] = useState(false)
  const [starting, setStarting] = useState(false)
  const [compassMsg, setCompassMsg] = useState(null)
  const [waypointsMode, setWaypointsMode] = useState(false)
  // `waypoints` now only ever holds ALREADY-UNLOCKED real waypoints (each
  // one fetched fresh from get_puzzle_waypoints right as its own trivia
  // slot is solved — see handleSubmitAnswer) — never the full trail
  // upfront. `totalWaypoints` is the true count, needed separately since
  // waypoints.length no longer represents it.
  const [waypoints, setWaypoints] = useState([])
  const [totalWaypoints, setTotalWaypoints] = useState(0)
  const [waypointPhase, setWaypointPhase] = useState(0)
  const [compassTarget, setCompassTarget] = useState(null)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [prizePool, setPrizePool] = useState(null)
  const [activePrizePool, setActivePrizePool] = useState(null)
  const [prefs, setPrefs] = useState({ difficulty: 'classic', categories: ['food_drink', 'attractions', 'entertainment', 'sport', 'outdoor'], genres: ['any'] })
  const [prefsUserId, setPrefsUserId] = useState(null)
  const [hydrated, setHydrated] = useState(false)

  // Save-on-change: whenever mid-hunt state changes, persist enough to resume
  // after an interruption (phone call, backgrounded app, closed browser, dead
  // battery). Cleared automatically once the player leaves puzzles/compass
  // (arrival, restart, or navigating back to discover).
  // Gated on `hydrated` — otherwise this effect's initial run (activeSession
  // still null) clears mtm_hunt_progress before restoreHuntProgress() gets a
  // chance to read it.
  useEffect(() => {
    if (!hydrated) return
    if (activeSession && (screen === 'puzzles' || screen === 'compass')) {
      try {
        localStorage.setItem('mtm_hunt_progress', JSON.stringify({
          session_id:    activeSession.id,
          campaign_id:   activeSession.campaign_id,
          pack:          activePack,
          solved,
          signalPoints,
          waypointsMode,
          waypoints,
          totalWaypoints,
          waypointPhase,
          compassTarget,
          screen,
          savedAt: Date.now(),
        }))
      } catch {}
    } else {
      try { localStorage.removeItem('mtm_hunt_progress') } catch {}
    }
  }, [hydrated, activeSession, activePack, solved, signalPoints, waypointsMode, waypoints, totalWaypoints, waypointPhase, compassTarget, screen])

  useEffect(() => {
    loadHunts()
    loadPrizePool()
    loadPrefs()
    registerSW()
    restoreHuntProgress()
  }, [])

  useEffect(() => {
    function onBeforeInstall(e) {
      e.preventDefault()
      setInstallPrompt(e)
      setShowInstallBanner(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  async function handleInstall() {
    if (!installPrompt) return
    await installPrompt.prompt()
    const result = await installPrompt.userChoice
    if (result.outcome === 'accepted') setShowInstallBanner(false)
    setInstallPrompt(null)
  }

  async function loadHunts() {
    try {
      // get_active_hunts() does the active/date/is_active filtering and
      // the real_lat/real_lon -> approx_lat/approx_lon fuzzing server-side
      // (deterministic hashtext(business_id) offset, ~300-400m, never the
      // real business coordinates) -- see migration 003 + 028. Previously
      // this was a direct .from('campaigns').select(...) that never
      // selected businesses.location at all, so approx_lat/approx_lon were
      // silently always 0,0 -- fixed as a side effect of this switch, not
      // the point of it.
      const { data, error } = await supabase.rpc('get_active_hunts')
      if (error) throw error

      // One puzzle row per pack is the established model (migration 014
      // consolidated multi-waypoint hunts to this) -- the RPC's JOIN
      // assumes that too, same as the old client-side .find(is_active).
      const hunts = (data?.hunts || []).map(h => {
        // `puzzle_packs.genre` is authored directly in Command Center as of
        // migration 016. Packs created before that migration have genre =
        // NULL (theme_tag is seasonal — christmas/halloween/etc — not a
        // movie genre, so it can't stand in), so fall back to the old
        // keyword-detection heuristic only for those.
        const genre = h.genre || detectGenre(h.pack_name, h.pack_description, h.tagline)

        return {
          campaign_id:      h.campaign_id,
          pack_id:          h.pack_id,
          puzzle_id:        h.puzzle_id,
          pack_name:        h.pack_name,
          pack_emoji:       h.pack_emoji,
          pack_tier:        h.pack_tier,
          pack_description: h.pack_description,
          description:      h.pack_description,
          tagline:          h.tagline,
          accent_color:     h.accent_color,
          theme_tag:        h.theme_tag,
          genre,
          coordinate_slots: h.coordinate_slots,
          masked_lat:       h.masked_lat,
          masked_lon:       h.masked_lon,
          is_free_tier:     h.is_free_tier,
          business_name:    h.business_name,
          voucher_headline: h.voucher_headline,
          difficulty:       h.difficulty || 'classic',
          approx_lat:       h.approx_lat,
          approx_lon:       h.approx_lon,
          postcode_outward: h.postcode_outward,
        }
      })

      setHunts(hunts)
    } catch (err) {
      setHuntsError(err.message)
    } finally {
      setHuntsLoading(false)
    }
  }

  async function loadPrizePool() {
    try {
      const { data } = await supabase
        .from('prize_pools')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data) setPrizePool(data)
    } catch {}
  }

  async function loadPrefs() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !user.email) return
      setPrefsUserId(user.id)
    } catch {}
  }

  function getUserPos() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      pos => setUserPos({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {}
    )
  }

  async function registerSW() {
    if ('serviceWorker' in navigator) {
      try { await navigator.serviceWorker.register('/sw.js') } catch {}
    }
  }

  async function ensureAuth() {
    const { data: { user: existingUser } } = await supabase.auth.getUser()

    let user = existingUser
    if (!user) {
      const { data, error } = await supabase.auth.signInAnonymously()
      if (error) throw new Error('Sign-in failed: ' + error.message)
      user = data.user
    }

    // Always ensure a profiles row exists, not just on fresh sign-in — an
    // existing session (anonymous or otherwise) can still be missing its
    // profiles row if the insert never ran or failed previously.
    const { error: profileErr } = await supabase.from('profiles').upsert(
      { id: user.id },
      { onConflict: 'id' }
    )
    if (profileErr) {
      console.error('Failed to create/update profile row for user', user.id, profileErr)
    }

    return user
  }

  // Resume a hunt interrupted mid-play. Re-validates the session and campaign
  // server-side before trusting anything from localStorage — never resumes a
  // dead hunt.
  // Wrapper ensures `hydrated` flips true once the restore attempt finishes,
  // on every exit path (success, discard, or error) — see the save-effect above.
  async function restoreHuntProgress() {
    try {
      await restoreHuntProgressInner()
    } finally {
      setHydrated(true)
    }
  }

  async function restoreHuntProgressInner() {
    console.log('[restore] restoreHuntProgress() called, voucher =', voucher)

    // mtm_active_reward already won the race in the `screen` initializer above
    if (voucher) {
      console.log('[restore] bailing: a valid mtm_active_reward voucher already won')
      return
    }

    let saved
    try {
      const raw = localStorage.getItem('mtm_hunt_progress')
      console.log('[restore] localStorage mtm_hunt_progress raw =', raw)
      if (!raw) return
      saved = JSON.parse(raw)
      console.log('[restore] parsed saved =', saved)
    } catch (err) {
      console.log('[restore] bailing: failed to parse mtm_hunt_progress', err)
      return
    }

    if (!saved?.session_id || !saved?.pack) {
      console.log('[restore] bailing: saved payload missing session_id or pack, discarding')
      localStorage.removeItem('mtm_hunt_progress')
      return
    }

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      console.log('[restore] current supabase auth user =', authUser?.id)

      const { data: session, error: sessionErr } = await supabase
        .from('hunt_sessions')
        .select('*')
        .eq('id', saved.session_id)
        .eq('status', 'active')
        .single()
      console.log('[restore] hunt_sessions lookup -> session =', session, 'error =', sessionErr)
      if (sessionErr || !session) throw new Error('session not active: ' + JSON.stringify(sessionErr))

      const { data: campaign, error: campaignErr } = await supabase
        .from('campaigns')
        .select('starts_at, ends_at')
        .eq('id', saved.campaign_id)
        .eq('status', 'active')
        .single()
      console.log('[restore] campaigns lookup -> campaign =', campaign, 'error =', campaignErr)
      if (campaignErr || !campaign) throw new Error('campaign not active: ' + JSON.stringify(campaignErr))

      const now = Date.now()
      const startsAt = new Date(campaign.starts_at).getTime()
      const endsAt = new Date(campaign.ends_at).getTime()
      console.log('[restore] date window check -> now =', now, 'starts_at =', startsAt, 'ends_at =', endsAt)
      if (now < startsAt || now > endsAt) {
        throw new Error('campaign outside date window')
      }

      // Re-fetch questions fresh rather than trusting persisted trivia data.
      // NOTE: get_puzzle_for_player re-randomises its question selection on
      // every call (migrations/004_question_variety.sql uses ORDER BY RANDOM()),
      // so unsolved slots may show different trivia than before the
      // interruption. Known follow-up — see CLAUDE.md.
      const seenIds = getSeenQuestionIds(session.user_id)
      const { data: puzzleData, error: puzzleErr } = await supabase
        .rpc('get_puzzle_for_player', {
          p_session_id:  saved.session_id,
          p_exclude_ids: seenIds,
          p_difficulty:  saved.pack.difficulty || 'classic',
        })
      console.log('[restore] get_puzzle_for_player -> puzzleData =', puzzleData, 'error =', puzzleErr)
      if (puzzleErr || !puzzleData?.questions) throw new Error('could not reload puzzle: ' + JSON.stringify(puzzleErr))

      setActivePack(saved.pack)
      setActiveSession({ id: saved.session_id, campaign_id: saved.campaign_id })
      // Best-effort — legs completed before the restore aren't recoverable,
      // so "distance walked" undercounts for a resumed hunt. Acceptable for
      // a display-only stat.
      setHuntStartedAt(session.started_at ? new Date(session.started_at).getTime() : Date.now())
      huntDistanceRef.current = 0
      setActiveQuestions(puzzleData.questions)
      setSolved(saved.solved || {})
      // Prefer the server's authoritative value over the cached one —
      // exactly the client/server mismatch that caused the takes-went-up
      // bug started with a stale local number instead of the real session row.
      setSignalPoints(session.signal_points ?? saved.signalPoints ?? 10)
      setMaxSignalPoints(STARTING_TAKES[saved.pack?.difficulty] ?? 10)
      setWaypointsMode(!!saved.waypointsMode)
      setWaypoints(saved.waypoints || [])
      setTotalWaypoints(saved.totalWaypoints || 0)
      setWaypointPhase(saved.waypointPhase || 0)
      setCompassTarget(saved.compassTarget || null)
      setScreen(saved.screen === 'compass' ? 'compass' : 'puzzles')
      console.log('[restore] success — resumed on screen', saved.screen === 'compass' ? 'compass' : 'puzzles')
    } catch (err) {
      console.log('[restore] bailing: discarding saved progress —', err)
      localStorage.removeItem('mtm_hunt_progress')
    }
  }

  async function startHunt(hunt) {
    getUserPos() // request GPS on user interaction, not on page load
    setStarting(true)
    setHuntsError(null)
    try {
      const user = await ensureAuth()

      // Load previously seen question IDs for this user (localStorage)
      const seenIds = getSeenQuestionIds(user.id)

      const startingTakes = STARTING_TAKES[hunt.difficulty] ?? 10

      const { data: session, error: sessionErr } = await supabase
        .from('hunt_sessions')
        .insert({
          user_id: user.id,
          puzzle_id: hunt.puzzle_id,
          start_lat: userPos?.lat ?? null,
          start_lon: userPos?.lon ?? null,
          signal_points: startingTakes,
        })
        .select()
        .single()
      if (sessionErr) {
        throw new Error('Session error: ' + sessionErr.message + ' (code: ' + sessionErr.code + ')')
      }

      const { data: puzzleData, error: puzzleErr } = await supabase
        .rpc('get_puzzle_for_player', {
          p_session_id:  session.id,
          p_exclude_ids: seenIds,
          p_difficulty:  hunt.difficulty || 'classic',
        })
      if (puzzleErr) {
        throw new Error('Puzzle error: ' + puzzleErr.message + ' (code: ' + puzzleErr.code + ')')
      }

      const questions = puzzleData?.questions || []

      // Mark these questions as seen — both locally and in the DB (non-blocking)
      const questionIds = questions.map(q => q.id).filter(Boolean)
      if (questionIds.length) {
        markQuestionsSeenLocal(user.id, questionIds)
        supabase.rpc('mark_questions_seen', {
          p_session_id:   session.id,
          p_question_ids: questionIds,
        }).then(() => {}).catch(() => {})
      }
      const isPremium = true

      setActivePack(hunt)
      setActiveSession({ id: session.id, campaign_id: hunt.campaign_id })
      setHuntStartedAt(session.started_at ? new Date(session.started_at).getTime() : Date.now())
      huntDistanceRef.current = 0
      setActiveQuestions(questions)
      setSolved({})
      setSignalPoints(startingTakes)
      setMaxSignalPoints(startingTakes)
      setShowReset(false)
      setRealCoords(null)
      setVoucher(null)
      localStorage.removeItem('mtm_active_reward')
      localStorage.removeItem('mtm_skip_count')
      setCompassMsg(null)
      setWaypointPhase(0)
      setCompassTarget(null)

      // Premium packs: real, author-placed waypoints (Command Center
      // multi-stop trails) take priority over synthetic interpolation.
      // Real coordinates are never fetched here, only the total COUNT --
      // each waypoint's real lat/lon is fetched fresh right as its own
      // trivia slot is solved (see handleSubmitAnswer's phaseDone branch),
      // never all at once upfront. total_waypoints === 0 means this
      // puzzle has no real waypoints at all, falling through to the
      // existing synthetic interpolation path exactly as before.
      let wps = []
      let totalWp = 0
      let usesRealWaypoints = false
      if (isPremium) {
        try {
          const { data: realWpData } = await supabase.rpc('get_puzzle_waypoints', {
            p_session_id: session.id,
          })
          totalWp = realWpData?.total_waypoints || 0
          usesRealWaypoints = totalWp > 0
        } catch (e) { /* fall through to synthetic interpolation below */ }

        if (!usesRealWaypoints) {
          const startPos = userPos || { lat: 51.3748, lon: 0.5439 }
          try {
            const { data: destData, error: destErr } = await supabase.rpc('get_puzzle_destination', {
              p_session_id: session.id,
            })
            if (destData?.success) {
              const huntTier = DIFF_TO_TIER[puzzleData.difficulty] || hunt.difficulty || 'classic'
              wps = generateWaypoints(
                startPos.lat, startPos.lon,
                parseFloat(destData.real_lat), parseFloat(destData.real_lon),
                huntTier,
                hunt.difficulty || 'classic',
              )
            }
          } catch (e) { /* linear mode fallback */ }
        }
      }
      setWaypoints(wps)
      setTotalWaypoints(totalWp)
      setWaypointsMode(usesRealWaypoints || wps.length > 0)

      setScreen('puzzles')
    } catch (err) {
      setHuntsError(err.message || 'Could not start hunt. Please try again.')
    } finally {
      setStarting(false)
    }
  }

  async function handleSubmitAnswer(slot, answer) {
    if (!activeSession) return null

    try {
      const { data, error } = await supabase.rpc('validate_answer', {
        p_session_id: activeSession.id,
        p_slot: slot,
        p_answer: parseInt(answer, 10),
      })
      if (error) return { correct: false, error: error.message }

      if (typeof data.signal_points_remaining === 'number') {
        setSignalPoints(data.signal_points_remaining)
        if (data.signal_points_remaining === 0) setShowReset(true)
      }

      if (data.correct) {
        const newSolved = { ...solved, [slot]: data.digit }
        setSolved(newSolved)

        if (waypointsMode) {
          const phaseSlots = getPhaseSlots(waypointPhase, activeQuestions)
          const phaseDone = phaseSlots.every(s => newSolved[s] !== undefined)

          if (phaseDone) {
            const isRealWaypoints = totalWaypoints > 0
            const wpCount = isRealWaypoints ? totalWaypoints : waypoints.length

            if (waypointPhase < wpCount && waypointPhase < activeQuestions.length - 1) {
              let wp
              if (isRealWaypoints) {
                // Fetch fresh — the slot just solved above is what unlocks
                // this waypoint server-side (get_puzzle_waypoints gates on
                // solved-slot count), so the real coordinates for THIS
                // waypoint don't exist client-side until this exact moment.
                // Waypoints beyond this one are still withheld by the RPC.
                const { data: realWpData } = await supabase.rpc('get_puzzle_waypoints', {
                  p_session_id: activeSession.id,
                })
                const unlocked = (realWpData?.waypoints || []).map(w => ({
                  lat: w.real_lat, lon: w.real_lon, geofence_m: w.geofence_radius_m,
                }))
                setWaypoints(unlocked)
                wp = unlocked[waypointPhase]
              } else {
                wp = waypoints[waypointPhase]
              }
              if (wp) {
                setCompassTarget({
                  lat: wp.lat, lon: wp.lon,
                  geofence_m: wp.geofence_m,
                  isWaypoint: true,
                  label: `WAYPOINT ${waypointPhase + 1} OF ${wpCount}`,
                })
                setTimeout(() => setScreen('compass'), 600)
              }
            } else {
              // All waypoints passed and this phase's slots solved  unlock final destination
              const { data: coords } = await supabase.rpc('unlock_coordinates', { p_session_id: activeSession.id })
              if (coords?.success) {
                const finalTarget = {
                  lat: parseFloat(coords.real_lat),
                  lon: parseFloat(coords.real_lon),
                  geofence_m: diffGeofence(activePack?.difficulty),
                  isWaypoint: false,
                  label: 'DESTINATION',
                }
                setRealCoords({ lat: finalTarget.lat, lon: finalTarget.lon, geofence_radius_m: finalTarget.geofence_m })
                setCompassTarget(finalTarget)
                setTimeout(() => setScreen('compass'), 600)
              }
            }
          }
        } else {
          if (data.all_solved) {
            const { data: coords } = await supabase.rpc('unlock_coordinates', { p_session_id: activeSession.id })
            if (coords?.success) {
              const finalTarget = {
                lat: parseFloat(coords.real_lat),
                lon: parseFloat(coords.real_lon),
                geofence_m: coords.geofence_radius_m || 15,
                isWaypoint: false,
                label: 'DESTINATION',
              }
              setRealCoords({ lat: finalTarget.lat, lon: finalTarget.lon, geofence_radius_m: finalTarget.geofence_m })
              setCompassTarget(finalTarget)
              setTimeout(() => setScreen('compass'), 600)
            }
          }
        }
      }

      return data
    } catch (err) {
      return { correct: false, error: err.message }
    }
  }

  function handleWaypointReached(legDist) {
    huntDistanceRef.current += Math.round(legDist || 0)
    const next = waypointPhase + 1
    setWaypointPhase(next)
    setCompassTarget(null)
    setCompassMsg(null)
    setScreen('puzzles')
  }

  // Client-side only — see huntStartedAt/huntDistanceRef comment above.
  function arrivalStats(legDist) {
    return {
      distance_walked_m: Math.round(huntDistanceRef.current + (legDist || 0)),
      time_taken_s: huntStartedAt ? Math.max(0, Math.round((Date.now() - huntStartedAt) / 1000)) : null,
    }
  }

  async function handleSimulateArrival() {
    const stats = arrivalStats(0)
    try {
      const { data, error } = await supabase.rpc('confirm_arrival', {
        p_session_id:  activeSession?.id,
        p_campaign_id: activeSession?.campaign_id,
        p_arrival_lat: compassTarget?.lat ?? 51.3963,
        p_arrival_lon: compassTarget?.lon ?? 0.5277,
      })
      if (data?.success) {
        setVoucher({ ...data, ...stats, difficulty: activePack?.difficulty || 'classic' })
        setScreen('arrived')
      } else {
        setVoucher({
          voucher_code:     'MTM-TEST-' + (Math.floor(Math.random() * 9000) + 1000),
          voucher_headline: activePack?.voucher_headline || 'Your reward is waiting',
          voucher_detail:   activePack?.voucher_detail || 'Show this screen to the venue to claim',
          business_name:    activePack?.business_name || '',
          difficulty:       activePack?.difficulty || 'classic',
          ...stats,
        })
        setScreen('arrived')
      }
    } catch (e) {
      setVoucher({
        voucher_code:     'MTM-' + (Math.floor(Math.random() * 9000) + 1000),
        voucher_headline: activePack?.voucher_headline || 'Your reward is waiting',
        voucher_detail:   activePack?.voucher_detail || 'Show this screen to the venue to claim',
        business_name:    activePack?.business_name || '',
        difficulty:       activePack?.difficulty || 'classic',
        ...stats,
      })
      setScreen('arrived')
    }
  }

  const handleArrived = useCallback(
    async (lat, lon, legDist) => {
      if (screen === 'arrived' || !activeSession) return

      const { data, error } = await supabase.rpc('confirm_arrival', {
        p_session_id: activeSession.id,
        p_campaign_id: activeSession.campaign_id,
        p_arrival_lat: lat,
        p_arrival_lon: lon,
      })

      if (error || !data?.success) {
        if (data?.error === 'outside_geofence') {
          setCompassMsg(`${Math.round(data.distance_m)}m away - get a bit closer!`)
        }
        return
      }

      const enrichedVoucher = {
        ...data,
        distance_walked_m: Math.round(huntDistanceRef.current + (legDist || 0)),
        time_taken_s: huntStartedAt ? Math.max(0, Math.round((Date.now() - huntStartedAt) / 1000)) : null,
        difficulty: activePack?.difficulty || 'classic',
      }
      setVoucher(enrichedVoucher)
      setScreen('arrived')
      try { localStorage.setItem('mtm_active_reward', JSON.stringify({ voucher: enrichedVoucher, expiresAt: Date.now() + 30 * 60 * 1000 })) } catch {}
    },
    [activeSession, screen, huntStartedAt, activePack]
  )

  const accent = hexAccent(activePack?.accent_color)
  const slots = activePack?.coordinate_slots || []

  const visibleQuestions = waypointsMode
    ? activeQuestions.filter((_, i) => i === waypointPhase)
    : activeQuestions

  const phaseSlots        = waypointsMode ? getPhaseSlots(waypointPhase, activeQuestions) : []
  const phaseSolvedSlots  = phaseSlots.filter(s => solved[s] !== undefined)
  const phaseUnsolved     = phaseSlots.filter(s => solved[s] === undefined)
  const isMultiSlotPhase  = phaseSlots.length > 1

  if (!accessGranted && !adminBypassChecked) return null
  if (!accessGranted) return <AccessGate onSuccess={() => setAccessGranted(true)} />

  return (
    <>
      <style>{CSS}</style>
      <div className="app" style={{ background: 'radial-gradient(ellipse at top, #1A0533 0%, #0A0A0F 60%)', backgroundAttachment: 'fixed', minHeight: '100dvh', color: '#F1F0FF' }}>
        {showReset && (
          <div className="reset-overlay">
            <div className="reset-sheet">
              
              <div className="reset-title">THAT'S A WRAP</div>
              <div className="reset-body">
                Out of takes — coordinate data has been wiped.
                Restart the pack to go again.
              </div>
              <button className="reset-action" onClick={() => startHunt(activePack)}>
                RESTART PACK
              </button>
            </div>
          </div>
        )}

        {screen === 'discover' && (
          <>
            <HuntSelectionScreen
              hunts={hunts}
              onSelect={startHunt}
              loading={huntsLoading || starting}
              prizePool={prizePool?.prize_amount_gbp || 0}
              playerCount={0}
            />
            <div style={{ position: 'fixed', bottom: 24, right: 16, zIndex: 50 }}>
              <button
                onClick={() => window.location.href = '/passport'}
                style={{
                  background: '#7C3AED',
                  border: '1px solid #9D5FF5',
                  color: '#F1F0FF',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontFamily: "'Share Tech Mono', monospace",
                  letterSpacing: '2px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 12px rgba(124,58,237,0.4)',
                }}
              >🎬 MY PASSPORT</button>
            </div>
          </>
        )}

        {screen === 'prefs' && (
          <PreferencesScreen
            initialPrefs={prefs}
            userId={prefsUserId}
            onBack={() => setScreen('discover')}
            onSaved={updated => setPrefs(updated)}
          />
        )}

        {screen === 'prizepool' && activePrizePool && (
          <PrizePoolScreen
            pool={activePrizePool}
            onBack={() => setScreen('discover')}
          />
        )}

        {screen === 'discover' && showInstallBanner && (
          <div style={{
            position: 'fixed', bottom: 80, left: 16, right: 16,
            background: '#1C1C26',
            border: '1px solid #7C3AED',
            borderRadius: 12, padding: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            zIndex: 1000,
            boxShadow: '0 4px 20px rgba(124,58,237,0.3)',
          }}>
            <div>
              <div style={{ color: '#F1F0FF', fontWeight: 700, fontSize: 14 }}>
                Add to Home Screen
              </div>
              <div style={{ color: '#8888BB', fontSize: 12, marginTop: 2 }}>
                Install for the best experience
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowInstallBanner(false)}
                style={{
                  background: 'transparent', border: '1px solid #32324A',
                  color: '#8888BB', padding: '8px 12px',
                  borderRadius: 8, fontSize: 13, cursor: 'pointer',
                }}
              >
                Later
              </button>
              <button
                onClick={handleInstall}
                style={{
                  background: 'linear-gradient(135deg, #7C3AED, #9D5FF5)',
                  border: 'none', color: '#fff',
                  padding: '8px 16px', borderRadius: 8,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Install
              </button>
            </div>
          </div>
        )}

        {screen === 'puzzles' && activePack && (
          <div className="puzzle-screen">
            <div className="pack-nav">
              <button className="nav-back" onClick={() => setScreen('discover')}><ChevronLeftIcon /></button>
              <span className="nav-pack-name">{activePack.pack_name}</span>
              <span className="nav-count">
                {Object.keys(solved).length}/{slots.length} solved
              </span>
            </div>
            <CoordDisplay hunt={activePack} solved={solved} />
            <TakesBar points={signalPoints} max={maxSignalPoints} accent={accent} />
            {isMultiSlotPhase && (
              <div style={{
                margin: '0 16px 6px', padding: '10px 14px',
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: '8px', fontSize: '11px', fontWeight: '700',
                letterSpacing: '0.06em', color: '#F59E0B', textAlign: 'center',
              }}>
                PHASE {waypointPhase} {''} Solve both {phaseSlots.join(' and ')} to proceed
              </div>
            )}
            {isMultiSlotPhase && phaseSolvedSlots.length > 0 && phaseUnsolved.length > 0 && (
              <div style={{
                margin: '0 16px 6px', padding: '10px 14px',
                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: '8px', fontSize: '13px', fontWeight: '600',
                color: '#10B981', textAlign: 'center',
              }}>
                {'+'} Slot {phaseSolvedSlots.join(', ')} solved {''} solve Slot {phaseUnsolved.join(' and ')} to continue
              </div>
            )}
            <div>
              {visibleQuestions.map(q => (
                <PuzzleCard
                  key={q.id}
                  question={q}
                  solvedDigit={solved[q.slot]}
                  onSubmitAnswer={handleSubmitAnswer}
                  accent={accent}
                  difficulty={activePack?.difficulty || 'classic'}
                />
              ))}
            </div>
          </div>
        )}

        {screen === 'compass' && activePack && compassTarget && (
          <div className="puzzle-screen">
            <div className="pack-nav">
              <button className="nav-back" onClick={() => setScreen('puzzles')}><ChevronLeftIcon /></button>
              <span className="nav-pack-name">{activePack?.pack_name || 'GPS Compass'}</span>
              <span className="nav-count" style={{ color: compassTarget.isWaypoint ? '#F59E0B' : '#10B981' }}>
                {compassTarget.isWaypoint ? compassTarget.label : 'All slots unlocked'}
              </span>
            </div>
            <CompassScreen
              target={compassTarget}
              hunt={activePack}
              onArrived={handleArrived}
              onWaypointReached={handleWaypointReached}
              compassMsg={compassMsg}
            />
            <button
              className="sim-btn"
              onClick={() => {
                if (compassTarget.isWaypoint) handleWaypointReached()
                else handleSimulateArrival()
              }}
            >
              {compassTarget.isWaypoint ? 'SIMULATE WAYPOINT' : 'SIMULATE ARRIVAL'}
            </button>
          </div>
        )}

        {screen === 'arrived' && (
          <div className="puzzle-screen">
            <div className="pack-nav">
              <button className="nav-back nav-back-wide" onClick={() => { localStorage.removeItem('mtm_active_reward'); setScreen('discover') }}><ChevronLeftIcon />All Hunts</button>
            </div>
            <ArrivedScreen voucher={voucher} />
          </div>
        )}
      </div>
    </>
  )
}
