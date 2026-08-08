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
function ArchiveIcon({ size = 16, style: s }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" /><line x1="10" y1="13" x2="14" y2="13" />
    </svg>
  );
}
function AlertIcon({ size = 16, style: s }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <path d="M12 9v4" /><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><circle cx="12" cy="17" r="0.5" fill="currentColor" />
    </svg>
  );
}
import { supabase } from '../lib/supabase';
import { generateTriviaQuestion } from '../lib/triviaApi';
import { VENUE_CATEGORIES } from '../lib/venueCategories';
import { DIFFICULTY_COLORS } from '../lib/theme';

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
  casual: { label: 'Casual', color: DIFFICULTY_COLORS.casual.color },
  classic: { label: 'Classic', color: DIFFICULTY_COLORS.classic.color },
  expert: { label: 'Expert', color: DIFFICULTY_COLORS.expert.color },
  cipher: { label: 'Cipher', color: DIFFICULTY_COLORS.cipher.color },
};

// trivia_pool.difficulty (and trivia_variables.difficulty, which it's
// copied from) is capped at 3 -- CHECK (difficulty BETWEEN 1 AND 3).
// There's no question-level "4", only a puzzle-level one.
// create_command_center_hunt applies the same LEAST(tier_int, 3) cap
// when it promotes a question -- sending the raw 1-4 tier value to
// get_pooled_question would silently never match anything for
// Cipher-tier waypoints.
const TIER_TO_INT = { casual: 1, classic: 2, expert: 3, cipher: 4 };

// Same 11 keys as HuntSelectionScreen.jsx's THEMES / App.jsx's GENRE_KEYWORDS.
// Authored here going forward instead of guessed client-side from pack text.
// evergreen_80s dropped 2026-07-12 (zero live packs used it); fantasy/drama/
// mystery/family added.
const GENRES = [
  { key: 'general', label: 'General' },
  { key: 'horror', label: 'Horror' },
  { key: 'scifi', label: 'Sci-Fi' },
  { key: 'action', label: 'Action' },
  { key: 'romance', label: 'Romance' },
  { key: 'comedy', label: 'Comedy' },
  { key: 'thriller', label: 'Thriller' },
  { key: 'fantasy', label: 'Fantasy' },
  { key: 'drama', label: 'Drama' },
  { key: 'mystery', label: 'Mystery' },
  { key: 'family', label: 'Family' },
];

const DEFAULT_VOUCHER_HEADLINE = 'Show this screen to claim your reward';

const STATUS_COLORS = {
  active: '#10B981',
  draft: '#8B8B9A',
  paused: '#F59E0B',
  ended: '#8B8B9A',
  removed: '#F43F5E',
  flagged: '#F43F5E',
};

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

// Manage Hunts — lists every campaign via get_all_hunts_admin() (migration
// 018; campaigns' own campaigns_select_active policy only exposes active
// rows, useless for an admin list) with Strike/Archive/Remove actions.
// Each action needs one explicit confirm step before it fires -- `confirming`
// holds "<campaignId>:<action>" for whichever row/action is mid-confirm.
function ManageHuntsTab() {
  const [hunts, setHunts] = useState(null); // null = still loading
  const [loadError, setLoadError] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    loadHunts();
  }, []);

  async function loadHunts() {
    setLoadError(null);
    const { data, error } = await supabase.rpc('get_all_hunts_admin');
    if (error) {
      setLoadError(error.message);
      setHunts([]);
      return;
    }
    setHunts(data || []);
  }

  async function runAction(campaignId, action) {
    setBusyId(campaignId);
    try {
      if (action === 'strike') {
        const { data, error } = await supabase.rpc('issue_strike', { p_campaign_id: campaignId });
        if (error) throw error;
        const result = Array.isArray(data) ? data[0] : data;
        setHunts((prev) => prev.map((h) => h.campaign_id !== campaignId ? h : {
          ...h,
          strike_count: result?.strike_count ?? h.strike_count + 1,
          status: result?.status ?? h.status,
        }));
      } else if (action === 'archive') {
        const { error } = await supabase.rpc('archive_hunt', { p_campaign_id: campaignId });
        if (error) throw error;
        setHunts((prev) => prev.filter((h) => h.campaign_id !== campaignId));
      } else if (action === 'remove') {
        const { error } = await supabase.rpc('remove_hunt', { p_campaign_id: campaignId });
        if (error) throw error;
        setHunts((prev) => prev.filter((h) => h.campaign_id !== campaignId));
      }
    } catch (err) {
      console.error(action + ' failed:', err);
      alert('Action failed — ' + (err?.message || 'see console'));
    } finally {
      setBusyId(null);
      setConfirming(null);
    }
  }

  if (hunts === null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
        <Spinner size={20} style={{ color: COLORS.textDim }} />
      </div>
    );
  }

  return (
    <div>
      {loadError && (
        <p style={{ color: '#F43F5E', fontSize: 12, marginBottom: 12 }}>
          Failed to load hunts — {loadError}
        </p>
      )}
      {hunts.length === 0 && !loadError && (
        <p style={{ color: COLORS.textDim, fontSize: 12, textAlign: 'center', padding: '24px 0', margin: 0 }}>
          No hunts yet.
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {hunts.map((h) => {
          const statusColor = STATUS_COLORS[h.status] || COLORS.textDim;
          const isBusy = busyId === h.campaign_id;
          const confirmingHere = confirming === `${h.campaign_id}:strike` ? 'strike'
            : confirming === `${h.campaign_id}:archive` ? 'archive'
            : confirming === `${h.campaign_id}:remove` ? 'remove'
            : null;

          return (
            <div
              key={h.campaign_id}
              style={{ borderRadius: 8, padding: 12, background: COLORS.panel, border: `1px solid ${COLORS.border}` }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textBright }}>{h.campaign_name}</div>
                  <p style={{ fontSize: 11, color: COLORS.textDim, margin: '2px 0 0' }}>
                    {h.pack_name} &middot; {h.business_name || 'No business'}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
                    color: statusColor, border: `1px solid ${statusColor}`, borderRadius: 20, padding: '2px 8px',
                  }}>
                    {h.status}
                  </span>
                  {h.strike_count > 0 && (
                    <span style={{ fontSize: 10, color: '#F43F5E' }}>
                      {h.strike_count} strike{h.strike_count === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
              </div>

              {confirmingHere ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: COLORS.textBright, flex: 1 }}>
                    {confirmingHere === 'strike' && 'Issue strike?'}
                    {confirmingHere === 'archive' && 'Archive this hunt?'}
                    {confirmingHere === 'remove' && 'Remove this hunt?'}
                  </span>
                  <button
                    disabled={isBusy}
                    onClick={() => runAction(h.campaign_id, confirmingHere)}
                    style={{ display: 'flex', alignItems: 'center', padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: COLORS.purple, color: '#fff', border: 'none', cursor: isBusy ? 'not-allowed' : 'pointer' }}
                  >
                    {isBusy ? <Spinner size={12} /> : 'Yes'}
                  </button>
                  <button
                    disabled={isBusy}
                    onClick={() => setConfirming(null)}
                    style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: 'transparent', color: COLORS.textDim, border: `1px solid ${COLORS.border}`, cursor: 'pointer' }}
                  >
                    No
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setConfirming(`${h.campaign_id}:strike`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'transparent', border: `1px solid ${COLORS.purple}`, color: COLORS.purple, cursor: 'pointer' }}
                  >
                    <AlertIcon size={12} /> Strike
                  </button>
                  {/* Archive: muted gold/amber, distinct from Remove's red — archive is reversible (status -> 'ended'), remove is not treated as reversible in the UI even though it's also just a status change. */}
                  <button
                    onClick={() => setConfirming(`${h.campaign_id}:archive`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'transparent', border: '1px solid #B8860B', color: '#D4A72C', cursor: 'pointer' }}
                  >
                    <ArchiveIcon size={12} /> Archive
                  </button>
                  <button
                    onClick={() => setConfirming(`${h.campaign_id}:remove`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'transparent', border: '1px solid #F43F5E', color: '#F43F5E', cursor: 'pointer' }}
                  >
                    <TrashIcon size={12} /> Remove
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Deliberately brighter/more saturated palette than the file's own COLORS --
// per instruction, the existing tokens are too dim for this tab. Hardcoded
// hex only, same house rule as COLORS above -- never a CSS var.
const POOL_COLORS = {
  bg: '#0B0B14',
  panel: '#121218',
  card: '#15151F',
  border: '#2A2A3E',
  divider: '#1F1F2E',
  text: '#F1F0FF',
  muted: '#A8A5C0',
  dimmer: '#8B8B9A',
  purple: '#7C3AED',
  gold: '#F59E0B',
  green: '#5DCAA5',
  red: '#F09595',
  tier: { casual: '#10B981', classic: '#7C3AED', expert: '#F59E0B', cipher: '#EF4444' },
};

// Question Pool — bulk trivia generation review UI. Calls
// generate-trivia-question in mode=batch (candidates only, nothing saved
// yet), lets an admin manually approve/reject each survivor, then promotes
// approved ones via promote_bulk_question_to_pool (migration 061). Coverage
// (get_pool_coverage, migration 062) is read-only display -- trivia_pool
// itself has RLS with zero policies, so this is the only way the client can
// see pool state at all.
function QuestionPoolTab() {
  const [selectedGenre, setSelectedGenre] = useState(GENRES[0].key);
  const [selectedTier, setSelectedTier] = useState('casual');
  const [count, setCount] = useState(10);

  const [generating, setGenerating] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [generationError, setGenerationError] = useState(null);

  // Each survivor gets a client-only _id (nothing is saved until Approve)
  // and a local status: 'pending' | 'approved' | 'rejected'. 'rejected'
  // here is a MANUAL admin decision, distinct from the `rejected` array
  // below, which is the Edge Function's own automated gate rejections --
  // those never became candidates at all.
  const [survivors, setSurvivors] = useState([]);
  const [rejected, setRejected] = useState([]);
  const [rejectedExpanded, setRejectedExpanded] = useState(false);

  // Films the model itself declined via the "skipped" array in its response,
  // rather than ones our gates threw out. Diagnostic only -- nothing is
  // promoted from here and nothing reads it. Casual is the only tier whose
  // prompt asks for this, so it stays empty elsewhere by design.
  const [skipped, setSkipped] = useState([]);
  const [skippedExpanded, setSkippedExpanded] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const [coverage, setCoverage] = useState({ covered_digits: [], row_count: 0 });

  // trivia_pool.difficulty is capped at 3 (see TIER_TO_INT comment above) --
  // same LEAST(tier_int, 3) discipline already used for get_pooled_question
  // and create_command_center_hunt, applied here too. promote_bulk_question_
  // to_pool (migration 061) does NOT cap this itself -- it inserts whatever
  // p_difficulty it's given -- so a Cipher question promoted uncapped here
  // would be banked at difficulty 4 and then never surface, since
  // get_pooled_question is always called with min(tier, 3). The cap has to
  // be applied client-side, at both call sites that send a difficulty
  // (here and get_pool_coverage below), same fallback (|| 2) as
  // fetchQuestionFor uses for an unrecognised tier.
  const difficulty = Math.min(TIER_TO_INT[selectedTier] || 2, 3);

  async function refreshCoverage(genre, tier) {
    const diff = Math.min(TIER_TO_INT[tier] || 2, 3);
    const { data, error } = await supabase
      .rpc('get_pool_coverage', { p_genre: genre, p_difficulty: diff })
      .single();
    if (!error && data) {
      setCoverage({ covered_digits: data.covered_digits || [], row_count: data.row_count || 0 });
    }
  }

  useEffect(() => {
    refreshCoverage(selectedGenre, selectedTier);
  }, [selectedGenre, selectedTier]);

  // Honest progress, not a bare spinner -- batch generation runs each
  // candidate through two separate verification API calls on top of
  // generation itself, so 30-60s for a batch of 10 is normal, not stuck.
  useEffect(() => {
    if (!generating) return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [generating]);

  async function handleGenerate() {
    setGenerating(true);
    setGenerationError(null);
    setSurvivors([]);
    setRejected([]);
    setSkipped([]);
    try {
      // Derived from the coverage panel's own data -- already fetched,
      // already visible on screen -- so this needs no separate control or
      // manual selection. Soft preference only on the Edge Function side
      // (see buildBatchPrompt's own comment there): passing every missing
      // digit automatically is safe precisely because nothing ever
      // enforces it.
      const preferredDigits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(
        (d) => !coverage.covered_digits.includes(d)
      );

      const { data, error } = await supabase.functions.invoke('generate-trivia-question', {
        body: { mode: 'batch', genre: selectedGenre, tier: selectedTier, count, preferred_digits: preferredDigits },
      });

      if (error) {
        // Same extraction discipline as triviaApi.js's generateTriviaQuestion
        // -- FunctionsHttpError's own .message is a fixed generic string,
        // the real reason lives in the response body via error.context.
        // body.error is ALWAYS truthy on the Edge Function's 502 (it's the
        // fixed "Batch generation failed after N attempts" wrapper text) --
        // an `||` between body.error and body.lastFailureReason would
        // always pick the generic wrapper and silently drop the actual
        // reason. Combine both when present instead.
        let detail = null;
        if (error.context) {
          try {
            const body = await error.context.json();
            if (body?.error && body?.lastFailureReason) {
              detail = `${body.error}: ${body.lastFailureReason}`;
            } else {
              detail = body?.error || body?.lastFailureReason;
            }
          } catch {
            // No usable JSON body -- confirmed against @supabase/functions-js's
            // own source (FunctionsClient.js) rather than assumed: this is a
            // FunctionsHttpError (error.context exists, so a real HTTP
            // response came back) whose body isn't valid JSON. The known
            // cause is a large batch running long enough to hit Supabase's
            // wall-clock limit and getting killed mid-response -- but this
            // can't be distinguished with certainty from any other cause of
            // a non-JSON error body, hence "may have".
            detail = 'Generation may have timed out (large batches can exceed Supabase\'s function time limit) -- try a smaller batch.';
          }
        } else {
          // error.context is undefined here -- per functions-js's own
          // invoke(): only FunctionsHttpError/FunctionsRelayError get a
          // .context at all; this is a FunctionsFetchError, meaning the
          // request never got a response back (the connection dropped)
          // rather than getting a real non-2xx response. This is what a
          // platform-level kill looks like when it happens before the
          // function can send anything back at all, distinct from the
          // case above where a response did come back.
          detail = 'Generation may have timed out or lost connection -- try a smaller batch.';
        }
        setGenerationError(detail || error.message || 'Batch generation failed');
        return;
      }
      if (data?.error) {
        setGenerationError(data.error);
        return;
      }

      setSurvivors((data.survivors || []).map((s) => ({ ...s, _id: crypto.randomUUID(), status: 'pending', approving: false, approveError: null })));
      setRejected(data.rejected || []);
      setSkipped(data.skipped || []);
    } finally {
      setGenerating(false);
    }
  }

  async function approveOne(card) {
    setSurvivors((prev) => prev.map((s) => (s._id === card._id ? { ...s, approving: true, approveError: null } : s)));

    const { error } = await supabase.rpc('promote_bulk_question_to_pool', {
      p_movie_title: card.movie_title,
      p_movie_year: card.movie_year,
      p_movie_emoji: card.movie_emoji,
      p_question_text: card.question_text,
      p_hint_text: card.hint_text,
      p_correct_answer: card.correct_answer,
      p_extraction_note: card.extraction_note,
      p_genre: selectedGenre,
      p_difficulty: difficulty,
      // Eleventh parameter, added migration 072. Defaulted NULL server-side,
      // but sent explicitly so an unclassified candidate stores NULL rather
      // than relying on the default. A value outside the eleven allowed
      // shapes is NOT filtered here on purpose -- the CHECK constraint
      // rejects the whole insert and the error surfaces on the card below,
      // which is the behaviour we want: visible, not silently dropped.
      p_fact_shape: card.fact_shape ?? null,
    });

    setSurvivors((prev) => prev.map((s) => (
      s._id === card._id
        ? { ...s, approving: false, status: error ? 'pending' : 'approved', approveError: error ? error.message : null }
        : s
    )));

    if (!error) refreshCoverage(selectedGenre, selectedTier);
  }

  function rejectOne(card) {
    setSurvivors((prev) => prev.map((s) => (s._id === card._id ? { ...s, status: 'rejected' } : s)));
  }

  async function approveAll() {
    setBulkBusy(true);
    // Best-effort, sequential -- a failed card keeps its 'pending' status
    // (see approveOne) and its own approveError, rather than one failure
    // aborting the rest of the batch.
    for (const card of survivors.filter((s) => s.status === 'pending')) {
      await approveOne(card);
    }
    setBulkBusy(false);
  }

  function rejectAll() {
    setSurvivors((prev) => prev.map((s) => (s.status === 'pending' ? { ...s, status: 'rejected' } : s)));
  }

  const pendingCount = survivors.filter((s) => s.status === 'pending').length;
  const approvedCount = survivors.filter((s) => s.status === 'approved').length;
  const rejectedCount = survivors.filter((s) => s.status === 'rejected').length;

  return (
    <div style={{ background: POOL_COLORS.bg, borderRadius: 8, padding: 20 }}>
      {/* Coverage panel */}
      <div style={{ background: POOL_COLORS.panel, border: `1px solid ${POOL_COLORS.border}`, borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
            const covered = coverage.covered_digits.includes(d);
            return (
              <div
                key={d}
                style={{
                  width: 32, height: 32, borderRadius: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, fontFamily: 'monospace',
                  background: covered ? '#1D9E75' : '#2A1518',
                  color: covered ? '#04342C' : '#F09595',
                  border: covered ? 'none' : '1px solid #E24B4A',
                  boxSizing: 'border-box',
                }}
              >
                {d}
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 12, color: POOL_COLORS.muted }}>
          {coverage.covered_digits.length} of 10 digits covered · {coverage.row_count} question{coverage.row_count === 1 ? '' : 's'} in pool
        </div>
        {selectedTier === 'casual' && (
          // Casual-only -- without this, the red squares above invite
          // exactly the forcing behaviour buildCasualBatchPrompt exists
          // to prevent. Genuine "known for" facts are capped by what
          // real famous film-numbers exist, not by how much you
          // generate -- a gap here can be permanent, and repeatedly
          // regenerating to chase it just reproduces the mislabeling
          // this whole pass was fixing.
          <div style={{ fontSize: 12, color: POOL_COLORS.muted, marginTop: 6 }}>
            Casual coverage is capped by real-world scarcity, not by generation effort — some digits may never fill.
          </div>
        )}
      </div>

      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <select
          value={selectedGenre}
          onChange={(e) => setSelectedGenre(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: 6, fontSize: 13,
            background: POOL_COLORS.panel, border: `1px solid ${POOL_COLORS.border}`,
            color: POOL_COLORS.text, outline: 'none',
          }}
        >
          {GENRES.map((g) => (
            <option key={g.key} value={g.key}>{g.label}</option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 8 }}>
          {['casual', 'classic', 'expert', 'cipher'].map((t) => (
            <button
              key={t}
              onClick={() => setSelectedTier(t)}
              style={{
                padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                textTransform: 'capitalize', cursor: 'pointer',
                background: selectedTier === t ? POOL_COLORS.tier[t] : 'transparent',
                color: selectedTier === t ? '#0B0B14' : POOL_COLORS.tier[t],
                border: `1px solid ${POOL_COLORS.tier[t]}`,
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <input
          type="number"
          min={1}
          max={20}
          value={count}
          onChange={(e) => setCount(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 10)))}
          style={{
            width: 64, padding: '8px 10px', borderRadius: 6, fontSize: 13,
            background: POOL_COLORS.panel, border: `1px solid ${POOL_COLORS.border}`,
            color: POOL_COLORS.text, outline: 'none',
          }}
        />

        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 700,
            background: POOL_COLORS.purple, color: '#F1F0FF', border: 'none',
            cursor: generating ? 'default' : 'pointer', opacity: generating ? 0.7 : 1,
          }}
        >
          {generating && <Spinner size={14} />}
          {generating ? 'Generating…' : 'Generate batch'}
        </button>
      </div>

      {generating && (
        <div style={{ fontSize: 12, color: POOL_COLORS.muted, marginBottom: 20 }}>
          {elapsed}s elapsed — each candidate needs two independent verification passes on top of generation itself, this can take 30-60s.
        </div>
      )}

      {generationError && (
        <div style={{
          padding: 12, borderRadius: 6, marginBottom: 20,
          background: '#2A1518', border: '1px solid #E24B4A', color: POOL_COLORS.red, fontSize: 13,
        }}>
          {generationError}
        </div>
      )}

      {survivors.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button
            onClick={approveAll}
            disabled={bulkBusy || pendingCount === 0}
            style={{
              padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: pendingCount === 0 ? 'default' : 'pointer',
              background: POOL_COLORS.green, color: '#04342C', border: 'none', opacity: pendingCount === 0 ? 0.5 : 1,
            }}
          >
            Approve all
          </button>
          <button
            onClick={rejectAll}
            disabled={bulkBusy || pendingCount === 0}
            style={{
              padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: pendingCount === 0 ? 'default' : 'pointer',
              background: 'transparent', color: POOL_COLORS.red, border: `1px solid ${POOL_COLORS.red}`, opacity: pendingCount === 0 ? 0.5 : 1,
            }}
          >
            Reject all
          </button>
          <span style={{ fontSize: 12, color: POOL_COLORS.muted }}>
            {pendingCount} pending · {approvedCount} approved · {rejectedCount} rejected
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {survivors.map((card) => {
          const dimmed = card.status === 'approved' || card.status === 'rejected';
          const gapDigits = (card.available_digits || []).filter((d) => !coverage.covered_digits.includes(d));

          return (
            <div
              key={card._id}
              style={{
                display: 'flex', gap: 16, padding: 16, borderRadius: 8,
                background: POOL_COLORS.card, border: `1px solid ${POOL_COLORS.border}`,
                opacity: dimmed ? 0.55 : 1,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ color: POOL_COLORS.gold, fontWeight: 700, fontSize: 14 }}>{card.movie_title}</span>
                  {card.movie_year != null && (
                    <span style={{ color: '#8B8B9A', fontSize: 12 }}>{card.movie_year}</span>
                  )}
                  {card.fact_shape && (
                    <span style={{
                      background: '#26215C', color: '#CECBF6', fontSize: 11, fontWeight: 600,
                      padding: '2px 8px', borderRadius: 999,
                    }}>
                      {card.fact_shape}
                    </span>
                  )}
                </div>

                <div style={{ fontSize: 15, color: '#F1F0FF', lineHeight: 1.5, marginBottom: 10 }}>
                  {card.question_text}
                </div>

                <div style={{ fontSize: 13, marginBottom: 10 }}>
                  <span style={{ color: POOL_COLORS.muted }}>Answer </span>
                  <span style={{ color: POOL_COLORS.gold, fontFamily: 'monospace', fontWeight: 700 }}>{card.correct_answer}</span>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                  {(card.available_digits || []).map((d) => (
                    <span
                      key={d}
                      style={{
                        width: 24, height: 24, borderRadius: 999, background: '#26215C', color: '#CECBF6',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
                      }}
                    >
                      {d}
                    </span>
                  ))}
                  {gapDigits.map((d) => (
                    <span
                      key={`gap-${d}`}
                      style={{
                        background: '#0F2A1F', color: '#5DCAA5', fontSize: 11, fontWeight: 600,
                        padding: '3px 8px', borderRadius: 999,
                      }}
                    >
                      fills digit {d} gap
                    </span>
                  ))}
                </div>

                {card.extraction_note && (
                  <div style={{ fontSize: 12, color: '#8B8B9A' }}>{card.extraction_note}</div>
                )}
                {card.approveError && (
                  <div style={{ fontSize: 12, color: POOL_COLORS.red, marginTop: 6 }}>Approve failed: {card.approveError}</div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center', flexShrink: 0 }}>
                {card.status === 'approved' ? (
                  <span style={{ fontSize: 12, fontWeight: 700, color: POOL_COLORS.green, padding: '8px 14px', textAlign: 'center' }}>
                    Approved
                  </span>
                ) : card.status === 'rejected' ? (
                  <span style={{ fontSize: 12, fontWeight: 700, color: POOL_COLORS.red, padding: '8px 14px', textAlign: 'center' }}>
                    Rejected
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => approveOne(card)}
                      disabled={card.approving}
                      style={{
                        padding: '8px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                        cursor: card.approving ? 'default' : 'pointer',
                        background: POOL_COLORS.green, color: '#04342C', border: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                    >
                      {card.approving ? <Spinner size={12} /> : 'Approve'}
                    </button>
                    <button
                      onClick={() => rejectOne(card)}
                      disabled={card.approving}
                      style={{
                        padding: '8px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        background: 'transparent', color: POOL_COLORS.red, border: `1px solid ${POOL_COLORS.red}`,
                      }}
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {rejected.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <button
            onClick={() => setRejectedExpanded((e) => !e)}
            style={{
              background: 'transparent', border: 'none', color: POOL_COLORS.muted, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {rejectedExpanded ? '▾' : '▸'} Rejected during generation ({rejected.length})
          </button>
          {rejectedExpanded && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rejected.map((r, i) => (
                <div
                  key={i}
                  style={{ padding: 12, borderRadius: 6, background: POOL_COLORS.card, border: `1px solid ${POOL_COLORS.divider}` }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: POOL_COLORS.text, marginBottom: 4 }}>
                    {r.movie_title || 'Unknown'} — <span style={{ fontFamily: 'monospace' }}>{r.correct_answer ?? '?'}</span>
                  </div>
                  {r.question_text && (
                    <div style={{ fontSize: 13, color: POOL_COLORS.dimmer, marginBottom: 6 }}>{r.question_text}</div>
                  )}
                  <div style={{ fontSize: 12, color: POOL_COLORS.red }}>{r.rejection_reason}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Films the model declined itself, via the "skipped" array in its
          response. Deliberately styled differently from the rejected list
          above: those are failures, these are the model working correctly.
          Muted rather than red, and worded "Declined by the model" so the
          two are never read as the same thing. */}
      {skipped.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => setSkippedExpanded((e) => !e)}
            style={{
              background: 'transparent', border: 'none', color: POOL_COLORS.muted, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {skippedExpanded ? '▾' : '▸'} Declined by the model ({skipped.length})
          </button>
          {skippedExpanded && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {skipped.map((s, i) => (
                <div
                  key={i}
                  style={{ padding: 12, borderRadius: 6, background: POOL_COLORS.card, border: `1px solid ${POOL_COLORS.divider}` }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: POOL_COLORS.text, marginBottom: 4 }}>
                    {s.movie_title || 'Unknown'}
                  </div>
                  <div style={{ fontSize: 12, color: POOL_COLORS.muted }}>{s.reason}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Human-readable labels for generate-trivia-question mode=classify's
// five fixed concern keys -- kept here rather than derived, so an
// unrecognised key (should never happen, the Edge Function already
// filters to this exact set) falls back to the raw key instead of
// throwing.
const CONCERN_LABELS = {
  ambiguous_input: 'Ambiguous input',
  contested_count: 'Contested count',
  question_answer_mismatch: 'Answer mismatch',
  approximation: 'Approximation',
  unverifiable: 'Unverifiable',
};

// Must not exceed generate-trivia-question's own MAX_CLASSIFY_BATCH (25)
// -- kept as a separate client-side constant rather than importing across
// the Edge Function boundary, same as every other cross-boundary constant
// in this file (e.g. TIER_TO_INT's cap-at-3 duplicated at each call site
// rather than shared).
const CLASSIFY_CHUNK_SIZE = 25;

// Reclassify Pool — blind difficulty classification applied retroactively
// to EXISTING trivia_pool rows (Phase 3 of the trivia quality plan). Reads
// via get_pool_rows_for_review (migration 064), classifies via
// generate-trivia-question mode=classify (question_text-only for tier,
// full context for concerns -- see that function's own header), writes
// approved changes via apply_pool_difficulty (migration 065). Same
// review-card/approve-reject/bulk shell as QuestionPoolTab, but the
// content being reviewed is the pool's EXISTING labels, not freshly
// generated candidates -- separate tab, not a sub-mode of that one.
function ReclassifyPoolTab() {
  const [selectedGenre, setSelectedGenre] = useState(GENRES[0].key);

  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [loadError, setLoadError] = useState(null);
  const [progress, setProgress] = useState(null); // { done, total } chunks, while classifying

  // Each row: { id, movie_title, question_text, correct_answer,
  // extraction_note, current_difficulty, proposed_tier, proposed_difficulty,
  // concerns, disputed_at, dispute_reason, status: 'pending' | 'approved' |
  // 'rejected', approving, approveError }. disputed_at/dispute_reason come
  // straight from get_pool_rows_for_review (migration 067) -- set either by
  // generate-trivia-question's forward-looking Call C during a fresh batch,
  // or by a prior "Audit for contradictions" run. Populated once per Load &
  // Classify run -- reloading replaces this wholesale rather than merging,
  // so a stale card from a previous run never lingers.
  const [rows, setRows] = useState([]);
  // Rows the classifier itself could not return a valid entry for --
  // { id, movie_title, question_text, reason } -- shown separately,
  // mirroring QuestionPoolTab's `rejected` collapsible, never silently
  // dropped.
  const [failedRows, setFailedRows] = useState([]);
  const [failedExpanded, setFailedExpanded] = useState(false);
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const [auditing, setAuditing] = useState(false);
  const [auditError, setAuditError] = useState(null);
  const [auditSummary, setAuditSummary] = useState(null); // { films_checked, conflicts_found, rows_flagged, errors }

  useEffect(() => {
    if (!loading) return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [loading]);

  async function handleLoadAndClassify() {
    setLoading(true);
    setLoadError(null);
    setProgress(null);
    setRows([]);
    setFailedRows([]);
    setShowUnchanged(false);

    try {
      const { data: poolRows, error: poolError } = await supabase.rpc('get_pool_rows_for_review', {
        p_genre: selectedGenre,
      });
      if (poolError) {
        setLoadError(poolError.message || 'Could not load pool rows');
        return;
      }
      if (!poolRows || poolRows.length === 0) {
        setLoadError('No difficulty 1-3 rows in this genre\'s pool yet.');
        return;
      }

      const chunks = [];
      for (let i = 0; i < poolRows.length; i += CLASSIFY_CHUNK_SIZE) {
        chunks.push(poolRows.slice(i, i + CLASSIFY_CHUNK_SIZE));
      }
      setProgress({ done: 0, total: chunks.length });

      const byId = new Map(poolRows.map((r) => [r.id, r]));
      const classifiedIds = new Set();
      const failed = [];

      // Sequential, not concurrent -- same reasoning as approveAll below:
      // predictable progress reporting, and doesn't fire several batches'
      // worth of Anthropic calls at Supabase simultaneously.
      for (const chunk of chunks) {
        const { data, error } = await supabase.functions.invoke('generate-trivia-question', {
          body: {
            mode: 'classify',
            questions: chunk.map((r) => ({
              id: r.id,
              question_text: r.question_text,
              correct_answer: r.correct_answer,
              extraction_note: r.extraction_note,
            })),
          },
        });

        if (error) {
          let detail = error.message || 'Classification request failed';
          if (error.context) {
            try {
              const body = await error.context.json();
              detail = body?.error || detail;
            } catch { /* no usable JSON body -- keep the generic message */ }
          }
          for (const r of chunk) failed.push({ id: r.id, movie_title: r.movie_title, question_text: r.question_text, reason: detail });
          setProgress((p) => ({ ...p, done: p.done + 1 }));
          continue;
        }
        if (data?.error) {
          for (const r of chunk) failed.push({ id: r.id, movie_title: r.movie_title, question_text: r.question_text, reason: data.error });
          setProgress((p) => ({ ...p, done: p.done + 1 }));
          continue;
        }

        for (const c of (data.classifications || [])) {
          const source = byId.get(c.id);
          if (!source) continue; // defensive -- shouldn't happen, id echoed back doesn't match anything sent
          classifiedIds.add(c.id);
          source._proposed_tier = c.proposed_tier;
          source._concerns = c.concerns || [];
        }
        for (const f of (data.failed || [])) {
          const source = f.id ? byId.get(f.id) : null;
          failed.push({ id: f.id, movie_title: source?.movie_title, question_text: source?.question_text, reason: f.reason });
        }
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }

      const classifiedRows = poolRows
        .filter((r) => classifiedIds.has(r.id))
        .map((r) => ({
          id: r.id,
          movie_title: r.movie_title,
          question_text: r.question_text,
          correct_answer: r.correct_answer,
          extraction_note: r.extraction_note,
          current_difficulty: r.difficulty,
          proposed_tier: r._proposed_tier,
          proposed_difficulty: TIER_TO_INT[r._proposed_tier],
          concerns: r._concerns,
          disputed_at: r.disputed_at,
          dispute_reason: r.dispute_reason,
          status: 'pending',
          approving: false,
          approveError: null,
        }));

      setRows(classifiedRows);
      setFailedRows(failed);
    } finally {
      setLoading(false);
    }
  }

  async function approveOne(row) {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, approving: true, approveError: null } : r)));

    const { data, error } = await supabase.rpc('apply_pool_difficulty', {
      p_id: row.id,
      p_new_difficulty: row.proposed_difficulty,
    });
    const rpcError = error || (data && data.success === false ? { message: data.error } : null);

    setRows((prev) => prev.map((r) => (
      r.id === row.id
        ? { ...r, approving: false, status: rpcError ? 'pending' : 'approved', approveError: rpcError ? rpcError.message : null }
        : r
    )));
  }

  function rejectOne(row) {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: 'rejected' } : r)));
  }

  // Bulk actions operate on whatever is currently VISIBLE (respecting
  // showUnchanged) and pending -- what-you-see-is-what-you-bulk-act-on,
  // rather than silently also touching rows the admin hasn't chosen to
  // look at yet.
  async function approveAllVisible() {
    setBulkBusy(true);
    for (const row of visibleRows.filter((r) => r.status === 'pending')) {
      await approveOne(row);
    }
    setBulkBusy(false);
  }

  function rejectAllVisible() {
    const visibleIds = new Set(visibleRows.filter((r) => r.status === 'pending').map((r) => r.id));
    setRows((prev) => prev.map((r) => (visibleIds.has(r.id) ? { ...r, status: 'rejected' } : r)));
  }

  // Retroactive contradiction scan (Phase 4b) -- a separate, admin-
  // triggered pass over EXISTING pool rows, distinct from the forward-
  // looking check that runs automatically during fresh generation. Not
  // run automatically here on every Load & Classify: once a genre's pool
  // has been audited and the forward-looking check is catching new
  // contradictions as they'd be introduced, re-scanning unchanged rows
  // every time would just be a repeated cost with nothing new to find.
  // Deliberately does NOT merge results into `rows` -- simplest, most
  // predictable option: show a summary, and the admin re-runs Load &
  // Classify to see the resulting disputed badges, same explicit-action
  // pattern as everything else in this tab.
  async function handleAudit() {
    setAuditing(true);
    setAuditError(null);
    setAuditSummary(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-trivia-question', {
        body: { mode: 'audit', genre: selectedGenre },
      });
      if (error) {
        let detail = error.message || 'Audit request failed';
        if (error.context) {
          try {
            const body = await error.context.json();
            detail = body?.error || detail;
          } catch { /* no usable JSON body -- keep the generic message */ }
        }
        setAuditError(detail);
        return;
      }
      if (data?.error) {
        setAuditError(data.error);
        return;
      }
      setAuditSummary(data);
    } finally {
      setAuditing(false);
    }
  }

  // Change 2: biggest disagreements first, but a disputed row (possibly
  // just WRONG, not merely mis-tiered) outranks even a large tier delta.
  // Then absolute tier delta descending, then concern count descending,
  // then alphabetical (matches get_pool_rows_for_review's own default
  // order) as the final tiebreak.
  const sortedRows = [...rows].sort((a, b) => {
    const disputedA = a.disputed_at ? 1 : 0;
    const disputedB = b.disputed_at ? 1 : 0;
    if (disputedB !== disputedA) return disputedB - disputedA;
    const deltaA = Math.abs(a.proposed_difficulty - a.current_difficulty);
    const deltaB = Math.abs(b.proposed_difficulty - b.current_difficulty);
    if (deltaB !== deltaA) return deltaB - deltaA;
    if (b.concerns.length !== a.concerns.length) return b.concerns.length - a.concerns.length;
    return a.movie_title.localeCompare(b.movie_title);
  });

  // A disputed row is never "unchanged, no concerns" even if the
  // classifier agrees on tier and flags nothing else -- a possible
  // factual error outranks tier agreement regardless.
  const isUnchanged = (r) => !r.disputed_at && r.proposed_difficulty === r.current_difficulty && r.concerns.length === 0;
  const unchangedRows = sortedRows.filter(isUnchanged);
  const flaggedRows = sortedRows.filter((r) => !isUnchanged(r));
  // Change 1: unchanged rows are never hidden entirely -- shown behind a
  // prominent, always-visible count-and-toggle, not a quiet corner
  // control, since a question the classifier AGREES is casual is exactly
  // the kind worth spot-checking (it's the tier that caused the
  // complaint this whole phase exists to fix).
  const visibleRows = showUnchanged ? sortedRows : flaggedRows;

  const pendingCount = visibleRows.filter((r) => r.status === 'pending').length;
  const approvedCount = rows.filter((r) => r.status === 'approved').length;
  const rejectedCount = rows.filter((r) => r.status === 'rejected').length;

  return (
    <div style={{ background: POOL_COLORS.bg, borderRadius: 8, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <select
          value={selectedGenre}
          onChange={(e) => setSelectedGenre(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: 6, fontSize: 13,
            background: POOL_COLORS.panel, border: `1px solid ${POOL_COLORS.border}`,
            color: POOL_COLORS.text, outline: 'none',
          }}
        >
          {GENRES.map((g) => (
            <option key={g.key} value={g.key}>{g.label}</option>
          ))}
        </select>

        <button
          onClick={handleLoadAndClassify}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 700,
            background: POOL_COLORS.purple, color: '#F1F0FF', border: 'none',
            cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1,
          }}
        >
          {loading && <Spinner size={14} />}
          {loading ? 'Loading & classifying…' : 'Load & classify'}
        </button>

        <button
          onClick={handleAudit}
          disabled={auditing}
          title="Retroactive scan of this genre's EXISTING pool rows for same-fact/different-answer contradictions -- separate from the automatic check that runs during fresh generation"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 700,
            background: 'transparent', color: POOL_COLORS.red, border: `1px solid ${POOL_COLORS.red}`,
            cursor: auditing ? 'default' : 'pointer', opacity: auditing ? 0.7 : 1,
          }}
        >
          {auditing && <Spinner size={14} />}
          {auditing ? 'Auditing…' : 'Audit for contradictions'}
        </button>
      </div>

      {loading && (
        <div style={{ fontSize: 12, color: POOL_COLORS.muted, marginBottom: 20 }}>
          {elapsed}s elapsed{progress ? ` — chunk ${Math.min(progress.done + 1, progress.total)} of ${progress.total} (each chunk runs a blind tier pass and a separate full-context concerns pass)` : ' — fetching pool rows…'}
        </div>
      )}

      {auditError && (
        <div style={{
          padding: 12, borderRadius: 6, marginBottom: 20,
          background: '#2A1518', border: '1px solid #E24B4A', color: POOL_COLORS.red, fontSize: 13,
        }}>
          {auditError}
        </div>
      )}

      {auditSummary && (
        <div style={{
          padding: 12, borderRadius: 6, marginBottom: 20,
          background: POOL_COLORS.panel, border: `1px solid ${POOL_COLORS.border}`, color: POOL_COLORS.text, fontSize: 13,
        }}>
          Checked {auditSummary.films_checked} film{auditSummary.films_checked === 1 ? '' : 's'} with 2+ banked facts —{' '}
          {auditSummary.rows_flagged > 0
            ? <span style={{ color: POOL_COLORS.red, fontWeight: 700 }}>{auditSummary.rows_flagged} row{auditSummary.rows_flagged === 1 ? '' : 's'} flagged disputed</span>
            : 'no contradictions found'}
          {auditSummary.rows_flagged > 0 && ' — reload with Load & classify to see them.'}
          {auditSummary.errors?.length > 0 && (
            <div style={{ color: POOL_COLORS.muted, marginTop: 4 }}>
              {auditSummary.errors.length} film{auditSummary.errors.length === 1 ? '' : 's'} could not be checked (verification call failed).
            </div>
          )}
        </div>
      )}

      {loadError && (
        <div style={{
          padding: 12, borderRadius: 6, marginBottom: 20,
          background: '#2A1518', border: '1px solid #E24B4A', color: POOL_COLORS.red, fontSize: 13,
        }}>
          {loadError}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <button
              onClick={approveAllVisible}
              disabled={bulkBusy || pendingCount === 0}
              style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: pendingCount === 0 ? 'default' : 'pointer',
                background: POOL_COLORS.green, color: '#04342C', border: 'none', opacity: pendingCount === 0 ? 0.5 : 1,
              }}
            >
              Approve all visible
            </button>
            <button
              onClick={rejectAllVisible}
              disabled={bulkBusy || pendingCount === 0}
              style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: pendingCount === 0 ? 'default' : 'pointer',
                background: 'transparent', color: POOL_COLORS.red, border: `1px solid ${POOL_COLORS.red}`, opacity: pendingCount === 0 ? 0.5 : 1,
              }}
            >
              Reject all visible
            </button>
            <span style={{ fontSize: 12, color: POOL_COLORS.muted }}>
              {flaggedRows.length} flagged · {approvedCount} approved · {rejectedCount} rejected
            </span>
          </div>

          {unchangedRows.length > 0 && (
            <button
              onClick={() => setShowUnchanged((s) => !s)}
              style={{
                width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 6, marginBottom: 16, cursor: 'pointer',
                background: POOL_COLORS.panel, border: `1px solid ${POOL_COLORS.border}`, color: POOL_COLORS.text,
                fontSize: 13, fontWeight: 600,
              }}
            >
              <span>{unchangedRows.length} unchanged, no concerns {showUnchanged ? '(shown below)' : '— show'}</span>
              <span style={{ color: POOL_COLORS.muted }}>{showUnchanged ? '▾' : '▸'}</span>
            </button>
          )}
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {visibleRows.map((row) => {
          const dimmed = row.status === 'approved' || row.status === 'rejected';
          const changed = row.proposed_difficulty !== row.current_difficulty;
          const currentTierKey = Object.keys(TIER_TO_INT).find((k) => TIER_TO_INT[k] === row.current_difficulty) || 'classic';

          return (
            <div
              key={row.id}
              style={{
                display: 'flex', gap: 16, padding: 16, borderRadius: 8,
                background: POOL_COLORS.card,
                border: `1px solid ${row.disputed_at ? POOL_COLORS.red : changed ? POOL_COLORS.gold : POOL_COLORS.border}`,
                opacity: dimmed ? 0.55 : 1,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ color: POOL_COLORS.gold, fontWeight: 700, fontSize: 14 }}>{row.movie_title}</span>

                  <span style={{
                    fontSize: 11, fontWeight: 700, textTransform: 'capitalize', padding: '2px 8px', borderRadius: 999,
                    color: POOL_COLORS.tier[currentTierKey], border: `1px solid ${POOL_COLORS.tier[currentTierKey]}`,
                  }}>
                    currently {currentTierKey}
                  </span>

                  {changed && <span style={{ color: POOL_COLORS.muted, fontSize: 12 }}>→</span>}

                  {changed && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, textTransform: 'capitalize', padding: '2px 8px', borderRadius: 999,
                      background: POOL_COLORS.tier[row.proposed_tier], color: '#0B0B14',
                    }}>
                      {row.proposed_tier}
                    </span>
                  )}

                  {row.concerns.map((c) => (
                    <span
                      key={c}
                      style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                        background: '#2A1518', color: POOL_COLORS.red, border: `1px solid ${POOL_COLORS.red}`,
                      }}
                    >
                      {CONCERN_LABELS[c] || c}
                    </span>
                  ))}
                </div>

                <div style={{ fontSize: 15, color: '#F1F0FF', lineHeight: 1.5, marginBottom: 10 }}>
                  {row.question_text}
                </div>

                <div style={{ fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: POOL_COLORS.muted }}>Answer </span>
                  <span style={{ color: POOL_COLORS.gold, fontFamily: 'monospace', fontWeight: 700 }}>{row.correct_answer}</span>
                </div>

                {row.disputed_at && (
                  <div style={{
                    padding: '8px 10px', borderRadius: 6, marginBottom: 10,
                    background: '#2A1518', border: `1px solid ${POOL_COLORS.red}`,
                    fontSize: 12, color: POOL_COLORS.red,
                  }}>
                    <strong>DISPUTED</strong> — {row.dispute_reason || 'conflicts with another entry for this film'}
                  </div>
                )}
                {row.extraction_note && (
                  <div style={{ fontSize: 12, color: '#8B8B9A' }}>{row.extraction_note}</div>
                )}
                {row.approveError && (
                  <div style={{ fontSize: 12, color: POOL_COLORS.red, marginTop: 6 }}>Approve failed: {row.approveError}</div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center', flexShrink: 0 }}>
                {row.status === 'approved' ? (
                  <span style={{ fontSize: 12, fontWeight: 700, color: POOL_COLORS.green, padding: '8px 14px', textAlign: 'center' }}>
                    Approved
                  </span>
                ) : row.status === 'rejected' ? (
                  <span style={{ fontSize: 12, fontWeight: 700, color: POOL_COLORS.red, padding: '8px 14px', textAlign: 'center' }}>
                    Rejected
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => approveOne(row)}
                      disabled={row.approving}
                      style={{
                        padding: '8px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                        cursor: row.approving ? 'default' : 'pointer',
                        background: POOL_COLORS.green, color: '#04342C', border: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                    >
                      {row.approving ? <Spinner size={12} /> : (changed ? 'Approve' : 'Keep')}
                    </button>
                    <button
                      onClick={() => rejectOne(row)}
                      disabled={row.approving}
                      style={{
                        padding: '8px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        background: 'transparent', color: POOL_COLORS.red, border: `1px solid ${POOL_COLORS.red}`,
                      }}
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {failedRows.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <button
            onClick={() => setFailedExpanded((e) => !e)}
            style={{
              background: 'transparent', border: 'none', color: POOL_COLORS.muted, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {failedExpanded ? '▾' : '▸'} Could not classify ({failedRows.length})
          </button>
          {failedExpanded && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {failedRows.map((f, i) => (
                <div
                  key={i}
                  style={{ padding: 12, borderRadius: 6, background: POOL_COLORS.card, border: `1px solid ${POOL_COLORS.divider}` }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: POOL_COLORS.text, marginBottom: 4 }}>
                    {f.movie_title || 'Unknown'}
                  </div>
                  {f.question_text && (
                    <div style={{ fontSize: 13, color: POOL_COLORS.dimmer, marginBottom: 6 }}>{f.question_text}</div>
                  )}
                  <div style={{ fontSize: 12, color: POOL_COLORS.red }}>{f.reason}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Location Scout — manual trigger for a single Scout check against one
// subject. Deliberately a raw-JSON diagnostic, not an interpreted result
// view: during this early real-data phase the whole point is seeing
// exactly what the Edge Function recorded, including the detail blob and
// any Postgres/API error text, without a styled layer deciding what
// matters. Interpretation comes later, once there's real data to know
// what's worth surfacing.
//
// supabase.functions.invoke attaches the current admin's session
// automatically -- same mechanism QuestionPoolTab already relies on for
// generate-trivia-question, and what lets the function's own
// platform_admins check pass without anyone hand-extracting a JWT.
//
// Permanent utility, not a one-night scaffold. Both point-based checks
// built so far are already in SCOUT_CHECKS below; what remains is the
// corridor work -- osm_corridor_intersect, covering corridor_segment and
// approach_sweep subjects, which both existing checks currently record as
// 'skipped' rather than pretend to answer. When that lands it is one more
// entry in the list, not a rebuild of this panel.
const SCOUT_CHECKS = [
  { fn: 'location-scout-streetview-check', label: 'Street View metadata' },
  { fn: 'location-scout-osm-hazard-check', label: 'OSM hazard proximity' },
];

function LocationScoutTab() {
  const [subjectId, setSubjectId] = useState('');
  // Which function is in flight, not a bare boolean -- with more than one
  // check sharing this panel the spinner has to say WHICH one is running.
  const [runningFn, setRunningFn] = useState(null);
  const [result, setResult] = useState(null);
  const [errorText, setErrorText] = useState(null);

  async function handleRunCheck(fnName) {
    const id = subjectId.trim();
    if (!id) {
      setErrorText('Enter a subject_id first.');
      setResult(null);
      return;
    }
    setRunningFn(fnName);
    setErrorText(null);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke(fnName, {
        body: { subject_id: id },
      });
      // A non-2xx from the function surfaces here as `error`, but the
      // function's own JSON body (the useful part -- which migration is
      // missing, which status came back) is on error.context. Show both
      // rather than collapsing to a generic message.
      if (error) {
        let body = null;
        try {
          body = await error.context?.json();
        } catch {
          body = null;
        }
        setResult({ invoke_error: error.message, response_body: body });
      } else {
        setResult(data);
      }
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : String(err));
    } finally {
      setRunningFn(null);
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 14, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 4px', color: POOL_COLORS.text }}>
        Location Scout — Run Check
      </h2>
      <p style={{ fontSize: 12, color: POOL_COLORS.muted, margin: '0 0 16px' }}>
        Paste a location_scout_subjects UUID and run a check against it. Raw response only — this is a diagnostic.
      </p>

      <label style={{ display: 'block', fontSize: 11, color: POOL_COLORS.dimmer, marginBottom: 4 }}>
        subject_id
      </label>
      <input
        value={subjectId}
        onChange={(e) => setSubjectId(e.target.value)}
        placeholder="00000000-0000-0000-0000-000000000000"
        spellCheck={false}
        style={{
          width: '100%', padding: '8px 12px', borderRadius: 6, fontSize: 13,
          fontFamily: 'Share Tech Mono, monospace',
          background: POOL_COLORS.panel, border: `1px solid ${POOL_COLORS.border}`,
          color: POOL_COLORS.text, outline: 'none', marginBottom: 12,
          boxSizing: 'border-box',
        }}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {SCOUT_CHECKS.map((c) => {
          const isRunning = runningFn === c.fn;
          const anyRunning = runningFn !== null;
          return (
            <button
              key={c.fn}
              onClick={() => handleRunCheck(c.fn)}
              disabled={anyRunning}
              title={c.fn}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 700,
                background: POOL_COLORS.purple, color: '#F1F0FF', border: 'none',
                cursor: anyRunning ? 'default' : 'pointer', opacity: anyRunning ? 0.7 : 1,
              }}
            >
              {isRunning && <Spinner size={14} />}
              {isRunning ? 'Running…' : `Run Check — ${c.label}`}
            </button>
          );
        })}
      </div>

      {errorText && (
        <div style={{
          padding: 12, borderRadius: 6, marginBottom: 20,
          background: '#2A1518', border: '1px solid #E24B4A', color: POOL_COLORS.red, fontSize: 13,
        }}>
          {errorText}
        </div>
      )}

      {result && (
        <pre style={{
          padding: 12, borderRadius: 6, marginBottom: 20,
          background: POOL_COLORS.panel, border: `1px solid ${POOL_COLORS.border}`,
          color: POOL_COLORS.text, fontSize: 12,
          fontFamily: 'Share Tech Mono, monospace',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          maxHeight: 480, overflowY: 'auto', margin: 0,
        }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function CommandCenter() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef({});

  const [adminChecked, setAdminChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('build'); // 'build' | 'manage'

  const [selectedTier, setSelectedTier] = useState('classic');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [genreError, setGenreError] = useState(false);
  const [waypoints, setWaypoints] = useState([]);
  const [pendingPin, setPendingPin] = useState(null);
  const [pendingName, setPendingName] = useState('');
  const [packName, setPackName] = useState('');
  const [saving, setSaving] = useState(false);
  // { packId, campaignId, packName } of the most recently saved hunt, or null.
  // Stays visible (no auto-hide timer) until dismissed.
  const [savedInfo, setSavedInfo] = useState(null);
  // location-scout-check-pack's response for the most recently saved
  // hunt, or null. Best-effort advisory only -- fetched fire-and-forget
  // after save (see saveHunt), never blocks the save UI, and a failure
  // here just leaves this null rather than surfacing an error.
  const [scoutWarnings, setScoutWarnings] = useState(null);

  // Campaign fields — required business, everything else defaulted.
  const [businesses, setBusinesses] = useState([]);
  const [businessesLoading, setBusinessesLoading] = useState(true);
  const [businessesError, setBusinessesError] = useState(null);
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
        .select('id, name, venue_category')
        .eq('is_active', true)
        .order('name');
      if (error) {
        console.error('[CommandCenter] failed to load businesses:', error);
        setBusinessesError(error.message || 'Failed to load businesses');
      } else {
        setBusinessesError(null);
        setBusinesses(data || []);
      }
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
      prev.map((w) => (w.id === id ? { ...w, loading: true, error: false, errorMessage: null } : w))
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

      // Same idea for the trivia pool -- don't hand back a question
      // already used elsewhere in this hunt. Derived live from
      // waypoints, same reasoning as usedMovies above.
      const usedPoolIds = waypoints
        .filter((w) => w.id !== id)
        .map((w) => w.from_pool_id)
        .filter(Boolean);

      // Content of already-used facts (title+answer) across OTHER
      // waypoints in this hunt -- p_exclude_ids only excludes by pool ROW
      // id, but two different rows (e.g. a Casual waypoint and a Classic
      // waypoint) can share the same underlying fact, since the batch
      // dedup gate allows the same movie_title+correct_answer to exist
      // once PER DIFFICULTY, not once per genre overall. A hunt mixing
      // tiers could otherwise draw the same fact twice via two rows
      // p_exclude_ids can't tell apart. Checked client-side below, after
      // each get_pooled_question call, rather than in the RPC itself:
      // get_pooled_question has exactly one caller today (this one) --
      // extending its signature to accept content-based exclusion would
      // mean dropping and recreating a live RPC every hunt build depends
      // on, for a safeguard only this one call site currently needs. If a
      // second caller of get_pooled_question ever appears, this check
      // should move into the function itself instead of being duplicated
      // per caller.
      const usedFacts = waypoints
        .filter((w) => w.id !== id)
        .map((w) => (w.movie_title ? `${w.movie_title.trim().toLowerCase()}::${w.correct_answer}` : null))
        .filter(Boolean);

      // Pool lookup is a fast-path optimisation, not a required step --
      // any failure here (network, RPC error) falls through to AI
      // generation exactly as if the pool had no match, rather than
      // being caught by the outer catch and reported as a generation
      // failure it isn't.
      let pooled = null;
      try {
        // .maybeSingle() (migration 034): get_pooled_question is RETURNS
        // SETOF trivia_pool, so this correctly unwraps zero rows to real
        // JS null and exactly one row to a plain object -- never the
        // ambiguous all-null-fields object the old scalar RETURNS
        // trivia_pool + RETURN NULL produced over PostgREST, which used
        // to make `if (pooled)` below wrongly read a genuine no-match as
        // a hit (blank waypoint card, no error, no AI fallback call).
        //
        // Bounded retry loop: a returned row whose fact is already used
        // elsewhere in this hunt gets its id added to the exclude set and
        // is retried, rather than accepted as a same-fact repeat. Capped
        // at MAX_POOL_RETRIES so a genre/difficulty pool that's entirely
        // (or mostly) colliding facts can't spin -- past the cap, this
        // falls through to AI generation exactly like a genuine no-match
        // would.
        const excludeIds = [...usedPoolIds];
        const MAX_POOL_RETRIES = 5;
        for (let attempt = 0; attempt < MAX_POOL_RETRIES; attempt++) {
          const { data } = await supabase.rpc('get_pooled_question', {
            p_digit: required_digit,
            p_difficulty: Math.min(TIER_TO_INT[tier] || 2, 3),
            p_genre: selectedGenre,
            p_exclude_ids: excludeIds,
          }).maybeSingle();

          if (!data) break; // pool exhausted -- fall through to AI generation

          const factKey = data.movie_title ? `${data.movie_title.trim().toLowerCase()}::${data.correct_answer}` : null;
          if (factKey && usedFacts.includes(factKey)) {
            excludeIds.push(data.id);
            continue;
          }

          pooled = data;
          break;
        }
      } catch (e) { /* fall through to AI generation below */ }

      if (pooled) {
        // coordinate_digit is OVERRIDDEN to required_digit, never trusted
        // from the pool row -- the row matched because required_digit is
        // SOMEWHERE in available_digits, not necessarily the same digit
        // it was originally promoted for (e.g. correct_answer=148,
        // available_digits={1,4,8}, could have been promoted for digit 1
        // but reused here for digit 8). Same discipline as
        // build_puzzle_for_location's v_digit override.
        setWaypoints((prev) =>
          prev.map((w) => (w.id === id ? {
            ...w,
            question_text:    pooled.question_text,
            movie_title:      pooled.movie_title,
            movie_year:       pooled.movie_year,
            movie_emoji:      pooled.movie_emoji,
            correct_answer:   pooled.correct_answer,
            coordinate_digit: required_digit,
            extraction_note:  pooled.extraction_note,
            hint_text:        pooled.hint_text,
            from_pool_id:     pooled.id,
            loading: false,
          } : w))
        );
        return;
      }

      // No pool match -- fall through to AI generation exactly as before.
      // from_pool_id explicitly cleared to null: without this, a
      // regenerate() on a waypoint that was PREVIOUSLY pool-sourced would
      // leave the old from_pool_id lingering on the merged state even
      // though this result is freshly AI-generated.
      const result = await generateTriviaQuestion(name, tier, required_digit, selectedGenre, usedMovies);
      setWaypoints((prev) =>
        prev.map((w) => (w.id === id ? { ...w, ...result, from_pool_id: null, loading: false } : w))
      );
    } catch (err) {
      setWaypoints((prev) =>
        prev.map((w) => (w.id === id ? { ...w, loading: false, error: true, errorMessage: err?.message || null } : w))
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
    if (!selectedGenre) {
      setGenreError(true);
      return;
    }
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
        // Tells create_command_center_hunt whether to promote this
        // question into trivia_pool -- null/absent means freshly
        // AI-generated (promote it); set means it already came FROM the
        // pool (don't re-promote a question that's already there).
        from_pool_id:     w.from_pool_id || null,
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

      // Location Scout, fire-and-forget: best-effort advisory on top of a
      // save that has already succeeded, not part of the save itself. Not
      // awaited -- nothing below this line should wait on it, and the
      // save-confirmation UI above must appear immediately regardless of
      // how long this takes or whether it fails. Same invoke pattern (and
      // same automatic admin-session auth) as the diagnostic panel's
      // handleRunCheck. Any failure -- network error, non-2xx, timeout --
      // is swallowed into scoutWarnings staying null; it must never look
      // like the hunt itself failed to save.
      supabase.functions
        .invoke('location-scout-check-pack', { body: { pack_id: data.pack_id } })
        .then(({ data: scoutData, error: scoutError }) => {
          setScoutWarnings(scoutError || !scoutData ? null : scoutData);
        })
        .catch(() => {
          setScoutWarnings(null);
        });

      setPackName('');
      setWaypoints([]);
      setSelectedBusinessId('');
      setSelectedGenre('');
      setGenreError(false);
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

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: `1px solid ${COLORS.border}` }}>
          {[{ key: 'build', label: 'Build Hunt' }, { key: 'manage', label: 'Manage Hunts' }, { key: 'pool', label: 'Question Pool' }, { key: 'reclassify', label: 'Reclassify Pool' }, { key: 'scout', label: 'Location Scout' }].map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: '10px 4px', marginBottom: -1, fontSize: 13, fontWeight: 600,
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: activeTab === t.key ? COLORS.textBright : COLORS.textDim,
                borderBottom: activeTab === t.key ? `2px solid ${COLORS.gold}` : '2px solid transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'manage' ? (
          <ManageHuntsTab />
        ) : activeTab === 'pool' ? (
          <QuestionPoolTab />
        ) : activeTab === 'reclassify' ? (
          <ReclassifyPoolTab />
        ) : activeTab === 'scout' ? (
          <LocationScoutTab />
        ) : (
        <>
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
            actually reaches trivia generation (not just card theming).
            No default selection — 'general' is a real, valid option but
            must be picked deliberately, not landed on by leaving the
            picker untouched (see live data: 19 packs saved with genre
            still at its old default, several with names that clearly
            signalled a different genre). */}
        <label style={{ display: 'block', fontSize: 11, color: COLORS.textDim, marginBottom: 4 }}>
          Genre <span style={{ color: '#F43F5E' }}>*</span>
        </label>
        <select
          value={selectedGenre}
          onChange={(e) => { setSelectedGenre(e.target.value); setGenreError(false); }}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 6, fontSize: 14,
            background: COLORS.panel, border: `1px solid ${genreError ? '#F43F5E' : COLORS.border}`,
            color: COLORS.textBright, outline: 'none', marginBottom: 4,
            boxSizing: 'border-box',
          }}
        >
          <option value="" disabled>— Select genre —</option>
          {GENRES.map((g) => (
            <option key={g.key} value={g.key}>{g.label}</option>
          ))}
        </select>
        {genreError && (
          <p style={{ fontSize: 12, margin: '4px 0 0', color: '#F43F5E' }}>
            Pick a genre before saving — choose "General" if this hunt genuinely isn't genre-specific.
          </p>
        )}
        <p style={{ color: COLORS.textDim, fontSize: 11, marginBottom: 16, marginTop: 8 }}>
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
                  {w.errorMessage || 'Generation failed'} — tap regenerate, or try a different location/tier.
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
          {businessesError ? (
            <p style={{ fontSize: 12, margin: '0 0 12px', color: '#F43F5E' }}>
              Failed to load businesses — {businessesError}
            </p>
          ) : (
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
              {businesses.map((b) => {
                const cat = VENUE_CATEGORIES.find((c) => c.value === b.venue_category);
                return (
                  <option key={b.id} value={b.id}>
                    {b.name}{cat ? ` — ${cat.emoji} ${cat.value}` : ''}
                  </option>
                );
              })}
            </select>
          )}

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

        {scoutWarnings && scoutWarnings.warnings && scoutWarnings.warnings.length > 0 && (
          <div style={{ marginTop: 12, padding: 14, borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)' }}>
            <p style={{ fontSize: 13, color: COLORS.textBright, fontWeight: 700, margin: '0 0 6px' }}>
              Location Scout flagged {scoutWarnings.warnings.length} thing{scoutWarnings.warnings.length === 1 ? '' : 's'} to review.
            </p>
            {scoutWarnings.warnings.map((w, i) => (
              <p key={i} style={{ fontSize: 12, color: COLORS.textDim, margin: '0 0 6px' }}>
                <strong style={{ color: COLORS.textBright }}>{w.subject_type}</strong> / {w.check_type} — {w.outcome}: {w.reason}
              </p>
            ))}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setScoutWarnings(null)}
                style={{ padding: '8px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: 'transparent', color: COLORS.textDim, border: `1px solid ${COLORS.border}`, cursor: 'pointer' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
