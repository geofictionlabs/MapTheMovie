// src/components/CommandCenter.jsx
//
// Owner-only hunt builder. Drop waypoints on the map, generate trivia
// via the secure Edge Function, then save to Supabase.
//
// Saves via create_command_center_hunt (SECURITY DEFINER RPC in migration 007).
// That RPC checks is_platform_admin() server-side and inserts:
//   puzzle_packs -> puzzles -> trivia_variables
// atomically. Direct table writes are not used.
//
// After saving, create a campaign in Supabase manually to make the hunt
// visible in the player app (get_active_hunts requires an active campaign).

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, X, RefreshCw, Trash2, Save, Check, Loader2, Shield } from 'lucide-react';
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

const DEFAULT_CENTER = [51.3858, 0.5483]; // Gillingham, Kent
const DEFAULT_ZOOM = 15;

// The 4th decimal digit of |lat| is the slot the AI question must target.
// 4th decimal of latitude ~= 11 m precision — enough ambiguity to be a puzzle.
function extractCoordinateDigit(lat) {
  const s = Math.abs(lat).toFixed(4);
  return parseInt(s[s.length - 1], 10);
}

// Replace the 4th decimal of |lat| with the slot letter 'A'.
// e.g. 51.3858 -> "51.385A", -34.1234 -> "-34.123A"
function buildMaskedLat(lat) {
  const sign = lat < 0 ? '-' : '';
  const s = Math.abs(lat).toFixed(4);
  return sign + s.slice(0, -1) + 'A';
}

export default function CommandCenter() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef({});

  const [adminChecked, setAdminChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [selectedTier, setSelectedTier] = useState('classic');
  const [waypoints, setWaypoints] = useState([]);
  const [pendingPin, setPendingPin] = useState(null);
  const [pendingName, setPendingName] = useState('');
  const [packName, setPackName] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);

  // Admin gate. Real enforcement is server-side in the RPC and Edge Function.
  useEffect(() => {
    async function checkAdmin() {
      const { data, error } = await supabase.rpc('is_platform_admin');
      setIsAdmin(!error && data === true);
      setAdminChecked(true);
    }
    checkAdmin();
  }, []);

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
    const masked_lat = buildMaskedLat(pendingPin.lat);
    const masked_lon = pendingPin.lng.toFixed(4);

    const waypoint = {
      id,
      lat: pendingPin.lat,
      lng: pendingPin.lng,
      tier: selectedTier,
      name: pendingName.trim(),
      required_digit,
      masked_lat,
      masked_lon,
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
      const result = await generateTriviaQuestion(name, tier, required_digit);
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
    if (!packName.trim() || waypoints.length === 0) return;
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
        masked_lat:       w.masked_lat,
        masked_lon:       w.masked_lon,
        movie_title:      w.movie_title,
        movie_year:       w.movie_year,
        movie_emoji:      w.movie_emoji,
        question_text:    w.question_text,
        correct_answer:   w.correct_answer,
        coordinate_digit: w.coordinate_digit,
        extraction_note:  w.extraction_note,
        hint_text:        w.hint_text,
      }));

      const { error } = await supabase.rpc('create_command_center_hunt', {
        p_pack_name: packName.trim(),
        p_waypoints: payload,
      });
      if (error) throw error;

      setSavedBanner(true);
      setPackName('');
      setWaypoints([]);
      setTimeout(() => setSavedBanner(false), 3000);
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
    !saving &&
    waypoints.every((w) => !w.loading && !w.error && w.coordinate_digit !== null);

  // ── Loading / auth states ──────────────────────────────────────────────

  if (!adminChecked) {
    return (
      <div style={{ background: COLORS.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: COLORS.textDim }} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ background: COLORS.bg, minHeight: '100vh', color: COLORS.textBright, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 24px', textAlign: 'center' }}>
        <Shield size={28} style={{ color: COLORS.textDim }} />
        <p style={{ color: COLORS.textDim, fontSize: 14, margin: 0 }}>
          This area is restricted to GeoFiction Labs owners.
        </p>
      </div>
    );
  }

  // ── Main UI ────────────────────────────────────────────────────────────

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', color: COLORS.textBright, width: '100%' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Shield size={20} style={{ color: COLORS.gold }} />
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
                    <X size={16} />
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
                    {w.masked_lat} / {w.masked_lon} &middot; {TIERS[w.tier].label}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={() => regenerate(w.id)}
                    title="Regenerate trivia"
                    style={{ padding: 6, borderRadius: 4, background: COLORS.bg, border: `1px solid ${COLORS.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <RefreshCw size={13} style={{ color: COLORS.textDim }} />
                  </button>
                  <button
                    onClick={() => removeWaypoint(w.id)}
                    title="Remove waypoint"
                    style={{ padding: 6, borderRadius: 4, background: COLORS.bg, border: `1px solid ${COLORS.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <Trash2 size={13} style={{ color: '#F43F5E' }} />
                  </button>
                </div>
              </div>

              {/* States */}
              {w.loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12, color: COLORS.textDim }}>
                  <Loader2 size={13} className="animate-spin" />
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
            <Loader2 size={16} className="animate-spin" />
          ) : savedBanner ? (
            <Check size={16} />
          ) : (
            <Save size={16} />
          )}
          {saving ? 'Saving...' : savedBanner ? 'Hunt Saved' : 'Save Hunt'}
        </button>

        {savedBanner && (
          <p style={{ fontSize: 12, color: COLORS.textDim, textAlign: 'center', marginTop: 8 }}>
            Pack saved to database. Create a campaign in Supabase to make it live for players.
          </p>
        )}
      </div>
    </div>
  );
}
