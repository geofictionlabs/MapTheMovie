// ══════════════════════════════════════════════════════════════
// HUNT SELECTION SCREEN — Genre-differentiated cards
// Each genre has a completely unique visual identity
// ══════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from "react";

// ── COORD MASKER ──────────────────────────────────────────────
const maskCoord = (raw) =>
  raw ? String(raw).replace(/[0-9a-zA-Z]/g, '?') : '??.??????';

// ── THEME DEFINITIONS ─────────────────────────────────────────
const THEMES = {
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
  evergreen_80s: {
    gradient: 'linear-gradient(145deg, #0A0014 0%, #18002E 30%, #280040 60%, #0A0014 100%)',
    accentGradient: 'linear-gradient(90deg, #C026D3, #FF00FF)',
    accent: '#FF00FF',
    glow: 'rgba(255,0,255,0.5)',
    borderColor: 'rgba(255,0,255,0.25)',
    label: '80s NOSTALGIA',
    labelBg: 'rgba(255,0,255,0.1)',
    labelBorder: 'rgba(255,0,255,0.4)',
    icon: '📼',
    sideBarPattern: 'retro',
    tagline: 'Rewind & play',
  },
};

function getTheme(hunt) {
  const genre = (
    hunt?.puzzle_packs?.genre ||
    hunt?.genre ||
    hunt?.theme_tag ||
    'general'
  ).toLowerCase();
  return THEMES[genre] || THEMES.general;
}

// ── GENRE SVG DECORATIONS ──────────────────────────────────────
function GenreDecoration({ theme }) {
  const p = theme.sideBarPattern;
  const accent = theme.accent;

  if (p === 'drips') return (
    <svg width="36" height="100%" viewBox="0 0 36 300" preserveAspectRatio="none"
      style={{ position: 'absolute', left: 0, top: 0, bottom: 0, height: '100%', opacity: 0.7 }}>
      <rect x="0" y="0" width="3" height="300" fill={accent} opacity="0.4"/>
      {[30, 80, 140, 210].map((y, i) => (
        <g key={i}>
          <ellipse cx="8" cy={y} rx="5" ry="7" fill={accent} opacity="0.9"/>
          <path d={`M3 ${y+5} Q8 ${y+28} 13 ${y+40} Q8 ${y+45} 3 ${y+40} Z`} fill={accent} opacity="0.6"/>
        </g>
      ))}
    </svg>
  );

  if (p === 'circuit') return (
    <svg width="36" height="100%" viewBox="0 0 36 300" preserveAspectRatio="none"
      style={{ position: 'absolute', left: 0, top: 0, bottom: 0, height: '100%', opacity: 0.5 }}>
      <line x1="18" y1="0" x2="18" y2="300" stroke={accent} strokeWidth="1.5"/>
      {[40, 90, 140, 200, 255].map((y, i) => (
        <g key={i}>
          {i % 2 === 0
            ? <><line x1="18" y1={y} x2="32" y2={y} stroke={accent} strokeWidth="1"/><circle cx="32" cy={y} r="3" fill={accent}/></>
            : <><line x1="18" y1={y} x2="5" y2={y} stroke={accent} strokeWidth="1"/><rect x="2" y={y-3} width="6" height="6" fill="none" stroke={accent} strokeWidth="1"/></>
          }
        </g>
      ))}
    </svg>
  );

  if (p === 'filmstrip') return (
    <svg width="36" height="100%" viewBox="0 0 36 300" preserveAspectRatio="none"
      style={{ position: 'absolute', left: 0, top: 0, bottom: 0, height: '100%', opacity: 0.35 }}>
      <rect x="4" y="0" width="28" height="300" fill="none" stroke={accent} strokeWidth="1"/>
      <rect x="0" y="0" width="4" height="300" fill={accent} opacity="0.3"/>
      <rect x="32" y="0" width="4" height="300" fill={accent} opacity="0.3"/>
      {Array.from({length: 14}, (_, i) => (
        <rect key={i} x="8" y={i*22+4} width="20" height="14" rx="1" fill={accent} opacity="0.5"/>
      ))}
    </svg>
  );

  if (p === 'hearts') return (
    <svg width="36" height="100%" viewBox="0 0 36 300" preserveAspectRatio="none"
      style={{ position: 'absolute', left: 0, top: 0, bottom: 0, height: '100%', opacity: 0.6 }}>
      <line x1="18" y1="0" x2="18" y2="300" stroke={accent} strokeWidth="1" opacity="0.3"/>
      {[30, 90, 150, 210, 270].map((y, i) => (
        <path key={i} d={`M18 ${y+10} C18 ${y+10} 6 ${y+2} 6 ${y-6} C6 ${y-16} 18 ${y-16} 18 ${y-6} C18 ${y-16} 30 ${y-16} 30 ${y-6} C30 ${y+2} 18 ${y+10} 18 ${y+10}Z`}
          fill={accent} opacity={i % 2 === 0 ? "0.8" : "0.4"}/>
      ))}
    </svg>
  );

  if (p === 'retro') return (
    <svg width="36" height="100%" viewBox="0 0 36 300" preserveAspectRatio="none"
      style={{ position: 'absolute', left: 0, top: 0, bottom: 0, height: '100%', opacity: 0.6 }}>
      {Array.from({length: 20}, (_, i) => (
        <line key={i} x1="0" y1={i*16} x2="36" y2={i*16+8}
          stroke={i % 3 === 0 ? '#00FFFF' : i % 3 === 1 ? accent : '#FF69B4'}
          strokeWidth="1.5" opacity="0.7"/>
      ))}
    </svg>
  );

  if (p === 'zigzag') return (
    <svg width="36" height="100%" viewBox="0 0 36 300" preserveAspectRatio="none"
      style={{ position: 'absolute', left: 0, top: 0, bottom: 0, height: '100%', opacity: 0.5 }}>
      <polyline points="0,0 18,20 0,40 18,60 0,80 18,100 0,120 18,140 0,160 18,180 0,200 18,220 0,240 18,260 0,280 18,300"
        stroke={accent} strokeWidth="2" fill="none"/>
    </svg>
  );

  // Default bar
  return (
    <div style={{
      position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px',
      background: `linear-gradient(180deg, transparent, ${theme.accent}, transparent)`,
    }} />
  );
}

// ── DIFFICULTY PILL ────────────────────────────────────────────
function DifficultyPill({ level }) {
  const cfg = {
    casual:  { bars: 1, color: '#10B981', label: 'CASUAL' },
    classic: { bars: 2, color: '#F59E0B', label: 'CLASSIC' },
    expert:  { bars: 3, color: '#EF4444', label: 'EXPERT' },
    cipher:  { bars: 4, color: '#8B5CF6', label: 'CIPHER' },
  };
  const d = cfg[level?.toLowerCase()] || cfg.classic;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      background: `${d.color}18`,
      border: `1px solid ${d.color}50`,
      borderRadius: '20px', padding: '3px 10px',
    }}>
      <div style={{ display: 'flex', gap: '2px' }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{
            width: '3px', height: '10px', borderRadius: '2px',
            background: i <= d.bars ? d.color : 'rgba(255,255,255,0.1)',
          }}/>
        ))}
      </div>
      <span style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: '8px', color: d.color, letterSpacing: '1px',
      }}>{d.label}</span>
    </div>
  );
}

// ── WALK TIME ─────────────────────────────────────────────────
function walkTime(metres) {
  if (!metres || metres < 0) return null;
  const mins = Math.round(metres / 80);
  if (mins < 1) return "< 1 MIN";
  if (mins > 60) return `${Math.round(mins / 60)}HR`;
  return `${mins} MIN`;
}

// ── HUNT CARD ─────────────────────────────────────────────────
function HuntCard({ hunt, onSelect, index }) {
  const theme = getTheme(hunt);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    setTilt({
      x: ((e.clientY - cy) / (rect.height / 2)) * -5,
      y: ((e.clientX - cx) / (rect.width / 2)) * 5,
    });
  };

  const slots = hunt.puzzle_packs?.coordinate_slots ?? hunt.coordinate_slots ?? 12;
  const wt = walkTime(hunt.distance_metres);
  const name = hunt.name || hunt.pack_name || 'Mystery Hunt';
  const desc = hunt.description || theme.tagline;

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { setHovered(false); setTilt({ x: 0, y: 0 }); }}
      onMouseEnter={() => setHovered(true)}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => { setHovered(true); setPressed(true); }}
      onTouchEnd={() => { setHovered(false); setPressed(false); }}
      onClick={() => onSelect(hunt)}
      style={{
        position: 'relative',
        borderRadius: '16px',
        overflow: 'hidden',
        cursor: 'pointer',
        border: `1px solid ${hovered ? theme.accent + '60' : theme.borderColor}`,
        transform: pressed
          ? 'scale(0.97)'
          : hovered
            ? `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(1.025) translateY(-3px)`
            : 'scale(1)',
        transition: pressed ? 'transform 0.08s' : 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        boxShadow: hovered
          ? `0 24px 60px ${theme.glow}, 0 0 0 1px ${theme.accent}30`
          : `0 4px 24px rgba(0,0,0,0.5)`,
        animation: `cardReveal 0.5s ease ${index * 0.12}s both`,
      }}
    >
      {/* Background */}
      <div style={{ position: 'absolute', inset: 0, background: theme.gradient }} />

      {/* Genre decoration on left */}
      <GenreDecoration theme={theme} />

      {/* Top glow line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
        background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`,
        opacity: hovered ? 1 : 0.35,
        transition: 'opacity 0.3s',
      }} />

      {/* Scan line on hover */}
      {hovered && (
        <div style={{
          position: 'absolute', left: 0, right: 0, height: '1px',
          background: `linear-gradient(90deg, transparent, ${theme.accent}80, transparent)`,
          animation: 'scanDown 1.8s linear infinite',
          pointerEvents: 'none', zIndex: 10,
        }} />
      )}

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2, padding: '20px 20px 20px 48px' }}>

        {/* Top row — genre badge + live */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: '14px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: theme.labelBg,
            border: `1px solid ${theme.labelBorder}`,
            borderRadius: '20px', padding: '4px 10px',
          }}>
            <span style={{ fontSize: '12px' }}>{theme.icon}</span>
            <span style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: '8px', color: theme.accent, letterSpacing: '1.5px',
            }}>{theme.label}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: '#10B981', boxShadow: '0 0 8px #10B981',
              animation: 'pulse 2s infinite',
            }} />
            <span style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: '8px', color: '#10B981', letterSpacing: '1px',
            }}>LIVE</span>
          </div>
        </div>

        {/* Name */}
        <div style={{
          fontFamily: "'Nunito', sans-serif",
          fontWeight: 900, fontSize: '21px',
          color: '#F1F0FF', lineHeight: 1.1, marginBottom: '5px',
          textShadow: hovered ? `0 0 20px ${theme.glow}` : 'none',
          transition: 'text-shadow 0.3s',
        }}>{name}</div>

        {/* Tagline */}
        <div style={{
          fontSize: '12px', color: 'rgba(255,255,255,0.38)',
          marginBottom: '14px', fontStyle: 'italic', lineHeight: 1.4,
        }}>{desc}</div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '7px', marginBottom: '13px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '6px', padding: '4px 8px',
          }}>
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              <circle cx="4.5" cy="4.5" r="3.5" stroke={theme.accent} strokeWidth="1"/>
              <circle cx="4.5" cy="4.5" r="1.5" fill={theme.accent}/>
            </svg>
            <span style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: '9px', color: 'rgba(255,255,255,0.5)', letterSpacing: '1px',
            }}>{slots} CLUES</span>
          </div>

          {wt && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '6px', padding: '4px 8px',
            }}>
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                <circle cx="4.5" cy="4.5" r="3.5" stroke={theme.accent} strokeWidth="1"/>
                <path d="M4.5 2v2.5l1.5 1.5" stroke={theme.accent} strokeWidth="1" strokeLinecap="round"/>
              </svg>
              <span style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '9px', color: 'rgba(255,255,255,0.5)', letterSpacing: '1px',
              }}>{wt} WALK</span>
            </div>
          )}

          {hunt.has_prize && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.35)',
              borderRadius: '6px', padding: '4px 8px',
            }}>
              <span style={{ fontSize: '9px' }}>🏆</span>
              <span style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '9px', color: '#F59E0B', letterSpacing: '1px',
              }}>PRIZE</span>
            </div>
          )}
        </div>

        {/* Difficulty */}
        <div style={{ marginBottom: '14px' }}>
          <DifficultyPill level={hunt.difficulty} />
        </div>

        {/* Destination */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(0,0,0,0.3)',
          border: `1px solid ${theme.accent}18`,
          borderRadius: '10px', padding: '10px 14px', marginBottom: '14px',
        }}>
          <div>
            <div style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: '7px', color: 'rgba(255,255,255,0.22)',
              letterSpacing: '2px', marginBottom: '4px',
            }}>DESTINATION LOCKED</div>
            <div style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: '13px', color: theme.accent, letterSpacing: '2px',
            }}>
              {maskCoord(hunt.masked_lat)}° N &nbsp;{maskCoord(hunt.masked_lon)}° E
            </div>
          </div>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%',
            border: `1px solid ${theme.accent}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="5" r="2.5" stroke={theme.accent} strokeWidth="1"/>
              <path d="M3.5 7 Q6 11 8.5 7" stroke={theme.accent} strokeWidth="1" fill="none"/>
              <line x1="6" y1="1" x2="6" y2="2.5" stroke={theme.accent} strokeWidth="1"/>
              <line x1="9.5" y1="5" x2="11" y2="5" stroke={theme.accent} strokeWidth="1"/>
              <line x1="1" y1="5" x2="2.5" y2="5" stroke={theme.accent} strokeWidth="1"/>
            </svg>
          </div>
        </div>

        {/* CTA */}
        <div style={{
          background: hovered ? theme.accentGradient : 'rgba(255,255,255,0.04)',
          border: `1px solid ${hovered ? 'transparent' : theme.accent + '30'}`,
          borderRadius: '10px', padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          transition: 'all 0.25s',
        }}>
          <span style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '11px', fontWeight: 700,
            color: hovered ? '#000' : theme.accent,
            letterSpacing: '2px', transition: 'color 0.25s',
          }}>START HUNT →</span>
          <span style={{ fontSize: '16px' }}>{theme.icon}</span>
        </div>
      </div>
    </div>
  );
}

// ── PRIZE POOL BANNER ─────────────────────────────────────────
function PrizePoolBanner({ pool }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 200); }, []);
  if (!pool || pool <= 0) return null;
  return (
    <div style={{
      background: 'linear-gradient(135deg, #110A00, #221400)',
      border: '1px solid rgba(245,158,11,0.25)',
      borderRadius: '14px', padding: '14px 18px', marginBottom: '20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(-8px)',
      transition: 'all 0.5s ease', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
        background: 'linear-gradient(90deg, transparent, #F59E0B80, transparent)',
      }} />
      <div>
        <div style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '8px', color: '#F59E0B',
          letterSpacing: '3px', marginBottom: '4px',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#F59E0B', animation: 'pulse 1.5s infinite' }} />
          QUARTERLY CIPHER — ACTIVE
        </div>
        <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: '22px', color: '#F1F0FF', lineHeight: 1 }}>
          £{pool} <span style={{ fontSize: '12px', color: '#6B6890', fontWeight: 400 }}>prize pool</span>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', color: '#6B6890', letterSpacing: '1px', marginBottom: '2px' }}>FIRST TO ARRIVE</div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', color: '#F59E0B', letterSpacing: '1px' }}>WINS EVERYTHING</div>
      </div>
    </div>
  );
}

// ── HEADER ────────────────────────────────────────────────────
function SelectionHeader({ playerCount }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ padding: '20px 20px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#32325A', letterSpacing: '2px' }}>
          {time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </div>
        {playerCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '20px', padding: '3px 10px' }}>
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10B981', animation: 'pulse 1.5s infinite' }} />
            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', color: '#10B981', letterSpacing: '1px' }}>{playerCount} HUNTING NOW</span>
          </div>
        )}
      </div>
      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#7C3AED', letterSpacing: '4px', marginBottom: '6px' }}>HUNTS NEAR YOU</div>
      <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: '26px', color: '#F1F0FF', lineHeight: 1, letterSpacing: '-0.5px' }}>Choose your mission.</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '60px 24px' }}>
      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', color: '#32325A', letterSpacing: '3px', marginBottom: '8px' }}>SCANNING FOR HUNTS</div>
      <div style={{ fontSize: '14px', color: '#4A4A6A', lineHeight: 1.6 }}>No active hunts in your area yet.<br/>Check back soon.</div>
    </div>
  );
}

function LoadingState() {
  return (
    <div>
      {[0,1,2].map(i => (
        <div key={i} style={{
          borderRadius: '16px',
          background: 'linear-gradient(90deg, #0E0E1A 25%, #1A1A2E 50%, #0E0E1A 75%)',
          backgroundSize: '200% 100%',
          animation: `shimmer 1.5s ${i * 0.2}s infinite`,
          height: '220px', marginBottom: '14px',
        }} />
      ))}
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────
export default function HuntSelectionScreen({
  hunts = [],
  onSelect,
  loading = false,
  prizePool = 0,
  playerCount = 0,
}) {
  const [filter, setFilter] = useState('all');
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 80); }, []);

  const difficulties = ['all', 'casual', 'classic', 'expert'];
  const filtered = filter === 'all' ? hunts : hunts.filter(h => h.difficulty?.toLowerCase() === filter);

  return (
    <div style={{ background: '#06060E', minHeight: '100vh', fontFamily: "'Space Grotesk', sans-serif", color: '#F1F0FF', opacity: visible ? 1 : 0, transition: 'opacity 0.4s ease' }}>
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at 20% 20%, rgba(124,58,237,0.05) 0%, transparent 60%)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <SelectionHeader playerCount={playerCount} />

        <div style={{ display: 'flex', gap: '6px', padding: '14px 20px', overflowX: 'auto' }}>
          {difficulties.map(d => (
            <button key={d} onClick={() => setFilter(d)} style={{
              background: filter === d ? '#7C3AED' : 'transparent',
              border: `1px solid ${filter === d ? '#7C3AED' : '#1E1E2E'}`,
              color: filter === d ? '#FFF' : '#6B67A0',
              borderRadius: '20px', padding: '5px 14px',
              fontFamily: "'Share Tech Mono', monospace", fontSize: '9px',
              letterSpacing: '2px', cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'all .2s', textTransform: 'uppercase',
            }}>{d === 'all' ? 'ALL HUNTS' : d}</button>
          ))}
        </div>

        <div style={{ padding: '0 20px 100px' }}>
          <PrizePoolBanner pool={prizePool} />
          {loading ? <LoadingState /> : filtered.length === 0 ? <EmptyState /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {filtered.map((hunt, i) => (
                <HuntCard key={hunt.id || i} hunt={hunt} onSelect={onSelect} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes cardReveal { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        @keyframes scanDown { 0% { top:0; } 100% { top:100%; } }
        @keyframes shimmer { 0% { background-position:200% 0; } 100% { background-position:-200% 0; } }
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
      `}</style>
    </div>
  );
}
