import { useState, useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from './lib/supabase'
import { VENUE_CATEGORIES } from './lib/venueCategories'
import { DIFFICULTY_COLORS } from './HuntSelectionScreen'

const DS = {
  bg: '#080810',
  card: '#0E0E1A',
  cardAlt: '#121218',
  border: '#1E1E2E',
  borderMid: '#32324A',
  purple: '#7C3AED',
  purpleLight: '#9D5FF5',
  gold: '#F59E0B',
  green: '#10B981',
  red: '#EF4444',
  text: '#F1F0FF',
  textSub: '#B8B4D8',
  textMuted: '#6B67A0',
}

//  CSS
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Space+Grotesk:wght@400;500;600;700&family=Share+Tech+Mono&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: #080810;
  color: #F1F0FF;
  font-family: 'Space Grotesk', system-ui, sans-serif;
  min-height: 100dvh;
}

.dash-root {
  display: flex;
  min-height: 100dvh;
}

/*  Auth screens  */
.auth-screen {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.auth-card {
  background: #0E0E1A;
  border: 1px solid #1E1E2E;
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
  border: 1px solid #1E1E2E;
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
  background: linear-gradient(135deg, #7C3AED, #9D5FF5);
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

/*  Sidebar  */
.sidebar {
  width: 220px;
  flex-shrink: 0;
  background: #0E0E1A;
  border-right: 1px solid #1E1E2E;
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
  border-bottom: 1px solid #1E1E2E;
}
.sidebar-logo span { color: #F59E0B; }
.sidebar-biz {
  padding: 16px 20px;
  font-size: 13px;
  font-weight: 600;
  color: #B8B4D8;
  border-bottom: 1px solid #1E1E2E;
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
.nav-item:hover { color: #F1F0FF; background: #121218; }
.nav-item.active { color: #7C3AED; border-left-color: #7C3AED; background: #121218; }
.nav-icon { font-size: 16px; }
.sidebar-footer {
  padding: 16px 20px 0;
  border-top: 1px solid #1E1E2E;
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
.tier-starter { background: rgba(124,58,237,0.1); color: #7C3AED; }
.tier-featured { background: rgba(245,158,11,0.1); color: #F59E0B; }
.tier-sponsored { background: rgba(252,211,77,0.1); color: #FCD34D; }

/*  Main area  */
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
  letter-spacing: 4px;
  color: #7C3AED;
  text-transform: uppercase;
  font-family: 'Share Tech Mono', monospace;
  margin-bottom: 12px;
}

/*  Stat cards  */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 14px;
  margin-bottom: 28px;
}
.stat-card {
  background: #0E0E1A;
  border: 1px solid #1E1E2E;
  border-radius: 16px;
  padding: 18px 16px;
  position: relative;
  overflow: hidden;
}
.stat-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: #1E1E2E;
}
.stat-label {
  font-family: 'Share Tech Mono', monospace;
  font-size: 10px;
  color: #6B67A0;
  letter-spacing: 2px;
  margin-bottom: 8px;
  text-transform: uppercase;
}
.stat-value {
  font-family: 'Nunito', sans-serif;
  font-size: 36px;
  font-weight: 900;
  color: #F1F0FF;
  line-height: 1;
}
.stat-unit { font-size: 14px; color: #6B67A0; font-family: 'Space Grotesk', system-ui, sans-serif; }
.stat-card.accent { border-color: rgba(124,58,237,0.3); background: rgba(124,58,237,0.05); }
.stat-card.accent::before { background: #7C3AED; }
.stat-card.accent .stat-value { color: #9D5FF5; }
.stat-card.gold { border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.05); }
.stat-card.gold::before { background: #F59E0B; }
.stat-card.gold .stat-value { color: #F59E0B; }

/*  Go Live button  */
.live-panel {
  background: #0E0E1A;
  border: 1px solid #1E1E2E;
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
  background: #1E1E2E;
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
.live-btn.go {
  background: linear-gradient(135deg, #7C3AED, #9D5FF5);
  color: #fff;
  box-shadow: 0 4px 16px rgba(124,58,237,0.35);
}
.live-btn.end {
  background: #10B981;
  color: #fff;
  box-shadow: 0 0 30px rgba(16,185,129,0.4);
}

/*  Toast  */
.toast {
  position: fixed;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%) translateY(100px);
  background: #0E0E1A;
  border: 1px solid #1E1E2E;
  border-radius: 14px;
  padding: 14px 22px;
  font-size: 13px;
  color: #F1F0FF;
  z-index: 9999;
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  max-width: 360px;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0,0,0,0.6);
}
.toast.visible { transform: translateX(-50%) translateY(0); }

/*  Card  */
.card {
  background: #0E0E1A;
  border: 1px solid #1E1E2E;
  border-radius: 18px;
  padding: 22px 20px;
  margin-bottom: 18px;
}
.card-title { font-weight: 700; font-size: 15px; margin-bottom: 4px; }
.card-sub { font-size: 12px; color: #6B67A0; margin-bottom: 16px; }

/*  Table  */
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th {
  text-align: left;
  padding: 8px 10px;
  font-size: 10px;
  letter-spacing: 1.5px;
  color: #6B67A0;
  font-family: 'Share Tech Mono', monospace;
  border-bottom: 1px solid #1E1E2E;
}
td { padding: 10px; border-bottom: 1px solid #0E0E1A; color: #B8B4D8; }
tr:nth-child(even) td { background: #121218; }
tr:last-child td { border-bottom: none; }
.code-cell {
  font-family: 'Share Tech Mono', monospace;
  font-size: 13px;
  letter-spacing: 2px;
  color: #F59E0B;
}

/*  Theme grid  */
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
.theme-tile:hover { filter: brightness(1.15); transform: translateY(-1px); }
.theme-tile.active { border-color: #F1F0FF; }
.theme-emoji { font-size: 28px; margin-bottom: 6px; }
.theme-name { font-size: 12px; font-weight: 700; }
.theme-tag { font-size: 10px; font-family: 'Share Tech Mono', monospace; letter-spacing: 1px; margin-top: 2px; opacity: 0.7; }

/*  Voucher upload  */
.upload-area {
  background: #121218;
  border: 1px dashed #1E1E2E;
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
  background: linear-gradient(135deg, #7C3AED, #9D5FF5);
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
  background: #121218;
  border: 1px solid #1E1E2E;
  border-radius: 10px;
  color: #B8B4D8;
  font-family: 'Share Tech Mono', monospace;
  font-size: 12px;
  letter-spacing: 1px;
  padding: 11px 20px;
  cursor: pointer;
}
.row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }

/*  Settings  */
.plan-grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 20px;
}
.plan-card {
  background: #0E0E1A;
  border: 1px solid #1E1E2E;
  border-radius: 16px;
  padding: 20px 16px;
}
.plan-card.current {
  border-color: #7C3AED;
  box-shadow: 0 0 0 1px #7C3AED, inset 0 0 0 100px rgba(124,58,237,0.04);
}
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
.plan-feature::before { content: '+'; position: absolute; left: 0; color: #10B981; font-weight: 700; }

/*  Mobile tab bar  */
.mobile-tabs {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #0E0E1A;
  border-top: 1px solid #1E1E2E;
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

/*  Pin Drop Modal  */
.pin-modal {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.88);
  z-index: 2000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
}
.pin-modal-sheet {
  background: #0E0E1A;
  border-radius: 24px 24px 0 0;
  width: 100%;
  max-width: 520px;
  overflow: hidden;
  border: 1px solid #1E1E2E;
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
  color: #1E1E2E;
  font-size: 12px;
}
.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  border-top: 1px solid #1E1E2E;
}
.auth-error {
  background: rgba(239,68,68,0.08);
  border: 1px solid rgba(239,68,68,0.25);
  border-radius: 8px;
  color: #EF4444;
  font-size: 13px;
  padding: 10px 14px;
  margin-bottom: 10px;
  text-align: left;
}
`

//  Logo component
function Logo({ size = 'md' }) {
  const fontSize = size === 'sm' ? 15 : size === 'lg' ? 22 : 18
  const iconSize = size === 'sm' ? 22 : size === 'lg' ? 32 : 26
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: iconSize, height: iconSize,
        background: DS.purple, borderRadius: 7,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <svg width={Math.round(iconSize * 0.54)} height={Math.round(iconSize * 0.54)} viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="5.5" r="3.5" fill="#F1F0FF"/>
          <path d="M 3.5 7.5 Q 7 12 10.5 7.5 Z" fill="#F1F0FF"/>
          <circle cx="7" cy="5.5" r="1.4" fill="#7C3AED"/>
        </svg>
      </div>
      <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize, color: '#F1F0FF', lineHeight: 1 }}>
        Map
        <span style={{ color: DS.purple, fontSize: Math.round(fontSize * 0.6), letterSpacing: 3, margin: '0 3px', fontFamily: 'Share Tech Mono, monospace' }}>THE</span>
        <span style={{ color: DS.gold }}>Movie</span>
      </span>
    </div>
  )
}

//  Toast
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

//  Live players via Realtime
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

//  THEMES config
const THEMES = [
  { id: 'evergreen_80s',   emoji: '', name: '80s Grid',    tag: 'EVERGREEN', bg: '#2D1060', accent: '#7C3AED' },
  { id: 'christmas',        emoji: '', name: 'Christmas',   tag: 'DEC',       bg: '#064E3B', accent: '#10B981' },
  { id: 'halloween',        emoji: '', name: 'Halloween',   tag: 'OCT',       bg: '#451A03', accent: '#F97316' },
  { id: 'valentines',       emoji: '', name: 'Valentine\'s', tag: 'FEB',      bg: '#4C0519', accent: '#F43F5E' },
  { id: 'summer',           emoji: '', name: 'Summer',      tag: 'JULAUG',  bg: '#431407', accent: '#F59E0B' },
  { id: 'easter',           emoji: '', name: 'Easter',      tag: 'APR',       bg: '#164E63', accent: '#06B6D4' },
]

//  Pin Drop Modal
function PinDropModal({ onConfirm, onCancel }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const DEFAULT_LAT = 51.3733
  const DEFAULT_LNG = 0.5297
  const [latLng, setLatLng] = useState({ lat: DEFAULT_LAT, lng: DEFAULT_LNG })

  useEffect(() => {
    const timerId = setTimeout(() => {
      if (!containerRef.current || mapRef.current) return

      const pinIcon = L.divIcon({
        html: '<div style="width:20px;height:20px;background:#7C3AED;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>',
        className: '',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      })

      const map = L.map(containerRef.current).setView([DEFAULT_LAT, DEFAULT_LNG], 14)
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: ' OpenStreetMap',
        maxZoom: 19,
      }).addTo(map)

      const marker = L.marker([DEFAULT_LAT, DEFAULT_LNG], { draggable: true, icon: pinIcon }).addTo(map)
      markerRef.current = marker

      marker.on('dragend', () => {
        const pos = marker.getLatLng()
        setLatLng({ lat: pos.lat, lng: pos.lng })
      })

      map.on('click', e => {
        marker.setLatLng(e.latlng)
        setLatLng({ lat: e.latlng.lat, lng: e.latlng.lng })
      })

      map.invalidateSize()

      // Try to centre on browser location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          pos => {
            const { latitude: lat, longitude: lng } = pos.coords
            map.setView([lat, lng], 16)
            marker.setLatLng([lat, lng])
            setLatLng({ lat, lng })
          },
          () => {},
          { timeout: 5000, maximumAge: 60000, enableHighAccuracy: false }
        )
      }
    }, 400)

    return () => {
      clearTimeout(timerId)
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, [])

  return (
    <div className="pin-modal">
      <div className="pin-modal-sheet">
        <div style={{ padding: '16px 20px 4px', fontWeight: 700, fontSize: 15 }}>Drop a Pin</div>
        <div style={{ fontSize: 12, color: DS.textMuted, padding: '0 20px 12px' }}>
          Tap the map or drag the pin to set your exact location
        </div>
        <div ref={containerRef} className="pin-map-wrap" style={{ width: '100%', height: '350px' }} />
        <div className="pin-modal-footer">
          <div style={{ fontSize: 11, color: DS.textMuted, textAlign: 'center', fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1 }}>
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

//  Overview Tab
function OverviewTab({ business, campaigns, redemptions, todayCount, isLive, gpsLoading, onGoLive, onEndLive, onForceEnd, puzzlePreview, onGoToSettings }) {
  const activeCampaign = campaigns?.find(c => c.status === 'active')
  const liveCount = useLivePlayers(activeCampaign?.id)
  const weekTotal = redemptions?.length || 0
  const [packName, setPackName] = useState(null)

  useEffect(() => {
    if (!activeCampaign?.id) { setPackName(null); return }
    supabase
      .from('campaigns')
      .select('puzzle_packs(name)')
      .eq('id', activeCampaign.id)
      .single()
      .then(({ data }) => setPackName(data?.puzzle_packs?.name || null))
  }, [activeCampaign?.id])

  return (
    <div>
      <div className="page-title">Overview</div>
      <div className="page-sub">Real-time stats for {business?.name || 'your business'}</div>

      <div className="live-panel">
        <div className="live-status">
          <div className={`live-dot ${isLive ? 'active' : ''}`} />
          <div>
            <div className="live-label">{isLive ? 'You are Live' : 'Not Live'}</div>
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
          <button className="live-btn go" onClick={onGoLive}>
            GO LIVE HERE
          </button>
        )}
      </div>

      {import.meta.env.DEV && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, fontFamily: "'Share Tech Mono', monospace", color: '#EF4444', letterSpacing: 1 }}>DEV</span>
          <button
            onClick={onForceEnd}
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8, color: '#EF4444', fontSize: 11, fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1, padding: '6px 12px', cursor: 'pointer' }}
          >
            FORCE END ALL SESSIONS
          </button>
        </div>
      )}

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
            {packName || activeCampaign?.name || 'No active pack'}
          </div>
        </div>
      </div>

      {!business?.redemption_pin_hash && (
        <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12, padding: '14px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1, color: DS.gold, marginBottom: 4 }}>VOUCHERS UNSECURED</div>
            <div style={{ fontSize: 13, color: DS.textSub }}>Set up your staff PIN to secure voucher redemptions</div>
          </div>
          <button
            onClick={onGoToSettings}
            style={{ background: DS.gold, border: 'none', borderRadius: 8, color: '#121218', fontSize: 11, fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1, padding: '8px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            SET UP PIN
          </button>
        </div>
      )}

      {puzzlePreview && puzzlePreview.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div className="section-label">Your Hunt Questions</div>
          <div className="card" style={{ padding: '16px 20px', marginBottom: 8 }}>
            <div style={{ fontSize: 13, color: DS.textSub, marginBottom: 16, lineHeight: 1.5 }}>
              Players solve these questions to build your GPS coordinates and find you.
              Each correct answer contributes one digit to the location.
            </div>
            {puzzlePreview.map((q, i) => (
              <div key={i} style={{
                background: DS.cardAlt,
                border: `1px solid ${DS.border}`,
                borderRadius: 10,
                padding: '12px 14px',
                marginBottom: i < puzzlePreview.length - 1 ? 10 : 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{
                    background: DS.purple, color: '#fff',
                    borderRadius: 4, padding: '2px 7px',
                    fontSize: 11, fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1,
                  }}>SLOT {q.slot}</span>
                  <span style={{ fontSize: 13, color: DS.textSub }}>
                    {q.movie_title} ({q.movie_year})
                  </span>
                  <span style={{
                    marginLeft: 'auto',
                    background: 'rgba(245,158,11,0.1)', color: DS.gold,
                    borderRadius: 4, padding: '2px 7px',
                    fontSize: 11, fontFamily: "'Share Tech Mono', monospace",
                  }}>DIGIT {q.digit}</span>
                </div>
                <div style={{ fontSize: 14, color: DS.text, lineHeight: 1.4 }}>{q.question_text}</div>
                {q.extraction_note && (
                  <div style={{ fontSize: 11, color: DS.textMuted, marginTop: 4 }}>{q.extraction_note}</div>
                )}
              </div>
            ))}
            <div style={{ fontSize: 12, color: DS.textMuted, marginTop: 12, textAlign: 'center' }}>
              Players type full answers  the coordinate digit is extracted server-side
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
                  <td>{r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}</td>
                  <td>
                    <span style={{
                      background: r.redeemed_at ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                      color: r.redeemed_at ? DS.green : DS.gold,
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
                <tr><td colSpan={3} style={{ textAlign: 'center', color: DS.borderMid, padding: 24 }}>No redemptions yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

//  Vouchers Tab
function VouchersTab({ business, campaigns, redemptions, showToast }) {
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
    if (!activeCampaign?.pack_id) { showToast('! No active campaign found'); return }

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
      showToast(`${codes.length} voucher code${codes.length > 1 ? 's' : ''} uploaded`)
    } catch (err) {
      showToast('! Upload failed: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const unclaimed = existing.filter(c => !c.claimed_by).length
  const claimed = existing.filter(c => c.claimed_by).length

  return (
    <div>
      <div className="page-title">Voucher Codes</div>
      <div className="page-sub">Upload elite codes  one code drawn per player on completion</div>

      <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">AVAILABLE</div>
          <div className="stat-value" style={{ color: DS.green }}>{unclaimed}</div>
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
            {uploading ? 'UPLOADING' : 'UPLOAD CODES'}
          </button>
          {codeText && (
            <span style={{ fontSize: 12, color: DS.textMuted }}>
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
                          background: c.claimed_by ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
                          color: c.claimed_by ? DS.red : DS.green,
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontSize: 10,
                          fontFamily: "'Share Tech Mono', monospace",
                        }}>
                          {c.claimed_by ? 'CLAIMED' : 'AVAILABLE'}
                        </span>
                      </td>
                      <td>{c.created_at ? new Date(c.created_at).toLocaleDateString() : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="section-label" style={{ marginTop: 28 }}>Player Redemptions</div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>CODE</th>
                <th>DATE</th>
                <th>TIME</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {(redemptions || []).length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: DS.textMuted, padding: '28px 16px', fontSize: 13 }}>
                    No redemptions yet - players will appear here when they arrive
                  </td>
                </tr>
              )}
              {(redemptions || []).map(r => {
                const dt = r.created_at ? new Date(r.created_at) : null
                return (
                  <tr key={r.id}>
                    <td className="code-cell">{r.voucher_code}</td>
                    <td>{dt ? dt.toLocaleDateString('en-GB') : ''}</td>
                    <td style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12 }}>
                      {dt ? dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </td>
                    <td>
                      <span style={{
                        background: r.redeemed_at ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                        color: r.redeemed_at ? DS.green : DS.gold,
                        border: r.redeemed_at ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(245,158,11,0.3)',
                        borderRadius: 20,
                        padding: '2px 10px',
                        fontSize: 11,
                        fontFamily: "'Share Tech Mono', monospace",
                        letterSpacing: 1,
                      }}>
                        {r.redeemed_at ? 'REDEEMED' : 'ISSUED'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

//  Themes Tab
function ThemesTab({ business, campaigns, showToast }) {
  const activeCampaign = campaigns?.find(c => c.status === 'active')
  const [activeTheme, setActiveTheme] = useState(null)
  const [applying, setApplying] = useState(null)
  const [selectedDiff, setSelectedDiff] = useState(activeCampaign?.difficulty || 'classic')
  const [savingDiff, setSavingDiff] = useState(false)

  async function handleSaveDiff() {
    if (!activeCampaign) { showToast('! No active campaign'); return }
    setSavingDiff(true)
    try {
      const { error } = await supabase.from('campaigns')
        .update({ difficulty: selectedDiff })
        .eq('id', activeCampaign.id)
      if (error) throw error
      showToast('Difficulty updated')
    } catch (err) {
      showToast('! ' + err.message)
    } finally {
      setSavingDiff(false)
    }
  }

  async function handleApply(theme) {
    if (!activeCampaign) { showToast('! No active campaign to update'); return }

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
        showToast(`Theme "${theme.name}"  pack not found in DB yet. Add it via migrations.`)
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
      showToast(`Theme switched to "${theme.name}"  live within 2 minutes`)
    } catch (err) {
      showToast('! Failed: ' + err.message)
    } finally {
      setApplying(null)
    }
  }

  const GENRES = [
    { id: 'action',   label: 'Action',   accent: '#EF4444' },
    { id: 'comedy',   label: 'Comedy',   accent: '#F59E0B' },
    { id: 'horror',   label: 'Horror',   accent: '#8B5CF6' },
    { id: 'sci-fi',   label: 'Sci-Fi',   accent: '#06B6D4' },
    { id: 'romance',  label: 'Romance',  accent: '#F43F5E' },
    { id: 'thriller', label: 'Thriller', accent: '#10B981' },
    { id: 'animated', label: 'Animated', accent: '#FCD34D' },
    { id: 'classic',  label: 'Classic',  accent: '#B8B4D8' },
  ]
  const [activeGenre, setActiveGenre] = useState(null)

  return (
    <div>
      <div className="page-title">Hunt Difficulty</div>
      <div className="page-sub">Controls question difficulty, hint visibility, and arrival geofence radius</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { id: 'casual',  label: 'CASUAL',  color: DIFFICULTY_COLORS.casual.color, desc: 'Easy films, hints shown, 25m radius' },
          { id: 'classic', label: 'CLASSIC', color: DIFFICULTY_COLORS.classic.color, desc: 'Mixed, hints hidden, 15m radius' },
          { id: 'expert',  label: 'EXPERT',  color: DIFFICULTY_COLORS.expert.color, desc: 'Deep cuts, no hints, 10m radius' },
        ].map(d => (
          <button
            key={d.id}
            onClick={() => setSelectedDiff(d.id)}
            title={d.desc}
            style={{
              flex: 1,
              background: selectedDiff === d.id ? d.color + '22' : DS.card,
              color: d.color,
              border: `2px solid ${selectedDiff === d.id ? d.color : d.color + '44'}`,
              borderRadius: 10,
              padding: '10px 0',
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.5,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {d.label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 12, color: DS.textMuted, marginBottom: 16 }}>
        {selectedDiff === 'casual' && 'Mainstream films. Hints always visible. 25m arrival radius.'}
        {selectedDiff === 'classic' && 'Mixed difficulty. Hints available on request. 15m arrival radius.'}
        {selectedDiff === 'expert' && 'Deep cuts only. No hints. 10m arrival radius. Signal Points start at 5.'}
      </div>
      <button
        onClick={handleSaveDiff}
        disabled={savingDiff}
        style={{
          background: savingDiff ? DS.border : 'linear-gradient(135deg, #7C3AED, #9D5FF5)',
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          padding: '11px 24px',
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 1.5,
          cursor: savingDiff ? 'default' : 'pointer',
          marginBottom: 32,
        }}
      >
        {savingDiff ? 'SAVING...' : 'SAVE DIFFICULTY'}
      </button>

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

            <div className="theme-name" style={{ color: t.accent }}>{t.name}</div>
            <div className="theme-tag">{t.tag}</div>
            {applying === t.id && (
              <div style={{ fontSize: 10, marginTop: 6, color: '#F1F0FF' }}>Applying</div>
            )}
          </div>
        ))}
      </div>

      <div className="section-label" style={{ marginTop: 28 }}>Genre Filter</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        {GENRES.map(g => (
          <button
            key={g.id}
            onClick={() => setActiveGenre(activeGenre === g.id ? null : g.id)}
            style={{
              background: activeGenre === g.id ? g.accent : DS.card,
              color: activeGenre === g.id ? '#121218' : g.accent,
              border: `1px solid ${g.accent}`,
              borderRadius: 12,
              padding: '7px 16px',
              fontSize: 12,
              fontFamily: "'Share Tech Mono', monospace",
              letterSpacing: 1,
              cursor: 'pointer',
              fontWeight: 700,
              transition: 'all 0.15s',
            }}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginTop: 0 }}>
        <div className="card-title">Seasonal Pricing</div>
        <div className="card-sub">
          Premium seasonal events attract 3 more players. Featured and Sponsored tiers include priority listing during peak periods.
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
              ['Christmas', 'Dec 1  Jan 5', '+25%'],
              ['Halloween', 'Oct 1  Nov 1', '+15%'],
              ['Summer',    'Jul 1  Aug 31', '+10%'],
              ['Valentine\'s', 'Feb 7  Feb 15', '+20%'],
            ].map(([event, dates, uplift]) => (
              <tr key={event}>
                <td style={{ fontWeight: 600 }}>{event}</td>
                <td style={{ color: DS.textMuted }}>{dates}</td>
                <td style={{ color: DS.gold, fontFamily: "'Share Tech Mono', monospace" }}>{uplift}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

//  History Tab
function HistoryTab({ redemptions }) {
  // Group by day: count total arrivals and redeemed
  const byDay = (redemptions || []).reduce((acc, r) => {
    const day = r.created_at ? r.created_at.slice(0, 10) : 'Unknown'
    if (!acc[day]) acc[day] = { players: 0, redeemed: 0 }
    acc[day].players += 1
    if (r.redeemed_at) acc[day].redeemed += 1
    return acc
  }, {})

  const days = Object.entries(byDay).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 30)

  return (
    <div>
      <div className="page-title">Campaign History</div>
      <div className="page-sub">Past sessions and redemption counts</div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>DATE</th>
                <th>PLAYERS</th>
                <th>REDEMPTIONS</th>
              </tr>
            </thead>
            <tbody>
              {days.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', color: DS.textMuted, padding: '28px 16px', fontSize: 13 }}>
                    No campaign history yet
                  </td>
                </tr>
              )}
              {days.map(([day, stats]) => (
                <tr key={day}>
                  <td style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12 }}>
                    {new Date(day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ color: '#9D5FF5', fontWeight: 700 }}>{stats.players}</td>
                  <td>
                    <span style={{
                      background: stats.redeemed > 0 ? 'rgba(16,185,129,0.12)' : 'rgba(30,30,46,0.5)',
                      color: stats.redeemed > 0 ? DS.green : DS.textMuted,
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontFamily: "'Share Tech Mono', monospace",
                    }}>
                      {stats.redeemed}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

//  Settings Tab
function SettingsTab({ business, showToast, onPinConfigured }) {
  const tier = business?.tier || 'starter'
  const [bizName, setBizName] = useState(business?.name || '')
  const [contactEmail, setContactEmail] = useState(business?.email || '')
  const [venueCategory, setVenueCategory] = useState(business?.venue_category || '')
  const [saving, setSaving] = useState(false)
  const origBizName = useRef(business?.name || '')
  const origContactEmail = useRef(business?.email || '')
  const origVenueCategory = useRef(business?.venue_category || '')
  const isDirty = bizName !== origBizName.current || contactEmail !== origContactEmail.current || venueCategory !== origVenueCategory.current
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinSaving, setPinSaving] = useState(false)
  const [pinError, setPinError] = useState('')
  const [pinSuccess, setPinSuccess] = useState(false)
  const [pinConfigured, setPinConfigured] = useState(!!business?.redemption_pin_hash)

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

  const TIER_LABELS = { starter: 'Starter', featured: 'Featured', sponsored: 'Sponsored' }

  async function handleSaveDetails() {
    setSaving(true)
    try {
      if (business?.id) {
        const { error } = await supabase
          .from('businesses')
          .update({ name: bizName, contact_email: contactEmail, venue_category: venueCategory || null })
          .eq('id', business.id)
        if (error) throw error
        origBizName.current = bizName
        origContactEmail.current = contactEmail
        origVenueCategory.current = venueCategory
        showToast('Details saved.')
      }
    } catch (err) {
      showToast('! Save failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function hashPin(p, bizId) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(p + bizId))
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  async function handleSavePin() {
    if (pin.length !== 4) { setPinError('PIN must be exactly 4 digits'); return }
    if (pin !== confirmPin) { setPinError('PINs do not match'); return }
    setPinError('')
    setPinSuccess(false)
    setPinSaving(true)
    try {
      const hash = await hashPin(pin, business.id)
      const { error } = await supabase.from('businesses').update({ redemption_pin_hash: hash }).eq('id', business.id)
      if (error) throw error
      setPinConfigured(true)
      setPinSuccess(true)
      setPin('')
      setConfirmPin('')
      onPinConfigured?.()
    } catch (err) {
      setPinError('Save failed: ' + err.message)
    } finally {
      setPinSaving(false)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.reload()
  }

  const inputStyle = {
    width: '100%',
    background: DS.cardAlt,
    border: `1px solid ${DS.border}`,
    borderRadius: 10,
    color: DS.text,
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize: 14,
    padding: '11px 14px',
    outline: 'none',
    marginBottom: 10,
  }

  return (
    <div>
      <div className="page-title">Settings</div>
      <div className="page-sub">Manage your business details and subscription</div>

      <div className="section-label">Business Details</div>
      <div className="card">
        <div style={{ marginBottom: 6, fontSize: 12, color: DS.textMuted }}>Business name</div>
        <input
          style={inputStyle}
          value={bizName}
          onChange={e => setBizName(e.target.value)}
          placeholder="Your business name"
        />
        <div style={{ marginBottom: 6, fontSize: 12, color: DS.textMuted }}>Contact email</div>
        <input
          style={inputStyle}
          type="email"
          value={contactEmail}
          onChange={e => setContactEmail(e.target.value)}
          placeholder="contact@yourbusiness.com"
        />
        <div style={{ marginBottom: 6, fontSize: 12, color: DS.textMuted }}>Venue category</div>
        <select
          style={inputStyle}
          value={venueCategory}
          onChange={e => setVenueCategory(e.target.value)}
        >
          <option value="" disabled>Select a category…</option>
          {VENUE_CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.emoji} {c.value}</option>
          ))}
        </select>
        {venueCategory && (
          <div style={{ marginTop: -6, marginBottom: 10, fontSize: 12, color: DS.textMuted, fontStyle: 'italic' }}>
            {VENUE_CATEGORIES.find(c => c.value === venueCategory)?.caption}
          </div>
        )}
        <div style={{ marginBottom: 6, fontSize: 12, color: DS.textMuted }}>Subscription tier</div>
        <div style={{
          background: DS.cardAlt,
          border: `1px solid ${DS.border}`,
          borderRadius: 10,
          padding: '11px 14px',
          marginBottom: 16,
          fontSize: 14,
          color: DS.gold,
          fontFamily: "'Share Tech Mono', monospace",
          letterSpacing: 1,
        }}>
          {TIER_LABELS[tier] || tier}
        </div>
        {isDirty && (
          <button
            onClick={handleSaveDetails}
            disabled={saving}
            style={{
              background: 'linear-gradient(135deg, #F59E0B, #FCD34D)',
              border: 'none',
              borderRadius: 12,
              color: '#121218',
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 1.5,
              padding: '13px 0',
              width: '100%',
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'SAVING' : 'SAVE CHANGES'}
          </button>
        )}
      </div>

      <div className="section-label">Staff Redemption PIN</div>
      <div className="card">
        <div className="card-title">Voucher Security</div>
        <div className="card-sub">Set a 4-digit PIN that staff enter to confirm voucher redemptions</div>
        {pinConfigured && (
          <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: DS.green, fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1 }}>
            PIN CONFIGURED
          </div>
        )}
        <div style={{ marginBottom: 6, fontSize: 12, color: DS.textMuted }}>New PIN (4 digits)</div>
        <input
          style={inputStyle}
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="----"
        />
        <div style={{ marginBottom: 6, fontSize: 12, color: DS.textMuted }}>Confirm PIN</div>
        <input
          style={inputStyle}
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={confirmPin}
          onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="----"
        />
        {pinError && (
          <div style={{ color: DS.red, fontSize: 13, marginBottom: 10 }}>{pinError}</div>
        )}
        {pinSuccess && (
          <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 13, color: DS.green, lineHeight: 1.5 }}>
            PIN saved — voucher redemptions are now secured
          </div>
        )}
        <button
          onClick={handleSavePin}
          disabled={pinSaving}
          style={{
            background: 'linear-gradient(135deg, #F59E0B, #FCD34D)',
            border: 'none', borderRadius: 12, color: '#121218',
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: 13, fontWeight: 700, letterSpacing: 1.5,
            padding: '13px 0', width: '100%',
            cursor: pinSaving ? 'default' : 'pointer',
            opacity: pinSaving ? 0.7 : 1,
          }}
        >
          {pinSaving ? 'SAVING...' : 'SAVE PIN'}
        </button>
      </div>

      <div className="section-label">Subscription Plan</div>
      <div className="plan-grid">
        {PLANS.map(p => (
          <div key={p.id} className={`plan-card ${tier === p.id ? 'current' : ''}`}>
            <div className="plan-name">{p.name}</div>
            <div className="plan-price">{p.price}<span>{p.period}</span></div>
            {p.features.map(f => (
              <div key={f} className="plan-feature">{f}</div>
            ))}
            {tier === p.id ? (
              <div style={{ marginTop: 14, fontSize: 11, color: DS.green, fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1 }}>
                + CURRENT PLAN
              </div>
            ) : (
              <button
                className="btn-primary"
                style={{ marginTop: 14, width: '100%' }}
                onClick={() => showToast('To upgrade your plan, contact us at hello@geofictionlabs.com')}
              >
                UPGRADE
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="section-label" style={{ color: DS.red }}>Danger Zone</div>
      <div className="card" style={{ border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.03)' }}>
        <div className="card-title" style={{ color: DS.red }}>End Active Sessions</div>
        <div className="card-sub">Ending your session removes you from the player map immediately.</div>
        <div className="row">
          <button
            className="btn-secondary"
            style={{ color: DS.red, borderColor: 'rgba(239,68,68,0.25)' }}
            onClick={async () => {
              if (!business?.id) return
              await supabase
                .from('live_business_sessions')
                .update({ session_end: new Date().toISOString(), is_live: false })
                .eq('business_id', business.id)
                .is('session_end', null)
              showToast('All active sessions ended.')
            }}
          >
            END ALL SESSIONS
          </button>
          <button
            className="btn-secondary"
            style={{ color: DS.red, borderColor: 'rgba(239,68,68,0.25)' }}
            onClick={handleSignOut}
          >
            SIGN OUT
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Legal</div>
        <div className="card-sub">GeoFiction Labs Ltd - hello@geofictionlabs.com</div>
        <div className="row">
          <a href="/privacy.html" style={{ color: DS.purple, fontSize: 13, textDecoration: 'none' }}>Privacy Policy</a>
          <a href="/terms.html" style={{ color: DS.purple, fontSize: 13, textDecoration: 'none' }}>Terms of Service</a>
        </div>
      </div>
    </div>
  )
}

//  Dashboard Root
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

    // Verify live status directly — RPC live_session can be stale
    const today = new Date().toISOString().slice(0, 10)
    const { data: liveRow } = await supabase
      .from('live_business_sessions')
      .select('id')
      .eq('business_id', myBiz.business_id)
      .eq('is_live', true)
      .is('session_end', null)
      .gte('created_at', today)
      .maybeSingle()
    setIsLive(!!liveRow)

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
          showToast(`Player arrived! Code: ${r.voucher_code}`)
          if (Notification.permission === 'granted') {
            new Notification('MapTheMovie  Player Arrived!', {
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
    if (lat && lon && lat !== 0 && lon !== 0) {
      const { data: previewData } = await supabase.rpc('build_puzzle_for_location', {
        p_lat: lat,
        p_lon: lon,
      })
      if (previewData?.success) setPuzzlePreview(previewData.questions || [])
    }
  }

  function handleGoLive() {
    setShowPinDrop(true)
  }

  async function handleEndLive() {
    if (!business?.id) return
    await supabase
      .from('live_business_sessions')
      .update({ session_end: new Date().toISOString(), is_live: false })
      .eq('business_id', business.id)
      .eq('is_live', true)
    setIsLive(false)
    showToast('Session ended.')
  }

  async function handleForceEndAll() {
    if (!business?.id) return
    await supabase
      .from('live_business_sessions')
      .update({ session_end: new Date().toISOString(), is_live: false })
      .eq('business_id', business.id)
    setIsLive(false)
    showToast('All sessions force-closed.')
  }

  const TABS = [
    { id: 'overview',  icon: '', label: 'Overview' },
    { id: 'vouchers',  icon: '',  label: 'Vouchers' },
    { id: 'themes',    icon: '', label: 'Themes' },
    { id: 'history',   icon: '', label: 'History' },
    { id: 'settings',  icon: '', label: 'Settings' },
  ]

  //  Auth screens
  if (authStep === 'checking') {
    return (
      <>
        <style>{CSS}</style>
        <div className="auth-screen" style={{ background: DS.bg, minHeight: '100vh' }}>
          <div style={{ color: DS.textMuted, fontFamily: "'Share Tech Mono', monospace", letterSpacing: 2 }}>
            Loading
          </div>
        </div>
      </>
    )
  }

  if (authStep === 'login') {
    return (
      <>
        <style>{CSS}</style>
        <div className="auth-screen" style={{ background: DS.bg, minHeight: '100vh', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="auth-card">
            <div className="auth-logo" style={{ marginBottom: 16 }}>
              <Logo size="lg" />
            </div>
            <div className="auth-sub">Business Portal</div>
            <div className="auth-title" style={{ marginBottom: 20 }}>Sign In</div>

            {emailSent ? (
              <div className="auth-sent">
                Magic link sent! Check your inbox.
                <div style={{ marginTop: 10, fontSize: 12, color: DS.textMuted }}>
                  No email? Check spam or contact hello@geofictionlabs.com
                </div>
                <button
                  className="auth-btn"
                  style={{ marginTop: 16, background: 'transparent', border: `1px solid ${DS.border}`, color: DS.textSub }}
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
                  style={{ background: 'transparent', border: `1px solid ${DS.border}`, color: DS.textSub }}
                  onClick={handleLoginMagicLink}
                >
                  SEND MAGIC LINK
                </button>
              </>
            )}
          </div>
          <div style={{ marginTop: 24, fontSize: 12, color: DS.textMuted, textAlign: 'center' }}>
            GeoFiction Labs Ltd
          </div>
        </div>
      </>
    )
  }

  if (authStep === 'no_business') {
    return (
      <>
        <style>{CSS}</style>
        <div className="auth-screen" style={{ background: DS.bg, minHeight: '100vh' }}>
          <div className="auth-card">
            <div className="auth-logo" style={{ marginBottom: 16 }}>
              <Logo size="lg" />
            </div>

            <div className="auth-title">No Business Account</div>
            <p style={{ fontSize: 13, color: DS.textMuted, margin: '10px 0 20px', lineHeight: 1.6 }}>
              Your account isn't linked to a business yet. Contact us to get set up.
            </p>
            <a
              href="mailto:hello@geofictionlabs.com"
              style={{
                display: 'block',
                background: 'linear-gradient(135deg, #7C3AED, #9D5FF5)',
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

  //  Dashboard
  return (
    <>
      <style>{CSS}</style>
      <div className="dash-root" style={{ background: DS.bg, minHeight: '100vh', color: DS.text }}>
        {/* Sidebar */}
        <div className="sidebar">
          <div className="sidebar-logo">
            <Logo size="sm" />
          </div>
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
            <div style={{ fontSize: 11, color: DS.textMuted, marginBottom: 8 }}>
              GeoFiction Labs Ltd
            </div>
            <div style={{ fontSize: 11, color: DS.border, fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1 }}>
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
              onForceEnd={handleForceEndAll}
              puzzlePreview={puzzlePreview}
              onGoToSettings={() => setTab('settings')}
            />
          )}
          {tab === 'vouchers' && (
            <VouchersTab business={business} campaigns={campaigns} redemptions={redemptions} showToast={showToast} />
          )}
          {tab === 'themes' && (
            <ThemesTab business={business} campaigns={campaigns} showToast={showToast} />
          )}
          {tab === 'history' && <HistoryTab redemptions={redemptions} />}
          {tab === 'settings' && (
            <SettingsTab
              business={business}
              showToast={showToast}
              onPinConfigured={() => setBusiness(prev => prev ? { ...prev, redemption_pin_hash: 'set' } : prev)}
            />
          )}
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
