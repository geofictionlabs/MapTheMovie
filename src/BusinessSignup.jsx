import { useState, useEffect, useRef } from "react";
import { supabase } from "./lib/supabase";
import { VENUE_CATEGORIES } from "./lib/venueCategories";

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

const TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 49,
    color: D.textSub,
    badge: 'GREAT TO START',
    features: [
      'One active hunt location',
      'Standard hunt listing',
      '100 redemptions per month',
      'Business dashboard',
      'Staff redemption page',
      'Monthly visit report',
    ],
  },
  {
    id: 'featured',
    name: 'Featured',
    price: 99,
    color: D.purple,
    badge: 'MOST POPULAR',
    features: [
      'One active hunt location',
      'Featured placement in app',
      'Priority hunt discovery',
      '300 redemptions per month',
      'Business dashboard',
      'Staff redemption page',
      'Featured badge on listing',
    ],
    highlight: true,
  },
  {
    id: 'sponsored',
    name: 'Sponsored',
    price: 249,
    color: D.gold,
    badge: 'MAXIMUM EXPOSURE',
    features: [
      'Exclusive hunt pack',
      'Your branding throughout',
      'Unlimited redemptions',
      'Top placement always',
      'Dedicated hunt theme',
      'Monthly analytics call',
    ],
  },
];

// ── ANIMATED COUNTER ──────────────────────────────────────
function Counter({ to, prefix = '', suffix = '' }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const start = Date.now();
    const dur = 1800;
    const tick = () => {
      const p = Math.min((Date.now() - start) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.floor(ease * to));
      if (p < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current);
  }, [to]);
  return <span>{prefix}{val.toLocaleString()}{suffix}</span>;
}

// ── STEP INDICATOR ────────────────────────────────────────
function Steps({ current }) {
  const steps = ['About You', 'Your Venue', 'Choose Plan', 'Go Live'];
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      justifyContent: 'center', gap: 0,
      marginBottom: '48px',
    }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: i < current ? D.green : i === current ? D.purple : D.card,
              border: `2px solid ${i < current ? D.green : i === current ? D.purple : D.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: 700,
              color: i <= current ? '#FFF' : D.textDim,
              transition: 'all .3s',
            }}>
              {i < current ? '✓' : i + 1}
            </div>
            <div style={{
              fontFamily: D.mono, fontSize: '9px',
              color: i === current ? D.purple : D.textDim,
              letterSpacing: '1px', whiteSpace: 'nowrap',
            }}>{s}</div>
          </div>
          {i < steps.length - 1 && (
            <div style={{
              width: '80px', height: '2px',
              background: i < current ? D.green : D.border,
              margin: '0 8px', marginBottom: '20px',
              transition: 'background .3s',
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── INPUT COMPONENT ───────────────────────────────────────
function Input({ label, value, onChange, placeholder, type = 'text', required, error }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{
        display: 'block', fontFamily: D.mono,
        fontSize: '10px', color: error ? D.red : D.textMuted,
        letterSpacing: '2px', marginBottom: '6px',
      }}>
        {label}{required && <span style={{ color: D.purple }}> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '12px 14px',
          background: D.cardAlt,
          border: `1px solid ${error ? D.red : D.border}`,
          borderRadius: '8px', color: D.text,
          fontSize: '15px', fontFamily: D.body,
          outline: 'none', boxSizing: 'border-box',
          transition: 'border-color .2s',
        }}
        onFocus={e => e.target.style.borderColor = D.purple}
        onBlur={e => e.target.style.borderColor = error ? D.red : D.border}
      />
      {error && <div style={{ color: D.red, fontSize: '11px', marginTop: '4px', fontFamily: D.mono }}>{error}</div>}
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────
export default function BusinessSignup() {
  const [section, setSection] = useState('pitch'); // pitch | signup | success
  const [step, setStep] = useState(0);
  const [selectedTier, setSelectedTier] = useState('featured');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [stats, setStats] = useState({ players: 0, hunts: 6, questions: 130, businesses: 8 });

  const [form, setForm] = useState({
    // Step 0 — About You
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    // Step 1 — Your Venue
    businessName: '',
    address: '',
    postcode: '',
    venueCategory: '',
    website: '',
    // Step 2 — Plan selected above
    // Step 3 — Review & submit
    reward: '',
    rewardDetail: '',
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  // Load live stats
  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('campaigns').select('id', { count: 'exact', head: true }),
      supabase.from('trivia_pool').select('id', { count: 'exact', head: true }),
      supabase.from('businesses').select('id', { count: 'exact', head: true }),
    ]).then(([p, c, t, b]) => {
      setStats({
        players: p.count || 0,
        hunts: c.count || 6,
        questions: t.count || 130,
        businesses: b.count || 8,
      });
    });
  }, []);

  // Validate each step
  const validate = () => {
    const e = {};
    if (step === 0) {
      if (!form.contactName.trim()) e.contactName = 'Required';
      if (!form.contactEmail.trim()) e.contactEmail = 'Required';
      if (!/\S+@\S+\.\S+/.test(form.contactEmail)) e.contactEmail = 'Valid email required';
    }
    if (step === 1) {
      if (!form.businessName.trim()) e.businessName = 'Required';
      if (!form.address.trim()) e.address = 'Required';
      if (!form.postcode.trim()) e.postcode = 'Required';
      if (!form.venueCategory) e.venueCategory = 'Required';
    }
    if (step === 3) {
      if (!form.reward.trim()) e.reward = 'Required — what will players receive?';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (!validate()) return;
    setStep(s => s + 1);
    window.scrollTo(0, 0);
  };

  const prev = () => {
    setStep(s => s - 1);
    window.scrollTo(0, 0);
  };

  // Submit
  const submit = async () => {
    if (!validate()) return;
    setLoading(true);

    try {
      const slug = form.businessName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') + '-' + Date.now();

      // Create business record. billing_tier/subscription_active/
      // is_active/monthly_redemption_limit are deliberately NOT sent --
      // those are set by manual review when the signup is processed,
      // same pattern as every other business-critical field. The
      // businesses INSERT grant (migration 051c) only permits the
      // columns below anyway; is_active's column default is now FALSE
      // (051c), so a fresh signup starts inactive/unreviewed rather
      // than immediately live.
      // No .select() -- the result is never read below, and requesting
      // it back would ask PostgREST for select=* (every column), which
      // anon doesn't have SELECT on for most of these (migration 021
      // only grants id/name/location/is_active/billing_tier/
      // subscription_active). RETURNING's privilege check runs as part
      // of the same atomic INSERT statement, so that 403 was aborting
      // the whole insert, not just a separate read-back step.
      const { error: bizErr } = await supabase
        .from('businesses')
        .insert({
          name: form.businessName,
          slug,
          description: form.address,
          address: form.address,
          postcode: form.postcode.toUpperCase(),
          venue_category: form.venueCategory,
          contact_name: form.contactName,
          contact_email: form.contactEmail,
          contact_phone: form.contactPhone,
          location: `SRID=4326;POINT(0 51.5)`, // placeholder — updated when they Go Live
        });

      if (bizErr) throw bizErr;

      // Send notification email via Formspree. selectedTier travels here
      // as the business's stated preference only -- the real billing_tier
      // is set manually when the signup is processed, not from this form.
      await fetch('https://formspree.io/f/YOUR_FORM_ID', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business: form.businessName,
          contact: form.contactName,
          email: form.contactEmail,
          phone: form.contactPhone,
          address: form.address,
          postcode: form.postcode,
          venueCategory: form.venueCategory,
          tier: selectedTier,
          reward: form.reward,
          rewardDetail: form.rewardDetail,
          _subject: `New MapTheMovie signup — ${form.businessName}`,
        }),
      });

      setSection('success');
    } catch (err) {
      console.error('Signup error:', err);
      setErrors({ submit: 'Something went wrong. Please email hello@geofictionlabs.com' });
    } finally {
      setLoading(false);
    }
  };

  // ── PITCH SECTION ─────────────────────────────────────
  if (section === 'pitch') {
    return (
      <div style={{ background: D.bg, minHeight: '100vh', fontFamily: D.body, color: D.text }}>

        {/* Header */}
        <div style={{
          background: D.surface, borderBottom: `1px solid ${D.border}`,
          padding: '16px 40px', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 100,
        }}>
          <a href="https://mapthemovie.co.uk" style={{
            fontFamily: D.display, fontWeight: 900, fontSize: '20px',
            color: D.text, textDecoration: 'none',
          }}>
            Map<span style={{ color: D.purple, fontSize: '11px', letterSpacing: '3px', margin: '0 3px', fontFamily: D.mono }}>THE</span>
            <span style={{ color: D.gold }}>Movie</span>
          </a>
          <button onClick={() => setSection('signup')} style={{
            background: `linear-gradient(135deg,${D.green},#059669)`,
            color: '#FFF', border: 'none', padding: '10px 24px',
            borderRadius: '8px', fontSize: '14px', fontWeight: 700,
            cursor: 'pointer', fontFamily: D.body,
          }}>Start Free Month →</button>
        </div>

        {/* Hero */}
        <div style={{
          padding: '80px 40px',
          background: `radial-gradient(ellipse at 30% 50%, #1A0533 0%, ${D.bg} 60%)`,
          textAlign: 'center', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `linear-gradient(rgba(124,58,237,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(124,58,237,0.04) 1px,transparent 1px)`,
            backgroundSize: '60px 60px', pointerEvents: 'none',
          }} />
          <div style={{ position: 'relative', zIndex: 1, maxWidth: '800px', margin: '0 auto' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: '20px', padding: '5px 14px',
              fontFamily: D.mono, fontSize: '10px', color: D.green,
              letterSpacing: '2px', marginBottom: '24px',
            }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: D.green }} />
              LIVE ACROSS THE UK
            </div>
            <h1 style={{
              fontFamily: D.display, fontWeight: 900,
              fontSize: 'clamp(36px,6vw,72px)',
              color: D.text, lineHeight: 1.05,
              letterSpacing: '-2px', marginBottom: '20px',
            }}>
              Players guided<br />
              <span style={{ color: D.gold }}>directly to your door.</span>
            </h1>
            <p style={{
              fontSize: '19px', color: D.textMuted,
              maxWidth: '600px', margin: '0 auto 40px',
              lineHeight: 1.7,
            }}>
              MapTheMovie sends players to your venue via GPS treasure hunt.
              They solve movie trivia. The answer is your location.
              They arrive ready to spend.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setSection('signup')} style={{
                background: `linear-gradient(135deg,${D.green},#059669)`,
                color: '#FFF', border: 'none',
                padding: '18px 48px', borderRadius: '12px',
                fontSize: '17px', fontWeight: 700,
                cursor: 'pointer', fontFamily: D.body,
                boxShadow: '0 8px 32px rgba(16,185,129,0.3)',
              }}>Start Your Free Month</button>
              <a href="mailto:hello@geofictionlabs.com" style={{
                background: 'transparent',
                border: `1px solid ${D.border}`,
                color: D.textMuted, padding: '18px 32px',
                borderRadius: '12px', fontSize: '16px',
                textDecoration: 'none', display: 'inline-block',
                fontFamily: D.body,
              }}>Talk to us first</a>
            </div>
          </div>
        </div>

        {/* Live Stats */}
        <div style={{ padding: '60px 40px', maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{ fontFamily: D.mono, fontSize: '10px', color: D.purple, letterSpacing: '4px', marginBottom: '8px' }}>LIVE PLATFORM DATA</div>
            <h2 style={{ fontFamily: D.display, fontWeight: 900, fontSize: 'clamp(28px,4vw,44px)', color: D.text, letterSpacing: '-1px' }}>
              Real numbers. Real players.
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px' }}>
            {[
              { label: 'PLAYERS', value: stats.players || 1, accent: D.purple },
              { label: 'HUNT LOCATIONS', value: stats.hunts, accent: D.gold },
              { label: 'TRIVIA QUESTIONS', value: stats.questions, suffix: '+', accent: D.textSub },
              { label: 'BUSINESSES', value: stats.businesses, accent: D.green },
            ].map((s, i) => (
              <div key={i} style={{
                background: D.card, border: `1px solid ${D.border}`,
                borderRadius: '14px', padding: '28px 20px', textAlign: 'center',
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg,transparent,${s.accent},transparent)` }} />
                <div style={{ fontFamily: D.display, fontWeight: 900, fontSize: '44px', color: s.accent, lineHeight: 1 }}>
                  <Counter to={s.value} suffix={s.suffix || ''} />
                </div>
                <div style={{ fontFamily: D.mono, fontSize: '9px', color: D.textDim, letterSpacing: '2px', marginTop: '6px' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div style={{ padding: '60px 40px', background: D.surface, borderTop: `1px solid ${D.border}`, borderBottom: `1px solid ${D.border}` }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '48px' }}>
              <div style={{ fontFamily: D.mono, fontSize: '10px', color: D.purple, letterSpacing: '4px', marginBottom: '8px' }}>HOW IT WORKS</div>
              <h2 style={{ fontFamily: D.display, fontWeight: 900, fontSize: 'clamp(28px,4vw,44px)', color: D.text, letterSpacing: '-1px' }}>
                Up and running in 20 minutes.
              </h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px' }}>
              {[
                { n: '01', title: 'Sign up', body: 'Create your account in minutes. Choose your reward for players who arrive.', accent: D.purple },
                { n: '02', title: 'Go Live', body: 'Tap Go Live in your dashboard. We capture your GPS location automatically.', accent: D.gold },
                { n: '03', title: 'Players hunt', body: 'MapTheMovie players nearby solve clues that lead directly to your venue.', accent: D.green },
                { n: '04', title: 'They arrive', body: 'Players claim their reward on arrival. Everything logged in your dashboard.', accent: D.purpleL },
              ].map((s, i) => (
                <div key={i} style={{
                  background: D.card, border: `1px solid ${D.border}`,
                  borderRadius: '14px', padding: '24px 20px',
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg,${s.accent},transparent)` }} />
                  <div style={{ fontFamily: D.mono, fontSize: '11px', color: s.accent, letterSpacing: '2px', marginBottom: '10px' }}>{s.n}</div>
                  <div style={{ fontWeight: 700, fontSize: '16px', color: D.text, marginBottom: '8px' }}>{s.title}</div>
                  <div style={{ fontSize: '13px', color: D.textMuted, lineHeight: 1.6 }}>{s.body}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '32px' }}>
              {['No app for your staff', 'No special equipment', 'Works on any phone', 'Cancel anytime', 'No contract'].map((t, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
                  borderRadius: '20px', padding: '6px 14px',
                }}>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: D.green }} />
                  <span style={{ fontSize: '13px', color: D.textSub }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div style={{ padding: '60px 40px', maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div style={{ fontFamily: D.mono, fontSize: '10px', color: D.purple, letterSpacing: '4px', marginBottom: '8px' }}>PRICING</div>
            <h2 style={{ fontFamily: D.display, fontWeight: 900, fontSize: 'clamp(28px,4vw,44px)', color: D.text, letterSpacing: '-1px' }}>
              Simple. No contracts.
            </h2>
            <p style={{ fontSize: '16px', color: D.textMuted, marginTop: '8px' }}>First month completely free. Cancel anytime.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', marginBottom: '40px' }}>
            {TIERS.map((t, i) => (
              <div key={t.id} style={{
                background: t.highlight ? `linear-gradient(135deg,#0E0E1E,#120D20)` : D.card,
                border: `${t.highlight ? 2 : 1}px solid ${t.highlight ? D.purple : D.border}`,
                borderRadius: '16px', padding: '28px 24px',
                position: 'relative', overflow: 'hidden',
                boxShadow: t.highlight ? `0 0 40px rgba(124,58,237,0.15)` : 'none',
              }}>
                {t.highlight && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg,transparent,${D.purple},transparent)` }} />}
                <div style={{ fontFamily: D.mono, fontSize: '9px', color: t.color, letterSpacing: '2px', marginBottom: '8px' }}>{t.badge}</div>
                <div style={{ fontFamily: D.display, fontWeight: 900, fontSize: '22px', color: D.text, marginBottom: '4px' }}>{t.name}</div>
                <div style={{ marginBottom: '16px' }}>
                  <span style={{ fontFamily: D.display, fontWeight: 900, fontSize: '40px', color: t.color }}>£{t.price}</span>
                  <span style={{ fontFamily: D.mono, fontSize: '11px', color: D.textDim }}>/month</span>
                </div>
                <div style={{
                  background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
                  borderRadius: '6px', padding: '6px 10px',
                  fontFamily: D.mono, fontSize: '9px', color: D.green,
                  letterSpacing: '1px', marginBottom: '16px', textAlign: 'center',
                }}>FIRST MONTH FREE</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {t.features.map((f, j) => (
                    <div key={j} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: t.color, flexShrink: 0, marginTop: '5px' }} />
                      <span style={{ fontSize: '13px', color: D.textSub, lineHeight: 1.4 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center' }}>
            <button onClick={() => setSection('signup')} style={{
              background: `linear-gradient(135deg,${D.green},#059669)`,
              color: '#FFF', border: 'none',
              padding: '18px 56px', borderRadius: '12px',
              fontSize: '17px', fontWeight: 700,
              cursor: 'pointer', fontFamily: D.body,
              boxShadow: '0 8px 32px rgba(16,185,129,0.3)',
            }}>Start Your Free Month →</button>
            <div style={{ marginTop: '12px', fontFamily: D.mono, fontSize: '10px', color: D.textDim, letterSpacing: '1px' }}>
              NO PAYMENT NEEDED TO START · NO CONTRACT · CANCEL ANYTIME
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          background: D.surface, borderTop: `1px solid ${D.border}`,
          padding: '32px 40px', textAlign: 'center',
        }}>
          <div style={{ fontFamily: D.mono, fontSize: '10px', color: D.textDim, letterSpacing: '2px' }}>
            GEOFICTION LABS LIMITED · REGISTERED IN ENGLAND AND WALES · HELLO@GEOFICTIONLABS.COM
          </div>
        </div>
      </div>
    );
  }

  // ── SUCCESS SECTION ───────────────────────────────────
  if (section === 'success') {
    return (
      <div style={{
        background: D.bg, minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: D.body, color: D.text, textAlign: 'center', padding: '40px',
      }}>
        <div style={{ maxWidth: '500px' }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            background: 'rgba(16,185,129,0.12)',
            border: `2px solid ${D.green}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 32px',
            boxShadow: `0 0 40px rgba(16,185,129,0.4)`,
          }}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <path d="M 7 18 L 14 25 L 29 10" stroke="#10B981" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ fontFamily: D.mono, fontSize: '10px', color: D.green, letterSpacing: '4px', marginBottom: '12px' }}>YOU'RE IN</div>
          <h2 style={{ fontFamily: D.display, fontWeight: 900, fontSize: '40px', color: D.text, marginBottom: '12px', letterSpacing: '-1px' }}>
            Welcome to MapTheMovie
          </h2>
          <p style={{ fontSize: '16px', color: D.textMuted, lineHeight: 1.7, marginBottom: '32px' }}>
            {form.businessName} is registered. Our team will be in touch within 24 hours to get you set up and live.
          </p>
          <div style={{
            background: D.card, border: `1px solid ${D.border}`,
            borderRadius: '12px', padding: '20px 24px', marginBottom: '28px', textAlign: 'left',
          }}>
            <div style={{ fontFamily: D.mono, fontSize: '9px', color: D.textDim, letterSpacing: '2px', marginBottom: '12px' }}>YOUR SIGNUP SUMMARY</div>
            {[
              ['Business', form.businessName],
              ['Contact', form.contactName],
              ['Email', form.contactEmail],
              ['Plan', `${selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)} — £${TIERS.find(t => t.id === selectedTier)?.price}/month`],
              ['First month', 'FREE'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${D.border}` }}>
                <span style={{ fontSize: '13px', color: D.textMuted }}>{k}</span>
                <span style={{ fontSize: '13px', color: D.text, fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
          <a href="https://app.mapthemovie.co.uk/dashboard" style={{
            display: 'block', width: '100%',
            background: `linear-gradient(135deg,${D.purple},${D.purpleL})`,
            color: '#FFF', padding: '16px',
            borderRadius: '12px', fontSize: '15px',
            fontWeight: 700, textDecoration: 'none',
            fontFamily: D.body, boxSizing: 'border-box',
            marginBottom: '12px',
          }}>Go to Your Dashboard →</a>
          <div style={{ fontSize: '13px', color: D.textMuted }}>
            Questions? Email <a href="mailto:hello@geofictionlabs.com" style={{ color: D.purple }}>hello@geofictionlabs.com</a>
          </div>
        </div>
      </div>
    );
  }

  // ── SIGNUP FORM ───────────────────────────────────────
  const tierData = TIERS.find(t => t.id === selectedTier);

  return (
    <div style={{ background: D.bg, minHeight: '100vh', fontFamily: D.body, color: D.text }}>
      {/* Header */}
      <div style={{
        background: D.surface, borderBottom: `1px solid ${D.border}`,
        padding: '16px 40px', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
      }}>
        <a href="/business" onClick={e => { e.preventDefault(); setSection('pitch'); }} style={{
          fontFamily: D.display, fontWeight: 900, fontSize: '20px',
          color: D.text, textDecoration: 'none',
        }}>
          Map<span style={{ color: D.purple, fontSize: '11px', letterSpacing: '3px', margin: '0 3px', fontFamily: D.mono }}>THE</span>
          <span style={{ color: D.gold }}>Movie</span>
        </a>
        <div style={{ fontFamily: D.mono, fontSize: '10px', color: D.textDim, letterSpacing: '2px' }}>
          BUSINESS SIGNUP · FIRST MONTH FREE
        </div>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '48px 24px' }}>
        <Steps current={step} />

        {/* Step 0 — About You */}
        {step === 0 && (
          <div>
            <h2 style={{ fontFamily: D.display, fontWeight: 900, fontSize: '32px', color: D.text, letterSpacing: '-0.5px', marginBottom: '8px' }}>
              Let's get started.
            </h2>
            <p style={{ color: D.textMuted, marginBottom: '32px' }}>Tell us about yourself — we'll use this to set up your account.</p>
            <Input label="YOUR NAME" value={form.contactName} onChange={v => set('contactName', v)} placeholder="Michael Reece" required error={errors.contactName} />
            <Input label="EMAIL ADDRESS" type="email" value={form.contactEmail} onChange={v => set('contactEmail', v)} placeholder="you@yourbusiness.com" required error={errors.contactEmail} />
            <Input label="PHONE NUMBER" type="tel" value={form.contactPhone} onChange={v => set('contactPhone', v)} placeholder="07700 000000" />
          </div>
        )}

        {/* Step 1 — Your Venue */}
        {step === 1 && (
          <div>
            <h2 style={{ fontFamily: D.display, fontWeight: 900, fontSize: '32px', color: D.text, letterSpacing: '-0.5px', marginBottom: '8px' }}>
              Your venue.
            </h2>
            <p style={{ color: D.textMuted, marginBottom: '32px' }}>We'll use this to set up your hunt location.</p>
            <Input label="BUSINESS NAME" value={form.businessName} onChange={v => set('businessName', v)} placeholder="The Anchor Inn" required error={errors.businessName} />
            <Input label="ADDRESS" value={form.address} onChange={v => set('address', v)} placeholder="123 High Street, Chatham" required error={errors.address} />
            <Input label="POSTCODE" value={form.postcode} onChange={v => set('postcode', v.toUpperCase())} placeholder="ME4 1AB" required error={errors.postcode} />
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block', fontFamily: D.mono,
                fontSize: '10px', color: errors.venueCategory ? D.red : D.textMuted,
                letterSpacing: '2px', marginBottom: '6px',
              }}>
                VENUE CATEGORY<span style={{ color: D.purple }}> *</span>
              </label>
              <select
                value={form.venueCategory}
                onChange={e => set('venueCategory', e.target.value)}
                style={{
                  width: '100%', padding: '12px 14px',
                  background: D.cardAlt,
                  border: `1px solid ${errors.venueCategory ? D.red : D.border}`,
                  borderRadius: '8px', color: form.venueCategory ? D.text : D.textDim,
                  fontSize: '15px', fontFamily: D.body,
                  outline: 'none', boxSizing: 'border-box',
                  cursor: 'pointer',
                }}
              >
                <option value="">Select...</option>
                {VENUE_CATEGORIES.map(c => (
                  <option key={c.value} value={c.value} style={{ background: D.card }}>{c.emoji} {c.value}</option>
                ))}
              </select>
              {form.venueCategory && (
                <div style={{ marginTop: '6px', fontSize: '12px', color: D.textMuted, fontStyle: 'italic' }}>
                  {VENUE_CATEGORIES.find(c => c.value === form.venueCategory)?.caption}
                </div>
              )}
              {errors.venueCategory && <div style={{ color: D.red, fontSize: '11px', marginTop: '4px', fontFamily: D.mono }}>{errors.venueCategory}</div>}
            </div>
            <Input label="WEBSITE (OPTIONAL)" value={form.website} onChange={v => set('website', v)} placeholder="www.yourwebsite.com" />
          </div>
        )}

        {/* Step 2 — Choose Plan */}
        {step === 2 && (
          <div>
            <h2 style={{ fontFamily: D.display, fontWeight: 900, fontSize: '32px', color: D.text, letterSpacing: '-0.5px', marginBottom: '8px' }}>
              Choose your plan.
            </h2>
            <p style={{ color: D.textMuted, marginBottom: '32px' }}>First month free. No payment needed today.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '8px' }}>
              {TIERS.map(t => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTier(t.id)}
                  style={{
                    background: selectedTier === t.id ? `rgba(124,58,237,0.08)` : D.card,
                    border: `${selectedTier === t.id ? 2 : 1}px solid ${selectedTier === t.id ? D.purple : D.border}`,
                    borderRadius: '12px', padding: '20px 20px',
                    cursor: 'pointer', transition: 'all .2s',
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '20px', height: '20px', borderRadius: '50%',
                      border: `2px solid ${selectedTier === t.id ? D.purple : D.border}`,
                      background: selectedTier === t.id ? D.purple : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {selectedTier === t.id && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FFF' }} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '16px', color: D.text }}>{t.name}</div>
                      <div style={{ fontSize: '12px', color: D.textMuted, marginTop: '2px' }}>{t.features[0]}, {t.features[1]}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: D.display, fontWeight: 900, fontSize: '24px', color: t.color }}>£{t.price}</div>
                    <div style={{ fontFamily: D.mono, fontSize: '9px', color: D.textDim }}>/MONTH</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{
              background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: '8px', padding: '10px 16px', marginTop: '12px',
              fontFamily: D.mono, fontSize: '10px', color: D.green,
              letterSpacing: '1px', textAlign: 'center',
            }}>
              FIRST MONTH FREE — NO CARD NEEDED TODAY
            </div>
          </div>
        )}

        {/* Step 3 — Reward & Review */}
        {step === 3 && (
          <div>
            <h2 style={{ fontFamily: D.display, fontWeight: 900, fontSize: '32px', color: D.text, letterSpacing: '-0.5px', marginBottom: '8px' }}>
              Set your reward.
            </h2>
            <p style={{ color: D.textMuted, marginBottom: '32px' }}>Players see this when they complete their hunt and arrive at your venue.</p>

            <Input
              label="REWARD HEADLINE"
              value={form.reward}
              onChange={v => set('reward', v)}
              placeholder="20% off your first drink"
              required
              error={errors.reward}
            />
            <Input
              label="REWARD DETAIL (OPTIONAL)"
              value={form.rewardDetail}
              onChange={v => set('rewardDetail', v)}
              placeholder="Show this screen to any member of staff"
            />

            {/* Review summary */}
            <div style={{
              background: D.card, border: `1px solid ${D.border}`,
              borderRadius: '12px', padding: '20px 24px', marginTop: '24px',
            }}>
              <div style={{ fontFamily: D.mono, fontSize: '9px', color: D.textDim, letterSpacing: '2px', marginBottom: '14px' }}>ORDER SUMMARY</div>
              {[
                ['Business', form.businessName],
                ['Location', `${form.address}, ${form.postcode}`],
                ['Venue category', form.venueCategory],
                ['Contact', `${form.contactName} — ${form.contactEmail}`],
                ['Plan', `${tierData?.name} — £${tierData?.price}/month`],
                ['First month', 'FREE'],
              ].map(([k, v]) => (
                <div key={k} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '8px 0', borderBottom: `1px solid ${D.border}`,
                  gap: '12px',
                }}>
                  <span style={{ fontSize: '13px', color: D.textMuted, flexShrink: 0 }}>{k}</span>
                  <span style={{ fontSize: '13px', color: D.text, fontWeight: 500, textAlign: 'right' }}>{v}</span>
                </div>
              ))}
            </div>

            {errors.submit && (
              <div style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '8px', padding: '12px 16px', marginTop: '16px',
                color: D.red, fontSize: '13px',
              }}>{errors.submit}</div>
            )}
          </div>
        )}

        {/* Navigation buttons */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          marginTop: '32px', gap: '12px',
        }}>
          {step > 0 ? (
            <button onClick={prev} style={{
              background: 'transparent', border: `1px solid ${D.border}`,
              color: D.textMuted, padding: '14px 24px',
              borderRadius: '10px', fontSize: '14px',
              fontFamily: D.body, cursor: 'pointer',
            }}>← Back</button>
          ) : (
            <button onClick={() => setSection('pitch')} style={{
              background: 'transparent', border: `1px solid ${D.border}`,
              color: D.textMuted, padding: '14px 24px',
              borderRadius: '10px', fontSize: '14px',
              fontFamily: D.body, cursor: 'pointer',
            }}>← Back</button>
          )}

          {step < 3 ? (
            <button onClick={next} style={{
              background: `linear-gradient(135deg,${D.purple},${D.purpleL})`,
              color: '#FFF', border: 'none',
              padding: '14px 32px', borderRadius: '10px',
              fontSize: '15px', fontWeight: 700,
              fontFamily: D.body, cursor: 'pointer',
              flex: 1,
            }}>Continue →</button>
          ) : (
            <button onClick={submit} disabled={loading} style={{
              background: loading ? D.border : `linear-gradient(135deg,${D.green},#059669)`,
              color: '#FFF', border: 'none',
              padding: '14px 32px', borderRadius: '10px',
              fontSize: '15px', fontWeight: 700,
              fontFamily: D.body, cursor: loading ? 'not-allowed' : 'pointer',
              flex: 1,
            }}>
              {loading ? 'Submitting...' : 'Complete Signup →'}
            </button>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px', fontFamily: D.mono, fontSize: '10px', color: D.textDim, letterSpacing: '1px' }}>
          By signing up you agree to our <a href="/terms" style={{ color: D.purple }}>Terms of Service</a>
        </div>
      </div>
    </div>
  );
}
