import { useState, useEffect } from "react";

// ─── Data ─────────────────────────────────────────────────────────────────────

const CATEGORIES = {
  kissing:  { label: "Kissing & Romance",      icon: "💋", desc: "Kissing, romantic scenes" },
  sex:      { label: "Sex Scenes",             icon: "🔥", desc: "Sexual content or implied intimacy" },
  nudity:   { label: "Nudity",                 icon: "👁️",  desc: "Partial or full nudity" },
  violence: { label: "Violence",               icon: "⚡", desc: "Fighting, injury, blood" },
  vaw:      { label: "Violence Against Women", icon: "🛡️", desc: "Assault, abuse targeting women" },
  language: { label: "Strong Language",        icon: "🔊", desc: "Profanity, slurs" },
};

const COMFORT = {
  fine:    { label: "Fine",     color: "#15803d", bg: "#f0fdf4", border: "#86efac" },
  headsup: { label: "Heads Up", color: "#92400e", bg: "#fffbeb", border: "#fcd34d" },
  skipit:  { label: "Skip It",  color: "#b91c1c", bg: "#fef2f2", border: "#fca5a5" },
};

const SEV_COLOR  = { none: "#15803d", mild: "#92400e", moderate: "#c2410c", severe: "#991b1b" };
const SEV_BG     = { none: "#f0fdf4", mild: "#fffbeb", moderate: "#fff7ed", severe: "#fef2f2" };
const SEV_BORDER = { none: "#86efac", mild: "#fcd34d", moderate: "#fdba74", severe: "#fca5a5" };

const DEFAULT_PROFILES = [
  { id:"1", name:"Dad",  avatar:"👨", comfort:{ kissing:"fine",    sex:"headsup", nudity:"headsup", violence:"fine",    vaw:"skipit", language:"fine"    }},
  { id:"2", name:"Mom",  avatar:"👩", comfort:{ kissing:"fine",    sex:"skipit",  nudity:"skipit",  violence:"headsup", vaw:"skipit", language:"headsup" }},
  { id:"3", name:"Kids", avatar:"🧒", comfort:{ kissing:"headsup", sex:"skipit",  nudity:"skipit",  violence:"skipit",  vaw:"skipit", language:"skipit"  }},
];

const AVATARS = ["👨","👩","🧒","👧","👦","👴","👵","🧑","😎","🤓","🥸","😊"];

// ─── API ──────────────────────────────────────────────────────────────────────

const load = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; }};
const save = (k, v)  => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

function extractJSON(text) {
  const start = text.indexOf("{");
  if (start === -1) throw new Error("No JSON in response");
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") { depth--; if (depth === 0) return JSON.parse(text.slice(start, i+1)); }
  }
  throw new Error("Malformed JSON");
}

async function callAPI(userMessage) {
  // Calls our Netlify serverless function — API key never exposed to browser
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:2048,
      messages:[{ role:"user", content:userMessage }, { role:"assistant", content:"{" }] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `API error ${res.status}`);
  const text = data.content?.find(b => b.type==="text")?.text || "";
  return extractJSON("{" + text);
}

function buildContext(title, year, mediaType, season, episode, tvMode) {
  const type = mediaType === "any" ? "movie or TV show" : mediaType;
  const yr = year ? ` (${year})` : "";
  if ((mediaType === "TV show" || mediaType === "any") && tvMode === "episode" && (season || episode)) {
    const ep = [season ? `Season ${season}` : "", episode ? `Episode ${episode}` : ""].filter(Boolean).join(", ");
    return `${ep} of the TV show "${title}"${yr}`;
  }
  if (mediaType === "TV show" && tvMode === "general")
    return `the TV show "${title}"${yr} (general series overview, not a specific episode)`;
  return `the ${type} titled "${title}"${yr}`;
}

const FULL_PROMPT = (title, year, mediaType, season, episode, tvMode) =>
  `You are a content safety assistant. Analyze ${buildContext(title, year, mediaType, season, episode, tvMode)}. ` +
  `If multiple titles share this name use the year and type to identify the correct one. ` +
  `Be THOROUGH — list ALL content moments including brief, implied, or partial scenes. ` +
  `If the title looks misspelled set did_you_mean to your best guess. ` +
  `If you cannot identify it at all set not_found true AND did_you_mean to your closest guess. ` +
  `Respond with ONLY a JSON object — no explanation, no markdown. ` +
  `{ "not_found": false, "did_you_mean": null, "title": "Exact Title", "year": "YYYY", "rating": "PG-13", ` +
  `"summary": "2 sentence spoiler-free summary.", ` +
  `"vaw": { "present": true, "severity": "none|mild|moderate|severe", "description": "..." }, ` +
  `"moments": [{ "category": "kissing|sex|nudity|violence|vaw|language", "timecode": "0:00:00", "endTimecode": "0:00:00", "description": "..." }] }`;

const VAW_PROMPT = (title, year, mediaType, season, episode, tvMode) =>
  `You are a content safety assistant. Check ${buildContext(title, year, mediaType, season, episode, tvMode)} for violence against women. ` +
  `If multiple titles share this name use the year and type to identify the correct one. ` +
  `If the title looks misspelled set did_you_mean to your best guess. ` +
  `If you cannot identify it set not_found true AND did_you_mean to closest guess. ` +
  `Respond with ONLY a JSON object — no explanation, no markdown. ` +
  `{ "not_found": false, "did_you_mean": null, "title": "Exact Title", "year": "YYYY", ` +
  `"vaw": { "present": true, "severity": "none|mild|moderate|severe", "description": "...", "examples": ["..."] } }`;

// ─── Film Strip Divider ───────────────────────────────────────────────────────

function FilmStrip() {
  return (
    <div style={{ display:"flex", alignItems:"center", margin:"28px 0", userSelect:"none" }}>
      {Array.from({length:18}).map((_,i) => (
        <div key={i} style={{
          width:20, height:14, border:"2px solid #d1c9b8", borderRadius:2,
          marginRight:3, flexShrink:0, background: i%2===0 ? "#ede8df" : "#f7f4ef",
        }}/>
      ))}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function SafeScreen() {
  const [screen,         setScreen]         = useState("search");
  const [profiles,       setProfiles]       = useState(() => load("ss_profiles", DEFAULT_PROFILES));
  const [activeId,       setActiveId]       = useState(() => load("ss_activeId", "1"));
  const [editingProfile, setEditingProfile] = useState(null);
  const [query,          setQuery]          = useState("");
  const [year,           setYear]           = useState("");
  const [mediaType,      setMediaType]      = useState("any");
  const [season,         setSeason]         = useState("");
  const [episode,        setEpisode]        = useState("");
  const [tvMode,         setTvMode]         = useState("general");
  const [showHelp,       setShowHelp]       = useState(false);
  const [loading,        setLoading]        = useState(false);
  const [mode,           setMode]           = useState(null);
  const [result,         setResult]         = useState(null);
  const [vawResult,      setVawResult]      = useState(null);
  const [error,          setError]          = useState(null);

  useEffect(() => { save("ss_profiles", profiles); }, [profiles]);
  useEffect(() => { save("ss_activeId",  activeId);  }, [activeId]);

  const activeProfile = profiles.find(p => p.id === activeId) || profiles[0];

  const doSearch = async (searchMode) => {
    if (!query.trim()) return;
    setLoading(true); setMode(searchMode); setError(null); setResult(null); setVawResult(null);
    try {
      if (searchMode === "full") {
        const data = await callAPI(FULL_PROMPT(query.trim(), year.trim(), mediaType, season, episode, tvMode));
        if (data.not_found) setError({ msg: `Title not recognized.${data.did_you_mean ? ` Did you mean "${data.did_you_mean}"?` : ""}`, suggestion: data.did_you_mean||null });
        else setResult(data);
      } else {
        const data = await callAPI(VAW_PROMPT(query.trim(), year.trim(), mediaType, season, episode, tvMode));
        if (data.not_found) setError({ msg: `Title not recognized.${data.did_you_mean ? ` Did you mean "${data.did_you_mean}"?` : ""}`, suggestion: data.did_you_mean||null });
        else setVawResult(data);
      }
    } catch(e) { setError(`Error: ${e.message}`); }
    setLoading(false);
  };

  const saveProfile  = (u) => { setProfiles(prev => prev.map(p => p.id===u.id ? u : p)); setScreen("search"); };
  const addProfile   = () => {
    const np = { id:Date.now().toString(), name:"New Profile", avatar:"😊", comfort:Object.fromEntries(Object.keys(CATEGORIES).map(k=>[k,"headsup"])) };
    setProfiles(prev=>[...prev,np]); setEditingProfile(np); setScreen("editProfile");
  };
  const deleteProfile = (id) => {
    setProfiles(prev=>prev.filter(p=>p.id!==id));
    if (activeId===id) setActiveId(profiles.find(p=>p.id!==id)?.id||"1");
  };

  if (screen==="editProfile"&&editingProfile) return <ProfileEditor profile={editingProfile} onSave={saveProfile} onCancel={()=>setScreen("search")} />;
  if (screen==="profiles") return <ProfileManager profiles={profiles} activeId={activeId} onSelect={id=>{setActiveId(id);setScreen("search");}} onEdit={p=>{setEditingProfile(p);setScreen("editProfile");}} onAdd={addProfile} onDelete={deleteProfile} onBack={()=>setScreen("search")} />;

  const visibleMoments = (result?.moments||[]).map(m=>({...m,comfort:activeProfile?.comfort?.[m.category]||"headsup"})).filter(m=>m.comfort!=="fine");
  const skipMoments    = visibleMoments.filter(m=>m.comfort==="skipit");
  const headsupMoments = visibleMoments.filter(m=>m.comfort==="headsup");

  return (
    <div style={{ minHeight:"100vh", background:"#f5f0e8", fontFamily:"'Georgia', 'Times New Roman', serif", color:"#1a1209" }}>

      {/* ── MARQUEE HEADER ── */}
      <div style={{
        background:"#0f0a04",
        borderBottom:"4px solid #c41e1e",
        padding:"0 0 0 0",
        position:"relative",
        overflow:"hidden",
      }}>
        {/* Bulb row top */}
        <div style={{ display:"flex", justifyContent:"center", gap:0, paddingTop:10, paddingBottom:4 }}>
          {Array.from({length:32}).map((_,i) => (
            <div key={i} className={loading ? `bulb bulb-${i%3}` : ""} style={{
              width:12, height:12, borderRadius:"50%", margin:"0 5px",
              background: i%3===0 ? "#ffd700" : i%3===1 ? "#c41e1e" : "#f5f0e8",
              boxShadow: i%3===0 ? "0 0 6px #ffd700" : i%3===1 ? "0 0 6px #c41e1e" : "none",
              flexShrink:0, transition:"background 0.1s, box-shadow 0.1s",
            }}/>
          ))}
        </div>

        {/* Logo + nav */}
        <div style={{ maxWidth:700, margin:"0 auto", padding:"16px 24px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:11, letterSpacing:"0.3em", color:"#c41e1e", textTransform:"uppercase", marginBottom:4, fontFamily:"'Georgia',serif" }}>
              ★ NOW PRESENTING ★
            </div>
            <div style={{
              fontSize:36, fontWeight:700, color:"#f5f0e8", letterSpacing:"0.04em",
              textShadow:"0 0 20px rgba(196,30,30,0.5), 0 2px 4px rgba(0,0,0,0.8)",
              fontFamily:"'Georgia',serif", lineHeight:1,
            }}>
              SafeScreen
            </div>
            <div style={{ fontSize:11, color:"#8a7a5a", letterSpacing:"0.15em", marginTop:4 }}>
              KNOW BEFORE YOU WATCH
            </div>
          </div>

          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            <button onClick={()=>setShowHelp(h=>!h)} style={{
              width:36, height:36, borderRadius:"50%",
              border:`2px solid ${showHelp?"#ffd700":"#3a2e1e"}`,
              background: showHelp ? "#ffd70022" : "transparent",
              cursor:"pointer", color: showHelp?"#ffd700":"#8a7a5a",
              fontSize:16, fontWeight:700, fontFamily:"Georgia,serif",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>?</button>
            <button onClick={()=>setScreen("profiles")} style={{
              display:"flex", alignItems:"center", gap:8, padding:"8px 16px",
              background:"transparent", border:"2px solid #3a2e1e", borderRadius:24,
              cursor:"pointer", color:"#c8b99a", fontSize:13, fontWeight:600, fontFamily:"Georgia,serif",
              letterSpacing:"0.05em",
            }}>
              <span style={{fontSize:16}}>{activeProfile?.avatar}</span>
              {activeProfile?.name}
              <span style={{color:"#5a4a2a",fontSize:11}}>▾</span>
            </button>
          </div>
        </div>

        {/* Bulb row bottom */}
        <div style={{ display:"flex", justifyContent:"center", gap:0, paddingBottom:10, paddingTop:4 }}>
          {Array.from({length:32}).map((_,i) => (
            <div key={i} className={loading ? `bulb bulb-${i%3}` : ""} style={{
              width:12, height:12, borderRadius:"50%", margin:"0 5px",
              background: i%3===0 ? "#c41e1e" : i%3===1 ? "#ffd700" : "#f5f0e8",
              boxShadow: i%3===0 ? "0 0 6px #c41e1e" : i%3===1 ? "0 0 6px #ffd700" : "none",
              flexShrink:0, transition:"background 0.1s, box-shadow 0.1s",
            }}/>
          ))}
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ maxWidth:700, margin:"0 auto", padding:"32px 20px 80px" }}>

        {/* Help Panel */}
        {showHelp && (
          <div style={{ background:"#fffef5", border:"2px solid #d4c5a0", borderRadius:8,
            padding:"22px 26px", marginBottom:28, animation:"fadeUp 0.2s ease",
            boxShadow:"0 4px 20px rgba(0,0,0,0.08)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
              <div style={{ fontSize:16, fontWeight:700, letterSpacing:"0.05em", color:"#1a1209" }}>HOW TO USE SAFESCREEN</div>
              <button onClick={()=>setShowHelp(false)} style={{ background:"none",border:"none",color:"#8a7a5a",fontSize:18,cursor:"pointer",padding:0 }}>✕</button>
            </div>
            {[
              { icon:"🔍", title:"Search a title", body:"Type any movie or TV show and tap Analyze for a full content breakdown with approximate timecodes." },
              { icon:"🛡️", title:"Quick VAW Check", body:"Just want to know about violence against women? Use the red button for a fast focused check." },
              { icon:"📅", title:"Narrow your search", body:"If a title has multiple versions (Fresh 1994 vs Fresh 2022), use the Year field and type selector." },
              { icon:"📺", title:"TV Shows", body:"Select TV Show, then choose Whole Series for an overview or Specific Episode and enter season/episode numbers." },
              { icon:"👨‍👩‍👧", title:"Family Profiles", body:"Tap your name top-right to switch profiles. Fine hides content, Heads Up flags it, Skip It highlights it to avoid." },
              { icon:"⚠️", title:"Disclaimer", body:"Timecodes are AI estimates. Brief or implied scenes may be missed. Always preview yourself when it matters." },
            ].map(({icon,title,body}) => (
              <div key={title} style={{ display:"flex", gap:14, marginBottom:14, paddingBottom:14, borderBottom:"1px solid #ede8df" }}>
                <span style={{fontSize:20, marginTop:1}}>{icon}</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:"#1a1209", marginBottom:3, letterSpacing:"0.06em", textTransform:"uppercase" }}>{title}</div>
                  <div style={{ fontSize:13, color:"#6b5c3e", lineHeight:1.7, fontFamily:"Georgia,serif" }}>{body}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── TICKET STUB SEARCH ── */}
        <div style={{
          background:"#fffef5",
          border:"2px solid #d4c5a0",
          borderRadius:8,
          marginBottom:16,
          boxShadow:"0 4px 20px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)",
          overflow:"hidden",
          position:"relative",
        }}>
          {/* Ticket header band */}
          <div style={{ background:"#1a0f05", padding:"10px 20px", display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:"#c41e1e", boxShadow:"0 0 6px #c41e1e" }}/>
            <div style={{ fontSize:11, letterSpacing:"0.25em", color:"#8a7a5a", textTransform:"uppercase" }}>Content Analysis Request</div>
            <div style={{ width:8, height:8, borderRadius:"50%", background:"#ffd700", boxShadow:"0 0 6px #ffd700", marginLeft:"auto" }}/>
          </div>

          {/* Search input area */}
          <div style={{ display:"flex", gap:0, borderBottom:"1px dashed #d4c5a0" }}>
            <input value={query} onChange={e=>setQuery(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&doSearch("full")}
              placeholder="Enter a title…"
              style={{ flex:1, background:"transparent", border:"none", padding:"18px 20px",
                fontSize:17, color:"#1a1209", fontFamily:"Georgia,serif", outline:"none",
                letterSpacing:"0.01em" }} />
            <button onClick={()=>doSearch("full")} disabled={loading||!query.trim()} style={{
              background: loading||!query.trim() ? "#d4c5a0" : "#c41e1e",
              border:"none", padding:"18px 26px", color:"#fff", fontSize:14, fontWeight:700,
              cursor:loading||!query.trim()?"not-allowed":"pointer",
              fontFamily:"Georgia,serif", letterSpacing:"0.1em", textTransform:"uppercase",
              transition:"background 0.2s",
            }}>
              {loading&&mode==="full" ? <Spin/> : "Analyze"}
            </button>
          </div>

          {/* Refinement row */}
          <div style={{ display:"flex", gap:10, padding:"12px 20px", flexWrap:"wrap", alignItems:"center" }}>
            <input value={year} onChange={e=>setYear(e.target.value)} placeholder="Year"
              style={{ width:90, background:"#f5f0e8", border:"1px solid #d4c5a0", borderRadius:4,
                padding:"7px 10px", fontSize:13, color:"#1a1209", fontFamily:"Georgia,serif", outline:"none" }} />
            <select value={mediaType} onChange={e=>{setMediaType(e.target.value);setSeason("");setEpisode("");setTvMode("general");}} style={{
              background:"#f5f0e8", border:"1px solid #d4c5a0", borderRadius:4,
              padding:"7px 10px", fontSize:13, color:"#1a1209", fontFamily:"Georgia,serif", outline:"none", cursor:"pointer" }}>
              <option value="any">Any Type</option>
              <option value="movie">Movie</option>
              <option value="TV show">TV Show</option>
              <option value="documentary">Documentary</option>
            </select>
            {(year||mediaType!=="any") && (
              <button onClick={()=>{setYear("");setMediaType("any");setSeason("");setEpisode("");setTvMode("general");}} style={{
                background:"none", border:"1px solid #d4c5a0", borderRadius:4,
                padding:"7px 10px", fontSize:12, color:"#8a7a5a", cursor:"pointer", fontFamily:"Georgia,serif" }}>✕ Clear</button>
            )}
          </div>

          {/* TV mode row */}
          {mediaType==="TV show" && (
            <div style={{ padding:"0 20px 14px", display:"flex", flexWrap:"wrap", gap:10, alignItems:"center", borderTop:"1px dashed #d4c5a0", paddingTop:12 }}>
              <div style={{ display:"flex", border:"1px solid #d4c5a0", borderRadius:4, overflow:"hidden" }}>
                {[["general","📺 Whole Series"],["episode","🎬 Specific Episode"]].map(([val,label])=>(
                  <button key={val} onClick={()=>{setTvMode(val);setSeason("");setEpisode("");}} style={{
                    padding:"7px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Georgia,serif",
                    border:"none", letterSpacing:"0.05em",
                    background:tvMode===val?"#1a0f05":"#f5f0e8",
                    color:tvMode===val?"#ffd700":"#6b5c3e",
                  }}>{label}</button>
                ))}
              </div>
              {tvMode==="episode" && (
                <>
                  <input value={season} onChange={e=>setSeason(e.target.value.replace(/\D/g,""))} placeholder="Season #"
                    style={{ width:90, background:"#f5f0e8", border:"1px solid #d4c5a0", borderRadius:4,
                      padding:"7px 10px", fontSize:13, color:"#1a1209", fontFamily:"Georgia,serif", outline:"none" }} />
                  <input value={episode} onChange={e=>setEpisode(e.target.value.replace(/\D/g,""))} placeholder="Episode #"
                    style={{ width:100, background:"#f5f0e8", border:"1px solid #d4c5a0", borderRadius:4,
                      padding:"7px 10px", fontSize:13, color:"#1a1209", fontFamily:"Georgia,serif", outline:"none" }} />
                </>
              )}
            </div>
          )}

          {/* Perforation tear line */}
          <div style={{ borderTop:"2px dashed #d4c5a0", margin:"0 -2px", position:"relative" }}>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <div style={{ width:16, height:16, borderRadius:"50%", background:"#f5f0e8", marginTop:-8, marginLeft:-8, border:"2px solid #d4c5a0" }}/>
              <div style={{ width:16, height:16, borderRadius:"50%", background:"#f5f0e8", marginTop:-8, marginRight:-8, border:"2px solid #d4c5a0" }}/>
            </div>
          </div>

          {/* Ticket stub bottom */}
          <div style={{ padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
            <button onClick={()=>doSearch("vaw")} disabled={loading||!query.trim()} style={{
              display:"flex", alignItems:"center", gap:8, background:"transparent",
              border:"2px solid #c41e1e", borderRadius:4, padding:"8px 16px",
              color:"#c41e1e", fontSize:12, fontWeight:700, fontFamily:"Georgia,serif",
              cursor:loading||!query.trim()?"not-allowed":"pointer", letterSpacing:"0.08em",
              textTransform:"uppercase", opacity:!query.trim()?0.4:1,
            }}>
              🛡️ {loading&&mode==="vaw"?<Spin/>:"Quick VAW Check"}
            </button>
            <div style={{ fontSize:11, color:"#8a7a5a", fontFamily:"Georgia,serif", letterSpacing:"0.08em" }}>
              ADMIT ONE · AI-POWERED ANALYSIS
            </div>
          </div>
        </div>

        {/* Profile bar */}
        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:24, fontSize:13, color:"#8a7a5a", fontFamily:"Georgia,serif" }}>
          <span>Viewing as <strong style={{color:"#1a1209"}}>{activeProfile?.name}</strong> ·</span>
          {Object.entries(CATEGORIES).map(([k,cfg]) => {
            const lv=activeProfile?.comfort?.[k]||"headsup"; const cl=COMFORT[lv];
            return <span key={k} title={`${cfg.label}: ${cl.label}`} style={{
              fontSize:14,padding:"2px 8px",borderRadius:4,background:cl.bg,border:`1px solid ${cl.border}`,color:cl.color
            }}>{cfg.icon}</span>;
          })}
          <button onClick={()=>{setEditingProfile(activeProfile);setScreen("editProfile");}}
            style={{background:"none",border:"none",color:"#c41e1e",fontSize:13,cursor:"pointer",padding:0,marginLeft:2,fontFamily:"Georgia,serif"}}>
            Edit preferences
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background:"#fff5f5", border:"2px solid #fca5a5", borderRadius:6,
            padding:"14px 18px", marginBottom:24, fontFamily:"Georgia,serif" }}>
            <div style={{color:"#991b1b",fontSize:14}}>{typeof error==="string"?error:error.msg}</div>
            {error?.suggestion && (
              <button onClick={()=>{setQuery(error.suggestion);setError(null);}} style={{
                marginTop:8, background:"#fff", border:"2px solid #c41e1e", borderRadius:4,
                padding:"6px 14px", color:"#c41e1e", fontSize:13, fontWeight:700,
                cursor:"pointer", fontFamily:"Georgia,serif", letterSpacing:"0.06em" }}>
                Search "{error.suggestion}" →
              </button>
            )}
          </div>
        )}

        {/* Suggestions */}
        {!result&&!vawResult&&!loading&&!error && (
          <div>
            <FilmStrip />
            <div style={{ fontSize:11, color:"#8a7a5a", letterSpacing:"0.2em", textTransform:"uppercase", marginBottom:12, fontFamily:"Georgia,serif" }}>
              Now Playing
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {["Moana 2","Inside Out 2","Deadpool & Wolverine","The Notebook","Promising Young Woman","Game of Thrones"].map(t=>(
                <button key={t} onClick={()=>setQuery(t)} style={{
                  background:"#fffef5", border:"1px solid #d4c5a0", borderRadius:4,
                  padding:"7px 16px", color:"#6b5c3e", fontSize:13, cursor:"pointer",
                  fontFamily:"Georgia,serif", letterSpacing:"0.03em",
                }}>{t}</button>
              ))}
            </div>
          </div>
        )}

        {/* VAW Quick Result */}
        {vawResult&&!result && (
          <div style={{animation:"fadeUp 0.3s ease"}}>
            <FilmStrip />
            <div style={{ marginBottom:4 }}>
              <span style={{ fontSize:26, fontWeight:700, fontFamily:"Georgia,serif", letterSpacing:"-0.01em" }}>{vawResult.title}</span>
              {vawResult.year && <span style={{ fontSize:16, color:"#8a7a5a", marginLeft:10, fontFamily:"Georgia,serif" }}>{vawResult.year}</span>}
            </div>
            <VawCard vaw={vawResult.vaw} showExamples />
            <button onClick={()=>doSearch("full")} style={{
              background:"none", border:"none", color:"#c41e1e", fontSize:13,
              cursor:"pointer", padding:0, fontFamily:"Georgia,serif", letterSpacing:"0.04em" }}>
              → Run full analysis for timecodes &amp; more
            </button>
          </div>
        )}

        {/* Full Result */}
        {result && (
          <div style={{animation:"fadeUp 0.3s ease"}}>
            <FilmStrip />

            {/* Title card */}
            <div style={{ background:"#fffef5", border:"2px solid #d4c5a0", borderRadius:8,
              padding:"22px 24px", marginBottom:20, boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:12, flexWrap:"wrap", marginBottom:12 }}>
                <h2 style={{ fontSize:26, fontWeight:700, fontFamily:"Georgia,serif", letterSpacing:"-0.01em", color:"#1a1209", margin:0 }}>
                  {result.title}
                </h2>
                {result.year && <span style={{ fontSize:15, color:"#8a7a5a", fontFamily:"Georgia,serif", paddingTop:4 }}>{result.year}</span>}
                {result.rating && (
                  <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:3,
                    background:"#1a0f05", color:"#ffd700", letterSpacing:"0.15em", paddingTop:5 }}>
                    {result.rating}
                  </span>
                )}
              </div>
              <p style={{ fontSize:14, color:"#6b5c3e", lineHeight:1.8, margin:0, fontFamily:"Georgia,serif" }}>{result.summary}</p>
            </div>

            <VawCard vaw={result.vaw} />
            {skipMoments.length>0    && <MomentSection title="⏭️ Skip These" sub="Your profile flagged these" color="#991b1b" moments={skipMoments} />}
            {headsupMoments.length>0 && <MomentSection title="👀 Heads Up"   sub="Worth knowing about"      color="#92400e" moments={headsupMoments} />}
            {visibleMoments.length===0 && (
              <div style={{ textAlign:"center", padding:"40px 24px", background:"#f0fdf4",
                border:"2px solid #86efac", borderRadius:8, marginBottom:20 }}>
                <div style={{fontSize:32,marginBottom:8}}>✅</div>
                <div style={{fontWeight:700,color:"#15803d",marginBottom:4,fontFamily:"Georgia,serif",fontSize:16}}>All clear for {activeProfile?.name}!</div>
                <div style={{color:"#4a7c59",fontSize:14,fontFamily:"Georgia,serif"}}>No flagged content based on your comfort settings.</div>
              </div>
            )}
            <div style={{ background:"#faf6ed", border:"1px solid #d4c5a0", borderRadius:6,
              padding:"12px 16px", marginTop:16, fontSize:12, color:"#8a7a5a", lineHeight:1.7,
              fontFamily:"Georgia,serif", borderLeft:"3px solid #c41e1e" }}>
              <strong style={{color:"#6b5c3e"}}>⚠️ Please note:</strong> AI analysis may miss brief, implied, or background scenes.
              Timecodes are estimates. Always preview content yourself when accuracy matters.
            </div>
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        body { background:#f5f0e8; }
        input:focus, select:focus { outline:2px solid #c41e1e !important; outline-offset:1px; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        button:not(:disabled):hover { filter:brightness(0.93); }

        /* Marquee bulb chase animation */
        @keyframes bulbChase0 {
          0%,100% { opacity:1; filter:brightness(1); }
          33%      { opacity:0.15; filter:brightness(0.2); }
          66%      { opacity:0.6;  filter:brightness(0.6); }
        }
        @keyframes bulbChase1 {
          0%,100% { opacity:0.6;  filter:brightness(0.6); }
          33%      { opacity:1;    filter:brightness(1); }
          66%      { opacity:0.15; filter:brightness(0.2); }
        }
        @keyframes bulbChase2 {
          0%,100% { opacity:0.15; filter:brightness(0.2); }
          33%      { opacity:0.6;  filter:brightness(0.6); }
          66%      { opacity:1;    filter:brightness(1); }
        }
        .bulb-0 { animation: bulbChase0 0.9s ease-in-out infinite; }
        .bulb-1 { animation: bulbChase1 0.9s ease-in-out infinite; }
        .bulb-2 { animation: bulbChase2 0.9s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function VawCard({ vaw, showExamples=false }) {
  const present=vaw?.present; const sev=vaw?.severity||"none";
  return (
    <div style={{ borderRadius:6, padding:"16px 20px", marginBottom:18,
      background:present?SEV_BG[sev]:"#f0fdf4", border:`2px solid ${present?SEV_BORDER[sev]:"#86efac"}`,
      borderLeft:`5px solid ${present?SEV_COLOR[sev]:"#15803d"}` }}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <div style={{fontSize:22}}>{present?"🛡️":"✅"}</div>
        <div style={{flex:1}}>
          <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:"0.2em",color:"#8a7a5a",marginBottom:2,fontFamily:"Georgia,serif"}}>
            Violence Against Women
          </div>
          <div style={{fontWeight:700,fontSize:15,color:present?SEV_COLOR[sev]:"#15803d",fontFamily:"Georgia,serif"}}>
            {present?`Present · ${sev.charAt(0).toUpperCase()+sev.slice(1)} Severity`:"Not Present"}
          </div>
        </div>
        {present&&<div style={{padding:"4px 12px",borderRadius:3,fontSize:11,fontWeight:700,letterSpacing:"0.12em",
          background:SEV_COLOR[sev],color:"#fff"}}>{sev.toUpperCase()}</div>}
      </div>
      {present&&vaw?.description&&<p style={{marginTop:10,fontSize:13,color:"#6b5c3e",lineHeight:1.7,paddingLeft:34,fontFamily:"Georgia,serif"}}>{vaw.description}</p>}
      {showExamples&&present&&vaw?.examples?.length>0&&(
        <ul style={{marginTop:8,paddingLeft:52,color:"#6b5c3e",fontSize:13,lineHeight:1.8,fontFamily:"Georgia,serif"}}>
          {vaw.examples.map((ex,i)=><li key={i}>{ex}</li>)}
        </ul>
      )}
    </div>
  );
}

function MomentSection({ title, sub, color, moments }) {
  return (
    <div style={{marginBottom:18}}>
      <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:10}}>
        <h3 style={{fontSize:15,fontWeight:700,color,fontFamily:"Georgia,serif",letterSpacing:"0.03em"}}>{title}</h3>
        <span style={{fontSize:12,color:"#8a7a5a",fontFamily:"Georgia,serif"}}>{sub}</span>
      </div>
      <div style={{borderRadius:6,overflow:"hidden",border:"2px solid #d4c5a0",background:"#fffef5"}}>
        {moments.map((m,i)=>{
          const cfg=CATEGORIES[m.category]; const cl=COMFORT[m.comfort];
          return (
            <div key={i} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 18px",
              borderBottom:i<moments.length-1?"1px solid #ede8df":"none"}}>
              <div style={{fontFamily:"'Courier New',monospace",fontSize:13,color:"#8a7a5a",minWidth:58,letterSpacing:"0.05em"}}>{m.timecode}</div>
              <div style={{fontSize:11,padding:"3px 9px",borderRadius:3,whiteSpace:"nowrap",
                background:cl.bg,color:cl.color,border:`1px solid ${cl.border}`,fontWeight:700,letterSpacing:"0.06em"}}>
                {cfg?.icon} {cfg?.label}
              </div>
              <div style={{flex:1,fontSize:13,color:"#3a2e1e",lineHeight:1.6,fontFamily:"Georgia,serif"}}>{m.description}</div>
              {m.endTimecode&&<div style={{fontSize:12,color:"#8a7a5a",whiteSpace:"nowrap",fontFamily:"'Courier New',monospace"}}>→{m.endTimecode}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProfileManager({ profiles, activeId, onSelect, onEdit, onAdd, onDelete, onBack }) {
  return (
    <div style={{minHeight:"100vh",background:"#f5f0e8",fontFamily:"Georgia,serif"}}>
      <div style={{background:"#0f0a04",padding:"20px 24px",borderBottom:"3px solid #c41e1e",marginBottom:0}}>
        <div style={{maxWidth:480,margin:"0 auto",display:"flex",alignItems:"center",gap:14}}>
          <button onClick={onBack} style={{background:"none",border:"none",color:"#c41e1e",fontSize:14,cursor:"pointer",padding:0,fontFamily:"Georgia,serif",letterSpacing:"0.05em"}}>← Back</button>
          <h2 style={{fontSize:20,fontWeight:700,color:"#f5f0e8",letterSpacing:"0.05em"}}>WHO'S WATCHING?</h2>
        </div>
      </div>
      <div style={{maxWidth:480,margin:"0 auto",padding:"28px 20px 80px"}}>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {profiles.map(p=>(
            <div key={p.id} style={{display:"flex",alignItems:"center",gap:12,padding:"16px 18px",
              borderRadius:6,border:`2px solid ${p.id===activeId?"#c41e1e":"#d4c5a0"}`,
              background:p.id===activeId?"#fff9f0":"#fffef5"}}>
              <button onClick={()=>onSelect(p.id)} style={{flex:1,display:"flex",alignItems:"center",gap:14,background:"none",border:"none",cursor:"pointer",textAlign:"left"}}>
                <span style={{fontSize:30}}>{p.avatar}</span>
                <div>
                  <div style={{fontWeight:700,fontSize:15,fontFamily:"Georgia,serif",color:"#1a1209"}}>{p.name}</div>
                  <div style={{display:"flex",gap:4,marginTop:4}}>
                    {Object.entries(CATEGORIES).map(([k,cfg])=>{const lv=p.comfort?.[k]||"headsup";const cl=COMFORT[lv];return<span key={k} title={`${cfg.label}: ${cl.label}`} style={{fontSize:13,padding:"1px 5px",borderRadius:3,background:cl.bg,border:`1px solid ${cl.border}`}}>{cfg.icon}</span>;})}
                  </div>
                </div>
              </button>
              <button onClick={()=>onEdit(p)} style={{background:"#f5f0e8",border:"1px solid #d4c5a0",borderRadius:4,padding:"7px 9px",cursor:"pointer",fontSize:13}}>✏️</button>
              {profiles.length>1&&<button onClick={()=>onDelete(p.id)} style={{background:"#fff5f5",border:"1px solid #fca5a5",borderRadius:4,padding:"7px 9px",cursor:"pointer",fontSize:13}}>🗑️</button>}
            </div>
          ))}
          <button onClick={onAdd} style={{padding:"14px",borderRadius:6,border:"2px dashed #d4c5a0",
            background:"transparent",color:"#8a7a5a",fontSize:14,cursor:"pointer",fontFamily:"Georgia,serif"}}>＋ Add Profile</button>
        </div>
      </div>
    </div>
  );
}

function ProfileEditor({ profile, onSave, onCancel }) {
  const [name,setName]=useState(profile.name);
  const [avatar,setAvatar]=useState(profile.avatar);
  const [comfort,setComfort]=useState({...profile.comfort});
  return (
    <div style={{minHeight:"100vh",background:"#f5f0e8",fontFamily:"Georgia,serif"}}>
      <div style={{background:"#0f0a04",padding:"20px 24px",borderBottom:"3px solid #c41e1e"}}>
        <div style={{maxWidth:520,margin:"0 auto",display:"flex",alignItems:"center",gap:14}}>
          <button onClick={onCancel} style={{background:"none",border:"none",color:"#c41e1e",fontSize:14,cursor:"pointer",padding:0,fontFamily:"Georgia,serif"}}>← Cancel</button>
          <h2 style={{fontSize:20,fontWeight:700,color:"#f5f0e8",letterSpacing:"0.05em"}}>EDIT PROFILE</h2>
        </div>
      </div>
      <div style={{maxWidth:520,margin:"0 auto",padding:"28px 20px 80px"}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:20}}>
          {AVATARS.map(a=>(
            <button key={a} onClick={()=>setAvatar(a)} style={{fontSize:26,width:48,height:48,borderRadius:6,cursor:"pointer",
              background:a===avatar?"#fff9f0":"#fffef5",border:`2px solid ${a===avatar?"#c41e1e":"#d4c5a0"}`}}>{a}</button>
          ))}
        </div>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Profile name"
          style={{width:"100%",background:"#fffef5",border:"2px solid #d4c5a0",borderRadius:6,
            padding:"12px 16px",fontSize:15,color:"#1a1209",fontFamily:"Georgia,serif",marginBottom:24,outline:"none"}} />
        <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:"0.2em",color:"#8a7a5a",marginBottom:14}}>Content Comfort Settings</div>
        {Object.entries(CATEGORIES).map(([k,cfg])=>(
          <div key={k} style={{display:"flex",alignItems:"center",gap:12,marginBottom:14,paddingBottom:14,borderBottom:"1px solid #ede8df"}}>
            <span style={{fontSize:18,width:24}}>{cfg.icon}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:700,color:"#1a1209",fontFamily:"Georgia,serif"}}>{cfg.label}</div>
              <div style={{fontSize:12,color:"#8a7a5a"}}>{cfg.desc}</div>
            </div>
            <div style={{display:"flex",gap:6}}>
              {Object.entries(COMFORT).map(([lv,cl])=>(
                <button key={lv} onClick={()=>setComfort(p=>({...p,[k]:lv}))} style={{
                  padding:"5px 12px",borderRadius:3,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Georgia,serif",
                  background:comfort[k]===lv?cl.bg:"transparent",
                  color:comfort[k]===lv?cl.color:"#8a7a5a",
                  border:`2px solid ${comfort[k]===lv?cl.border:"#d4c5a0"}`
                }}>{cl.label}</button>
              ))}
            </div>
          </div>
        ))}
        <div style={{display:"flex",gap:20,marginBottom:28,marginTop:8,flexWrap:"wrap"}}>
          {[["fine","Hidden from results"],["headsup","Shown as advisory"],["skipit","Flagged to skip"]].map(([lv,desc])=>(
            <div key={lv} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"#6b5c3e",fontFamily:"Georgia,serif"}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:COMFORT[lv].color}}/>
              <strong style={{color:COMFORT[lv].color}}>{COMFORT[lv].label}</strong> — {desc}
            </div>
          ))}
        </div>
        <button onClick={()=>onSave({...profile,name,avatar,comfort})} disabled={!name.trim()} style={{
          width:"100%",background:name.trim()?"#c41e1e":"#d4c5a0",border:"none",borderRadius:6,padding:"14px",
          color:"#fff",fontSize:15,fontWeight:700,cursor:name.trim()?"pointer":"not-allowed",
          fontFamily:"Georgia,serif",letterSpacing:"0.1em",textTransform:"uppercase"
        }}>Save Profile</button>
      </div>
    </div>
  );
}

function Spin() {
  return <span style={{display:"inline-block",animation:"spin 0.7s linear infinite"}}>◌</span>;
}
