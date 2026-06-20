import { useState, useEffect, useCallback, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from './lib/supabase'

// ── Haversine distance ─────────────────────────────────────────────────────
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
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const y = Math.sin(dLon) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dLon)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function fmtDistance(m) {
  if (m < 1000) return `${Math.round(m)}m`
  return `${(m / 1000).toFixed(1)}km`
}

// accent_color stored without '#' in DB
function hexAccent(raw) {
  if (!raw) return '#7C3AED'
  return raw.startsWith('#') ? raw : '#' + raw
}

// ── CSS ────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Space+Grotesk:wght@400;500;600;700&family=Share+Tech+Mono&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: #121218;
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

/* ── Logo ─────────────────── */
.logo-wrap {
  text-align: center;
  padding: 40px 24px 8px;
}
.logo-wordmark {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 6px;
  margin-top: 10px;
}
.logo-map {
  font-family: 'Nunito', sans-serif;
  font-size: 32px;
  font-weight: 900;
  color: #7C3AED;
  letter-spacing: 3px;
}
.logo-the {
  font-family: 'Share Tech Mono', monospace;
  font-size: 11px;
  color: #6B67A0;
  letter-spacing: 4px;
}
.logo-movie {
  font-family: 'Nunito', sans-serif;
  font-size: 32px;
  font-weight: 900;
  color: #F59E0B;
  letter-spacing: 3px;
}
.logo-sub {
  font-size: 11px;
  letter-spacing: 3px;
  color: #6B67A0;
  font-family: 'Share Tech Mono', monospace;
  margin-top: 6px;
}

/* ── Discover screen ──────── */
.discover-screen {
  padding: 0 16px 40px;
}
.section-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #6B67A0;
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

/* ── Hunt card ────────────── */
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
  color: #6B67A0;
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
.badge-dist { background: #252533; color: #6B67A0; }
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

/* ── Map ─────────────────── */
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
  color: #6B67A0;
  font-family: 'Share Tech Mono', monospace;
  letter-spacing: 0.5px;
}

/* ── Loading / Error ─────── */
.loading-state {
  text-align: center;
  padding: 48px 20px;
  color: #6B67A0;
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
  color: #6B67A0;
  font-size: 13px;
}

/* ── Paywall modal ──────── */
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
.modal-sub { font-size: 13px; color: #6B67A0; margin-bottom: 24px; line-height: 1.5; }
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
.modal-input::placeholder { color: #6B67A0; }
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
.modal-divider { text-align: center; font-size: 11px; color: #6B67A0; margin: 16px 0; letter-spacing: 2px; }
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

/* ── Puzzle screen ──────── */
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
  color: #6B67A0;
  white-space: nowrap;
}

/* ── Coord display ──────── */
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
  color: #6B67A0;
  font-family: 'Share Tech Mono', monospace;
  margin-bottom: 10px;
}
.coord-strings {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-family: 'Share Tech Mono', monospace;
  font-size: 20px;
  letter-spacing: 2px;
  margin-bottom: 14px;
}
.coord-slot-solved {
  color: #F59E0B;
  font-weight: 700;
}
.coord-slot-pending {
  color: #32324A;
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

/* ── Signal bar ──────────── */
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
  color: #6B67A0;
}
.signal-pips { display: flex; gap: 4px; flex: 1; }
.signal-pip {
  flex: 1;
  height: 12px;
  border-radius: 3px;
  background: #252533;
  transition: background 0.2s;
}
.signal-count {
  font-family: 'Share Tech Mono', monospace;
  font-size: 12px;
  color: #B8B4D8;
}

/* ── Puzzle card ─────────── */
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
  color: #6B67A0;
  margin-bottom: 10px;
}
.puzzle-category {
  font-size: 11px;
  color: #6B67A0;
  margin-bottom: 8px;
  letter-spacing: 1px;
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
  color: #6B67A0;
  margin-bottom: 14px;
  font-style: italic;
  line-height: 1.4;
}
.puzzle-input-row { display: flex; gap: 8px; }
.puzzle-input {
  flex: 0 0 64px;
  background: #121218;
  border: 1px solid #32324A;
  border-radius: 10px;
  color: #F1F0FF;
  font-family: 'Share Tech Mono', monospace;
  font-size: 22px;
  padding: 10px 14px;
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
  flex: 1;
  border: none;
  border-radius: 10px;
  font-family: 'Share Tech Mono', monospace;
  font-size: 12px;
  letter-spacing: 2px;
  padding: 10px 18px;
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
  color: #6B67A0;
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

/* ── Compass screen ──────── */
.compass-wrap {
  padding: 20px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.compass-dist {
  font-family: 'Nunito', sans-serif;
  font-size: 60px;
  font-weight: 900;
  color: #F1F0FF;
  letter-spacing: -2px;
  line-height: 1;
}
.compass-unit { font-size: 20px; color: #6B67A0; font-weight: 700; }
.compass-arrow-wrap {
  position: relative;
  width: 180px;
  height: 180px;
}
.compass-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 3px solid #32324A;
}
.compass-status {
  font-family: 'Share Tech Mono', monospace;
  font-size: 11px;
  letter-spacing: 2px;
  color: #6B67A0;
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
.sim-btn {
  width: 100%;
  margin-top: 12px;
  background: #252533;
  border: 1px dashed #32324A;
  border-radius: 10px;
  color: #6B67A0;
  font-family: 'Share Tech Mono', monospace;
  font-size: 10px;
  letter-spacing: 2px;
  padding: 10px;
  cursor: pointer;
}

/* ── Arrived screen ──────── */
.arrived-wrap {
  padding: 32px 0 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.arrived-emoji { font-size: 64px; }
.arrived-title {
  font-family: 'Nunito', sans-serif;
  font-size: 28px;
  font-weight: 900;
  color: #F1F0FF;
  letter-spacing: 2px;
}
.arrived-sub { font-size: 13px; color: #6B67A0; text-align: center; line-height: 1.5; }
.voucher-card {
  background: #1C1C26;
  border: 1px solid #32324A;
  border-radius: 18px;
  padding: 22px 20px;
  width: 100%;
  margin-top: 10px;
}
.voucher-from {
  font-size: 10px;
  letter-spacing: 2px;
  color: #6B67A0;
  font-family: 'Share Tech Mono', monospace;
  margin-bottom: 8px;
}
.voucher-offer {
  font-family: 'Nunito', sans-serif;
  font-size: 20px;
  font-weight: 800;
  color: #F59E0B;
  margin-bottom: 4px;
}
.voucher-detail { font-size: 13px; color: #B8B4D8; margin-bottom: 14px; }
.voucher-code {
  font-family: 'Share Tech Mono', monospace;
  font-size: 22px;
  letter-spacing: 4px;
  color: #F1F0FF;
  background: #252533;
  border-radius: 10px;
  padding: 12px 16px;
  text-align: center;
}
.redeem-btn {
  width: 100%;
  margin-top: 16px;
  border: none;
  border-radius: 14px;
  font-family: 'Share Tech Mono', monospace;
  font-size: 13px;
  letter-spacing: 2px;
  padding: 18px;
  cursor: pointer;
  font-weight: 700;
  transition: all 0.2s;
}
.redeem-btn.idle { background: #7C3AED; color: #fff; }
.redeem-btn.done {
  background: rgba(16,185,129,0.12);
  color: #10B981;
  border: 1px solid rgba(16,185,129,0.3);
}

/* ── Account prompt ──────── */
.account-prompt {
  margin-top: 20px;
  background: rgba(124,58,237,0.06);
  border: 1px solid rgba(124,58,237,0.2);
  border-radius: 14px;
  padding: 16px;
  width: 100%;
}
.account-prompt-title {
  font-size: 13px;
  font-weight: 700;
  color: #9D5FF5;
  margin-bottom: 4px;
}
.account-prompt-sub { font-size: 12px; color: #6B67A0; margin-bottom: 12px; }
.account-email-row { display: flex; gap: 8px; }
.account-input {
  flex: 1;
  background: #121218;
  border: 1px solid #32324A;
  border-radius: 10px;
  color: #F1F0FF;
  font-family: 'Space Grotesk', system-ui, sans-serif;
  font-size: 13px;
  padding: 9px 12px;
  outline: none;
}
.account-input:focus { border-color: #7C3AED; }
.account-submit {
  background: #7C3AED;
  border: none;
  border-radius: 10px;
  color: #fff;
  font-family: 'Share Tech Mono', monospace;
  font-size: 11px;
  letter-spacing: 1px;
  padding: 9px 14px;
  cursor: pointer;
}
.account-sent { font-size: 12px; color: #10B981; }

/* ── Reset modal ─────────── */
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
.reset-body { font-size: 13px; color: #6B67A0; margin-bottom: 24px; line-height: 1.5; }
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

/* ── Footer ──────────────── */
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
  color: #6B67A0;
  text-decoration: none;
}
.footer-link:hover { color: #7C3AED; }
`

// ── Logo ──────────────────────────────────────────────────────────────────
function LogoSVG() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="24" fill="#7C3AED" fillOpacity="0.15" />
      <circle cx="24" cy="24" r="16" fill="#7C3AED" fillOpacity="0.25" />
      <circle cx="24" cy="24" r="6" fill="#7C3AED" />
      <circle cx="24" cy="10" r="3" fill="#F59E0B" />
      <circle cx="24" cy="38" r="3" fill="#F59E0B" />
      <circle cx="10" cy="24" r="3" fill="#F59E0B" />
      <circle cx="38" cy="24" r="3" fill="#F59E0B" />
    </svg>
  )
}

// ── Paywall Modal ─────────────────────────────────────────────────────────
function PaywallModal({ hunt, onClose }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  async function handleJoin() {
    if (!email.includes('@')) return
    await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } })
    setSent(true)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <button className="modal-close" onClick={onClose}>✕</button>
        <div style={{ fontSize: 32 }}>{hunt.pack_emoji}</div>
        <div className="modal-title">{hunt.pack_name}</div>
        <div className="modal-sub">
          This is a {hunt.pack_tier} hunt. Sign in to unlock it — it only takes a magic link.
        </div>
        {sent ? (
          <div className="modal-sent">✓ Magic link sent! Check your inbox.</div>
        ) : (
          <div className="modal-email-row">
            <input
              className="modal-input"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
            />
            <button className="modal-btn-main" onClick={handleJoin}>JOIN</button>
          </div>
        )}
        <div className="modal-divider">— OR —</div>
        <button className="modal-free-btn" onClick={onClose}>
          BROWSE FREE HUNTS ONLY
        </button>
      </div>
    </div>
  )
}

// ── Leaflet Hunt Map ──────────────────────────────────────────────────────
function HuntMap({ hunts, userPos, onHuntSelect }) {
  const mapRef = useRef(null)
  const instanceRef = useRef(null)

  useEffect(() => {
    if (!mapRef.current || instanceRef.current) return

    const center = userPos
      ? [userPos.lat, userPos.lon]
      : hunts.length > 0
        ? [hunts[0].approx_lat, hunts[0].approx_lon]
        : [51.08, 1.17]

    const map = L.map(mapRef.current, {
      center,
      zoom: 14,
      zoomControl: true,
      attributionControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
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
      const label = tier === 'elite' ? '⭐' : hunt.pack_emoji

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

// ── Hunt Card ─────────────────────────────────────────────────────────────
function HuntCard({ hunt, onTap, distLabel }) {
  const accent = hexAccent(hunt.accent_color)
  const tier = hunt.pack_tier
  const badgeClass = tier === 'elite' ? 'badge-elite' : tier === 'premium' ? 'badge-premium' : 'badge-free'
  const badgeLabel = tier === 'elite' ? '⭐ ELITE' : tier === 'premium' ? '★ PREMIUM' : 'FREE'

  return (
    <div
      className="hunt-card"
      style={{ borderColor: '#32324A' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = accent)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#32324A')}
      onClick={() => onTap(hunt)}
    >
      <div className="hunt-card-emoji" style={{ background: accent + '22' }}>
        {hunt.pack_emoji}
      </div>
      <div className="hunt-card-body">
        <div className="hunt-card-name">{hunt.pack_name}</div>
        <div className="hunt-card-desc">{hunt.pack_description}</div>
        <div className="hunt-card-meta">
          <span className={`badge ${badgeClass}`}>{badgeLabel}</span>
          {distLabel && <span className="badge badge-dist">📍 {distLabel}</span>}
          {hunt.voucher_headline && (
            <span className="badge badge-dist" style={{ color: '#F59E0B' }}>
              {hunt.voucher_headline}
            </span>
          )}
        </div>
      </div>
      <div className="hunt-card-start">
        <button
          className="btn-start"
          style={{ background: accent, color: '#fff' }}
          onClick={e => { e.stopPropagation(); onTap(hunt) }}
        >
          PLAY
        </button>
      </div>
    </div>
  )
}

// ── Hunt Discovery ────────────────────────────────────────────────────────
function HuntDiscovery({ hunts, loading, error, onStart, userPos }) {
  const [viewMode, setViewMode] = useState('list')
  const [paywallHunt, setPaywallHunt] = useState(null)

  function handleTap(hunt) {
    if (hunt.is_free_tier) {
      onStart(hunt)
    } else {
      setPaywallHunt(hunt)
    }
  }

  function distLabel(hunt) {
    if (!userPos || !hunt.approx_lat) return null
    return fmtDistance(
      haversineMetres(userPos.lat, userPos.lon, hunt.approx_lat, hunt.approx_lon)
    )
  }

  return (
    <div className="discover-screen">
      {paywallHunt && (
        <PaywallModal hunt={paywallHunt} onClose={() => setPaywallHunt(null)} />
      )}

      <div className="logo-wrap">
        <LogoSVG />
        <div className="logo-wordmark">
          <span className="logo-map">MAP</span>
          <span className="logo-the">· T H E ·</span>
          <span className="logo-movie">MOVIE</span>
        </div>
        <div className="logo-sub">Solve the Clue · Find the Location</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '20px 0 14px' }}>
        <div className="section-label" style={{ marginBottom: 0 }}>Hunts near you</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="view-toggle"
            style={{
              background: viewMode === 'list' ? '#7C3AED' : '#252533',
              color: viewMode === 'list' ? '#fff' : '#6B67A0',
            }}
            onClick={() => setViewMode('list')}
          >
            ☰ List
          </button>
          <button
            className="view-toggle"
            style={{
              background: viewMode === 'map' ? '#7C3AED' : '#252533',
              color: viewMode === 'map' ? '#fff' : '#6B67A0',
            }}
            onClick={() => setViewMode('map')}
          >
            🗺 Map
          </button>
        </div>
      </div>

      {loading && (
        <div className="loading-state">
          <div className="spinner" />
          Loading hunts nearby…
        </div>
      )}

      {error && !loading && (
        <div className="error-state">
          ⚠️ {error}
          <div style={{ fontSize: 11, marginTop: 6, color: '#B8B4D8' }}>
            Check your connection and try again.
          </div>
        </div>
      )}

      {!loading && !error && hunts.length === 0 && (
        <div className="empty-state">
          <div style={{ fontSize: 40, marginBottom: 12 }}>🗺</div>
          No active hunts in this area yet.
          <div style={{ fontSize: 11, color: '#32324A', marginTop: 6 }}>
            Check back soon — more hunts coming your way.
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
            ● Purple = Standard &nbsp;·&nbsp; ● Gold = Premium &nbsp;·&nbsp; ⭐ = Elite
            &nbsp;·&nbsp; Locations approximate
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

// ── Coord Display ─────────────────────────────────────────────────────────
function CoordDisplay({ hunt, solved }) {
  const slots = hunt?.coordinate_slots || []
  const accent = hexAccent(hunt?.accent_color)
  const solvedCount = Object.keys(solved).length
  const progress = slots.length > 0 ? (solvedCount / slots.length) * 100 : 0

  function renderStr(str) {
    if (!str) return null
    return str.split('').map((ch, i) => {
      if (slots.includes(ch)) {
        const digit = solved[ch]
        return digit !== undefined
          ? <span key={i} className="coord-slot-solved">{digit}</span>
          : <span key={i} className="coord-slot-pending">_</span>
      }
      return <span key={i} style={{ color: '#B8B4D8' }}>{ch}</span>
    })
  }

  return (
    <div className="coord-bar">
      <div className="coord-label">Target Coordinates</div>
      <div className="coord-strings">
        <div>{renderStr(hunt?.masked_lat)}</div>
        <div>{renderStr(hunt?.masked_lon)}</div>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress}%`, background: accent }} />
      </div>
    </div>
  )
}

// ── Signal Bar ────────────────────────────────────────────────────────────
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

// ── Lockout Timer ─────────────────────────────────────────────────────────
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
      ⛔ LOCKED — Try again in {secs}s
    </div>
  )
}

// ── Puzzle Card ───────────────────────────────────────────────────────────
function PuzzleCard({ question, solvedDigit, onSubmitAnswer, accent }) {
  const [input, setInput] = useState('')
  const [status, setStatus] = useState('idle')
  const [msg, setMsg] = useState('')
  const [showHint, setShowHint] = useState(false)
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
      setMsg('✓ Correct!')
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
        <div className="puzzle-question">{question.question_text}</div>
        <div className="puzzle-solved-badge">
          <span>✓</span>
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
          <div className="puzzle-question">{question.question_text}</div>
          <LockoutTimer until={lockoutUntil} onExpire={() => setLockoutUntil(null)} />
        </>
      ) : (
        <>
          <div className="puzzle-slot-tag">SLOT {question.slot}</div>
          {question.category && (
            <div className="puzzle-category">{question.category}</div>
          )}
          <div className="puzzle-question">{question.question_text}</div>
          {question.hint_text && (
            <>
              <button className="hint-toggle" onClick={() => setShowHint(h => !h)}>
                {showHint ? 'hide hint' : 'show hint'}
              </button>
              {showHint && <div className="puzzle-hint">{question.hint_text}</div>}
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
              placeholder="e.g. 88"
              disabled={status === 'submitting'}
            />
            <button
              className="puzzle-submit"
              style={{ background: accent, color: '#fff' }}
              onClick={handleSubmit}
              disabled={!input || status === 'submitting'}
            >
              {status === 'submitting' ? '…' : 'SUBMIT'}
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

// ── Compass Screen ────────────────────────────────────────────────────────
function CompassScreen({ realCoords, hunt, onArrived, compassMsg }) {
  const [bearing, setBearing] = useState(0)
  const [distance, setDistance] = useState(null)
  const [gpsStatus, setGpsStatus] = useState('searching')
  const watchRef = useRef(null)
  const arrivedRef = useRef(false)
  const accent = hexAccent(hunt?.accent_color)
  const geofence = realCoords?.geofence_radius_m || 15

  useEffect(() => {
    if (!navigator.geolocation || !realCoords) {
      setGpsStatus('unavailable')
      return
    }
    watchRef.current = navigator.geolocation.watchPosition(
      pos => {
        const { latitude, longitude } = pos.coords
        const dist = haversineMetres(latitude, longitude, realCoords.lat, realCoords.lon)
        setBearing(bearingDegrees(latitude, longitude, realCoords.lat, realCoords.lon))
        setDistance(Math.round(dist))
        setGpsStatus('active')
        if (dist <= geofence && !arrivedRef.current) {
          arrivedRef.current = true
          onArrived(latitude, longitude)
        }
      },
      () => setGpsStatus('error'),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    )
    return () => navigator.geolocation.clearWatch(watchRef.current)
  }, [realCoords, geofence, onArrived])

  const statusText = {
    searching:   'ACQUIRING GPS…',
    active:      `GPS ACTIVE · TARGET ~${geofence}m`,
    error:       'GPS UNAVAILABLE',
    unavailable: 'GPS NOT SUPPORTED',
  }[gpsStatus]

  return (
    <div className="compass-wrap">
      <div className="compass-dist">
        {distance != null ? distance : '—'}
        <span className="compass-unit"> m</span>
      </div>

      <div className="compass-arrow-wrap">
        <div className="compass-ring" />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -100%) rotate(${bearing}deg)`,
            transformOrigin: 'bottom center',
            width: 6,
            height: 70,
            background: `linear-gradient(to top, ${accent}, #F59E0B)`,
            borderRadius: 3,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: accent,
          }}
        />
      </div>

      <div className="compass-status">{statusText}</div>
      {compassMsg && <div className="compass-msg-box">{compassMsg}</div>}
    </div>
  )
}

// ── Account Prompt ────────────────────────────────────────────────────────
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
      <div className="account-prompt-title">Save Your Progress</div>
      <div className="account-prompt-sub">
        Enter your email to get a magic link and unlock premium hunts.
      </div>
      {sent ? (
        <div className="account-sent">✓ Magic link sent — check your inbox.</div>
      ) : (
        <div className="account-email-row">
          <input
            className="account-input"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
          <button className="account-submit" onClick={handleSave}>SAVE</button>
        </div>
      )}
    </div>
  )
}

// ── Arrived Screen ────────────────────────────────────────────────────────
function ArrivedScreen({ voucher }) {
  const [redeemed, setRedeemed] = useState(false)

  return (
    <div className="arrived-wrap">
      <div className="arrived-emoji">🎉</div>
      <div className="arrived-title">YOU FOUND IT</div>
      <div className="arrived-sub">
        You solved the puzzle and walked to the location.
        <br />
        Show this screen to claim your reward.
      </div>

      <div className="voucher-card">
        <div className="voucher-from">
          {voucher ? `Sponsored by · ${voucher.business_name}` : 'Loading reward…'}
        </div>
        {voucher && (
          <>
            <div className="voucher-offer">{voucher.voucher_headline}</div>
            <div className="voucher-detail">{voucher.voucher_detail}</div>
            <div className="voucher-code">{voucher.voucher_code || '——'}</div>
          </>
        )}
      </div>

      <button
        className={`redeem-btn ${redeemed ? 'done' : 'idle'}`}
        onClick={() => !redeemed && setRedeemed(true)}
      >
        {redeemed ? '✓ REDEEMED' : 'STAFF: TAP TO REDEEM'}
      </button>

      {redeemed && <AccountPrompt />}
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────
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

  useEffect(() => {
    loadHunts()
    getUserPos()
    registerSW()
  }, [])

  async function loadHunts() {
    try {
      const { data, error } = await supabase.rpc('get_active_hunts')
      if (error) throw error
      setHunts(data?.hunts || [])
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
    setStarting(true)
    setHuntsError(null)
    try {
      console.log('[startHunt] auth...')
      const user = await ensureAuth()
      console.log('[startHunt] user:', user?.id)

      console.log('[startHunt] inserting hunt_sessions...')
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
        console.error('[startHunt] hunt_sessions error:', sessionErr)
        throw new Error('Session error: ' + sessionErr.message + ' (code: ' + sessionErr.code + ')')
      }
      console.log('[startHunt] session:', session?.id)

      console.log('[startHunt] calling get_puzzle_for_player...')
      const { data: puzzleData, error: puzzleErr } = await supabase
        .rpc('get_puzzle_for_player', { p_puzzle_id: hunt.puzzle_id })
      if (puzzleErr) {
        console.error('[startHunt] get_puzzle_for_player error:', puzzleErr)
        throw new Error('Puzzle error: ' + puzzleErr.message + ' (code: ' + puzzleErr.code + ')')
      }
      console.log('[startHunt] puzzle questions:', puzzleData?.questions?.length)

      setActivePack(hunt)
      setActiveSession({ id: session.id, campaign_id: hunt.campaign_id })
      setActiveQuestions(puzzleData?.questions || [])
      setSolved({})
      setSignalPoints(10)
      setShowReset(false)
      setRealCoords(null)
      setVoucher(null)
      setCompassMsg(null)
      setScreen('puzzles')
    } catch (err) {
      console.error('[startHunt] failed:', err)
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
        setSolved(prev => ({ ...prev, [slot]: data.digit }))

        if (data.all_solved) {
          const { data: coords } = await supabase.rpc('unlock_coordinates', {
            p_session_id: activeSession.id,
          })
          if (coords?.success) {
            setRealCoords({
              lat: parseFloat(coords.real_lat),
              lon: parseFloat(coords.real_lon),
              geofence_radius_m: coords.geofence_radius_m || 15,
            })
            setTimeout(() => setScreen('compass'), 600)
          }
        }
      }

      return data
    } catch (err) {
      return { correct: false, error: err.message }
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

  return (
    <>
      <style>{CSS}</style>
      <div className="app" style={{ background: '#121218', minHeight: '100vh', color: '#F1F0FF' }}>
        {showReset && (
          <div className="reset-overlay">
            <div className="reset-sheet">
              <div className="reset-icon">📡</div>
              <div className="reset-title">SIGNAL LOST</div>
              <div className="reset-body">
                Too many wrong guesses — coordinate data has been wiped.
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

        {screen === 'puzzles' && activePack && (
          <div className="puzzle-screen">
            <div className="pack-nav">
              <button className="nav-back" onClick={() => setScreen('discover')}>←</button>
              <span className="nav-pack-name">{activePack.pack_name}</span>
              <span className="nav-count">
                {Object.keys(solved).length}/{slots.length} solved
              </span>
            </div>
            <CoordDisplay hunt={activePack} solved={solved} />
            <SignalBar points={signalPoints} accent={accent} />
            <div>
              {activeQuestions.map(q => (
                <PuzzleCard
                  key={q.id}
                  question={q}
                  solvedDigit={solved[q.slot]}
                  onSubmitAnswer={handleSubmitAnswer}
                  accent={accent}
                />
              ))}
            </div>
          </div>
        )}

        {screen === 'compass' && activePack && realCoords && (
          <div className="puzzle-screen">
            <div className="pack-nav">
              <button className="nav-back" onClick={() => setScreen('puzzles')}>←</button>
              <span className="nav-pack-name">GPS Compass</span>
              <span className="nav-count" style={{ color: '#10B981' }}>All slots unlocked</span>
            </div>
            <CompassScreen
              realCoords={realCoords}
              hunt={activePack}
              onArrived={handleArrived}
              compassMsg={compassMsg}
            />
            <button
              className="sim-btn"
              onClick={() => handleArrived(realCoords.lat, realCoords.lon)}
            >
              ↳ SIMULATE ARRIVAL (demo only)
            </button>
          </div>
        )}

        {screen === 'arrived' && (
          <div className="puzzle-screen">
            <div className="pack-nav">
              <button className="nav-back" onClick={() => setScreen('discover')}>← All Hunts</button>
            </div>
            <ArrivedScreen voucher={voucher} />
          </div>
        )}
      </div>
    </>
  )
}
