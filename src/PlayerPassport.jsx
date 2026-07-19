import { useState, useEffect, useRef } from "react";
import { supabase } from "./lib/supabase";

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
  { id:'founder',       icon:'⭐', name:'Founding Hunter', desc:'Beta player — you were first',       req: () => true },
];

// ── PASSPORT STAMP ─────────────────────────────────────────────
function PassportStamp({ hunt, index, animate }) {
  const angles = [-8, 5, -3, 10, -6, 7, -12, 4];
  const rotation = angles[index % angles.length];
  const colors = {
    casual:  { ring: '#7C3AED', text: '#9D5FF5', bg: 'rgba(124,58,237,0.08)' },
    classic: { ring: '#F59E0B', text: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
    expert:  { ring: '#EF4444', text: '#EF4444', bg: 'rgba(239,68,68,0.08)'  },
    cipher:  { ring: '#10B981', text: '#10B981', bg: 'rgba(16,185,129,0.08)' },
  };
  const c = colors[hunt.difficulty?.toLowerCase()] || colors.classic;
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
      background: unlocked ? D.card : D.surface,
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
        color: D.textDim, letterSpacing: '2px',
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
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSendLink = async () => {
    if (!email) { setError('Enter your email address'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      const { error: e } = await supabase.auth.signInWithOtp({ email });
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
            Welcome back.
          </div>
          <div style={{ fontSize: '14px', color: D.textMuted, marginTop: '6px' }}>
            Enter your email and we'll send you a sign-in link.
          </div>
        </div>

        {/* Form */}
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email address"
          onKeyDown={e => e.key === 'Enter' && handleSendLink()}
          style={{
            width: '100%', padding: '12px 14px',
            background: D.cardAlt, border: `1px solid ${D.border}`,
            borderRadius: '10px', color: D.text,
            fontSize: '15px', fontFamily: D.body,
            outline: 'none', marginBottom: '16px',
            boxSizing: 'border-box',
          }}
        />

        {error && <div style={{ color: D.red, fontSize: '12px', fontFamily: D.mono, marginBottom: '12px', textAlign: 'center' }}>{error}</div>}
        {success && <div style={{ color: D.green, fontSize: '12px', fontFamily: D.mono, marginBottom: '12px', textAlign: 'center', lineHeight: 1.5 }}>{success}</div>}

        <button
          onClick={handleSendLink}
          disabled={loading}
          style={{
            width: '100%', padding: '14px',
            background: loading ? D.border : `linear-gradient(135deg,${D.purple},${D.purpleL})`,
            color: '#FFF', border: 'none',
            borderRadius: '10px', fontSize: '15px',
            fontWeight: 700, fontFamily: D.body,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 4px 20px rgba(124,58,237,0.3)',
          }}
        >
          {loading ? 'Sending...' : 'Send me a sign-in link'}
        </button>
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
      // Load completed hunt sessions
      const { data: sessions } = await supabase
        .from('hunt_sessions')
        .select(`
          id, status, started_at, completed_at,
          arrival_distance_m, time_taken_seconds,
          puzzles(
            puzzle_packs(name, genre, theme_tag)
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
    streak: 0, // TODO: compute streak
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
  const unlocked = ACHIEVEMENTS.filter(a => a.req(hunts, stats));

  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Hunter';

  if (initialAuthLoading) {
    return (
      <div style={{
        background: D.bg, minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: D.mono, fontSize: '11px', color: D.textDim,
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
        <div style={{ textAlign: 'center', padding: '60px', fontFamily: D.mono, fontSize: '11px', color: D.textDim, letterSpacing: '3px' }}>
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
                    fontSize: '11px', color: D.textDim,
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

                  {/* Stats row */}
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <StatCard label="HUNTS" value={stats.total} accent={D.purple} />
                    <StatCard label="KM WALKED" value={stats.totalKm} accent={D.gold} />
                    <StatCard label="BADGES" value={unlocked.length} accent={D.green} sub={`of ${ACHIEVEMENTS.length}`} />
                    {stats.fastestMins && stats.fastestMins < 999 && (
                      <StatCard label="FASTEST" value={`${stats.fastestMins}m`} accent={D.purpleL} />
                    )}
                  </div>
                </div>
              </div>

              {/* Passport stamps */}
              <div style={{
                background: D.card, border: `1px solid ${D.border}`,
                borderRadius: '16px', padding: '20px',
                marginBottom: '20px',
              }}>
                <div style={{
                  fontFamily: D.mono, fontSize: '9px',
                  color: D.textDim, letterSpacing: '3px', marginBottom: '16px',
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
                color: D.textDim, letterSpacing: '3px',
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
                  {hunts.map((hunt, i) => (
                    <div key={hunt.id} style={{
                      background: D.card, border: `1px solid ${D.border}`,
                      borderRadius: '14px', padding: '18px 18px',
                      position: 'relative', overflow: 'hidden',
                      animation: `cardReveal 0.5s ease ${i*0.08}s both`,
                    }}>
                      <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
                        background: `linear-gradient(90deg,transparent,${D.purple}60,transparent)`,
                      }} />
                      {/* Hunt name + venue */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '16px', color: D.text, marginBottom: '2px' }}>
                            {hunt.pack_name}
                          </div>
                          <div style={{ fontFamily: D.mono, fontSize: '10px', color: D.gold, letterSpacing: '1px' }}>
                            📍 {hunt.business_name}
                          </div>
                        </div>
                        <div style={{
                          background: hunt.redeemed ? 'rgba(16,185,129,0.1)' : 'rgba(124,58,237,0.1)',
                          border: `1px solid ${hunt.redeemed ? 'rgba(16,185,129,0.3)' : 'rgba(124,58,237,0.3)'}`,
                          borderRadius: '20px', padding: '3px 10px',
                          fontFamily: D.mono, fontSize: '8px',
                          color: hunt.redeemed ? D.green : D.purple,
                          letterSpacing: '1px',
                        }}>
                          {hunt.redeemed ? 'REDEEMED' : 'COMPLETED'}
                        </div>
                      </div>

                      {/* Stats row */}
                      <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
                        {[
                          { l: 'DATE', v: new Date(hunt.completed_at).toLocaleDateString('en-GB') },
                          { l: 'TIME', v: hunt.duration_mins ? `${hunt.duration_mins} min` : '—' },
                          { l: 'DISTANCE', v: hunt.distance_km ? `${hunt.distance_km} km` : '—' },
                          { l: 'DIFFICULTY', v: hunt.difficulty?.toUpperCase() || '—' },
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
                  ))}
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
                <div style={{ fontFamily: D.mono, fontSize: '9px', color: D.textDim, letterSpacing: '3px' }}>
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
                <div style={{ fontFamily: D.mono, fontSize: '9px', color: D.textDim, letterSpacing: '3px', marginBottom: '14px' }}>HOW REFERRALS WORK</div>
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
      `}</style>
    </div>
  );
}
