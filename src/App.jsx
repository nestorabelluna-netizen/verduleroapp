import { useState, useEffect, useCallback, useMemo } from "react";

// ─── CLOUD STORAGE ────────────────────────────────────────────────────────────
const CLOUD = "https://api.jsonbin.io/v3/b";
const db = {
  get(k)    { try{const v=localStorage.getItem(k);return v?JSON.parse(v):null;}catch{return null;} },
  set(k,v)  { try{localStorage.setItem(k,JSON.stringify(v));}catch{} },
  getCfg()  { return db.get("syncCfg")||{binId:"",apiKey:""}; },
  async push(key,val){
    const {binId,apiKey}=db.getCfg(); if(!binId||!apiKey) return;
    try{
      const r=await fetch(`${CLOUD}/${binId}/latest`,{headers:{"X-Master-Key":apiKey,"X-Bin-Meta":"false"}});
      const cur=r.ok?await r.json():{};
      cur[key]=val;
      await fetch(`${CLOUD}/${binId}`,{method:"PUT",headers:{"Content-Type":"application/json","X-Master-Key":apiKey},body:JSON.stringify(cur)});
    }catch(e){console.warn("push:",e);}
  },
  async pull(){
    const {binId,apiKey}=db.getCfg(); if(!binId||!apiKey) return false;
    try{
      const r=await fetch(`${CLOUD}/${binId}/latest`,{headers:{"X-Master-Key":apiKey,"X-Bin-Meta":"false"}});
      if(!r.ok) return false;
      const data=await r.json();
      Object.entries(data).forEach(([k,v])=>db.set(k,v));
      return true;
    }catch(e){console.warn("pull:",e);return false;}
  },
  async initBin(apiKey){
    try{
      const r=await fetch(CLOUD,{method:"POST",
        headers:{"Content-Type":"application/json","X-Master-Key":apiKey,"X-Bin-Name":"VerduleroApp"},
        body:JSON.stringify({_init:true})});
      if(!r.ok) return null;
      const d=await r.json(); return d.metadata?.id||null;
    }catch{return null;}
  }
};

// ─── USUARIOS POR DEFECTO ─────────────────────────────────────────────────────
const DEFAULT_USERS = [
  {id:"roxana_v",name:"Roxana", role:"vendor",pin:"1111",active:true, horaDesde:"08:00",horaHasta:"21:30",emoji:"🌸"},
  {id:"nestor_v",name:"Néstor", role:"vendor",pin:"2222",active:true, horaDesde:"08:00",horaHasta:"21:30",emoji:"⭐"},
  {id:"leyla_v", name:"Leyla",  role:"vendor",pin:"3333",active:true, horaDesde:"08:00",horaHasta:"21:30",emoji:"🌺"},
  {id:"morena_v",name:"Morena", role:"vendor",pin:"4444",active:true, horaDesde:"08:00",horaHasta:"21:30",emoji:"🌻"},
  {id:"roxana_a",name:"Roxana", role:"admin", pin:"1001",active:true, horaDesde:"00:00",horaHasta:"23:59",emoji:"👑"},
  {id:"nestor_a",name:"Néstor", role:"admin", pin:"1002",active:true, horaDesde:"00:00",horaHasta:"23:59",emoji:"👑"},
];

const DEFAULT_PRODUCTS = [
  {id:"1", name:"Tomate",   unit:"kg",  cost:800, price:1400,stock:20},
  {id:"2", name:"Papa",     unit:"kg",  cost:450, price:900, stock:50},
  {id:"3", name:"Cebolla",  unit:"kg",  cost:400, price:800, stock:40},
  {id:"4", name:"Zanahoria",unit:"kg",  cost:350, price:700, stock:30},
  {id:"5", name:"Lechuga",  unit:"unid",cost:600, price:1200,stock:15},
  {id:"6", name:"Zapallo",  unit:"kg",  cost:300, price:650, stock:25},
  {id:"7", name:"Manzana",  unit:"kg",  cost:900, price:1600,stock:20},
  {id:"8", name:"Banana",   unit:"kg",  cost:700, price:1300,stock:18},
  {id:"9", name:"Naranja",  unit:"kg",  cost:600, price:1100,stock:22},
  {id:"10",name:"Limón",    unit:"kg",  cost:550, price:1050,stock:15},
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const todayStr=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
const fmtARS =n=>"$"+Math.round(n||0).toLocaleString("es-AR");
const fmtPct =n=>(n||0).toFixed(1)+"%";
const fmtDate=s=>{const[y,m,d]=s.split("-");return `${d}/${m}/${y}`;};
const fmtHora=d=>d?d.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit",second:"2-digit"}):"—";
const salesKey =(uid,date)=>`${uid}_sales_${date}`;
const mermaKey =(uid,date)=>`${uid}_mermas_${date}`;
const daysKey  =uid=>`${uid}_days_index`;

const checkAccess=user=>{
  if(!user.active) return {ok:false,msg:"Usuario desactivado por el administrador"};
  if(user.role==="admin") return {ok:true};
  const now=new Date();
  const [h1,m1]=user.horaDesde.split(":").map(Number);
  const [h2,m2]=user.horaHasta.split(":").map(Number);
  const mins=now.getHours()*60+now.getMinutes();
  if(mins<h1*60+m1||mins>h2*60+m2)
    return {ok:false,msg:`Horario de acceso: ${user.horaDesde} a ${user.horaHasta}`};
  return {ok:true};
};

const getUsers   =()=>db.get("users")||DEFAULT_USERS;
const getSettings=()=>db.get("settings")||{waPhone:""};

// ─── ICON ─────────────────────────────────────────────────────────────────────
const Ico=({d,size=20})=>(
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d)?d.map((p,i)=><path key={i} d={p}/>):<path d={d}/>}
  </svg>
);
const I={
  home: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z",
  cart: ["M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z","M3 6h18","M16 10a4 4 0 01-8 0"],
  cash: ["M12 1v22","M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"],
  alert:["M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z","M12 9v4","M12 17h.01"],
  tag:  ["M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z","M7 7h.01"],
  chart:["M18 20V10","M12 20V4","M6 20v-6"],
  trend:"M23 6l-9.5 9.5-5-5L1 18",
  cal:  ["M8 2v4","M16 2v4","M3 10h18","M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"],
  users:["M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2","M23 21v-2a4 4 0 00-3-3.87","M16 3.13a4 4 0 010 7.75","M9 7a4 4 0 100 8 4 4 0 000-8z"],
  pkg:  ["M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z","M3.27 6.96L12 12.01l8.73-5.05","M12 22.08V12"],
  plus: ["M12 5v14","M5 12h14"],
  trash:["M3 6h18","M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"],
  check:"M20 6L9 17l-5-5",
  edit: ["M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7","M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"],
  logout:["M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4","M16 17l5-5-5-5","M21 12H9"],
  sync: ["M1 4v6h6","M23 20v-6h-6","M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15"],
  lock: ["M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z","M7 11V7a5 5 0 0110 0v4"],
  clock:["M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z","M12 6v6l4 2"],
  wa:   "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z",
  cfg:  ["M12 15a3 3 0 100-6 3 3 0 000 6z","M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"],
};

const PIN_LETTERS={"2":"ABC","3":"DEF","4":"GHI","5":"JKL","6":"MNO","7":"PQRS","8":"TUV","9":"WXYZ"};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App(){
  const [user,setUser]         = useState(null);
  const [products,setProducts] = useState([]);
  const [sales,setSales]       = useState([]);
  const [mermas,setMermas]     = useState([]);
  const [toast,setToast]       = useState(null);
  const [loaded,setLoaded]     = useState(false);

  useEffect(()=>{
    if(!user) return;
    (async()=>{
      await db.pull();
      setProducts(db.get("products")||DEFAULT_PRODUCTS);
      if(user.role==="vendor"){
        setSales(db.get(salesKey(user.id,todayStr()))||[]);
        setMermas(db.get(mermaKey(user.id,todayStr()))||[]);
      }
      setLoaded(true);
    })();
  },[user]);

  const saveProducts=useCallback(p=>{setProducts(p);db.set("products",p);db.push("products",p);},[]);

  const saveSales=useCallback((s,uid)=>{
    setSales(s);
    const k=salesKey(uid,todayStr());
    db.set(k,s);
    const idx=[...new Set([...(db.get(daysKey(uid))||[]),todayStr()])].sort();
    db.set(daysKey(uid),idx);
    db.push(k,s);
    db.push(daysKey(uid),idx);
  },[]);

  const saveMermas=useCallback((m,uid)=>{
    setMermas(m);
    const k=mermaKey(uid,todayStr());
    db.set(k,m); db.push(k,m);
  },[]);

  const syncAll=useCallback(async()=>{
    const ok=await db.pull();
    setProducts(db.get("products")||DEFAULT_PRODUCTS);
    if(user?.role==="vendor"){
      setSales(db.get(salesKey(user.id,todayStr()))||[]);
      setMermas(db.get(mermaKey(user.id,todayStr()))||[]);
    }
    return ok;
  },[user]);

  const showToast=useCallback(msg=>{setToast(msg);setTimeout(()=>setToast(null),2400);},[]);
  const doLogout=()=>{setUser(null);setLoaded(false);setSales([]);setMermas([]);};

  if(!user) return <LoginScreen onLogin={u=>{setUser(u);setLoaded(false);}}/>;

  if(!loaded) return(
    <div style={{height:"100vh",display:"flex",flexDirection:"column",alignItems:"center",
      justifyContent:"center",background:"#0a1a0d",gap:12}}>
      <div style={{fontSize:44}}>🥬</div>
      <div style={{fontSize:13,color:"#4a7050"}}>Sincronizando datos…</div>
    </div>
  );

  const totalVentas   = sales.reduce((a,s)=>a+s.total,0);
  const totalEfectivo = sales.filter(s=>s.pay==="efectivo").reduce((a,s)=>a+s.total,0);
  const totalTransf   = sales.filter(s=>s.pay==="transferencia").reduce((a,s)=>a+s.total,0);
  const totalTarjeta  = sales.filter(s=>s.pay==="tarjeta").reduce((a,s)=>a+s.total,0);
  const totalCosto    = sales.reduce((a,s)=>{const p=products.find(p=>p.id===s.productId);return a+(p?p.cost*s.qty:0);},0);
  const mermasCount   = mermas.reduce((a,m)=>a+m.qty,0);

  return user.role==="vendor"
    ? <VendorApp user={user} products={products} sales={sales} mermas={mermas}
        saveProducts={saveProducts}
        saveSales={s=>saveSales(s,user.id)}
        saveMermas={m=>saveMermas(m,user.id)}
        showToast={showToast} toast={toast}
        totalVentas={totalVentas} totalEfectivo={totalEfectivo}
        totalTransf={totalTransf} totalTarjeta={totalTarjeta}
        totalCosto={totalCosto} mermasCount={mermasCount}
        onLogout={doLogout}/>
    : <AdminApp user={user} products={products} saveProducts={saveProducts}
        syncAll={syncAll} showToast={showToast} toast={toast} onLogout={doLogout}/>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════════════════
function LoginScreen({onLogin}){
  const [sel,setSel]    = useState(null);
  const [pin,setPin]    = useState("");
  const [err,setErr]    = useState("");
  const [shake,setShake]= useState(false);
  const users   = getUsers();
  const vendors = users.filter(u=>u.role==="vendor");
  const admins  = users.filter(u=>u.role==="admin");

  const digit=d=>{
    if(pin.length>=4) return;
    const next=pin+d; setPin(next); setErr("");
    if(next.length===4){
      setTimeout(()=>{
        if(next!==sel.pin){setErr("PIN incorrecto");setShake(true);setTimeout(()=>setShake(false),400);setPin("");return;}
        const acc=checkAccess(sel);
        if(!acc.ok){setErr(acc.msg);setShake(true);setTimeout(()=>setShake(false),400);setPin("");return;}
        onLogin(sel);
      },150);
    }
  };

  const now=new Date();
  const timeStr=now.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
  const dateStr=now.toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"});

  return(
    <div className="login-root">
      <div className="login-version">v3.0 Pro</div>
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

      <div className="login-sheet">
        {!sel?(
          <>
            <div className="login-tap-hint">
              <div className="login-tap-hint-line"/>
              <div className="login-tap-hint-text">👇 Tocá tu nombre para ingresar</div>
              <div className="login-tap-hint-line"/>
            </div>
            <div style={{width:"100%",maxWidth:390,marginBottom:10}}>
              <div style={{fontSize:10,color:"rgba(158,240,154,.5)",textTransform:"uppercase",letterSpacing:1.5,fontWeight:700,marginBottom:8,textAlign:"center"}}>Vendedores</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {vendors.map(u=>(
                  <button key={u.id} onClick={()=>{if(u.active){setSel(u);setPin("");setErr("");}}}
                    style={{background:u.active?"linear-gradient(160deg,#1c4a22,#122e16)":"#141414",
                      border:`2px solid ${u.active?"#4caf50":"#2a2a2a"}`,borderRadius:16,padding:0,
                      cursor:u.active?"pointer":"not-allowed",overflow:"hidden",
                      boxShadow:u.active?"0 4px 16px rgba(76,175,80,.2)":"none",opacity:u.active?1:.5}}>
                    <div style={{background:"rgba(76,175,80,.15)",height:62,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>{u.emoji}</div>
                    <div style={{padding:"8px 10px 10px",textAlign:"left"}}>
                      <div style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:14,color:u.active?"#fff":"#555"}}>{u.name}</div>
                      <div style={{fontSize:10,color:u.active?"#a5c8a8":"#444",marginTop:3}}>{u.active?`${u.horaDesde} → ${u.horaHasta}`:"Desactivado"}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div style={{width:"100%",maxWidth:390}}>
              <div style={{fontSize:10,color:"rgba(100,181,246,.5)",textTransform:"uppercase",letterSpacing:1.5,fontWeight:700,marginBottom:8,textAlign:"center"}}>Administradores</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {admins.map(u=>(
                  <button key={u.id} onClick={()=>{setSel(u);setPin("");setErr("");}}
                    style={{background:"linear-gradient(160deg,#1a3060,#0f1e40)",border:"2px solid #1976d2",
                      borderRadius:16,padding:0,cursor:"pointer",overflow:"hidden",
                      boxShadow:"0 4px 16px rgba(25,118,210,.2)"}}>
                    <div style={{background:"rgba(25,118,210,.15)",height:62,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>{u.emoji}</div>
                    <div style={{padding:"8px 10px 10px",textAlign:"left"}}>
                      <div style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:14,color:"#fff"}}>{u.name}</div>
                      <div style={{fontSize:10,color:"#90b4d8",marginTop:3}}>Administrador</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div style={{marginTop:12,fontSize:11,color:"rgba(255,255,255,.2)",textAlign:"center"}}>🔒 Acceso protegido con PIN personal</div>
          </>
        ):(
          <div className="pin-panel">
            <div className={`pin-who ${sel.role==="admin"?"pin-who-adm":"pin-who-op"}`}>
              <div style={{width:42,height:42,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,background:"rgba(255,255,255,.1)"}}>{sel.emoji}</div>
              <div style={{flex:1}}>
                <div className="pin-who-name">{sel.name}</div>
                <div className="pin-who-sub">{sel.role==="admin"?"Administrador":"Vendedor"} · PIN de 4 dígitos</div>
              </div>
              <div className={`pin-who-dot ${sel.role==="admin"?"pin-who-dot-adm":"pin-who-dot-op"}`}/>
            </div>
            <div className="pin-instruction">Ingresá tu PIN personal</div>
            <div className="pin-dots-row">
              {[0,1,2,3].map(i=>(
                <div key={i} className={`pin-dot ${i<pin.length?(sel.role==="admin"?"filled-adm":"filled-op"):""}`}/>
              ))}
            </div>
            <div className="pin-grid">
              {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((d,i)=>(
                d===""?<div key={i}/>:
                <button key={i} className={`pin-btn ${sel.role==="admin"?"pin-btn-adm":"pin-btn-op"} ${d==="⌫"?"pin-btn-del":""}`}
                  onClick={()=>d==="⌫"?setPin(p=>p.slice(0,-1)):digit(d)}>
                  <span className="pin-btn-num">{d}</span>
                  {PIN_LETTERS[d]&&<span className="pin-btn-letters">{PIN_LETTERS[d]}</span>}
                </button>
              ))}
            </div>
            {err&&<div className="pin-error-box"><div className="pin-error-txt">❌ {err}</div></div>}
            <button className="pin-back" onClick={()=>{setSel(null);setPin("");setErr("");}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Elegir otro usuario
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VENDOR APP
// ═══════════════════════════════════════════════════════════════════════════════
function VendorApp({user,products,sales,mermas,saveProducts,saveSales,saveMermas,
  showToast,toast,totalVentas,totalEfectivo,totalTransf,totalTarjeta,totalCosto,mermasCount,onLogout}){
  const [tab,setTab]=useState("home");
  const tabs={
    home:   <VHome sales={sales} products={products} totalVentas={totalVentas} mermasCount={mermasCount} totalEfectivo={totalEfectivo} totalTransf={totalTransf} totalTarjeta={totalTarjeta}/>,
    ventas: <VVentas products={products} sales={sales} saveSales={saveSales} saveProducts={saveProducts} showToast={showToast}/>,
    caja:   <VCaja sales={sales} totalVentas={totalVentas} totalEfectivo={totalEfectivo} totalTransf={totalTransf} totalTarjeta={totalTarjeta} totalCosto={totalCosto} showToast={showToast} vendorName={user.name}/>,
    merma:  <VMerma products={products} mermas={mermas} saveMermas={saveMermas} showToast={showToast}/>,
    prods:  <VPrecios products={products} saveProducts={saveProducts} showToast={showToast}/>,
  };
  return(
    <div className="app">
      <header className="header">
        <div className="header-row">
          <div>
            <div className="header-title">{user.emoji} {user.name}</div>
            <div className="header-sub">{new Date().toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"})}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span className="mode-badge badge-op">Vendedor</span>
            <button className="logout-btn" onClick={onLogout}><Ico d={I.logout} size={18}/></button>
          </div>
        </div>
      </header>
      <main className="content fade">{tabs[tab]}</main>
      {toast&&<div className="toast">{toast}</div>}
      <nav className="nav">
        {[{id:"home",lbl:"Inicio",icon:I.home},{id:"ventas",lbl:"Ventas",icon:I.cart},
          {id:"caja",lbl:"Caja",icon:I.cash},{id:"merma",lbl:"Merma",icon:I.alert},
          {id:"prods",lbl:"Productos",icon:I.pkg}].map(t=>(
          <button key={t.id} className={`nav-btn ${tab===t.id?"active":""}`} onClick={()=>setTab(t.id)}>
            <Ico d={t.icon} size={20}/>{t.lbl}
          </button>
        ))}
      </nav>
    </div>
  );
}

function VHome({sales,totalVentas,mermasCount,totalEfectivo,totalTransf,totalTarjeta}){
  const cnt=sales.length;
  return(
    <div>
      <div className="sec-title">📊 Mi resumen de hoy</div>
      <div className="stats-grid">
        <div className="stat"><div className="stat-lbl">Mis ventas</div><div className="stat-val">{fmtARS(totalVentas)}</div><div className="stat-sub">{cnt} transacciones</div></div>
        <div className={`stat${mermasCount>5?" bad":mermasCount>2?" warn":""}`}><div className="stat-lbl">Merma hoy</div><div className="stat-val">{mermasCount}</div><div className="stat-sub">kg / unidades</div></div>
      </div>
      <div className="card">
        <div className="card-title">Cobros por método</div>
        {[["💵 Efectivo",totalEfectivo],["📲 Transferencia",totalTransf],["💳 Tarjeta/QR",totalTarjeta]].map(([l,v])=>(
          <div key={l} className="line"><span className="line-k">{l}</span><span className="line-v">{fmtARS(v)}</span></div>
        ))}
      </div>
      {!sales.length&&<div className="empty"><Ico d={I.cart} size={38}/><p>Sin ventas aún hoy</p></div>}
    </div>
  );
}

function VVentas({products,sales,saveSales,saveProducts,showToast}){
  const [cart,setCart]     = useState({});
  const [pay,setPay]       = useState("efectivo");
  const [hist,setHist]     = useState(false);
  const [selP,setSelP]     = useState(null);
  const [monto,setMonto]   = useState("");

  const items=Object.entries(cart).filter(([,q])=>q>0);
  const total=items.reduce((a,[pid,qty])=>{const p=products.find(p=>p.id===pid);return a+(p?p.price*qty:0);},0);
  const pesoCalc=selP&&monto?(parseFloat(monto)||0)/selP.price:0;

  const confirmar=()=>{
    if(!pesoCalc||!selP) return;
    setCart(c=>({...c,[selP.id]:parseFloat(((c[selP.id]||0)+pesoCalc).toFixed(4))}));
    setSelP(null); setMonto("");
  };

  const confirm=()=>{
    if(!items.length) return;
    const ns=items.map(([pid,qty])=>{
      const p=products.find(p=>p.id===pid);
      return {id:Date.now()+Math.random(),productId:pid,name:p.name,qty,price:p.price,
        total:p.price*qty,pay,time:new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})};
    });
    saveSales([...sales,...ns]);
    saveProducts(products.map(p=>{const v=cart[p.id];if(!v) return p;return {...p,stock:Math.max(0,parseFloat((p.stock-v).toFixed(4)))};}));
    setCart({}); showToast(`✅ Venta registrada — ${fmtARS(total)}`);
  };

  return(
    <div>
      <div className="sec-title">🛒 Registrar venta</div>
      <div style={{background:"#0f2e13",border:"1px solid #1a4a20",borderRadius:12,padding:"10px 14px",marginBottom:12,fontSize:12,color:"#6ab870"}}>
        📦 Tocá el producto → ingresá el <b>monto $</b> de la balanza → calcula el peso automáticamente
      </div>
      <div className="card">
        <div className="card-title">Seleccioná el producto</div>
        <div className="prod-grid">
          {products.filter(p=>p.price>0).map(p=>(
            <button key={p.id} className={`prod-btn ${cart[p.id]?"sel":""}`} onClick={()=>{setSelP(p);setMonto("");}}>
              {cart[p.id]>0&&<div className="prod-badge">{parseFloat(cart[p.id]).toFixed(2)}</div>}
              <div className="prod-nm">{p.name}</div>
              <div className="prod-pr">{fmtARS(p.price)}</div>
              <div className="prod-un">/{p.unit}</div>
              {p.stock<=0&&<div style={{fontSize:9,color:"#f56b6b",marginTop:2}}>Sin stock</div>}
            </button>
          ))}
        </div>
      </div>

      {items.length>0&&(
        <div className="card">
          <div className="card-title">Carrito</div>
          {items.map(([pid,qty])=>{
            const p=products.find(p=>p.id===pid);
            return(
              <div key={pid} className="cart-row">
                <div style={{flex:1}}>
                  <div className="cart-nm">{p.name}</div>
                  <div style={{fontSize:11,color:"#4a7050"}}>{qty.toFixed(3)} {p.unit} × {fmtARS(p.price)}</div>
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <div className="cart-tot">{fmtARS(p.price*qty)}</div>
                  <button className="btn btn-dim btn-sm btn-ico" onClick={()=>{setSelP(p);setMonto((p.price*qty).toString());}}><Ico d={I.edit} size={13}/></button>
                  <button className="btn btn-red btn-sm btn-ico" onClick={()=>{const c={...cart};delete c[pid];setCart(c);}}><Ico d={I.trash} size={13}/></button>
                </div>
              </div>
            );
          })}
          <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0 4px",borderTop:"1px solid #1e3522",marginTop:4}}>
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
          <button className="btn btn-green" onClick={confirm}><Ico d={I.check} size={17}/>Confirmar venta</button>
        </div>
      )}

      <button className="btn btn-dim" style={{marginTop:4}} onClick={()=>setHist(true)}>Ver mis ventas del día ({sales.length})</button>

      {selP&&(
        <div className="overlay" onClick={()=>setSelP(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{background:"#111f14",border:"1px solid #1a3020",borderRadius:14,padding:"14px 16px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:18,color:"#9ef09a"}}>{selP.name}</div>
                <div style={{fontSize:12,color:"#4a7050",marginTop:2}}>Precio: {fmtARS(selP.price)}/{selP.unit}</div>
              </div>
              <div style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:22,color:"#f5e842"}}>{fmtARS(selP.price)}</div>
            </div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.5)",textAlign:"center",marginBottom:14}}>
              Ingresá el <b style={{color:"#9ef09a"}}>monto $</b> que cobró la balanza
            </div>
            <div style={{background:"#060e07",border:"2px solid #1e3522",borderRadius:16,padding:"14px 16px",marginBottom:14,textAlign:"center"}}>
              <div style={{fontSize:10,color:"#4a7050",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Monto cobrado</div>
              <div style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:36,color:monto?"#f5e842":"rgba(255,255,255,.2)"}}>
                {monto?"$"+parseInt(monto||0).toLocaleString("es-AR"):"$0"}
              </div>
              {monto&&(
                <>
                  <div style={{fontSize:16,color:"#4a7050",margin:"6px 0"}}>↓</div>
                  <div style={{background:"#0f2e13",border:"1px solid #1a4a20",borderRadius:12,padding:"10px 14px"}}>
                    <div style={{fontSize:10,color:"#4a7050",textTransform:"uppercase",marginBottom:4}}>Peso calculado</div>
                    <div style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:26,color:"#9ef09a"}}>{pesoCalc.toFixed(3)} {selP.unit}</div>
                    <div style={{fontSize:10,color:"#4a7050",marginTop:2}}>{fmtARS(monto)} ÷ {fmtARS(selP.price)} = {pesoCalc.toFixed(3)} {selP.unit}</div>
                  </div>
                </>
              )}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
              {["1","2","3","4","5","6","7","8","9","000","0","⌫"].map((d,i)=>(
                <button key={i} style={{background:"rgba(255,255,255,.07)",border:"1.5px solid rgba(255,255,255,.12)",borderRadius:14,height:56,fontFamily:"Syne,sans-serif",fontSize:d==="000"?14:20,fontWeight:700,color:"#fff",cursor:"pointer"}}
                  onClick={()=>{if(d==="⌫")setMonto(p=>p.slice(0,-1));else if(d==="000")setMonto(p=>p?(p+"000"):"");else setMonto(p=>p.length>=8?p:p+d);}}>
                  {d}
                </button>
              ))}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn btn-dim" onClick={()=>setSelP(null)}>Cancelar</button>
              <button className="btn btn-green" style={{opacity:pesoCalc>0?1:.35}} onClick={confirmar}><Ico d={I.check} size={17}/>Agregar al carrito</button>
            </div>
          </div>
        </div>
      )}

      {hist&&(
        <div className="overlay" onClick={()=>setHist(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">Mis ventas de hoy</div>
            {!sales.length?<div className="empty"><p>Sin ventas</p></div>
              :[...sales].reverse().map(s=>(
                <div key={s.id} style={{padding:"9px 0",borderBottom:"1px solid #182c1c"}}>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontSize:14,color:"#c0dcc2"}}>{s.name} — {parseFloat(s.qty).toFixed(3)} {products.find(p=>p.id===s.productId)?.unit||""}</span>
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

function VCaja({sales,totalVentas,totalEfectivo,totalTransf,totalTarjeta,totalCosto,showToast,vendorName}){
  const [gastos,setGastos]=useState(""); const [notaG,setNotaG]=useState(""); const [efFis,setEfFis]=useState("");
  const gastN=parseFloat(gastos)||0, efN=parseFloat(efFis)||0;
  const ganancia=totalVentas-totalCosto-gastN, diff=efN-totalEfectivo, cnt=sales.length, tkt=cnt>0?totalVentas/cnt:0;
  const sendWA=()=>{
    const cfg=getSettings(), phone=cfg.waPhone||"";
    const fecha=new Date().toLocaleDateString("es-AR",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
    const txt=encodeURIComponent(`🥬 *CIERRE DE CAJA — ${vendorName}*\n📅 ${fecha}\n\n`+
      `💰 *Ventas totales:* ${fmtARS(totalVentas)}\n`+
      `   💵 Efectivo: ${fmtARS(totalEfectivo)}\n   📲 Transferencia: ${fmtARS(totalTransf)}\n   💳 Tarjeta: ${fmtARS(totalTarjeta)}\n\n`+
      `📦 Costo mercadería: ${fmtARS(totalCosto)}\n`+
      (gastN?`🔧 Gastos: ${fmtARS(gastN)}${notaG?` (${notaG})`:""}\n`:"")+
      `\n✅ *Resultado: ${fmtARS(ganancia)}*\n🧾 Transacciones: ${cnt}\n💵 Ticket prom.: ${fmtARS(tkt)}\n`+
      (efFis?`\n🔎 Efectivo físico: ${fmtARS(efN)} (${diff>=0?"+":""}${fmtARS(diff)})\n`:"")+
      `_VerduleroApp Pro_`);
    window.open(phone?`https://wa.me/${phone}?text=${txt}`:`https://wa.me/?text=${txt}`,"_blank");
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
        <div className="card-title">Gastos del día</div>
        <div className="frow"><label className="flbl">Otros gastos</label>
          <div className="fgroup">
            <input className="finput" type="number" placeholder="$ importe" value={gastos} onChange={e=>setGastos(e.target.value)}/>
            <input className="finput" type="text" placeholder="Detalle" value={notaG} onChange={e=>setNotaG(e.target.value)}/>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-title">Resultado</div>
        <div className="caja-big" style={{color:ganancia>=0?"#9ef09a":"#f56b6b"}}>{fmtARS(ganancia)}</div>
        <div className="line"><span className="line-k">🧾 Transacciones</span><span className="line-v">{cnt}</span></div>
        <div className="line"><span className="line-k">💵 Ticket promedio</span><span className="line-v">{fmtARS(tkt)}</span></div>
      </div>
      <div className="card">
        <div className="card-title">Arqueo de efectivo</div>
        <div className="frow"><label className="flbl">Efectivo físico contado</label>
          <input className="finput" type="number" placeholder="$" value={efFis} onChange={e=>setEfFis(e.target.value)}/>
        </div>
        {efFis&&<div className="line"><span className="line-k">Diferencia</span><span className={`line-v ${diff>=0?"":"neg"}`}>{diff>=0?"+":""}{fmtARS(diff)}</span></div>}
      </div>
      <button className="btn btn-wa" onClick={sendWA}><Ico d={I.wa} size={19}/>Enviar resumen por WhatsApp</button>
    </div>
  );
}

function VMerma({products,mermas,saveMermas,showToast}){
  const [sel,setSel]=useState(""); const [qty,setQty]=useState(""); const [nota,setNota]=useState("");
  const byProd=mermas.reduce((a,m)=>{a[m.productId]=(a[m.productId]||0)+m.qty;return a;},{});
  const totalVal=mermas.reduce((a,m)=>{const p=products.find(p=>p.id===m.productId);return a+(p?p.cost*m.qty:0);},0);
  const st=pid=>{const q=byProd[pid]||0,p=products.find(p=>p.id===pid);if(!p)return"g";const pct=(q/p.stock)*100;return pct>=20?"r":pct>=10?"y":"g";};
  const add=()=>{
    if(!sel||!qty) return;
    saveMermas([...mermas,{id:Date.now(),productId:sel,qty:parseFloat(qty),nota,time:new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})}]);
    setQty(""); setNota(""); showToast("🚨 Merma registrada");
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
        <div className="card"><div className="card-title">Semáforo</div>
          {products.filter(p=>byProd[p.id]>0).map(p=>(
            <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 0",borderBottom:"1px solid #182c1c"}}>
              <div style={{flex:1}}><div style={{fontSize:14,color:"#c0dcc2",fontWeight:500}}>{p.name}</div><div style={{fontSize:11,color:"#3d6045"}}>{byProd[p.id]?.toFixed(1)} {p.unit}</div></div>
              <span className={`tag-${st(p.id)}`}>{st(p.id)==="g"?"🟢 Bajo":st(p.id)==="y"?"🟡 Medio":"🔴 Alto"}</span>
            </div>
          ))}
        </div>
      )}
      {!mermas.length&&<div className="empty"><Ico d={I.check} size={38}/><p>Sin mermas hoy 🎉</p></div>}
    </div>
  );
}

function VPrecios({products,saveProducts,showToast}){
  const [addM,setAddM]=useState(false);
  const [nm,setNm]=useState(""); const [un,setUn]=useState("kg"); const [st,setSt]=useState("");
  const addProd=()=>{
    if(!nm) return;
    saveProducts([...products,{id:Date.now().toString(),name:nm,unit:un,cost:0,price:0,stock:parseFloat(st)||10,minStock:3}]);
    setAddM(false); setNm(""); setUn("kg"); setSt(""); showToast("✅ Producto agregado");
  };
  return(
    <div>
      <div className="sec-title">📦 Productos</div>
      <div style={{background:"#1a2d4a",border:"1px solid #1e3d6a",borderRadius:14,padding:"12px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:20}}>🔒</span>
        <div><div style={{fontFamily:"Syne,sans-serif",fontWeight:700,fontSize:12,color:"#64b5f6"}}>Permisos limitados</div>
          <div style={{fontSize:11,color:"#4a7090",marginTop:2}}>Los precios y costos los carga el Administrador</div></div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div className="sec-title" style={{margin:0}}>Lista ({products.length})</div>
        <button className="btn btn-green btn-sm" style={{width:"auto"}} onClick={()=>{setAddM(true);setNm("");setUn("kg");setSt("");}}>
          <Ico d={I.plus} size={13}/>Agregar
        </button>
      </div>
      <div className="card" style={{padding:"6px 14px"}}>
        {products.map(p=>(
          <div key={p.id} style={{display:"flex",alignItems:"center",padding:"10px 0",borderBottom:"1px solid #182c1c",gap:8}}>
            <div style={{flex:1}}><div style={{fontSize:13,color:"#c0dcc2",fontWeight:500}}>{p.name}</div>
              <div style={{fontSize:11,color:"#3d6045"}}>Stock: {p.stock} {p.unit} · {fmtARS(p.price)}/{p.unit}</div></div>
            <span className="tag-b">{p.unit}</span>
          </div>
        ))}
      </div>
      {addM&&(
        <div className="overlay" onClick={()=>setAddM(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">➕ Nuevo producto</div>
            <div style={{fontSize:11,color:"#4a7050",marginBottom:14,background:"#111f14",padding:"8px 12px",borderRadius:10}}>El Administrador completará el costo y precio.</div>
            <div className="frow"><label className="flbl">Nombre</label><input className="finput" type="text" placeholder="ej: Acelga" value={nm} onChange={e=>setNm(e.target.value)}/></div>
            <div className="frow"><label className="flbl">Unidad</label>
              <select className="finput" value={un} onChange={e=>setUn(e.target.value)}>{["kg","unid","atado","docena"].map(u=><option key={u} value={u}>{u}</option>)}</select>
            </div>
            <div className="frow"><label className="flbl">Stock inicial</label><input className="finput" type="number" placeholder="20" value={st} onChange={e=>setSt(e.target.value)}/></div>
            <div style={{display:"flex",gap:8}}><button className="btn btn-dim" onClick={()=>setAddM(false)}>Cancelar</button><button className="btn btn-green" onClick={addProd}>Agregar</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN APP
// ═══════════════════════════════════════════════════════════════════════════════
function AdminApp({user,products,saveProducts,syncAll,showToast,toast,onLogout}){
  const [tab,setTab]         = useState("dash");
  const [allData,setAllData] = useState({});
  const [loading,setLoading] = useState(true);
  const [lastSync,setLastSync]= useState(null);
  const [syncing,setSyncing] = useState(false);
  const vendors=useMemo(()=>getUsers().filter(u=>u.role==="vendor"),[]);

  const load=useCallback(async(silent=false)=>{
    if(!silent) setLoading(true);
    setSyncing(true);
    const ok=await syncAll();
    const data={};
    vendors.forEach(v=>{
      const idx=db.get(daysKey(v.id))||[];
      const allDays=[...new Set([...idx,todayStr()])].sort();
      const sv={},mv={};
      allDays.forEach(d=>{sv[d]=db.get(salesKey(v.id,d))||[];mv[d]=db.get(mermaKey(v.id,d))||[];});
      data[v.id]={days:allDays,sales:sv,mermas:mv,user:v};
    });
    setAllData(data);
    if(!silent) setLoading(false);
    setSyncing(false);
    if(ok) setLastSync(new Date());
    return ok;
  },[syncAll,vendors]);

  useEffect(()=>{load(false);},[load]);

  useEffect(()=>{
    const cfg=db.getCfg(); if(!cfg.binId||!cfg.apiKey) return;
    const iv=setInterval(()=>load(true),20000);
    return ()=>clearInterval(iv);
  },[load]);

  const refresh=async()=>{const ok=await load(false);showToast(ok?"✅ Sincronizado con la nube":"⚠️ Configurá JSONBin en ⚙️ Config");};

  const tabs={
    dash:    <ADash    allData={allData} products={products} vendors={vendors} loading={loading}/>,
    vend:    <AVend    allData={allData} products={products} vendors={vendors} loading={loading}/>,
    rep:     <ARep     allData={allData} products={products} vendors={vendors} loading={loading}/>,
    precios: <APrecios products={products} saveProducts={saveProducts} showToast={showToast}/>,
    config:  <AConfig  showToast={showToast}/>,
  };

  return(
    <div className="app">
      <header className="header">
        <div className="header-row">
          <div>
            <div className="header-title">{user.emoji} Admin · {user.name}</div>
            <div style={{display:"flex",alignItems:"center",gap:5,marginTop:2}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:lastSync?"#4caf50":"#f5c842",boxShadow:lastSync?"0 0 6px #4caf50":"0 0 6px #f5c842",animation:"blink 2s ease-in-out infinite"}}/>
              <div style={{fontSize:9,color:lastSync?"#4a7050":"#6a6030"}}>{lastSync?`Sync: ${fmtHora(lastSync)}`:"Sin sync"}</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button className="btn btn-blue btn-sm" style={{width:"auto",padding:"6px 12px",gap:5,opacity:syncing?.7:1}} onClick={refresh} disabled={syncing}>
              <Ico d={I.sync} size={13}/><span style={{fontSize:11}}>{syncing?"…":"Sync"}</span>
            </button>
            <span className="mode-badge badge-admin">Admin</span>
            <button className="logout-btn" onClick={onLogout}><Ico d={I.logout} size={18}/></button>
          </div>
        </div>
      </header>
      <main className="content fade">{tabs[tab]}</main>
      {toast&&<div className="toast">{toast}</div>}
      <nav className="nav">
        {[{id:"dash",lbl:"Hoy",icon:I.chart},{id:"vend",lbl:"Vendedores",icon:I.users},
          {id:"rep",lbl:"Reportes",icon:I.trend},{id:"precios",lbl:"Precios",icon:I.tag},
          {id:"config",lbl:"Config",icon:I.cfg}].map(t=>(
          <button key={t.id} className={`nav-btn ${tab===t.id?"active":""}`} onClick={()=>setTab(t.id)}>
            <Ico d={t.icon} size={20}/>{t.lbl}
          </button>
        ))}
      </nav>
    </div>
  );
}

function ADash({allData,products,vendors,loading}){
  const hoyData=useMemo(()=>{
    let v=0,tx=0,costo=0;
    const porV={};
    vendors.forEach(vnd=>{
      const sv=(allData[vnd.id]?.sales[todayStr()])||[];
      let vv=0;
      sv.forEach(s=>{v+=s.total;tx++;vv+=s.total;const p=products.find(p=>p.id===s.productId);if(p)costo+=p.cost*s.qty;});
      porV[vnd.id]={name:vnd.name,emoji:vnd.emoji,v:vv,cnt:sv.length};
    });
    return {v,tx,ganancia:v-costo,margen:v>0?((v-costo)/v)*100:0,porV};
  },[allData,products,vendors]);

  const totalAcum=useMemo(()=>{
    let v=0,costo=0,tx=0,mermaVal=0;
    Object.values(allData).forEach(({days,sales,mermas})=>{
      days.forEach(d=>{
        (sales[d]||[]).forEach(s=>{v+=s.total;tx++;const p=products.find(p=>p.id===s.productId);if(p)costo+=p.cost*s.qty;});
        (mermas[d]||[]).forEach(m=>{const p=products.find(p=>p.id===m.productId);if(p)mermaVal+=p.cost*m.qty;});
      });
    });
    return {v,ganancia:v-costo,margen:v>0?((v-costo)/v)*100:0,tx,mermaVal};
  },[allData,products]);

  if(loading) return <div className="empty"><p>Cargando…</p></div>;
  return(
    <div>
      <div className="sec-title">📊 Hoy — todos los vendedores</div>
      <div className="stats-grid">
        <div className="stat"><div className="stat-lbl">Ventas hoy</div><div className="stat-val" style={{fontSize:19}}>{fmtARS(hoyData.v)}</div><div className="stat-sub">{hoyData.tx} transacciones</div></div>
        <div className={`stat ${hoyData.margen>=30?"":hoyData.margen>=15?"warn":"bad"}`}><div className="stat-lbl">Ganancia hoy</div><div className="stat-val" style={{fontSize:19}}>{fmtARS(hoyData.ganancia)}</div><div className="stat-sub">{fmtPct(hoyData.margen)} margen</div></div>
        <div className="stat"><div className="stat-lbl">Ventas acumuladas</div><div className="stat-val" style={{fontSize:17}}>{fmtARS(totalAcum.v)}</div><div className="stat-sub">{totalAcum.tx} trans. totales</div></div>
        <div className="stat bad"><div className="stat-lbl">Pérdida merma</div><div className="stat-val" style={{fontSize:17}}>{fmtARS(totalAcum.mermaVal)}</div><div className="stat-sub">acumulado</div></div>
      </div>
      <div className="card">
        <div className="card-title">Ventas de hoy por vendedor</div>
        {Object.values(hoyData.porV).map(v=>(
          <div key={v.name} className="line">
            <span className="line-k">{v.emoji} {v.name}</span>
            <div style={{textAlign:"right"}}><span className="line-v">{fmtARS(v.v)}</span><div style={{fontSize:10,color:"#4a7050"}}>{v.cnt} ventas</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AVend({allData,products,vendors,loading}){
  const [selV,setSelV]=useState(null);
  const [selDay,setSelDay]=useState(null);
  if(loading) return <div className="empty"><p>Cargando…</p></div>;

  if(!selV){
    return(
      <div>
        <div className="sec-title">👥 Ver por vendedor</div>
        {vendors.map(v=>{
          const data=allData[v.id]||{days:[],sales:{},mermas:{}};
          const hoyV=(data.sales[todayStr()]||[]).reduce((a,s)=>a+s.total,0);
          const totalV=Object.values(data.sales).flat().reduce((a,s)=>a+s.total,0);
          return(
            <div key={v.id} className="card" style={{cursor:"pointer"}} onClick={()=>{setSelV(v);setSelDay(null);}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:48,height:48,borderRadius:14,background:"rgba(76,175,80,.15)",border:"1px solid rgba(76,175,80,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>{v.emoji}</div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:15,color:"#c0dcc2"}}>{v.name}</div>
                  <div style={{fontSize:11,color:"#3d6045",marginTop:2}}>Hoy: {fmtARS(hoyV)} · Total: {fmtARS(totalV)}</div>
                </div>
                <div style={{fontSize:11,color:"#4a7050"}}>{data.days.filter(d=>(data.sales[d]||[]).length>0).length} días</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const data=allData[selV.id]||{days:[],sales:{},mermas:{}};

  if(selDay){
    const sv=data.sales[selDay]||[], mv=data.mermas[selDay]||[];
    const vT=sv.reduce((a,s)=>a+s.total,0);
    const co=sv.reduce((a,s)=>{const p=products.find(p=>p.id===s.productId);return a+(p?p.cost*s.qty:0);},0);
    return(
      <div>
        <button className="btn btn-dim btn-sm" style={{width:"auto",marginBottom:12}} onClick={()=>setSelDay(null)}>← Volver</button>
        <div className="sec-title">{selV.emoji} {selV.name} · {fmtDate(selDay)}</div>
        <div className="stats-grid">
          <div className="stat"><div className="stat-lbl">Ventas</div><div className="stat-val" style={{fontSize:18}}>{fmtARS(vT)}</div><div className="stat-sub">{sv.length} transacciones</div></div>
          <div className="stat"><div className="stat-lbl">Resultado</div><div className="stat-val" style={{fontSize:18}}>{fmtARS(vT-co)}</div></div>
        </div>
        {sv.length>0&&(
          <div className="card">
            <div className="card-title">Detalle de ventas</div>
            <table className="tbl">
              <thead><tr><th>Producto</th><th>Cant.</th><th>Pago</th><th className="right">Total</th></tr></thead>
              <tbody>{sv.map(s=><tr key={s.id}><td>{s.name}</td><td>{parseFloat(s.qty).toFixed(3)}</td><td style={{fontSize:11}}>{s.pay}</td><td className="right bold">{fmtARS(s.total)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        {mv.length>0&&(
          <div className="card">
            <div className="card-title">Mermas del día</div>
            {mv.map(m=>{const p=products.find(p=>p.id===m.productId);return <div key={m.id} className="line"><span className="line-k">{p?.name}{m.nota?` (${m.nota})`:""}</span><span className="line-v neg">{m.qty} {p?.unit}</span></div>;})}
          </div>
        )}
      </div>
    );
  }

  return(
    <div>
      <button className="btn btn-dim btn-sm" style={{width:"auto",marginBottom:12}} onClick={()=>setSelV(null)}>← Todos los vendedores</button>
      <div className="sec-title">{selV.emoji} {selV.name} — Historial</div>
      {[...data.days].reverse().map(d=>{
        const sv=data.sales[d]||[], v=sv.reduce((a,s)=>a+s.total,0);
        const isToday=d===todayStr();
        return(
          <div key={d} className="card" style={{cursor:"pointer",border:isToday?"1px solid #2a5a30":"1px solid #182c1c"}} onClick={()=>setSelDay(d)}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontFamily:"Syne,sans-serif",fontWeight:700,color:"#c0dcc2",fontSize:14}}>{fmtDate(d)}{isToday&&<span className="tag-g" style={{marginLeft:6}}>Hoy</span>}</div>
                <div style={{fontSize:11,color:"#3d6045",marginTop:2}}>{sv.length} transacciones</div>
              </div>
              <div style={{fontFamily:"Syne,sans-serif",fontWeight:800,color:"#9ef09a",fontSize:16}}>{fmtARS(v)}</div>
            </div>
          </div>
        );
      })}
      {!data.days.filter(d=>(data.sales[d]||[]).length>0).length&&<div className="empty"><p>Sin datos para {selV.name}</p></div>}
    </div>
  );
}

function ARep({allData,products,vendors,loading}){
  const [periodo,setPeriodo]=useState("semana");
  const hoy=new Date();
  const ranges=useMemo(()=>{
    const fmt=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const semD=new Date(hoy); semD.setDate(hoy.getDate()-6);
    const mesD=new Date(hoy.getFullYear(),hoy.getMonth(),1);
    return {semDesde:fmt(semD),semHasta:fmt(hoy),mesDesde:fmt(mesD),mesHasta:fmt(hoy)};
  },[]);

  const desde=periodo==="semana"?ranges.semDesde:ranges.mesDesde;
  const hasta=periodo==="semana"?ranges.semHasta:ranges.mesHasta;

  const stats=useMemo(()=>{
    let ventas=0,costo=0,tx=0,mermaVal=0;
    const porDia={},porProd={},porPago={efectivo:0,transferencia:0,tarjeta:0},porV={};
    Object.values(allData).forEach(({days,sales,mermas,user:v})=>{
      let vv=0;
      days.filter(d=>d>=desde&&d<=hasta).forEach(d=>{
        (sales[d]||[]).forEach(s=>{
          ventas+=s.total;tx++;vv+=s.total;
          porPago[s.pay]=(porPago[s.pay]||0)+s.total;
          porDia[d]=(porDia[d]||0)+s.total;
          const p=products.find(p=>p.id===s.productId);if(p)costo+=p.cost*s.qty;
          if(!porProd[s.productId])porProd[s.productId]={name:s.name,total:0};
          porProd[s.productId].total+=s.total;
        });
        (mermas[d]||[]).forEach(m=>{const p=products.find(p=>p.id===m.productId);if(p)mermaVal+=p.cost*m.qty;});
      });
      porV[v.id]={name:v.name,emoji:v.emoji,ventas:vv};
    });
    const ganancia=ventas-costo,dias=Object.keys(porDia).length;
    return {ventas,ganancia,margen:ventas>0?(ganancia/ventas)*100:0,tx,mermaVal,costo,
      diasActivos:dias,promDia:dias>0?ventas/dias:0,
      topProds:Object.values(porProd).sort((a,b)=>b.total-a.total).slice(0,5),
      mejorDia:Object.entries(porDia).sort((a,b)=>b[1]-a[1])[0],
      porPago,porDia,porV};
  },[allData,products,desde,hasta]);

  const maxBar=Math.max(...Object.values(stats.porDia),1);

  const sendWA=()=>{
    const cfg=getSettings(),phone=cfg.waPhone||"";
    const titulo=periodo==="semana"?`📊 *REPORTE SEMANAL* (${fmtDate(ranges.semDesde)} → ${fmtDate(ranges.semHasta)})`:`📊 *REPORTE MENSUAL* — ${hoy.toLocaleDateString("es-AR",{month:"long",year:"numeric"})}`;
    const lineas=[titulo,"",`💰 *Ventas totales:* ${fmtARS(stats.ventas)}`,`✅ *Ganancia neta:* ${fmtARS(stats.ganancia)} — ${fmtPct(stats.margen)} margen`,
      `📦 Costo: ${fmtARS(stats.costo)}`,`🚨 Merma: ${fmtARS(stats.mermaVal)}`,``,
      `🧾 Transacciones: ${stats.tx}`,`📈 Prom. por día: ${fmtARS(stats.promDia)}`,``,
      `💳 Por método:`,`   💵 Efectivo: ${fmtARS(stats.porPago.efectivo)}`,`   📲 Transferencia: ${fmtARS(stats.porPago.transferencia)}`,`   💳 Tarjeta: ${fmtARS(stats.porPago.tarjeta)}`,``,
      `👥 Por vendedor:`,
      ...Object.values(stats.porV).map(v=>`   ${v.emoji} ${v.name}: ${fmtARS(v.ventas)}`),``,
      `🏆 Top productos:`,
      ...stats.topProds.map((p,i)=>`   ${i+1}. ${p.name}: ${fmtARS(p.total)}`),
      stats.mejorDia?`\n📆 Mejor día: ${fmtDate(stats.mejorDia[0])} — ${fmtARS(stats.mejorDia[1])}`:"",``,`_VerduleroApp Pro_`].filter(Boolean);
    const txt=encodeURIComponent(lineas.join("\n"));
    window.open(phone?`https://wa.me/${phone}?text=${txt}`:`https://wa.me/?text=${txt}`,"_blank");
  };

  if(loading) return <div className="empty"><p>Cargando…</p></div>;
  return(
    <div>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {[["semana","📅 Esta semana"],["mes","🗓️ Este mes"]].map(([v,l])=>(
          <button key={v} onClick={()=>setPeriodo(v)} style={{flex:1,padding:"10px 0",borderRadius:12,border:"none",cursor:"pointer",fontFamily:"Syne,sans-serif",fontWeight:700,fontSize:13,
            background:periodo===v?"#9ef09a":"#111f14",color:periodo===v?"#0a1a0d":"#4a7050",boxShadow:periodo===v?"0 2px 12px rgba(158,240,154,.3)":"none"}}>{l}</button>
        ))}
      </div>
      <div style={{textAlign:"center",fontSize:11,color:"#4a7050",marginBottom:14}}>
        {periodo==="semana"?`${fmtDate(ranges.semDesde)} → ${fmtDate(ranges.semHasta)}`:`${fmtDate(ranges.mesDesde)} → ${fmtDate(ranges.mesHasta)}`} · {stats.diasActivos} días activos
      </div>
      <div className="stats-grid">
        <div className="stat"><div className="stat-lbl">Ventas del período</div><div className="stat-val" style={{fontSize:19}}>{fmtARS(stats.ventas)}</div><div className="stat-sub">{stats.tx} transacciones</div></div>
        <div className={`stat ${stats.margen>=30?"":stats.margen>=15?"warn":"bad"}`}><div className="stat-lbl">Ganancia neta</div><div className="stat-val" style={{fontSize:19}}>{fmtARS(stats.ganancia)}</div><div className="stat-sub">{fmtPct(stats.margen)} margen</div></div>
        <div className="stat"><div className="stat-lbl">Prom. por día</div><div className="stat-val" style={{fontSize:18}}>{fmtARS(stats.promDia)}</div></div>
        <div className="stat bad"><div className="stat-lbl">Pérdida merma</div><div className="stat-val" style={{fontSize:18}}>{fmtARS(stats.mermaVal)}</div></div>
      </div>
      {Object.keys(stats.porDia).length>0&&(
        <div className="card">
          <div className="card-title">Ventas por día</div>
          <div className="bar-wrap" style={{height:90,alignItems:"flex-end",gap:3}}>
            {Object.entries(stats.porDia).sort(([a],[b])=>a.localeCompare(b)).map(([d,v])=>(
              <div key={d} className="bar-col">
                <div className="bar-val">{fmtARS(v).replace("$","")}</div>
                <div className="bar" style={{height:`${Math.max((v/maxBar)*72,4)}px`}}/>
                <div className="bar-lbl">{fmtDate(d).slice(0,5)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="card">
        <div className="card-title">👥 Por vendedor</div>
        {Object.values(stats.porV).sort((a,b)=>b.ventas-a.ventas).map(v=>(
          <div key={v.name} className="line"><span className="line-k">{v.emoji} {v.name}</span><span className="line-v">{fmtARS(v.ventas)}</span></div>
        ))}
      </div>
      <div className="card">
        <div className="card-title">Por método de pago</div>
        {[["💵 Efectivo","efectivo"],["📲 Transferencia","transferencia"],["💳 Tarjeta","tarjeta"]].map(([l,k])=>(
          <div key={k} className="line"><span className="line-k">{l}</span>
            <div style={{textAlign:"right"}}><span className="line-v">{fmtARS(stats.porPago[k])}</span>
              {stats.ventas>0&&<div style={{fontSize:10,color:"#4a7050"}}>{((stats.porPago[k]/stats.ventas)*100).toFixed(0)}%</div>}
            </div>
          </div>
        ))}
      </div>
      {stats.topProds.length>0&&(
        <div className="card">
          <div className="card-title">🏆 Top productos</div>
          {stats.topProds.map((p,i)=>(
            <div key={i} className="line">
              <span className="line-k"><span style={{fontFamily:"Syne,sans-serif",fontWeight:800,color:"#2a5a30",marginRight:8}}>#{i+1}</span>{p.name}</span>
              <span className="line-v">{fmtARS(p.total)}</span>
            </div>
          ))}
        </div>
      )}
      {stats.mejorDia&&(
        <div className="card" style={{background:"linear-gradient(135deg,#0f2e13,#162b1a)",border:"1px solid #1a4a20"}}>
          <div className="card-title">🌟 Mejor día</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:14,color:"#c0dcc2"}}>
              {new Date(stats.mejorDia[0]+"T12:00:00").toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"})}
            </div>
            <div style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:22,color:"#f5e842"}}>{fmtARS(stats.mejorDia[1])}</div>
          </div>
        </div>
      )}
      {stats.diasActivos===0&&<div className="empty"><Ico d={I.chart} size={38}/><p>Sin ventas en este período</p></div>}
      <button className="btn btn-wa" onClick={sendWA} style={{marginTop:4}}><Ico d={I.wa} size={19}/>Enviar reporte por WhatsApp</button>
    </div>
  );
}

function APrecios({products,saveProducts,showToast}){
  const [costo,setCosto]=useState(""); const [margen,setMargen]=useState("40");
  const [editM,setEditM]=useState(null); const [addM,setAddM]=useState(false);
  const [nm,setNm]=useState(""); const [un,setUn]=useState("kg"); const [co,setCo]=useState(""); const [pr,setPr]=useState(""); const [st,setSt]=useState("");
  const cn=parseFloat(costo)||0,mn=parseFloat(margen)||0,sug=cn>0?cn/(1-mn/100):0,gan=sug-cn;
  const openEdit=p=>{setEditM(p);setNm(p.name);setUn(p.unit);setCo(p.cost);setPr(p.price);setSt(p.stock);};
  const saveEdit=()=>{saveProducts(products.map(p=>p.id===editM.id?{...p,name:nm,unit:un,cost:parseFloat(co)||0,price:parseFloat(pr)||0,stock:parseFloat(st)||0}:p));setEditM(null);showToast("✅ Actualizado");};
  const addProd=()=>{
    if(!nm||!co||!pr) return;
    saveProducts([...products,{id:Date.now().toString(),name:nm,unit:un,cost:parseFloat(co)||0,price:parseFloat(pr)||0,stock:parseFloat(st)||10,minStock:3}]);
    setAddM(false);setNm("");setUn("kg");setCo("");setPr("");setSt("");showToast("✅ Producto agregado");
  };
  const applyMargen=()=>{if(!mn)return;saveProducts(products.map(p=>({...p,price:p.cost>0?Math.round(p.cost/(1-mn/100)):p.price})));showToast(`✅ Margen ${mn}% aplicado`);};
  return(
    <div>
      <div className="sec-title">🏷️ Gestión de precios</div>
      <div className="card">
        <div className="card-title">Calculadora</div>
        <div className="frow"><label className="flbl">Costo de compra ($)</label><input className="finput" type="number" placeholder="$ costo" value={costo} onChange={e=>setCosto(e.target.value)}/></div>
        <div className="frow"><label className="flbl">Margen (%)</label><input className="finput" type="number" placeholder="40" value={margen} onChange={e=>setMargen(e.target.value)}/></div>
        {cn>0&&(
          <div style={{background:"#0f2e13",border:"1px solid #1a4a20",borderRadius:12,padding:14,marginTop:4}}>
            <div className="line" style={{borderColor:"#1a4a20"}}><span className="line-k">💰 Precio sugerido</span><span style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:22,color:"#f5e842"}}>{fmtARS(sug)}</span></div>
            <div className="line" style={{borderColor:"#1a4a20"}}><span className="line-k">Ganancia/unidad</span><span className="line-v">{fmtARS(gan)}</span></div>
            <div className="line"><span className="line-k">Markup</span><span className="line-v">{fmtPct(cn>0?(gan/cn)*100:0)}</span></div>
          </div>
        )}
      </div>
      <div className="card">
        <div className="card-title">Margen global</div>
        <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
          <div style={{flex:1}}><label className="flbl">% margen</label><input className="finput" type="number" placeholder="40" value={margen} onChange={e=>setMargen(e.target.value)}/></div>
          <button className="btn btn-blue btn-sm" style={{width:"auto",padding:"10px 16px",flexShrink:0}} onClick={applyMargen}>Aplicar a todos</button>
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div className="sec-title" style={{margin:0}}>Productos ({products.length})</div>
        <button className="btn btn-green btn-sm" style={{width:"auto"}} onClick={()=>{setAddM(true);setNm("");setUn("kg");setCo("");setPr("");setSt("");}}><Ico d={I.plus} size={13}/>Nuevo</button>
      </div>
      <div className="card" style={{padding:"6px 14px"}}>
        {products.map(p=>{
          const mg=p.price>0?((p.price-p.cost)/p.price)*100:0,sp=p.price===0||p.cost===0;
          return(
            <div key={p.id} style={{display:"flex",alignItems:"center",padding:"10px 0",borderBottom:"1px solid #182c1c",gap:7}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,color:"#c0dcc2",fontWeight:500,display:"flex",alignItems:"center",gap:6}}>{p.name}{sp&&<span className="tag-r" style={{fontSize:9}}>sin precio</span>}</div>
                <div style={{fontSize:11,color:"#3d6045"}}>C:{fmtARS(p.cost)} → V:{fmtARS(p.price)}/{p.unit} · Stock:{p.stock}</div>
              </div>
              <span className={sp?"tag-r":mg>=30?"tag-g":mg>=15?"tag-y":"tag-r"}>{sp?"—":mg.toFixed(0)+"%"}</span>
              <button className="btn btn-dim btn-sm btn-ico" onClick={()=>openEdit(p)}><Ico d={I.edit} size={13}/></button>
              <button className="btn btn-red btn-sm btn-ico" onClick={()=>{saveProducts(products.filter(x=>x.id!==p.id));showToast("🗑️ Eliminado");}}><Ico d={I.trash} size={13}/></button>
            </div>
          );
        })}
      </div>
      {editM&&(
        <div className="overlay" onClick={()=>setEditM(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">✏️ Editar {editM.name}</div>
            {[["Nombre",nm,setNm,"text"],["Costo ($)",co,setCo,"number"],["Precio ($)",pr,setPr,"number"],["Stock",st,setSt,"number"]].map(([l,v,s,t])=>(
              <div key={l} className="frow"><label className="flbl">{l}</label><input className="finput" type={t} value={v} onChange={e=>s(e.target.value)}/></div>
            ))}
            <div className="frow"><label className="flbl">Unidad</label><select className="finput" value={un} onChange={e=>setUn(e.target.value)}>{["kg","unid","atado","docena"].map(u=><option key={u} value={u}>{u}</option>)}</select></div>
            {co&&pr&&<div style={{background:"#0f2e13",border:"1px solid #1a4a20",borderRadius:10,padding:"10px 14px",marginBottom:12}}><div style={{fontSize:11,color:"#4a7050"}}>Margen resultante</div><div style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:18,color:"#9ef09a"}}>{parseFloat(pr)>0?fmtPct(((parseFloat(pr)-parseFloat(co))/parseFloat(pr))*100):"—"}</div></div>}
            <div style={{display:"flex",gap:8}}><button className="btn btn-dim" onClick={()=>setEditM(null)}>Cancelar</button><button className="btn btn-green" onClick={saveEdit}>Guardar</button></div>
          </div>
        </div>
      )}
      {addM&&(
        <div className="overlay" onClick={()=>setAddM(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">➕ Nuevo producto</div>
            {[["Nombre",nm,setNm,"text","ej: Acelga"],["Costo ($)",co,setCo,"number","$ costo"],["Precio ($)",pr,setPr,"number","$ venta"],["Stock",st,setSt,"number","20"]].map(([l,v,s,t,ph])=>(
              <div key={l} className="frow"><label className="flbl">{l}</label><input className="finput" type={t} placeholder={ph} value={v} onChange={e=>s(e.target.value)}/></div>
            ))}
            <div className="frow"><label className="flbl">Unidad</label><select className="finput" value={un} onChange={e=>setUn(e.target.value)}>{["kg","unid","atado","docena"].map(u=><option key={u} value={u}>{u}</option>)}</select></div>
            <div style={{display:"flex",gap:8}}><button className="btn btn-dim" onClick={()=>setAddM(false)}>Cancelar</button><button className="btn btn-green" onClick={addProd}>Agregar</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function AConfig({showToast}){
  const cfg=db.getCfg(), stg=getSettings();
  const [binId,setBinId]   = useState(cfg.binId);
  const [apiKey,setApiKey] = useState(cfg.apiKey);
  const [waPhone,setWaPhone]=useState(stg.waPhone);
  const [testing,setTesting]=useState(false);
  const [syncOk,setSyncOk] = useState(null);
  const [creating,setCreating]=useState(false);
  const [users,setUsers]   = useState(getUsers());

  const testSync=async()=>{
    if(!binId||!apiKey){showToast("❌ Ingresá Bin ID y API Key");return;}
    setTesting(true);setSyncOk(null);
    db.set("syncCfg",{binId,apiKey});
    const ok=await db.pull(); setSyncOk(ok); setTesting(false);
    showToast(ok?"✅ Conexión exitosa":"❌ Error — verificá los datos");
  };
  const crearBin=async()=>{
    if(!apiKey){showToast("❌ Ingresá la API Key primero");return;}
    setCreating(true);
    const id=await db.initBin(apiKey); setCreating(false);
    if(id){setBinId(id);showToast("✅ Bin creado: "+id);}
    else showToast("❌ No se pudo crear — verificá la API Key");
  };
  const guardarSync=()=>{db.set("syncCfg",{binId,apiKey});showToast("✅ Nube guardada");};
  const guardarUsers=()=>{db.set("users",users);db.push("users",users);showToast("✅ Usuarios guardados");};
  const guardarWA=()=>{const s={...getSettings(),waPhone};db.set("settings",s);db.push("settings",s);showToast("✅ WhatsApp guardado");};
  const updUser=(id,field,val)=>setUsers(us=>us.map(u=>u.id===id?{...u,[field]:val}:u));

  return(
    <div>
      <div className="sec-title">⚙️ Configuración</div>
      <div className="card">
        <div className="card-title">☁️ Sincronización entre dispositivos</div>
        <div style={{background:syncOk===true?"#0f2e13":syncOk===false?"#2e0808":"#111f14",border:`1px solid ${syncOk===true?"#1a4a20":syncOk===false?"#4a1a1a":"#1a3020"}`,borderRadius:12,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
          <div style={{fontSize:18}}>{syncOk===true?"🟢":syncOk===false?"🔴":"☁️"}</div>
          <div>
            <div style={{fontFamily:"Syne,sans-serif",fontWeight:700,fontSize:12,color:syncOk===true?"#9ef09a":syncOk===false?"#f56b6b":"#64b5f6"}}>{syncOk===true?"Conectado":syncOk===false?"Sin conexión":"Sin configurar"}</div>
            <div style={{fontSize:11,color:"#4a7090",marginTop:1}}>{binId?`Bin: ${binId}`:"Configurá JSONBin"}</div>
          </div>
        </div>
        <div style={{background:"#0a1e3a",border:"1px solid #1e3d6a",borderRadius:12,padding:"12px 14px",marginBottom:12}}>
          <div style={{fontFamily:"Syne,sans-serif",fontWeight:700,fontSize:12,color:"#64b5f6",marginBottom:8}}>📋 Pasos (gratis)</div>
          {[["1","Entrá a jsonbin.io y creá cuenta"],["2","Copiá tu Master Key (ícono 🔑)"],["3","Pegá la key y tocá 'Crear Bin'"]].map(([n,t])=>(
            <div key={n} style={{display:"flex",gap:8,marginBottom:5}}><span style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:13,color:"#1976d2",minWidth:18}}>{n}.</span><span style={{fontSize:11,color:"#90b4d8",lineHeight:1.4}}>{t}</span></div>
          ))}
        </div>
        <div className="frow"><label className="flbl">Master Key (API Key)</label><input className="finput" type="password" placeholder="$2a$10$..." value={apiKey} onChange={e=>setApiKey(e.target.value)}/></div>
        <div className="frow"><label className="flbl">Bin ID</label><input className="finput" type="text" placeholder="Se completa al crear" value={binId} onChange={e=>setBinId(e.target.value)}/></div>
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <button className="btn btn-blue btn-sm" style={{flex:1}} onClick={crearBin} disabled={creating}>{creating?"Creando…":"☁️ Crear Bin"}</button>
          <button className="btn btn-dim btn-sm" style={{flex:1}} onClick={testSync} disabled={testing}>{testing?"Probando…":"🔌 Probar"}</button>
        </div>
        <button className="btn btn-green" onClick={guardarSync}><Ico d={I.check} size={17}/>Guardar configuración de nube</button>
      </div>

      <div className="card">
        <div className="card-title">👥 Control de vendedores</div>
        {users.filter(u=>u.role==="vendor").map(u=>(
          <div key={u.id} style={{padding:"12px 0",borderBottom:"1px solid #182c1c"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <span style={{fontSize:20}}>{u.emoji}</span>
              <span style={{fontFamily:"Syne,sans-serif",fontWeight:700,fontSize:14,color:"#c0dcc2",flex:1}}>{u.name}</span>
              <button onClick={()=>updUser(u.id,"active",!u.active)}
                style={{padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",fontWeight:700,fontSize:11,
                  background:u.active?"#0f2e13":"#2e0808",color:u.active?"#6de067":"#f56b6b",
                  border:`1px solid ${u.active?"#1a4a20":"#4a1a1a"}`}}>
                {u.active?"✅ Activo":"❌ Inactivo"}
              </button>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
              <Ico d={I.clock} size={14} color="#4a7050"/>
              <span style={{fontSize:11,color:"#4a7050",marginRight:4}}>Horario:</span>
              <input value={u.horaDesde} onChange={e=>updUser(u.id,"horaDesde",e.target.value)} type="time"
                style={{background:"#111f14",border:"1px solid #1a3020",borderRadius:8,padding:"4px 8px",color:"#9ef09a",fontSize:12,width:88}}/>
              <span style={{color:"#4a7050",fontSize:12}}>→</span>
              <input value={u.horaHasta} onChange={e=>updUser(u.id,"horaHasta",e.target.value)} type="time"
                style={{background:"#111f14",border:"1px solid #1a3020",borderRadius:8,padding:"4px 8px",color:"#9ef09a",fontSize:12,width:88}}/>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <Ico d={I.lock} size={14} color="#4a7050"/>
              <span style={{fontSize:11,color:"#4a7050",marginRight:4}}>PIN:</span>
              <input value={u.pin} onChange={e=>updUser(u.id,"pin",e.target.value.replace(/\D/g,"").slice(0,4))} type="text" maxLength={4}
                style={{background:"#111f14",border:"1px solid #1a3020",borderRadius:8,padding:"4px 8px",color:"#f5e842",fontSize:14,fontWeight:700,width:70,textAlign:"center"}}/>
            </div>
          </div>
        ))}
        <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid #1e3d6a"}}>
          <div style={{fontSize:11,color:"#64b5f6",marginBottom:8,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>PINs de administradores</div>
          {users.filter(u=>u.role==="admin").map(u=>(
            <div key={u.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <span style={{fontSize:18}}>{u.emoji}</span>
              <span style={{fontSize:13,color:"#c0dcc2",flex:1}}>{u.name}</span>
              <Ico d={I.lock} size={14} color="#4a7050"/>
              <input value={u.pin} onChange={e=>updUser(u.id,"pin",e.target.value.replace(/\D/g,"").slice(0,4))} type="text" maxLength={4}
                style={{background:"#111f14",border:"1px solid #1e3d6a",borderRadius:8,padding:"4px 8px",color:"#64b5f6",fontSize:14,fontWeight:700,width:70,textAlign:"center"}}/>
            </div>
          ))}
        </div>
        <button className="btn btn-green" style={{marginTop:12}} onClick={guardarUsers}><Ico d={I.check} size={17}/>Guardar usuarios y horarios</button>
      </div>

      <div className="card">
        <div className="card-title">📲 WhatsApp para reportes</div>
        <div style={{fontSize:11,color:"#4a7050",marginBottom:10}}>Con código de país, sin + ni espacios.<br/>Ejemplo Argentina: <b style={{color:"#9ef09a"}}>5491123456789</b></div>
        <div className="frow"><label className="flbl">Número de WhatsApp</label><input className="finput" type="tel" placeholder="5491123456789" value={waPhone} onChange={e=>setWaPhone(e.target.value.replace(/\D/g,""))}/></div>
        {waPhone&&<div style={{fontSize:11,color:"#4a7050",marginBottom:8}}>wa.me/{waPhone}</div>}
        <button className="btn btn-green" onClick={guardarWA}><Ico d={I.check} size={17}/>Guardar WhatsApp</button>
      </div>
    </div>
  );
}
