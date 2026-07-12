// ══════════════════════════════════════════════════════════════
// SCRATCH CARD — "DESTINATION AREA" reveal section for HuntCard
// Canvas destination-out scratch mechanic over a deterministic,
// coordinate-seeded abstract pattern (never a real map tile).
// ══════════════════════════════════════════════════════════════

import { useRef, useState, useEffect } from 'react';

// Outward postcode code -> town name. Kent-focused (project's launch
// area) -- expand as new business postcodes turn up outside this list.
const TOWN_BY_OUTWARD_CODE = {
  ME1: 'Rochester', ME2: 'Rochester', ME3: 'Higham',
  ME4: 'Chatham', ME5: 'Chatham', ME6: 'Snodland',
  ME7: 'Gillingham', ME8: 'Rainham',
  ME9: 'Sittingbourne', ME10: 'Sittingbourne',
  ME11: 'Sheerness', ME12: 'Sheerness',
  ME13: 'Faversham',
  ME14: 'Maidstone', ME15: 'Maidstone', ME16: 'Maidstone',
  ME17: 'Maidstone', ME18: 'Maidstone',
  ME19: 'West Malling', ME20: 'Aylesford',
  CT1: 'Canterbury', CT2: 'Canterbury',
  CT5: 'Whitstable', CT6: 'Herne Bay',
  CT9: 'Margate', CT10: 'Broadstairs', CT11: 'Ramsgate',
  CT19: 'Folkestone', CT20: 'Folkestone',
};

function hashSeed(lat, lon) {
  const str = `${(lat ?? 0).toFixed(5)},${(lon ?? 0).toFixed(5)}`;
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic "map-ish" pattern seeded from the fuzzed coordinates --
// same shapes/positions every render for the same hunt, never a real
// map, so it structurally cannot leak real geography.
function AbstractMapPattern({ accent, lat, lon }) {
  const rand = mulberry32(hashSeed(lat, lon));
  const blocks = Array.from({ length: 5 }, () => ({
    x: rand() * 260 + 10, y: rand() * 60 + 10,
    w: rand() * 30 + 12, h: rand() * 18 + 8,
  }));
  const dotX = rand() * 220 + 40;
  const dotY = rand() * 50 + 20;
  return (
    <svg viewBox="0 0 300 90" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <line x1="0" y1="30" x2="300" y2="38" stroke={accent} strokeOpacity="0.18" strokeWidth="2" />
      <line x1="60" y1="0" x2="80" y2="90" stroke={accent} strokeOpacity="0.14" strokeWidth="2" />
      {blocks.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill={accent} fillOpacity="0.10" rx="2" />
      ))}
      <circle cx={dotX} cy={dotY} r="5" fill={accent} fillOpacity="0.9" />
      <circle cx={dotX} cy={dotY} r="9" fill="none" stroke={accent} strokeOpacity="0.5" strokeWidth="1.5" />
    </svg>
  );
}

export default function ScratchCard({ theme, approxLat, approxLon, postcodeOutward, inView }) {
  const canvasRef = useRef(null);
  const [scratching, setScratching] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const lastPos = useRef(null);
  const rafPending = useRef(false);
  const initialized = useRef(false);

  const areaName = TOWN_BY_OUTWARD_CODE[postcodeOutward] || null;

  // Defers canvas setup until the card is actually on-screen, reusing
  // the same useInViewport signal HuntCard already computes for
  // GenreFlourish -- off-screen cards in a long list pay zero canvas cost.
  useEffect(() => {
    if (!inView || initialized.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    initialized.current = true;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.fillStyle = '#1C1C26';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 400; i++) {
      ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1, 1);
    }
    ctx.font = "9px 'Share Tech Mono', monospace";
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.textAlign = 'center';
    ctx.fillText('SCRATCH TO REVEAL AREA', canvas.width / 2, canvas.height / 2);
  }, [inView]);

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function computePercent(ctx, canvas) {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparent = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] < 128) transparent++;
    return Math.round((transparent / (canvas.width * canvas.height)) * 100);
  }

  function scratch(e) {
    if (!scratching || revealed) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    if (lastPos.current) {
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.lineWidth = 36;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.arc(pos.x, pos.y, 18, 0, Math.PI * 2);
    ctx.fill();
    lastPos.current = pos;

    // Throttle: at most one getImageData scan per animation frame, no
    // matter how many move events land in between -- pointer events can
    // fire faster than paint rate, and getImageData forces a GPU->CPU
    // readback that's specifically slow on older phones.
    if (rafPending.current) return;
    rafPending.current = true;
    requestAnimationFrame(() => {
      rafPending.current = false;
      const pct = computePercent(ctx, canvas);
      if (pct > 55 && !revealed) {
        setRevealed(true);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    });
  }

  return (
    <div style={{
      position: 'relative', width: '100%', height: '76px',
      borderRadius: '10px', overflow: 'hidden', cursor: 'crosshair',
      border: `1px solid ${theme.accent}18`, marginBottom: '14px',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }}>
        {inView && <AbstractMapPattern accent={theme.accent} lat={approxLat} lon={approxLon} />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.5) 100%)' }} />
        <div style={{
          position: 'absolute', bottom: '4px', right: '8px',
          fontFamily: "'Share Tech Mono', monospace", fontSize: '7px',
          color: 'rgba(255,255,255,0.3)', letterSpacing: '0.5px',
        }}>~300m radius · exact location hidden</div>
      </div>

      {inView && !revealed && (
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none' }}
          onMouseDown={() => setScratching(true)}
          onMouseMove={scratch}
          onMouseUp={() => { setScratching(false); lastPos.current = null; }}
          onMouseLeave={() => { setScratching(false); lastPos.current = null; }}
          onTouchStart={() => setScratching(true)}
          onTouchMove={scratch}
          onTouchEnd={() => { setScratching(false); lastPos.current = null; }}
        />
      )}

      {revealed && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.35)',
        }}>
          <span style={{
            fontFamily: "'Share Tech Mono', monospace", fontSize: '11px',
            color: theme.accent, letterSpacing: '1px',
          }}>
            {areaName ? `Somewhere in ${areaName}` : 'Destination area hidden'}
          </span>
        </div>
      )}
    </div>
  );
}
