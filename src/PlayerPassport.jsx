import { useState, useEffect, useRef } from "react";
import { supabase } from "./lib/supabase";
import { getTheme, DIFFICULTY_COLORS, DifficultyPill } from "./lib/theme";

// ── DESIGN TOKENS ──────────────────────────────────────────────
const D = {
  bg:       '#06060E',
  surface:  '#0A0A14',
  card:     '#0E0E1A',
  cardAlt:  '#121218',
  border:   '#1E1E2E',
  borderMid:'#2A2A3A',
  purple:   '#7C3AED',
  purpleL:  '#9D5FF5',
  gold:     '#F59E0B',
  goldLight:'#FCD34D',
  goldDim:  '#78490A',
  green:    '#10B981',
  red:      '#EF4444',
  text:     '#F1F0FF',
  textSub:  '#B8B4D8',
  textMuted:'#6B67A0',
  textDim:  '#32325A',
  mono:     "'Share Tech Mono', monospace",
  display:  "'Nunito', sans-serif",
  body:     "'Space Grotesk', sans-serif",
};

// ── ACHIEVEMENTS CATALOGUE ──────────────────────────────────────
// Testers who created their account before public launch keep the
// Founding Hunter badge permanently — adjust this date, not the req below.
const PUBLIC_LAUNCH_DATE = new Date('2026-08-01');

// Longest run of consecutive calendar days with at least one completed hunt.
function calcLongestStreak(hunts) {
  if (!hunts.length) return 0;
  const days = [...new Set(hunts.map(h => new Date(h.completed_at).toDateString()))]
    .map(d => new Date(d).getTime())
    .sort((a, b) => a - b);
  let longest = 1, current = 1;
  for (let i = 1; i < days.length; i++) {
    const diffDays = Math.round((days[i] - days[i - 1]) / 86400000);
    if (diffDays === 1) current += 1;
    else if (diffDays > 1) current = 1;
    longest = Math.max(longest, current);
  }
  return longest;
}

// Rank Ladder (Passport & Compass spec, section 1). Lifetime hunt count,
// all tiers equal weight. The 5th rung (Premiere) is trophy-gated (World
// Premiere, spec section 2) -- lit by premiereUnlocked (>= 1 trophy),
// independent of the hunt-count rankIndex the first 4 rungs use.
const RANKS = [
  { id:'extra',    dotLabel:'EXTRA',    title:'EXTRA',             hunts:1  },
  { id:'support',  dotLabel:'SUPPORT',  title:'SUPPORTING ACTOR',  hunts:5  },
  { id:'lead',     dotLabel:'LEAD',     title:'LEAD ROLE',         hunts:15 },
  { id:'director', dotLabel:'DIRECTOR', title:'DIRECTOR',          hunts:30 },
  { id:'premiere', dotLabel:'PREMIERE', title:'PREMIERE',          hunts:null },
];

// Tier -> emoji for the World Premiere laurel badge (Passport & Compass
// spec, section 2). Distinct from ACHIEVEMENTS' icons above (those are
// per-badge flourishes, not a tier identity) -- this is the canonical
// tier emoji used wherever a trophy's own tier needs a single glyph.
const TIER_EMOJI = { casual: '🎬', classic: '🎭', expert: '🔥', cipher: '🔐' };

const ACHIEVEMENTS = [
  { id:'first_hunt',    icon:'🎬', name:'First Frame',     desc:'Completed your first hunt',          req: h => h.length >= 1 },
  { id:'five_hunts',    icon:'🗺️', name:'Explorer',        desc:'Completed 5 hunts',                  req: h => h.length >= 5 },
  { id:'ten_hunts',     icon:'🧭', name:'Navigator',       desc:'Completed 10 hunts',                 req: h => h.length >= 10 },
  { id:'km_10',         icon:'🚶', name:'On Foot',         desc:'Walked 10km total',                  req: (h,s) => s.totalKm >= 10 },
  { id:'km_50',         icon:'🏃', name:'Distance Hunter', desc:'Walked 50km total',                  req: (h,s) => s.totalKm >= 50 },
  { id:'speed',         icon:'⚡', name:'Speed Hunter',    desc:'Completed a hunt in under 10 mins',  req: h => h.some(x => x.duration_mins < 10) },
  { id:'expert',        icon:'🔦', name:'Deep Cut',        desc:'Completed an Expert hunt',           req: h => h.some(x => x.difficulty === 'expert') },
  { id:'cipher',        icon:'🔐', name:'Cipher Master',   desc:'Completed a Cipher hunt',            req: h => h.some(x => x.difficulty === 'cipher') },
  { id:'night',         icon:'🌙', name:'Night Hunter',    desc:'Completed a hunt after 8pm',         req: h => h.some(x => new Date(x.completed_at).getHours() >= 20) },
  { id:'streak_3',      icon:'🔥', name:'On Fire',         desc:'3 hunts in 3 days',                  req: (h,s) => s.streak >= 3 },
  { id:'prize',         icon:'🏆', name:'Prize Winner',    desc:'Won a Quarterly Cipher',             req: h => h.some(x => x.won_prize) },
  { id:'founder',       icon:'⭐', name:'Founding Hunter', desc:'Beta player — you were first',       req: (h,s,u) => !!u && new Date(u.created_at) < PUBLIC_LAUNCH_DATE },
];

// ── PASSPORT STAMP ─────────────────────────────────────────────
function PassportStamp({ hunt, index, animate }) {
  const angles = [-8, 5, -3, 10, -6, 7, -12, 4];
  const rotation = angles[index % angles.length];
  // Standardized on HuntSelectionScreen's DIFFICULTY_COLORS (the live
  // discovery screen's mapping) -- this used to have its own,
  // independently-invented colors that disagreed tier-for-tier.
  const tier = DIFFICULTY_COLORS[hunt.difficulty?.toLowerCase()] || DIFFICULTY_COLORS.classic;
  const c = { ring: tier.color, text: tier.color, bg: `${tier.color}14` };
  const date = new Date(hunt.completed_at);
  const dateStr = date.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'2-digit' }).toUpperCase();

  return (
    <div style={{
      display: 'inline-flex',
      flexDirection: 'column',
      alignItems: 'center',
      transform: `rotate(${rotation}deg)`,
      animation: animate ? `stampIn 0.4s cubic-bezier(0.34,1.56,0.64,1) ${index*0.1}s both` : 'none',
      cursor: 'pointer',
      transition: 'transform 0.2s',
    }}
    onMouseEnter={e => e.currentTarget.style.transform = `rotate(${rotation}deg) scale(1.08)`}
    onMouseLeave={e => e.currentTarget.style.transform = `rotate(${rotation}deg) scale(1)`}
    >
      {/* Stamp circle */}
      <div style={{
        width: '88px', height: '88px',
        borderRadius: '50%',
        border: `3px solid ${c.ring}`,
        background: c.bg,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
        boxShadow: `0 0 12px ${c.ring}40`,
      }}>
        {/* Outer ring text - venue name curved */}
        <div style={{
          position: 'absolute', inset: '3px',
          borderRadius: '50%',
          border: `1px dashed ${c.ring}40`,
        }} />
        {/* Inner content */}
        <div style={{
          fontFamily: D.mono, fontSize: '7px',
          color: c.text, letterSpacing: '1px',
          textAlign: 'center', lineHeight: 1.2,
          padding: '0 6px',
          maxWidth: '70px',
          overflow: 'hidden',
        }}>
          <div style={{ fontSize: '11px', marginBottom: '2px' }}>📍</div>
          <div style={{ fontWeight: 700, fontSize: '7px', lineHeight: 1.3 }}>
            {(hunt.business_name || 'MYSTERY').toUpperCase().slice(0, 14)}
          </div>
        </div>
        {/* Ink effect overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.04), transparent)',
          borderRadius: '50%',
        }} />
      </div>
      {/* Date below stamp */}
      <div style={{
        fontFamily: D.mono, fontSize: '8px',
        color: D.textDim, letterSpacing: '1px',
        marginTop: '4px',
      }}>{dateStr}</div>
    </div>
  );
}

// ── ACHIEVEMENT BADGE ──────────────────────────────────────────
function AchievementBadge({ achievement, unlocked }) {
  return (
    <div style={{
      backgroundColor: unlocked ? D.card : D.surface,
      backgroundImage: unlocked ? 'none' : 'linear-gradient(135deg, transparent 40%, rgba(245,158,11,0.15) 50%, transparent 60%)',
      backgroundSize: unlocked ? 'auto' : '250% 100%',
      animation: unlocked ? 'none' : 'tease 6s linear infinite',
      border: `1px solid ${unlocked ? D.border : D.borderMid}`,
      borderRadius: '12px', padding: '14px 12px',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: '6px',
      opacity: unlocked ? 1 : 0.55,
      transition: 'all 0.3s',
      position: 'relative', overflow: 'hidden',
    }}>
      {unlocked && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: '1px',
          background: `linear-gradient(90deg,transparent,${D.gold},transparent)`,
        }} />
      )}
      <div style={{ fontSize: '22px', filter: unlocked ? 'none' : 'grayscale(1)' }}>
        {achievement.icon}
      </div>
      <div style={{
        fontFamily: D.mono, fontSize: '8px',
        color: unlocked ? D.gold : D.textMuted,
        letterSpacing: '1px', textAlign: 'center',
        fontWeight: 700,
      }}>{achievement.name}</div>
      {unlocked && (
        <div style={{
          position: 'absolute', top: '6px', right: '6px',
          width: '6px', height: '6px', borderRadius: '50%',
          background: D.green,
        }} />
      )}
    </div>
  );
}

// ── RANK LADDER ────────────────────────────────────────────────
function RankLadder({ totalHunts, premiereUnlocked }) {
  const rankIndex = totalHunts >= 30 ? 3 : totalHunts >= 15 ? 2 : totalHunts >= 5 ? 1 : totalHunts >= 1 ? 0 : -1;
  const nextRank = rankIndex < 3 ? RANKS[rankIndex + 1] : null;
  const remaining = nextRank ? nextRank.hunts - totalHunts : 0;
  const article = nextRank && /^[aeiou]/i.test(nextRank.title) ? 'an' : 'a';

  return (
    <div>
      {rankIndex >= 0 && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          fontFamily: D.mono, fontSize: '11px', letterSpacing: '2px',
          color: D.gold, background: 'rgba(245,158,11,0.1)',
          border: '1px solid rgba(245,158,11,0.3)', borderRadius: '999px',
          padding: '5px 14px', marginTop: '8px',
        }}>
          🎞 {RANKS[rankIndex].title}
        </div>
      )}

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        margin: '20px 0 4px', padding: '0 4px', position: 'relative',
      }}>
        <div style={{
          position: 'absolute', left: '20px', right: '20px', top: '18px', height: '2px',
          background: `linear-gradient(90deg, ${D.borderMid}, ${D.gold}, ${D.borderMid})`,
          zIndex: 0,
        }} />
        {RANKS.map((rank, i) => {
          const isPremiere = rank.id === 'premiere';
          const isDone = !isPremiere && i < rankIndex;
          const isCurrent = !isPremiere && i === rankIndex;
          const lit = isPremiere ? !!premiereUnlocked : (isDone || isCurrent);
          return (
            <div key={rank.id} style={{ textAlign: 'center', position: 'relative', zIndex: 1, flex: 1 }}>
              <div style={{
                width: isCurrent ? '18px' : '12px',
                height: isCurrent ? '18px' : '12px',
                borderRadius: '50%', margin: '0 auto 6px',
                background: lit ? D.gold : D.borderMid,
                border: '2px solid #080810',
                boxShadow: isCurrent
                  ? '0 0 0 4px rgba(245,158,11,0.25), 0 0 14px #F59E0B'
                  : isDone ? '0 0 10px #F59E0B' : 'none',
                animation: isCurrent ? 'pulse-dot 2s ease-in-out infinite' : 'none',
              }} />
              <div style={{
                fontSize: '8.5px', letterSpacing: '0.5px', fontWeight: 600,
                color: lit ? D.goldLight : D.textMuted,
              }}>{rank.dotLabel}</div>
            </div>
          );
        })}
      </div>

      {nextRank && (
        <div style={{ textAlign: 'center', fontSize: '10.5px', color: '#8B8B9A', marginTop: '10px' }}>
          Complete <b style={{ color: D.text }}>{remaining} more hunt{remaining === 1 ? '' : 's'}</b> to become {article} {nextRank.title}
        </div>
      )}
    </div>
  );
}

// ── PRIZE WEDGE RING ───────────────────────────────────────────
// Prize Qualification (Passport & Compass spec, section 4). Real,
// persisted version of the cosmetic 5-star strip on the arrival-reveal
// screen -- see join_prize_draw() (migration 048) for the server-side
// source of truth this mirrors for display.
//
// Wedge paths are the mockup's own pre-computed 5-equal-72-degree
// slices (radius 88, center 100,100) -- geometry is fixed regardless
// of lock state, only fill/stroke changes per position.
const WEDGE_PATHS = [
  'M 100,100 L 103.07,12.05 A 88 88 0 0 1 182.69,69.90 Z',
  'M 100,100 L 184.59,75.74 A 88 88 0 0 1 154.18,169.34 Z',
  'M 100,100 L 149.21,172.96 A 88 88 0 0 1 50.79,172.96 Z',
  'M 100,100 L 45.82,169.34 A 88 88 0 0 1 15.41,75.74 Z',
  'M 100,100 L 17.31,69.90 A 88 88 0 0 1 96.93,12.05 Z',
];
// Reference-key colors only -- wedges themselves all turn D.gold when
// unlocked (confirmed design decision), never these individual colors.
const WEDGE_TIER_KEY = [
  { label: 'CASUAL',  color: '#5DCAA5' },
  { label: 'CLASSIC', color: '#9D6FFF' },
  { label: 'CLASSIC', color: '#9D6FFF' },
  { label: 'EXPERT',  color: '#F59E0B' },
  { label: 'CIPHER',  color: '#C4396A' },
];
const WEDGE_REQUIRED = ['casual', 'classic', 'classic', 'expert', 'cipher'];

// Europe/London offset (minutes ahead of UTC -- BST=60, GMT=0) at a
// given instant, via Intl rather than a timezone library.
function getLondonOffsetMinutes(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/London', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);
  const get = t => parseInt(parts.find(p => p.type === t).value, 10);
  const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return (asUTC - date.getTime()) / 60000;
}

// Current calendar-quarter boundaries in Europe/London wall-clock time.
// Display-only -- join_prize_draw() re-derives this itself server-side
// as the actual source of truth, so any DST-edge drift here is cosmetic.
function getLondonQuarterBounds() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit',
  }).formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year').value, 10);
  const month = parseInt(parts.find(p => p.type === 'month').value, 10);
  const quarter = Math.floor((month - 1) / 3) + 1;
  const startMonth = (quarter - 1) * 3;

  const londonWallClockToUTC = (y, mo) => {
    const utcGuess = new Date(Date.UTC(y, mo, 1, 0, 0, 0));
    return new Date(utcGuess.getTime() - getLondonOffsetMinutes(utcGuess) * 60000);
  };

  const start = londonWallClockToUTC(year, startMonth);
  const endMonth = startMonth + 3;
  const end = endMonth >= 12
    ? londonWallClockToUTC(year + 1, endMonth - 12)
    : londonWallClockToUTC(year, endMonth);

  return { start, end, quarterLabel: `${year}-Q${quarter}` };
}

// Same strict-pointer walk as join_prize_draw() -- a hunt only advances
// the pointer if its tier matches the CURRENT required position; anything
// out of turn is skipped, never banked.
function calcWedgesFilled(hunts, start, end) {
  const inQuarter = hunts
    .filter(h => {
      const t = new Date(h.completed_at).getTime();
      return t >= start.getTime() && t < end.getTime();
    })
    .sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at));
  let pointer = 0;
  for (const h of inQuarter) {
    if (pointer < WEDGE_REQUIRED.length && h.difficulty === WEDGE_REQUIRED[pointer]) {
      pointer += 1;
    }
  }
  return pointer;
}

function PrizeWedgeRing({ hunts, user }) {
  const [alreadyEntered, setAlreadyEntered] = useState(false);
  const [joinedJustNow, setJoinedJustNow] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  const { start, end, quarterLabel } = getLondonQuarterBounds();
  const wedgesFilled = calcWedgesFilled(hunts, start, end);
  const remaining = Math.max(0, WEDGE_REQUIRED.length - wedgesFilled);

  useEffect(() => {
    if (!user) return;
    supabase.from('prize_draw_entries').select('quarter_label')
      .eq('user_id', user.id).eq('quarter_label', quarterLabel).maybeSingle()
      .then(({ data }) => setAlreadyEntered(!!data));
  }, [user, quarterLabel]);

  const handleJoinDraw = async () => {
    setJoining(true); setJoinError('');
    try {
      const { data, error } = await supabase.rpc('join_prize_draw');
      if (error) throw error;
      if (data.success) {
        setAlreadyEntered(true);
        setJoinedJustNow(!data.already_entered);
      } else {
        setJoinError("Doesn't look like all 5 wedges are filled yet — refresh and try again.");
      }
    } catch (e) {
      setJoinError('Something went wrong, try again.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div style={{
      background: D.card, border: `1px solid ${D.border}`,
      borderRadius: '16px', padding: '20px 20px 24px',
      marginBottom: '20px', textAlign: 'center',
    }}>
      <div style={{
        fontFamily: D.mono, fontSize: '9px', textAlign: 'left',
        color: D.textMuted, letterSpacing: '3px', marginBottom: '16px',
      }}>PRIZE QUALIFICATION</div>

      <div style={{ marginBottom: '18px' }}>
        <div style={{ fontFamily: D.mono, fontSize: '11px', letterSpacing: '2px', color: D.gold, fontWeight: 700, marginBottom: '4px' }}>
          QUARTERLY PRIZE POOL
        </div>
        <div style={{ fontSize: '12px', color: '#8B8B9A' }}>
          Complete hunts across all tiers to qualify
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
        {WEDGE_TIER_KEY.map((t, i) => (
          <span key={i} style={{
            fontFamily: D.mono, fontSize: '8px', letterSpacing: '0.5px',
            display: 'flex', alignItems: 'center', gap: '4px', color: '#8B8B9A',
          }}>
            <i style={{ width: '7px', height: '7px', borderRadius: '50%', display: 'inline-block', background: t.color }} />
            {t.label}
          </span>
        ))}
      </div>

      <div style={{ position: 'relative', width: '180px', height: '180px', margin: '4px auto 10px' }}>
        <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%' }}>
          {WEDGE_PATHS.map((d, i) => {
            const unlocked = i < wedgesFilled;
            return (
              <path key={i} d={d}
                fill={unlocked ? D.gold : 'rgba(255,255,255,0.05)'}
                stroke={unlocked ? 'none' : 'rgba(255,255,255,0.12)'}
                strokeWidth={unlocked ? 0 : 1}
                strokeDasharray={unlocked ? 'none' : '3 4'}
                style={{
                  transition: 'fill 0.3s ease',
                  filter: unlocked ? 'drop-shadow(0 0 8px rgba(245,158,11,0.6))' : 'none',
                }}
              />
            );
          })}
          <circle cx="100" cy="100" r="46" fill="#080810" />
          <circle cx="100" cy="100" r="46" fill="none" stroke="rgba(245,158,11,0.25)" strokeWidth="1.5" />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ fontFamily: D.display, fontWeight: 900, fontSize: '30px', lineHeight: 1, color: D.text }}>
            {wedgesFilled}<span style={{ fontSize: '15px', color: '#8B8B9A', fontWeight: 600 }}>/5</span>
          </div>
          <div style={{ fontFamily: D.mono, fontSize: '8px', letterSpacing: '1.5px', color: '#8B8B9A', marginTop: '4px' }}>
            REELS COMPLETE
          </div>
        </div>
      </div>

      {wedgesFilled >= WEDGE_REQUIRED.length ? (
        alreadyEntered ? (
          <div style={{ fontSize: '10.5px', color: D.green, fontFamily: D.mono, letterSpacing: '1px', marginTop: '8px' }}>
            {joinedJustNow ? "YOU'RE IN — GOOD LUCK!" : `ENTERED FOR ${quarterLabel}`}
          </div>
        ) : (
          <button
            onClick={handleJoinDraw}
            disabled={joining}
            style={{
              display: 'inline-block', fontFamily: D.mono, fontSize: '12px',
              letterSpacing: '1.5px', color: '#080810',
              background: `linear-gradient(135deg,${D.goldLight},${D.gold})`,
              padding: '12px 26px', borderRadius: '999px', fontWeight: 700,
              marginTop: '6px', border: 'none', cursor: joining ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 20px rgba(245,158,11,0.4)',
              animation: joining ? 'none' : 'cta-pulse 2s ease-in-out infinite',
            }}
          >{joining ? 'JOINING...' : 'JOIN THE DRAW'}</button>
        )
      ) : (
        <div style={{ fontSize: '10.5px', color: '#8B8B9A', marginTop: '8px' }}>
          {remaining} more hunt{remaining === 1 ? '' : 's'} to unlock the draw
        </div>
      )}

      {joinError && <div style={{ color: D.red, fontSize: '11px', fontFamily: D.mono, marginTop: '10px' }}>{joinError}</div>}
    </div>
  );
}

// ── LATEST PREMIERE ────────────────────────────────────────────
// World Premiere trophy hero card (Passport & Compass spec, section 2).
// Trophies are inherently scarce -- most players will never hold one --
// so unlike the achievement badge grid, an empty state renders nothing
// at all here: no label, no locked placeholder tile. `trophies` is
// pre-sorted earned_at descending by loadData(); trophies[0] is the hero,
// the rest collapse into the "+N more" row.
function LatestPremiere({ trophies }) {
  const [flash, setFlash] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (!trophies.length) return null;

  const latest = trophies[0];
  const rest = trophies.slice(1);
  const tierKey = latest.difficulty?.toLowerCase() || 'classic';
  const tier = DIFFICULTY_COLORS[tierKey] || DIFFICULTY_COLORS.classic;
  const emoji = TIER_EMOJI[tierKey] || TIER_EMOJI.classic;

  const triggerFlash = () => {
    setFlash(false);
    requestAnimationFrame(() => setFlash(true));
  };

  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{
        fontFamily: D.mono, fontSize: '11px', letterSpacing: '3px',
        color: D.textMuted, marginBottom: '10px', textTransform: 'uppercase',
      }}>LATEST PREMIERE</div>

      <div className={`premiere-card${flash ? ' flash' : ''}`} onClick={triggerFlash}>
        <div className="flash-veil" />
        <div className="spotlight" />
        <div className="premiere-eyebrow">
          ★ {tierKey.toUpperCase()} TIER · WORLD PREMIERE ★
        </div>
        <div className="laurel-badge">
          <svg className="laurel-svg" viewBox="0 0 120 120">
            <g fill="none" stroke="#F59E0B" strokeWidth="2.5" opacity="0.9">
              <path d="M40 20 Q20 40 22 70 Q24 95 42 108" strokeLinecap="round"/>
              <path d="M32 30 Q28 32 26 36" strokeLinecap="round"/>
              <path d="M28 45 Q24 47 22 51" strokeLinecap="round"/>
              <path d="M26 60 Q21 61 19 64" strokeLinecap="round"/>
              <path d="M26 75 Q21 77 19 80" strokeLinecap="round"/>
              <path d="M30 90 Q26 93 24 97" strokeLinecap="round"/>
            </g>
            <g fill="none" stroke="#F59E0B" strokeWidth="2.5" opacity="0.9">
              <path d="M80 20 Q100 40 98 70 Q96 95 78 108" strokeLinecap="round"/>
              <path d="M88 30 Q92 32 94 36" strokeLinecap="round"/>
              <path d="M92 45 Q96 47 98 51" strokeLinecap="round"/>
              <path d="M94 60 Q99 61 101 64" strokeLinecap="round"/>
              <path d="M94 75 Q99 77 101 80" strokeLinecap="round"/>
              <path d="M90 90 Q94 93 96 97" strokeLinecap="round"/>
            </g>
          </svg>
          <div className="laurel-icon">{emoji}</div>
        </div>
        <div className="premiere-title">{latest.hunt_name}</div>
        <div className="premiere-sub">{latest.business_name}</div>
        <div className="premiere-meta">
          <span>DIFFICULTY<b>{tierKey.toUpperCase()}</b></span>
          <span>PLAYERS<b>1st EVER</b></span>
          <span>STARS<b>{tier.bars} / 4</b></span>
        </div>
      </div>

      {rest.length > 0 && (
        <>
          <div className={`more-row${expanded ? ' open' : ''}`} onClick={() => setExpanded(e => !e)}>
            <span>+ {rest.length} more premiere{rest.length === 1 ? '' : 's'}</span>
            <span className="chev">›</span>
          </div>
          {expanded && (
            <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {rest.map(t => {
                const rKey = t.difficulty?.toLowerCase() || 'classic';
                const rTier = DIFFICULTY_COLORS[rKey] || DIFFICULTY_COLORS.classic;
                return (
                  <div key={t.puzzle_id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                    padding: '10px 14px', background: D.cardAlt, border: `1px solid ${D.border}`, borderRadius: '10px',
                  }}>
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 700, color: D.text }}>{t.hunt_name}</div>
                      <div style={{ fontFamily: D.mono, fontSize: '9.5px', color: D.textDim, marginTop: '2px' }}>
                        {new Date(t.earned_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }).toUpperCase()}
                      </div>
                    </div>
                    <span style={{
                      fontFamily: D.mono, fontSize: '9px', fontWeight: 700, letterSpacing: '1px',
                      padding: '3px 8px', borderRadius: '999px', whiteSpace: 'nowrap',
                      background: `${rTier.color}22`, color: rTier.color,
                    }}>{rKey.toUpperCase()}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── STAT CARD ──────────────────────────────────────────────────
function StatCard({ label, value, accent, sub }) {
  return (
    <div style={{
      background: D.card, border: `1px solid ${D.border}`,
      borderRadius: '14px', padding: '20px 16px',
      position: 'relative', overflow: 'hidden', flex: 1,
      minWidth: '80px',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
        background: `linear-gradient(90deg,transparent,${accent},transparent)`,
      }} />
      <div style={{
        fontFamily: D.display, fontWeight: 900,
        fontSize: '32px', color: accent, lineHeight: 1,
        marginBottom: '4px',
      }}>{value}</div>
      <div style={{
        fontFamily: D.mono, fontSize: '9px',
        color: D.textMuted, letterSpacing: '2px',
      }}>{label}</div>
      {sub && <div style={{ fontSize: '11px', color: D.textMuted, marginTop: '2px' }}>{sub}</div>}
    </div>
  );
}

// ── SHARE CARD GENERATOR ───────────────────────────────────────
function ShareCard({ hunt, playerName }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !hunt) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const W = 600, H = 400;
    canvas.width = W; canvas.height = H;

    // Background
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#06060E');
    grad.addColorStop(0.5, '#0E0E1A');
    grad.addColorStop(1, '#06060E');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(124,58,237,0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    // Top accent
    const topGrad = ctx.createLinearGradient(0,0,W,0);
    topGrad.addColorStop(0,'transparent'); topGrad.addColorStop(0.5,'#7C3AED'); topGrad.addColorStop(1,'transparent');
    ctx.fillStyle = topGrad; ctx.fillRect(0, 0, W, 2);

    // Logo area
    ctx.fillStyle = '#7C3AED';
    ctx.beginPath();
    roundRect(ctx, 24, 24, 36, 36, 8);
    ctx.fill();

    // Brand name
    ctx.fillStyle = '#F1F0FF';
    ctx.font = 'bold 16px Space Grotesk, sans-serif';
    ctx.fillText('Map', 72, 42);
    ctx.fillStyle = '#7C3AED';
    ctx.font = '10px Share Tech Mono, monospace';
    ctx.fillText('THE', 106, 38);
    ctx.fillStyle = '#F59E0B';
    ctx.font = 'bold 16px Space Grotesk, sans-serif';
    ctx.fillText('Movie', 130, 42);

    // "HUNT COMPLETE" stamp
    ctx.save();
    ctx.translate(W - 80, 60);
    ctx.rotate(0.15);
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 42, 0, Math.PI*2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(16,185,129,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 35, 0, Math.PI*2);
    ctx.stroke();
    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 9px Share Tech Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('HUNT', 0, -4);
    ctx.fillText('COMPLETE', 0, 8);
    ctx.restore();

    // Hunt name
    ctx.fillStyle = '#F1F0FF';
    ctx.font = 'bold 36px Nunito, sans-serif';
    ctx.textAlign = 'left';
    const name = (hunt.pack_name || 'Mystery Hunt').toUpperCase();
    ctx.fillText(name.length > 22 ? name.slice(0,22)+'…' : name, 24, 130);

    // Venue
    ctx.fillStyle = '#F59E0B';
    ctx.font = '14px Share Tech Mono, monospace';
    ctx.fillText(`📍  ${(hunt.business_name || 'Hidden Destination').toUpperCase()}`, 24, 162);

    // Divider
    ctx.fillStyle = '#1E1E2E';
    ctx.fillRect(24, 180, W-48, 1);

    // Stats
    const stats = [
      { label: 'TIME', value: hunt.duration_mins ? `${hunt.duration_mins}m` : '—' },
      { label: 'DISTANCE', value: hunt.distance_km ? `${hunt.distance_km}km` : '—' },
      { label: 'DIFFICULTY', value: (hunt.difficulty || 'classic').toUpperCase() },
      { label: 'CLUES SOLVED', value: `${hunt.slots_solved || 12}` },
    ];
    stats.forEach((s, i) => {
      const x = 24 + i * 145;
      ctx.fillStyle = '#32325A';
      ctx.font = '9px Share Tech Mono, monospace';
      ctx.fillText(s.label, x, 208);
      ctx.fillStyle = '#F1F0FF';
      ctx.font = 'bold 22px Nunito, sans-serif';
      ctx.fillText(s.value, x, 234);
    });

    // Bottom
    ctx.fillStyle = '#1E1E2E';
    ctx.fillRect(24, 280, W-48, 1);

    ctx.fillStyle = '#6B67A0';
    ctx.font = '12px Space Grotesk, sans-serif';
    ctx.fillText(`${playerName || 'A Hunter'} solved this with movie trivia alone.`, 24, 308);
    ctx.fillStyle = '#7C3AED';
    ctx.font = '12px Share Tech Mono, monospace';
    ctx.fillText('Can you? → app.mapthemovie.co.uk', 24, 330);

    // Bottom accent
    const botGrad = ctx.createLinearGradient(0,H-2,W,H-2);
    botGrad.addColorStop(0,'transparent'); botGrad.addColorStop(0.5,'#F59E0B'); botGrad.addColorStop(1,'transparent');
    ctx.fillStyle = botGrad; ctx.fillRect(0, H-2, W, 2);

  }, [hunt, playerName]);

  return (
    <canvas ref={canvasRef} style={{
      borderRadius: '12px', maxWidth: '100%',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }} />
  );
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
}

// ── AUTH SCREEN ────────────────────────────────────────────────
function AuthScreen() {
  // 'password' = default | 'link' = magic-link (existing, untouched flow)
  const [authMode, setAuthMode] = useState('password');
  // Within password mode: signing into an existing account vs creating one
  const [passwordMode, setPasswordMode] = useState('login');
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const switchAuthMode = (m) => {
    setAuthMode(m); setError(''); setSuccess('');
  };

  const handleSendLink = async () => {
    if (!email) { setError('Enter your email address'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      const { error: e } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.href },
      });
      if (e) throw e;
      setSuccess('Check your email for your sign-in link.');
    } catch(e) {
      const isRateLimited = e.status === 429 || e.code === 'over_email_send_rate_limit'
        || /rate limit/i.test(e.message || '');
      setError(isRateLimited
        ? "You've already requested a link — check your email, or wait a moment before trying again."
        : 'Something went wrong, try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordAuth = async () => {
    if (!email || !password) { setError('Email and password required'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      if (passwordMode === 'signup') {
        const { data, error: e } = await supabase.auth.signUp({ email, password });
        if (e) throw e;
        // If the project requires email confirmation, Supabase withholds
        // the session until that link is clicked -- nothing in this code
        // can force a session into existing early. Show a soft note and
        // drop back to login rather than pretending it worked.
        if (!data.session) {
          setSuccess("Account created — check your email to confirm, then sign in below.");
          setPasswordMode('login');
        }
        // If a session DID come back, onAuthStateChange in the parent
        // picks it up automatically and this screen unmounts.
      } else {
        const { error: e } = await supabase.auth.signInWithPassword({ email, password });
        if (e) throw e;
      }
    } catch(e) {
      setError(e.message || 'Something went wrong, try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: D.bg, minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px', fontFamily: D.body, color: D.text,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Ambient */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 30%, rgba(124,58,237,0.1) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: '360px', position: 'relative', zIndex: 1 }}>
        {/* Passport icon */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '72px', height: '72px',
            background: `linear-gradient(135deg, #5B21B6, #7C3AED)`,
            borderRadius: '18px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 0 40px rgba(124,58,237,0.4)',
            fontSize: '32px',
          }}>🎬</div>
          <div style={{
            fontFamily: D.mono, fontSize: '10px',
            color: D.purple, letterSpacing: '4px', marginBottom: '6px',
          }}>PLAYER PASSPORT</div>
          <div style={{
            fontFamily: D.display, fontWeight: 900,
            fontSize: '28px', color: D.text, letterSpacing: '-0.5px',
          }}>
            {authMode === 'link' ? 'Welcome back.' : passwordMode === 'signup' ? 'Start your journey.' : 'Welcome back.'}
          </div>
          <div style={{ fontSize: '14px', color: D.textMuted, marginTop: '6px' }}>
            {authMode === 'link'
              ? "Enter your email and we'll send you a sign-in link."
              : passwordMode === 'signup'
                ? 'Create your hunter profile with an email and password.'
                : 'Sign in with your email and password.'}
          </div>
        </div>

        {/* Equal-weight toggle between the two sign-in methods */}
        <div style={{
          display: 'flex', gap: '8px',
          marginBottom: '20px',
          background: D.cardAlt, border: `1px solid ${D.border}`,
          borderRadius: '10px', padding: '4px',
        }}>
          {[
            { id: 'password', label: 'PASSWORD' },
            { id: 'link', label: 'SIGN-IN LINK' },
          ].map(m => (
            <button
              key={m.id}
              onClick={() => switchAuthMode(m.id)}
              style={{
                flex: 1, padding: '10px',
                background: authMode === m.id ? `linear-gradient(135deg,${D.purple},${D.purpleL})` : 'transparent',
                color: authMode === m.id ? '#FFF' : D.textMuted,
                border: 'none', borderRadius: '7px',
                fontSize: '10px', fontFamily: D.mono, letterSpacing: '1px',
                fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
              }}
            >{m.label}</button>
          ))}
        </div>

        {/* Form */}
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email address"
          onKeyDown={e => e.key === 'Enter' && (authMode === 'link' ? handleSendLink() : handlePasswordAuth())}
          style={{
            width: '100%', padding: '12px 14px',
            background: D.cardAlt, border: `1px solid ${D.border}`,
            borderRadius: '10px', color: D.text,
            fontSize: '15px', fontFamily: D.body,
            outline: 'none', marginBottom: '10px',
            boxSizing: 'border-box',
          }}
        />

        {authMode === 'password' && (
          <div style={{ position: 'relative', marginBottom: '10px' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              onKeyDown={e => e.key === 'Enter' && handlePasswordAuth()}
              style={{
                width: '100%', padding: '12px 54px 12px 14px',
                background: D.cardAlt, border: `1px solid ${D.border}`,
                borderRadius: '10px', color: D.text,
                fontSize: '15px', fontFamily: D.body,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              style={{
                position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                background: 'transparent', border: 'none',
                color: D.textMuted, fontSize: '9px', fontFamily: D.mono,
                letterSpacing: '1px', cursor: 'pointer', padding: '6px 8px',
              }}
            >{showPassword ? 'HIDE' : 'SHOW'}</button>
          </div>
        )}

        {authMode === 'password' && passwordMode === 'login' && (
          <div style={{ textAlign: 'right', marginBottom: '12px' }}>
            <button
              type="button"
              onClick={() => switchAuthMode('link')}
              style={{
                background: 'transparent', border: 'none',
                color: D.textMuted, fontSize: '12px',
                cursor: 'pointer', fontFamily: D.body, textDecoration: 'underline',
              }}
            >Forgot password?</button>
          </div>
        )}

        {error && <div style={{ color: D.red, fontSize: '12px', fontFamily: D.mono, marginBottom: '12px', textAlign: 'center' }}>{error}</div>}
        {success && <div style={{ color: D.green, fontSize: '12px', fontFamily: D.mono, marginBottom: '12px', textAlign: 'center', lineHeight: 1.5 }}>{success}</div>}

        <button
          onClick={authMode === 'link' ? handleSendLink : handlePasswordAuth}
          disabled={loading}
          style={{
            width: authMode === 'link' ? '100%' : '100%',
            padding: '14px',
            marginTop: authMode === 'link' ? 0 : '4px',
            background: loading ? D.border : `linear-gradient(135deg,${D.purple},${D.purpleL})`,
            color: '#FFF', border: 'none',
            borderRadius: '10px', fontSize: '15px',
            fontWeight: 700, fontFamily: D.body,
            cursor: loading ? 'not-allowed' : 'pointer',
            marginBottom: authMode === 'password' ? '16px' : 0,
            boxShadow: loading ? 'none' : '0 4px 20px rgba(124,58,237,0.3)',
          }}
        >
          {authMode === 'link'
            ? (loading ? 'Sending...' : 'Send me a sign-in link')
            : (loading ? 'Please wait...' : passwordMode === 'signup' ? 'Create Passport' : 'Sign In')}
        </button>

        {authMode === 'password' && (
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={() => { setPasswordMode(passwordMode === 'login' ? 'signup' : 'login'); setError(''); setSuccess(''); }}
              style={{
                background: 'transparent', border: 'none',
                color: D.purple, fontSize: '14px',
                cursor: 'pointer', fontFamily: D.body,
              }}
            >
              {passwordMode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MAIN PASSPORT COMPONENT ────────────────────────────────────
export default function PlayerPassport({ onClose }) {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('passport');
  const [hunts, setHunts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialAuthLoading, setInitialAuthLoading] = useState(true);
  const [shareHunt, setShareHunt] = useState(null);
  const [referralCopied, setReferralCopied] = useState(false);
  const [profile, setProfile] = useState(null);
  const [trophies, setTrophies] = useState([]);

  // Check auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUser(session.user);
      else setLoading(false);
      setInitialAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null);
      setInitialAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load hunt history when authed
  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load profile (Rank Ladder needs the atomically-incremented lifetime
      // counter, not hunts.length from the query below, which could differ
      // if pagination/limits ever apply)
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('total_hunts_completed')
        .eq('id', user.id)
        .single();
      setProfile(profileRow);

      // Load completed hunt sessions
      const { data: sessions } = await supabase
        .from('hunt_sessions')
        .select(`
          id, status, started_at, completed_at,
          arrival_distance_m, time_taken_seconds,
          puzzles(
            puzzle_packs(name, genre, theme_tag, emoji)
          ),
          redemptions(
            id, voucher_code, redeemed_at,
            campaigns(
              name, voucher_headline, difficulty,
              businesses(name)
            )
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });

      // Shape data
      const shaped = (sessions || []).map(s => {
        const redemption = s.redemptions?.[0];
        const campaign = redemption?.campaigns;
        return {
          id: s.id,
          pack_name: s.puzzles?.puzzle_packs?.name || 'Mystery Hunt',
          pack_emoji: s.puzzles?.puzzle_packs?.emoji || '🎬',
          business_name: campaign?.businesses?.name || 'Hidden Venue',
          genre: s.puzzles?.puzzle_packs?.genre || 'general',
          difficulty: campaign?.difficulty || 'classic',
          completed_at: s.completed_at,
          duration_mins: s.time_taken_seconds ? Math.round(s.time_taken_seconds / 60) : null,
          distance_km: s.arrival_distance_m ? (s.arrival_distance_m / 1000).toFixed(1) : null,
          voucher_code: redemption?.voucher_code || null,
          redeemed: !!redemption?.redeemed_at,
          slots_solved: 12,
          won_prize: false,
        };
      });

      setHunts(shaped);

      // Load World Premiere trophies (migration 049). world_premiere_trophies
      // has no FK to hunt_sessions/redemptions/campaigns -- only puzzle_id +
      // user_id -- so difficulty/business_name need a second lookup through
      // the winning hunt_sessions row (confirmed live 2026-07-20: campaigns.pack_id
      // references puzzle_packs, not puzzles, so puzzles -> campaigns is not a
      // valid join; hunt_sessions -> redemptions -> campaigns is the only
      // unambiguous path back to the specific campaign that was actually redeemed).
      const { data: trophyRows } = await supabase
        .from('world_premiere_trophies')
        .select('puzzle_id, hunt_name, earned_at')
        .eq('user_id', user.id)
        .order('earned_at', { ascending: false });

      if (trophyRows && trophyRows.length > 0) {
        const puzzleIds = trophyRows.map(t => t.puzzle_id);
        const { data: sessionRows } = await supabase
          .from('hunt_sessions')
          .select(`
            puzzle_id, completed_at,
            redemptions( campaigns( difficulty, businesses(name) ) )
          `)
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .in('puzzle_id', puzzleIds);

        // A puzzle_id could in theory have more than one completed session
        // for the same player (e.g. a replay after winning) -- pick whichever
        // session's completed_at sits closest to the trophy's earned_at,
        // since the trophy was inserted inside that exact confirm_arrival() call.
        const shapedTrophies = trophyRows.map(t => {
          const candidates = (sessionRows || []).filter(s => s.puzzle_id === t.puzzle_id);
          let best = null, bestDiff = Infinity;
          for (const s of candidates) {
            const diff = Math.abs(new Date(s.completed_at) - new Date(t.earned_at));
            if (diff < bestDiff) { best = s; bestDiff = diff; }
          }
          const campaign = best?.redemptions?.[0]?.campaigns;
          return {
            puzzle_id: t.puzzle_id,
            hunt_name: t.hunt_name,
            earned_at: t.earned_at,
            difficulty: campaign?.difficulty || 'classic',
            business_name: campaign?.businesses?.name || 'Hidden Venue',
          };
        });
        setTrophies(shapedTrophies);
      } else {
        setTrophies([]);
      }
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Compute stats
  const stats = {
    total: hunts.length,
    totalKm: hunts.reduce((s, h) => s + (parseFloat(h.distance_km) || 0), 0).toFixed(1),
    fastestMins: hunts.filter(h => h.duration_mins).reduce((min, h) => Math.min(min, h.duration_mins), 999) || null,
    streak: calcLongestStreak(hunts),
    byDifficulty: {
      casual: hunts.filter(h => h.difficulty === 'casual').length,
      classic: hunts.filter(h => h.difficulty === 'classic').length,
      expert: hunts.filter(h => h.difficulty === 'expert').length,
    },
  };

  // Referral code from user ID
  const referralCode = user ? `MTM-${user.id.slice(0,4).toUpperCase()}` : '';
  const referralUrl = `https://app.mapthemovie.co.uk?ref=${referralCode}`;

  const copyReferral = () => {
    navigator.clipboard.writeText(referralUrl);
    setReferralCopied(true);
    setTimeout(() => setReferralCopied(false), 2000);
  };

  // Unlocked achievements
  const unlocked = ACHIEVEMENTS.filter(a => a.req(hunts, stats, user));

  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Hunter';

  if (initialAuthLoading) {
    return (
      <div style={{
        background: D.bg, minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: D.mono, fontSize: '11px', color: D.textMuted,
        letterSpacing: '3px',
      }}>
        LOADING PASSPORT...
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  const tabs = [
    { id: 'passport', label: 'PASSPORT' },
    { id: 'history',  label: 'HISTORY'  },
    { id: 'badges',   label: 'BADGES'   },
    { id: 'invite',   label: 'INVITE'   },
  ];

  return (
    <div style={{
      background: D.bg, minHeight: '100vh',
      fontFamily: D.body, color: D.text,
      position: 'relative',
    }}>

      {/* Header */}
      <div style={{
        background: D.surface,
        borderBottom: `1px solid ${D.border}`,
        padding: '14px 20px',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px',
            background: `linear-gradient(135deg,${D.purple},${D.purpleL})`,
            borderRadius: '8px', fontSize: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>🎬</div>
          <div>
            <div style={{
              fontFamily: D.mono, fontSize: '8px',
              color: D.purple, letterSpacing: '3px',
            }}>PLAYER PASSPORT</div>
            <div style={{
              fontFamily: D.display, fontWeight: 900,
              fontSize: '15px', color: D.text, lineHeight: 1,
            }}>{displayName}</div>
          </div>
        </div>
        <button onClick={() => supabase.auth.signOut().then(() => { setUser(null); if(onClose) onClose(); })}
          style={{
            background: 'transparent', border: `1px solid ${D.border}`,
            color: D.textMuted, padding: '6px 14px',
            borderRadius: '6px', fontSize: '11px',
            fontFamily: D.mono, cursor: 'pointer', letterSpacing: '1px',
          }}>SIGN OUT</button>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', borderBottom: `1px solid ${D.border}`,
        background: D.surface, overflowX: 'auto',
      }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: 'transparent', border: 'none',
            borderBottom: tab === t.id ? `2px solid ${D.purple}` : '2px solid transparent',
            color: tab === t.id ? D.purple : D.textDim,
            padding: '12px 20px', fontFamily: D.mono,
            fontSize: '9px', letterSpacing: '2px',
            cursor: 'pointer', whiteSpace: 'nowrap',
            transition: 'all .2s', flex: 1,
          }}>{t.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', fontFamily: D.mono, fontSize: '11px', color: D.textMuted, letterSpacing: '3px' }}>
          LOADING PASSPORT...
        </div>
      ) : (
        <div style={{ padding: '20px', paddingBottom: '80px' }}>

          {/* ── PASSPORT TAB ── */}
          {tab === 'passport' && (
            <div>
              {/* Passport cover feel */}
              <div style={{
                background: `linear-gradient(135deg, #0A0A1E, #12102A)`,
                border: `1px solid ${D.border}`,
                borderRadius: '16px',
                padding: '24px',
                marginBottom: '20px',
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                  background: `linear-gradient(90deg,transparent,${D.gold},transparent)`,
                }} />
                <div style={{
                  position: 'absolute', inset: 0,
                  backgroundImage: `radial-gradient(${D.purple}08 1px, transparent 1px)`,
                  backgroundSize: '20px 20px',
                }} />

                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{
                    fontFamily: D.mono, fontSize: '9px',
                    color: D.gold, letterSpacing: '4px', marginBottom: '4px',
                  }}>GEOFICTION LABS</div>
                  <div style={{
                    fontFamily: D.display, fontWeight: 900,
                    fontSize: '11px', color: D.textMuted,
                    letterSpacing: '8px', marginBottom: '20px',
                  }}>HUNTER'S PASSPORT</div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                    <div style={{
                      width: '56px', height: '56px',
                      borderRadius: '50%',
                      background: `linear-gradient(135deg,${D.purple},${D.purpleL})`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '24px',
                      border: `2px solid ${D.gold}40`,
                    }}>🎬</div>
                    <div>
                      <div style={{
                        fontFamily: D.display, fontWeight: 900,
                        fontSize: '22px', color: D.text, lineHeight: 1,
                      }}>{displayName}</div>
                      <div style={{
                        fontFamily: D.mono, fontSize: '9px',
                        color: D.textDim, letterSpacing: '2px', marginTop: '4px',
                      }}>HUNTER SINCE {new Date(user.created_at).toLocaleDateString('en-GB', { month:'short', year:'numeric' }).toUpperCase()}</div>
                    </div>
                  </div>

                  <RankLadder totalHunts={profile?.total_hunts_completed ?? 0} premiereUnlocked={trophies.length >= 1} />

                  {/* Stats row */}
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '20px' }}>
                    <StatCard label="HUNTS" value={stats.total} accent={D.purple} />
                    <StatCard label="KM WALKED" value={stats.totalKm} accent={D.gold} />
                    <StatCard label="BADGES" value={unlocked.length} accent={D.green} sub={`of ${ACHIEVEMENTS.length}`} />
                    {stats.fastestMins && stats.fastestMins < 999 && (
                      <StatCard label="FASTEST" value={`${stats.fastestMins}m`} accent={D.purpleL} />
                    )}
                  </div>
                </div>
              </div>

              <LatestPremiere trophies={trophies} />

              <PrizeWedgeRing hunts={hunts} user={user} />

              {/* Passport stamps */}
              <div style={{
                background: D.card, border: `1px solid ${D.border}`,
                borderRadius: '16px', padding: '20px',
                marginBottom: '20px',
              }}>
                <div style={{
                  fontFamily: D.mono, fontSize: '9px',
                  color: D.textMuted, letterSpacing: '3px', marginBottom: '16px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span>HUNT STAMPS</span>
                  <span style={{ color: D.purple }}>{hunts.length} LOCATIONS FOUND</span>
                </div>

                {hunts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0' }}>
                    <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>🎬</div>
                    <div style={{ fontFamily: D.mono, fontSize: '10px', color: D.textDim, letterSpacing: '2px' }}>
                      NO STAMPS YET
                    </div>
                    <div style={{ fontSize: '13px', color: D.textMuted, marginTop: '6px' }}>
                      Complete your first hunt to earn your first stamp
                    </div>
                  </div>
                ) : (
                  <div style={{
                    display: 'flex', flexWrap: 'wrap',
                    gap: '12px', justifyContent: 'flex-start',
                  }}>
                    {hunts.map((hunt, i) => (
                      <div key={hunt.id} onClick={() => setShareHunt(hunt)}>
                        <PassportStamp hunt={hunt} index={i} animate={true} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Founding Hunter badge */}
              <div style={{
                background: `linear-gradient(135deg,rgba(245,158,11,0.08),rgba(124,58,237,0.08))`,
                border: `1px solid rgba(245,158,11,0.2)`,
                borderRadius: '12px', padding: '16px 20px',
                display: 'flex', alignItems: 'center', gap: '14px',
              }}>
                <div style={{ fontSize: '28px' }}>⭐</div>
                <div>
                  <div style={{
                    fontFamily: D.mono, fontSize: '9px',
                    color: D.gold, letterSpacing: '2px', marginBottom: '3px',
                  }}>FOUNDING HUNTER</div>
                  <div style={{ fontSize: '13px', color: D.textSub, lineHeight: 1.5 }}>
                    You were here before MapTheMovie launched to the world. This badge is permanent.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── HISTORY TAB ── */}
          {tab === 'history' && (
            <div>
              <div style={{
                fontFamily: D.mono, fontSize: '9px',
                color: D.textMuted, letterSpacing: '3px',
                marginBottom: '16px',
              }}>COMPLETED HUNTS — {hunts.length} TOTAL</div>

              {hunts.length === 0 ? (
                <div style={{
                  background: D.card, border: `1px solid ${D.border}`,
                  borderRadius: '14px', padding: '48px 24px', textAlign: 'center',
                }}>
                  <div style={{ fontFamily: D.mono, fontSize: '11px', color: D.textDim, letterSpacing: '2px', marginBottom: '8px' }}>
                    NO HUNTS COMPLETED YET
                  </div>
                  <div style={{ fontSize: '14px', color: D.textMuted }}>
                    Your hunt history will appear here
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {hunts.map((hunt, i) => {
                    const theme = getTheme(hunt);
                    return (
                    <div key={hunt.id} style={{
                      background: theme.gradient,
                      border: `1px solid ${theme.borderColor}`,
                      borderRadius: '14px', padding: '18px 18px',
                      position: 'relative', overflow: 'hidden',
                      animation: `cardReveal 0.5s ease ${i*0.08}s both`,
                    }}>
                      <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                        background: theme.accentGradient,
                      }} />
                      {/* Emoji + hunt name + venue */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
                            background: `${theme.accent}20`, border: `1px solid ${theme.accent}40`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '20px',
                          }}>{hunt.pack_emoji}</div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '16px', color: D.text, marginBottom: '2px' }}>
                              {hunt.pack_name}
                            </div>
                            <div style={{ fontFamily: D.mono, fontSize: '10px', color: theme.accent, letterSpacing: '1px' }}>
                              📍 {hunt.business_name}
                            </div>
                          </div>
                        </div>
                        <div style={{
                          background: hunt.redeemed ? 'rgba(16,185,129,0.1)' : 'rgba(124,58,237,0.1)',
                          border: `1px solid ${hunt.redeemed ? 'rgba(16,185,129,0.3)' : 'rgba(124,58,237,0.3)'}`,
                          borderRadius: '20px', padding: '3px 10px',
                          fontFamily: D.mono, fontSize: '8px',
                          color: hunt.redeemed ? D.green : D.purple,
                          letterSpacing: '1px', flexShrink: 0,
                        }}>
                          {hunt.redeemed ? 'REDEEMED' : 'COMPLETED'}
                        </div>
                      </div>

                      {/* Difficulty pill — same component/colors as the discovery screen */}
                      <div style={{ marginBottom: '12px' }}>
                        <DifficultyPill level={hunt.difficulty} theme={theme} />
                      </div>

                      {/* Stats row */}
                      <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
                        {[
                          { l: 'DATE', v: new Date(hunt.completed_at).toLocaleDateString('en-GB') },
                          { l: 'TIME', v: hunt.duration_mins ? `${hunt.duration_mins} min` : '—' },
                          { l: 'DISTANCE', v: hunt.distance_km ? `${hunt.distance_km} km` : '—' },
                        ].map(s => (
                          <div key={s.l}>
                            <div style={{ fontFamily: D.mono, fontSize: '8px', color: D.textDim, letterSpacing: '1px', marginBottom: '2px' }}>{s.l}</div>
                            <div style={{ fontFamily: D.mono, fontSize: '12px', color: D.textSub }}>{s.v}</div>
                          </div>
                        ))}
                      </div>

                      {/* Voucher code */}
                      {hunt.voucher_code && (
                        <div style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          background: D.cardAlt, borderRadius: '8px', padding: '8px 12px',
                          marginBottom: '10px',
                        }}>
                          <span style={{ fontFamily: D.mono, fontSize: '12px', color: D.gold, letterSpacing: '2px' }}>
                            {hunt.voucher_code}
                          </span>
                          <span style={{ fontFamily: D.mono, fontSize: '9px', color: D.textDim }}>VOUCHER</span>
                        </div>
                      )}

                      {/* Share button */}
                      <button onClick={() => { setShareHunt(hunt); setTab('share'); }}
                        style={{
                          background: 'transparent',
                          border: `1px solid ${D.border}`,
                          color: D.textMuted, padding: '7px 14px',
                          borderRadius: '7px', fontSize: '11px',
                          fontFamily: D.mono, cursor: 'pointer',
                          letterSpacing: '1px',
                        }}>SHARE THIS HUNT</button>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── BADGES TAB ── */}
          {tab === 'badges' && (
            <div>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: '16px',
              }}>
                <div style={{ fontFamily: D.mono, fontSize: '9px', color: D.textMuted, letterSpacing: '3px' }}>
                  ACHIEVEMENTS
                </div>
                <div style={{ fontFamily: D.mono, fontSize: '9px', color: D.purple, letterSpacing: '1px' }}>
                  {unlocked.length} / {ACHIEVEMENTS.length} UNLOCKED
                </div>
              </div>

              {/* Progress bar */}
              <div style={{
                background: D.border, borderRadius: '4px',
                height: '4px', marginBottom: '20px', overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${(unlocked.length / ACHIEVEMENTS.length) * 100}%`,
                  background: `linear-gradient(90deg,${D.purple},${D.gold})`,
                  borderRadius: '4px',
                  transition: 'width 1s ease',
                }} />
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3,1fr)',
                gap: '10px',
              }}>
                {ACHIEVEMENTS.map(a => (
                  <AchievementBadge
                    key={a.id}
                    achievement={a}
                    unlocked={unlocked.some(u => u.id === a.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── INVITE TAB ── */}
          {tab === 'invite' && (
            <div>
              <div style={{
                background: `linear-gradient(135deg,#0A0A1E,#12102A)`,
                border: `1px solid ${D.border}`,
                borderRadius: '16px', padding: '24px',
                marginBottom: '20px',
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                  background: `linear-gradient(90deg,transparent,${D.purple},transparent)`,
                }} />
                <div style={{ fontFamily: D.mono, fontSize: '9px', color: D.purple, letterSpacing: '3px', marginBottom: '8px' }}>
                  YOUR REFERRAL CODE
                </div>
                <div style={{
                  fontFamily: D.display, fontWeight: 900,
                  fontSize: '36px', color: D.gold,
                  letterSpacing: '4px', marginBottom: '8px',
                }}>{referralCode}</div>
                <div style={{ fontSize: '13px', color: D.textMuted, lineHeight: 1.6, marginBottom: '20px' }}>
                  Share your code with friends. When they complete their first hunt you both earn bonus Signal Points.
                </div>

                {/* Copy link */}
                <div style={{
                  background: D.cardAlt, border: `1px solid ${D.border}`,
                  borderRadius: '10px', padding: '12px 14px',
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: '12px',
                }}>
                  <span style={{ fontFamily: D.mono, fontSize: '11px', color: D.textMuted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {referralUrl}
                  </span>
                  <button onClick={copyReferral} style={{
                    background: referralCopied ? D.green : D.purple,
                    border: 'none', color: '#FFF',
                    padding: '6px 14px', borderRadius: '6px',
                    fontSize: '10px', fontFamily: D.mono,
                    cursor: 'pointer', letterSpacing: '1px',
                    flexShrink: 0, marginLeft: '10px',
                    transition: 'background .2s',
                  }}>{referralCopied ? 'COPIED!' : 'COPY'}</button>
                </div>

                {/* Share buttons */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  {[
                    { label: 'WhatsApp', color: '#25D366', url: `https://wa.me/?text=I'm playing MapTheMovie — solve movie trivia to find hidden locations. Join with my code ${referralCode}: ${referralUrl}` },
                    { label: 'Twitter/X', color: '#1DA1F2', url: `https://twitter.com/intent/tweet?text=Solving movie trivia to find hidden real-world locations 🎬 Try MapTheMovie with my code ${referralCode}&url=${referralUrl}` },
                  ].map(s => (
                    <a key={s.label} href={s.url} target="_blank" rel="noreferrer" style={{
                      flex: 1, padding: '10px',
                      background: `${s.color}20`,
                      border: `1px solid ${s.color}40`,
                      borderRadius: '8px', color: s.color,
                      fontSize: '12px', fontFamily: D.mono,
                      textDecoration: 'none', textAlign: 'center',
                      letterSpacing: '1px', display: 'block',
                    }}>{s.label}</a>
                  ))}
                </div>
              </div>

              {/* How it works */}
              <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: '14px', padding: '20px' }}>
                <div style={{ fontFamily: D.mono, fontSize: '9px', color: D.textMuted, letterSpacing: '3px', marginBottom: '14px' }}>HOW REFERRALS WORK</div>
                {[
                  { n:'01', t:'Share your code', b:'Send your unique link to a friend via WhatsApp, text or social media.' },
                  { n:'02', t:'Friend signs up', b:'They create their passport using your referral link.' },
                  { n:'03', t:'They complete a hunt', b:'Your friend completes their first real-world hunt.' },
                  { n:'04', t:'Both get rewarded', b:'You both receive bonus Signal Points automatically.' },
                ].map(s => (
                  <div key={s.n} style={{
                    display: 'flex', gap: '14px',
                    padding: '10px 0', borderBottom: `1px solid ${D.border}`,
                  }}>
                    <div style={{ fontFamily: D.mono, fontSize: '10px', color: D.purple, flexShrink: 0, paddingTop: '2px' }}>{s.n}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: D.text, marginBottom: '2px' }}>{s.t}</div>
                      <div style={{ fontSize: '12px', color: D.textMuted, lineHeight: 1.5 }}>{s.b}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SHARE MODAL ── */}
          {shareHunt && (
            <div style={{
              position: 'fixed', inset: 0,
              background: 'rgba(6,6,14,0.95)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 200, padding: '20px',
            }}>
              <div style={{
                background: D.card, border: `1px solid ${D.border}`,
                borderRadius: '16px', padding: '24px',
                width: '100%', maxWidth: '500px',
              }}>
                <div style={{
                  fontFamily: D.mono, fontSize: '9px',
                  color: D.purple, letterSpacing: '3px', marginBottom: '16px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span>SHARE YOUR HUNT</span>
                  <button onClick={() => setShareHunt(null)} style={{
                    background: 'transparent', border: 'none',
                    color: D.textDim, fontSize: '18px', cursor: 'pointer', lineHeight: 1,
                  }}>×</button>
                </div>

                <ShareCard hunt={shareHunt} playerName={displayName} />

                <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                  <button onClick={() => {
                    const canvas = document.querySelector('canvas');
                    if (!canvas) return;
                    const link = document.createElement('a');
                    link.download = `mapthemovie-${shareHunt.pack_name?.replace(/\s+/g,'-').toLowerCase()}.png`;
                    link.href = canvas.toDataURL();
                    link.click();
                  }} style={{
                    flex: 1, padding: '12px',
                    background: `linear-gradient(135deg,${D.purple},${D.purpleL})`,
                    color: '#FFF', border: 'none', borderRadius: '8px',
                    fontSize: '12px', fontFamily: D.mono,
                    cursor: 'pointer', letterSpacing: '1px',
                  }}>DOWNLOAD IMAGE</button>

                  <button onClick={() => {
                    const text = `I just solved "${shareHunt.pack_name}" and found ${shareHunt.business_name} using only movie trivia 🎬 Can you crack it? app.mapthemovie.co.uk`;
                    if (navigator.share) {
                      navigator.share({ title: 'MapTheMovie', text, url: 'https://app.mapthemovie.co.uk' });
                    } else {
                      navigator.clipboard.writeText(text);
                    }
                  }} style={{
                    flex: 1, padding: '12px',
                    background: 'transparent',
                    border: `1px solid ${D.border}`,
                    color: D.textMuted, borderRadius: '8px',
                    fontSize: '12px', fontFamily: D.mono,
                    cursor: 'pointer', letterSpacing: '1px',
                  }}>SHARE TEXT</button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      <style>{`
        @keyframes cardReveal {
          from { opacity:0; transform:translateY(16px); }
          to { opacity:1; transform:translateY(0); }
        }
        @keyframes stampIn {
          from { opacity:0; transform:scale(0.3) rotate(var(--r,0deg)); }
          60% { transform:scale(1.1) rotate(var(--r,0deg)); }
          to { opacity:1; transform:scale(1) rotate(var(--r,0deg)); }
        }
        @keyframes pulse-dot {
          0%, 100% { box-shadow: 0 0 0 4px rgba(245,158,11,0.25), 0 0 14px #F59E0B; }
          50% { box-shadow: 0 0 0 8px rgba(245,158,11,0.12), 0 0 18px #F59E0B; }
        }
        @keyframes cta-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 4px 20px rgba(245,158,11,0.4); }
          50% { transform: scale(1.03); box-shadow: 0 6px 28px rgba(245,158,11,0.6); }
        }
        @keyframes tease {
          0%, 84% { background-position: 200% 0; }
          92%, 100% { background-position: 0% 0; }
        }

        /* ── premiere card (fixed red/gold trophy identity, never tier-coded) ── */
        .premiere-card {
          position: relative; border-radius: 18px; overflow: hidden;
          background: radial-gradient(ellipse at 50% -20%, rgba(139,21,56,0.35), #0E0E1A 60%);
          border: 1px solid rgba(196,57,106,0.3);
          padding: 28px 20px 22px; text-align: center;
          cursor: pointer;
        }
        .spotlight {
          position: absolute; top: -60%; left: 50%; width: 300px; height: 300px;
          transform: translateX(-50%);
          background: conic-gradient(from 200deg, transparent, rgba(255,255,255,0.06), transparent 40deg);
          pointer-events: none;
        }
        @media (prefers-reduced-motion: no-preference) {
          .spotlight { animation: sweep 5s ease-in-out infinite; }
        }
        @keyframes sweep {
          0%, 100% { transform: translateX(-50%) rotate(-12deg); }
          50% { transform: translateX(-50%) rotate(12deg); }
        }
        .premiere-eyebrow {
          font-family: 'Share Tech Mono', monospace; font-size: 9.5px; letter-spacing: 3px;
          color: #C4396A; margin-bottom: 14px; position: relative;
        }
        .laurel-badge {
          width: 120px; height: 120px; margin: 0 auto 14px; position: relative;
          display: flex; align-items: center; justify-content: center;
        }
        .laurel-svg { width: 100%; height: 100%; position: absolute; inset: 0; }
        .laurel-icon { font-size: 38px; z-index: 2; filter: drop-shadow(0 2px 8px rgba(0,0,0,0.5)); }
        .premiere-title { font-family: 'Nunito', sans-serif; font-weight: 900; font-size: 19px; margin-bottom: 4px; }
        .premiere-sub { font-size: 12px; color: #8B8B9A; font-style: italic; margin-bottom: 14px; }
        .premiere-meta {
          display: flex; justify-content: center; gap: 18px; font-family: 'Share Tech Mono', monospace;
          font-size: 10px; color: #6B67A0;
        }
        .premiere-meta span b { color: #FCD34D; display: block; font-size: 13px; margin-top: 2px; }

        .flash-veil {
          position: absolute; inset: 0; background: #fff; opacity: 0;
          pointer-events: none; border-radius: 18px;
        }
        @media (prefers-reduced-motion: no-preference) {
          .premiere-card.flash { animation: flash-pulse 0.5s ease; }
          .premiere-card.flash .flash-veil { animation: flash-veil 0.5s ease; }
        }
        @keyframes flash-pulse {
          0% { transform: scale(1); } 30% { transform: scale(1.03); } 100% { transform: scale(1); }
        }
        @keyframes flash-veil {
          0% { opacity: 0; } 15% { opacity: 0.35; } 100% { opacity: 0; }
        }
        /* Reduced motion: spotlight is decorative-only (same treatment as
           reveal-flash/reveal-shimmer on Arrival Reveal) -- dropped entirely
           rather than left static, since a frozen conic-gradient wedge reads
           as a rendering glitch. Tap-to-flash keeps a plain opacity fade on
           the veil so the tap still gets acknowledgement, with the card's
           scale-pulse removed -- same "content fades, decoration drops" split
           as revealSimpleFade. */
        @media (prefers-reduced-motion: reduce) {
          .spotlight { display: none; }
          .premiere-card.flash .flash-veil {
            animation: flash-veil-simple 240ms ease-out both;
            transform: none;
          }
        }
        @keyframes flash-veil-simple {
          0%   { opacity: 0.25; }
          100% { opacity: 0; }
        }

        .more-row {
          display: flex; align-items: center; justify-content: space-between;
          margin-top: 10px; padding: 12px 16px;
          background: #0E0E1A; border: 1px solid #2A2A3A;
          border-radius: 12px; cursor: pointer;
          font-family: 'Share Tech Mono', monospace; font-size: 11.5px; color: #B8B4D8;
          letter-spacing: 0.5px;
        }
        .more-row .chev { color: #6B67A0; display: inline-block; transition: transform 0.2s; }
        .more-row.open .chev { transform: rotate(90deg); }
      `}</style>
    </div>
  );
}
