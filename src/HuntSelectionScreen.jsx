// ══════════════════════════════════════════════════════════════
// HUNT SELECTION SCREEN — Genre-differentiated cards
// Each genre has a completely unique visual identity
// ══════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from "react";

// ── REDUCED MOTION ────────────────────────────────────────────
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

// ── VIEWPORT VISIBILITY ───────────────────────────────────────
// Genre flourishes only animate while their card is actually on screen.
// Returns false (paused) until the observer confirms visibility, and
// again once scrolled away — flourish components render nothing while
// this is false, so off-screen cards cost zero animation/paint work.
function useInViewport(ref) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.15 }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [ref]);
  return inView;
}

// ── COORD MASKER ──────────────────────────────────────────────
const maskCoord = (raw) => {
  if (!raw) return '??.??????';
  const s = String(raw);
  const dot = s.indexOf('.');
  if (dot === -1) return '?'.repeat(s.length);
  return s.slice(0, dot + 1) + '?'.repeat(s.length - dot - 1);
};

// Decrypt-flicker: cycles random glyphs in place of each masked '?'
// briefly on mount, then settles to the real masked string. Purely
// cosmetic — never reveals real digits, only ever animates toward '?'.
const FLICKER_CHARS = '0123456789';
function DecryptCoord({ text, reduceMotion }) {
  const [display, setDisplay] = useState(reduceMotion ? text : text.replace(/\?/g, () => FLICKER_CHARS[Math.floor(Math.random() * 10)]));
  useEffect(() => {
    if (reduceMotion) { setDisplay(text); return; }
    let frame = 0;
    const totalFrames = 8;
    const id = setInterval(() => {
      frame += 1;
      if (frame >= totalFrames) {
        setDisplay(text);
        clearInterval(id);
        return;
      }
      setDisplay(text.replace(/\?/g, () => FLICKER_CHARS[Math.floor(Math.random() * 10)]));
    }, 55);
    return () => clearInterval(id);
  }, [text, reduceMotion]);
  return <>{display}</>;
}

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
  const key = THEMES[genre] ? genre : 'general';
  return { ...THEMES[key], key };
}

// ── FILM-STRIP PERFORATION EDGE ──────────────────────────────
// One consistent motif on every card, regardless of genre — only the
// accent colour changes. Genre used to get 8 different shapes here;
// consolidated so the "cinema poster" identity reads the same way
// across the whole discovery screen.
function GenreDecoration({ theme }) {
  const accent = theme.accent;
  return (
    <svg width="36" height="100%" viewBox="0 0 36 300" preserveAspectRatio="none"
      style={{ position: 'absolute', left: 0, top: 0, bottom: 0, height: '100%', opacity: 0.4 }}>
      <rect x="4" y="0" width="28" height="300" fill="none" stroke={accent} strokeWidth="1"/>
      <rect x="0" y="0" width="4" height="300" fill={accent} opacity="0.3"/>
      <rect x="32" y="0" width="4" height="300" fill={accent} opacity="0.3"/>
      {Array.from({length: 14}, (_, i) => (
        <rect key={i} x="8" y={i*22+4} width="20" height="14" rx="1" fill={accent} opacity="0.5"/>
      ))}
    </svg>
  );
}

// ── GENRE SIGNATURE FLOURISHES ────────────────────────────────
// One living, animated detail per genre. Every flourish: single
// absolutely-positioned overlay (zIndex 1 — behind card content at
// zIndex 2, in front of the background/filmstrip), pure CSS/SVG,
// transform/opacity only, capped element counts. The caller (HuntCard)
// only renders this when the card is in-viewport AND motion isn't
// reduced — see `active` prop — so there is nothing to disable inside
// these components themselves beyond just not rendering.

function RomanceFlourish({ theme }) {
  // Beating 3D heart, lub-dub rhythm, pink glow bloom per beat.
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', bottom: 18, right: 20, width: 34, height: 34, perspective: '220px' }}>
        <div style={{
          position: 'absolute', inset: -10, borderRadius: '50%',
          background: `radial-gradient(circle, ${theme.glow} 0%, transparent 70%)`,
          animation: 'flourishHeartGlow 1.2s ease-in-out infinite',
        }} />
        <svg viewBox="0 0 24 24" width="34" height="34" style={{ animation: 'flourishHeartBeat 1.2s ease-in-out infinite', transformStyle: 'preserve-3d' }}>
          <path d="M12 21s-7-4.35-9.5-9C0.5 8 2 4 6 4c2 0 3.5 1.2 6 4 2.5-2.8 4-4 6-4 4 0 5.5 4 3.5 8-2.5 4.65-9.5 9-9.5 9z" fill={theme.accent} />
        </svg>
      </div>
    </div>
  );
}

function HorrorFlourish({ theme }) {
  // 2-3 staggered blood drips descending from the top edge, plus a rare
  // single-frame lighting flicker across the whole card.
  const drips = [
    { left: '18%', delay: '0s', dur: '4.5s' },
    { left: '52%', delay: '1.6s', dur: '5.2s' },
    { left: '78%', delay: '3s', dur: '4.8s' },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden', pointerEvents: 'none' }}>
      {drips.map((d, i) => (
        <div key={i} style={{
          position: 'absolute', top: 0, left: d.left, width: 6, height: 10,
          borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
          background: theme.accent,
          animation: `flourishDrip ${d.dur} ease-in infinite`,
          animationDelay: d.delay,
        }} />
      ))}
      <div style={{
        position: 'absolute', inset: 0, background: '#fff',
        animation: 'flourishLightning 8s linear infinite',
      }} />
    </div>
  );
}

function ScifiFlourish({ theme }) {
  // Rising holographic scanline + a slow orbiting particle ring behind
  // the emoji medallion (top-right, 40px — orbit radius matches it).
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`,
        boxShadow: `0 0 8px ${theme.accent}`,
        animation: 'flourishScanRise 3.2s linear infinite',
      }} />
      <div style={{ position: 'absolute', top: 32, right: 32, width: 1, height: 1, animation: 'flourishOrbit 4s linear infinite' }}>
        <div style={{ position: 'absolute', width: 4, height: 4, borderRadius: '50%', background: theme.accent, boxShadow: `0 0 6px ${theme.accent}`, transform: 'translate(26px, 0)' }} />
      </div>
      <div style={{ position: 'absolute', top: 32, right: 32, width: 1, height: 1, animation: 'flourishOrbit 4s linear infinite', animationDelay: '-2s' }}>
        <div style={{ position: 'absolute', width: 3, height: 3, borderRadius: '50%', background: theme.accent, opacity: 0.6, transform: 'translate(26px, 0)' }} />
      </div>
    </div>
  );
}

function ActionFlourish({ theme }) {
  // 4-5 ember sparks drifting up with flicker, plus a periodic diagonal
  // light-slash across the poster.
  const embers = Array.from({ length: 5 }, (_, i) => ({
    left: `${12 + i * 18}%`, delay: `${i * 0.7}s`, dur: `${3 + (i % 3) * 0.6}s`,
  }));
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden', pointerEvents: 'none' }}>
      {embers.map((e, i) => (
        <div key={i} style={{
          position: 'absolute', bottom: 10, left: e.left, width: 3, height: 3, borderRadius: '50%',
          background: i % 2 === 0 ? '#F59E0B' : '#FCD34D',
          animation: `flourishEmber ${e.dur} ease-in infinite`,
          animationDelay: e.delay,
        }} />
      ))}
      <div style={{
        position: 'absolute', top: '-20%', left: '-30%', width: '60%', height: '140%',
        background: `linear-gradient(115deg, transparent 45%, ${theme.accent}35 50%, transparent 55%)`,
        animation: 'flourishSlash 7s ease-in-out infinite',
      }} />
    </div>
  );
}

function ComedyFlourish({ theme }) {
  // 3 popcorn kernels bouncing along the bottom edge, squash-and-stretch.
  const kernels = [
    { left: '22%', delay: '0s' },
    { left: '48%', delay: '0.35s' },
    { left: '74%', delay: '0.7s' },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden', pointerEvents: 'none' }}>
      {kernels.map((k, i) => (
        <div key={i} style={{
          position: 'absolute', bottom: 12, left: k.left, width: 10, height: 10,
          borderRadius: '40%', background: '#FDE9C8',
          border: `1px solid ${theme.accent}55`,
          animation: 'flourishPopcorn 1.8s ease-in-out infinite',
          animationDelay: k.delay,
        }} />
      ))}
    </div>
  );
}

function RetroFlourish({ theme }) {
  // Neon horizon grid at the card base, chrome shimmer sweeping the
  // title, occasional single-frame VHS tracking jitter.
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden', pointerEvents: 'none', animation: 'flourishVHSJitter 9s linear infinite' }}>
      <svg width="100%" height="60" viewBox="0 0 300 60" preserveAspectRatio="none"
        style={{ position: 'absolute', left: 0, bottom: 0, opacity: 0.5, animation: 'flourishGridDrift 3s ease-in-out infinite' }}>
        {[0, 12, 26, 42, 60].map((y, i) => (
          <line key={i} x1="0" y1={60 - y} x2="300" y2={60 - y} stroke={i % 2 === 0 ? '#FF00FF' : '#00FFFF'} strokeWidth="1" />
        ))}
      </svg>
      <div style={{
        position: 'absolute', top: 0, left: '-40%', width: '30%', height: '100%',
        background: 'linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.5) 50%, transparent 60%)',
        mixBlendMode: 'overlay',
        animation: 'flourishChromeShimmer 3.5s ease-in-out infinite',
      }} />
    </div>
  );
}

function ThrillerFlourish({ theme }) {
  // Noir searchlight sweep + slowly drifting fog layer.
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', top: '-30%', left: '50%', width: '140%', height: '160%',
        background: `conic-gradient(from 200deg at 50% 0%, transparent 0deg, ${theme.accent}22 8deg, transparent 20deg)`,
        animation: 'flourishSearchlight 6s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', bottom: -10, left: '-20%', width: '140%', height: '40%',
        background: `linear-gradient(180deg, transparent, ${theme.accent}18)`,
        filter: 'blur(6px)',
        animation: 'flourishFogDrift 10s ease-in-out infinite',
      }} />
    </div>
  );
}

function GeneralFlourish({ theme }) {
  // Floating dust motes in projector light, with an occasional gold glint.
  const motes = Array.from({ length: 6 }, (_, i) => ({
    left: `${10 + i * 14}%`, top: `${15 + (i % 3) * 22}%`, delay: `${i * 0.9}s`, dur: `${5 + (i % 4)}s`,
  }));
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden', pointerEvents: 'none' }}>
      {motes.map((m, i) => (
        <div key={i} style={{
          position: 'absolute', left: m.left, top: m.top, width: 2, height: 2, borderRadius: '50%',
          background: theme.accent, opacity: 0.5,
          animation: `flourishDustDrift ${m.dur} ease-in-out infinite`,
          animationDelay: m.delay,
        }} />
      ))}
      <div style={{
        position: 'absolute', top: 0, left: '-40%', width: '25%', height: '100%',
        background: `linear-gradient(115deg, transparent 40%, ${theme.accent}30 50%, transparent 60%)`,
        animation: 'flourishGoldGlint 8s ease-in-out infinite',
      }} />
    </div>
  );
}

function GenreFlourish({ genre, theme, active }) {
  if (!active) return null;
  switch (genre) {
    case 'romance':       return <RomanceFlourish theme={theme} />;
    case 'horror':        return <HorrorFlourish theme={theme} />;
    case 'scifi':         return <ScifiFlourish theme={theme} />;
    case 'action':        return <ActionFlourish theme={theme} />;
    case 'comedy':        return <ComedyFlourish theme={theme} />;
    case 'evergreen_80s': return <RetroFlourish theme={theme} />;
    case 'thriller':      return <ThrillerFlourish theme={theme} />;
    default:              return <GeneralFlourish theme={theme} />;
  }
}

// ── DIFFICULTY PILL ────────────────────────────────────────────
function DifficultyPill({ level, theme }) {
  const cfg = {
    casual:  { bars: 1, color: '#10B981', label: 'CASUAL' },
    classic: { bars: 2, color: '#7C3AED', label: 'CLASSIC' },
    expert:  { bars: 3, color: '#F59E0B', label: 'EXPERT' },
    cipher:  { bars: 4, color: '#EF4444', label: 'CIPHER' },
  };
  const d = cfg[level?.toLowerCase()] || cfg.classic;
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
  const reduceMotion = usePrefersReducedMotion();
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const cardRef = useRef(null);
  const inView = useInViewport(cardRef);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    if (!cardRef.current || reduceMotion) return;
    const rect = cardRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    setTilt({
      x: ((e.clientY - cy) / (rect.height / 2)) * -5,
      y: ((e.clientX - cx) / (rect.width / 2)) * 5,
    });
  };

  const rawSlots = hunt.puzzle_packs?.coordinate_slots ?? hunt.coordinate_slots;
  const slots = Array.isArray(rawSlots) ? rawSlots.length : (rawSlots || 4);
  const wt = walkTime(hunt.distance_metres);
  const name = hunt.name || hunt.pack_name || 'Mystery Hunt';
  const desc = hunt.tagline || hunt.description || theme.tagline;
  const tiltActive = hovered && !reduceMotion;

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
          : tiltActive
            ? `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(1.025) translateY(-3px)`
            : 'scale(1)',
        transition: pressed ? 'transform 0.08s' : 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        boxShadow: hovered
          ? `0 24px 60px ${theme.glow}, 0 0 0 1px ${theme.accent}30`
          : `0 4px 24px rgba(0,0,0,0.5)`,
        animation: reduceMotion ? 'none' : `cardReveal 0.5s ease ${index * 0.06}s both`,
      }}
    >
      {/* Background */}
      <div style={{ position: 'absolute', inset: 0, background: theme.gradient }} />

      {/* Genre decoration on left */}
      <GenreDecoration theme={theme} />

      {/* Genre signature flourish — only animates while on-screen and
          motion isn't reduced */}
      <GenreFlourish genre={theme.key} theme={theme} active={inView && !reduceMotion} />

      {/* Diagonal light-sweep on tilt — fixed gradient, opacity/transform
          only (fades + shifts in, never recomputes background per frame) */}
      <div style={{
        position: 'absolute', inset: '-20%',
        background: `linear-gradient(115deg, transparent 40%, ${theme.accent}25 50%, transparent 60%)`,
        opacity: tiltActive ? 1 : 0,
        transform: tiltActive ? 'translateX(0)' : 'translateX(-6%)',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
        pointerEvents: 'none', zIndex: 3,
      }} />

      {/* Genre corner badge — large, poster-medallion style */}
      <div style={{
        position: 'absolute', top: '12px', right: '12px', zIndex: 4,
        width: '40px', height: '40px', borderRadius: '50%',
        background: `${theme.accent}22`,
        border: `2px solid ${theme.accent}70`,
        boxShadow: `0 0 14px ${theme.glow}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '22px',
      }}>{theme.icon}</div>

      {/* Top glow line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
        background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`,
        opacity: hovered ? 1 : 0.35,
        transition: 'opacity 0.3s',
      }} />

      {/* Scan line on hover */}
      {hovered && !reduceMotion && (
        <div style={{
          position: 'absolute', left: 0, right: 0, height: '1px',
          background: `linear-gradient(90deg, transparent, ${theme.accent}80, transparent)`,
          animation: 'scanDown 1.8s linear infinite',
          pointerEvents: 'none', zIndex: 10,
        }} />
      )}

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2, padding: '20px 20px 20px 48px' }}>

        {/* Top row — genre label + live (genre icon now lives in the corner badge) */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: '14px', paddingRight: '38px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: theme.labelBg,
            border: `1px solid ${theme.labelBorder}`,
            borderRadius: '20px', padding: '4px 10px',
          }}>
            <span style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: '8px', color: theme.accent, letterSpacing: '1.5px',
            }}>{theme.label}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: '#10B981', boxShadow: '0 0 8px #10B981',
              animation: reduceMotion ? 'none' : 'pulse 2s infinite',
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
          <DifficultyPill level={hunt.difficulty} theme={theme} />
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
              <DecryptCoord text={maskCoord(hunt.masked_lat)} reduceMotion={reduceMotion} />° N &nbsp;
              <DecryptCoord text={maskCoord(hunt.masked_lon)} reduceMotion={reduceMotion} />° E
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

        {/* CTA — marquee bulb: slow gold glow breathes at rest (opacity-only
            overlay, so the animated property stays transform/opacity per
            the 60fps rule — box-shadow itself never animates), genre
            gradient takes over on hover/press */}
        <div style={{
          position: 'relative',
          background: hovered ? theme.accentGradient : 'rgba(255,255,255,0.04)',
          border: `1px solid ${hovered ? 'transparent' : theme.accent + '30'}`,
          borderRadius: '10px', padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          transition: 'background 0.25s, border-color 0.25s',
        }}>
          {!hovered && !reduceMotion && (
            <div style={{
              position: 'absolute', inset: '-3px', borderRadius: '13px',
              boxShadow: '0 0 16px 2px rgba(245,158,11,0.6)',
              animation: 'marqueeGlow 2.5s ease-in-out infinite',
              pointerEvents: 'none', zIndex: 0,
            }} />
          )}
          <span style={{
            position: 'relative', zIndex: 1,
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '11px', fontWeight: 700,
            color: hovered ? '#000' : theme.accent,
            letterSpacing: '2px', transition: 'color 0.25s',
          }}>START HUNT →</span>
          <span style={{ position: 'relative', zIndex: 1, fontSize: '16px' }}>{theme.icon}</span>
        </div>
      </div>
    </div>
  );
}

// ── PRIZE POOL BANNER ─────────────────────────────────────────
function PrizePoolBanner({ pool }) {
  const [visible, setVisible] = useState(false);
  const reduceMotion = usePrefersReducedMotion();
  useEffect(() => { setTimeout(() => setVisible(true), 200); }, []);
  if (!pool || pool <= 0) return null;
  return (
    <div style={{
      background: 'linear-gradient(135deg, #110A00, #221400)',
      border: '1px solid rgba(245,158,11,0.3)',
      borderRadius: '4px 14px 14px 4px',
      padding: '14px 18px 14px 28px', marginBottom: '20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(-8px)',
      transition: 'opacity 0.5s ease, transform 0.5s ease',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Torn perforated left edge — small circular notches punched
          into the card, matching the page's own background colour */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: '10px',
        backgroundImage: 'radial-gradient(circle at 0 9px, #06060E 4px, transparent 4.5px)',
        backgroundSize: '10px 18px', backgroundRepeat: 'repeat-y',
      }} />
      {/* Single punched hole, ticket-stub style */}
      <div style={{
        position: 'absolute', left: '19px', top: '50%', transform: 'translateY(-50%)',
        width: '7px', height: '7px', borderRadius: '50%',
        background: '#06060E', border: '1px solid rgba(245,158,11,0.3)',
      }} />
      {/* Slow shimmer sweep — opacity/transform only */}
      {!reduceMotion && (
        <div style={{
          position: 'absolute', top: 0, left: '-30%', width: '18%', height: '100%',
          background: 'linear-gradient(115deg, transparent 40%, rgba(245,158,11,0.35) 50%, transparent 60%)',
          animation: 'ticketShimmer 5s ease-in-out infinite',
        }} />
      )}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
        background: 'linear-gradient(90deg, transparent, #F59E0B80, transparent)',
      }} />
      <div style={{ position: 'relative' }}>
        <div style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '8px', color: '#F59E0B',
          letterSpacing: '3px', marginBottom: '4px',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#F59E0B', animation: reduceMotion ? 'none' : 'pulse 1.5s infinite' }} />
          QUARTERLY CIPHER — ACTIVE
        </div>
        <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: '22px', color: '#F1F0FF', lineHeight: 1 }}>
          £{pool} <span style={{ fontSize: '12px', color: '#6B6890', fontWeight: 400 }}>prize pool</span>
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '7px', color: 'rgba(245,158,11,0.45)', letterSpacing: '2px', marginTop: '5px' }}>ADMIT ONE</div>
      </div>
      <div style={{ position: 'relative', textAlign: 'right' }}>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', color: '#6B6890', letterSpacing: '1px', marginBottom: '2px' }}>FIRST TO ARRIVE</div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', color: '#F59E0B', letterSpacing: '1px' }}>WINS EVERYTHING</div>
      </div>
    </div>
  );
}

// ── MARQUEE TITLE ─────────────────────────────────────────────
// Letter-by-letter glow cycle — each letter's opacity breathes on a
// staggered delay, against a static gold text-shadow glow aura, so the
// animated property stays opacity-only per the 60fps rule.
function MarqueeTitle({ text, reduceMotion }) {
  return (
    <span>
      {text.split('').map((ch, i) => (
        <span key={i} style={{
          display: 'inline-block',
          textShadow: '0 0 14px rgba(245,158,11,0.55)',
          animation: reduceMotion ? 'none' : `letterGlow 2.4s ease-in-out ${i * 0.08}s infinite`,
        }}>{ch === ' ' ? ' ' : ch}</span>
      ))}
    </span>
  );
}

// ── HEADER ────────────────────────────────────────────────────
function SelectionHeader({ playerCount }) {
  const [time, setTime] = useState(new Date());
  const reduceMotion = usePrefersReducedMotion();
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
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10B981', animation: reduceMotion ? 'none' : 'pulse 1.5s infinite' }} />
            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', color: '#10B981', letterSpacing: '1px' }}>{playerCount} HUNTING NOW</span>
          </div>
        )}
      </div>
      <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: '26px', color: '#FCD34D', lineHeight: 1, letterSpacing: '1px', marginBottom: '6px' }}>
        <MarqueeTitle text="NOW SHOWING" reduceMotion={reduceMotion} />
      </div>
      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', color: '#7C3AED', letterSpacing: '3px' }}>HUNTS NEAR YOU</div>
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

  const difficulties = ['all', 'casual', 'classic', 'expert', 'cipher'];
  const filtered = filter === 'all' ? hunts : hunts.filter(h => h.difficulty?.toLowerCase() === filter);

  return (
    <div style={{ background: '#06060E', minHeight: '100vh', fontFamily: "'Space Grotesk', sans-serif", color: '#F1F0FF', opacity: visible ? 1 : 0, transition: 'opacity 0.4s ease' }}>
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at 20% 20%, rgba(124,58,237,0.05) 0%, transparent 60%)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <SelectionHeader playerCount={playerCount} />

        {/* Filter tabs styled as cinema ticket stubs — active tab gold
            with a punched-hole detail, inactive tabs dimmed */}
        <div style={{ display: 'flex', gap: '8px', padding: '14px 20px', overflowX: 'auto' }}>
          {difficulties.map(d => {
            const active = filter === d;
            return (
              <button key={d} onClick={() => setFilter(d)} style={{
                position: 'relative',
                background: active ? 'linear-gradient(135deg, #F59E0B, #FCD34D)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active ? '#F59E0B' : '#1E1E2E'}`,
                color: active ? '#000' : '#6B67A0',
                borderRadius: '6px',
                padding: '6px 14px 6px 20px',
                fontFamily: "'Share Tech Mono', monospace",
                fontWeight: active ? 700 : 400, fontSize: '9px',
                letterSpacing: '2px', cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'background .2s, border-color .2s, color .2s',
                textTransform: 'uppercase',
              }}>
                <span style={{
                  position: 'absolute', left: '7px', top: '50%', transform: 'translateY(-50%)',
                  width: '5px', height: '5px', borderRadius: '50%',
                  background: active ? 'rgba(0,0,0,0.35)' : '#06060E',
                  border: active ? 'none' : '1px solid #1E1E2E',
                }} />
                {d === 'all' ? 'ALL HUNTS' : d}
              </button>
            );
          })}
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
        @keyframes marqueeGlow { 0%,100% { opacity:0.35; } 50% { opacity:1; } }

        /* Genre signature flourishes */
        @keyframes flourishHeartBeat {
          0%, 100% { transform: scale(1) rotateY(0deg); }
          15% { transform: scale(1.2) rotateY(10deg); }
          30% { transform: scale(0.95) rotateY(-6deg); }
          45% { transform: scale(1.12) rotateY(6deg); }
          60% { transform: scale(1) rotateY(0deg); }
        }
        @keyframes flourishHeartGlow {
          0%, 60%, 100% { opacity: 0; }
          15% { opacity: 0.6; }
          45% { opacity: 0.35; }
        }
        @keyframes flourishDrip {
          0% { transform: translateY(-10px) scale(1, 0.6); opacity: 0; }
          8% { opacity: 0.9; transform: translateY(0px) scale(1,1); }
          70% { opacity: 0.9; transform: translateY(220px) translateX(3px) scale(1,1.3); }
          100% { opacity: 0; transform: translateY(260px) translateX(-2px) scale(0.8,1.6); }
        }
        @keyframes flourishLightning {
          0%, 96%, 100% { opacity: 0; }
          97% { opacity: 0.12; }
          97.5% { opacity: 0; }
          98% { opacity: 0.08; }
        }
        @keyframes flourishScanRise {
          0% { transform: translateY(340px); opacity: 0; }
          10% { opacity: 0.9; }
          90% { opacity: 0.9; }
          100% { transform: translateY(-20px); opacity: 0; }
        }
        @keyframes flourishOrbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes flourishEmber {
          0% { transform: translate(0,0) scale(1); opacity: 0; }
          15% { opacity: 0.9; }
          100% { transform: translate(6px, -140px) scale(0.4); opacity: 0; }
        }
        @keyframes flourishSlash {
          0%, 85%, 100% { transform: translateX(0); opacity: 0; }
          88% { opacity: 1; }
          95% { transform: translateX(180%); opacity: 0; }
        }
        @keyframes flourishPopcorn {
          0%, 100% { transform: translateY(0) scaleX(1) scaleY(1); }
          35% { transform: translateY(-22px) scaleX(0.9) scaleY(1.15); }
          70% { transform: translateY(0) scaleX(1.25) scaleY(0.75); }
          85% { transform: translateY(-4px) scaleX(0.95) scaleY(1.05); }
        }
        @keyframes flourishGridDrift {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(4px); }
        }
        @keyframes flourishChromeShimmer {
          0% { transform: translateX(0); opacity: 0; }
          10% { opacity: 0.8; }
          50% { transform: translateX(280%); opacity: 0.8; }
          60%, 100% { transform: translateX(280%); opacity: 0; }
        }
        @keyframes flourishVHSJitter {
          0%, 92%, 100% { transform: translateX(0); }
          93% { transform: translateX(-2px) skewX(1deg); }
          94% { transform: translateX(2px) skewX(-1deg); }
          95% { transform: translateX(0); }
        }
        @keyframes flourishSearchlight {
          0%, 100% { transform: rotate(-18deg); opacity: 0.7; }
          50% { transform: rotate(18deg); opacity: 1; }
        }
        @keyframes flourishFogDrift {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(6%); }
        }
        @keyframes flourishDustDrift {
          0%, 100% { transform: translate(0,0); opacity: 0.3; }
          50% { transform: translate(8px, -14px); opacity: 0.6; }
        }
        @keyframes flourishGoldGlint {
          0%, 85%, 100% { transform: translateX(0); opacity: 0; }
          90% { opacity: 0.9; }
          98% { transform: translateX(280%); opacity: 0; }
        }

        /* Cinema frame — header marquee + ticket-stub prize banner */
        @keyframes letterGlow { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes ticketShimmer {
          0%, 100% { transform: translateX(0); opacity: 0; }
          45% { opacity: 0.9; }
          55% { transform: translateX(650%); opacity: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
          }
        }
      `}</style>
    </div>
  );
}
