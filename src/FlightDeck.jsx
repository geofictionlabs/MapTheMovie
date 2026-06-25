import { useState, useEffect, useRef } from "react";
import { supabase } from './lib/supabase';

// ── DESIGN TOKENS ──────────────────────────────────────────
const D = {
  bg:       '#06060E',
  surface:  '#0A0A14',
  card:     '#0E0E1A',
  cardAlt:  '#121218',
  border:   '#1E1E2E',
  borderMid:'#2A2A3A',
  gold:     '#F59E0B',
  goldDim:  '#92620A',
  purple:   '#7C3AED',
  purpleL:  '#9D5FF5',
  green:    '#10B981',
  red:      '#EF4444',
  amber:    '#F59E0B',
  text:     '#F1F0FF',
  textSub:  '#B8B4D8',
  textMuted:'#6B67A0',
  textDim:  '#32325A',
  mono:     "'Share Tech Mono', monospace",
  display:  "'Nunito', sans-serif",
  body:     "'Space Grotesk', sans-serif",
};

const OWNER_PASSWORD = 'FLIGHTDECK2026';

// ── RADAR COMPONENT ─────────────────────────────────────────
function Radar({ liveCount = 0 }) {
  const canvasRef = useRef(null);
  const angleRef  = useRef(0);
  const dotsRef   = useRef([]);
  const rafRef    = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = 240;
    const H = canvas.height = 240;
    const cx = W / 2, cy = H / 2, R = 100;

    // Seed some dots based on liveCount
    dotsRef.current = Array.from({ length: Math.max(liveCount, 2) }, (_, i) => ({
      angle: (i / Math.max(liveCount, 2)) * Math.PI * 2,
      dist:  30 + Math.random() * 60,
      fade:  Math.random(),
      color: i === 0 ? D.green : D.gold,
    }));

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = D.surface;
      ctx.beginPath();
      ctx.arc(cx, cy, R + 10, 0, Math.PI * 2);
      ctx.fill();

      // Rings
      [0.33, 0.66, 1].forEach(f => {
        ctx.beginPath();
        ctx.arc(cx, cy, R * f, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(245,158,11,0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Cross hairs
      ctx.strokeStyle = 'rgba(245,158,11,0.06)';
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();

      // Sweep gradient
      angleRef.current = (angleRef.current + 0.012) % (Math.PI * 2);
      const sweepGrad = ctx.createConicalGradient
        ? null
        : null;

      // Manual sweep arc
      const sweepLen = Math.PI * 0.5;
      for (let a = 0; a < sweepLen; a += 0.02) {
        const thisAngle = angleRef.current - a;
        const alpha = (1 - a / sweepLen) * 0.18;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, thisAngle, thisAngle + 0.02);
        ctx.closePath();
        ctx.fillStyle = `rgba(245,158,11,${alpha})`;
        ctx.fill();
      }

      // Sweep line
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(
        cx + Math.cos(angleRef.current) * R,
        cy + Math.sin(angleRef.current) * R
      );
      ctx.strokeStyle = `rgba(245,158,11,0.6)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Dots
      dotsRef.current.forEach(dot => {
        const diff = ((angleRef.current - dot.angle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        if (diff < Math.PI * 0.5) {
          dot.fade = 1 - diff / (Math.PI * 0.5);
        } else {
          dot.fade = Math.max(0, dot.fade - 0.005);
        }
        if (dot.fade > 0.05) {
          const dx = cx + Math.cos(dot.angle) * dot.dist;
          const dy = cy + Math.sin(dot.angle) * dot.dist;
          ctx.beginPath();
          ctx.arc(dx, dy, 3, 0, Math.PI * 2);
          ctx.fillStyle = dot.color + Math.round(dot.fade * 255).toString(16).padStart(2,'0');
          ctx.fill();
          // Glow
          ctx.beginPath();
          ctx.arc(dx, dy, 6, 0, Math.PI * 2);
          ctx.fillStyle = dot.color + Math.round(dot.fade * 60).toString(16).padStart(2,'0');
          ctx.fill();
        }
      });

      // Center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = D.gold;
      ctx.fill();

      // Outer ring
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(245,158,11,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Compass labels
      ctx.fillStyle = 'rgba(245,158,11,0.4)';
      ctx.font = `9px ${D.mono}`;
      ctx.textAlign = 'center';
      ctx.fillText('N', cx, cy - R - 4);
      ctx.fillText('S', cx, cy + R + 12);
      ctx.textAlign = 'left';
      ctx.fillText('E', cx + R + 4, cy + 3);
      ctx.textAlign = 'right';
      ctx.fillText('W', cx - R - 4, cy + 3);

      rafRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [liveCount]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', margin: '0 auto' }}
    />
  );
}

// ── STAT CARD ────────────────────────────────────────────────
function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div style={{
      background: D.card,
      border: `1px solid ${D.border}`,
      borderRadius: '14px',
      padding: '24px 20px',
      position: 'relative',
      overflow: 'hidden',
      flex: 1,
    }}>
      {/* Top accent */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
        background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
      }} />
      <div style={{
        fontFamily: D.mono, fontSize: '9px', color: D.textMuted,
        letterSpacing: '3px', marginBottom: '12px',
      }}>{label}</div>
      <div style={{
        fontFamily: D.display, fontWeight: 900, fontSize: '40px',
        color: accent, lineHeight: 1, marginBottom: '4px',
      }}>{value}</div>
      {sub && <div style={{
        fontFamily: D.mono, fontSize: '10px', color: D.textDim, letterSpacing: '1px',
      }}>{sub}</div>}
    </div>
  );
}

// ── ALERT BADGE ──────────────────────────────────────────────
function Alert({ level, message }) {
  const colours = {
    red:   { bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)',   text: '#EF4444' },
    amber: { bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.25)',  text: '#F59E0B' },
    green: { bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.25)', text: '#10B981' },
  };
  const c = colours[level] || colours.amber;
  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: '8px', padding: '10px 14px',
      display: 'flex', alignItems: 'center', gap: '10px',
      marginBottom: '8px',
    }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: c.text, flexShrink: 0 }} />
      <div style={{ fontSize: '13px', color: D.textSub }}>{message}</div>
    </div>
  );
}

// ── SECTION LABEL ─────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px',
    }}>
      <div style={{
        fontFamily: D.mono, fontSize: '9px', color: D.gold,
        letterSpacing: '4px', whiteSpace: 'nowrap',
      }}>{children}</div>
      <div style={{ flex: 1, height: '1px', background: `linear-gradient(90deg, rgba(245,158,11,0.3), transparent)` }} />
    </div>
  );
}

// ── MAIN COMPONENT ───────────────────────────────────────────
export default function FlightDeck() {
  const [authed,   setAuthed]   = useState(false);
  const [pw,       setPw]       = useState('');
  const [pwErr,    setPwErr]    = useState(false);
  const [tab,      setTab]      = useState('overview');
  const [data,     setData]     = useState({
    totalPlayers:    0,
    totalBusinesses: 0,
    activeBusinesses:0,
    payingBusinesses:0,
    totalHunts:      0,
    totalRedemptions:0,
    mrr:             0,
    prizePool:       0,
    triviaCount:     0,
    businesses:      [],
    recentActivity:  [],
    alerts:          [],
  });
  const [loading, setLoading] = useState(false);

  // Load data from Supabase
  useEffect(() => {
    if (!authed) return;
    setLoading(true);
    Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('businesses').select('*'),
      supabase.from('campaigns').select('id', { count: 'exact', head: true }),
      supabase.from('redemptions').select('id', { count: 'exact', head: true }),
      supabase.from('prize_pools').select('prize_amount_gbp').eq('status', 'active').maybeSingle(),
      supabase.from('trivia_pool').select('id', { count: 'exact', head: true }),
      supabase.from('hunt_sessions').select('id, created_at, businesses(name)').order('created_at', { ascending: false }).limit(20),
    ]).then(([players, businesses, hunts, redemptions, prize, trivia, sessions]) => {
      const bizData = businesses.data || [];
      const paying  = bizData.filter(b => b.subscription_tier && b.subscription_tier !== 'free');
      const active  = bizData.filter(b => b.is_live);
      const mrr     = paying.reduce((sum, b) => {
        const prices = { starter: 49, featured: 99, sponsored: 249 };
        return sum + (prices[b.subscription_tier] || 0);
      }, 0);

      // Build alerts
      const alerts = [];
      const lowTrivia = (trivia.count || 0) < 100;
      if (lowTrivia) alerts.push({ level: 'amber', message: 'Trivia pool below 100 questions — add more before Comic Con' });
      if (paying.length === 0) alerts.push({ level: 'red', message: 'No paying businesses yet — Stripe integration needed' });
      if ((players.count || 0) < 10) alerts.push({ level: 'amber', message: 'Player count low — push beta testers to complete hunts' });
      if (active.length > 0) alerts.push({ level: 'green', message: `${active.length} business${active.length > 1 ? 'es' : ''} live right now` });
      if ((prize.data?.prize_amount_gbp || 0) > 0) alerts.push({ level: 'green', message: `Prize pool active — £${prize.data.prize_amount_gbp} available` });

      setData({
        totalPlayers:     players.count    || 0,
        totalBusinesses:  bizData.length,
        activeBusinesses: active.length,
        payingBusinesses: paying.length,
        totalHunts:       hunts.count      || 0,
        totalRedemptions: redemptions.count|| 0,
        mrr,
        prizePool:  prize.data?.prize_amount_gbp || 0,
        triviaCount:trivia.count || 0,
        businesses: bizData,
        recentActivity: (sessions.data || []).map(s => ({
          time: new Date(s.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          text: `Hunt started${s.businesses?.name ? ` — ${s.businesses.name}` : ''}`,
        })),
        alerts,
      });
      setLoading(false);
    });
  }, [authed]);

  // ── AUTH SCREEN ────────────────────────────────────────────
  if (!authed) {
    return (
      <div style={{
        background: D.bg, minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: D.body,
      }}>
        <div style={{ width: '320px', textAlign: 'center' }}>
          {/* Logo */}
          <div style={{
            width: '56px', height: '56px', background: D.gold,
            borderRadius: '14px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 24px',
            boxShadow: '0 0 40px rgba(245,158,11,0.3)',
          }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M14 2 L26 8 L26 20 L14 26 L2 20 L2 8 Z" stroke="#06060E" strokeWidth="1.5" fill="none"/>
              <circle cx="14" cy="14" r="4" fill="#06060E"/>
              <line x1="14" y1="2" x2="14" y2="10" stroke="#06060E" strokeWidth="1.5"/>
              <line x1="14" y1="18" x2="14" y2="26" stroke="#06060E" strokeWidth="1.5"/>
              <line x1="2" y1="14" x2="8" y2="14" stroke="#06060E" strokeWidth="1.5"/>
              <line x1="20" y1="14" x2="26" y2="14" stroke="#06060E" strokeWidth="1.5"/>
            </svg>
          </div>

          <div style={{
            fontFamily: D.mono, fontSize: '10px', color: D.gold,
            letterSpacing: '4px', marginBottom: '8px',
          }}>FLIGHT DECK</div>
          <div style={{
            fontFamily: D.display, fontWeight: 900, fontSize: '28px',
            color: D.text, marginBottom: '8px',
          }}>MapTheMovie</div>
          <div style={{
            fontFamily: D.mono, fontSize: '10px', color: D.textDim,
            letterSpacing: '2px', marginBottom: '40px',
          }}>OPERATIONS CENTRE</div>

          <input
            type="password"
            placeholder="Access code"
            value={pw}
            onChange={e => { setPw(e.target.value.toUpperCase()); setPwErr(false); }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                if (pw === OWNER_PASSWORD) setAuthed(true);
                else { setPwErr(true); setPw(''); }
              }
            }}
            style={{
              width: '100%', padding: '14px 16px',
              background: D.card, border: `1px solid ${pwErr ? D.red : D.border}`,
              borderRadius: '10px', color: D.text, fontSize: '16px',
              fontFamily: D.mono, letterSpacing: '4px', textAlign: 'center',
              outline: 'none', marginBottom: '12px', boxSizing: 'border-box',
              transition: 'border-color .2s',
            }}
          />
          {pwErr && (
            <div style={{ color: D.red, fontSize: '12px', fontFamily: D.mono, marginBottom: '12px' }}>
              INCORRECT CODE
            </div>
          )}
          <button
            onClick={() => {
              if (pw === OWNER_PASSWORD) setAuthed(true);
              else { setPwErr(true); setPw(''); }
            }}
            style={{
              width: '100%', padding: '14px',
              background: `linear-gradient(135deg, ${D.goldDim}, ${D.gold})`,
              color: '#000', fontWeight: 700, fontSize: '13px',
              fontFamily: D.mono, letterSpacing: '3px',
              border: 'none', borderRadius: '10px', cursor: 'pointer',
            }}
          >ENTER</button>

          <div style={{ marginTop: '32px', fontFamily: D.mono, fontSize: '9px', color: D.textDim, letterSpacing: '2px' }}>
            GEOFICTION LABS · RESTRICTED ACCESS
          </div>
        </div>
      </div>
    );
  }

  // ── TABS ───────────────────────────────────────────────────
  const tabs = [
    { id: 'overview',   label: 'OVERVIEW'   },
    { id: 'businesses', label: 'BUSINESSES' },
    { id: 'players',    label: 'PLAYERS'    },
    { id: 'revenue',    label: 'REVENUE'    },
    { id: 'platform',   label: 'PLATFORM'   },
    { id: 'alerts',     label: 'ALERTS'     },
  ];

  const tierPrices = { starter: 49, featured: 99, sponsored: 249 };
  const tierColour = { starter: D.textMuted, featured: D.purple, sponsored: D.gold };

  // ── DASHBOARD ──────────────────────────────────────────────
  return (
    <div style={{ background: D.bg, minHeight: '100vh', fontFamily: D.body, color: D.text }}>

      {/* HEADER */}
      <div style={{
        background: D.surface, borderBottom: `1px solid ${D.border}`,
        padding: '14px 32px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Radar icon */}
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: D.gold, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(245,158,11,0.3)',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="#06060E" strokeWidth="1"/>
              <circle cx="8" cy="8" r="4.5" stroke="#06060E" strokeWidth="1"/>
              <circle cx="8" cy="8" r="1.5" fill="#06060E"/>
              <line x1="8" y1="1" x2="8" y2="3.5" stroke="#06060E" strokeWidth="1"/>
              <line x1="13" y1="3.5" x2="10" y2="6" stroke="#06060E" strokeWidth="1"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: D.mono, fontSize: '10px', color: D.gold, letterSpacing: '4px' }}>FLIGHT DECK</div>
            <div style={{ fontFamily: D.display, fontWeight: 900, fontSize: '16px', color: D.text, lineHeight: 1 }}>
              Map<span style={{ color: D.purple, fontSize: '10px', letterSpacing: '3px', margin: '0 3px', fontFamily: D.mono }}>THE</span>
              <span style={{ color: D.gold }}>Movie</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {data.activeBusinesses > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: D.green, boxShadow: `0 0 8px ${D.green}`, animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontFamily: D.mono, fontSize: '10px', color: D.green, letterSpacing: '1px' }}>
                {data.activeBusinesses} LIVE
              </span>
            </div>
          )}
          <div style={{ fontFamily: D.mono, fontSize: '10px', color: D.textDim, letterSpacing: '1px' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()}
          </div>
          <button
            onClick={() => setAuthed(false)}
            style={{
              background: 'transparent', border: `1px solid ${D.border}`,
              color: D.textMuted, padding: '6px 14px', borderRadius: '6px',
              fontSize: '11px', fontFamily: D.mono, cursor: 'pointer', letterSpacing: '1px',
            }}
          >LOCK</button>
        </div>
      </div>

      {/* TAB BAR */}
      <div style={{
        background: D.surface, borderBottom: `1px solid ${D.border}`,
        padding: '0 32px', display: 'flex', gap: '0',
      }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t.id ? `2px solid ${D.gold}` : '2px solid transparent',
              color: tab === t.id ? D.gold : D.textDim,
              padding: '14px 20px',
              fontFamily: D.mono, fontSize: '10px', letterSpacing: '2px',
              cursor: 'pointer', transition: 'all .2s',
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>

        {loading && (
          <div style={{ textAlign: 'center', padding: '60px', fontFamily: D.mono, fontSize: '11px', color: D.textDim, letterSpacing: '3px' }}>
            LOADING TELEMETRY...
          </div>
        )}

        {/* ── OVERVIEW TAB ── */}
        {!loading && tab === 'overview' && (
          <div>
            {/* Alerts */}
            {data.alerts.length > 0 && (
              <div style={{ marginBottom: '32px' }}>
                <SectionLabel>ALERTS</SectionLabel>
                {data.alerts.map((a, i) => <Alert key={i} {...a} />)}
              </div>
            )}

            {/* Top stats row */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
              <StatCard label="TOTAL PLAYERS"    value={data.totalPlayers}     accent={D.purple} />
              <StatCard label="BUSINESSES"       value={data.totalBusinesses}  accent={D.gold}   sub={`${data.payingBusinesses} paying`} />
              <StatCard label="LIVE NOW"         value={data.activeBusinesses} accent={D.green}  />
              <StatCard label="MONTHLY REVENUE"  value={`£${data.mrr}`}        accent={D.gold}   sub="MRR" />
              <StatCard label="TOTAL REDEMPTIONS" value={data.totalRedemptions} accent={D.purpleL} />
            </div>

            {/* Second row */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
              <StatCard label="TOTAL HUNTS STARTED" value={data.totalHunts}    accent={D.textSub} />
              <StatCard label="PRIZE POOL"           value={`£${data.prizePool}`} accent={D.gold} sub="active" />
              <StatCard label="TRIVIA QUESTIONS"     value={data.triviaCount}  accent={D.textSub} sub="in pool" />
            </div>

            {/* Radar + Activity */}
            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px', marginBottom: '32px' }}>

              {/* Radar */}
              <div style={{
                background: D.card, border: `1px solid ${D.border}`,
                borderRadius: '16px', padding: '24px', textAlign: 'center',
              }}>
                <SectionLabel>LIVE RADAR</SectionLabel>
                <Radar liveCount={data.activeBusinesses} />
                <div style={{
                  marginTop: '16px', fontFamily: D.mono, fontSize: '9px',
                  color: D.textDim, letterSpacing: '2px',
                }}>KENT HUNT NETWORK</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: D.green }} />
                    <span style={{ fontFamily: D.mono, fontSize: '9px', color: D.textDim }}>BUSINESS</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: D.gold }} />
                    <span style={{ fontFamily: D.mono, fontSize: '9px', color: D.textDim }}>PLAYER</span>
                  </div>
                </div>
              </div>

              {/* Activity feed */}
              <div style={{
                background: D.card, border: `1px solid ${D.border}`,
                borderRadius: '16px', padding: '24px',
              }}>
                <SectionLabel>RECENT ACTIVITY</SectionLabel>
                {data.recentActivity.length === 0 ? (
                  <div style={{ fontFamily: D.mono, fontSize: '11px', color: D.textDim, letterSpacing: '2px', textAlign: 'center', padding: '40px' }}>
                    NO RECENT ACTIVITY
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                    {data.recentActivity.map((a, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: '14px',
                        padding: '12px 0',
                        borderBottom: i < data.recentActivity.length - 1 ? `1px solid ${D.border}` : 'none',
                      }}>
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: D.purple, flexShrink: 0 }} />
                        <div style={{ fontFamily: D.mono, fontSize: '10px', color: D.textDim, flexShrink: 0 }}>{a.time}</div>
                        <div style={{ fontSize: '13px', color: D.textSub }}>{a.text}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── BUSINESSES TAB ── */}
        {!loading && tab === 'businesses' && (
          <div>
            <SectionLabel>ALL BUSINESSES</SectionLabel>
            <div style={{
              background: D.card, border: `1px solid ${D.border}`,
              borderRadius: '16px', overflow: 'hidden',
            }}>
              {/* Table header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                padding: '12px 20px',
                background: D.surface,
                borderBottom: `1px solid ${D.border}`,
              }}>
                {['BUSINESS', 'TIER', 'STATUS', 'MRR', 'CATEGORY'].map(h => (
                  <div key={h} style={{ fontFamily: D.mono, fontSize: '9px', color: D.textDim, letterSpacing: '2px' }}>{h}</div>
                ))}
              </div>

              {data.businesses.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', fontFamily: D.mono, fontSize: '11px', color: D.textDim, letterSpacing: '2px' }}>
                  NO BUSINESSES YET
                </div>
              ) : (
                data.businesses.map((b, i) => (
                  <div key={b.id} style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                    padding: '16px 20px',
                    background: i % 2 === 0 ? D.card : D.cardAlt,
                    borderBottom: i < data.businesses.length - 1 ? `1px solid ${D.border}` : 'none',
                    alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: D.text }}>{b.name || 'Unnamed'}</div>
                      <div style={{ fontFamily: D.mono, fontSize: '10px', color: D.textDim, marginTop: '2px' }}>
                        {b.email || '—'}
                      </div>
                    </div>
                    <div style={{
                      fontFamily: D.mono, fontSize: '10px',
                      color: tierColour[b.subscription_tier] || D.textMuted,
                      letterSpacing: '1px', textTransform: 'uppercase',
                    }}>{b.subscription_tier || 'free'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: b.is_live ? D.green : D.textDim,
                        boxShadow: b.is_live ? `0 0 6px ${D.green}` : 'none',
                      }} />
                      <span style={{
                        fontFamily: D.mono, fontSize: '10px',
                        color: b.is_live ? D.green : D.textDim,
                        letterSpacing: '1px',
                      }}>{b.is_live ? 'LIVE' : 'OFFLINE'}</span>
                    </div>
                    <div style={{
                      fontFamily: D.display, fontWeight: 900, fontSize: '16px',
                      color: D.gold,
                    }}>£{tierPrices[b.subscription_tier] || 0}</div>
                    <div style={{
                      fontFamily: D.mono, fontSize: '10px', color: D.textMuted,
                      letterSpacing: '1px', textTransform: 'uppercase',
                    }}>{b.venue_category || '—'}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── PLAYERS TAB ── */}
        {!loading && tab === 'players' && (
          <div>
            <SectionLabel>PLAYER ANALYTICS</SectionLabel>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
              <StatCard label="TOTAL PLAYERS"   value={data.totalPlayers}     accent={D.purple} />
              <StatCard label="HUNTS STARTED"   value={data.totalHunts}       accent={D.purpleL} />
              <StatCard label="REDEMPTIONS"     value={data.totalRedemptions} accent={D.green} />
            </div>
            <div style={{
              background: D.card, border: `1px solid ${D.border}`,
              borderRadius: '16px', padding: '32px', textAlign: 'center',
            }}>
              <div style={{ fontFamily: D.mono, fontSize: '11px', color: D.textDim, letterSpacing: '3px', marginBottom: '8px' }}>
                DETAILED PLAYER ANALYTICS
              </div>
              <div style={{ fontSize: '14px', color: D.textMuted }}>
                Completion rates, drop-off analysis and retention metrics coming in Phase 2
              </div>
            </div>
          </div>
        )}

        {/* ── REVENUE TAB ── */}
        {!loading && tab === 'revenue' && (
          <div>
            <SectionLabel>REVENUE</SectionLabel>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
              <StatCard label="MONTHLY RECURRING" value={`£${data.mrr}`}             accent={D.gold}   />
              <StatCard label="PAYING BUSINESSES"  value={data.payingBusinesses}       accent={D.gold}   />
              <StatCard label="FREE BUSINESSES"    value={data.totalBusinesses - data.payingBusinesses} accent={D.textMuted} sub="conversion target" />
            </div>

            {/* Tier breakdown */}
            <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: '16px', padding: '24px', marginBottom: '20px' }}>
              <SectionLabel>TIER BREAKDOWN</SectionLabel>
              {['starter', 'featured', 'sponsored'].map(tier => {
                const count = data.businesses.filter(b => b.subscription_tier === tier).length;
                const revenue = count * (tierPrices[tier] || 0);
                return (
                  <div key={tier} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 0', borderBottom: `1px solid ${D.border}`,
                  }}>
                    <div style={{ fontFamily: D.mono, fontSize: '11px', color: tierColour[tier], letterSpacing: '2px', textTransform: 'uppercase' }}>{tier}</div>
                    <div style={{ fontFamily: D.mono, fontSize: '11px', color: D.textMuted }}>{count} businesses</div>
                    <div style={{ fontFamily: D.display, fontWeight: 900, fontSize: '20px', color: D.gold }}>£{revenue}/mo</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── PLATFORM TAB ── */}
        {!loading && tab === 'platform' && (
          <div>
            <SectionLabel>PLATFORM HEALTH</SectionLabel>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
              <StatCard label="TRIVIA QUESTIONS" value={data.triviaCount} accent={data.triviaCount > 100 ? D.green : D.red} sub={data.triviaCount > 100 ? 'healthy' : 'add more'} />
              <StatCard label="PRIZE POOL"       value={`£${data.prizePool}`} accent={D.gold} />
              <StatCard label="ACTIVE HUNTS"     value={data.totalHunts} accent={D.purple} />
            </div>

            <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: '16px', padding: '24px' }}>
              <SectionLabel>SYSTEM STATUS</SectionLabel>
              {[
                { label: 'Supabase Database',  status: 'OPERATIONAL', ok: true },
                { label: 'Vercel Deployment',  status: 'OPERATIONAL', ok: true },
                { label: 'GPS Engine',         status: 'OPERATIONAL', ok: true },
                { label: 'Stripe Billing',     status: 'NOT CONFIGURED', ok: false },
                { label: 'Push Notifications', status: 'NOT BUILT', ok: false },
                { label: 'Staff Redemption',   status: 'IN DEVELOPMENT', ok: false },
              ].map((s, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 0', borderBottom: `1px solid ${D.border}`,
                }}>
                  <div style={{ fontSize: '14px', color: D.textSub }}>{s.label}</div>
                  <div style={{
                    fontFamily: D.mono, fontSize: '10px', letterSpacing: '1px',
                    color: s.ok ? D.green : D.amber,
                    background: s.ok ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.08)',
                    border: `1px solid ${s.ok ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.2)'}`,
                    padding: '3px 10px', borderRadius: '20px',
                  }}>{s.status}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ALERTS TAB ── */}
        {!loading && tab === 'alerts' && (
          <div>
            <SectionLabel>SYSTEM ALERTS</SectionLabel>
            {data.alerts.length === 0 ? (
              <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: '16px', padding: '48px', textAlign: 'center' }}>
                <div style={{ fontFamily: D.mono, fontSize: '11px', color: D.textDim, letterSpacing: '3px' }}>ALL SYSTEMS NOMINAL</div>
              </div>
            ) : (
              data.alerts.map((a, i) => <Alert key={i} {...a} />)
            )}
          </div>
        )}

      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}
