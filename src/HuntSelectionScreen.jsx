// ══════════════════════════════════════════════════════════════
// HUNT SELECTION SCREEN — Drop-in replacement
// Import and use instead of existing hunt list
// Props: hunts (array), onSelect (function), userLat, userLon
// ══════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from "react";

// ── THEME DEFINITIONS ─────────────────────────────────────────
// Each theme has its own visual identity
const THEMES = {
  general: {
    gradient: 'linear-gradient(135deg, #1A0A2E 0%, #2D1B69 40%, #1A0A2E 100%)',
    accent: '#9D5FF5',
    glow: 'rgba(124,58,237,0.4)',
    particle: '#7C3AED',
    icon: '🎬',
    label: 'MOVIE TRIVIA',
    atmosphere: 'cinematic',
  },
  horror: {
    gradient: 'linear-gradient(135deg, #1A0000 0%, #3D0000 40%, #1A0000 100%)',
    accent: '#EF4444',
    glow: 'rgba(239,68,68,0.4)',
    particle: '#EF4444',
    icon: '🩸',
    label: 'HORROR',
    atmosphere: 'dark',
  },
  scifi: {
    gradient: 'linear-gradient(135deg, #001A2E 0%, #003D5C 40%, #001A2E 100%)',
    accent: '#06B6D4',
    glow: 'rgba(6,182,212,0.4)',
    particle: '#06B6D4',
    icon: '🚀',
    label: 'SCI-FI',
    atmosphere: 'neon',
  },
  action: {
    gradient: 'linear-gradient(135deg, #1A0E00 0%, #3D2200 40%, #1A0E00 100%)',
    accent: '#F59E0B',
    glow: 'rgba(245,158,11,0.4)',
    particle: '#F59E0B',
    icon: '💥',
    label: 'ACTION',
    atmosphere: 'explosive',
  },
  romance: {
    gradient: 'linear-gradient(135deg, #1A0A14 0%, #3D0A24 40%, #1A0A14 100%)',
    accent: '#EC4899',
    glow: 'rgba(236,72,153,0.4)',
    particle: '#EC4899',
    icon: '💋',
    label: 'ROMANCE',
    atmosphere: 'warm',
  },
  comedy: {
    gradient: 'linear-gradient(135deg, #0A1A00 0%, #1A3D00 40%, #0A1A00 100%)',
    accent: '#84CC16',
    glow: 'rgba(132,204,22,0.4)',
    particle: '#84CC16',
    icon: '😂',
    label: 'COMEDY',
    atmosphere: 'bright',
  },
  thriller: {
    gradient: 'linear-gradient(135deg, #0A0A1A 0%, #1A1A3D 40%, #0A0A1A 100%)',
    accent: '#818CF8',
    glow: 'rgba(129,140,248,0.4)',
    particle: '#818CF8',
    icon: '🔪',
    label: 'THRILLER',
    atmosphere: 'tense',
  },
  evergreen_80s: {
    gradient: 'linear-gradient(135deg, #1A002E 0%, #2D006E 30%, #6D0080 60%, #1A002E 100%)',
    accent: '#FF00FF',
    glow: 'rgba(255,0,255,0.4)',
    particle: '#FF00FF',
    icon: '📼',
    label: '80s NOSTALGIA',
    atmosphere: 'synthwave',
  },
};

function getTheme(hunt) {
  const genre = (
    hunt?.genre ||
    hunt?.theme_tag ||
    hunt?.pack_genre ||
    hunt?.puzzle_packs?.genre ||
    hunt?.content_type ||
    'general'
  ).toLowerCase();
  return THEMES[genre] || THEMES.general;
}

// ── PARTICLE SYSTEM ───────────────────────────────────────────
function Particles({ color, count = 12 }) {
  const particles = Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 1 + Math.random() * 2,
    duration: 3 + Math.random() * 4,
    delay: Math.random() * 3,
  }));

  return (
    <div style={{
      position: 'absolute', inset: 0,
      overflow: 'hidden', pointerEvents: 'none',
    }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute',
          left: `${p.x}%`,
          top: `${p.y}%`,
          width: `${p.size}px`,
          height: `${p.size}px`,
          borderRadius: '50%',
          background: color,
          opacity: 0,
          animation: `particleFloat ${p.duration}s ${p.delay}s ease-in-out infinite`,
        }} />
      ))}
    </div>
  );
}

// ── DIFFICULTY VISUAL ─────────────────────────────────────────
function DifficultyBar({ level }) {
  const levels = { casual: 1, classic: 2, expert: 3, cipher: 4 };
  const filled = levels[level?.toLowerCase()] || 2;
  const labels = { 1: 'CASUAL', 2: 'CLASSIC', 3: 'EXPERT', 4: 'CIPHER' };
  const colors = { 1: '#9D5FF5', 2: '#F59E0B', 3: '#EF4444', 4: '#10B981' };
  const color = colors[filled];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ display: 'flex', gap: '3px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{
            width: '16px', height: '4px',
            borderRadius: '2px',
            background: i <= filled ? color : 'rgba(255,255,255,0.1)',
            transition: 'background .3s',
          }} />
        ))}
      </div>
      <span style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: '9px', letterSpacing: '1px',
        color: color, opacity: 0.8,
      }}>{labels[filled]}</span>
    </div>
  );
}

// ── WALK TIME ─────────────────────────────────────────────────
function walkTime(metres) {
  if (!metres || metres < 0) return null;
  const mins = Math.round(metres / 80); // avg walking speed
  if (mins < 1) return "< 1 MIN WALK";
  if (mins === 1) return "1 MIN WALK";
  if (mins > 60) return `${Math.round(mins / 60)}HR WALK`;
  return `${mins} MIN WALK`;
}

// ── HUNT CARD ─────────────────────────────────────────────────
function HuntCard({ hunt, onSelect, index, isActive }) {
  const theme = getTheme(hunt);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  // 3D tilt effect on mouse move
  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    setTilt({ x: dy * -6, y: dx * 6 });
  };

  const resetTilt = () => setTilt({ x: 0, y: 0 });

  const distance = hunt.distance_metres;
  const wt = walkTime(distance);
  const slots = hunt.coordinate_slots?.length || 12;
  const isLive = hunt.is_live || true;

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { setHovered(false); resetTilt(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => { setHovered(true); setPressed(true); }}
      onTouchEnd={() => { setHovered(false); setPressed(false); }}
      onClick={() => onSelect(hunt)}
      style={{
        position: 'relative',
        borderRadius: '20px',
        overflow: 'hidden',
        cursor: 'pointer',
        border: hunt.has_prize
          ? '2px solid rgba(245,158,11,0.6)'
          : '1px solid rgba(255,255,255,0.08)',
        transform: pressed
          ? 'scale(0.97)'
          : hovered
            ? `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(1.02)`
            : `perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)`,
        transition: pressed ? 'transform 0.1s' : 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        boxShadow: hovered
          ? `0 20px 60px ${theme.glow}, 0 0 0 1px ${theme.accent}40`
          : hunt.has_prize
            ? `0 4px 20px rgba(0,0,0,0.4), 0 0 30px rgba(245,158,11,0.2)`
            : `0 4px 20px rgba(0,0,0,0.4)`,
        animation: `cardReveal 0.6s ease ${index * 0.1}s both`,
      }}
    >
      {/* Background gradient */}
      <div style={{
        position: 'absolute', inset: 0,
        background: theme.gradient,
        transition: 'opacity 0.3s',
      }} />

      {/* Animated grid overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `linear-gradient(${theme.accent}08 1px, transparent 1px), linear-gradient(90deg, ${theme.accent}08 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
        opacity: hovered ? 1 : 0.5,
        transition: 'opacity 0.3s',
      }} />

      {/* Particle system */}
      {hovered && <Particles color={theme.accent} count={10} />}

      {/* Top edge glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: '1px',
        background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`,
        opacity: hovered ? 1 : 0.3,
        transition: 'opacity 0.3s',
      }} />

      {/* Scan line effect */}
      {hovered && (
        <div style={{
          position: 'absolute', left: 0, right: 0,
          height: '2px',
          background: `linear-gradient(90deg, transparent, ${theme.accent}60, transparent)`,
          animation: 'scanDown 2s linear infinite',
          pointerEvents: 'none',
        }} />
      )}

      {/* Card content */}
      <div style={{ position: 'relative', zIndex: 1, padding: '24px 22px' }}>

        {/* Top row — badges */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-start', marginBottom: '20px',
        }}>
          {/* Live badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            background: 'rgba(16,185,129,0.12)',
            border: '1px solid rgba(16,185,129,0.25)',
            borderRadius: '20px', padding: '3px 10px',
          }}>
            <div style={{
              width: '5px', height: '5px', borderRadius: '50%',
              background: '#10B981',
              boxShadow: '0 0 6px #10B981',
              animation: 'pulse 1.5s infinite',
            }} />
            <span style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: '8px', color: '#10B981', letterSpacing: '1px',
            }}>LIVE</span>
          </div>

          {/* Genre label */}
          <div style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '8px', color: theme.accent,
            letterSpacing: '2px', opacity: 0.8,
            background: `${theme.accent}15`,
            border: `1px solid ${theme.accent}30`,
            borderRadius: '4px', padding: '3px 8px',
          }}>{theme.label}</div>
        </div>

        {/* Hunt name */}
        <div style={{
          fontFamily: "'Nunito', sans-serif",
          fontWeight: 900,
          fontSize: '22px',
          color: '#F1F0FF',
          lineHeight: 1.15,
          letterSpacing: '-0.3px',
          marginBottom: '6px',
          textShadow: `0 0 30px ${theme.glow}`,
        }}>
          {hunt.name || hunt.pack_name || 'Mystery Hunt'}
        </div>

        {/* Tagline */}
        <div style={{
          fontSize: '12px',
          color: 'rgba(255,255,255,0.4)',
          marginBottom: '20px',
          lineHeight: 1.4,
          fontStyle: 'italic',
        }}>
          {hunt.description || 'Destination hidden until all clues are solved'}
        </div>

        {/* Stats row */}
        <div style={{
          display: 'flex', gap: '12px',
          marginBottom: '16px', flexWrap: 'wrap',
        }}>
          {/* Clues count */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '6px', padding: '4px 10px',
          }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <circle cx="5" cy="5" r="4" stroke={theme.accent} strokeWidth="1"/>
              <circle cx="5" cy="5" r="1.5" fill={theme.accent}/>
            </svg>
            <span style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: '9px', color: 'rgba(255,255,255,0.5)',
              letterSpacing: '1px',
            }}>{slots} CLUES</span>
          </div>

          {/* Walk time */}
          {wt && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '6px', padding: '4px 10px',
            }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M5 1v4l2.5 2.5" stroke={theme.accent} strokeWidth="1" strokeLinecap="round"/>
                <circle cx="5" cy="5" r="4" stroke={theme.accent} strokeWidth="1"/>
              </svg>
              <span style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '9px', color: 'rgba(255,255,255,0.5)',
                letterSpacing: '1px',
              }}>{wt}</span>
            </div>
          )}

          {/* Prize indicator */}
          {hunt.has_prize && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: '6px', padding: '4px 10px',
            }}>
              <span style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '9px', color: '#F59E0B',
                letterSpacing: '1px',
              }}>PRIZE HUNT</span>
            </div>
          )}
        </div>

        {/* Difficulty */}
        <div style={{ marginBottom: '20px' }}>
          <DifficultyBar level={hunt.difficulty} />
        </div>

        {/* Destination mystery */}
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          border: `1px solid ${theme.accent}20`,
          borderRadius: '10px',
          padding: '10px 14px',
          marginBottom: '20px',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: '8px', color: 'rgba(255,255,255,0.3)',
              letterSpacing: '2px', marginBottom: '4px',
            }}>DESTINATION</div>
            <div style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: '14px',
              color: theme.accent,
              letterSpacing: '3px',
            }}>
              {/* Show fuzzy coordinates — replace slot letters with ? */}
              {hunt.masked_lat ? hunt.masked_lat.replace(/[A-Z]/g, '?') : '51.???'}° N &nbsp;
              {hunt.masked_lon ? hunt.masked_lon.replace(/[A-Z]/g, '?') : '0.???'}° E
            </div>
          </div>
          <div style={{
            width: '32px', height: '32px',
            borderRadius: '50%',
            border: `1px solid ${theme.accent}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="6" r="3" stroke={theme.accent} strokeWidth="1"/>
              <path d="M4 8 Q7 13 10 8Z" stroke={theme.accent} strokeWidth="1" fill="none"/>
              <line x1="7" y1="1" x2="7" y2="3" stroke={theme.accent} strokeWidth="1"/>
              <line x1="7" y1="9" x2="7" y2="11" stroke={theme.accent} strokeWidth="1"/>
              <line x1="1" y1="6" x2="3" y2="6" stroke={theme.accent} strokeWidth="1"/>
              <line x1="11" y1="6" x2="13" y2="6" stroke={theme.accent} strokeWidth="1"/>
            </svg>
          </div>
        </div>

        {/* CTA Button */}
        <div style={{
          background: hovered
            ? `linear-gradient(135deg, ${theme.accent}, ${theme.accent}CC)`
            : `${theme.accent}20`,
          border: `1px solid ${theme.accent}${hovered ? 'FF' : '40'}`,
          borderRadius: '10px',
          padding: '13px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.3s',
        }}>
          <span style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '11px',
            fontWeight: 700,
            color: hovered ? '#000' : theme.accent,
            letterSpacing: '2px',
            transition: 'color 0.3s',
          }}>START HUNT</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
            style={{ transform: hovered ? 'translateX(4px)' : 'translateX(0)', transition: 'transform 0.3s' }}>
            <path d="M3 8h10M9 4l4 4-4 4"
              stroke={hovered ? '#000' : theme.accent}
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </div>
  );
}

// ── PRIZE POOL BANNER ─────────────────────────────────────────
function PrizePoolBanner({ pool }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setTimeout(() => setVisible(true), 300);
  }, []);

  if (!pool || pool <= 0) return null;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1A0E00, #2D1A00)',
      border: '1px solid rgba(245,158,11,0.3)',
      borderRadius: '14px',
      padding: '16px 20px',
      marginBottom: '24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(-10px)',
      transition: 'all 0.6s ease',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
        background: 'linear-gradient(90deg, transparent, #F59E0B, transparent)',
      }} />
      <div>
        <div style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '9px', color: '#F59E0B',
          letterSpacing: '3px', marginBottom: '4px',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <div style={{
            width: '5px', height: '5px', borderRadius: '50%',
            background: '#F59E0B', animation: 'pulse 1.5s infinite',
          }} />
          QUARTERLY CIPHER — ACTIVE
        </div>
        <div style={{
          fontFamily: "'Nunito', sans-serif",
          fontWeight: 900, fontSize: '24px',
          color: '#F1F0FF', lineHeight: 1,
        }}>£{pool} <span style={{ fontSize: '13px', color: '#6B6890', fontWeight: 400 }}>prize pool</span></div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '9px', color: '#6B6890',
          letterSpacing: '1px', marginBottom: '2px',
        }}>FIRST TO ARRIVE</div>
        <div style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '11px', color: '#F59E0B', letterSpacing: '1px',
        }}>WINS EVERYTHING</div>
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
    <div style={{
      padding: '20px 20px 0',
      position: 'relative',
    }}>
      {/* Top meta row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: '16px',
      }}>
        <div style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '9px', color: '#32325A',
          letterSpacing: '2px',
        }}>{time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>

        {playerCount > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.2)',
            borderRadius: '20px', padding: '3px 10px',
          }}>
            <div style={{
              width: '5px', height: '5px', borderRadius: '50%',
              background: '#10B981', animation: 'pulse 1.5s infinite',
            }} />
            <span style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: '8px', color: '#10B981', letterSpacing: '1px',
            }}>{playerCount} HUNTING NOW</span>
          </div>
        )}
      </div>

      {/* Title */}
      <div style={{ marginBottom: '4px' }}>
        <div style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '10px', color: '#7C3AED',
          letterSpacing: '4px', marginBottom: '6px',
        }}>HUNTS AVAILABLE NEAR YOU</div>
        <div style={{
          fontFamily: "'Nunito', sans-serif",
          fontWeight: 900,
          fontSize: '28px',
          color: '#F1F0FF',
          lineHeight: 1,
          letterSpacing: '-0.5px',
        }}>Choose your mission.</div>
      </div>
    </div>
  );
}

// ── EMPTY STATE ───────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{
      textAlign: 'center',
      padding: '60px 24px',
    }}>
      <div style={{
        width: '64px', height: '64px',
        borderRadius: '50%',
        border: '1px solid #1E1E2E',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 20px',
        animation: 'pulse 2s infinite',
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="#32325A" strokeWidth="1.5"/>
          <circle cx="12" cy="12" r="3" fill="#32325A"/>
          <line x1="12" y1="3" x2="12" y2="6" stroke="#32325A" strokeWidth="1.5"/>
          <line x1="12" y1="18" x2="12" y2="21" stroke="#32325A" strokeWidth="1.5"/>
          <line x1="3" y1="12" x2="6" y2="12" stroke="#32325A" strokeWidth="1.5"/>
          <line x1="18" y1="12" x2="21" y2="12" stroke="#32325A" strokeWidth="1.5"/>
        </svg>
      </div>
      <div style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: '11px', color: '#32325A',
        letterSpacing: '3px', marginBottom: '8px',
      }}>SCANNING FOR HUNTS</div>
      <div style={{
        fontSize: '14px', color: '#4A4A6A',
        lineHeight: 1.6,
      }}>No active hunts in your area yet.<br/>Check back soon — more locations coming.</div>
    </div>
  );
}

// ── LOADING STATE ─────────────────────────────────────────────
function LoadingState() {
  return (
    <div style={{ padding: '20px' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          borderRadius: '20px',
          background: 'linear-gradient(90deg, #0E0E1A 25%, #1A1A2E 50%, #0E0E1A 75%)',
          backgroundSize: '200% 100%',
          animation: `shimmer 1.5s ${i * 0.2}s infinite`,
          height: '240px',
          marginBottom: '16px',
        }} />
      ))}
    </div>
  );
}

// ── MAIN HUNT SELECTION SCREEN ────────────────────────────────
export default function HuntSelectionScreen({
  hunts = [],
  onSelect,
  loading = false,
  prizePool = 0,
  playerCount = 0,
}) {
  const [filter, setFilter] = useState('all');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 100);
  }, []);

  const difficulties = ['all', 'casual', 'classic', 'expert'];

  const filtered = filter === 'all'
    ? hunts
    : hunts.filter(h => h.difficulty?.toLowerCase() === filter);

  return (
    <div style={{
      background: '#06060E',
      minHeight: '100vh',
      fontFamily: "'Space Grotesk', sans-serif",
      color: '#F1F0FF',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.4s ease',
    }}>

      {/* Ambient background */}
      <div style={{
        position: 'fixed', inset: 0,
        background: 'radial-gradient(ellipse at 20% 20%, rgba(124,58,237,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(16,185,129,0.04) 0%, transparent 60%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <SelectionHeader playerCount={playerCount} />

        {/* Filter tabs */}
        <div style={{
          display: 'flex', gap: '6px',
          padding: '16px 20px',
          overflowX: 'auto',
        }}>
          {difficulties.map(d => (
            <button
              key={d}
              onClick={() => setFilter(d)}
              style={{
                background: filter === d ? '#7C3AED' : 'transparent',
                border: `1px solid ${filter === d ? '#7C3AED' : '#1E1E2E'}`,
                color: filter === d ? '#FFF' : '#6B67A0',
                borderRadius: '20px',
                padding: '6px 14px',
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '9px',
                letterSpacing: '2px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all .2s',
                textTransform: 'uppercase',
              }}
            >{d === 'all' ? 'ALL HUNTS' : d}</button>
          ))}
        </div>

        {/* Prize pool banner */}
        <div style={{ padding: '0 20px' }}>
          <PrizePoolBanner pool={prizePool} />
        </div>

        {/* Hunt cards */}
        <div style={{ padding: '0 20px 100px' }}>
          {loading ? (
            <LoadingState />
          ) : filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}>
              {filtered.map((hunt, i) => (
                <HuntCard
                  key={hunt.id || i}
                  hunt={hunt}
                  onSelect={onSelect}
                  index={i}
                  isActive={true}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes cardReveal {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes particleFloat {
          0% { opacity: 0; transform: translateY(0) scale(0); }
          50% { opacity: 0.6; transform: translateY(-20px) scale(1); }
          100% { opacity: 0; transform: translateY(-40px) scale(0); }
        }
        @keyframes scanDown {
          0% { top: 0; }
          100% { top: 100%; }
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
