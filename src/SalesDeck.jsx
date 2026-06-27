import { useState, useEffect, useRef } from "react";
import { supabase } from "./lib/supabase";

// ── DESIGN TOKENS ──────────────────────────────────────────
const D = {
  bg:       '#06060E',
  surface:  '#0A0A14',
  card:     '#0E0E1A',
  cardAlt:  '#121218',
  border:   '#1E1E2E',
  purple:   '#7C3AED',
  purpleL:  '#9D5FF5',
  gold:     '#F59E0B',
  green:    '#10B981',
  text:     '#F1F0FF',
  textSub:  '#B8B4D8',
  textMuted:'#6B67A0',
  textDim:  '#32325A',
  mono:     "'Share Tech Mono', monospace",
  display:  "'Nunito', sans-serif",
  body:     "'Space Grotesk', sans-serif",
};


const SCREENS = [
  'hook', 'problem', 'solution',
  'howItWorks', 'stats', 'dashboard',
  'pricing', 'objections', 'close'
];

// ── ANIMATED COMPASS ───────────────────────────────────────
function LiveCompass() {
  const [angle, setAngle] = useState(0);
  useEffect(() => {
    let a = 0;
    const t = setInterval(() => {
      a = (a + 0.8) % 360;
      setAngle(a);
    }, 16);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{
      width: '180px', height: '180px',
      borderRadius: '50%',
      border: `2px solid ${D.purple}`,
      position: 'relative',
      background: `radial-gradient(circle, #0E0E1A, #06060E)`,
      boxShadow: `0 0 40px rgba(124,58,237,0.3)`,
      margin: '0 auto',
    }}>
      {/* Ring dots */}
      {Array.from({length:12}).map((_,i) => (
        <div key={i} style={{
          position:'absolute',
          width:'6px', height:'6px',
          borderRadius:'50%',
          background: i % 3 === 0 ? D.purple : D.textDim,
          top: '50%', left: '50%',
          transform: `rotate(${i*30}deg) translateY(-82px) translate(-50%,-50%)`,
        }}/>
      ))}
      {/* Needle */}
      <div style={{
        position:'absolute', top:'50%', left:'50%',
        width:'3px', height:'70px',
        transformOrigin:'bottom center',
        transform:`translate(-50%,-100%) rotate(${angle}deg)`,
        transition:'transform 0.05s linear',
      }}>
        <div style={{
          width:'3px', height:'50px',
          background:`linear-gradient(180deg,${D.gold},transparent)`,
          borderRadius:'2px',
        }}/>
      </div>
      {/* Center dot */}
      <div style={{
        position:'absolute', top:'50%', left:'50%',
        width:'10px', height:'10px',
        borderRadius:'50%',
        background: D.purple,
        transform:'translate(-50%,-50%)',
        boxShadow:`0 0 12px ${D.purple}`,
      }}/>
      {/* Compass labels */}
      {[['N',0],['E',90],['S',180],['W',270]].map(([l,a]) => (
        <div key={l} style={{
          position:'absolute', top:'50%', left:'50%',
          fontFamily: D.mono, fontSize:'11px',
          color: l === 'N' ? D.gold : D.textMuted,
          fontWeight: l === 'N' ? 700 : 400,
          transform:`rotate(${a}deg) translateY(-70px) rotate(-${a}deg) translate(-50%,-50%)`,
        }}>{l}</div>
      ))}
    </div>
  );
}

// ── STAT COUNTER ──────────────────────────────────────────
function Counter({ to, prefix='', suffix='', duration=2000 }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const p = Math.min((Date.now()-start)/duration, 1);
      setVal(Math.floor(p * to));
      if (p < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current);
  }, [to]);
  return <span>{prefix}{val.toLocaleString()}{suffix}</span>;
}

// ── SCREEN COMPONENTS ─────────────────────────────────────

function ScreenHook({ onNext }) {
  return (
    <div style={{
      height:'100%', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      textAlign:'center', padding:'60px 80px',
      background:`radial-gradient(ellipse at center, #1A0533 0%, ${D.bg} 70%)`,
      position:'relative', overflow:'hidden',
    }}>
      {/* Grid background */}
      <div style={{
        position:'absolute', inset:0,
        backgroundImage:`linear-gradient(rgba(124,58,237,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(124,58,237,0.05) 1px,transparent 1px)`,
        backgroundSize:'60px 60px',
        pointerEvents:'none',
      }}/>

      {/* Logo */}
      <div style={{
        display:'flex', alignItems:'center', gap:'16px',
        marginBottom:'48px',
        animation:'fadeUp 0.8s ease both',
      }}>
        <div style={{
          width:'56px', height:'56px',
          background: D.purple, borderRadius:'14px',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:`0 0 40px rgba(124,58,237,0.5)`,
        }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="11" r="7" fill="#F1F0FF"/>
            <path d="M 7 15 Q 14 25 21 15 Z" fill="#F1F0FF"/>
            <circle cx="14" cy="11" r="3" fill="#7C3AED"/>
          </svg>
        </div>
        <div style={{textAlign:'left'}}>
          <div style={{fontFamily:D.mono,fontSize:'10px',color:D.purple,letterSpacing:'4px'}}>GEOFICTION LABS</div>
          <div style={{
            fontFamily:D.display,fontWeight:900,fontSize:'28px',
            color:D.text,lineHeight:1,
          }}>
            Map<span style={{color:D.purple,fontSize:'16px',letterSpacing:'4px',margin:'0 4px',fontFamily:D.mono}}>THE</span>
            <span style={{color:D.gold}}>Movie</span>
          </div>
        </div>
      </div>

      <h1 style={{
        fontFamily:D.display,fontWeight:900,
        fontSize:'clamp(48px,7vw,88px)',
        color:D.text,lineHeight:1,
        letterSpacing:'-2px',
        marginBottom:'20px',
        animation:'fadeUp 0.8s ease 0.2s both',
        opacity:0,animationFillMode:'forwards',
      }}>
        GPS-verified customers.<br/>
        <span style={{color:D.gold}}>Through your door.</span>
      </h1>

      <p style={{
        fontSize:'22px',color:D.textMuted,
        maxWidth:'680px',lineHeight:1.6,
        marginBottom:'56px',
        animation:'fadeUp 0.8s ease 0.4s both',
        opacity:0,animationFillMode:'forwards',
      }}>
        The world's first movie trivia treasure hunt — 
        guiding players directly to local businesses in Kent.
      </p>

      <div style={{
        display:'flex', gap:'60px',
        marginBottom:'64px',
        animation:'fadeUp 0.8s ease 0.6s both',
        opacity:0,animationFillMode:'forwards',
      }}>
        {[['6','LIVE LOCATIONS'],['130+','TRIVIA QUESTIONS'],['FREE','FIRST MONTH']].map(([v,l]) => (
          <div key={l} style={{textAlign:'center'}}>
            <div style={{fontFamily:D.display,fontWeight:900,fontSize:'48px',color:D.gold,lineHeight:1}}>{v}</div>
            <div style={{fontFamily:D.mono,fontSize:'10px',color:D.textDim,letterSpacing:'2px',marginTop:'4px'}}>{l}</div>
          </div>
        ))}
      </div>

      <button onClick={onNext} style={{
        background:`linear-gradient(135deg,${D.purple},${D.purpleL})`,
        color:'#FFF',border:'none',
        padding:'20px 56px',borderRadius:'12px',
        fontSize:'18px',fontWeight:700,
        fontFamily:D.body,cursor:'pointer',
        boxShadow:`0 8px 32px rgba(124,58,237,0.4)`,
        animation:'fadeUp 0.8s ease 0.8s both',
        opacity:0,animationFillMode:'forwards',
        letterSpacing:'0.5px',
      }}>
        See How It Works →
      </button>
    </div>
  );
}

function ScreenProblem({ onNext }) {
  const problems = [
    { icon:'📢', title:'Social media ads', body:'You pay per click. Most clicks never visit. No way to measure real foot traffic.' },
    { icon:'📄', title:'Leaflets & flyers', body:'Expensive to print. Ignored immediately. Zero data on who actually came in.' },
    { icon:'🔍', title:'Google Ads', body:'Complicated to set up. Expensive to run. Competes with every other business in town.' },
  ];
  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',justifyContent:'center',padding:'60px 80px'}}>
      <div style={{fontFamily:D.mono,fontSize:'10px',color:D.purple,letterSpacing:'4px',marginBottom:'16px'}}>THE PROBLEM</div>
      <h2 style={{fontFamily:D.display,fontWeight:900,fontSize:'clamp(36px,5vw,64px)',color:D.text,lineHeight:1.1,letterSpacing:'-1px',marginBottom:'16px'}}>
        Getting new customers<br/>is <span style={{color:D.gold}}>harder than ever.</span>
      </h2>
      <p style={{fontSize:'18px',color:D.textMuted,marginBottom:'48px',maxWidth:'600px',lineHeight:1.6}}>
        Every business in Kent is fighting for the same attention. Most marketing sends people to a website — not through your door.
      </p>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'20px',marginBottom:'48px'}}>
        {problems.map((p,i) => (
          <div key={i} style={{
            background:D.card,border:`1px solid ${D.border}`,
            borderRadius:'16px',padding:'28px 24px',
            position:'relative',overflow:'hidden',
          }}>
            <div style={{fontSize:'32px',marginBottom:'12px'}}>{p.icon}</div>
            <div style={{fontWeight:700,fontSize:'17px',color:D.text,marginBottom:'8px'}}>{p.title}</div>
            <div style={{fontSize:'14px',color:D.textMuted,lineHeight:1.6}}>{p.body}</div>
            {/* Strike through */}
            <div style={{
              position:'absolute',top:'50%',left:0,right:0,
              height:'2px',background:'rgba(239,68,68,0.3)',
              transform:'rotate(-2deg)',
            }}/>
          </div>
        ))}
      </div>
      <div style={{
        background:'rgba(124,58,237,0.08)',
        border:`1px solid rgba(124,58,237,0.2)`,
        borderRadius:'12px',padding:'20px 28px',
        display:'flex',alignItems:'center',gap:'16px',
        marginBottom:'40px',
      }}>
        <div style={{fontSize:'24px'}}>💡</div>
        <div style={{fontSize:'17px',color:D.textSub}}>
          <strong style={{color:D.text}}>What if customers were physically guided to your door</strong> — by a game they were already playing?
        </div>
      </div>
      <button onClick={onNext} style={{
        background:`linear-gradient(135deg,${D.purple},${D.purpleL})`,
        color:'#FFF',border:'none',padding:'16px 40px',
        borderRadius:'10px',fontSize:'16px',fontWeight:700,
        cursor:'pointer',alignSelf:'flex-start',fontFamily:D.body,
      }}>That's MapTheMovie →</button>
    </div>
  );
}

function ScreenSolution({ onNext }) {
  const [step, setStep] = useState(0);
  const steps = [
    { num:'01', title:'Player finds a hunt near them', body:'They open MapTheMovie on their phone and see your venue listed as a live hunt location nearby.', accent:D.purple },
    { num:'02', title:'They solve movie trivia clues', body:'Each correct answer reveals a digit of your GPS coordinates. They have to earn their way to you.', accent:D.gold },
    { num:'03', title:'GPS compass guides them to you', body:'Once all clues are solved, a compass activates pointing directly to your venue. They walk to you.', accent:D.green },
    { num:'04', title:'They arrive and claim their reward', body:'Your unique reward unlocks when they physically arrive. Staff confirm on a simple screen. Done.', accent:D.purpleL },
  ];
  useEffect(() => {
    const t = setInterval(() => setStep(s => (s+1)%4), 3000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{height:'100%',display:'flex',gap:'60px',padding:'60px 80px',alignItems:'center'}}>
      <div style={{flex:1}}>
        <div style={{fontFamily:D.mono,fontSize:'10px',color:D.green,letterSpacing:'4px',marginBottom:'16px'}}>THE SOLUTION</div>
        <h2 style={{fontFamily:D.display,fontWeight:900,fontSize:'clamp(32px,4vw,56px)',color:D.text,lineHeight:1.1,letterSpacing:'-1px',marginBottom:'20px'}}>
          MapTheMovie sends players <span style={{color:D.gold}}>directly to you.</span>
        </h2>
        <p style={{fontSize:'16px',color:D.textMuted,lineHeight:1.7,marginBottom:'36px'}}>
          Players are physically navigated to your venue by solving movie trivia. They don't just see your name online — they walk through your door.
        </p>
        <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
          {steps.map((s,i) => (
            <div key={i} onClick={() => setStep(i)} style={{
              background: step === i ? D.card : 'transparent',
              border:`1px solid ${step===i ? s.accent : D.border}`,
              borderRadius:'12px',padding:'16px 20px',
              cursor:'pointer',transition:'all .3s',
              display:'flex',gap:'16px',alignItems:'flex-start',
            }}>
              <div style={{
                fontFamily:D.mono,fontSize:'11px',
                color:step===i ? s.accent : D.textDim,
                flexShrink:0,paddingTop:'2px',
                fontWeight:700,
              }}>{s.num}</div>
              <div>
                <div style={{fontWeight:600,fontSize:'15px',color:step===i?D.text:D.textMuted,marginBottom:'2px'}}>{s.title}</div>
                {step===i && <div style={{fontSize:'13px',color:D.textMuted,lineHeight:1.5}}>{s.body}</div>}
              </div>
            </div>
          ))}
        </div>
        <button onClick={onNext} style={{
          marginTop:'28px',
          background:`linear-gradient(135deg,${D.purple},${D.purpleL})`,
          color:'#FFF',border:'none',padding:'14px 32px',
          borderRadius:'10px',fontSize:'15px',fontWeight:700,
          cursor:'pointer',fontFamily:D.body,
        }}>See the live compass →</button>
      </div>
      {/* Compass visual */}
      <div style={{
        display:'flex',flexDirection:'column',
        alignItems:'center',gap:'24px',flexShrink:0,
      }}>
        <LiveCompass />
        <div style={{textAlign:'center'}}>
          <div style={{fontFamily:D.mono,fontSize:'10px',color:D.textDim,letterSpacing:'2px'}}>GPS ACTIVE</div>
          <div style={{fontFamily:D.display,fontWeight:900,fontSize:'32px',color:D.text}}>0.3 KM</div>
          <div style={{fontFamily:D.mono,fontSize:'11px',color:D.green,letterSpacing:'1px'}}>HEAD SOUTH EAST</div>
        </div>
        <div style={{
          background:'rgba(16,185,129,0.08)',
          border:'1px solid rgba(16,185,129,0.2)',
          borderRadius:'8px',padding:'8px 16px',
          fontFamily:D.mono,fontSize:'10px',
          color:D.green,letterSpacing:'2px',
        }}>DESTINATION: YOUR VENUE</div>
      </div>
    </div>
  );
}

function ScreenHowItWorks({ onNext }) {
  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',justifyContent:'center',padding:'60px 80px'}}>
      <div style={{fontFamily:D.mono,fontSize:'10px',color:D.purple,letterSpacing:'4px',marginBottom:'16px'}}>HOW IT WORKS FOR YOU</div>
      <h2 style={{fontFamily:D.display,fontWeight:900,fontSize:'clamp(32px,4vw,52px)',color:D.text,lineHeight:1.1,letterSpacing:'-1px',marginBottom:'40px'}}>
        Up and running in <span style={{color:D.gold}}>20 minutes.</span>
      </h2>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'16px',marginBottom:'40px'}}>
        {[
          { step:'1', title:'Sign up online', body:'Create your business account and choose your reward. Takes 5 minutes.', accent:D.purple },
          { step:'2', title:'Go Live', body:'Tap Go Live in your dashboard. Your GPS location is captured automatically.', accent:D.gold },
          { step:'3', title:'Players hunt', body:'MapTheMovie players near you see your venue and start hunting.', accent:D.green },
          { step:'4', title:'They arrive', body:'Staff confirm arrival on a simple screen. Redemption logged automatically.', accent:D.purpleL },
        ].map((s,i) => (
          <div key={i} style={{
            background:D.card,
            border:`1px solid ${D.border}`,
            borderRadius:'16px',padding:'24px 20px',
            position:'relative',overflow:'hidden',
          }}>
            <div style={{
              position:'absolute',top:0,left:0,right:0,height:'3px',
              background:`linear-gradient(90deg,${s.accent},transparent)`,
            }}/>
            <div style={{
              fontFamily:D.display,fontWeight:900,
              fontSize:'48px',color:s.accent,
              opacity:0.2,position:'absolute',
              top:'12px',right:'16px',lineHeight:1,
            }}>{s.step}</div>
            <div style={{
              fontFamily:D.mono,fontSize:'11px',
              color:s.accent,letterSpacing:'2px',
              marginBottom:'10px',
            }}>STEP {s.step}</div>
            <div style={{fontWeight:700,fontSize:'16px',color:D.text,marginBottom:'8px'}}>{s.title}</div>
            <div style={{fontSize:'13px',color:D.textMuted,lineHeight:1.6}}>{s.body}</div>
          </div>
        ))}
      </div>
      <div style={{
        display:'flex',gap:'20px',marginBottom:'40px',flexWrap:'wrap',
      }}>
        {[
          'No app for your staff to download',
          'No special equipment needed',
          'Works on any phone',
          'You set the reward — we handle the rest',
          'Cancel anytime',
        ].map((t,i) => (
          <div key={i} style={{
            display:'flex',alignItems:'center',gap:'8px',
            background:'rgba(16,185,129,0.08)',
            border:'1px solid rgba(16,185,129,0.2)',
            borderRadius:'20px',padding:'6px 14px',
          }}>
            <div style={{width:'6px',height:'6px',borderRadius:'50%',background:D.green,flexShrink:0}}/>
            <span style={{fontSize:'13px',color:D.textSub}}>{t}</span>
          </div>
        ))}
      </div>
      <button onClick={onNext} style={{
        background:`linear-gradient(135deg,${D.purple},${D.purpleL})`,
        color:'#FFF',border:'none',padding:'14px 32px',
        borderRadius:'10px',fontSize:'15px',fontWeight:700,
        cursor:'pointer',alignSelf:'flex-start',fontFamily:D.body,
      }}>See the numbers →</button>
    </div>
  );
}

function ScreenStats({ onNext, stats }) {
  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',justifyContent:'center',padding:'60px 80px'}}>
      <div style={{fontFamily:D.mono,fontSize:'10px',color:D.purple,letterSpacing:'4px',marginBottom:'16px'}}>LIVE PLATFORM DATA</div>
      <h2 style={{fontFamily:D.display,fontWeight:900,fontSize:'clamp(32px,4vw,52px)',color:D.text,lineHeight:1.1,letterSpacing:'-1px',marginBottom:'40px'}}>
        Real numbers.<br/><span style={{color:D.gold}}>Real results.</span>
      </h2>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'20px',marginBottom:'32px'}}>
        {[
          { label:'ACTIVE HUNT LOCATIONS', value: stats.hunts || 6, accent:D.purple, suffix:'' },
          { label:'TRIVIA QUESTIONS IN POOL', value: stats.trivia || 130, accent:D.gold, suffix:'+' },
          { label:'TOTAL REDEMPTIONS', value: stats.redemptions || 1, accent:D.green, suffix:'' },
          { label:'BUSINESSES ON PLATFORM', value: stats.businesses || 8, accent:D.purpleL, suffix:'' },
          { label:'HUNT SESSIONS STARTED', value: stats.sessions || 6, accent:D.purple, suffix:'' },
          { label:'GEOFENCE RADIUS', value:15, accent:D.gold, suffix:'m' },
        ].map((s,i) => (
          <div key={i} style={{
            background:D.card,border:`1px solid ${D.border}`,
            borderRadius:'16px',padding:'28px 24px',
            position:'relative',overflow:'hidden',
          }}>
            <div style={{position:'absolute',top:0,left:0,right:0,height:'2px',background:`linear-gradient(90deg,transparent,${s.accent},transparent)`}}/>
            <div style={{fontFamily:D.mono,fontSize:'9px',color:D.textDim,letterSpacing:'2px',marginBottom:'10px'}}>{s.label}</div>
            <div style={{fontFamily:D.display,fontWeight:900,fontSize:'48px',color:s.accent,lineHeight:1}}>
              <Counter to={s.value} suffix={s.suffix} duration={1500}/>
            </div>
          </div>
        ))}
      </div>
      <div style={{
        background:'rgba(124,58,237,0.06)',
        border:`1px solid rgba(124,58,237,0.15)`,
        borderRadius:'12px',padding:'20px 28px',
        display:'flex',alignItems:'center',
        justifyContent:'space-between',
        marginBottom:'36px',
      }}>
        <div style={{fontFamily:D.mono,fontSize:'11px',color:D.textDim,letterSpacing:'2px'}}>PLATFORM STATUS</div>
        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
          <div style={{width:'8px',height:'8px',borderRadius:'50%',background:D.green,boxShadow:`0 0 8px ${D.green}`}}/>
          <span style={{fontFamily:D.mono,fontSize:'11px',color:D.green,letterSpacing:'2px'}}>LIVE IN KENT</span>
        </div>
        <div style={{fontFamily:D.mono,fontSize:'11px',color:D.textDim,letterSpacing:'1px'}}>EXPANDING 2026</div>
      </div>
      <button onClick={onNext} style={{
        background:`linear-gradient(135deg,${D.purple},${D.purpleL})`,
        color:'#FFF',border:'none',padding:'14px 32px',
        borderRadius:'10px',fontSize:'15px',fontWeight:700,
        cursor:'pointer',alignSelf:'flex-start',fontFamily:D.body,
      }}>See the dashboard →</button>
    </div>
  );
}

function ScreenDashboard({ onNext }) {
  return (
    <div style={{height:'100%',display:'flex',gap:'48px',padding:'60px 80px',alignItems:'center'}}>
      <div style={{flex:'0 0 340px'}}>
        <div style={{fontFamily:D.mono,fontSize:'10px',color:D.purple,letterSpacing:'4px',marginBottom:'16px'}}>YOUR DASHBOARD</div>
        <h2 style={{fontFamily:D.display,fontWeight:900,fontSize:'clamp(28px,3.5vw,44px)',color:D.text,lineHeight:1.1,letterSpacing:'-1px',marginBottom:'16px'}}>
          Everything you need.<br/><span style={{color:D.gold}}>Nothing you don't.</span>
        </h2>
        <p style={{fontSize:'15px',color:D.textMuted,lineHeight:1.7,marginBottom:'24px'}}>
          Your business dashboard shows you exactly how many players are hunting for you right now, how many have visited, and every redemption logged automatically.
        </p>
        <div style={{display:'flex',flexDirection:'column',gap:'10px',marginBottom:'28px'}}>
          {[
            'Live player count — updated in real time',
            'Go Live with one tap — we capture your GPS',
            'Every redemption logged automatically',
            'Monthly visit reports',
            'Staff redemption page — no phone handover',
          ].map((f,i) => (
            <div key={i} style={{display:'flex',alignItems:'center',gap:'10px'}}>
              <div style={{width:'5px',height:'5px',borderRadius:'50%',background:D.purple,flexShrink:0}}/>
              <span style={{fontSize:'14px',color:D.textSub}}>{f}</span>
            </div>
          ))}
        </div>
        <button onClick={onNext} style={{
          background:`linear-gradient(135deg,${D.purple},${D.purpleL})`,
          color:'#FFF',border:'none',padding:'14px 32px',
          borderRadius:'10px',fontSize:'15px',fontWeight:700,
          cursor:'pointer',fontFamily:D.body,
        }}>See pricing →</button>
      </div>

      {/* Dashboard mockup */}
      <div style={{flex:1,background:D.card,border:`1px solid ${D.border}`,borderRadius:'16px',padding:'24px',overflow:'hidden'}}>
        {/* Mini header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px',paddingBottom:'16px',borderBottom:`1px solid ${D.border}`}}>
          <div style={{fontFamily:D.display,fontWeight:900,fontSize:'16px',color:D.text}}>
            Map<span style={{color:D.purple,fontSize:'10px',letterSpacing:'3px',margin:'0 2px',fontFamily:D.mono}}>THE</span>
            <span style={{color:D.gold}}>Movie</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
            <div style={{width:'6px',height:'6px',borderRadius:'50%',background:D.green}}/>
            <span style={{fontFamily:D.mono,fontSize:'9px',color:D.green,letterSpacing:'1px'}}>YOUR VENUE IS LIVE</span>
          </div>
        </div>
        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'10px',marginBottom:'16px'}}>
          {[['3','LIVE NOW',D.green],['12','TODAY',D.purple],['47','ALL TIME',D.gold],['Pub/Bar','CATEGORY',D.textMuted]].map(([v,l,c],i)=>(
            <div key={i} style={{background:D.cardAlt,borderRadius:'10px',padding:'14px 12px'}}>
              <div style={{fontFamily:D.mono,fontSize:'8px',color:D.textDim,letterSpacing:'1px',marginBottom:'6px'}}>{l}</div>
              <div style={{fontFamily:D.display,fontWeight:900,fontSize:'22px',color:c,lineHeight:1}}>{v}</div>
            </div>
          ))}
        </div>
        {/* Live button */}
        <div style={{
          background:'rgba(16,185,129,0.08)',
          border:'1px solid rgba(16,185,129,0.3)',
          borderRadius:'12px',padding:'14px 18px',
          display:'flex',justifyContent:'space-between',alignItems:'center',
          marginBottom:'14px',
        }}>
          <div>
            <div style={{fontFamily:D.mono,fontSize:'9px',color:D.green,letterSpacing:'2px',marginBottom:'2px'}}>STATUS</div>
            <div style={{fontSize:'14px',color:D.text,fontWeight:600}}>You are Live — players are being guided to you</div>
          </div>
          <button style={{background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.3)',color:'#EF4444',borderRadius:'6px',padding:'6px 14px',fontSize:'10px',fontFamily:D.mono,letterSpacing:'1px',cursor:'pointer'}}>END SESSION</button>
        </div>
        {/* Redemption log */}
        <div style={{fontFamily:D.mono,fontSize:'8px',color:D.textDim,letterSpacing:'2px',marginBottom:'8px'}}>RECENT REDEMPTIONS</div>
        {[['MTM-7391','14:32 today','The Medway Cipher'],['MTM-4829','11:15 today','The Medway Cipher'],['MTM-2847','Yesterday 16:40','The Medway Cipher']].map(([code,time,hunt],i)=>(
          <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:`1px solid ${D.border}`}}>
            <span style={{fontFamily:D.mono,fontSize:'12px',color:D.gold}}>{code}</span>
            <span style={{fontSize:'11px',color:D.textMuted}}>{hunt}</span>
            <span style={{fontFamily:D.mono,fontSize:'10px',color:D.textDim}}>{time}</span>
            <span style={{background:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.3)',color:D.green,borderRadius:'10px',padding:'2px 8px',fontSize:'9px',fontFamily:D.mono}}>REDEEMED</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenPricing({ onNext }) {
  const tiers = [
    {
      name:'Starter', price:49,
      color:D.textSub, badge:'MOST POPULAR',
      features:[
        'One active hunt location',
        'Standard hunt listing',
        'Up to 100 redemptions/month',
        'Business dashboard access',
        'Staff redemption page',
        'Monthly report',
        '1 month free to start',
      ],
      cta:'Start Free Month',
    },
    {
      name:'Featured', price:99,
      color:D.purple, badge:'RECOMMENDED',
      features:[
        'One active hunt location',
        'Featured placement in app',
        'Priority in hunt discovery',
        'Up to 300 redemptions/month',
        'Business dashboard access',
        'Staff redemption page',
        'Featured badge on listing',
        '1 month free to start',
      ],
      cta:'Start Free Month',
    },
    {
      name:'Sponsored', price:249,
      color:D.gold, badge:'MAXIMUM EXPOSURE',
      features:[
        'Exclusive hunt pack',
        'Your branding throughout',
        'Unlimited redemptions',
        'Top placement always',
        'Dedicated hunt theme',
        'Monthly analytics call',
        'Seasonal pack included',
        '1 month free to start',
      ],
      cta:'Talk To Us',
    },
  ];
  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',justifyContent:'center',padding:'60px 80px'}}>
      <div style={{fontFamily:D.mono,fontSize:'10px',color:D.purple,letterSpacing:'4px',marginBottom:'16px'}}>PRICING</div>
      <h2 style={{fontFamily:D.display,fontWeight:900,fontSize:'clamp(32px,4vw,52px)',color:D.text,lineHeight:1.1,letterSpacing:'-1px',marginBottom:'8px'}}>
        Simple pricing.<br/><span style={{color:D.gold}}>First month free.</span>
      </h2>
      <p style={{fontSize:'16px',color:D.textMuted,marginBottom:'36px'}}>No setup fees. No contracts. Cancel anytime.</p>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'16px',marginBottom:'32px'}}>
        {tiers.map((t,i) => (
          <div key={i} style={{
            background: i===1 ? `linear-gradient(135deg,#0E0E1E,#120D20)` : D.card,
            border:`${i===1?2:1}px solid ${i===1?D.purple:D.border}`,
            borderRadius:'16px',padding:'28px 24px',
            position:'relative',
            boxShadow:i===1?`0 0 40px rgba(124,58,237,0.15)`:'none',
          }}>
            {i===1 && <div style={{position:'absolute',top:0,left:0,right:0,height:'2px',background:`linear-gradient(90deg,transparent,${D.purple},transparent)`}}/>}
            <div style={{fontFamily:D.mono,fontSize:'9px',color:t.color,letterSpacing:'2px',marginBottom:'8px'}}>{t.badge}</div>
            <div style={{fontFamily:D.display,fontWeight:900,fontSize:'24px',color:D.text,marginBottom:'4px'}}>{t.name}</div>
            <div style={{marginBottom:'20px'}}>
              <span style={{fontFamily:D.display,fontWeight:900,fontSize:'40px',color:t.color}}>£{t.price}</span>
              <span style={{fontFamily:D.mono,fontSize:'11px',color:D.textDim,letterSpacing:'1px'}}>/month</span>
            </div>
            <div style={{
              background:'rgba(16,185,129,0.08)',
              border:'1px solid rgba(16,185,129,0.2)',
              borderRadius:'6px',padding:'6px 10px',
              fontFamily:D.mono,fontSize:'9px',color:D.green,
              letterSpacing:'1px',marginBottom:'16px',
              textAlign:'center',
            }}>FIRST MONTH FREE</div>
            <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
              {t.features.map((f,j) => (
                <div key={j} style={{display:'flex',gap:'8px',alignItems:'flex-start'}}>
                  <div style={{width:'5px',height:'5px',borderRadius:'50%',background:t.color,flexShrink:0,marginTop:'5px'}}/>
                  <span style={{fontSize:'12px',color:D.textSub,lineHeight:1.4}}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button onClick={onNext} style={{
        background:`linear-gradient(135deg,${D.purple},${D.purpleL})`,
        color:'#FFF',border:'none',padding:'14px 32px',
        borderRadius:'10px',fontSize:'15px',fontWeight:700,
        cursor:'pointer',alignSelf:'flex-start',fontFamily:D.body,
      }}>Any questions? →</button>
    </div>
  );
}

function ScreenObjections({ onNext }) {
  const qa = [
    { q:'What if not many people use the app yet?', a:'You are one of our founding businesses. Early partners get the best rates, first-mover advantage, and we are actively growing the player base in Kent right now. More players join every week.' },
    { q:'What does the reward have to be?', a:"Anything you choose — a free drink, 10% off, a loyalty stamp, a free item. You set the reward. We do not dictate what it is. Even a small reward works — players are motivated by the hunt itself." },
    { q:'How do staff know when someone arrives?', a:'Players show a unique code on their screen. Staff type it into a simple page bookmarked on any phone or tablet. Takes 5 seconds. No app to download, no training needed.' },
    { q:"What if I want to stop?", a:"Cancel any time from your dashboard. No contract, no penalty, no questions asked. We'd rather earn your business every month." },
    { q:'Is my location secure?', a:'Your GPS coordinates are never shown to players until they have solved all the clues. The destination is a mystery until they physically arrive. That is the core mechanic — and it protects your location.' },
  ];
  const [open, setOpen] = useState(null);
  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',justifyContent:'center',padding:'60px 80px'}}>
      <div style={{fontFamily:D.mono,fontSize:'10px',color:D.purple,letterSpacing:'4px',marginBottom:'16px'}}>COMMON QUESTIONS</div>
      <h2 style={{fontFamily:D.display,fontWeight:900,fontSize:'clamp(28px,3.5vw,48px)',color:D.text,lineHeight:1.1,letterSpacing:'-1px',marginBottom:'36px'}}>
        Questions answered.<br/><span style={{color:D.gold}}>Honestly.</span>
      </h2>
      <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'36px'}}>
        {qa.map((item,i) => (
          <div key={i} style={{
            background:D.card,
            border:`1px solid ${open===i?D.purple:D.border}`,
            borderRadius:'12px',overflow:'hidden',
            transition:'border-color .2s',
          }}>
            <button onClick={() => setOpen(open===i?null:i)} style={{
              width:'100%',display:'flex',justifyContent:'space-between',
              alignItems:'center',padding:'16px 20px',
              background:'transparent',border:'none',
              color:D.text,fontSize:'15px',fontWeight:600,
              cursor:'pointer',fontFamily:D.body,textAlign:'left',
            }}>
              <span>{item.q}</span>
              <span style={{color:D.purple,fontSize:'20px',flexShrink:0,marginLeft:'16px'}}>{open===i?'−':'+'}</span>
            </button>
            {open===i && (
              <div style={{padding:'0 20px 16px',fontSize:'14px',color:D.textMuted,lineHeight:1.7}}>
                {item.a}
              </div>
            )}
          </div>
        ))}
      </div>
      <button onClick={onNext} style={{
        background:`linear-gradient(135deg,${D.green},#059669)`,
        color:'#FFF',border:'none',padding:'16px 40px',
        borderRadius:'10px',fontSize:'16px',fontWeight:700,
        cursor:'pointer',alignSelf:'flex-start',fontFamily:D.body,
        boxShadow:`0 8px 24px rgba(16,185,129,0.3)`,
      }}>Ready to get started →</button>
    </div>
  );
}

function ScreenClose({ }) {
  return (
    <div style={{
      height:'100%',display:'flex',flexDirection:'column',
      alignItems:'center',justifyContent:'center',
      textAlign:'center',padding:'60px 80px',
      background:`radial-gradient(ellipse at center, #0A1A0A 0%, ${D.bg} 70%)`,
    }}>
      <div style={{
        width:'80px',height:'80px',
        background:'rgba(16,185,129,0.12)',
        border:`2px solid ${D.green}`,
        borderRadius:'50%',
        display:'flex',alignItems:'center',justifyContent:'center',
        marginBottom:'32px',
        boxShadow:`0 0 40px rgba(16,185,129,0.3)`,
      }}>
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <path d="M 7 18 L 14 25 L 29 10" stroke="#10B981" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      <div style={{fontFamily:D.mono,fontSize:'10px',color:D.green,letterSpacing:'4px',marginBottom:'16px'}}>LET'S DO THIS</div>
      <h2 style={{fontFamily:D.display,fontWeight:900,fontSize:'clamp(36px,5vw,64px)',color:D.text,lineHeight:1.1,letterSpacing:'-1px',marginBottom:'16px'}}>
        Start your <span style={{color:D.gold}}>free month</span><br/>today.
      </h2>
      <p style={{fontSize:'18px',color:D.textMuted,maxWidth:'560px',lineHeight:1.6,marginBottom:'48px'}}>
        No payment needed to start. No contract. Your venue could be live and receiving players within 20 minutes.
      </p>

      <div style={{display:'flex',gap:'16px',marginBottom:'48px',flexWrap:'wrap',justifyContent:'center'}}>
        <a href="https://app.mapthemovie.co.uk/dashboard" target="_blank" rel="noreferrer" style={{
          background:`linear-gradient(135deg,${D.green},#059669)`,
          color:'#FFF',border:'none',
          padding:'20px 48px',borderRadius:'12px',
          fontSize:'18px',fontWeight:700,
          cursor:'pointer',fontFamily:D.body,
          textDecoration:'none',display:'inline-block',
          boxShadow:`0 8px 32px rgba(16,185,129,0.4)`,
        }}>Get Started Free →</a>
        <a href="mailto:hello@geofictionlabs.com" style={{
          background:'transparent',
          color:D.textMuted,
          border:`1px solid ${D.border}`,
          padding:'20px 32px',borderRadius:'12px',
          fontSize:'16px',fontWeight:500,
          cursor:'pointer',fontFamily:D.body,
          textDecoration:'none',display:'inline-block',
        }}>Talk to us first</a>
      </div>

      <div style={{display:'flex',gap:'32px',justifyContent:'center',flexWrap:'wrap'}}>
        {['First month free','No contract','Cancel anytime','Live in 20 minutes'].map((t,i) => (
          <div key={i} style={{display:'flex',alignItems:'center',gap:'6px'}}>
            <div style={{width:'5px',height:'5px',borderRadius:'50%',background:D.green}}/>
            <span style={{fontFamily:D.mono,fontSize:'10px',color:D.textDim,letterSpacing:'1px'}}>{t.toUpperCase()}</span>
          </div>
        ))}
      </div>

      <div style={{marginTop:'48px',fontFamily:D.mono,fontSize:'10px',color:D.textDim,letterSpacing:'2px'}}>
        GEOFICTION LABS LIMITED · REGISTERED IN ENGLAND AND WALES · HELLO@GEOFICTIONLABS.COM
      </div>
    </div>
  );
}

// ── MAIN SALES DECK ───────────────────────────────────────
export default function SalesDeck() {
  const [screen, setScreen]   = useState(0);
  const [stats, setStats]     = useState({ hunts:6, trivia:130, businesses:8, redemptions:1, sessions:6 });

  useEffect(() => {
    Promise.all([
      supabase.from('businesses').select('id',{count:'exact',head:true}),
      supabase.from('campaigns').select('id',{count:'exact',head:true}),
      supabase.from('trivia_pool').select('id',{count:'exact',head:true}),
    ]).then(([biz,camp,trivia]) => {
      setStats(s => ({
        ...s,
        businesses: biz.count || s.businesses,
        hunts: camp.count || s.hunts,
        trivia: trivia.count || s.trivia,
      }));
    });
  }, []);

  const next = () => setScreen(s => Math.min(s+1, SCREENS.length-1));
  const prev = () => setScreen(s => Math.max(s-1, 0));

  const screenNames = ['Hook','Problem','Solution','How It Works','Stats','Dashboard','Pricing','Q&A','Close'];

  return (
    <div style={{
      background:D.bg,
      width:'100vw',height:'100vh',
      fontFamily:D.body,color:D.text,
      overflow:'hidden',
      display:'flex',flexDirection:'column',
    }}>
      {/* Progress bar */}
      <div style={{
        position:'fixed',top:0,left:0,right:0,height:'3px',
        background:D.border,zIndex:100,
      }}>
        <div style={{
          height:'100%',
          width:`${((screen+1)/SCREENS.length)*100}%`,
          background:`linear-gradient(90deg,${D.purple},${D.gold})`,
          transition:'width .4s ease',
        }}/>
      </div>

      {/* Screen content */}
      <div style={{flex:1,overflow:'hidden'}}>
        {screen===0 && <ScreenHook onNext={next}/>}
        {screen===1 && <ScreenProblem onNext={next}/>}
        {screen===2 && <ScreenSolution onNext={next}/>}
        {screen===3 && <ScreenHowItWorks onNext={next}/>}
        {screen===4 && <ScreenStats onNext={next} stats={stats}/>}
        {screen===5 && <ScreenDashboard onNext={next}/>}
        {screen===6 && <ScreenPricing onNext={next}/>}
        {screen===7 && <ScreenObjections onNext={next}/>}
        {screen===8 && <ScreenClose/>}
      </div>

      {/* Navigation */}
      <div style={{
        position:'fixed',bottom:0,left:0,right:0,
        background:'rgba(6,6,14,0.95)',
        borderTop:`1px solid ${D.border}`,
        padding:'12px 32px',
        display:'flex',alignItems:'center',
        justifyContent:'space-between',
        backdropFilter:'blur(20px)',
        zIndex:100,
      }}>
        <button
          onClick={prev} disabled={screen===0}
          style={{
            background:'transparent',
            border:`1px solid ${screen===0?D.border:D.purple}`,
            color:screen===0?D.textDim:D.purple,
            padding:'8px 20px',borderRadius:'8px',
            fontSize:'13px',fontFamily:D.mono,
            letterSpacing:'2px',cursor:screen===0?'not-allowed':'pointer',
          }}
        >← PREV</button>

        {/* Dot navigation */}
        <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
          {SCREENS.map((_,i) => (
            <button key={i} onClick={() => setScreen(i)} style={{
              width:i===screen?'24px':'8px',
              height:'8px',
              borderRadius:'4px',
              background:i===screen?D.purple:D.border,
              border:'none',cursor:'pointer',
              transition:'all .3s',padding:0,
            }}/>
          ))}
        </div>

        <div style={{display:'flex',alignItems:'center',gap:'16px'}}>
          <span style={{fontFamily:D.mono,fontSize:'10px',color:D.textDim,letterSpacing:'1px'}}>
            {screenNames[screen]} · {screen+1}/{SCREENS.length}
          </span>
          {screen < SCREENS.length-1 && (
            <button onClick={next} style={{
              background:`linear-gradient(135deg,${D.purple},${D.purpleL})`,
              color:'#FFF',border:'none',
              padding:'8px 20px',borderRadius:'8px',
              fontSize:'13px',fontFamily:D.mono,
              letterSpacing:'2px',cursor:'pointer',
            }}>NEXT →</button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
    </div>
  );
}
