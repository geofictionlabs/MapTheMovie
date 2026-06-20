import { useState, useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from './lib/supabase'

// ── CSS ────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Space+Grotesk:wght@400;500;600;700&family=Share+Tech+Mono&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: #121218;
  color: #F1F0FF;
  font-family: 'Space Grotesk', system-ui, sans-serif;
  min-height: 100dvh;
}

.dash-root {
  display: flex;
  min-height: 100dvh;
}

/* ── Auth screens ────── */
.auth-screen {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.auth-card {
  background: #1C1C26;
  border: 1px solid #32324A;
  border-radius: 24px;
  padding: 40px 32px;
  max-width: 400px;
  width: 100%;
  text-align: center;
}
.auth-logo {
  font-family: 'Nunito', sans-serif;
  font-size: 28px;
  font-weight: 900;
  color: #7C3AED;
  letter-spacing: 3px;
  margin-bottom: 6px;
}
.auth-sub { font-size: 13px; color: #6B67A0; margin-bottom: 28px; }
.auth-title { font-size: 18px; font-weight: 700; margin-bottom: 6px; }
.auth-input {
  width: 100%;
  background: #121218;
  border: 1px solid #32324A;
  border-radius: 10px;
  color: #F1F0FF;
  font-family: 'Space Grotesk', system-ui, sans-serif;
  font-size: 15px;
  padding: 12px 16px;
  outline: none;
  margin-bottom: 12px;
}
.auth-input:focus { border-color: #7C3AED; }
.auth-btn {
  width: 100%;
  background: #7C3AED;
  border: none;
  border-radius: 12px;
  color: #fff;
  font-family: 'Share Tech Mono', monospace;
  font-size: 13px;
  letter-spacing: 2px;
  padding: 14px;
  cursor: pointer;
}
.auth-sent { font-size: 14px; color: #10B981; margin-top: 12px; }

/* ── Sidebar ─────────── */
.sidebar {
  width: 220px;
  flex-shrink: 0;
  background: #1C1C26;
  border-right: 1px solid #32324A;
  display: flex;
  flex-direction: column;
  padding: 24px 0;
  min-height: 100dvh;
}
@media (max-width: 700px) {
  .sidebar { display: none; }
  .dash-main { padding: 16px; }
}
.sidebar-logo {
  font-family: 'Nunito', sans-serif;
  font-size: 20px;
  font-weight: 900;
  color: #7C3AED;
  letter-spacing: 2px;
  padding: 0 20px 24px;
  border-bottom: 1px solid #32324A;
}
.sidebar-logo span { color: #F59E0B; }
.sidebar-biz {
  padding: 16px 20px;
  font-size: 13px;
  font-weight: 600;
  color: #B8B4D8;
  border-bottom: 1px solid #32324A;
}
.sidebar-biz small { display: block; font-size: 11px; color: #6B67A0; font-weight: 400; margin-top: 2px; }
.sidebar-nav { flex: 1; padding: 12px 0; }
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 20px;
  font-size: 13px;
  font-weight: 600;
  color: #6B67A0;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: all 0.15s;
  background: none;
  border-right: none;
  border-top: none;
  border-bottom: none;
  width: 100%;
  text-align: left;
}
.nav-item:hover { color: #F1F0FF; background: #252533; }
.nav-item.active { color: #7C3AED; border-left-color: #7C3AED; background: #252533; }
.nav-icon { font-size: 16px; }
.sidebar-footer {
  padding: 16px 20px 0;
  border-top: 1px solid #32324A;
}
.tier-badge {
  display: inline-block;
  font-family: 'Share Tech Mono', monospace;
  font-size: 10px;
  letter-spacing: 1.5px;
  padding: 4px 10px;
  border-radius: 8px;
  font-weight: 700;
  text-transform: uppercase;
}
.tier-starter { background: rgba(124,58,237,0.12); color: #7C3AED; }
.tier-featured { background: rgba(245,158,11,0.12); color: #F59E0B; }
.tier-sponsored { background: rgba(252,211,77,0.12); color: #FCD34D; }

/* ── Main area ────────── */
.dash-main {
  flex: 1;
  padding: 32px 28px;
  overflow-y: auto;
}
.page-title {
  font-family: 'Nunito', sans-serif;
  font-size: 22px;
  font-weight: 800;
  color: #F1F0FF;
  margin-bottom: 6px;
}
.page-sub { font-size: 13px; color: #6B67A0; margin-bottom: 28px; }
.section-label {
  font-size: 10px;
  letter-spacing: 2px;
  color: #6B67A0;
  text-transform: uppercase;
  font-family: 'Share Tech Mono', monospace;
  margin-bottom: 12px;
}

/* ── Stat cards ────────── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 14px;
  margin-bottom: 28px;
}
.stat-card {
  background: #1C1C26;
  border: 1px solid #32324A;
  border-radius: 16px;
  padding: 18px 16px;
}
.stat-label { font-size: 11px; color: #6B67A0; letter-spacing: 1px; margin-bottom: 6px; }
.stat-value {
  font-family: 'Nunito', sans-serif;
  font-size: 30px;
  font-weight: 900;
  color: #F1F0FF;
}
.stat-unit { font-size: 14px; color: #6B67A0; font-family: 'Space Grotesk', system-ui, sans-serif; }
.stat-card.accent { border-color: rgba(124,58,237,0.4); background: rgba(124,58,237,0.06); }
.stat-card.accent .stat-value { color: #9D5FF5; }
.stat-card.gold { border-color: rgba(245,158,11,0.4); background: rgba(245,158,11,0.06); }
.stat-card.gold .stat-value { color: #F59E0B; }

/* ── Go Live button ────── */
.live-panel {
  background: #1C1C26;
  border: 1px solid #32324A;
  border-radius: 18px;
  padding: 22px 20px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.live-status {
  display: flex;
  align-items: center;
  gap: 10px;
}
.live-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #32324A;
  flex-shrink: 0;
}
.live-dot.active {
  background: #10B981;
  box-shadow: 0 0 8px #10B981;
  animation: pulse-live 1.5s ease-in-out infinite;
}
@keyframes pulse-live {
  0%,100% { box-shadow: 0 0 4px #10B981; }
  50%      { box-shadow: 0 0 14px #10B981; }
}
.live-label { font-weight: 700; font-size: 15px; }
.live-hint { font-size: 12px; color: #6B67A0; margin-top: 2px; }
.live-btn {
  border: none;
  border-radius: 12px;
  font-family: 'Share Tech Mono', monospace;
  font-size: 12px;
  letter-spacing: 1.5px;
  padding: 12px 22px;
  cursor: pointer;
  font-weight: 700;
  transition: all 0.2s;
}
.live-btn.go { background: #10B981; color: #fff; }
.live-btn.end { background: rgba(239,68,68,0.12); color: #EF4444; border: 1px solid rgba(239,68,68,0.3); }

/* ── Toast ──────────────── */
.toast {
  position: fixed;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%) translateY(100px);
  background: #1C1C26;
  border: 1px solid #32324A;
  border-radius: 14px;
  padding: 14px 22px;
  font-size: 13px;
  color: #F1F0FF;
  z-index: 9999;
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  max-width: 360px;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
.toast.visible { transform: translateX(-50%) translateY(0); }

/* ── Card ───────────────── */
.card {
  background: #1C1C26;
  border: 1px solid #32324A;
  border-radius: 18px;
  padding: 22px 20px;
  margin-bottom: 18px;
}
.card-title { font-weight: 700; font-size: 15px; margin-bottom: 4px; }
.card-sub { font-size: 12px; color: #6B67A0; margin-bottom: 16px; }

/* ── Table ──────────────── */
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th {
  text-align: left;
  padding: 8px 10px;
  font-size: 10px;
  letter-spacing: 1.5px;
  color: #6B67A0;
  font-family: 'Share Tech Mono', monospace;
  border-bottom: 1px solid #32324A;
}
td { padding: 10px; border-bottom: 1px solid #1C1C26; color: #B8B4D8; }
tr:last-child td { border-bottom: none; }
.code-cell {
  font-family: 'Share Tech Mono', monospace;
  font-size: 13px;
  letter-spacing: 2px;
  color: #F1F0FF;
}

/* ── Theme grid ─────────── */
.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}
.theme-tile {
  border-radius: 14px;
  padding: 16px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.15s;
  text-align: center;
}
.theme-tile:hover { filter: brightness(1.1); }
.theme-tile.active { border-color: #F1F0FF; }
.theme-emoji { font-size: 28px; margin-bottom: 6px; }
.theme-name { font-size: 12px; font-weight: 700; }
.theme-tag { font-size: 10px; font-family: 'Share Tech Mono', monospace; letter-spacing: 1px; margin-top: 2px; opacity: 0.7; }

/* ── Voucher upload ─────── */
.upload-area {
  background: #121218;
  border: 1px dashed #32324A;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 14px;
}
.upload-textarea {
  width: 100%;
  background: transparent;
  border: none;
  color: #F1F0FF;
  font-family: 'Share Tech Mono', monospace;
  font-size: 13px;
  resize: vertical;
  outline: none;
  min-height: 100px;
  line-height: 1.6;
}
.upload-textarea::placeholder { color: #32324A; }
.btn-primary {
  background: #7C3AED;
  border: none;
  border-radius: 10px;
  color: #fff;
  font-family: 'Share Tech Mono', monospace;
  font-size: 12px;
  letter-spacing: 1.5px;
  padding: 11px 20px;
  cursor: pointer;
  font-weight: 700;
}
.btn-primary:disabled { opacity: 0.5; cursor: default; }
.btn-secondary {
  background: #252533;
  border: 1px solid #32324A;
  border-radius: 10px;
  color: #B8B4D8;
  font-family: 'Share Tech Mono', monospace;
  font-size: 12px;
  letter-spacing: 1px;
  padding: 11px 20px;
  cursor: pointer;
}
.row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }

/* ── Settings ───────────── */
.plan-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}
.plan-card {
  background: #1C1C26;
  border: 1px solid #32324A;
  border-radius: 16px;
  padding: 20px 16px;
}
.plan-card.current { border-color: #7C3AED; }
.plan-name { font-weight: 700; font-size: 15px; margin-bottom: 4px; }
.plan-price {
  font-family: 'Nunito', sans-serif;
  font-size: 26px;
  font-weight: 900;
  color: #7C3AED;
  margin-bottom: 12px;
}
.plan-price span { font-size: 13px; color: #6B67A0; font-family: 'Space Grotesk', system-ui, sans-serif; font-weight: 400; }
.plan-feature { font-size: 12px; color: #6B67A0; margin-bottom: 6px; padding-left: 14px; position: relative; }
.plan-feature::before { content: '✓'; position: absolute; left: 0; color: #10B981; font-weight: 700; }

/* ── Mobile tab bar ─────── */
.mobile-tabs {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #1C1C26;
  border-top: 1px solid #32324A;
  z-index: 100;
  padding: 8px 0 env(safe-area-inset-bottom, 8px);
}
@media (max-width: 700px) {
  .mobile-tabs { display: flex; }
  .dash-main { padding: 16px 16px 80px; }
}
.tab-btn {
  flex: 1;
  background: none;
  border: none;
  color: #6B67A0;
  font-size: 10px;
  font-weight: 600;
  padding: 6px 4px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  letter-spacing: 0.5px;
}
.tab-btn.active { color: #7C3AED; }
.tab-btn-icon { font-size: 18px; }

/* ── Pin Drop Modal ────── */
.pin-modal {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.82);
  z-index: 2000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
}
.pin-modal-sheet {
  background: #1C1C26;
  border-radius: 24px 24px 0 0;
  width: 100%;
  max-width: 520px;
  overflow: hidden;
  border: 1px solid #32324A;
  border-bottom: none;
}
.pin-map-wrap {
  width: 100%;
  height: 52vh;
}
.pin-modal-footer {
  padding: 16px 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.auth-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 14px 0;
  color: #32324A;
  font-size: 12px;
}
.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  border-top: 1px solid #32324A;
}
.auth-error {
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.3);
  border-radius: 8px;
  color: #EF4444;
  font-size: 13px;
  padding: 10px 14px;
  margin-bottom: 10px;
  text-align: left;
}
`

// ── Toast ────────────────────────────────────────────────────────────────
function useToast() {
  const [msg, setMsg] = useState('')
  const [visible, setVisible] = useState(false)
  const timerRef = useRef(null)

  function showToast(text) {
    setMsg(text)
    setVisible(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setVisible(false), 3200)
  }

  function ToastEl() {
    return <div className={`toast ${visible ? 'visible' : ''}`}>{msg}</div>
  }

  return { showToast, ToastEl }
}

// ── Live players via Realtime ────────────────────────────────────────────
function useLivePlayers(campaignId) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!campaignId) return

    const channel = supabase
      .channel(`live-sessions-${campaignId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hunt_sessions', filter: 'status=eq.active' },
        () => {
          supabase
            .from('hunt_sessions')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'active')
            .then(({ count: c }) => setCount(c || 0))
        }
      )
      .subscribe()

    supabase
      .from('hunt_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .then(({ count: c }) => setCount(c || 0))

    return () => channel.unsubscribe()
  }, [campaignId])

  return count
}

// ── THEMES config ────────────────────────────────────────────────────────
const THEMES = [
  { id: 'evergreen_80s',   emoji: '🎬', name: '80s Grid',    tag: 'EVERGREEN', bg: '#2D1060', accent: '#7C3AED' },
  { id: 'christmas',        emoji: '🎄', name: 'Christmas',   tag: 'DEC',       bg: '#064E3B', accent: '#10B981' },
  { id: 'halloween',        emoji: '🎃', name: 'Halloween',   tag: 'OCT',       bg: '#451A03', accent: '#F97316' },
  { id: 'valentines',       emoji: '💘', name: 'Valentine\'s', tag: 'FEB',      bg: '#4C0519', accent: '#F43F5E' },
  { id: 'summer',           emoji: '☀️', name: 'Summer',      tag: 'JUL–AUG',  bg: '#431407', accent: '#F59E0B' },
  { id: 'easter',           emoji: '🐣', name: 'Easter',      tag: 'APR',       bg: '#164E63', accent: '#06B6D4' },
]

// ── Pin Drop Modal ────────────────────────────────────────────────────────
function PinDropModal({ onConfirm, onCancel }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const [latLng, setLatLng] = useState({ lat: 51.3781, lng: 0.5439 })

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const pinIcon = L.divIcon({
      html: '<div style="width:20px;height:20px;background:#7C3AED;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>',
      className: '',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    })

    const map = L.map(containerRef.current).setView([51.3781, 0.5439], 14)
    mapRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)

    const marker = L.marker([51.3781, 0.5439], { draggable: true, icon: pinIcon }).addTo(map)
    markerRef.current = marker

    marker.on('dragend', () => {
      const pos = marker.getLatLng()
      setLatLng({ lat: pos.lat, lng: pos.lng })
    })

    map.on('click', e => {
      marker.setLatLng(e.latlng)
      setLatLng({ lat: e.latlng.lat, lng: e.latlng.lng })
    })

    return () => { map.remove(); mapRef.current = null }
  }, [])

  return (
    <div className="pin-modal">
      <div className="pin-modal-sheet">
        <div style={{ padding: '16px 20px 4px', fontWeight: 700, fontSize: 15 }}>Drop a Pin</div>
        <div style={{ fontSize: 12, color: '#6B67A0', padding: '0 20px 12px' }}>
          Tap the map or drag the pin to set your exact location
        </div>
        <div ref={containerRef} className="pin-map-wrap" />
        <div className="pin-modal-footer">
          <div style={{ fontSize: 11, color: '#6B67A0', textAlign: 'center', fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1 }}>
            {latLng.lat.toFixed(5)}, {latLng.lng.toFixed(5)}
          </div>
          <button
            className="btn-primary"
            style={{ width: '100%', padding: 14, fontSize: 13, letterSpacing: 2 }}
            onClick={() => onConfirm(latLng.lat, latLng.lng)}
          >
            CONFIRM LOCATION
          </button>
          <button
            className="btn-secondary"
            style={{ width: '100%', padding: 14, fontSize: 13 }}
            onClick={onCancel}
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Overview Tab ─────────────────────────────────────────────────────────
function OverviewTab({ business, campaigns, redemptions, todayCount, isLive, gpsLoading, onGoLive, onEndLive, puzzlePreview }) {
  const activeCampaign = campaigns?.find(c => c.status === 'active')
  const liveCount = useLivePlayers(activeCampaign?.id)
  const weekTotal = redemptions?.length || 0

  return (
    <div>
      <div className="page-title">Overview</div>
      <div className="page-sub">Real-time stats for {business?.name || 'your business'}</div>

      <div className="live-panel">
        <div className="live-status">
          <div className={`live-dot ${isLive ? 'active' : ''}`} />
          <div>
            <div className="live-label">{isLive ? '🟢 You are Live' : 'Not Live'}</div>
            <div className="live-hint">
              {isLive
                ? 'Players are being guided to your location'
                : 'Tap to capture your GPS and go live'}
            </div>
          </div>
        </div>
        {isLive ? (
          <button className="live-btn end" onClick={onEndLive}>END SESSION</button>
        ) : (
          <button className="live-btn go" onClick={onGoLive} disabled={gpsLoading}>
            {gpsLoading ? 'GETTING GPS…' : 'GO LIVE HERE'}
          </button>
        )}
      </div>

      <div className="stats-grid">
        <div className="stat-card accent">
          <div className="stat-label">LIVE PLAYERS</div>
          <div className="stat-value">{liveCount}<span className="stat-unit"> now</span></div>
        </div>
        <div className="stat-card gold">
          <div className="stat-label">TODAY'S VISITS</div>
          <div className="stat-value">{todayCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">ALL TIME</div>
          <div className="stat-value">{weekTotal}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">ACTIVE PACK</div>
          <div className="stat-value" style={{ fontSize: 16, paddingTop: 6 }}>
            {activeCampaign?.pack_name || '—'}
          </div>
        </div>
      </div>

      {puzzlePreview && puzzlePreview.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div className="section-label">Your Hunt Questions</div>
          <div className="card" style={{ padding: '16px 20px', marginBottom: 8 }}>
            <div style={{ fontSize: 13, color: '#B8B4D8', marginBottom: 16, lineHeight: 1.5 }}>
              Players solve these questions to build your GPS coordinates and find you.
              Each correct answer contributes one digit to the location.
            </div>
            {puzzlePreview.map((q, i) => (
              <div key={i} style={{
                background: '#121218',
                border: '1px solid #32324A',
                borderRadius: 10,
                padding: '12px 14px',
                marginBottom: i < puzzlePreview.length - 1 ? 10 : 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{
                    background: '#7C3AED', color: '#fff',
                    borderRadius: 4, padding: '2px 7px',
                    fontSize: 11, fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1,
                  }}>SLOT {q.slot}</span>
                  <span style={{ fontSize: 13, color: '#B8B4D8' }}>
                    {q.movie_emoji} {q.movie_title} ({q.movie_year})
                  </span>
                  <span style={{
                    marginLeft: 'auto',
                    background: 'rgba(245,158,11,0.12)', color: '#F59E0B',
                    borderRadius: 4, padding: '2px 7px',
                    fontSize: 11, fontFamily: "'Share Tech Mono', monospace",
                  }}>DIGIT {q.digit}</span>
                </div>
                <div style={{ fontSize: 14, color: '#F1F0FF', lineHeight: 1.4 }}>{q.question_text}</div>
                {q.extraction_note && (
                  <div style={{ fontSize: 11, color: '#6B67A0', marginTop: 4 }}>{q.extraction_note}</div>
                )}
              </div>
            ))}
            <div style={{ fontSize: 12, color: '#6B67A0', marginTop: 12, textAlign: 'center' }}>
              Players type full answers — the coordinate digit is extracted server-side
            </div>
          </div>
        </div>
      )}

      <div className="section-label">Recent Redemptions</div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>CODE</th>
                <th>DATE</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {(redemptions || []).slice(0, 8).map(r => (
                <tr key={r.id}>
                  <td className="code-cell">{r.voucher_code}</td>
                  <td>{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                  <td>
                    <span style={{
                      background: r.redeemed_at ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                      color: r.redeemed_at ? '#10B981' : '#F59E0B',
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontSize: 10,
                      fontFamily: "'Share Tech Mono', monospace",
                      letterSpacing: 1,
                    }}>
                      {r.redeemed_at ? 'REDEEMED' : 'ISSUED'}
                    </span>
                  </td>
                </tr>
              ))}
              {(!redemptions || redemptions.length === 0) && (
                <tr><td colSpan={3} style={{ textAlign: 'center', color: '#32324A', padding: 24 }}>No redemptions yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Vouchers Tab ─────────────────────────────────────────────────────────
function VouchersTab({ business, campaigns, showToast }) {
  const [codeText, setCodeText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [existing, setExisting] = useState([])

  const activeCampaign = campaigns?.find(c => c.status === 'active')

  useEffect(() => {
    if (!business?.id) return
    supabase
      .from('elite_voucher_codes')
      .select('code, claimed_by, claimed_at, created_at')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setExisting(data || []))
  }, [business?.id])

  async function handleUpload() {
    const codes = codeText.split('\n').map(l => l.trim()).filter(Boolean)
    if (codes.length === 0) return
    if (!activeCampaign?.pack_id) { showToast('⚠️ No active campaign found'); return }

    setUploading(true)
    try {
      const rows = codes.map(code => ({
        pack_id: activeCampaign.pack_id,
        business_id: business.id,
        code,
      }))
      const { error } = await supabase.from('elite_voucher_codes').insert(rows)
      if (error) throw error
      setCodeText('')
      setExisting(prev => [...rows.map((r, i) => ({ ...r, id: i, claimed_by: null })), ...prev])
      showToast(`✓ ${codes.length} voucher code${codes.length > 1 ? 's' : ''} uploaded`)
    } catch (err) {
      showToast('⚠️ Upload failed: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const unclaimed = existing.filter(c => !c.claimed_by).length
  const claimed = existing.filter(c => c.claimed_by).length

  return (
    <div>
      <div className="page-title">Voucher Codes</div>
      <div className="page-sub">Upload elite codes — one code drawn per player on completion</div>

      <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">AVAILABLE</div>
          <div className="stat-value" style={{ color: '#10B981' }}>{unclaimed}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">CLAIMED</div>
          <div className="stat-value">{claimed}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Upload Codes</div>
        <div className="card-sub">Paste one code per line. These will be drawn at random on hunt completion.</div>
        <div className="upload-area">
          <textarea
            className="upload-textarea"
            placeholder={'HUNT25-REWARD\nMTM-GOLD-XK7\nHUNT-WIN-001'}
            value={codeText}
            onChange={e => setCodeText(e.target.value)}
          />
        </div>
        <div className="row">
          <button className="btn-primary" onClick={handleUpload} disabled={!codeText.trim() || uploading}>
            {uploading ? 'UPLOADING…' : 'UPLOAD CODES'}
          </button>
          {codeText && (
            <span style={{ fontSize: 12, color: '#6B67A0' }}>
              {codeText.split('\n').filter(l => l.trim()).length} code(s) ready
            </span>
          )}
        </div>
      </div>

      {existing.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 24 }}>Uploaded Codes</div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>CODE</th>
                    <th>STATUS</th>
                    <th>DATE</th>
                  </tr>
                </thead>
                <tbody>
                  {existing.slice(0, 30).map((c, i) => (
                    <tr key={i}>
                      <td className="code-cell">{c.code}</td>
                      <td>
                        <span style={{
                          background: c.claimed_by ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                          color: c.claimed_by ? '#EF4444' : '#10B981',
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontSize: 10,
                          fontFamily: "'Share Tech Mono', monospace",
                        }}>
                          {c.claimed_by ? 'CLAIMED' : 'AVAILABLE'}
                        </span>
                      </td>
                      <td>{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Themes Tab ───────────────────────────────────────────────────────────
function ThemesTab({ business, campaigns, showToast }) {
  const activeCampaign = campaigns?.find(c => c.status === 'active')
  const [activeTheme, setActiveTheme] = useState(null)
  const [applying, setApplying] = useState(null)

  async function handleApply(theme) {
    if (!activeCampaign) { showToast('⚠️ No active campaign to update'); return }

    setApplying(theme.id)
    try {
      // Find pack by tag/slug match
      const { data: packs } = await supabase
        .from('puzzle_packs')
        .select('id, name')
        .ilike('name', `%${theme.name.split(' ')[0]}%`)
        .limit(5)

      // Fall back to just updating campaign accent or description if no pack found
      if (!packs || packs.length === 0) {
        showToast(`Theme "${theme.name}" — pack not found in DB yet. Add it via migrations.`)
        setApplying(null)
        return
      }

      const pack = packs[0]
      const { error } = await supabase
        .from('campaigns')
        .update({ pack_id: pack.id })
        .eq('id', activeCampaign.id)

      if (error) throw error

      setActiveTheme(theme.id)
      showToast(`✓ Theme switched to "${theme.name}" — live within 2 minutes`)
    } catch (err) {
      showToast('⚠️ Failed: ' + err.message)
    } finally {
      setApplying(null)
    }
  }

  return (
    <div>
      <div className="page-title">Seasonal Themes</div>
      <div className="page-sub">Switch your active pack to match the season or upcoming event</div>

      <div className="theme-grid">
        {THEMES.map(t => (
          <div
            key={t.id}
            className={`theme-tile ${activeTheme === t.id ? 'active' : ''}`}
            style={{ background: t.bg }}
            onClick={() => handleApply(t)}
          >
            <div className="theme-emoji">{t.emoji}</div>
            <div className="theme-name" style={{ color: t.accent }}>{t.name}</div>
            <div className="theme-tag">{t.tag}</div>
            {applying === t.id && (
              <div style={{ fontSize: 10, marginTop: 6, color: '#F1F0FF' }}>Applying…</div>
            )}
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-title">Seasonal Pricing</div>
        <div className="card-sub">
          Premium seasonal events attract 3× more players. Featured and Sponsored tiers include priority listing during peak periods.
        </div>
        <table style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>EVENT</th>
              <th>DATES</th>
              <th>UPLIFT</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Christmas', 'Dec 1 – Jan 5', '+25%'],
              ['Halloween', 'Oct 1 – Nov 1', '+15%'],
              ['Summer',    'Jul 1 – Aug 31', '+10%'],
              ['Valentine\'s', 'Feb 7 – Feb 15', '+20%'],
            ].map(([event, dates, uplift]) => (
              <tr key={event}>
                <td style={{ fontWeight: 600 }}>{event}</td>
                <td style={{ color: '#6B67A0' }}>{dates}</td>
                <td style={{ color: '#F59E0B', fontFamily: "'Share Tech Mono', monospace" }}>{uplift}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── History Tab ──────────────────────────────────────────────────────────
function HistoryTab({ redemptions }) {
  const byDay = (redemptions || []).reduce((acc, r) => {
    const day = r.created_at ? r.created_at.slice(0, 10) : 'Unknown'
    acc[day] = (acc[day] || 0) + 1
    return acc
  }, {})

  const days = Object.entries(byDay).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14)
  const maxCount = Math.max(...days.map(d => d[1]), 1)

  return (
    <div>
      <div className="page-title">Visit History</div>
      <div className="page-sub">Daily redemption counts over the last 2 weeks</div>

      {days.length > 0 ? (
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {days.map(([day, count]) => (
              <div key={day} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#6B67A0', fontFamily: "'Share Tech Mono', monospace", width: 90, flexShrink: 0 }}>
                  {new Date(day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
                <div style={{ flex: 1, background: '#252533', borderRadius: 4, height: 18, overflow: 'hidden' }}>
                  <div style={{ width: `${(count / maxCount) * 100}%`, height: '100%', background: '#7C3AED', borderRadius: 4, transition: 'width 0.4s ease' }} />
                </div>
                <span style={{ fontSize: 12, color: '#B8B4D8', width: 24, textAlign: 'right' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', color: '#6B67A0', padding: 40 }}>
          No redemption history yet. Once players complete hunts, stats appear here.
        </div>
      )}

      <div className="section-label" style={{ marginTop: 24 }}>All Redemptions</div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>CODE</th><th>ISSUED</th><th>REDEEMED</th></tr>
            </thead>
            <tbody>
              {(redemptions || []).map(r => (
                <tr key={r.id}>
                  <td className="code-cell">{r.voucher_code}</td>
                  <td style={{ color: '#6B67A0' }}>{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                  <td>{r.redeemed_at ? new Date(r.redeemed_at).toLocaleString() : <span style={{ color: '#32324A' }}>—</span>}</td>
                </tr>
              ))}
              {(!redemptions || redemptions.length === 0) && (
                <tr><td colSpan={3} style={{ textAlign: 'center', color: '#32324A', padding: 24 }}>No data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Settings Tab ─────────────────────────────────────────────────────────
function SettingsTab({ business, showToast }) {
  const tier = business?.tier || 'starter'

  const PLANS = [
    {
      id: 'starter', name: 'Starter', price: '£49', period: '/mo',
      features: ['1 active hunt', 'Standard map listing', 'Basic analytics', 'Email support'],
    },
    {
      id: 'featured', name: 'Featured', price: '£99', period: '/mo',
      features: ['3 active hunts', 'Gold map marker', 'Full analytics + history', 'Priority support', 'Seasonal pack access'],
    },
    {
      id: 'sponsored', name: 'Sponsored', price: '£249', period: '/mo',
      features: ['Unlimited hunts', 'Elite map badge', 'Push to all local players', 'Dedicated account manager', 'Co-branded content', 'Custom voucher design'],
    },
  ]

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.reload()
  }

  return (
    <div>
      <div className="page-title">Settings & Billing</div>
      <div className="page-sub">Manage your subscription and account</div>

      <div className="section-label">Current Plan</div>
      <div className="plan-grid">
        {PLANS.map(p => (
          <div key={p.id} className={`plan-card ${tier === p.id ? 'current' : ''}`}>
            <div className="plan-name">{p.name}</div>
            <div className="plan-price">{p.price}<span>{p.period}</span></div>
            {p.features.map(f => (
              <div key={f} className="plan-feature">{f}</div>
            ))}
            {tier === p.id ? (
              <div style={{ marginTop: 14, fontSize: 11, color: '#10B981', fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1 }}>
                ✓ CURRENT PLAN
              </div>
            ) : (
              <button
                className="btn-primary"
                style={{ marginTop: 14, width: '100%' }}
                onClick={() => showToast('Stripe checkout coming soon — email hello@geofictionlabs.com to upgrade')}
              >
                UPGRADE
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 8 }}>
        <div className="card-title">Account</div>
        <div className="card-sub">{business?.name || 'Your business account'}</div>
        <div className="row">
          <button className="btn-secondary" onClick={() => showToast('Contact hello@geofictionlabs.com to update business details')}>
            EDIT DETAILS
          </button>
          <button
            className="btn-secondary"
            style={{ color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)' }}
            onClick={handleSignOut}
          >
            SIGN OUT
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Legal</div>
        <div className="card-sub">GeoFiction Labs Ltd · hello@geofictionlabs.com</div>
        <div className="row">
          <a href="/privacy.html" style={{ color: '#7C3AED', fontSize: 13, textDecoration: 'none' }}>Privacy Policy</a>
          <a href="/terms.html" style={{ color: '#7C3AED', fontSize: 13, textDecoration: 'none' }}>Terms of Service</a>
        </div>
      </div>
    </div>
  )
}

// ── Dashboard Root ────────────────────────────────────────────────────────
export default function Dashboard() {
  const [authStep, setAuthStep] = useState('checking')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [showPinDrop, setShowPinDrop] = useState(false)
  const [tab, setTab] = useState('overview')
  const [business, setBusiness] = useState(null)
  const [campaigns, setCampaigns] = useState([])
  const [redemptions, setRedemptions] = useState([])
  const [todayCount, setTodayCount] = useState(0)
  const [isLive, setIsLive] = useState(false)
  const [puzzlePreview, setPuzzlePreview] = useState(null)
  const realtimeRef = useRef(null)

  const { showToast, ToastEl } = useToast()

  useEffect(() => {
    checkAuth()
    // Handle magic link auth redirect
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') checkAuth()
    })
  }, [])

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.is_anonymous) {
      setAuthStep('login')
      return
    }
    await loadDashboard()
  }

  async function loadDashboard() {
    const { data: myBiz } = await supabase.rpc('get_my_business')
    if (!myBiz?.success) {
      setAuthStep('no_business')
      return
    }

    const { data: dash } = await supabase.rpc('get_business_dashboard', {
      p_business_id: myBiz.business_id,
    })
    if (!dash?.success) {
      setAuthStep('no_business')
      return
    }

    setBusiness(dash.business)
    setCampaigns(dash.campaigns || [])
    setRedemptions(dash.redemptions || [])
    setTodayCount(dash.today_count || 0)
    setIsLive(!!dash.live_session)
    setAuthStep('dashboard')

    // Realtime: new redemptions
    if (realtimeRef.current) supabase.removeChannel(realtimeRef.current)
    realtimeRef.current = supabase
      .channel(`dash-redemptions-${myBiz.business_id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'redemptions', filter: `business_id=eq.${myBiz.business_id}` },
        payload => {
          const r = payload.new
          setRedemptions(prev => [r, ...prev])
          setTodayCount(prev => prev + 1)
          showToast(`🎉 Player arrived! Code: ${r.voucher_code}`)
          if (Notification.permission === 'granted') {
            new Notification('MapTheMovie — Player Arrived!', {
              body: `Voucher: ${r.voucher_code}`,
              icon: '/icon-192.png',
            })
          }
        }
      )
      .subscribe()
  }

  async function handleLoginPassword() {
    if (!email.includes('@') || !password) return
    setAuthError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setAuthError(error.message); return }
    await checkAuth()
  }

  async function handleLoginMagicLink() {
    if (!email.includes('@')) return
    setAuthError('')
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href },
    })
    setEmailSent(true)
  }

  async function goLiveWithCoords(lat, lon, accuracyM) {
    const activeCampaign = campaigns.find(c => c.status === 'active')
    const { error } = await supabase.rpc('go_live', {
      p_business_id: business.id,
      p_campaign_id: activeCampaign?.id || null,
      p_lat: lat,
      p_lon: lon,
      p_push_subscription: null,
    })
    if (error) { showToast('Could not go live: ' + error.message); return }
    setIsLive(true)
    setShowPinDrop(false)
    const accStr = accuracyM ? ` (accuracy: ${Math.round(accuracyM)}m)` : ''
    showToast('You are now live! Players are being guided to your location.' + accStr)
    if (Notification.permission !== 'granted') Notification.requestPermission()

    // Load puzzle preview for this location
    const { data: previewData } = await supabase.rpc('build_puzzle_for_location', {
      p_lat: lat,
      p_lon: lon,
    })
    if (previewData?.success) setPuzzlePreview(previewData.questions || [])
  }

  async function handleGoLive() {
    if (!navigator.geolocation) { setShowPinDrop(true); return }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        setGpsLoading(false)
        await goLiveWithCoords(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy)
      },
      () => {
        setGpsLoading(false)
        setShowPinDrop(true)
      },
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true }
    )
  }

  async function handleEndLive() {
    if (!business?.id) return
    await supabase
      .from('live_business_sessions')
      .update({ session_end: new Date().toISOString(), is_live: false })
      .eq('business_id', business.id)
      .is('session_end', null)
    setIsLive(false)
    showToast('Session ended.')
  }

  const TABS = [
    { id: 'overview',  icon: '📊', label: 'Overview' },
    { id: 'vouchers',  icon: '🎟',  label: 'Vouchers' },
    { id: 'themes',    icon: '🎨', label: 'Themes' },
    { id: 'history',   icon: '📅', label: 'History' },
    { id: 'settings',  icon: '⚙️', label: 'Settings' },
  ]

  // ── Auth screens ──
  if (authStep === 'checking') {
    return (
      <>
        <style>{CSS}</style>
        <div className="auth-screen" style={{ background: '#121218', minHeight: '100vh' }}>
          <div style={{ color: '#6B67A0', fontFamily: "'Share Tech Mono', monospace", letterSpacing: 2 }}>
            Loading…
          </div>
        </div>
      </>
    )
  }

  if (authStep === 'login') {
    return (
      <>
        <style>{CSS}</style>
        <div className="auth-screen" style={{ background: '#121218', minHeight: '100vh' }}>
          <div className="auth-card">
            <div className="auth-logo">MAP<span>MOVIE</span></div>
            <div className="auth-sub">Business Dashboard · GeoFiction Labs</div>
            <div className="auth-title" style={{ marginBottom: 20 }}>Sign In</div>

            {emailSent ? (
              <div className="auth-sent">
                Magic link sent! Check your inbox.
                <div style={{ marginTop: 10, fontSize: 12, color: '#6B67A0' }}>
                  No email? Check spam or contact hello@geofictionlabs.com
                </div>
                <button
                  className="auth-btn"
                  style={{ marginTop: 16, background: 'transparent', border: '1px solid #32324A', color: '#B8B4D8' }}
                  onClick={() => setEmailSent(false)}
                >
                  BACK
                </button>
              </div>
            ) : (
              <>
                {authError && <div className="auth-error">{authError}</div>}
                <input
                  className="auth-input"
                  type="email"
                  placeholder="your@business.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setAuthError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleLoginPassword()}
                  autoComplete="email"
                />
                <input
                  className="auth-input"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setAuthError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleLoginPassword()}
                  autoComplete="current-password"
                />
                <button className="auth-btn" onClick={handleLoginPassword}>SIGN IN</button>

                <div className="auth-divider">or</div>

                <button
                  className="auth-btn"
                  style={{ background: 'transparent', border: '1px solid #32324A', color: '#B8B4D8' }}
                  onClick={handleLoginMagicLink}
                >
                  SEND MAGIC LINK
                </button>
              </>
            )}
          </div>
        </div>
      </>
    )
  }

  if (authStep === 'no_business') {
    return (
      <>
        <style>{CSS}</style>
        <div className="auth-screen" style={{ background: '#121218', minHeight: '100vh' }}>
          <div className="auth-card">
            <div className="auth-logo">MAP<span>MOVIE</span></div>
            <div style={{ fontSize: 40, margin: '16px 0' }}>🗺</div>
            <div className="auth-title">No Business Account</div>
            <p style={{ fontSize: 13, color: '#6B67A0', margin: '10px 0 20px', lineHeight: 1.6 }}>
              Your account isn't linked to a business yet. Contact us to get set up.
            </p>
            <a
              href="mailto:hello@geofictionlabs.com"
              style={{
                display: 'block',
                background: '#7C3AED',
                color: '#fff',
                borderRadius: 12,
                padding: '14px',
                textDecoration: 'none',
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: 13,
                letterSpacing: 2,
              }}
            >
              CONTACT US
            </a>
          </div>
        </div>
      </>
    )
  }

  // ── Dashboard ──
  return (
    <>
      <style>{CSS}</style>
      <div className="dash-root" style={{ background: '#121218', minHeight: '100vh', color: '#F1F0FF' }}>
        {/* Sidebar */}
        <div className="sidebar">
          <div className="sidebar-logo">MAP<span>MOVIE</span></div>
          <div className="sidebar-biz">
            {business?.name || 'My Business'}
            <small>
              <span className={`tier-badge ${business?.tier ? `tier-${business.tier}` : 'tier-starter'}`}>
                {business?.tier || 'Starter'}
              </span>
            </small>
          </div>
          <nav className="sidebar-nav">
            {TABS.map(t => (
              <button
                key={t.id}
                className={`nav-item ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                <span className="nav-icon">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>
          <div className="sidebar-footer">
            <div style={{ fontSize: 11, color: '#6B67A0', marginBottom: 8 }}>
              GeoFiction Labs Ltd
            </div>
            <div style={{ fontSize: 11, color: '#32324A', fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1 }}>
              v1.0.0
            </div>
          </div>
        </div>

        {/* Main */}
        <main className="dash-main">
          {tab === 'overview' && (
            <OverviewTab
              business={business}
              campaigns={campaigns}
              redemptions={redemptions}
              todayCount={todayCount}
              isLive={isLive}
              gpsLoading={gpsLoading}
              onGoLive={handleGoLive}
              onEndLive={handleEndLive}
              puzzlePreview={puzzlePreview}
            />
          )}
          {tab === 'vouchers' && (
            <VouchersTab business={business} campaigns={campaigns} showToast={showToast} />
          )}
          {tab === 'themes' && (
            <ThemesTab business={business} campaigns={campaigns} showToast={showToast} />
          )}
          {tab === 'history' && <HistoryTab redemptions={redemptions} />}
          {tab === 'settings' && <SettingsTab business={business} showToast={showToast} />}
        </main>

        {/* Mobile tab bar */}
        <div className="mobile-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`tab-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <span className="tab-btn-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <ToastEl />
      {showPinDrop && (
        <PinDropModal
          onConfirm={(lat, lon) => goLiveWithCoords(lat, lon, null)}
          onCancel={() => setShowPinDrop(false)}
        />
      )}
    </>
  )
}
