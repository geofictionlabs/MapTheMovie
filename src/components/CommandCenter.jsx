// src/components/CommandCenter.jsx
//
// Owner-only hunt builder. Drop waypoints on the map, generate trivia
// via the secure Edge Function, then save to Supabase.
//
// Saves via create_command_center_hunt (SECURITY DEFINER RPC, migration 016).
// That RPC checks is_platform_admin() server-side and inserts:
//   puzzle_packs -> puzzles -> trivia_variables -> puzzle_waypoints -> campaigns
// all in one transaction. Direct table writes are not used. A successful
// save is immediately live — no manual campaign SQL required. business_id
// is required (a "GeoFiction Labs (Unassigned)" placeholder business exists
// for hunts without a real sponsor yet — see migration 016 for why NULL
// isn't supported).

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
function Spinner({ size = 16, style: s }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'cc-spin 1s linear infinite', display: 'block', ...s }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
function ShieldIcon({ size = 16, style: s }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function XIcon({ size = 16, style: s }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function RefreshIcon({ size = 16, style: s }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <path d="M23 4v6h-6" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}
function TrashIcon({ size = 16, style: s }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
    </svg>
  );
}
function SaveIcon({ size = 16, style: s }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
    </svg>
  );
}
function CheckIcon({ size = 16, style: s }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
import { supabase } from '../lib/supabase';
import { generateTriviaQuestion } from '../lib/triviaApi';

const COLORS = {
  bg: '#080810',
  panel: '#121218',
  border: '#1F1F2E',
  textDim: '#8B8B9A',
  textBright: '#F4F4F8',
  purple: '#7C3AED',
  gold: '#F59E0B',
};

const TIERS = {
  casual: { label: 'Casual', color: '#34D399' },
  classic: { label: 'Classic', color: '#7C3AED' },
  expert: { label: 'Expert', color: '#F59E0B' },
  cipher: { label: 'Cipher', color: '#F43F5E' },
};

// Same 8 keys as HuntSelectionScreen.jsx's THEMES / App.jsx's GENRE_KEYWORDS.
// Authored here going forward instead of guessed client-side from pack text.
const GENRES = [
  { key: 'general', label: 'General' },
  { key: 'horror', label: 'Horror' },
  { key: 'scifi', label: 'Sci-Fi' },
  { key: 'action', label: 'Action' },
  { key: 'romance', label: 'Romance' },
  { key: 'comedy', label: 'Comedy' },
  { key: 'thriller', label: 'Thriller' },
  { key: 'evergreen_80s', label: '80s Nostalgia' },
];

const DEFAULT_VOUCHER_HEADLINE = 'Show this screen to claim your reward';

function toDateInputValue(d) {
  return d.toISOString().slice(0, 10);
}

const DEFAULT_CENTER = [51.3858, 0.5483]; // Gillingham, Kent
const DEFAULT_ZOOM = 15;

// The 4th decimal digit of |lat| is the slot the AI question must target.
// 4th decimal of latitude ~= 11 m precision — enough ambiguity to be a puzzle.
function extractCoordinateDigit(lat) {
  const s = Math.abs(lat).toFixed(4);
  return parseInt(s[s.length - 1], 10);
}

// NOTE: masked_lat/masked_lon used to be built per-waypoint here, but a
// multi-stop hunt now has ONE combined masked template covering all slots,
// built server-side in create_command_center_hunt from the final
// destination's coordinates — see migrations/014_real_multistop_waypoints.sql.

export default function CommandCenter() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef({});

  const [adminChecked, setAdminChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [selectedTier, setSelectedTier] = useState('classic');
  const [selectedGenre, setSelectedGenre] = useState('general');
  const [waypoints, setWaypoints] = useState([]);
  const [pendingPin, setPendingPin] = useState(null);
  const [pendingName, setPendingName] = useState('');
  const [packName, setPackName] = useState('');
  const [saving, setSaving] = useState(false);
  // { packId, campaignId, packName } of the most recently saved hunt, or null.
  // Stays visible (no auto-hide timer) until dismissed.
  const [savedInfo, setSavedInfo] = useState(null);

  // Campaign fields — required business, everything else defaulted.
  const [businesses, setBusinesses] = useState([]);
  const [businessesLoading, setBusinessesLoading] = useState(true);
  const [selectedBusinessId, setSelectedBusinessId] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [startsAt, setStartsAt] = useState(() => toDateInputValue(new Date()));
  const [endsAt, setEndsAt] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return toDateInputValue(d);
  });
  const [voucherHeadline, setVoucherHeadline] = useState(DEFAULT_VOUCHER_HEADLINE);

  // Admin gate. Real enforcement is server-side in the RPC and Edge Function.
  useEffect(() => {
    async function checkAdmin() {
      const { data, error } = await supabase.rpc('is_platform_admin');
      setIsAdmin(!error && data === true);
      setAdminChecked(true);
    }
    checkAdmin();
  }, []);

  // Business picker options — loaded once admin access is confirmed.
  useEffect(() => {
    if (!isAdmin) return;
    async function loadBusinesses() {
      setBusinessesLoading(true);
      const { data, error } = await supabase
        .from('businesses')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (!error) setBusinesses(data || []);
      setBusinessesLoading(false);
    }
    loadBusinesses();
  }, [isAdmin]);

  // Map init — runs once when admin gate passes
  useEffect(() => {
    if (!isAdmin || mapInstance.current || !mapRef.current) return;

    const map = L.map(mapRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    map.on('click', (e) => {
      setPendingPin({ lat: e.latlng.lat, lng: e.latlng.lng });
      setPendingName('');
    });

    mapInstance.current = map;
    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [isAdmin]);

  // Keep map markers in sync with waypoints state
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    Object.values(markersRef.current).forEach((m) => map.removeLayer(m));
    markersRef.current = {};

    waypoints.forEach((w, i) => {
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:${TIERS[w.tier].color};color:#080810;font-weight:700;font-size:11px;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #080810;">${i + 1}</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      const marker = L.marker([w.lat, w.lng], { icon }).addTo(map);
      markersRef.current[w.id] = marker;
    });
  }, [waypoints]);

  function confirmPending() {
    if (!pendingName.trim()) return;
    const id = crypto.randomUUID();
    const required_digit = extractCoordinateDigit(pendingPin.lat);

    const waypoint = {
      id,
      lat: pendingPin.lat,
      lng: pendingPin.lng,
      tier: selectedTier,
      name: pendingName.trim(),
      required_digit,
      question_text:    null,
      movie_title:      null,
      movie_year:       null,
      movie_emoji:      null,
      correct_answer:   null,
      coordinate_digit: null,
      extraction_note:  null,
      hint_text:        null,
      loading: true,
      error: false,
    };

    setWaypoints((prev) => [...prev, waypoint]);
    const name = pendingName.trim();
    const tier = selectedTier;
    setPendingPin(null);
    setPendingName('');
    fetchQuestionFor(id, name, tier, required_digit);
  }

  async function fetchQuestionFor(id, name, tier, required_digit) {
    setWaypoints((prev) =>
      prev.map((w) => (w.id === id ? { ...w, loading: true, error: false } : w))
    );
    try {
      // selectedGenre read live (not frozen per-waypoint) — genre is a
      // pack-level setting, so a regenerate always uses whatever genre is
      // currently selected, matching the rest of the hunt.
      // Movies already assigned to OTHER waypoints are excluded so the AI
      // doesn't pick the same film twice across one hunt. Derived directly
      // from waypoints (not separate tracked state) so it's always
      // consistent with what's actually on the map -- no extra state to
      // keep in sync. Excludes the pin's own current movie_title too (id
      // filter), which only matters on regenerate and is harmless: we
      // want a different movie for that pin anyway.
      const usedMovies = waypoints
        .filter((w) => w.id !== id)
        .map((w) => w.movie_title)
        .filter(Boolean);
      const result = await generateTriviaQuestion(name, tier, required_digit, selectedGenre, usedMovies);
      setWaypoints((prev) =>
        prev.map((w) => (w.id === id ? { ...w, ...result, loading: false } : w))
      );
    } catch {
      setWaypoints((prev) =>
        prev.map((w) => (w.id === id ? { ...w, loading: false, error: true } : w))
      );
    }
  }

  function removeWaypoint(id) {
    setWaypoints((prev) => prev.filter((w) => w.id !== id));
  }

  function regenerate(id) {
    const wp = waypoints.find((w) => w.id === id);
    if (wp) fetchQuestionFor(id, wp.name, wp.tier, wp.required_digit);
  }

  async function saveHunt() {
    if (!packName.trim() || waypoints.length === 0 || !selectedBusinessId) return;
    if (waypoints.some((w) => w.loading || w.error || w.coordinate_digit === null)) {
      alert('All waypoints must finish generating before saving.');
      return;
    }
    setSaving(true);
    try {
      const payload = waypoints.map((w) => ({
        title:            w.name,
        lat:              w.lat,
        lng:              w.lng,
        tier:             w.tier,
        movie_title:      w.movie_title,
        movie_year:       w.movie_year,
        movie_emoji:      w.movie_emoji,
        question_text:    w.question_text,
        correct_answer:   w.correct_answer,
        coordinate_digit: w.coordinate_digit,
        extraction_note:  w.extraction_note,
        hint_text:        w.hint_text,
      }));

      const { data, error } = await supabase.rpc('create_command_center_hunt', {
        p_pack_name: packName.trim(),
        p_waypoints: payload,
        p_business_id: selectedBusinessId,
        p_genre: selectedGenre,
        p_campaign_name: campaignName.trim() || null,
        p_starts_at: new Date(startsAt).toISOString(),
        p_ends_at: new Date(endsAt).toISOString(),
        p_voucher_headline: voucherHeadline.trim() || DEFAULT_VOUCHER_HEADLINE,
      });
      if (error) throw error;

      setSavedInfo({ packId: data.pack_id, campaignId: data.campaign_id, packName: data.campaign_name });
      setPackName('');
      setWaypoints([]);
      setSelectedBusinessId('');
      setSelectedGenre('general');
      setCampaignName('');
      setStartsAt(toDateInputValue(new Date()));
      setEndsAt(() => {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1);
        return toDateInputValue(d);
      });
      setVoucherHeadline(DEFAULT_VOUCHER_HEADLINE);
    } catch (err) {
      console.error('Save failed:', err);
      alert('Save failed — ' + (err?.message || 'see console'));
    } finally {
      setSaving(false);
    }
  }

  const canSave =
    waypoints.length > 0 &&
    packName.trim().length > 0 &&
    !!selectedBusinessId &&
    !saving &&
    waypoints.every((w) => !w.loading && !w.error && w.coordinate_digit !== null);

  // ── Loading / auth states ──────────────────────────────────────────────

  if (!adminChecked) {
    return (
      <div style={{ background: COLORS.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`@keyframes cc-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        <Spinner size={24} style={{ color: COLORS.textDim }} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ background: COLORS.bg, minHeight: '100vh', color: COLORS.textBright, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 24px', textAlign: 'center' }}>
        <ShieldIcon size={28} style={{ color: COLORS.textDim }} />
        <p style={{ color: COLORS.textDim, fontSize: 14, margin: 0 }}>
          This area is restricted to GeoFiction Labs owners.
        </p>
      </div>
    );
  }

  // ── Main UI ────────────────────────────────────────────────────────────

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', color: COLORS.textBright, width: '100%' }}>
      <style>{`@keyframes cc-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <ShieldIcon size={20} style={{ color: COLORS.gold }} />
          <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: 0 }}>
            Command Center
          </h1>
        </div>
        <p style={{ color: COLORS.textDim, fontSize: 12, marginBottom: 20, marginTop: 0 }}>
          GeoFiction Labs — Owner Tools
        </p>

        {/* Pack name */}
        <input
          value={packName}
          onChange={(e) => setPackName(e.target.value)}
          placeholder="Hunt / pack name"
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 6, fontSize: 14,
            background: COLORS.panel, border: `1px solid ${COLORS.border}`,
            color: COLORS.textBright, outline: 'none', marginBottom: 16,
            boxSizing: 'border-box',
          }}
        />

        {/* Genre — pack-level, chosen before any waypoint is dropped so it
            actually reaches trivia generation (not just card theming). */}
        <label style={{ display: 'block', fontSize: 11, color: COLORS.textDim, marginBottom: 4 }}>
          Genre
        </label>
        <select
          value={selectedGenre}
          onChange={(e) => setSelectedGenre(e.target.value)}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 6, fontSize: 14,
            background: COLORS.panel, border: `1px solid ${COLORS.border}`,
            color: COLORS.textBright, outline: 'none', marginBottom: 16,
            boxSizing: 'border-box',
          }}
        >
          {GENRES.map((g) => (
            <option key={g.key} value={g.key}>{g.label}</option>
          ))}
        </select>
        <p style={{ color: COLORS.textDim, fontSize: 11, marginBottom: 16, marginTop: -12 }}>
          Applies to every waypoint's trivia below — pick it before dropping pins.
        </p>

        {/* Difficulty tier selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {Object.entries(TIERS).map(([key, t]) => (
            <button
              key={key}
              onClick={() => setSelectedTier(key)}
              style={{
                padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: 1,
                background: selectedTier === key ? t.color : COLORS.panel,
                color: selectedTier === key ? '#080810' : t.color,
                border: `1px solid ${t.color}`,
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <p style={{ color: COLORS.textDim, fontSize: 12, marginBottom: 12, marginTop: 0 }}>
          Tap the map to drop a {TIERS[selectedTier].label} waypoint.
        </p>

        {/* Map */}
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 16, height: 380, border: `1px solid ${COLORS.border}` }}>
          <div ref={mapRef} style={{ height: '100%', width: '100%' }} />

          {/* Name-this-waypoint overlay */}
          {pendingPin && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, background: 'rgba(0,0,0,0.6)' }}>
              <div style={{ width: 256, borderRadius: 8, padding: 16, background: COLORS.panel, border: `1px solid ${COLORS.border}` }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: COLORS.textDim, margin: '0 0 8px' }}>
                  Name this waypoint
                </p>
                <input
                  autoFocus
                  value={pendingName}
                  onChange={(e) => setPendingName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && confirmPending()}
                  placeholder="e.g. The Ship Inn, Gillingham"
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 6, fontSize: 14,
                    background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                    color: COLORS.textBright, outline: 'none', marginBottom: 12,
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={confirmPending}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 6, fontSize: 14, fontWeight: 600, background: COLORS.purple, color: '#fff', border: 'none', cursor: 'pointer' }}
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setPendingPin(null)}
                    style={{ padding: '8px 12px', borderRadius: 6, background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.textDim, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <XIcon size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Waypoint list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {waypoints.length === 0 && (
            <p style={{ color: COLORS.textDim, fontSize: 12, textAlign: 'center', padding: '24px 0', margin: 0 }}>
              No waypoints yet. Tap the map above to drop your first pin.
            </p>
          )}

          {waypoints.map((w, i) => (
            <div
              key={w.id}
              style={{
                borderRadius: 8, padding: 12,
                background: COLORS.panel,
                border: `1px solid ${COLORS.border}`,
                borderLeft: `3px solid ${TIERS[w.tier].color}`,
              }}
            >
              {/* Waypoint header row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: TIERS[w.tier].color }}>
                      #{i + 1}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{w.name}</span>
                  </div>
                  <p style={{ fontSize: 11, fontFamily: 'monospace', margin: '2px 0 0', color: COLORS.textDim }}>
                    {w.lat.toFixed(4)}, {w.lng.toFixed(4)} &middot; {TIERS[w.tier].label}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={() => regenerate(w.id)}
                    title="Regenerate trivia"
                    style={{ padding: 6, borderRadius: 4, background: COLORS.bg, border: `1px solid ${COLORS.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <RefreshIcon size={13} style={{ color: COLORS.textDim }} />
                  </button>
                  <button
                    onClick={() => removeWaypoint(w.id)}
                    title="Remove waypoint"
                    style={{ padding: 6, borderRadius: 4, background: COLORS.bg, border: `1px solid ${COLORS.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <TrashIcon size={13} style={{ color: '#F43F5E' }} />
                  </button>
                </div>
              </div>

              {/* States */}
              {w.loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12, color: COLORS.textDim }}>
                  <Spinner size={13} />
                  Generating trivia...
                </div>
              )}
              {w.error && (
                <p style={{ fontSize: 12, marginTop: 8, color: '#F43F5E', margin: '8px 0 0' }}>
                  Generation failed — tap regenerate to try again.
                </p>
              )}

              {/* Trivia result */}
              {!w.loading && !w.error && w.question_text && (
                <div style={{ marginTop: 8, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {w.movie_title && (
                    <p style={{ color: COLORS.gold, margin: 0 }}>
                      {w.movie_emoji} {w.movie_title}{w.movie_year ? ` (${w.movie_year})` : ''}
                    </p>
                  )}
                  <p style={{ margin: 0 }}>
                    <span style={{ color: COLORS.textDim }}>Q: </span>{w.question_text}
                  </p>
                  <p style={{ margin: 0 }}>
                    <span style={{ color: COLORS.textDim }}>A: </span>
                    <span style={{ color: COLORS.gold }}>{w.correct_answer}</span>
                    {w.extraction_note && (
                      <span style={{ color: COLORS.textDim }}> — {w.extraction_note}</span>
                    )}
                  </p>
                  {w.hint_text && (
                    <p style={{ margin: 0 }}>
                      <span style={{ color: COLORS.textDim }}>Hint: </span>{w.hint_text}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Campaign details — created automatically alongside the pack */}
        <div style={{ borderRadius: 8, padding: 14, marginBottom: 16, background: COLORS.panel, border: `1px solid ${COLORS.border}` }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: COLORS.textDim, margin: '0 0 12px' }}>
            Campaign details
          </p>

          <label style={{ display: 'block', fontSize: 11, color: COLORS.textDim, marginBottom: 4 }}>
            Business <span style={{ color: '#F43F5E' }}>*</span>
          </label>
          <select
            value={selectedBusinessId}
            onChange={(e) => setSelectedBusinessId(e.target.value)}
            disabled={businessesLoading}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 6, fontSize: 14,
              background: COLORS.bg, border: `1px solid ${COLORS.border}`,
              color: COLORS.textBright, outline: 'none', marginBottom: 12,
              boxSizing: 'border-box',
            }}
          >
            <option value="" disabled>
              {businessesLoading ? 'Loading businesses…' : 'Select a business…'}
            </option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          <label style={{ display: 'block', fontSize: 11, color: COLORS.textDim, marginBottom: 4 }}>
            Campaign name
          </label>
          <input
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            placeholder={packName || 'Defaults to pack name'}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 6, fontSize: 14,
              background: COLORS.bg, border: `1px solid ${COLORS.border}`,
              color: COLORS.textBright, outline: 'none', marginBottom: 12,
              boxSizing: 'border-box',
            }}
          />

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, color: COLORS.textDim, marginBottom: 4 }}>
                Starts
              </label>
              <input
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 6, fontSize: 14,
                  background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                  color: COLORS.textBright, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, color: COLORS.textDim, marginBottom: 4 }}>
                Ends
              </label>
              <input
                type="date"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 6, fontSize: 14,
                  background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                  color: COLORS.textBright, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <label style={{ display: 'block', fontSize: 11, color: COLORS.textDim, marginBottom: 4 }}>
            Voucher headline
          </label>
          <input
            value={voucherHeadline}
            onChange={(e) => setVoucherHeadline(e.target.value)}
            placeholder={DEFAULT_VOUCHER_HEADLINE}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 6, fontSize: 14,
              background: COLORS.bg, border: `1px solid ${COLORS.border}`,
              color: COLORS.textBright, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Save button */}
        <button
          onClick={saveHunt}
          disabled={!canSave}
          style={{
            width: '100%', padding: 12, borderRadius: 8, fontSize: 14, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: canSave ? COLORS.gold : COLORS.panel,
            color: canSave ? '#080810' : COLORS.textDim,
            border: 'none',
            cursor: canSave ? 'pointer' : 'not-allowed',
          }}
        >
          {saving ? (
            <Spinner size={16} />
          ) : savedInfo ? (
            <CheckIcon size={16} />
          ) : (
            <SaveIcon size={16} />
          )}
          {saving ? 'Saving...' : savedInfo ? 'Hunt Saved' : 'Save Hunt'}
        </button>

        {savedInfo && (
          <div style={{ marginTop: 12, padding: 14, borderRadius: 8, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.35)' }}>
            <p style={{ fontSize: 13, color: COLORS.textBright, fontWeight: 700, margin: '0 0 6px' }}>
              "{savedInfo.packName}" is live — players can find it now.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <a
                href="https://app.mapthemovie.co.uk"
                target="_blank"
                rel="noreferrer"
                style={{ flex: 1, padding: '8px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: COLORS.gold, color: '#080810', border: 'none', cursor: 'pointer', textAlign: 'center' }}
              >
                View on discovery screen &rarr;
              </a>
              <button
                onClick={() => setSavedInfo(null)}
                style={{ padding: '8px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: 'transparent', color: COLORS.textDim, border: `1px solid ${COLORS.border}`, cursor: 'pointer' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
