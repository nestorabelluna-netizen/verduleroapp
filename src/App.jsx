import { useState, useEffect, useCallback, useMemo } from "react";

// ─── STORAGE + SINCRONIZACIÓN EN NUBE ────────────────────────────────────────
const CLOUD_URL = "https://api.jsonbin.io/v3/b";

const db = {
  // Local (rápido)
  get(key)     { try{ const v=localStorage.getItem(key); return v?JSON.parse(v):null; }catch{return null;} },
  set(key,val) { try{ localStorage.setItem(key,JSON.stringify(val)); }catch{} },

  // Config de sincronización
  getCfg() { return db.get("syncCfg")||{binId:"",apiKey:""}; },

  // Subir un dato a la nube (en background, sin bloquear)
  async push(key, val) {
    const {binId,apiKey}=db.getCfg();
    if(!binId||!apiKey) return;
    try {
      const r  = await fetch(`${CLOUD_URL}/${binId}/latest`,{headers:{"X-Master-Key":apiKey,"X-Bin-Meta":"false"}});
      const cur = r.ok ? await r.json() : {};
      cur[key] = val;
      await fetch(`${CLOUD_URL}/${binId}`,{method:"PUT",
        headers:{"Content-Type":"application/json","X-Master-Key":apiKey},
        body:JSON.stringify(cur)});
    } catch(e){ console.warn("Sync push error:",e); }
  },

  // Bajar TODOS los datos de la nube y guardarlos en localStorage
  async pull() {
    const {binId,apiKey}=db.getCfg();
    if(!binId||!apiKey) return false;
    try {
      const r = await fetch(`${CLOUD_URL}/${binId}/latest`,{headers:{"X-Master-Key":apiKey,"X-Bin-Meta":"false"}});
      if(!r.ok) return false;
      const data = await r.json();
      // Guardar todo en localStorage
      Object.entries(data).forEach(([k,v])=>db.set(k,v));
      return true;
    } catch(e){ console.warn("Sync pull error:",e); return false; }
  },

  // Crear el bin inicial en JSONBin
  async initBin(apiKey) {
    try {
      const r = await fetch(`${CLOUD_URL}`,{method:"POST",
        headers:{"Content-Type":"application/json","X-Master-Key":apiKey,"X-Bin-Name":"VerduleroApp"},
        body:JSON.stringify({_init:true})});
      if(!r.ok) return null;
      const d = await r.json();
      return d.metadata?.id || null;
    } catch{ return null; }
  }
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
// Fecha local (no UTC) para evitar desfasaje horario en Argentina
const todayStr = () => {
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const fmtARS  = n => "$"+Math.round(n||0).toLocaleString("es-AR");
const fmtPct  = n => (n||0).toFixed(1)+"%";
const fmtDate = s => { const [y,m,d]=s.split("-"); return `${d}/${m}/${y}`; };

const DEFAULT_PRODUCTS = [
  {id:"1", name:"Tomate",    unit:"kg",   cost:800,  price:1400,stock:20},
  {id:"2", name:"Papa",      unit:"kg",   cost:450,  price:900, stock:50},
  {id:"3", name:"Cebolla",   unit:"kg",   cost:400,  price:800, stock:40},
  {id:"4", name:"Zanahoria", unit:"kg",   cost:350,  price:700, stock:30},
  {id:"5", name:"Lechuga",   unit:"unid", cost:600,  price:1200,stock:15},
  {id:"6", name:"Zapallo",   unit:"kg",   cost:300,  price:650, stock:25},
  {id:"7", name:"Berenjena", unit:"unid", cost:500,  price:1000,stock:12},
  {id:"8", name:"Manzana",   unit:"kg",   cost:900,  price:1600,stock:20},
  {id:"9", name:"Banana",    unit:"kg",   cost:700,  price:1300,stock:18},
  {id:"10",name:"Naranja",   unit:"kg",   cost:600,  price:1100,stock:22},
  {id:"11",name:"Limón",     unit:"kg",   cost:550,  price:1050,stock:15},
  {id:"12",name:"Pimiento",  unit:"unid", cost:400,  price:800, stock:20},
];

const ADMIN_PIN = "2024";
const OP_PIN    = "1234";
const getSettings = () => db.get("settings") || {opPin:OP_PIN, adminPin:ADMIN_PIN, waPhone:""};

// ─── ICON ─────────────────────────────────────────────────────────────────────
const Ico = ({d,size=20}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d)?d.map((p,i)=><path key={i} d={p}/>):<path d={d}/>}
  </svg>
);
const I = {
  home:   "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z",
  cart:   ["M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z","M3 6h18","M16 10a4 4 0 01-8 0"],
  cash:   ["M12 1v22","M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"],
  alert:  ["M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z","M12 9v4","M12 17h.01"],
  tag:    ["M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z","M7 7h.01"],
  chart:  ["M18 20V10","M12 20V4","M6 20v-6"],
  cal:    ["M8 2v4","M16 2v4","M3 10h18","M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"],
  pkg:    ["M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z","M3.27 6.96L12 12.01l8.73-5.05","M12 22.08V12"],
  plus:   ["M12 5v14","M5 12h14"],
  trash:  ["M3 6h18","M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"],
  check:  "M20 6L9 17l-5-5",
  logout: ["M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4","M16 17l5-5-5-5","M21 12H9"],
  edit:   ["M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7","M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"],
  sync:   ["M1 4v6h6","M23 20v-6h-6","M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15"],
  wa:     "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z",
};

// CSS movido a src/index.css — importado desde main.jsx
const CSS_REMOVED = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'DM Sans',sans-serif;background:#0a1a0d;color:#e4ede5;min-height:100vh;}
.app{max-width:430px;margin:0 auto;min-height:100vh;background:#0a1a0d;position:relative;}
.content{padding:16px 16px 96px;}
/* ══ LOGIN REDISEÑADO — ALTO CONTRASTE ══════════════════════════════════════ */
.login-root{min-height:100vh;display:flex;flex-direction:column;background:#060e07;overflow:hidden;position:relative;}

/* Hero compacto */
.login-hero{position:relative;height:36vh;min-height:190px;flex:none;overflow:hidden;}
.login-hero-bg{position:absolute;inset:0;background:linear-gradient(160deg,#0c2010 0%,#071a0b 60%,#060e07 100%);}
.login-hero-pattern{position:absolute;inset:0;opacity:.05;background-image:repeating-linear-gradient(45deg,#9ef09a 0,#9ef09a 1px,transparent 0,transparent 50%);background-size:16px 16px;}
.login-hero-glow{position:absolute;top:-30px;left:50%;transform:translateX(-50%);width:220px;height:220px;background:radial-gradient(circle,rgba(158,240,154,.15) 0%,transparent 65%);pointer-events:none;}
.login-hero-content{position:relative;z-index:2;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;}
.login-brand-ring{width:72px;height:72px;border-radius:22px;background:linear-gradient(135deg,#1e5c24,#0e2c12);border:2px solid rgba(158,240,154,.45);display:flex;align-items:center;justify-content:center;font-size:34px;box-shadow:0 6px 24px rgba(0,0,0,.6),0 0 0 4px rgba(158,240,154,.08);animation:ringIn .5s cubic-bezier(.34,1.56,.64,1);}
@keyframes ringIn{from{transform:scale(.4) rotate(-15deg);opacity:0}to{transform:scale(1) rotate(0);opacity:1}}
.login-brand-name{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:#fff;margin-top:12px;letter-spacing:-.3px;}
.login-brand-name span{color:#9ef09a;}
.login-brand-tag{font-size:10px;color:rgba(158,240,154,.55);margin-top:3px;letter-spacing:2px;text-transform:uppercase;}
.login-hero-dots{position:absolute;bottom:0;left:0;right:0;height:50px;background:linear-gradient(to bottom,transparent,#060e07);}

/* Sheet */
.login-sheet{flex:1;background:#060e07;padding:20px 18px 28px;display:flex;flex-direction:column;align-items:center;overflow-y:auto;}

/* Instrucción tap */
.login-tap-hint{display:flex;align-items:center;gap:8px;margin-bottom:14px;}
.login-tap-hint-line{flex:1;height:1px;background:rgba(158,240,154,.12);}
.login-tap-hint-text{font-size:11px;font-weight:700;color:rgba(158,240,154,.6);text-transform:uppercase;letter-spacing:1.5px;white-space:nowrap;}

/* ── TARJETAS DE ACCESO — máximo contraste ── */
.mode-cards{display:grid;grid-template-columns:1fr 1fr;gap:12px;width:100%;max-width:390px;margin-bottom:16px;}

.mode-card{border-radius:18px;padding:0;cursor:pointer;transition:transform .15s,box-shadow .15s;overflow:hidden;position:relative;-webkit-tap-highlight-color:transparent;}

/* Operador — verde sólido visible */
.mode-card.op{background:linear-gradient(160deg,#1c4a22,#122e16);border:2px solid #4caf50;box-shadow:0 4px 20px rgba(76,175,80,.25),inset 0 1px 0 rgba(158,240,154,.2);}
.mode-card.op:active{transform:scale(.95);box-shadow:0 2px 10px rgba(76,175,80,.3);}
.mode-card.op.sel{border-color:#9ef09a;box-shadow:0 0 0 3px rgba(158,240,154,.25),0 8px 28px rgba(76,175,80,.35);}

/* Admin — azul sólido visible */
.mode-card.adm{background:linear-gradient(160deg,#1a3060,#0f1e40);border:2px solid #1976d2;box-shadow:0 4px 20px rgba(25,118,210,.25),inset 0 1px 0 rgba(100,181,246,.2);}
.mode-card.adm:active{transform:scale(.95);box-shadow:0 2px 10px rgba(25,118,210,.3);}
.mode-card.adm.sel{border-color:#64b5f6;box-shadow:0 0 0 3px rgba(100,181,246,.25),0 8px 28px rgba(25,118,210,.35);}

/* Cabecera de cada tarjeta */
.mc-top{height:80px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;}
.mc-top-op{background:linear-gradient(135deg,rgba(76,175,80,.25),rgba(27,94,32,.4));}
.mc-top-adm{background:linear-gradient(135deg,rgba(25,118,210,.25),rgba(13,71,161,.4));}
.mc-top-glow-op{position:absolute;width:100px;height:100px;border-radius:50%;background:rgba(76,175,80,.18);filter:blur(20px);}
.mc-top-glow-adm{position:absolute;width:100px;height:100px;border-radius:50%;background:rgba(25,118,210,.18);filter:blur(20px);}
.mc-icon-wrap{width:50px;height:50px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:26px;position:relative;z-index:1;}
.mc-icon-op{background:rgba(158,240,154,.18);border:1.5px solid rgba(158,240,154,.4);}
.mc-icon-adm{background:rgba(100,181,246,.18);border:1.5px solid rgba(100,181,246,.4);}

/* Check seleccionado */
.mc-check{position:absolute;top:8px;right:8px;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;opacity:0;transition:all .2s;transform:scale(.5);}
.mc-check-op{background:#4caf50;color:#fff;}
.mc-check-adm{background:#1976d2;color:#fff;}
.mode-card.sel .mc-check{opacity:1;transform:scale(1);}

/* Cuerpo de la tarjeta */
.mc-body{padding:10px 12px 13px;}
.mc-label{font-family:'Syne',sans-serif;font-size:15px;font-weight:800;color:#ffffff;margin-bottom:5px;}
.mc-desc{font-size:10px;color:#a5c8a8;line-height:1.5;}
.mc-desc-adm{color:#90b4d8;}
.mc-features{display:flex;gap:4px;flex-wrap:wrap;margin-top:7px;}
.mc-feat{padding:3px 7px;border-radius:6px;font-size:9px;font-weight:700;}
.mc-feat-op{background:rgba(76,175,80,.2);color:#a5d6a7;border:1px solid rgba(76,175,80,.3);}
.mc-feat-adm{background:rgba(25,118,210,.2);color:#90caf9;border:1px solid rgba(25,118,210,.3);}

/* Flecha "tocá acá" animada */
.mc-tap-arrow{position:absolute;bottom:0;left:0;right:0;height:3px;border-radius:0 0 16px 16px;}
.mc-tap-arrow-op{background:linear-gradient(90deg,transparent,#4caf50,transparent);animation:tapPulse 2s ease-in-out infinite;}
.mc-tap-arrow-adm{background:linear-gradient(90deg,transparent,#1976d2,transparent);animation:tapPulse 2s ease-in-out infinite;}
@keyframes tapPulse{0%,100%{opacity:.3}50%{opacity:1}}

/* ── PANEL PIN — alto contraste ── */
.pin-panel{width:100%;max-width:390px;animation:slideUp .3s cubic-bezier(.34,1.2,.64,1);}
@keyframes slideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}

/* Tarjeta "quien ingresa" */
.pin-who{display:flex;align-items:center;gap:12px;border-radius:16px;padding:14px 16px;margin-bottom:18px;}
.pin-who-op{background:linear-gradient(135deg,#1c4a22,#122e16);border:2px solid #4caf50;box-shadow:0 4px 16px rgba(76,175,80,.2);}
.pin-who-adm{background:linear-gradient(135deg,#1a3060,#0f1e40);border:2px solid #1976d2;box-shadow:0 4px 16px rgba(25,118,210,.2);}
.pin-who-avatar{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;flex:none;}
.pin-who-avatar-op{background:rgba(158,240,154,.15);border:1px solid rgba(158,240,154,.3);}
.pin-who-avatar-adm{background:rgba(100,181,246,.15);border:1px solid rgba(100,181,246,.3);}
.pin-who-info{flex:1;}
.pin-who-name{font-family:'Syne',sans-serif;font-size:15px;font-weight:800;color:#ffffff;}
.pin-who-sub{font-size:11px;color:rgba(255,255,255,.5);margin-top:2px;}
.pin-who-dot{width:10px;height:10px;border-radius:50%;animation:blink 1.5s ease-in-out infinite;}
.pin-who-dot-op{background:#4caf50;box-shadow:0 0 8px #4caf50;}
.pin-who-dot-adm{background:#1976d2;box-shadow:0 0 8px #1976d2;}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}

/* Instrucción PIN */
.pin-instruction{font-size:12px;color:rgba(255,255,255,.45);text-align:center;margin-bottom:16px;letter-spacing:.5px;}

/* Dots PIN */
.pin-dots-row{display:flex;justify-content:center;gap:16px;margin-bottom:22px;}
.pin-dot{width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,.15);background:transparent;transition:all .2s;}
.pin-dot.filled-op{background:#4caf50;border-color:#4caf50;box-shadow:0 0 12px rgba(76,175,80,.7);}
.pin-dot.filled-adm{background:#1976d2;border-color:#1976d2;box-shadow:0 0 12px rgba(25,118,210,.7);}

/* Teclado PIN — botones bien visibles */
.pin-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
.pin-btn{background:rgba(255,255,255,.07);border:1.5px solid rgba(255,255,255,.14);border-radius:16px;padding:0;height:62px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:all .12s;-webkit-tap-highlight-color:transparent;}
.pin-btn:active{transform:scale(.88);}
.pin-btn-op:active{background:rgba(76,175,80,.25);border-color:#4caf50;}
.pin-btn-adm:active{background:rgba(25,118,210,.25);border-color:#1976d2;}
.pin-btn-num{font-family:'Syne',sans-serif;font-size:24px;font-weight:700;color:#ffffff;line-height:1;}
.pin-btn-letters{font-size:8px;color:rgba(255,255,255,.35);letter-spacing:1.5px;margin-top:2px;}
.pin-btn-del .pin-btn-num{font-size:20px;color:rgba(255,255,255,.5);}

.pin-error-box{background:rgba(244,67,54,.12);border:1.5px solid rgba(244,67,54,.4);border-radius:12px;padding:10px 16px;margin-top:10px;text-align:center;}
.pin-error-txt{color:#ef9a9a;font-size:12px;font-weight:600;animation:shake .35s;}

.pin-back{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:12px;color:rgba(255,255,255,.5);font-size:12px;cursor:pointer;padding:10px 20px;display:flex;align-items:center;gap:6px;margin:12px auto 0;transition:all .15s;}
.pin-back:active{background:rgba(255,255,255,.1);}

.login-version{position:absolute;top:14px;right:14px;background:rgba(158,240,154,.08);border:1px solid rgba(158,240,154,.18);padding:3px 10px;border-radius:20px;font-size:10px;color:rgba(158,240,154,.45);z-index:10;}
@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}
@keyframes pop{from{transform:scale(.5);opacity:0}to{transform:scale(1);opacity:1}}
.header{background:#0e1f11;border-bottom:1px solid #1a3020;padding:14px 16px 10px;position:sticky;top:0;z-index:100;}
.header-row{display:flex;align-items:center;justify-content:space-between;}
.header-title{font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:#9ef09a;}
.header-sub{font-size:10px;color:#4a7050;margin-top:1px;}
.mode-badge{padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;}
.badge-op{background:#1a3d20;color:#6de067;}
.badge-admin{background:#1a2d4a;color:#64b5f6;}
.logout-btn{background:none;border:none;color:#4a7050;cursor:pointer;padding:4px;}
.nav{display:flex;background:#0e1f11;border-top:1px solid #182c1c;position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;z-index:100;}
.nav-btn{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 4px;background:none;border:none;color:#3d6045;cursor:pointer;font-size:10px;font-family:'DM Sans',sans-serif;transition:color .15s;-webkit-tap-highlight-color:transparent;}
.nav-btn.active{color:#9ef09a;}
.card{background:#0e1f11;border:1px solid #182c1c;border-radius:16px;padding:16px;margin-bottom:12px;}
.card-title{font-family:'Syne',sans-serif;font-size:12px;font-weight:700;color:#4a7a52;text-transform:uppercase;letter-spacing:.8px;margin-bottom:12px;}
.stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;}
.stat{background:#111f14;border:1px solid #1a3020;border-radius:14px;padding:14px;}
.stat-lbl{font-size:11px;color:#4a7050;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;}
.stat-val{font-family:'Syne',sans-serif;font-size:21px;font-weight:800;color:#9ef09a;line-height:1.1;}
.stat-sub{font-size:11px;color:#4a7050;margin-top:3px;}
.stat.warn .stat-val{color:#f5c842;}
.stat.bad  .stat-val{color:#f56b6b;}
.stat.blue .stat-val{color:#64b5f6;}
.prod-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
.prod-btn{background:#111f14;border:1.5px solid #1a3020;border-radius:12px;padding:10px 6px;text-align:center;cursor:pointer;position:relative;-webkit-tap-highlight-color:transparent;transition:all .12s;}
.prod-btn:active,.prod-btn.sel{border-color:#9ef09a;background:#162b1a;}
.prod-nm{font-size:12px;font-weight:500;color:#c0dcc2;margin-bottom:3px;}
.prod-pr{font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:#9ef09a;}
.prod-un{font-size:10px;color:#3d6045;}
.prod-badge{position:absolute;top:4px;right:4px;background:#9ef09a;color:#0a1a0d;border-radius:50%;width:16px;height:16px;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;}
.cart-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #182c1c;}
.cart-nm{flex:1;font-size:14px;color:#c0dcc2;}
.qty-ctrl{display:flex;align-items:center;gap:6px;}
.qty-btn{width:28px;height:28px;border-radius:8px;background:#1a3020;border:none;color:#9ef09a;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;}
.qty-in{background:transparent;border:none;color:#e4ede5;font-family:'Syne',sans-serif;font-weight:700;font-size:15px;width:38px;text-align:center;outline:none;}
.cart-tot{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:#9ef09a;min-width:68px;text-align:right;}
.btn{display:flex;align-items:center;justify-content:center;gap:8px;padding:13px 20px;border-radius:14px;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:600;font-size:14px;transition:all .15s;width:100%;}
.btn-green{background:#9ef09a;color:#0a1a0d;font-weight:700;}
.btn-green:active{background:#7ed87a;transform:scale(.98);}
.btn-dim{background:#162b1a;border:1px solid #1e3d24;color:#6ab870;}
.btn-red{background:#2d1010;border:1px solid #4a1a1a;color:#f56b6b;}
.btn-wa{background:#128C7E;color:#fff;font-weight:700;}
.btn-blue{background:#1a2d4a;border:1px solid #1e3d6a;color:#64b5f6;}
.btn-sm{padding:8px 12px;font-size:12px;border-radius:10px;}
.btn-ico{width:34px;height:34px;padding:0;border-radius:10px;flex:none;}
.flbl{font-size:11px;color:#4a7050;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;display:block;}
.finput{width:100%;background:#111f14;border:1.5px solid #1a3020;border-radius:10px;padding:10px 14px;color:#e4ede5;font-family:'DM Sans',sans-serif;font-size:14px;outline:none;}
.finput:focus{border-color:#9ef09a;}
select.finput option{background:#0e1f11;}
.frow{margin-bottom:11px;}
.fgroup{display:flex;gap:8px;}
.fgroup .finput{flex:1;}
.pay-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;}
.pay-btn{padding:10px 4px;background:#111f14;border:1.5px solid #1a3020;border-radius:10px;color:#6ab870;font-size:12px;font-weight:500;cursor:pointer;text-align:center;transition:all .15s;}
.pay-btn.active{background:#162b1a;border-color:#9ef09a;color:#9ef09a;font-weight:700;}
.tag-g{background:#0f2e13;color:#6de067;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:600;}
.tag-y{background:#2e2508;color:#f5c842;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:600;}
.tag-r{background:#2e0808;color:#f56b6b;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:600;}
.tag-b{background:#0a1e3a;color:#64b5f6;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:600;}
.line{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #182c1c;}
.line:last-child{border-bottom:none;}
.line-k{color:#6ab870;font-size:13px;}
.line-v{font-family:'Syne',sans-serif;font-weight:700;font-size:14px;color:#9ef09a;}
.line-v.neg{color:#f56b6b;}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:200;display:flex;align-items:flex-end;}
.modal{background:#0e1f11;border-top:2px solid #1a3020;border-radius:24px 24px 0 0;width:100%;max-width:430px;margin:0 auto;padding:20px 20px 36px;max-height:82vh;overflow-y:auto;}
.modal-title{font-family:'Syne',sans-serif;font-size:17px;font-weight:800;color:#9ef09a;margin-bottom:14px;}
.bar-wrap{display:flex;align-items:flex-end;gap:4px;height:90px;margin:8px 0 4px;}
.bar-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;}
.bar{width:100%;background:linear-gradient(to top,#1a5c20,#9ef09a);border-radius:4px 4px 0 0;transition:height .5s cubic-bezier(.34,1.56,.64,1);min-height:2px;}
.bar-lbl{font-size:9px;color:#4a7050;text-align:center;}
.bar-val{font-size:8px;color:#9ef09a;font-weight:600;text-align:center;word-break:break-all;}
.tbl{width:100%;border-collapse:collapse;}
.tbl th{font-size:11px;color:#4a7050;text-transform:uppercase;letter-spacing:.5px;padding:6px 8px;text-align:left;border-bottom:1px solid #182c1c;}
.tbl td{font-size:13px;color:#c0dcc2;padding:8px;border-bottom:1px solid #0f1f12;}
.tbl tr:last-child td{border-bottom:none;}
.tbl .right{text-align:right;}
.tbl .bold{font-family:'Syne',sans-serif;font-weight:700;color:#9ef09a;}
.sec-title{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:#e4ede5;margin-bottom:10px;}
.empty{text-align:center;padding:28px 16px;color:#3d6045;}
.empty svg{margin:0 auto 10px;opacity:.35;display:block;}
.toast{position:fixed;top:66px;left:50%;transform:translateX(-50%);background:#9ef09a;color:#0a1a0d;padding:9px 18px;border-radius:30px;font-weight:700;font-size:13px;z-index:999;animation:tin .2s ease,tout .2s ease 1.8s forwards;white-space:nowrap;}
@keyframes tin{from{opacity:0;transform:translateX(-50%) translateY(-8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
@keyframes tout{to{opacity:0}}
.fade{animation:fadeUp .2s ease;}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
::-webkit-scrollbar{width:3px;}
::-webkit-scrollbar-thumb{background:#1a3020;border-radius:2px;}
.caja-big{font-family:'Syne',sans-serif;font-size:34px;font-weight:800;text-align:center;margin:8px 0;}
`;

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [mode,setMode]         = useState(null);
  const [products,setProducts] = useState([]);
  const [sales,setSales]       = useState([]);
  const [mermas,setMermas]     = useState([]);
  const [toast,setToast]       = useState(null);
  const [loaded,setLoaded]     = useState(false);

  useEffect(()=>{
    if(!mode) return;
    (async()=>{
      // Intentar bajar datos de la nube primero (sincronización)
      await db.pull();
      setProducts(db.get("products")||DEFAULT_PRODUCTS);
      setSales(db.get("sales_"+todayStr())||[]);
      setMermas(db.get("mermas_"+todayStr())||[]);
      setLoaded(true);
    })();
  },[mode]);

  const saveProducts = useCallback(p=>{
    setProducts(p);
    db.set("products",p);
    db.push("products",p); // sync nube background
  },[]);

  const saveSales = useCallback(s=>{
    setSales(s);
    db.set("sales_"+todayStr(),s);
    const idx=[...new Set([...(db.get("days_index")||[]),todayStr()])].sort();
    db.set("days_index",idx);
    // Sync nube en background
    db.push("sales_"+todayStr(),s);
    db.push("days_index",idx);
  },[]);

  const saveMermas = useCallback(m=>{
    setMermas(m);
    db.set("mermas_"+todayStr(),m);
    db.push("mermas_"+todayStr(),m); // sync nube background
  },[]);

  const showToast = useCallback(msg=>{
    setToast(msg); setTimeout(()=>setToast(null),2200);
  },[]);

  const totalVentas   = sales.reduce((a,s)=>a+s.total,0);
  const totalEfectivo = sales.filter(s=>s.pay==="efectivo").reduce((a,s)=>a+s.total,0);
  const totalTransf   = sales.filter(s=>s.pay==="transferencia").reduce((a,s)=>a+s.total,0);
  const totalTarjeta  = sales.filter(s=>s.pay==="tarjeta").reduce((a,s)=>a+s.total,0);
  const totalCosto    = sales.reduce((a,s)=>{const p=products.find(p=>p.id===s.productId);return a+(p?p.cost*s.qty:0);},0);
  const ganancia      = totalVentas-totalCosto;
  const margenPct     = totalVentas>0?(ganancia/totalVentas)*100:0;
  const mermasCount   = mermas.reduce((a,m)=>a+m.qty,0);

  if(!mode) return <LoginScreen onLogin={m=>{setMode(m);setLoaded(false);}}/>;
  if(!loaded) return(
    <div style={{height:"100vh",display:"flex",flexDirection:"column",alignItems:"center",
      justifyContent:"center",background:"#0a1a0d",gap:16}}>
      <div style={{fontSize:44}}>🥬</div>
      <div style={{fontSize:13,color:"#4a7050"}}>Sincronizando datos…</div>
    </div>
  );

  return (
    <>
      {mode==="op"
        ? <OperadorApp products={products} sales={sales} mermas={mermas}
            saveProducts={saveProducts} saveSales={saveSales} saveMermas={saveMermas}
            showToast={showToast} toast={toast}
            totalVentas={totalVentas} totalEfectivo={totalEfectivo}
            totalTransf={totalTransf} totalTarjeta={totalTarjeta}
            totalCosto={totalCosto} ganancia={ganancia} margenPct={margenPct}
            mermasCount={mermasCount} onLogout={()=>{setMode(null);setLoaded(false);}}/>
        : <AdminApp products={products} saveProducts={saveProducts} showToast={showToast} toast={toast}
            onLogout={()=>{setMode(null);setLoaded(false);}}/>
      }
    </>
  );
}

// ─── LOGIN REDISEÑADO — ALTO CONTRASTE ───────────────────────────────────────
const PIN_LETTERS = {"2":"ABC","3":"DEF","4":"GHI","5":"JKL","6":"MNO","7":"PQRS","8":"TUV","9":"WXYZ"};

function LoginScreen({onLogin}){
  const [sel,setSel]     = useState(null);
  const [pin,setPin]     = useState("");
  const [err,setErr]     = useState(false);
  const [shake,setShake] = useState(false);
  const isAdm = sel==="admin";

  const digit = d => {
    if(pin.length>=4) return;
    const next=pin+d; setPin(next); setErr(false);
    if(next.length===4){
      setTimeout(()=>{
        const cfg = getSettings();
        if(next===(isAdm ? cfg.adminPin : cfg.opPin)) onLogin(sel);
        else{ setErr(true); setShake(true); setTimeout(()=>setShake(false),400); setPin(""); }
      },150);
    }
  };

  const now     = new Date();
  const timeStr = now.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
  const dateStr = now.toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"});

  return(
    <div className="login-root">
      <div className="login-version">v2.0 Pro</div>

      {/* HERO */}
      <div className="login-hero">
        <div className="login-hero-bg"/>
        <div className="login-hero-pattern"/>
        <div className="login-hero-glow"/>
        <div className="login-hero-content">
          <div className="login-brand-ring">🥬</div>
          <div className="login-brand-name">Verdulero<span>App</span></div>
          <div className="login-brand-tag">Sistema de gestión · Pro</div>
          <div style={{marginTop:10,textAlign:"center"}}>
            <div style={{fontFamily:"Syne,sans-serif",fontSize:26,fontWeight:800,color:"#fff",letterSpacing:-1}}>{timeStr}</div>
            <div style={{fontSize:10,color:"rgba(158,240,154,.45)",marginTop:2,textTransform:"capitalize"}}>{dateStr}</div>
          </div>
        </div>
        <div className="login-hero-dots"/>
      </div>

      {/* SHEET */}
      <div className="login-sheet">
        {!sel ? (
          <>
            {/* Instrucción visible */}
            <div className="login-tap-hint">
              <div className="login-tap-hint-line"/>
              <div className="login-tap-hint-text">👇 Tocá tu tipo de acceso</div>
              <div className="login-tap-hint-line"/>
            </div>

            {/* TARJETAS — bordes de colores sólidos */}
            <div className="mode-cards">

              {/* OPERADOR */}
              <div className={`mode-card op ${sel==="op"?"sel":""}`}
                onClick={()=>{setSel("op");setPin("");setErr(false);}}>
                <div className="mc-check mc-check-op">✓</div>
                <div className="mc-tap-arrow mc-tap-arrow-op"/>
                <div className="mc-top mc-top-op">
                  <div className="mc-top-glow-op"/>
                  <div className="mc-icon-wrap mc-icon-op">🛒</div>
                </div>
                <div className="mc-body">
                  <div className="mc-label">Operador</div>
                  <div className="mc-desc">Registrá ventas y controlá la caja del día</div>
                  <div className="mc-features">
                    <span className="mc-feat mc-feat-op">Ventas</span>
                    <span className="mc-feat mc-feat-op">Caja</span>
                    <span className="mc-feat mc-feat-op">Merma</span>
                  </div>
                </div>
              </div>

              {/* ADMIN */}
              <div className={`mode-card adm ${sel==="admin"?"sel":""}`}
                onClick={()=>{setSel("admin");setPin("");setErr(false);}}>
                <div className="mc-check mc-check-adm">✓</div>
                <div className="mc-tap-arrow mc-tap-arrow-adm"/>
                <div className="mc-top mc-top-adm">
                  <div className="mc-top-glow-adm"/>
                  <div className="mc-icon-wrap mc-icon-adm">📊</div>
                </div>
                <div className="mc-body">
                  <div className="mc-label">Administrador</div>
                  <div className="mc-desc mc-desc-adm">Reportes, historial y análisis del negocio</div>
                  <div className="mc-features">
                    <span className="mc-feat mc-feat-adm">Reportes</span>
                    <span className="mc-feat mc-feat-adm">Historial</span>
                  </div>
                </div>
              </div>

            </div>

            <div style={{marginTop:10,fontSize:11,color:"rgba(255,255,255,.2)",textAlign:"center"}}>
              🔒 Acceso protegido con PIN personal
            </div>
          </>

        ) : (

          /* PANEL PIN */
          <div className="pin-panel">

            {/* Quién ingresa */}
            <div className={`pin-who ${isAdm?"pin-who-adm":"pin-who-op"}`}>
              <div className={`pin-who-avatar ${isAdm?"pin-who-avatar-adm":"pin-who-avatar-op"}`}>
                {isAdm?"📊":"🛒"}
              </div>
              <div className="pin-who-info">
                <div className="pin-who-name">{isAdm?"Administrador":"Operador"}</div>
                <div className="pin-who-sub">Ingresá tu PIN de 4 dígitos</div>
              </div>
              <div className={`pin-who-dot ${isAdm?"pin-who-dot-adm":"pin-who-dot-op"}`}/>
            </div>

            <div className="pin-instruction">Tocá los números para ingresar tu PIN</div>

            {/* Indicadores de progreso */}
            <div className="pin-dots-row">
              {[0,1,2,3].map(i=>(
                <div key={i} className={`pin-dot ${i<pin.length?(isAdm?"filled-adm":"filled-op"):""}`}/>
              ))}
            </div>

            {/* Teclado numérico */}
            <div className="pin-grid">
              {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((d,i)=>(
                d===""
                  ? <div key={i}/>
                  : <button key={i}
                      className={`pin-btn ${isAdm?"pin-btn-adm":"pin-btn-op"} ${d==="⌫"?"pin-btn-del":""}`}
                      onClick={()=>d==="⌫"?setPin(p=>p.slice(0,-1)):digit(d)}>
                      <span className="pin-btn-num">{d}</span>
                      {PIN_LETTERS[d]&&<span className="pin-btn-letters">{PIN_LETTERS[d]}</span>}
                    </button>
              ))}
            </div>

            {err&&(
              <div className="pin-error-box">
                <div className="pin-error-txt">❌ PIN incorrecto — intentá de nuevo</div>
              </div>
            )}

            <button className="pin-back"
              onClick={()=>{setSel(null);setPin("");setErr(false);}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Elegir otro tipo de acceso
            </button>

          </div>
        )}
      </div>
    </div>
  );
}

// ─── OPERADOR APP ─────────────────────────────────────────────────────────────
function OperadorApp({products,sales,mermas,saveProducts,saveSales,saveMermas,
  showToast,toast,totalVentas,totalEfectivo,totalTransf,totalTarjeta,
  totalCosto,ganancia,margenPct,mermasCount,onLogout}){
  const [tab,setTab]=useState("home");
  const tabs={
    home:   <OpHome sales={sales} products={products} totalVentas={totalVentas} ganancia={ganancia} margenPct={margenPct} mermasCount={mermasCount} totalEfectivo={totalEfectivo} totalTransf={totalTransf} totalTarjeta={totalTarjeta}/>,
    ventas: <OpVentas products={products} sales={sales} saveSales={saveSales} saveProducts={saveProducts} showToast={showToast}/>,
    caja:   <OpCaja sales={sales} totalVentas={totalVentas} totalEfectivo={totalEfectivo} totalTransf={totalTransf} totalTarjeta={totalTarjeta} ganancia={ganancia} margenPct={margenPct} totalCosto={totalCosto} showToast={showToast}/>,
    merma:  <OpMerma products={products} mermas={mermas} saveMermas={saveMermas} showToast={showToast}/>,
    precios:<OpPrecios products={products} saveProducts={saveProducts} showToast={showToast}/>,
  };
  return(
    <div className="app">
      <header className="header">
        <div className="header-row">
          <div>
            <div className="header-title">🥬 VerduleroApp</div>
            <div className="header-sub">{new Date().toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"})}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span className="mode-badge badge-op">Operador</span>
            <button className="logout-btn" onClick={onLogout}><Ico d={I.logout} size={18}/></button>
          </div>
        </div>
      </header>
      <main className="content fade">{tabs[tab]}</main>
      {toast&&<div className="toast">{toast}</div>}
      <nav className="nav">
        {[{id:"home",lbl:"Inicio",icon:I.home},{id:"ventas",lbl:"Ventas",icon:I.cart},
          {id:"caja",lbl:"Caja",icon:I.cash},{id:"merma",lbl:"Merma",icon:I.alert},
          {id:"precios",lbl:"Precios",icon:I.tag}].map(t=>(
          <button key={t.id} className={`nav-btn ${tab===t.id?"active":""}`} onClick={()=>setTab(t.id)}>
            <Ico d={t.icon} size={20}/>{t.lbl}
          </button>
        ))}
      </nav>
    </div>
  );
}

function OpHome({sales,products,totalVentas,ganancia,margenPct,mermasCount,totalEfectivo,totalTransf,totalTarjeta}){
  const cnt=sales.length;
  return(
    <div>
      <div className="sec-title">📊 Resumen del día</div>
      <div className="stats-grid">
        <div className="stat"><div className="stat-lbl">Ventas del día</div><div className="stat-val">{fmtARS(totalVentas)}</div><div className="stat-sub">{cnt} transacciones</div></div>
        <div className={`stat${mermasCount>5?" bad":mermasCount>2?" warn":""}`}><div className="stat-lbl">Merma hoy</div><div className="stat-val">{mermasCount}</div><div className="stat-sub">kg / unidades</div></div>
      </div>
      <div className="card">
        <div className="card-title">Cobros por método</div>
        {[["💵 Efectivo",totalEfectivo],["📲 Transferencia",totalTransf],["💳 Tarjeta/QR",totalTarjeta]].map(([l,v])=>(
          <div key={l} className="line"><span className="line-k">{l}</span><span className="line-v">{fmtARS(v)}</span></div>
        ))}
      </div>
      {sales.length>0&&(
        <div className="card">
          <div className="card-title">Top productos hoy</div>
          {Object.values(sales.reduce((acc,s)=>{
            const p=products.find(p=>p.id===s.productId); if(!p)return acc;
            if(!acc[s.productId])acc[s.productId]={name:p.name,total:0};
            acc[s.productId].total+=s.total; return acc;
          },{})).sort((a,b)=>b.total-a.total).slice(0,5).map((p,i)=>(
            <div key={i} className="line"><span className="line-k">{i+1}. {p.name}</span><span className="line-v">{fmtARS(p.total)}</span></div>
          ))}
        </div>
      )}
      {!sales.length&&<div className="empty"><Ico d={I.cart} size={38}/><p>Sin ventas aún hoy</p></div>}
    </div>
  );
}

function OpVentas({products,sales,saveSales,saveProducts,showToast}){
  const [cart,setCart]         = useState({}); // {pid: qty_kg}
  const [pay,setPay]           = useState("efectivo");
  const [hist,setHist]         = useState(false);
  const [selProd,setSelProd]   = useState(null);
  const [montoInput,setMontoInput] = useState(""); // el operador ingresa $ monto

  const items = Object.entries(cart).filter(([,q])=>q>0);
  const total = items.reduce((a,[pid,qty])=>{
    const p=products.find(p=>p.id===pid);
    return a+(p ? p.price*qty : 0);
  },0);

  // Peso calculado desde monto ingresado
  const pesoCalculado = selProd && montoInput
    ? (parseFloat(montoInput)||0) / selProd.price
    : 0;

  const openModal = p => { setSelProd(p); setMontoInput(""); };

  const confirmarMonto = () => {
    if(!pesoCalculado || pesoCalculado<=0 || !selProd) return;
    setCart(c=>({...c,[selProd.id]: parseFloat(((c[selProd.id]||0)+pesoCalculado).toFixed(4))}));
    setSelProd(null); setMontoInput("");
  };

  const removeItem = pid => { const c={...cart}; delete c[pid]; setCart(c); };

  const confirm = () => {
    if(!items.length) return;
    // Guardar ventas
    const newSales = items.map(([pid,qty])=>{
      const p=products.find(p=>p.id===pid);
      return {id:Date.now()+Math.random(),productId:pid,name:p.name,qty,
        price:p.price,total:p.price*qty,pay,
        time:new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})};
    });
    saveSales([...sales,...newSales]);
    // Descontar stock de cada producto vendido
    const updatedProds = products.map(p=>{
      const vendido = cart[p.id];
      if(!vendido) return p;
      return {...p, stock: Math.max(0, parseFloat((p.stock - vendido).toFixed(4)))};
    });
    saveProducts(updatedProds);
    setCart({});
    showToast(`✅ Venta registrada — ${fmtARS(total)}`);
  };

  return(
    <div>
      <div className="sec-title">🛒 Registrar venta</div>

      {/* Instrucción */}
      <div style={{background:"#0f2e13",border:"1px solid #1a4a20",borderRadius:12,
        padding:"10px 14px",marginBottom:12,fontSize:12,color:"#6ab870"}}>
        📦 Tocá el producto → ingresá el <b>monto</b> que muestra la balanza → el sistema calcula el peso automáticamente
      </div>

      {/* GRILLA DE PRODUCTOS */}
      <div className="card">
        <div className="card-title">Seleccioná el producto</div>
        <div className="prod-grid">
          {products.filter(p=>p.price>0).map(p=>(
            <button key={p.id} className={`prod-btn ${cart[p.id]?"sel":""}`}
              onClick={()=>openModal(p)}>
              {cart[p.id]>0&&(
                <div className="prod-badge">{parseFloat(cart[p.id]).toFixed(2)}</div>
              )}
              <div className="prod-nm">{p.name}</div>
              <div className="prod-pr">{fmtARS(p.price)}</div>
              <div className="prod-un">/{p.unit}</div>
              {p.stock<=5&&p.stock>0&&(
                <div style={{fontSize:9,color:"#f5c842",marginTop:2}}>Stock bajo</div>
              )}
              {p.stock<=0&&(
                <div style={{fontSize:9,color:"#f56b6b",marginTop:2}}>Sin stock</div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* CARRITO */}
      {items.length>0&&(
        <div className="card">
          <div className="card-title">Carrito</div>
          {items.map(([pid,qty])=>{
            const p=products.find(p=>p.id===pid);
            const montoItem = p.price*qty;
            return(
              <div key={pid} className="cart-row">
                <div style={{flex:1}}>
                  <div className="cart-nm">{p.name}</div>
                  <div style={{fontSize:11,color:"#4a7050"}}>
                    {qty.toFixed(3)} {p.unit} × {fmtARS(p.price)}
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div className="cart-tot">{fmtARS(montoItem)}</div>
                  <button className="btn btn-dim btn-sm btn-ico"
                    onClick={()=>{setSelProd(p);setMontoInput(montoItem.toString());}}>
                    <Ico d={I.edit} size={13}/>
                  </button>
                  <button className="btn btn-red btn-sm btn-ico" onClick={()=>removeItem(pid)}>
                    <Ico d={I.trash} size={13}/>
                  </button>
                </div>
              </div>
            );
          })}
          <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0 4px",
            borderTop:"1px solid #1e3522",marginTop:4}}>
            <span style={{fontFamily:"Syne,sans-serif",fontWeight:800,color:"#e4ede5"}}>TOTAL</span>
            <span style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:22,color:"#9ef09a"}}>{fmtARS(total)}</span>
          </div>
          <div style={{marginTop:10}}>
            <div className="flbl">Medio de pago</div>
            <div className="pay-grid">
              {[["efectivo","💵 Efectivo"],["transferencia","📲 Transfer"],["tarjeta","💳 Tarjeta"]].map(([v,l])=>(
                <button key={v} className={`pay-btn ${pay===v?"active":""}`} onClick={()=>setPay(v)}>{l}</button>
              ))}
            </div>
          </div>
          <button className="btn btn-green" onClick={confirm}>
            <Ico d={I.check} size={17}/>Confirmar venta
          </button>
        </div>
      )}

      <button className="btn btn-dim" style={{marginTop:4}} onClick={()=>setHist(true)}>
        Ver ventas del día ({sales.length})
      </button>

      {/* ── MODAL MONTO/BALANZA ── */}
      {selProd&&(
        <div className="overlay" onClick={()=>setSelProd(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>

            {/* Info producto */}
            <div style={{background:"#111f14",border:"1px solid #1a3020",borderRadius:14,
              padding:"14px 16px",marginBottom:18,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:18,color:"#9ef09a"}}>
                  {selProd.name}
                </div>
                <div style={{fontSize:12,color:"#4a7050",marginTop:2}}>
                  Precio: {fmtARS(selProd.price)} / {selProd.unit} · Stock: {parseFloat(selProd.stock).toFixed(2)} {selProd.unit}
                </div>
              </div>
              <div style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:22,color:"#f5e842"}}>
                {fmtARS(selProd.price)}
              </div>
            </div>

            {/* Instrucción */}
            <div style={{fontSize:12,color:"rgba(255,255,255,.5)",textAlign:"center",marginBottom:14}}>
              Ingresá el <b style={{color:"#9ef09a"}}>monto $</b> que cobró la balanza
            </div>

            {/* Display monto → peso calculado */}
            <div style={{background:"#060e07",border:"2px solid #1e3522",borderRadius:16,
              padding:"14px 16px",marginBottom:14,textAlign:"center"}}>
              {/* Monto ingresado */}
              <div style={{marginBottom:10}}>
                <div style={{fontSize:10,color:"#4a7050",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>
                  Monto cobrado
                </div>
                <div style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:38,
                  color:montoInput?"#f5e842":"rgba(255,255,255,.2)"}}>
                  {montoInput ? "$"+parseInt(montoInput||0).toLocaleString("es-AR") : "$0"}
                </div>
              </div>
              {/* Separador → */}
              {montoInput&&(
                <>
                  <div style={{fontSize:18,color:"#4a7050",margin:"4px 0"}}>↓</div>
                  {/* Peso calculado */}
                  <div style={{background:"#0f2e13",border:"1px solid #1a4a20",borderRadius:12,padding:"10px 14px"}}>
                    <div style={{fontSize:10,color:"#4a7050",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>
                      Peso calculado
                    </div>
                    <div style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:28,color:"#9ef09a"}}>
                      {pesoCalculado.toFixed(3)} {selProd.unit}
                    </div>
                    <div style={{fontSize:10,color:"#4a7050",marginTop:2}}>
                      {fmtARS(montoInput)} ÷ {fmtARS(selProd.price)} = {pesoCalculado.toFixed(3)} {selProd.unit}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Teclado numérico — solo enteros para monto */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
              {["1","2","3","4","5","6","7","8","9","000","0","⌫"].map((d,i)=>(
                <button key={i} style={{
                  background:"rgba(255,255,255,.07)",border:"1.5px solid rgba(255,255,255,.12)",
                  borderRadius:14,height:56,fontFamily:"Syne,sans-serif",fontSize:d==="000"?16:22,
                  fontWeight:700,color:"#ffffff",cursor:"pointer",transition:"all .1s"
                }}
                onClick={()=>{
                  if(d==="⌫") setMontoInput(p=>p.slice(0,-1));
                  else if(d==="000") setMontoInput(p=>p?(p+"000"):"");
                  else setMontoInput(p=>p.length>=8?p:p+d);
                }}>
                  {d}
                </button>
              ))}
            </div>

            {/* Botones */}
            <div style={{display:"flex",gap:8}}>
              <button className="btn btn-dim" onClick={()=>setSelProd(null)}>Cancelar</button>
              <button className="btn btn-green"
                style={{opacity:pesoCalculado>0?1:.35}}
                onClick={confirmarMonto}>
                <Ico d={I.check} size={17}/>Agregar al carrito
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Historial */}
      {hist&&(
        <div className="overlay" onClick={()=>setHist(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">Ventas de hoy</div>
            {!sales.length?<div className="empty"><p>Sin ventas aún</p></div>
              :[...sales].reverse().map(s=>(
                <div key={s.id} style={{padding:"9px 0",borderBottom:"1px solid #182c1c"}}>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontSize:14,color:"#c0dcc2"}}>
                      {s.name} — {parseFloat(s.qty).toFixed(3)} {products.find(p=>p.id===s.productId)?.unit||""}
                    </span>
                    <span style={{fontFamily:"Syne,sans-serif",fontWeight:700,color:"#9ef09a"}}>{fmtARS(s.total)}</span>
                  </div>
                  <div style={{fontSize:11,color:"#3d6045",marginTop:2}}>{s.time} · {s.pay}</div>
                </div>
              ))}
            <button className="btn btn-dim" style={{marginTop:14}} onClick={()=>setHist(false)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function OpCaja({sales,totalVentas,totalEfectivo,totalTransf,totalTarjeta,ganancia,margenPct,totalCosto,showToast}){
  const [gastos,setGastos]=useState(""); const [notaG,setNotaG]=useState(""); const [efFis,setEfFis]=useState("");
  const gastN=parseFloat(gastos)||0, efN=parseFloat(efFis)||0;
  const neto=ganancia-gastN, diff=efN-totalEfectivo, cnt=sales.length, tkt=cnt>0?totalVentas/cnt:0;
  const sendWA=()=>{
    const cfg = getSettings();
    const phone = cfg.waPhone || "";
    const fecha=new Date().toLocaleDateString("es-AR",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
    const txt=encodeURIComponent(`🥬 *CIERRE DE CAJA*\n📅 ${fecha}\n\n`+
      `💰 *Ventas totales:* ${fmtARS(totalVentas)}\n`+
      `   💵 Efectivo: ${fmtARS(totalEfectivo)}\n   📲 Transferencia: ${fmtARS(totalTransf)}\n   💳 Tarjeta: ${fmtARS(totalTarjeta)}\n\n`+
      `📦 Costo mercadería: ${fmtARS(totalCosto)}\n`+
      (gastN?`🔧 Gastos: ${fmtARS(gastN)}${notaG?` (${notaG})`:""}\n`:"")+
      `\n✅ *Ganancia neta: ${fmtARS(neto)}*\n📈 Margen: ${fmtPct(margenPct)}\n🧾 Transacciones: ${cnt}\n💵 Ticket prom.: ${fmtARS(tkt)}\n`+
      (efFis?`\n🔎 Efectivo físico: ${fmtARS(efN)} (${diff>=0?"+":""}${fmtARS(diff)})\n`:"")+
      `_VerduleroApp Pro_`);
    const url = phone ? `https://wa.me/${phone}?text=${txt}` : `https://wa.me/?text=${txt}`;
    window.open(url,"_blank");
  };
  return(
    <div>
      <div className="sec-title">💰 Cuadre de caja</div>
      <div className="card">
        <div className="card-title">Ingresos</div>
        {[["💵 Efectivo",totalEfectivo],["📲 Transferencia",totalTransf],["💳 Tarjeta/QR",totalTarjeta]].map(([l,v])=>(
          <div key={l} className="line"><span className="line-k">{l}</span><span className="line-v">{fmtARS(v)}</span></div>
        ))}
        <div className="line" style={{borderTop:"1px solid #1e3522",paddingTop:10}}>
          <span className="line-k" style={{fontWeight:700,color:"#c0dcc2"}}>TOTAL</span>
          <span className="line-v" style={{fontSize:19}}>{fmtARS(totalVentas)}</span>
        </div>
      </div>
      <div className="card">
        <div className="card-title">Costos y gastos</div>
        <div className="line"><span className="line-k">Costo mercadería</span><span className="line-v neg">{fmtARS(totalCosto)}</span></div>
        <div className="frow" style={{marginTop:8}}>
          <label className="flbl">Otros gastos del día</label>
          <div className="fgroup">
            <input className="finput" type="number" placeholder="$ importe" value={gastos} onChange={e=>setGastos(e.target.value)}/>
            <input className="finput" type="text" placeholder="Detalle" value={notaG} onChange={e=>setNotaG(e.target.value)}/>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-title">Resultado del día</div>
        <div className="caja-big" style={{color:neto>=0?"#9ef09a":"#f56b6b"}}>{fmtARS(neto)}</div>
        <div style={{textAlign:"center",marginBottom:10}}>
          <span className={neto>=0?"tag-g":"tag-r"}>{fmtPct(margenPct)} de margen</span>
        </div>
        <div className="line"><span className="line-k">🧾 Transacciones</span><span className="line-v">{cnt}</span></div>
        <div className="line"><span className="line-k">💵 Ticket promedio</span><span className="line-v">{fmtARS(tkt)}</span></div>
      </div>
      <div className="card">
        <div className="card-title">Arqueo de efectivo</div>
        <div className="frow">
          <label className="flbl">Efectivo físico contado</label>
          <input className="finput" type="number" placeholder="$" value={efFis} onChange={e=>setEfFis(e.target.value)}/>
        </div>
        {efFis&&<div className="line"><span className="line-k">Diferencia</span><span className={`line-v ${diff>=0?"":"neg"}`}>{diff>=0?"+":""}{fmtARS(diff)}</span></div>}
      </div>
      <button className="btn btn-wa" onClick={sendWA}><Ico d={I.wa} size={19}/>Enviar resumen por WhatsApp</button>
    </div>
  );
}

function OpMerma({products,mermas,saveMermas,showToast}){
  const [sel,setSel]=useState(""); const [qty,setQty]=useState(""); const [nota,setNota]=useState("");
  const byProd=mermas.reduce((a,m)=>{a[m.productId]=(a[m.productId]||0)+m.qty;return a;},{});
  const totalVal=mermas.reduce((a,m)=>{const p=products.find(p=>p.id===m.productId);return a+(p?p.cost*m.qty:0);},0);
  const st=pid=>{const q=byProd[pid]||0,p=products.find(p=>p.id===pid);if(!p)return"g";const pct=(q/p.stock)*100;return pct>=20?"r":pct>=10?"y":"g";};
  const add=()=>{
    if(!sel||!qty)return;
    saveMermas([...mermas,{id:Date.now(),productId:sel,qty:parseFloat(qty),nota,time:new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})}]);
    setQty("");setNota("");showToast("🚨 Merma registrada");
  };
  return(
    <div>
      <div className="sec-title">🚨 Control de merma</div>
      <div className="stats-grid">
        <div className="stat warn"><div className="stat-lbl">Total merma</div><div className="stat-val">{mermas.reduce((a,m)=>a+m.qty,0).toFixed(1)}</div><div className="stat-sub">kg / unidades</div></div>
        <div className="stat bad"><div className="stat-lbl">Pérdida estim.</div><div className="stat-val" style={{fontSize:18}}>{fmtARS(totalVal)}</div><div className="stat-sub">a costo</div></div>
      </div>
      <div className="card">
        <div className="card-title">Registrar merma</div>
        <div className="frow"><label className="flbl">Producto</label>
          <select className="finput" value={sel} onChange={e=>setSel(e.target.value)}>
            <option value="">Seleccioná…</option>
            {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="frow"><label className="flbl">Cantidad</label><input className="finput" type="number" placeholder="0" min=".1" step=".1" value={qty} onChange={e=>setQty(e.target.value)}/></div>
        <div className="frow"><label className="flbl">Motivo (opcional)</label><input className="finput" type="text" placeholder="vencimiento, golpes…" value={nota} onChange={e=>setNota(e.target.value)}/></div>
        <button className="btn btn-green" onClick={add}><Ico d={I.plus} size={17}/>Registrar</button>
      </div>
      {products.filter(p=>byProd[p.id]>0).length>0&&(
        <div className="card">
          <div className="card-title">Semáforo</div>
          {products.filter(p=>byProd[p.id]>0).map(p=>(
            <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 0",borderBottom:"1px solid #182c1c"}}>
              <div style={{flex:1}}><div style={{fontSize:14,color:"#c0dcc2",fontWeight:500}}>{p.name}</div><div style={{fontSize:11,color:"#3d6045"}}>{byProd[p.id]?.toFixed(1)} {p.unit} perdido/s</div></div>
              <span className={`tag-${st(p.id)}`}>{st(p.id)==="g"?"🟢 Bajo":st(p.id)==="y"?"🟡 Medio":"🔴 Alto"}</span>
            </div>
          ))}
        </div>
      )}
      {!mermas.length&&<div className="empty"><Ico d={I.check} size={38}/><p>Sin mermas hoy 🎉</p></div>}
    </div>
  );
}

// ── OPERADOR: solo agrega productos (sin costos ni precios) ──────────────────
function OpPrecios({products,saveProducts,showToast}){
  const [addM,setAddM]=useState(false);
  const [nm,setNm]=useState(""); const [un,setUn]=useState("kg"); const [st,setSt]=useState("");

  const addProd=()=>{
    if(!nm) return;
    saveProducts([...products,{id:Date.now().toString(),name:nm,unit:un,
      cost:0,price:0,stock:parseFloat(st)||10,minStock:3}]);
    setAddM(false); setNm(""); setUn("kg"); setSt("");
    showToast("✅ Producto agregado");
  };

  return(
    <div>
      <div className="sec-title">📦 Productos</div>

      {/* Aviso de permisos */}
      <div style={{background:"#1a2d4a",border:"1px solid #1e3d6a",borderRadius:14,padding:"12px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:20}}>🔒</span>
        <div>
          <div style={{fontFamily:"Syne,sans-serif",fontWeight:700,fontSize:12,color:"#64b5f6"}}>Permisos limitados</div>
          <div style={{fontSize:11,color:"#4a7090",marginTop:2}}>Los precios y costos solo puede modificarlos el Administrador</div>
        </div>
      </div>

      {/* Botón agregar */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div className="sec-title" style={{margin:0}}>Lista de productos</div>
        <button className="btn btn-green btn-sm" style={{width:"auto"}}
          onClick={()=>{setAddM(true);setNm("");setUn("kg");setSt("");}}>
          <Ico d={I.plus} size={13}/>Agregar
        </button>
      </div>

      {/* Lista — solo nombre y unidad, sin costos */}
      <div className="card" style={{padding:"6px 14px"}}>
        {products.map(p=>(
          <div key={p.id} style={{display:"flex",alignItems:"center",padding:"10px 0",borderBottom:"1px solid #182c1c",gap:8}}>
            <div style={{flex:1}}>
              <div style={{fontSize:14,color:"#c0dcc2",fontWeight:500}}>{p.name}</div>
              <div style={{fontSize:11,color:"#3d6045"}}>Stock: {p.stock} {p.unit} · {fmtARS(p.price)}/{p.unit}</div>
            </div>
            <span className="tag-b">{p.unit}</span>
          </div>
        ))}
        {!products.length&&<div className="empty"><p>Sin productos</p></div>}
      </div>

      {/* Modal agregar — solo nombre, unidad, stock */}
      {addM&&(
        <div className="overlay" onClick={()=>setAddM(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">➕ Nuevo producto</div>
            <div style={{fontSize:11,color:"#4a7050",marginBottom:14,background:"#111f14",padding:"8px 12px",borderRadius:10}}>
              El Administrador deberá completar el costo y precio de venta.
            </div>
            <div className="frow"><label className="flbl">Nombre del producto</label>
              <input className="finput" type="text" placeholder="ej: Acelga" value={nm} onChange={e=>setNm(e.target.value)}/>
            </div>
            <div className="frow"><label className="flbl">Unidad de venta</label>
              <select className="finput" value={un} onChange={e=>setUn(e.target.value)}>
                {["kg","unid","atado","docena"].map(u=><option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="frow"><label className="flbl">Stock inicial</label>
              <input className="finput" type="number" placeholder="20" value={st} onChange={e=>setSt(e.target.value)}/>
            </div>
            <div style={{display:"flex",gap:8,marginTop:4}}>
              <button className="btn btn-dim" onClick={()=>setAddM(false)}>Cancelar</button>
              <button className="btn btn-green" onClick={addProd}>Agregar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ADMIN APP ────────────────────────────────────────────────────────────────
function AdminApp({products,saveProducts,showToast,toast,onLogout}){
  const [tab,setTab]=useState("dash");
  const [days,setDays]=useState([]);
  const [allSales,setAllSales]=useState({});
  const [allMermas,setAllMermas]=useState({});
  const [loading,setLoading]=useState(true);

  const load=useCallback(async()=>{
    setLoading(true);
    // Bajar datos actualizados de la nube
    const synced = await db.pull();
    const idx=db.get("days_index")||[];
    const allDays=[...new Set([...idx,todayStr()])].sort();
    setDays(allDays);
    const sm={},mm={};
    allDays.forEach(d=>{sm[d]=db.get("sales_"+d)||[];mm[d]=db.get("mermas_"+d)||[];});
    setAllSales(sm);setAllMermas(mm);setLoading(false);
    return synced;
  },[]);

  useEffect(()=>load(),[load]);

  const refresh=async()=>{
    const ok = await load();
    showToast(ok?"🔄 Sincronizado con la nube":"🔄 Actualizado (sin nube configurada)");
  };

  const tabs={
    dash:    <AdminDash    days={days} allSales={allSales} allMermas={allMermas} products={products} loading={loading}/>,
    historia:<AdminHistory days={days} allSales={allSales} allMermas={allMermas} products={products} loading={loading}/>,
    prods:   <AdminProds   days={days} allSales={allSales} products={products} loading={loading}/>,
    mermas:  <AdminMermas  days={days} allMermas={allMermas} products={products} loading={loading}/>,
    precios: <AdminPrecios products={products} saveProducts={saveProducts} showToast={showToast}/>,
    config:  <AdminConfig showToast={showToast}/>,
  };

  return(
    <div className="app">
      <header className="header">
        <div className="header-row">
          <div><div className="header-title">📊 Panel Admin</div><div className="header-sub">VerduleroApp Pro · Vista gerencial</div></div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button className="btn btn-blue btn-sm" style={{width:"auto",padding:"6px 12px",gap:5}} onClick={refresh}>
              <Ico d={I.sync} size={13}/><span style={{fontSize:11}}>Sync</span>
            </button>
            <span className="mode-badge badge-admin">Admin</span>
            <button className="logout-btn" onClick={onLogout}><Ico d={I.logout} size={18}/></button>
          </div>
        </div>
      </header>
      <main className="content fade">{tabs[tab]}</main>
      {toast&&<div className="toast">{toast}</div>}
      <nav className="nav">
        {[{id:"dash",lbl:"Dashboard",icon:I.chart},{id:"historia",lbl:"Historial",icon:I.cal},
          {id:"prods",lbl:"Ventas",icon:I.pkg},{id:"precios",lbl:"Precios",icon:I.tag},
          {id:"config",lbl:"Config",icon:["M12 15a3 3 0 100-6 3 3 0 000 6z","M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"]}].map(t=>(
          <button key={t.id} className={`nav-btn ${tab===t.id?"active":""}`} onClick={()=>setTab(t.id)}>
            <Ico d={t.icon} size={20}/>{t.lbl}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ── ADMIN: Gestión completa de precios ───────────────────────────────────────
function AdminPrecios({products,saveProducts,showToast}){
  const [costo,setCosto]=useState("");
  const [margen,setMargen]=useState("40");
  const [editM,setEditM]=useState(null);
  const [addM,setAddM]=useState(false);
  const [nm,setNm]=useState(""); const [un,setUn]=useState("kg");
  const [co,setCo]=useState(""); const [pr,setPr]=useState(""); const [st,setSt]=useState("");

  const cn=parseFloat(costo)||0, mn=parseFloat(margen)||0;
  const sug=cn>0?cn/(1-mn/100):0, gan=sug-cn;

  const openEdit=p=>{setEditM(p);setNm(p.name);setUn(p.unit);setCo(p.cost);setPr(p.price);setSt(p.stock);};
  const saveEdit=()=>{
    saveProducts(products.map(p=>p.id===editM.id
      ?{...p,name:nm,unit:un,cost:parseFloat(co)||0,price:parseFloat(pr)||0,stock:parseFloat(st)||0}:p));
    setEditM(null); showToast("✅ Producto actualizado");
  };
  const addProd=()=>{
    if(!nm||!co||!pr) return;
    saveProducts([...products,{id:Date.now().toString(),name:nm,unit:un,
      cost:parseFloat(co)||0,price:parseFloat(pr)||0,stock:parseFloat(st)||10,minStock:3}]);
    setAddM(false); setNm(""); setUn("kg"); setCo(""); setPr(""); setSt("");
    showToast("✅ Producto agregado");
  };
  // Aplicar margen global a todos los productos
  const applyMargenGlobal=()=>{
    if(!mn) return;
    const updated=products.map(p=>({...p,price:p.cost>0?Math.round(p.cost/(1-mn/100)):p.price}));
    saveProducts(updated);
    showToast(`✅ Margen ${mn}% aplicado a todos`);
  };

  return(
    <div>
      <div className="sec-title">🏷️ Gestión de precios</div>

      {/* Calculadora */}
      <div className="card">
        <div className="card-title">Calculadora de precio sugerido</div>
        <div className="frow"><label className="flbl">Costo de compra ($)</label>
          <input className="finput" type="number" placeholder="$ lo que pagaste" value={costo} onChange={e=>setCosto(e.target.value)}/>
        </div>
        <div className="frow"><label className="flbl">Margen de ganancia deseado (%)</label>
          <input className="finput" type="number" placeholder="40" value={margen} onChange={e=>setMargen(e.target.value)}/>
        </div>
        {cn>0&&(
          <div style={{background:"#0f2e13",border:"1px solid #1a4a20",borderRadius:12,padding:14,marginTop:4}}>
            <div className="line" style={{borderColor:"#1a4a20"}}>
              <span className="line-k">💰 Precio sugerido</span>
              <span style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:22,color:"#f5e842"}}>{fmtARS(sug)}</span>
            </div>
            <div className="line" style={{borderColor:"#1a4a20"}}><span className="line-k">Ganancia / unidad</span><span className="line-v">{fmtARS(gan)}</span></div>
            <div className="line"><span className="line-k">Markup sobre costo</span><span className="line-v">{fmtPct(cn>0?(gan/cn)*100:0)}</span></div>
          </div>
        )}
      </div>

      {/* Margen global */}
      <div className="card">
        <div className="card-title">Aplicar margen a todos los productos</div>
        <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
          <div style={{flex:1}}>
            <label className="flbl">% de margen global</label>
            <input className="finput" type="number" placeholder="ej: 40" value={margen} onChange={e=>setMargen(e.target.value)}/>
          </div>
          <button className="btn btn-blue btn-sm" style={{width:"auto",padding:"10px 16px",flexShrink:0}} onClick={applyMargenGlobal}>
            Aplicar a todos
          </button>
        </div>
        <div style={{fontSize:11,color:"#4a7090",marginTop:8}}>
          Recalcula el precio de venta de cada producto según su costo y el margen ingresado.
        </div>
      </div>

      {/* Lista de productos — edición completa */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div className="sec-title" style={{margin:0}}>Productos ({products.length})</div>
        <button className="btn btn-green btn-sm" style={{width:"auto"}}
          onClick={()=>{setAddM(true);setNm("");setUn("kg");setCo("");setPr("");setSt("");}}>
          <Ico d={I.plus} size={13}/>Nuevo
        </button>
      </div>

      <div className="card" style={{padding:"6px 14px"}}>
        {products.map(p=>{
          const mg=p.price>0?((p.price-p.cost)/p.price)*100:0;
          const sinPrecio=p.price===0||p.cost===0;
          return(
            <div key={p.id} style={{display:"flex",alignItems:"center",padding:"10px 0",borderBottom:"1px solid #182c1c",gap:7}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,color:"#c0dcc2",fontWeight:500,display:"flex",alignItems:"center",gap:6}}>
                  {p.name}
                  {sinPrecio&&<span className="tag-r" style={{fontSize:9}}>sin precio</span>}
                </div>
                <div style={{fontSize:11,color:"#3d6045"}}>
                  C:{fmtARS(p.cost)} → V:{fmtARS(p.price)}/{p.unit} · Stock:{p.stock}
                </div>
              </div>
              <span className={sinPrecio?"tag-r":mg>=30?"tag-g":mg>=15?"tag-y":"tag-r"}>
                {sinPrecio?"—":mg.toFixed(0)+"%"}
              </span>
              <button className="btn btn-dim btn-sm btn-ico" onClick={()=>openEdit(p)}><Ico d={I.edit} size={13}/></button>
              <button className="btn btn-red btn-sm btn-ico" onClick={()=>{saveProducts(products.filter(x=>x.id!==p.id));showToast("🗑️ Eliminado");}}><Ico d={I.trash} size={13}/></button>
            </div>
          );
        })}
        {!products.length&&<div className="empty"><p>Sin productos</p></div>}
      </div>

      {/* Modal editar */}
      {editM&&(
        <div className="overlay" onClick={()=>setEditM(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">✏️ Editar {editM.name}</div>
            {[["Nombre",nm,setNm,"text",""],["Costo de compra ($)",co,setCo,"number","$ costo"],
              ["Precio de venta ($)",pr,setPr,"number","$ venta"],["Stock actual",st,setSt,"number",""]].map(([l,v,s,t,ph])=>(
              <div key={l} className="frow"><label className="flbl">{l}</label>
                <input className="finput" type={t} placeholder={ph} value={v} onChange={e=>s(e.target.value)}/>
              </div>
            ))}
            <div className="frow"><label className="flbl">Unidad</label>
              <select className="finput" value={un} onChange={e=>setUn(e.target.value)}>
                {["kg","unid","atado","docena"].map(u=><option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            {co&&pr&&(
              <div style={{background:"#0f2e13",border:"1px solid #1a4a20",borderRadius:10,padding:10,marginBottom:12}}>
                <div style={{fontSize:11,color:"#4a7050"}}>Margen resultante</div>
                <div style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:18,color:"#9ef09a"}}>
                  {parseFloat(pr)>0?fmtPct(((parseFloat(pr)-parseFloat(co))/parseFloat(pr))*100):"—"}
                </div>
              </div>
            )}
            <div style={{display:"flex",gap:8}}>
              <button className="btn btn-dim" onClick={()=>setEditM(null)}>Cancelar</button>
              <button className="btn btn-green" onClick={saveEdit}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal agregar */}
      {addM&&(
        <div className="overlay" onClick={()=>setAddM(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">➕ Nuevo producto</div>
            {[["Nombre",nm,setNm,"text","ej: Acelga"],["Costo de compra ($)",co,setCo,"number","$ costo"],
              ["Precio de venta ($)",pr,setPr,"number","$ venta"],["Stock inicial",st,setSt,"number","20"]].map(([l,v,s,t,ph])=>(
              <div key={l} className="frow"><label className="flbl">{l}</label>
                <input className="finput" type={t} placeholder={ph} value={v} onChange={e=>s(e.target.value)}/>
              </div>
            ))}
            <div className="frow"><label className="flbl">Unidad</label>
              <select className="finput" value={un} onChange={e=>setUn(e.target.value)}>
                {["kg","unid","atado","docena"].map(u=><option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn btn-dim" onClick={()=>setAddM(false)}>Cancelar</button>
              <button className="btn btn-green" onClick={addProd}>Agregar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ADMIN: Configuración ─────────────────────────────────────────────────────
function AdminConfig({showToast}){
  const cfg      = db.getCfg();
  const stg      = getSettings();
  const [binId,setBinId]       = useState(cfg.binId);
  const [apiKey,setApiKey]     = useState(cfg.apiKey);
  const [opPin,setOpPin]       = useState(stg.opPin);
  const [adminPin,setAdminPin] = useState(stg.adminPin);
  const [waPhone,setWaPhone]   = useState(stg.waPhone);
  const [showPins,setShowPins] = useState(false);
  const [testing,setTesting]   = useState(false);
  const [syncOk,setSyncOk]     = useState(null); // null | true | false
  const [creating,setCreating] = useState(false);

  // Probar conexión con el bin
  const testSync = async () => {
    if(!binId||!apiKey){ showToast("❌ Ingresá el Bin ID y la API Key"); return; }
    setTesting(true); setSyncOk(null);
    db.set("syncCfg",{binId,apiKey});
    const ok = await db.pull();
    setSyncOk(ok); setTesting(false);
    showToast(ok?"✅ Conexión exitosa — datos sincronizados":"❌ Error de conexión — verificá los datos");
  };

  // Crear bin automáticamente con la API key
  const crearBin = async () => {
    if(!apiKey){ showToast("❌ Primero ingresá la API Key (Master Key)"); return; }
    setCreating(true);
    const newId = await db.initBin(apiKey);
    setCreating(false);
    if(newId){ setBinId(newId); showToast("✅ Bin creado: "+newId); }
    else showToast("❌ No se pudo crear el bin — verificá la API Key");
  };

  const guardarSync = () => {
    db.set("syncCfg",{binId,apiKey});
    showToast("✅ Configuración de nube guardada");
  };

  const guardarAcceso = () => {
    if(opPin.length!==4||!/^\d{4}$/.test(opPin)){
      showToast("❌ PIN operador: exactamente 4 dígitos"); return;
    }
    if(adminPin.length!==4||!/^\d{4}$/.test(adminPin)){
      showToast("❌ PIN admin: exactamente 4 dígitos"); return;
    }
    if(opPin===adminPin){ showToast("❌ Los PINs no pueden ser iguales"); return; }
    db.set("settings",{opPin,adminPin,waPhone});
    db.push("settings",{opPin,adminPin,waPhone});
    showToast("✅ Claves y WhatsApp guardados");
  };

  return(
    <div>
      <div className="sec-title">⚙️ Configuración</div>

      {/* ── SINCRONIZACIÓN EN NUBE ── */}
      <div className="card">
        <div className="card-title">☁️ Sincronización entre dispositivos</div>

        {/* Estado actual */}
        <div style={{
          background: syncOk===true?"#0f2e13":syncOk===false?"#2e0808":"#111f14",
          border:`1px solid ${syncOk===true?"#1a4a20":syncOk===false?"#4a1a1a":"#1a3020"}`,
          borderRadius:12,padding:"10px 14px",marginBottom:14,
          display:"flex",alignItems:"center",gap:10}}>
          <div style={{fontSize:20}}>{syncOk===true?"🟢":syncOk===false?"🔴":"☁️"}</div>
          <div>
            <div style={{fontFamily:"Syne,sans-serif",fontWeight:700,fontSize:12,
              color:syncOk===true?"#9ef09a":syncOk===false?"#f56b6b":"#64b5f6"}}>
              {syncOk===true?"Conectado a la nube":syncOk===false?"Sin conexión":"Sin configurar"}
            </div>
            <div style={{fontSize:11,color:"#4a7090",marginTop:1}}>
              {binId?`Bin: ${binId}`:"Configurá JSONBin para ver datos de todos los dispositivos"}
            </div>
          </div>
        </div>

        {/* Guía paso a paso */}
        <div style={{background:"#0a1e3a",border:"1px solid #1e3d6a",borderRadius:12,
          padding:"12px 14px",marginBottom:14}}>
          <div style={{fontFamily:"Syne,sans-serif",fontWeight:700,fontSize:12,
            color:"#64b5f6",marginBottom:8}}>📋 Cómo configurar (gratis, 3 pasos)</div>
          {[
            ["1","Entrá a jsonbin.io y creá una cuenta gratuita"],
            ["2","En el panel, copiá tu Master Key (ícono de llave 🔑)"],
            ["3","Pegá la key abajo y tocá 'Crear Bin' — listo"],
          ].map(([n,t])=>(
            <div key={n} style={{display:"flex",gap:8,marginBottom:6,alignItems:"flex-start"}}>
              <span style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:13,
                color:"#1976d2",minWidth:18}}>{n}.</span>
              <span style={{fontSize:11,color:"#90b4d8",lineHeight:1.4}}>{t}</span>
            </div>
          ))}
        </div>

        <div className="frow">
          <label className="flbl">Master Key (API Key de JSONBin)</label>
          <input className="finput" type="password" placeholder="$2a$10$..."
            value={apiKey} onChange={e=>setApiKey(e.target.value)}/>
        </div>
        <div className="frow">
          <label className="flbl">Bin ID (se genera automáticamente)</label>
          <input className="finput" type="text" placeholder="Se completa al crear el bin"
            value={binId} onChange={e=>setBinId(e.target.value)}/>
        </div>

        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <button className="btn btn-blue btn-sm" style={{flex:1}}
            onClick={crearBin} disabled={creating}>
            {creating?"Creando…":"☁️ Crear Bin"}
          </button>
          <button className="btn btn-dim btn-sm" style={{flex:1}}
            onClick={testSync} disabled={testing}>
            {testing?"Probando…":"🔌 Probar conexión"}
          </button>
        </div>
        <button className="btn btn-green" onClick={guardarSync}>
          <Ico d={I.check} size={17}/>Guardar configuración de nube
        </button>

        {binId&&apiKey&&(
          <div style={{marginTop:10,background:"#0f2e13",border:"1px solid #1a4a20",
            borderRadius:10,padding:"10px 14px",fontSize:11,color:"#6ab870"}}>
            ✅ <b>Esta misma API Key y Bin ID</b> deben configurarse en todos los dispositivos 
            (el del operador y el del admin) para que los datos se sincronicen.
          </div>
        )}
      </div>

      {/* ── CLAVES DE ACCESO ── */}
      <div className="card">
        <div className="card-title">🔒 Claves de acceso (PIN 4 dígitos)</div>
        <div className="frow">
          <label className="flbl">🛒 PIN Operador {showPins?`(actual: ${stg.opPin})`:""}</label>
          <input className="finput" type={showPins?"text":"password"} maxLength={4}
            placeholder="4 dígitos" value={opPin}
            onChange={e=>setOpPin(e.target.value.replace(/\D/g,"").slice(0,4))}/>
        </div>
        <div className="frow">
          <label className="flbl">📊 PIN Administrador {showPins?`(actual: ${stg.adminPin})`:""}</label>
          <input className="finput" type={showPins?"text":"password"} maxLength={4}
            placeholder="4 dígitos" value={adminPin}
            onChange={e=>setAdminPin(e.target.value.replace(/\D/g,"").slice(0,4))}/>
        </div>
        <button className="btn btn-dim btn-sm" style={{width:"auto",marginBottom:12}}
          onClick={()=>setShowPins(s=>!s)}>
          {showPins?"🙈 Ocultar":"👁️ Ver PINs actuales"}
        </button>
      </div>

      {/* ── WHATSAPP ── */}
      <div className="card">
        <div className="card-title">📲 WhatsApp para reportes</div>
        <div style={{fontSize:11,color:"#4a7050",marginBottom:10}}>
          Número con código de país, sin + ni espacios.<br/>
          Ejemplo Argentina: <b style={{color:"#9ef09a"}}>5491123456789</b>
        </div>
        <div className="frow">
          <label className="flbl">Número de WhatsApp</label>
          <input className="finput" type="tel" placeholder="5491123456789"
            value={waPhone} onChange={e=>setWaPhone(e.target.value.replace(/\D/g,""))}/>
        </div>
        {waPhone&&<div style={{fontSize:11,color:"#4a7050",marginBottom:8}}>
          Reportes → wa.me/{waPhone}
        </div>}
      </div>

      <button className="btn btn-green" onClick={guardarAcceso}>
        <Ico d={I.check} size={17}/>Guardar PINs y WhatsApp
      </button>
    </div>
  );
}

function AdminDash({days,allSales,allMermas,products,loading}){
  const totals=useMemo(()=>{
    let ventas=0,costo=0,tx=0,mermaVal=0;
    days.forEach(d=>{
      (allSales[d]||[]).forEach(s=>{ventas+=s.total;tx++;const p=products.find(p=>p.id===s.productId);if(p)costo+=p.cost*s.qty;});
      (allMermas[d]||[]).forEach(m=>{const p=products.find(p=>p.id===m.productId);if(p)mermaVal+=p.cost*m.qty;});
    });
    return {ventas,ganancia:ventas-costo,margen:ventas>0?((ventas-costo)/ventas)*100:0,tx,tkt:tx>0?ventas/tx:0,mermaVal,dias:days.length};
  },[days,allSales,allMermas,products]);

  const last7=useMemo(()=>[...days].slice(-7).map(d=>({d,v:(allSales[d]||[]).reduce((a,s)=>a+s.total,0)})),[days,allSales]);
  const maxV=Math.max(...last7.map(x=>x.v),1);
  const todaySales=allSales[todayStr()]||[];
  const todayV=todaySales.reduce((a,s)=>a+s.total,0);

  if(loading) return <div className="empty"><p>Cargando datos…</p></div>;

  return(
    <div>
      <div className="sec-title">📈 Resumen general</div>
      <div className="stats-grid">
        <div className="stat"><div className="stat-lbl">Ventas totales</div><div className="stat-val" style={{fontSize:18}}>{fmtARS(totals.ventas)}</div><div className="stat-sub">{totals.dias} días registrados</div></div>
        <div className={`stat ${totals.margen>=30?"":totals.margen>=15?"warn":"bad"}`}><div className="stat-lbl">Ganancia total</div><div className="stat-val" style={{fontSize:18}}>{fmtARS(totals.ganancia)}</div><div className="stat-sub">Margen {fmtPct(totals.margen)}</div></div>
        <div className="stat"><div className="stat-lbl">Transacciones</div><div className="stat-val">{totals.tx}</div><div className="stat-sub">Ticket prom. {fmtARS(totals.tkt)}</div></div>
        <div className="stat bad"><div className="stat-lbl">Pérd. por merma</div><div className="stat-val" style={{fontSize:18}}>{fmtARS(totals.mermaVal)}</div><div className="stat-sub">total acumulado</div></div>
      </div>
      <div className="card">
        <div className="card-title">Hoy — {fmtDate(todayStr())}</div>
        <div style={{display:"flex",gap:10}}>
          <div className="stat" style={{flex:1}}><div className="stat-lbl">Ventas</div><div className="stat-val" style={{fontSize:18}}>{fmtARS(todayV)}</div></div>
          <div className="stat" style={{flex:1}}><div className="stat-lbl">Transacciones</div><div className="stat-val">{todaySales.length}</div></div>
        </div>
      </div>
      {last7.length>0&&(
        <div className="card">
          <div className="card-title">Ventas — últimos {last7.length} días</div>
          <div className="bar-wrap">
            {last7.map(({d,v})=>(
              <div key={d} className="bar-col">
                <div className="bar-val">{v>0?fmtARS(v).replace("$",""):"—"}</div>
                <div className="bar" style={{height:`${Math.max((v/maxV)*70,v>0?4:0)}px`}}/>
                <div className="bar-lbl">{fmtDate(d).slice(0,5)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="card">
        <div className="card-title">Cobros acumulados por método</div>
        {["efectivo","transferencia","tarjeta"].map(m=>{
          const v=Object.values(allSales).flat().filter(s=>s.pay===m).reduce((a,s)=>a+s.total,0);
          return <div key={m} className="line"><span className="line-k">{m==="efectivo"?"💵 Efectivo":m==="transferencia"?"📲 Transferencia":"💳 Tarjeta/QR"}</span><span className="line-v">{fmtARS(v)}</span></div>;
        })}
      </div>
    </div>
  );
}

function AdminHistory({days,allSales,allMermas,products,loading}){
  const [sel,setSel]=useState(null);
  if(loading) return <div className="empty"><p>Cargando…</p></div>;
  if(!days.length) return <div className="empty"><Ico d={I.cal} size={38}/><p>Sin días registrados aún</p></div>;

  if(sel){
    const s=allSales[sel]||[], m=allMermas[sel]||[];
    const v=s.reduce((a,x)=>a+x.total,0), co=s.reduce((a,x)=>{const p=products.find(p=>p.id===x.productId);return a+(p?p.cost*x.qty:0);},0);
    const g=v-co, mg=v>0?(g/v)*100:0;
    return(
      <div>
        <button className="btn btn-dim btn-sm" style={{width:"auto",marginBottom:12}} onClick={()=>setSel(null)}>← Volver</button>
        <div className="sec-title">📅 {fmtDate(sel)}</div>
        <div className="stats-grid">
          <div className="stat"><div className="stat-lbl">Ventas</div><div className="stat-val" style={{fontSize:18}}>{fmtARS(v)}</div><div className="stat-sub">{s.length} transacciones</div></div>
          <div className={`stat ${mg>=30?"":mg>=15?"warn":"bad"}`}><div className="stat-lbl">Ganancia</div><div className="stat-val" style={{fontSize:18}}>{fmtARS(g)}</div><div className="stat-sub">{fmtPct(mg)} margen</div></div>
        </div>
        <div className="card">
          <div className="card-title">Cobros</div>
          {["efectivo","transferencia","tarjeta"].map(pay=>{
            const lbl=pay==="efectivo"?"💵 Efectivo":pay==="transferencia"?"📲 Transfer":"💳 Tarjeta";
            const val=s.filter(x=>x.pay===pay).reduce((a,x)=>a+x.total,0);
            return <div key={pay} className="line"><span className="line-k">{lbl}</span><span className="line-v">{fmtARS(val)}</span></div>;
          })}
        </div>
        {s.length>0&&(
          <div className="card">
            <div className="card-title">Detalle de ventas</div>
            <table className="tbl">
              <thead><tr><th>Producto</th><th>Cant.</th><th className="right">Total</th></tr></thead>
              <tbody>{s.map(x=><tr key={x.id}><td>{x.name}</td><td>{x.qty}</td><td className="right bold">{fmtARS(x.total)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        {m.length>0&&(
          <div className="card">
            <div className="card-title">Mermas del día</div>
            {m.map(x=>{const p=products.find(p=>p.id===x.productId);return <div key={x.id} className="line"><span className="line-k">{p?.name}{x.nota?` (${x.nota})`:""}</span><span className="line-v neg">{x.qty} {p?.unit}</span></div>;})}
          </div>
        )}
      </div>
    );
  }

  return(
    <div>
      <div className="sec-title">📅 Historial de días</div>
      {[...days].reverse().map(d=>{
        const s=allSales[d]||[], v=s.reduce((a,x)=>a+x.total,0);
        const co=s.reduce((a,x)=>{const p=products.find(p=>p.id===x.productId);return a+(p?p.cost*x.qty:0);},0);
        const g=v-co, mg=v>0?(g/v)*100:0, isToday=d===todayStr();
        return(
          <div key={d} className="card" style={{cursor:"pointer",border:isToday?"1px solid #2a5a30":"1px solid #182c1c"}} onClick={()=>setSel(d)}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontFamily:"Syne,sans-serif",fontWeight:700,color:"#c0dcc2",fontSize:14}}>
                  {fmtDate(d)}{isToday&&<span className="tag-g" style={{marginLeft:6}}>Hoy</span>}
                </div>
                <div style={{fontSize:11,color:"#3d6045",marginTop:2}}>{s.length} transacciones</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:"Syne,sans-serif",fontWeight:800,color:"#9ef09a",fontSize:16}}>{fmtARS(v)}</div>
                <div style={{fontSize:11,color:mg>=30?"#6de067":mg>=15?"#f5c842":"#f56b6b"}}>{fmtPct(mg)} margen</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AdminProds({days,allSales,products,loading}){
  if(loading) return <div className="empty"><p>Cargando…</p></div>;
  const flat=Object.values(allSales).flat();
  const stats=products.map(p=>{
    const ps=flat.filter(s=>s.productId===p.id);
    const qty=ps.reduce((a,s)=>a+s.qty,0), total=ps.reduce((a,s)=>a+s.total,0);
    const costo=ps.reduce((a,s)=>a+p.cost*s.qty,0), gan=total-costo, mg=total>0?(gan/total)*100:0;
    return{...p,qty,total,gan,mg,cnt:ps.length};
  }).sort((a,b)=>b.total-a.total);

  return(
    <div>
      <div className="sec-title">📦 Ranking de productos</div>
      {stats.map((p,i)=>(
        <div key={p.id} className="card" style={{marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:18,color:"#2a5a30",minWidth:24}}>#{i+1}</span>
              <div>
                <div style={{fontFamily:"Syne,sans-serif",fontWeight:700,color:"#c0dcc2",fontSize:14}}>{p.name}</div>
                <div style={{fontSize:11,color:"#3d6045"}}>{p.cnt} ventas · {p.qty.toFixed(1)} {p.unit}</div>
              </div>
            </div>
            <span className={p.mg>=30?"tag-g":p.mg>=15?"tag-y":"tag-r"}>{p.mg.toFixed(0)}%</span>
          </div>
          <div style={{display:"flex",gap:8}}>
            <div style={{flex:1,background:"#111f14",borderRadius:10,padding:"8px 10px"}}><div style={{fontSize:10,color:"#3d6045"}}>VENTAS</div><div style={{fontFamily:"Syne,sans-serif",fontWeight:700,color:"#9ef09a",fontSize:14}}>{fmtARS(p.total)}</div></div>
            <div style={{flex:1,background:"#111f14",borderRadius:10,padding:"8px 10px"}}><div style={{fontSize:10,color:"#3d6045"}}>GANANCIA</div><div style={{fontFamily:"Syne,sans-serif",fontWeight:700,color:p.gan>=0?"#9ef09a":"#f56b6b",fontSize:14}}>{fmtARS(p.gan)}</div></div>
          </div>
        </div>
      ))}
      {!stats.filter(p=>p.total>0).length&&<div className="empty"><Ico d={I.pkg} size={38}/><p>Sin ventas registradas aún</p></div>}
    </div>
  );
}

function AdminMermas({days,allMermas,products,loading}){
  if(loading) return <div className="empty"><p>Cargando…</p></div>;
  const flat=Object.values(allMermas).flat();
  const totalVal=flat.reduce((a,m)=>{const p=products.find(p=>p.id===m.productId);return a+(p?p.cost*m.qty:0);},0);
  const byProd=products.map(p=>{
    const ms=flat.filter(m=>m.productId===p.id);
    return{...p,qty:ms.reduce((a,m)=>a+m.qty,0),val:ms.reduce((a,m)=>a+p.cost*m.qty,0),cnt:ms.length};
  }).filter(p=>p.qty>0).sort((a,b)=>b.val-a.val);

  return(
    <div>
      <div className="sec-title">🚨 Análisis de mermas</div>
      <div className="stats-grid">
        <div className="stat bad"><div className="stat-lbl">Pérdida total</div><div className="stat-val" style={{fontSize:18}}>{fmtARS(totalVal)}</div><div className="stat-sub">acumulado</div></div>
        <div className="stat warn"><div className="stat-lbl">Productos afect.</div><div className="stat-val">{byProd.length}</div><div className="stat-sub">con mermas</div></div>
      </div>
      {byProd.length>0?(
        <div className="card">
          <div className="card-title">Ranking de mermas</div>
          <table className="tbl">
            <thead><tr><th>Producto</th><th>Cantidad</th><th className="right">Pérdida</th></tr></thead>
            <tbody>{byProd.map(p=><tr key={p.id}><td>{p.name}</td><td>{p.qty.toFixed(1)} {p.unit}</td><td className="right bold">{fmtARS(p.val)}</td></tr>)}</tbody>
          </table>
        </div>
      ):<div className="empty"><Ico d={I.check} size={38}/><p>Sin mermas registradas</p></div>}
      {days.length>0&&(
        <div className="card">
          <div className="card-title">Mermas por día</div>
          {[...days].reverse().map(d=>{
            const m=allMermas[d]||[]; if(!m.length) return null;
            const val=m.reduce((a,x)=>{const p=products.find(p=>p.id===x.productId);return a+(p?p.cost*x.qty:0);},0);
            return <div key={d} className="line"><span className="line-k">{fmtDate(d)}</span><span className="line-v neg">{fmtARS(val)}</span></div>;
          })}
        </div>
      )}
    </div>
  );
}
