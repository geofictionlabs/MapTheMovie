// Genre theming + tier-color system, shared across screens.
//
// Extracted out of HuntSelectionScreen.jsx (2026-07-19) so that
// route-based code splitting can lazy-load screens independently.
// Dashboard.jsx, PlayerPassport.jsx, and CommandCenter.jsx (via
// FlightDeck.jsx) only ever needed the small color/theme data here,
// not HuntSelectionScreen's actual card-rendering component -- before
// this split, importing DIFFICULTY_COLORS from HuntSelectionScreen.jsx
// would have pulled that whole screen's chunk in just for a handful of
// hex strings, undermining the point of splitting it out at all.
// HuntSelectionScreen.jsx itself now imports these back from here,
// same as everyone else -- single source of truth, no re-export shim.

// ── THEME DEFINITIONS ─────────────────────────────────────────
export const THEMES = {
  general: {
    gradient: 'linear-gradient(145deg, #0D0820 0%, #1A0A3E 50%, #0D0820 100%)',
    accentGradient: 'linear-gradient(90deg, #7C3AED, #9D5FF5)',
    accent: '#9D5FF5',
    glow: 'rgba(124,58,237,0.5)',
    borderColor: 'rgba(157,95,245,0.3)',
    label: 'MOVIE TRIVIA',
    labelBg: 'rgba(124,58,237,0.15)',
    labelBorder: 'rgba(124,58,237,0.4)',
    icon: '🎬',
    sideBarPattern: 'filmstrip',
    tagline: 'The classics await',
  },
  horror: {
    gradient: 'linear-gradient(145deg, #0A0000 0%, #200000 40%, #0A0000 100%)',
    accentGradient: 'linear-gradient(90deg, #B91C1C, #EF4444)',
    accent: '#EF4444',
    glow: 'rgba(239,68,68,0.6)',
    borderColor: 'rgba(239,68,68,0.25)',
    label: 'HORROR',
    labelBg: 'rgba(185,28,28,0.2)',
    labelBorder: 'rgba(239,68,68,0.5)',
    icon: '🩸',
    sideBarPattern: 'drips',
    tagline: 'If you dare...',
  },
  scifi: {
    gradient: 'linear-gradient(145deg, #00081A 0%, #001830 50%, #00081A 100%)',
    accentGradient: 'linear-gradient(90deg, #0284C7, #06B6D4)',
    accent: '#06B6D4',
    glow: 'rgba(6,182,212,0.5)',
    borderColor: 'rgba(6,182,212,0.25)',
    label: 'SCI-FI',
    labelBg: 'rgba(6,182,212,0.1)',
    labelBorder: 'rgba(6,182,212,0.4)',
    icon: '🚀',
    sideBarPattern: 'circuit',
    tagline: 'Beyond the known',
  },
  action: {
    gradient: 'linear-gradient(145deg, #0A0600 0%, #1C1000 50%, #0A0600 100%)',
    accentGradient: 'linear-gradient(90deg, #D97706, #F59E0B)',
    accent: '#F59E0B',
    glow: 'rgba(245,158,11,0.5)',
    borderColor: 'rgba(245,158,11,0.25)',
    label: 'ACTION',
    labelBg: 'rgba(245,158,11,0.1)',
    labelBorder: 'rgba(245,158,11,0.4)',
    icon: '💥',
    sideBarPattern: 'jagged',
    tagline: 'No time to waste',
  },
  romance: {
    gradient: 'linear-gradient(145deg, #100614 0%, #220830 50%, #100614 100%)',
    accentGradient: 'linear-gradient(90deg, #BE185D, #EC4899)',
    accent: '#EC4899',
    glow: 'rgba(236,72,153,0.5)',
    borderColor: 'rgba(236,72,153,0.25)',
    label: 'ROMANCE',
    labelBg: 'rgba(236,72,153,0.1)',
    labelBorder: 'rgba(236,72,153,0.4)',
    icon: '💋',
    sideBarPattern: 'hearts',
    tagline: 'Follow your heart',
  },
  comedy: {
    gradient: 'linear-gradient(145deg, #040A00 0%, #0A1800 50%, #040A00 100%)',
    accentGradient: 'linear-gradient(90deg, #65A30D, #84CC16)',
    accent: '#84CC16',
    glow: 'rgba(132,204,22,0.5)',
    borderColor: 'rgba(132,204,22,0.25)',
    label: 'COMEDY',
    labelBg: 'rgba(132,204,22,0.1)',
    labelBorder: 'rgba(132,204,22,0.4)',
    icon: '😂',
    sideBarPattern: 'zigzag',
    tagline: 'Laughter guaranteed',
  },
  thriller: {
    gradient: 'linear-gradient(145deg, #050510 0%, #0A0A22 50%, #050510 100%)',
    accentGradient: 'linear-gradient(90deg, #6366F1, #818CF8)',
    accent: '#818CF8',
    glow: 'rgba(129,140,248,0.5)',
    borderColor: 'rgba(129,140,248,0.25)',
    label: 'THRILLER',
    labelBg: 'rgba(129,140,248,0.1)',
    labelBorder: 'rgba(129,140,248,0.4)',
    icon: '🔪',
    sideBarPattern: 'static',
    tagline: 'Trust no one',
  },
  fantasy: {
    gradient: 'linear-gradient(145deg, #020A02 0%, #0A2410 45%, #020A02 100%)',
    accentGradient: 'linear-gradient(90deg, #15803D, #22C55E)',
    accent: '#22C55E',
    glow: 'rgba(34,197,94,0.5)',
    borderColor: 'rgba(34,197,94,0.25)',
    label: 'FANTASY',
    labelBg: 'rgba(21,128,61,0.15)',
    labelBorder: 'rgba(34,197,94,0.4)',
    icon: '⚔️',
    sideBarPattern: 'elvish',
    tagline: 'A realm awaits',
  },
  drama: {
    gradient: 'linear-gradient(145deg, #0A0204 0%, #300818 45%, #0A0204 100%)',
    accentGradient: 'linear-gradient(90deg, #B45309, #FCD34D)',
    accent: '#FCD34D',
    glow: 'rgba(252,211,77,0.45)',
    borderColor: 'rgba(252,211,77,0.25)',
    label: 'DRAMA',
    labelBg: 'rgba(180,83,9,0.15)',
    labelBorder: 'rgba(252,211,77,0.4)',
    icon: '🎞️',
    sideBarPattern: 'spotlight',
    tagline: 'Every frame matters',
  },
  mystery: {
    gradient: 'linear-gradient(145deg, #05070A 0%, #1B222C 45%, #05070A 100%)',
    accentGradient: 'linear-gradient(90deg, #475569, #64748B)',
    accent: '#94A3B8',
    glow: 'rgba(148,163,184,0.45)',
    borderColor: 'rgba(148,163,184,0.25)',
    label: 'MYSTERY',
    labelBg: 'rgba(71,85,105,0.18)',
    labelBorder: 'rgba(148,163,184,0.4)',
    icon: '🔍',
    sideBarPattern: 'fog',
    tagline: 'Nothing is as it seems',
  },
  family: {
    gradient: 'linear-gradient(145deg, #1A1200 0%, #0C2624 55%, #041A18 100%)',
    accentGradient: 'linear-gradient(90deg, #F59E0B, #2DD4BF)',
    accent: '#F59E0B',
    glow: 'rgba(245,158,11,0.45)',
    borderColor: 'rgba(245,158,11,0.25)',
    label: 'FAMILY',
    labelBg: 'rgba(245,158,11,0.12)',
    labelBorder: 'rgba(245,158,11,0.4)',
    icon: '🎈',
    sideBarPattern: 'stars',
    tagline: 'Fun for everyone',
  },
};

export function getTheme(hunt) {
  const genre = (
    hunt?.puzzle_packs?.genre ||
    hunt?.genre ||
    hunt?.theme_tag ||
    'general'
  ).toLowerCase();
  const key = THEMES[genre] ? genre : 'general';
  return { ...THEMES[key], key };
}

// Canonical tier-color mapping for the whole app -- this is the live
// discovery screen's mapping, standardized on elsewhere (PassportStamp
// in PlayerPassport.jsx, plus 5 more locations across App.jsx/
// Dashboard.jsx/CommandCenter.jsx) after it was found to disagree with
// independently-invented colors in each of those places.
export const DIFFICULTY_COLORS = {
  casual:  { bars: 1, color: '#10B981', label: 'CASUAL' },
  classic: { bars: 2, color: '#7C3AED', label: 'CLASSIC' },
  expert:  { bars: 3, color: '#F59E0B', label: 'EXPERT' },
  cipher:  { bars: 4, color: '#EF4444', label: 'CIPHER' },
};

export function DifficultyPill({ level, theme }) {
  const d = DIFFICULTY_COLORS[level?.toLowerCase()] || DIFFICULTY_COLORS.classic;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '7px',
      minHeight: '28px', boxSizing: 'border-box',
      background: `${d.color}18`,
      border: `1.5px solid ${theme ? theme.accent + '70' : d.color + '50'}`,
      boxShadow: `0 0 10px ${d.color}40`,
      borderRadius: '20px', padding: '6px 14px',
    }}>
      <div style={{ display: 'flex', gap: '2px' }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{
            width: '3px', height: '12px', borderRadius: '2px',
            background: i <= d.bars ? d.color : 'rgba(255,255,255,0.12)',
          }}/>
        ))}
      </div>
      <span style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontWeight: 700,
        fontSize: '11px', color: d.color, letterSpacing: '1.5px',
      }}>{d.label}</span>
    </div>
  );
}
