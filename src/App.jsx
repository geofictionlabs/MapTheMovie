import { useState, useEffect, useCallback, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from './lib/supabase'

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
  return { casual: 25, classic: 15, expert: 10 }[difficulty] || 15
}

function fmtDistance(m) {
  const mi = m / 1609.34
  if (mi < 0.05) return `${Math.round(m)} m`
  return `${mi.toFixed(1)} mi`
}

// accent_color stored without '#' in DB
function hexAccent(raw) {
  if (!raw) return '#7C3AED'
  return raw.startsWith('#') ? raw : '#' + raw
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

/*  Signal bar  */
.signal-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  padding: 10px 14px;
  background: #1C1C26;
  border: 1px solid #32324A;
  border-radius: 12px;
}
.signal-label {
  font-family: 'Share Tech Mono', monospace;
  font-size: 10px;
  letter-spacing: 1.5px;
  color: #8888BB;
}
.signal-pips { display: flex; gap: 3px; flex: 1; }
.signal-pip {
  flex: 1;
  height: 12px;
  border-radius: 4px;
  background: #252533;
  transition: background 0.2s;
}
.signal-count {
  font-family: 'Share Tech Mono', monospace;
  font-size: 12px;
  color: #B8B4D8;
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
  padding: 20px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
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
.compass-on-track-label {
  font-family: 'Share Tech Mono', monospace;
  font-size: 12px;
  letter-spacing: 3px;
  color: #10B981;
  animation: on-track-pulse 1s infinite;
}
@keyframes on-track-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.35; }
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
//  Hunt Discovery 
function HuntDiscovery({ hunts, loading, error, onStart, userPos }) {
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

  return (
    <div className="discover-screen">
      <div className="logo-wrap">
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

      {viewMode === 'list' && !loading && hunts.map(h => (
        <HuntCard
          key={h.campaign_id}
          hunt={h}
          onTap={handleTap}
          distLabel={distLabel(h)}
        />
      ))}

      <div className="app-footer">
        <a className="footer-link" href="/privacy.html">Privacy</a>
        <a className="footer-link" href="/terms.html">Terms</a>
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
function SignalBar({ points, accent }) {
  const MAX = 10
  const warn = points <= 3
  const barColor = warn ? '#EF4444' : accent

  return (
    <div className="signal-bar">
      <span className="signal-label">SIGNAL</span>
      <div className="signal-pips">
        {Array.from({ length: MAX }, (_, i) => (
          <div
            key={i}
            className="signal-pip"
            style={{ background: i < points ? barColor : '#252533' }}
          />
        ))}
      </div>
      <span className="signal-count" style={{ color: warn ? '#EF4444' : '#B8B4D8' }}>
        {points}/{MAX}
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
      setMsg('Signal lost.')
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
              placeholder={question.placeholder || 'e.g. ?'}
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
  const intervalRef = useRef(null)
  const [toBearing, setToBearing] = useState(0)
  // orientState: 'init' | 'needs-permission' | 'active' | 'calibrating' | 'denied' | 'unsupported'
  const [orientState, setOrientState] = useState('init')
  const [deviceHeading, setDeviceHeading] = useState(null)
  const orientCleanupRef = useRef(null)
  const arrivedRef = useRef(false)
  const headingHistoryRef = useRef([])
  const targetRef = useRef(target)
  const onArrivedRef = useRef(onArrived)
  const onWaypointReachedRef = useRef(onWaypointReached)
  useEffect(() => { targetRef.current = target }, [target])
  useEffect(() => { onArrivedRef.current = onArrived }, [onArrived])
  useEffect(() => { onWaypointReachedRef.current = onWaypointReached }, [onWaypointReached])

  const accent = hexAccent(hunt?.accent_color)
  const geofence = target?.geofence_m || 15

  // GPS polling — getCurrentPosition every 5 seconds (Safari-compatible, no watchPosition)
  useEffect(() => {
    function getPosition() {
      if (!navigator.geolocation) return
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude
          const lon = pos.coords.longitude
          setPlayerPos({ lat, lon })
          if (target?.lat) {
            const R = 6371000
            const dLat = (target.lat - lat) * Math.PI / 180
            const dLon = (target.lon - lon) * Math.PI / 180
            const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat * Math.PI / 180) *
              Math.cos(target.lat * Math.PI / 180) *
              Math.sin(dLon / 2) ** 2
            const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
            setDistance(dist)
            setStartDist(prev => prev ?? dist)
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
      )
    }
    getPosition()
    intervalRef.current = setInterval(getPosition, 5000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [target])

  // Bearing + arrival detection whenever position or distance updates
  useEffect(() => {
    const t = targetRef.current
    if (!playerPos || !t?.lat || !t?.lon) return
    setToBearing(bearingDegrees(playerPos.lat, playerPos.lon, t.lat, t.lon))
    if (distance != null && distance <= (t.geofence_m || 15) && !arrivedRef.current) {
      arrivedRef.current = true
      if (t.isWaypoint) { onWaypointReachedRef.current?.() }
      else { onArrivedRef.current?.(playerPos.lat, playerPos.lon) }
    }
  }, [playerPos, distance])

  // Device orientation: Safari iOS requires explicit permission; others auto-start
  useEffect(() => {
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    if (isSafari && typeof DeviceOrientationEvent?.requestPermission === 'function') {
      setOrientState('needs-permission')
    } else if ('DeviceOrientationEvent' in window || 'ondeviceorientation' in window) {
      startOrientListener()
    } else {
      setOrientState('unsupported')
    }
    return () => { if (orientCleanupRef.current) orientCleanupRef.current() }
  }, [])

  function smoothHeading(newHeading) {
    const h = headingHistoryRef.current
    h.push(newHeading)
    if (h.length > 5) h.shift()
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

      let heading = null
      if (e.webkitCompassHeading != null && e.webkitCompassHeading >= 0) {
        heading = e.webkitCompassHeading
      } else if (e.alpha != null) {
        heading = (360 - e.alpha + 360) % 360
      }
      if (heading == null) return

      if (e.type === 'deviceorientationabsolute') absoluteFired = true
      if (!fired) { fired = true; clearTimeout(timeoutId); setOrientState('active') }
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

  const gpsStatus = playerPos ? 'active' : 'searching'
  const gpsStatusText = {
    searching:   'ACQUIRING GPS',
    active:      `GPS ACTIVE  TARGET ~${geofence}m`,
    error:       'GPS UNAVAILABLE',
    unavailable: 'GPS NOT SUPPORTED',
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
  const onTrack = isFacingDestination && distance != null && gpsStatus === 'active'
  const journeyPct = startDist > 0
    ? Math.min(100, Math.max(0, ((startDist - (distance || 0)) / startDist) * 100))
    : 0
  const distMi = (distance != null && distance >= 0) ? (distance / 1609.34).toFixed(1) : '--'
  const destLabel = (distance != null && distance >= 0)
    ? (target?.isWaypoint ? 'MI TO WAYPOINT' : 'MI TO DESTINATION')
    : 'CALCULATING...'

  return (
    <div className="compass-wrap">
      {/* Waypoint / destination badge */}
      <div style={{
        background: target?.isWaypoint ? 'linear-gradient(135deg, #F59E0B, #FCD34D)' : '#10B981',
        color: target?.isWaypoint ? '#000' : '#fff',
        fontFamily: "'Share Tech Mono', monospace",
        fontWeight: 800, fontSize: 13, padding: '6px 16px',
        borderRadius: 20, letterSpacing: 1,
      }}>
        {target?.isWaypoint ? (target?.label || 'WAYPOINT') : 'DESTINATION'}
      </div>

      {/* Film-reel compass ring — 280px */}
      <div className="compass-arrow-wrap">
        {/* Outer ring — reactive green state via inline styles */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: `3px solid ${isFacingDestination ? '#10B981' : '#7C3AED'}`,
          boxShadow: isFacingDestination
            ? '0 0 30px rgba(16,185,129,0.4), inset 0 0 24px rgba(16,185,129,0.12)'
            : '0 0 20px rgba(124,58,237,0.3), inset 0 0 24px rgba(124,58,237,0.12)',
          transition: 'border-color 0.4s, box-shadow 0.4s',
        }} />

        {/* Sprocket holes — 16 dark-filled circles via SVG */}
        <svg style={{ position: 'absolute', inset: 0, width: 280, height: 280 }}>
          {Array.from({ length: 16 }, (_, i) => {
            const angle = (i * 22.5 * Math.PI) / 180
            const cx = 140 + 128 * Math.cos(angle - Math.PI / 2)
            const cy = 140 + 128 * Math.sin(angle - Math.PI / 2)
            return <circle key={i} cx={cx} cy={cy} r={5} fill="#0A0A0F" stroke="#5B21B6" strokeWidth={2} />
          })}
        </svg>

        {/* Needle — rotates based on bearing; static (north-up) when no data */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 8, height: 140,
          transformOrigin: 'bottom center',
          transform: `translate(-50%, -100%) rotate(${needleRotation}deg)`,
          transition: searching ? 'none' : 'transform 0.5s ease',
          opacity: orientState === 'needs-permission' ? 0.35 : 1,
        }}>
          <div style={{
            width: 8, height: 140,
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Top half — gold, green when facing destination */}
            <div style={{
              width: 8, height: 70, flexShrink: 0,
              background: isFacingDestination ? '#10B981' : 'linear-gradient(180deg, #FCD34D, #F59E0B)',
              borderRadius: '4px 4px 0 0',
              filter: isFacingDestination ? 'drop-shadow(0 0 6px rgba(16,185,129,0.8))' : 'drop-shadow(0 0 6px rgba(245,158,11,0.8))',
              transition: 'background 0.4s, filter 0.4s',
            }} />
            {/* Bottom half — grey counterweight */}
            <div style={{
              width: 8, height: 70, flexShrink: 0,
              background: '#32324A',
              borderRadius: '0 0 4px 4px',
            }} />
          </div>
        </div>

        {/* Centre pivot */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 16, height: 16, borderRadius: '50%',
          background: isFacingDestination ? '#10B981' : '#7C3AED',
          border: '3px solid #9D5FF5',
          transition: 'background 0.4s',
          zIndex: 3,
        }} />
      </div>

      {/* Distance display */}
      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <div style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: 52, fontWeight: 900,
          color: '#F1F0FF', lineHeight: 1, minHeight: 52,
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

      {/* On-track label */}
      {isFacingDestination && <div className="compass-on-track-label">ON TRACK</div>}

      {/* Journey progress bar */}
      <div className="compass-journey-bar">
        <div className="compass-journey-fill" style={{ width: `${journeyPct}%` }} />
      </div>

      {orientState === 'needs-permission' && (
        <button className="compass-permission-btn" onClick={requestCompassPermission}>
          ENABLE COMPASS
        </button>
      )}
      {orientState === 'calibrating' && (
        <div className="compass-calibrating">CALIBRATING COMPASS</div>
      )}
      {distance != null && gpsStatus === 'active' && !onTrack && (
        <div style={{ fontSize: 12, color: '#8888BB', fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1 }}>
          HEAD {cardinalDir()}
        </div>
      )}

      {gpsStatus === 'error' || gpsStatus === 'unavailable' ? (
        <div style={{ textAlign: 'center' }}>
          <div className="compass-status">GPS signal needed</div>
          <div style={{ fontSize: 12, color: '#8888BB', marginTop: 4, lineHeight: 1.5 }}>
            Step outside and allow location access
          </div>
        </div>
      ) : gpsStatus === 'searching' ? (
        <div className="compass-status">ACQUIRING GPS</div>
      ) : (
        <div className="compass-status">GPS ACTIVE  ~{geofence}m geofence</div>
      )}

      {compassMsg && <div className="compass-msg-box">{compassMsg}</div>}
    </div>
  )
}

//  Account Prompt
function AccountPrompt() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSave() {
    if (!email.includes('@')) return
    await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } })
    setSent(true)
  }

  return (
    <div className="account-prompt">
      <div className="account-prompt-title">Save your progress</div>
      <div className="account-prompt-sub">
        Get notified about new hunts near you. Free forever.
      </div>
      {sent ? (
        <div className="account-sent">Check your inbox for a sign-in link.</div>
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
          <button className="account-maybe" onClick={() => {}}>Maybe later</button>
        </>
      )}
    </div>
  )
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
        <div style={{ width: '100%' }}><AccountPrompt /></div>
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

      <div style={{ fontSize: 13, color: '#8888BB', marginBottom: 20, textAlign: 'center', lineHeight: 1.5 }}>
        You solved the puzzle and walked to the location.
        <br />Show this screen to claim your reward.
      </div>

      <div style={{
        background: '#F1F0FF', color: '#121218', borderRadius: 16, overflow: 'hidden',
        width: '100%', maxWidth: 340, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        transform: entered ? 'translateY(0) scale(1)' : 'translateY(60px) scale(0.92)',
        opacity: entered ? 1 : 0,
        transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.35s ease',
      }}>
        <div style={{ background: 'linear-gradient(135deg, #7C3AED, #9D5FF5)', color: '#fff', padding: '20px 24px', fontFamily: "'Share Tech Mono', monospace", fontWeight: 900, fontSize: 18, letterSpacing: 2 }}>
          REWARD UNLOCKED
        </div>
        <div style={{ borderTop: '2px dashed rgba(124,58,237,0.25)', background: '#F1F0FF' }} />
        <div style={{ padding: '16px 20px 0', background: '#F1F0FF' }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: '#9D5FF5', fontFamily: "'Share Tech Mono', monospace", marginBottom: 10 }}>
            {voucher?.business_name || 'YOUR REWARD'}
          </div>
          {voucher && (
            <>
              <div style={{ fontFamily: "'Nunito', sans-serif", fontSize: 22, fontWeight: 800, color: '#121218', marginBottom: 6, lineHeight: 1.2 }}>
                {voucher.voucher_headline}
              </div>
              <div style={{ fontSize: 13, color: '#8888BB', marginBottom: 16, lineHeight: 1.4 }}>
                {voucher.voucher_detail}
              </div>
            </>
          )}
          <div style={{ background: '#121218', color: '#F59E0B', fontFamily: "'Share Tech Mono', monospace", fontSize: 28, fontWeight: 700, letterSpacing: 4, padding: '16px 24px', borderRadius: 8, marginBottom: 20, textAlign: 'center' }}>
            {voucher?.voucher_code || '---'}
          </div>
        </div>
        <button
          onClick={() => setStep('handoff')}
          style={{ background: 'linear-gradient(135deg, #7C3AED, #9D5FF5)', color: '#fff', width: '100%', height: 52, fontFamily: "'Share Tech Mono', monospace", fontWeight: 800, fontSize: 13, letterSpacing: 2, border: 'none', cursor: 'pointer', borderRadius: '0 0 16px 16px' }}
        >
          PRESENT TO STAFF
        </button>
      </div>
    </div>
  )
}

//  Waypoint helpers 
function generateWaypoints(startLat, startLon, destLat, destLon, tier, difficulty) {
  const count = tier === 'premium' ? 2 : tier === 'elite' ? 4 : 0
  if (count === 0) return []
  const pts = []
  for (let i = 1; i <= count; i++) {
    const f = i / (count + 1)
    pts.push({
      index:      i,
      lat:        startLat + (destLat - startLat) * f,
      lon:        startLon + (destLon - startLon) * f,
      geofence_m: diffGeofence(difficulty),
      unlocks_slots: tier === 'premium'
        ? (i === 1 ? ['B'] : ['C', 'D'])
        : (i === 1 ? ['B'] : i === 2 ? ['C'] : i === 3 ? ['D'] : ['E']),
    })
  }
  return pts
}

function getPhaseSlots(phase, questions) {
  if (phase === 0) return questions.slice(0, 1).map(q => q.slot)
  if (phase === 1) return questions.slice(1, 2).map(q => q.slot)
  return questions.slice(2).map(q => q.slot)
}

//  App 
export default function App() {
  const [screen, setScreen] = useState('discover')
  const [hunts, setHunts] = useState([])
  const [huntsLoading, setHuntsLoading] = useState(true)
  const [huntsError, setHuntsError] = useState(null)
  const [userPos, setUserPos] = useState(null)

  const [activePack, setActivePack] = useState(null)
  const [activeSession, setActiveSession] = useState(null)
  const [activeQuestions, setActiveQuestions] = useState([])
  const [solved, setSolved] = useState({})
  const [signalPoints, setSignalPoints] = useState(10)
  const [realCoords, setRealCoords] = useState(null)
  const [voucher, setVoucher] = useState(null)
  const [showReset, setShowReset] = useState(false)
  const [starting, setStarting] = useState(false)
  const [compassMsg, setCompassMsg] = useState(null)
  const [waypointsMode, setWaypointsMode] = useState(false)
  const [waypoints, setWaypoints] = useState([])
  const [waypointPhase, setWaypointPhase] = useState(0)
  const [compassTarget, setCompassTarget] = useState(null)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)

  useEffect(() => {
    loadHunts()
    registerSW()
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
      const { data, error } = await supabase
        .from('campaigns')
        .select(`
          id,
          voucher_headline,
          difficulty,
          puzzle_packs (
            id, name, emoji, tier, description, accent_color, theme_tag, genre,
            puzzles ( id, coordinate_slots, masked_lat, masked_lon, is_active )
          ),
          businesses ( id, name, location, is_active )
        `)
        .eq('status', 'active')

      if (error) throw error

      const hunts = (data || []).flatMap(c => {
        const pp = c.puzzle_packs
        const b  = c.businesses
        if (!pp || !b || b.is_active === false) return []

        // Pick the first active puzzle for this pack
        const pz = (pp.puzzles || []).find(p => p.is_active)
        if (!pz) return []

        // PostgREST returns geography as GeoJSON  may be string or object
        let lat = 0, lon = 0
        try {
          const geo = typeof b.location === 'string' ? JSON.parse(b.location) : b.location
          if (geo?.coordinates) { lon = geo.coordinates[0]; lat = geo.coordinates[1] }
        } catch {}

        return [{
          campaign_id:      c.id,
          pack_id:          pp.id,
          puzzle_id:        pz.id,
          pack_name:        pp.name,
          pack_emoji:       pp.emoji,
          pack_tier:        pp.tier,
          pack_description: pp.description,
          accent_color:     pp.accent_color,
          theme_tag:        pp.theme_tag,
          genre:            pp.genre,
          coordinate_slots: pz.coordinate_slots,
          masked_lat:       pz.masked_lat,
          masked_lon:       pz.masked_lon,
          is_free_tier:     pp.tier === 'standard',
          business_name:    b.name,
          voucher_headline: c.voucher_headline,
          difficulty:       c.difficulty || 'classic',
          approx_lat:       lat,
          approx_lon:       lon,
        }]
      })

      setHunts(hunts)
    } catch (err) {
      setHuntsError(err.message)
    } finally {
      setHuntsLoading(false)
    }
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
    const { data: { user } } = await supabase.auth.getUser()
    if (user) return user

    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) throw new Error('Sign-in failed: ' + error.message)

    await supabase.from('profiles').upsert(
      { id: data.user.id },
      { onConflict: 'id' }
    )
    return data.user
  }

  async function startHunt(hunt) {
    getUserPos() // request GPS on user interaction, not on page load
    setStarting(true)
    setHuntsError(null)
    try {
      const user = await ensureAuth()

      // Load previously seen question IDs for this user (localStorage)
      const seenIds = getSeenQuestionIds(user.id)

      const { data: session, error: sessionErr } = await supabase
        .from('hunt_sessions')
        .insert({
          user_id: user.id,
          puzzle_id: hunt.puzzle_id,
          start_lat: userPos?.lat ?? null,
          start_lon: userPos?.lon ?? null,
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
      const isPremium = puzzleData?.pack_tier === 'premium' || puzzleData?.pack_tier === 'elite'

      setActivePack(hunt)
      setActiveSession({ id: session.id, campaign_id: hunt.campaign_id })
      setActiveQuestions(questions)
      setSolved({})
      setSignalPoints(hunt.difficulty === 'expert' ? 5 : 10)
      setShowReset(false)
      setRealCoords(null)
      setVoucher(null)
      setCompassMsg(null)
      setWaypointPhase(0)
      setCompassTarget(null)

      // Premium packs: fetch destination once, generate waypoints client-side.
      // get_puzzle_destination takes only a UUID  no FLOAT8 type issues.
      let wps = []
      if (isPremium) {
        const startPos = userPos || { lat: 51.3748, lon: 0.5439 }
        try {
          const { data: destData, error: destErr } = await supabase.rpc('get_puzzle_destination', {
            p_session_id: session.id,
          })
          if (destData?.success) {
            wps = generateWaypoints(
              startPos.lat, startPos.lon,
              parseFloat(destData.real_lat), parseFloat(destData.real_lon),
              puzzleData.pack_tier,
              hunt.difficulty || 'classic',
            )
          }
        } catch (e) { /* linear mode fallback */ }
      }
      setWaypoints(wps)
      setWaypointsMode(wps.length > 0)

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
            if (waypointPhase < waypoints.length) {
              const wp = waypoints[waypointPhase]
              setCompassTarget({
                lat: wp.lat, lon: wp.lon,
                geofence_m: wp.geofence_m,
                isWaypoint: true,
                label: `WAYPOINT ${waypointPhase + 1} OF ${waypoints.length}`,
              })
              setTimeout(() => setScreen('compass'), 600)
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

  function handleWaypointReached() {
    const next = waypointPhase + 1
    setWaypointPhase(next)
    setCompassTarget(null)
    setCompassMsg(null)
    setScreen('puzzles')
  }

  async function handleSimulateArrival() {
    try {
      const { data, error } = await supabase.rpc('confirm_arrival', {
        p_session_id:  activeSession?.id,
        p_campaign_id: activeSession?.campaign_id,
        p_arrival_lat: compassTarget?.lat ?? 51.3963,
        p_arrival_lon: compassTarget?.lon ?? 0.5277,
      })
      if (data?.success) {
        setVoucher(data)
        setScreen('arrived')
      } else {
        setVoucher({
          voucher_code:     'MTM-TEST-' + (Math.floor(Math.random() * 9000) + 1000),
          voucher_headline: activePack?.voucher_headline || 'Your reward is waiting',
          voucher_detail:   activePack?.voucher_detail || 'Show this screen to the venue to claim',
          business_name:    activePack?.business_name || '',
        })
        setScreen('arrived')
      }
    } catch (e) {
      setVoucher({
        voucher_code:     'MTM-' + (Math.floor(Math.random() * 9000) + 1000),
        voucher_headline: activePack?.voucher_headline || 'Your reward is waiting',
        voucher_detail:   activePack?.voucher_detail || 'Show this screen to the venue to claim',
        business_name:    activePack?.business_name || '',
      })
      setScreen('arrived')
    }
  }

  const handleArrived = useCallback(
    async (lat, lon) => {
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

      setVoucher(data)
      setScreen('arrived')
    },
    [activeSession, screen]
  )

  const accent = hexAccent(activePack?.accent_color)
  const slots = activePack?.coordinate_slots || []

  const visibleQuestions = waypointsMode
    ? activeQuestions.filter((_, i) => {
        if (waypointPhase === 0) return i === 0
        if (waypointPhase === 1) return i === 1
        return i >= 2
      })
    : activeQuestions

  const phaseSlots        = waypointsMode ? getPhaseSlots(waypointPhase, activeQuestions) : []
  const phaseSolvedSlots  = phaseSlots.filter(s => solved[s] !== undefined)
  const phaseUnsolved     = phaseSlots.filter(s => solved[s] === undefined)
  const isMultiSlotPhase  = phaseSlots.length > 1

  return (
    <>
      <style>{CSS}</style>
      <div className="app" style={{ background: 'radial-gradient(ellipse at top, #1A0533 0%, #0A0A0F 60%)', backgroundAttachment: 'fixed', minHeight: '100dvh', color: '#F1F0FF' }}>
        {showReset && (
          <div className="reset-overlay">
            <div className="reset-sheet">
              
              <div className="reset-title">SIGNAL LOST</div>
              <div className="reset-body">
                Too many wrong guesses  coordinate data has been wiped.
                Restart the pack to try again.
              </div>
              <button className="reset-action" onClick={() => startHunt(activePack)}>
                RESTART PACK
              </button>
            </div>
          </div>
        )}

        {screen === 'discover' && (
          <HuntDiscovery
            hunts={hunts}
            loading={huntsLoading || starting}
            error={huntsError}
            onStart={startHunt}
            userPos={userPos}
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
              <button className="nav-back" onClick={() => setScreen('discover')}></button>
              <span className="nav-pack-name">{activePack.pack_name}</span>
              <span className="nav-count">
                {Object.keys(solved).length}/{slots.length} solved
              </span>
            </div>
            <CoordDisplay hunt={activePack} solved={solved} />
            <SignalBar points={signalPoints} accent={accent} />
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
              <button className="nav-back" onClick={() => setScreen('puzzles')}></button>
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
              <button className="nav-back" onClick={() => setScreen('discover')}> All Hunts</button>
            </div>
            <ArrivedScreen voucher={voucher} />
          </div>
        )}
      </div>
    </>
  )
}
