import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const D = {
  bg:       '#06060E',
  card:     '#0E0E1A',
  cardAlt:  '#121218',
  border:   '#1E1E2E',
  borderMid:'#32324A',
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

const STATES = {
  IDLE:      'idle',
  LOADING:   'loading',
  VALID:     'valid',
  INVALID:   'invalid',
  USED:      'used',
  CONFIRMED: 'confirmed',
};

export default function StaffRedeem() {
  const [pin,        setPin]        = useState('');
  const [pinOk,      setPinOk]      = useState(false);
  const [pinErr,     setPinErr]      = useState(false);
  const [code,       setCode]        = useState('');
  const [state,      setState]       = useState(STATES.IDLE);
  const [voucherData,setVoucherData] = useState(null);
  const [businessId, setBusinessId]  = useState(null);
  const [staffPin,   setStaffPin]    = useState(null);

  // On mount — get business from URL or session
  // /staff?b=business-id or just /staff (uses logged in business)
  const params     = new URLSearchParams(window.location.search);
  const bizIdParam = params.get('b');

  // ── LOAD BUSINESS PIN ──────────────────────────────────────
  const loadBusiness = async () => {
    const id = bizIdParam || businessId;
    if (!id) return;
    const { data } = await supabase
      .from('businesses')
      .select('id, name, redemption_pin_hash')
      .eq('id', id)
      .single();
    if (data) {
      setBusinessId(data.id);
      setStaffPin(data.redemption_pin_hash);
    }
  };

  // ── VALIDATE VOUCHER ───────────────────────────────────────
  const validateCode = async () => {
    if (code.length < 4) return;
    setState(STATES.LOADING);

    try {
      // Look up redemption by code
      const { data: redemption } = await supabase
        .from('redemptions')
        .select(`
          id, voucher_code, redeemed_at, created_at,
          hunt_sessions(
            id,
            puzzle_packs(name, difficulty_level),
            businesses(name, id)
          )
        `)
        .eq('voucher_code', code.toUpperCase())
        .maybeSingle();

      if (!redemption) {
        setState(STATES.INVALID);
        return;
      }

      if (redemption.redeemed_at) {
        setState(STATES.USED);
        setVoucherData(redemption);
        return;
      }

      setVoucherData(redemption);
      setState(STATES.VALID);
    } catch (err) {
      setState(STATES.INVALID);
    }
  };

  // ── CONFIRM REDEMPTION ─────────────────────────────────────
  const confirmRedemption = async () => {
    if (!voucherData?.id) return;
    setState(STATES.LOADING);

    try {
      await supabase
        .from('redemptions')
        .update({ redeemed_at: new Date().toISOString() })
        .eq('id', voucherData.id);

      setState(STATES.CONFIRMED);
    } catch (err) {
      setState(STATES.INVALID);
    }
  };

  // ── RESET ──────────────────────────────────────────────────
  const reset = () => {
    setCode('');
    setState(STATES.IDLE);
    setVoucherData(null);
  };

  // ── PIN KEYPAD ─────────────────────────────────────────────
  const PinKeypad = ({ value, onChange, onConfirm, error }) => {
    const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
    return (
      <div>
        {/* Display */}
        <div style={{
          display: 'flex', gap: '10px', justifyContent: 'center',
          marginBottom: '24px',
        }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              width: '48px', height: '56px',
              background: D.cardAlt,
              border: `1px solid ${error ? D.red : value.length > i ? D.purple : D.border}`,
              borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '24px', color: D.text, fontFamily: D.mono,
              transition: 'border-color .2s',
            }}>
              {value.length > i ? '●' : ''}
            </div>
          ))}
        </div>

        {/* Keypad */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px', maxWidth: '240px', margin: '0 auto',
        }}>
          {keys.map((k, i) => (
            <button
              key={i}
              disabled={k === ''}
              onClick={() => {
                if (k === '⌫') {
                  onChange(value.slice(0, -1));
                } else if (k !== '' && value.length < 4) {
                  const next = value + k;
                  onChange(next);
                  if (next.length === 4) onConfirm(next);
                }
              }}
              style={{
                background: k === '' ? 'transparent' : D.card,
                border: k === '' ? 'none' : `1px solid ${D.border}`,
                color: k === '⌫' ? D.textMuted : D.text,
                borderRadius: '10px', padding: '16px',
                fontSize: '20px', fontFamily: D.mono,
                cursor: k === '' ? 'default' : 'pointer',
                transition: 'background .15s, border-color .15s',
              }}
              onMouseEnter={e => { if (k) e.target.style.background = D.cardAlt; }}
              onMouseLeave={e => { if (k) e.target.style.background = D.card; }}
            >{k}</button>
          ))}
        </div>

        {error && (
          <div style={{
            textAlign: 'center', marginTop: '16px',
            fontFamily: D.mono, fontSize: '11px', color: D.red, letterSpacing: '2px',
          }}>INCORRECT PIN</div>
        )}
      </div>
    );
  };

  const formatTime = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  // ── RENDER ─────────────────────────────────────────────────
  return (
    <div style={{
      background: D.bg, minHeight: '100vh',
      fontFamily: D.body, color: D.text,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
    }}>

      {/* Header */}
      <div style={{
        width: '100%', background: D.card,
        borderBottom: `1px solid ${D.border}`,
        padding: '16px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px', height: '28px', background: D.purple,
            borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="5.5" r="3.5" fill="#F1F0FF"/>
              <path d="M 3.5 7.5 Q 7 12 10.5 7.5 Z" fill="#F1F0FF"/>
              <circle cx="7" cy="5.5" r="1.4" fill="#7C3AED"/>
            </svg>
          </div>
          <span style={{ fontFamily: D.display, fontWeight: 900, fontSize: '16px' }}>
            Map<span style={{ color: D.purple, fontSize: '10px', letterSpacing: '3px', margin: '0 3px', fontFamily: D.mono }}>THE</span>
            <span style={{ color: D.gold }}>Movie</span>
          </span>
        </div>
        <div style={{ fontFamily: D.mono, fontSize: '10px', color: D.textDim, letterSpacing: '2px' }}>
          STAFF REDEMPTION
        </div>
      </div>

      {/* Main content */}
      <div style={{
        width: '100%', maxWidth: '420px',
        padding: '40px 24px', flex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>

        {/* ── PIN GATE ── */}
        {!pinOk && (
          <div style={{ width: '100%', textAlign: 'center' }}>
            <div style={{
              fontFamily: D.mono, fontSize: '10px', color: D.purple,
              letterSpacing: '4px', marginBottom: '12px',
            }}>STAFF ACCESS</div>
            <div style={{
              fontFamily: D.display, fontWeight: 900, fontSize: '24px',
              color: D.text, marginBottom: '8px',
            }}>Enter staff PIN</div>
            <div style={{
              fontSize: '14px', color: D.textMuted,
              marginBottom: '32px', lineHeight: 1.6,
            }}>Your 4-digit PIN from the business dashboard</div>

            <PinKeypad
              value={pin}
              onChange={setPin}
              error={pinErr}
              onConfirm={async (enteredPin) => {
                // Check PIN against business
                // For now simple check — in production hash compare
                await loadBusiness();
                // Simple validation — real version uses bcrypt hash compare
                if (enteredPin.length === 4) {
                  setPinOk(true);
                  setPinErr(false);
                } else {
                  setPinErr(true);
                  setPin('');
                }
              }}
            />
          </div>
        )}

        {/* ── CODE ENTRY ── */}
        {pinOk && state === STATES.IDLE && (
          <div style={{ width: '100%', textAlign: 'center' }}>
            <div style={{
              fontFamily: D.mono, fontSize: '10px', color: D.purple,
              letterSpacing: '4px', marginBottom: '12px',
            }}>VALIDATE REWARD</div>
            <div style={{
              fontFamily: D.display, fontWeight: 900, fontSize: '28px',
              color: D.text, marginBottom: '8px',
            }}>Enter voucher code</div>
            <div style={{
              fontSize: '14px', color: D.textMuted,
              marginBottom: '32px', lineHeight: 1.6,
            }}>Type the code shown on the player's screen</div>

            <input
              type="text"
              placeholder="MTM-XXXX-0000"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && validateCode()}
              maxLength={16}
              style={{
                width: '100%', padding: '18px',
                background: D.card, border: `1px solid ${D.border}`,
                borderRadius: '12px', color: D.text,
                fontSize: '24px', fontFamily: D.mono,
                letterSpacing: '6px', textAlign: 'center',
                outline: 'none', marginBottom: '16px',
                boxSizing: 'border-box',
              }}
            />

            <button
              onClick={validateCode}
              disabled={code.length < 4}
              style={{
                width: '100%', padding: '16px',
                background: code.length >= 4
                  ? `linear-gradient(135deg, ${D.purple}, ${D.purpleL})`
                  : D.card,
                color: code.length >= 4 ? '#FFF' : D.textDim,
                border: `1px solid ${code.length >= 4 ? 'transparent' : D.border}`,
                borderRadius: '12px', fontSize: '14px',
                fontFamily: D.mono, letterSpacing: '3px',
                cursor: code.length >= 4 ? 'pointer' : 'not-allowed',
                transition: 'all .2s',
              }}
            >VALIDATE CODE</button>
          </div>
        )}

        {/* ── LOADING ── */}
        {state === STATES.LOADING && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: D.mono, fontSize: '12px', color: D.textMuted,
              letterSpacing: '3px', animation: 'pulse 1s infinite',
            }}>CHECKING...</div>
          </div>
        )}

        {/* ── VALID ── */}
        {state === STATES.VALID && voucherData && (
          <div style={{ width: '100%', textAlign: 'center' }}>
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: 'rgba(16,185,129,0.12)',
              border: `2px solid ${D.green}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px',
              boxShadow: `0 0 30px rgba(16,185,129,0.3)`,
            }}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M 6 16 L 13 23 L 26 9" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            <div style={{
              fontFamily: D.mono, fontSize: '12px', color: D.green,
              letterSpacing: '4px', marginBottom: '8px',
            }}>VALID REWARD</div>
            <div style={{
              fontFamily: D.display, fontWeight: 900, fontSize: '32px',
              color: D.text, marginBottom: '24px',
            }}>Reward confirmed</div>

            {/* Voucher details */}
            <div style={{
              background: D.card, border: `1px solid ${D.border}`,
              borderRadius: '16px', padding: '24px', marginBottom: '24px',
              textAlign: 'left',
            }}>
              <div style={{
                fontFamily: D.mono, fontSize: '10px', color: D.textDim,
                letterSpacing: '2px', marginBottom: '16px',
              }}>VOUCHER DETAILS</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: D.textMuted }}>Code</span>
                  <span style={{ fontFamily: D.mono, fontSize: '14px', color: D.gold }}>
                    {voucherData.voucher_code}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: D.textMuted }}>Hunt</span>
                  <span style={{ fontSize: '13px', color: D.text }}>
                    {voucherData.hunt_sessions?.puzzle_packs?.name || 'Unknown Hunt'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: D.textMuted }}>Completed at</span>
                  <span style={{ fontFamily: D.mono, fontSize: '13px', color: D.text }}>
                    {formatTime(voucherData.created_at)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: D.textMuted }}>Business</span>
                  <span style={{ fontSize: '13px', color: D.text }}>
                    {voucherData.hunt_sessions?.businesses?.name || '—'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={confirmRedemption}
              style={{
                width: '100%', padding: '18px',
                background: `linear-gradient(135deg, #059669, ${D.green})`,
                color: '#FFF', border: 'none',
                borderRadius: '12px', fontSize: '15px',
                fontFamily: D.mono, letterSpacing: '3px',
                cursor: 'pointer',
                boxShadow: '0 0 24px rgba(16,185,129,0.3)',
                marginBottom: '12px',
              }}
            >CONFIRM REDEMPTION</button>

            <button
              onClick={reset}
              style={{
                width: '100%', padding: '14px',
                background: 'transparent',
                border: `1px solid ${D.border}`,
                color: D.textMuted, borderRadius: '12px',
                fontSize: '13px', fontFamily: D.mono,
                letterSpacing: '2px', cursor: 'pointer',
              }}
            >CANCEL</button>
          </div>
        )}

        {/* ── CONFIRMED ── */}
        {state === STATES.CONFIRMED && (
          <div style={{ width: '100%', textAlign: 'center' }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%',
              background: 'rgba(16,185,129,0.15)',
              border: `2px solid ${D.green}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px',
              boxShadow: `0 0 40px rgba(16,185,129,0.4)`,
            }}>
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <path d="M 7 18 L 14 25 L 29 10" stroke="#10B981" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            <div style={{
              fontFamily: D.mono, fontSize: '12px', color: D.green,
              letterSpacing: '4px', marginBottom: '8px',
            }}>REDEEMED</div>
            <div style={{
              fontFamily: D.display, fontWeight: 900, fontSize: '32px',
              color: D.text, marginBottom: '8px',
            }}>Reward given</div>
            <div style={{
              fontSize: '15px', color: D.textMuted, marginBottom: '40px',
            }}>Voucher marked as used and logged</div>

            <button
              onClick={reset}
              style={{
                width: '100%', padding: '16px',
                background: `linear-gradient(135deg, ${D.purple}, ${D.purpleL})`,
                color: '#FFF', border: 'none',
                borderRadius: '12px', fontSize: '14px',
                fontFamily: D.mono, letterSpacing: '3px', cursor: 'pointer',
              }}
            >NEXT CUSTOMER</button>
          </div>
        )}

        {/* ── INVALID ── */}
        {(state === STATES.INVALID || state === STATES.USED) && (
          <div style={{ width: '100%', textAlign: 'center' }}>
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: 'rgba(239,68,68,0.1)',
              border: `2px solid ${D.red}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px',
            }}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M 8 8 L 24 24 M 24 8 L 8 24" stroke="#EF4444" strokeWidth="3" strokeLinecap="round"/>
              </svg>
            </div>

            <div style={{
              fontFamily: D.mono, fontSize: '12px', color: D.red,
              letterSpacing: '4px', marginBottom: '8px',
            }}>{state === STATES.USED ? 'ALREADY USED' : 'INVALID CODE'}</div>
            <div style={{
              fontFamily: D.display, fontWeight: 900, fontSize: '28px',
              color: D.text, marginBottom: '8px',
            }}>
              {state === STATES.USED ? 'Already redeemed' : 'Code not found'}
            </div>
            <div style={{
              fontSize: '14px', color: D.textMuted, marginBottom: '40px', lineHeight: 1.6,
            }}>
              {state === STATES.USED
                ? `This voucher was already redeemed at ${formatTime(voucherData?.redeemed_at)}`
                : 'Check the code and try again'}
            </div>

            <button
              onClick={reset}
              style={{
                width: '100%', padding: '16px',
                background: `linear-gradient(135deg, ${D.purple}, ${D.purpleL})`,
                color: '#FFF', border: 'none',
                borderRadius: '12px', fontSize: '14px',
                fontFamily: D.mono, letterSpacing: '3px', cursor: 'pointer',
              }}
            >TRY AGAIN</button>
          </div>
        )}

      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}
