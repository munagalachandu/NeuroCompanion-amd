import { useState, useEffect, useRef, useCallback } from "react";

/* ─────────────────────────────────────────────────────────────
   CONFIG
───────────────────────────────────────────────────────────── */
const API = "http://localhost:8000";
const USE_MOCK = false;

const AGENTS = [
  { id:"simplify", label:"Simplify",    icon:"✦", color:"#C8F044", tagline:"Dense → Crystal clear",    desc:"Rewrites any content into plain, accessible formats. Choose your output style and toggle Dyslexic Mode for extra support.", helps:["Dyslexia","Reading difficulties","ESL learners"] },
  { id:"focus",    label:"Focus Mode",  icon:"◎", color:"#3ECFCF", tagline:"Stay locked in",            desc:"Pomodoro timers, tab-switch detection and optional camera attention tracking with a live focus score.", helps:["ADHD","Attention difficulties","Anxiety"] },
  { id:"vision",   label:"Vision Scan", icon:"◉", color:"#FF9F1C", tagline:"Images → Readable text",   desc:"Upload any photo, screenshot or scanned document. Extract text and pipe it straight into Simplify or Quiz.", helps:["Visual impairment","Print disabilities","Handwriting"] },
  { id:"quiz",     label:"Quiz Mode",   icon:"⬡", color:"#FF6B6B", tagline:"Test your knowledge",      desc:"Paste content, pick a question type, answer and get instant AI feedback. MCQ, fill-in-blank, true/false or short answer.", helps:["Memory","Exam prep","Active recall"] },
];

const SIMPLIFY_MODES = [
  { id:"paragraph", label:"Paragraph", icon:"¶" },
  { id:"bullet",    label:"Bullets",   icon:"→" },
  { id:"keywords",  label:"Keywords",  icon:"#" },
  { id:"summary",   label:"Summary",   icon:"◈" },
  { id:"steps",     label:"Steps",     icon:"①" },
];

const FONT_OPTIONS = [
  { id:"outfit",       label:"Outfit",       css:"'Outfit',sans-serif" },
  { id:"opendyslexic", label:"OpenDyslexic", css:"'OpenDyslexic',sans-serif" },
  { id:"serif",        label:"Serif",        css:"'Instrument Serif',serif" },
  { id:"mono",         label:"Mono",         css:"'JetBrains Mono',monospace" },
  { id:"georgia",      label:"Georgia",      css:"Georgia,serif" },
];

const COLOR_THEMES = [
  { id:"dark",  label:"Dark",  bg:"#07080d", text:"rgba(255,255,255,0.85)", card:"rgba(255,255,255,0.04)", isDark:true },
  { id:"cream", label:"Cream", bg:"#fdf6e3", text:"#2d2a1e",               card:"rgba(0,0,0,0.04)",       isDark:false },
  { id:"paper", label:"Paper", bg:"#f5f0e8", text:"#333",                  card:"rgba(0,0,0,0.05)",       isDark:false },
  { id:"night", label:"Night", bg:"#0d1117", text:"rgba(255,255,255,0.8)", card:"rgba(255,255,255,0.03)", isDark:true },
  { id:"mint",  label:"Mint",  bg:"#e8f5f0", text:"#1a3329",               card:"rgba(0,0,0,0.04)",       isDark:false },
];

const POMODORO_PRESETS = [
  { id:"pomodoro", label:"Pomodoro",   work:25, brk:5 },
  { id:"short",    label:"Short",      work:10, brk:2 },
  { id:"long",     label:"Long Focus", work:50, brk:10 },
  { id:"exam",     label:"Exam",       work:45, brk:15 },
  { id:"manual",   label:"Manual",     work:null, brk:null },
];

const QUIZ_TYPES = [
  { id:"mcq",          label:"MCQ",          icon:"◉" },
  { id:"fill_blank",   label:"Fill Blank",   icon:"▭" },
  { id:"true_false",   label:"True / False", icon:"⊤" },
  { id:"short_answer", label:"Short Answer", icon:"✎" },
];

const EXAMPLES = [
  "Photosynthesis is the process by which plants use sunlight, water and carbon dioxide to produce oxygen and energy in the form of sugar.",
  "The French Revolution began in 1789 when economic crisis, social inequality and weak leadership converged to destabilise the monarchy.",
  "Mitochondria are membrane-bound organelles in eukaryotic cells that generate most of the cell's supply of ATP through cellular respiration.",
];

/* ─────────────────────────────────────────────────────────────
   API CALLS
───────────────────────────────────────────────────────────── */
const apiSimplify = async (text, mode, dyslexic) => {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 900));
    const maps = {
      paragraph:`Here's the plain version:\n\nThis content is about a process that has a clear sequence. One thing leads to the next, and the end result is something useful.\n\nThe core idea is simple once you strip away the technical language. Remember the sequence and the facts will stick.`,
      bullet:`→ ${text.split(" ").slice(0,5).join(" ")}... is the central topic\n→ A sequence of connected steps drives the process\n→ Each step depends on conditions being right\n→ The final output is measurable and observable\n→ This appears in exams — know the sequence cold`,
      keywords:`PHOTOSYNTHESIS\nThe process of turning light energy into food energy inside plant cells.\n\nCHLOROPHYLL\nA green pigment that absorbs sunlight to power the reaction.\n\nGLUCOSE\nThe sugar produced, used by the plant for energy and growth.\n\nCARBON DIOXIDE\nA gas from the air that provides the carbon atoms for glucose.\n\nOXYGEN\nReleased into the air as a by-product of the reaction.`,
      summary:`In one sentence: ${text.split(".")[0]?.trim()}.\n\nThis is the whole idea — everything else is supporting detail around that core concept.`,
      steps:`Step 1: Identify what is being converted or changed in this process.\n\nStep 2: List the inputs — what goes in to make it happen.\n\nStep 3: List the outputs — what comes out at the end.\n\nStep 4: Note where and when this process occurs.\n\nStep 5: Connect it to one real-world example you already know.`,
    };
    return { output: maps[mode] || maps.paragraph, mode, dyslexic_mode: dyslexic };
  }
  const res = await fetch(`${API}/simplify`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, mode, dyslexic_mode: dyslexic, reading_level: "simple" }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

const apiQuizGenerate = async (text, question_type, num_questions) => {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 1200));
    const q = question_type;
    if (q === "mcq") return { source_summary: "Content about biological processes.", questions:[
      { id:1, type:"mcq", question:"What is the primary purpose of the process described?", options:["A. To break down molecules","B. To produce energy and useful compounds","C. To absorb minerals from soil","D. To release carbon dioxide"], answer:"B" },
      { id:2, type:"mcq", question:"Where does this process primarily take place?", options:["A. Mitochondria","B. Nucleus","C. Chloroplast","D. Cell wall"], answer:"C" },
      { id:3, type:"mcq", question:"Which input is captured from the surrounding environment?", options:["A. Oxygen","B. Nitrogen","C. Carbon dioxide","D. Hydrogen"], answer:"C" },
    ]};
    if (q === "true_false") return { source_summary:"Content about a biological process.", questions:[
      { id:1, type:"true_false", question:"This process produces oxygen as a by-product.", answer:"True" },
      { id:2, type:"true_false", question:"This process occurs in the mitochondria.", answer:"False" },
      { id:3, type:"true_false", question:"Sunlight is required for this process to work.", answer:"True" },
    ]};
    if (q === "fill_blank") return { source_summary:"Content about a biological process.", questions:[
      { id:1, type:"fill_blank", question:"What fills the blank?", blank_sentence:"Plants use ___ to capture energy from sunlight.", answer:"chlorophyll" },
      { id:2, type:"fill_blank", question:"What fills the blank?", blank_sentence:"The by-product released into the air is ___.", answer:"oxygen" },
      { id:3, type:"fill_blank", question:"What fills the blank?", blank_sentence:"This process takes place in the ___ of plant cells.", answer:"chloroplast" },
    ]};
    return { source_summary:"Content about a biological process.", questions:[
      { id:1, type:"short_answer", question:"Explain in your own words what this process is and why it matters for life on Earth." },
      { id:2, type:"short_answer", question:"What would happen if the key input were removed? Describe the chain of effects." },
    ]};
  }
  const res = await fetch(`${API}/quiz/generate`, {
    method: "POST", headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ text, question_type, num_questions }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

const apiQuizEvaluate = async (questions, answers) => {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 1000));
    const results = questions.map((q, i) => {
      const ua = answers[i] || "";
      const correct = i % 3 !== 2;
      return { id:q.id, correct, user_answer:ua, correct_answer: q.answer || "B", explanation: correct ? "Correct! That's exactly right — well done." : "Not quite. Review this section and try again." };
    });
    const score = results.filter(r=>r.correct).length;
    const pct = Math.round((score/results.length)*100);
    return { score, total:results.length, percentage:pct, grade: pct>=90?"A":pct>=75?"B":pct>=60?"C":pct>=40?"D":"F", results, study_tip:"Focus on the areas you got wrong by re-reading the source material slowly." };
  }
  const res = await fetch(`${API}/quiz/evaluate`, {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ questions, answers: answers.map((a,i)=>({id:questions[i].id, answer:a||""})) }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

const apiAnalyzeFrame = async (frameB64, sessionId) => {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 200));
    return { looking_away:false, phone_detected:false, eyes_closed:false, confidence:0.92, warning_message:null };
  }
  const res = await fetch(`${API}/focus/analyze-frame`, {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ frame:frameB64, session_id:sessionId }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

const apiVision = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API}/vision/read`, { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Server error ${res.status}`);
  }
  const data = await res.json();
  if (data.status !== "success" || !data.paragraphs?.length) {
    throw new Error("No text extracted from document.");
  }
  return data.paragraphs;
};

/* ─────────────────────────────────────────────────────────────
   GLOBAL STYLES — with responsive fixes
───────────────────────────────────────────────────────────── */
const GlobalStyles = ({ theme, dyslexic, fontSize, fontFamily, lineHeight }) => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
    @font-face{font-family:'OpenDyslexic';src:url('https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/fonts/OpenDyslexic-Regular.otf');}
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html{scroll-behavior:smooth;}
    body{background:${theme.bg};color:${theme.text};transition:background 0.4s,color 0.4s;overflow-x:hidden;}
    ::-webkit-scrollbar{width:3px;}
    ::-webkit-scrollbar-thumb{background:rgba(128,128,128,0.25);border-radius:2px;}
    textarea,input{outline:none;}
    button{cursor:pointer;}
    img,video,canvas{max-width:100%;}
    ${dyslexic?`.output-text{font-family:'OpenDyslexic',sans-serif!important;letter-spacing:0.12em!important;word-spacing:0.22em!important;line-height:2.2!important;max-width:62ch!important;}`:""}
    .output-text{font-family:${fontFamily};font-size:${fontSize}px;line-height:${lineHeight};transition:font-size 0.2s,line-height 0.2s;}
    @keyframes fadeUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes drift{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(28px,-22px) scale(1.05)}}
    @keyframes drift2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-18px,28px) scale(0.96)}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
    @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
    @keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
    @keyframes glow{0%,100%{box-shadow:0 0 20px #C8F04444}50%{box-shadow:0 0 55px #C8F04488}}
    @keyframes pageIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
    @keyframes timerPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.75;transform:scale(1.015)}}
    @keyframes camPulse{0%,100%{box-shadow:0 0 0 0 #3ECFCF44}70%{box-shadow:0 0 0 8px transparent}}
    @keyframes warnShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
    .agent-icon{transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1);}
    .agent-card:hover .agent-icon{transform:scale(1.16) rotate(-5deg);}
    .pill:hover{transform:scale(1.04);}
    .pill{transition:all 0.2s cubic-bezier(0.34,1.56,0.64,1);}

    /* ── Responsive grid helpers ── */
    .focus-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;}
    .cam-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start;}
    .agent-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;}
    .home-hero{display:flex;align-items:center;gap:80px;}
    .home-features{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
    .quiz-header{display:grid;grid-template-columns:1fr auto;gap:16px;align-items:end;}
    .display-panel{position:absolute;top:calc(100% + 8px);right:0;background:${theme.isDark?"#111318":"#fff"};border:1px solid ${theme.isDark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.12)"};border-radius:14px;padding:20px;width:min(320px, calc(100vw - 48px));z-index:200;box-shadow:0 20px 60px rgba(0,0,0,0.4);animation:fadeUp 0.2s both;}

    @media(max-width:900px){
      .focus-grid{grid-template-columns:1fr;}
      .home-hero{flex-direction:column;gap:40px;}
      .home-features{grid-template-columns:1fr;}
    }
    @media(max-width:700px){
      .agent-tabs{grid-template-columns:repeat(2,1fr);}
      .cam-grid{grid-template-columns:1fr;}
      .quiz-header{grid-template-columns:1fr;}
    }
    @media(max-width:480px){
      .agent-tabs{grid-template-columns:repeat(2,1fr);}
    }
  `}</style>
);

/* ─────────────────────────────────────────────────────────────
   TYPEWRITER
───────────────────────────────────────────────────────────── */
const TypeWriter = ({ text, speed=11 }) => {
  const [out,setOut]=useState("");
  useEffect(()=>{
    setOut(""); let i=0;
    const iv=setInterval(()=>{ setOut(text.slice(0,i)); i++; if(i>text.length) clearInterval(iv); },speed);
    return ()=>clearInterval(iv);
  },[text]);
  return <span style={{whiteSpace:"pre-wrap"}}>{out}<span style={{animation:out.length<text.length?"blink 1s infinite":"none",opacity:out.length<text.length?1:0}}>|</span></span>;
};

/* ─────────────────────────────────────────────────────────────
   DISPLAY OPTIONS PANEL
───────────────────────────────────────────────────────────── */
const DisplayPanel = ({ s, onChange, theme }) => {
  const [open,setOpen]=useState(false);
  const { isDark } = theme;
  const border = isDark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.12)";
  const panelBg = isDark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.04)";
  const t40 = isDark?"rgba(255,255,255,0.4)":"rgba(0,0,0,0.4)";
  const t70 = isDark?"rgba(255,255,255,0.7)":"rgba(0,0,0,0.7)";
  return (
    <div style={{position:"relative"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{background:open?"#C8F044":panelBg,border:`1px solid ${open?"#C8F044":border}`,color:open?"#07080d":t70,borderRadius:8,padding:"7px 14px",fontSize:12,fontFamily:"'JetBrains Mono',monospace",transition:"all 0.2s",display:"flex",alignItems:"center",gap:6}}>
        ⚙ Display
      </button>
      {open&&(
        <div className="display-panel">
          <div style={{marginBottom:16}}>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:t40,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:8}}>Font Size — {s.fontSize}px</div>
            <input type="range" min={12} max={24} value={s.fontSize} onChange={e=>onChange("fontSize",+e.target.value)} style={{width:"100%",accentColor:"#C8F044"}}/>
          </div>
          <div style={{marginBottom:16}}>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:t40,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:8}}>Line Height — {s.lineHeight}x</div>
            <input type="range" min={1.4} max={3.0} step={0.1} value={s.lineHeight} onChange={e=>onChange("lineHeight",+e.target.value)} style={{width:"100%",accentColor:"#C8F044"}}/>
          </div>
          <div style={{marginBottom:16}}>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:t40,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:8}}>Font Family</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {FONT_OPTIONS.map(f=>(
                <button key={f.id} onClick={()=>onChange("fontFamily",f.css)} style={{background:s.fontFamily===f.css?"#C8F044":panelBg,border:`1px solid ${s.fontFamily===f.css?"#C8F044":border}`,color:s.fontFamily===f.css?"#07080d":t70,borderRadius:6,padding:"5px 10px",fontSize:11,fontFamily:f.css,transition:"all 0.2s"}}>{f.label}</button>
              ))}
            </div>
          </div>
          <div style={{marginBottom:16}}>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:t40,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:8}}>Background</div>
            <div style={{display:"flex",gap:8}}>
              {COLOR_THEMES.map(t=>(
                <button key={t.id} onClick={()=>onChange("theme",t)} title={t.label} style={{width:28,height:28,background:t.bg,border:`2.5px solid ${s.theme.id===t.id?"#C8F044":border}`,borderRadius:"50%",transition:"all 0.2s"}}/>
              ))}
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <div style={{fontFamily:"'Outfit',sans-serif",fontWeight:600,fontSize:13}}>Dyslexic Mode</div>
              <div style={{fontFamily:"'Outfit',sans-serif",fontSize:11,color:t40,marginTop:2}}>OpenDyslexic font + wider spacing</div>
            </div>
            <button onClick={()=>onChange("dyslexic",!s.dyslexic)} style={{width:44,height:24,background:s.dyslexic?"#C8F044":panelBg,border:`1px solid ${s.dyslexic?"#C8F044":border}`,borderRadius:12,position:"relative",transition:"all 0.3s",flexShrink:0}}>
              <div style={{width:18,height:18,background:s.dyslexic?"#07080d":t40,borderRadius:"50%",position:"absolute",top:2,left:s.dyslexic?22:2,transition:"left 0.3s"}}/>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   SIMPLIFY MODULE
───────────────────────────────────────────────────────────── */
const SimplifyModule = ({ settings, theme, initialText="" }) => {
  const [mode,setMode]=useState("paragraph");
  const [input,setInput]=useState(initialText);
  const [output,setOutput]=useState(null);
  const [loading,setLoading]=useState(false);
  const [speaking,setSpeaking]=useState(false);
  const [error,setError]=useState(null);
  const { isDark } = theme;
  const border=isDark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.1)";
  const cardBg=isDark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.03)";
  const t40=isDark?"rgba(255,255,255,0.4)":"rgba(0,0,0,0.4)";
  const t70=isDark?"rgba(255,255,255,0.7)":"rgba(0,0,0,0.7)";

  const run=async()=>{
    if(!input.trim()) return;
    setLoading(true); setOutput(null); setError(null);
    try{ const res=await apiSimplify(input,mode,settings.dyslexic); setOutput(res.output); }
    catch(e){ setError(e.message); }
    setLoading(false);
  };
  const speak=()=>{
    if(!output) return;
    if(speaking){window.speechSynthesis.cancel();setSpeaking(false);return;}
    const u=new SpeechSynthesisUtterance(output.replace(/[→●◎★#¶①]/g,""));
    u.rate=0.88; u.onend=()=>setSpeaking(false);
    window.speechSynthesis.speak(u); setSpeaking(true);
  };

  return (
    <div style={{animation:"pageIn 0.4s both",minWidth:0}}>
      <div style={{marginBottom:22}}>
        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:t40,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:12}}>Output Format</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {SIMPLIFY_MODES.map(m=>(
            <button key={m.id} onClick={()=>setMode(m.id)} className="pill" style={{background:mode===m.id?"#C8F044":cardBg,border:`1.5px solid ${mode===m.id?"#C8F044":border}`,color:mode===m.id?"#07080d":t70,borderRadius:"100px",padding:"9px 18px",fontSize:13,fontFamily:"'Outfit',sans-serif",fontWeight:mode===m.id?600:400,display:"flex",alignItems:"center",gap:7}}>
              <span style={{fontFamily:"'JetBrains Mono',monospace"}}>{m.icon}</span>{m.label}
            </button>
          ))}
        </div>
      </div>
      {settings.dyslexic&&(
        <div style={{marginBottom:14,padding:"10px 16px",background:"#C8F04415",border:"1px solid #C8F04444",borderRadius:10,display:"flex",alignItems:"center",gap:10}}>
          <span style={{color:"#C8F044",fontSize:13,flexShrink:0}}>✦</span>
          <span style={{fontFamily:"'Outfit',sans-serif",fontSize:13,color:"#C8F044"}}>Dyslexic Mode active — OpenDyslexic font + wider spacing applied to output</span>
        </div>
      )}
      <div style={{marginBottom:12}}>
        <div style={{background:cardBg,border:`1.5px solid rgba(200,240,68,0.22)`,borderRadius:16,overflow:"hidden"}}>
          <textarea value={input} onChange={e=>setInput(e.target.value)} placeholder="Paste any text — textbook chapter, article, notes..." rows={6}
            style={{width:"100%",padding:"22px 24px",background:"transparent",border:"none",color:theme.text,fontFamily:"'Outfit',sans-serif",fontSize:15,lineHeight:1.75,fontWeight:300,resize:"vertical",minHeight:120}}/>
          <div style={{padding:"10px 18px",borderTop:`1px solid ${border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {EXAMPLES.map((ex,i)=>(
                <button key={i} onClick={()=>setInput(ex)} style={{background:cardBg,border:`1px solid ${border}`,color:t40,borderRadius:6,padding:"5px 10px",fontSize:11,fontFamily:"'JetBrains Mono',monospace",transition:"all 0.2s"}}
                  onMouseEnter={e=>{e.currentTarget.style.color=theme.text;e.currentTarget.style.borderColor="#C8F04466";}}
                  onMouseLeave={e=>{e.currentTarget.style.color=t40;e.currentTarget.style.borderColor=border;}}
                >eg {i+1}</button>
              ))}
            </div>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:t40,flexShrink:0}}>{input.length}ch</span>
          </div>
        </div>
      </div>
      {error&&<div style={{marginBottom:12,padding:"10px 16px",background:"#FF6B6B15",border:"1px solid #FF6B6B55",borderRadius:10,fontFamily:"'Outfit',sans-serif",fontSize:13,color:"#FF6B6B"}}>⚠ {error}</div>}
      <button onClick={run} disabled={!input.trim()||loading} style={{width:"100%",background:!input.trim()?cardBg:loading?"rgba(200,240,68,0.3)":"#C8F044",color:!input.trim()||loading?t40:"#07080d",border:"none",borderRadius:12,padding:"16px",fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:15,marginBottom:28,transition:"all 0.3s",display:"flex",alignItems:"center",justifyContent:"center",gap:10,boxShadow:input.trim()&&!loading?"0 0 28px #C8F04433":"none"}}>
        {loading?<><span style={{animation:"spin 1s linear infinite",display:"inline-block"}}>◎</span>Simplifying…</>:`✦ Simplify as ${SIMPLIFY_MODES.find(m=>m.id===mode)?.label}`}
      </button>
      {output&&(
        <div style={{background:cardBg,border:"1.5px solid #C8F04444",borderRadius:18,overflow:"hidden",animation:"fadeUp 0.4s both"}}>
          <div style={{padding:"16px 24px",borderBottom:"1px solid #C8F04422",background:"#C8F04408",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
            <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
              <span style={{color:"#C8F044",fontSize:18,flexShrink:0}}>✦</span>
              <div style={{minWidth:0}}>
                <div style={{fontFamily:"'Instrument Serif',serif",fontSize:17}}>Simplified · {SIMPLIFY_MODES.find(m=>m.id===mode)?.label}</div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:t40,marginTop:2,letterSpacing:"0.08em"}}>SIMPLIFY AGENT → {mode.toUpperCase()}{settings.dyslexic?" · DYSLEXIC":""}</div>
              </div>
            </div>
            <button onClick={speak} style={{background:speaking?"#C8F044":cardBg,border:`1px solid ${speaking?"#C8F044":border}`,color:speaking?"#07080d":t70,borderRadius:8,padding:"7px 14px",fontSize:12,fontFamily:"'JetBrains Mono',monospace",transition:"all 0.2s",flexShrink:0}}>
              {speaking?"◈ stop":"◈ listen"}
            </button>
          </div>
          <div style={{padding:"28px 24px"}}><div className="output-text" style={{color:theme.text}}><TypeWriter text={output} speed={10}/></div></div>
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   CAMERA FOCUS OVERLAY
───────────────────────────────────────────────────────────── */
const CameraFocus = ({ onDistraction, onClose, theme, running }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);
  const sessionId = useRef(`sess_${Date.now()}`);
  const [camStatus, setCamStatus] = useState("requesting");
  const [warning, setWarning] = useState(null);
  const [stats, setStats] = useState({ frames:0, distractions:0, lastConfidence:null });
  const { isDark } = theme;

  useEffect(() => {
    let stream = null;
    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video:{ width:320, height:240, facingMode:"user" } });
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
        setCamStatus("active");
      } catch { setCamStatus("denied"); }
    };
    start();
    return () => { if (stream) stream.getTracks().forEach(t=>t.stop()); };
  }, []);

  useEffect(() => {
    if (camStatus !== "active" || !running) { clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) return;
      const ctx = canvasRef.current.getContext("2d");
      ctx.drawImage(videoRef.current, 0, 0, 320, 240);
      const b64 = canvasRef.current.toDataURL("image/jpeg", 0.6).split(",")[1];
      try {
        const result = await apiAnalyzeFrame(b64, sessionId.current);
        const distracted = result.looking_away || result.phone_detected || result.eyes_closed;
        setStats(s => ({ frames:s.frames+1, distractions:s.distractions+(distracted?1:0), lastConfidence:result.confidence }));
        if (distracted) { setWarning(result.warning_message); onDistraction(); setTimeout(()=>setWarning(null),3500); }
        else { setWarning(null); }
      } catch {}
    }, 2000);
    return () => clearInterval(intervalRef.current);
  }, [camStatus, running]);

  const attentionPct = stats.frames > 0 ? Math.round(((stats.frames-stats.distractions)/stats.frames)*100) : 100;
  const attColor = attentionPct >= 80 ? "#C8F044" : attentionPct >= 50 ? "#FF9F1C" : "#FF6B6B";
  const border = isDark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.1)";
  const cardBg = isDark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)";
  const t40 = isDark?"rgba(255,255,255,0.4)":"rgba(0,0,0,0.4)";

  return (
    <div style={{background:cardBg,border:`1.5px solid #3ECFCF55`,borderRadius:18,padding:"20px",position:"relative",overflow:"hidden",minWidth:0}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:camStatus==="active"?"#C8F044":"#FF6B6B",flexShrink:0,animation:camStatus==="active"&&running?"camPulse 2s infinite":"none"}}/>
          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:"#3ECFCF",letterSpacing:"0.1em",textTransform:"uppercase"}}>
            {camStatus==="requesting"?"Requesting camera…":camStatus==="denied"?"Camera denied":running?"Tracking attention":"Camera ready"}
          </span>
        </div>
        <button onClick={onClose} style={{background:"transparent",border:`1px solid ${border}`,color:t40,borderRadius:6,padding:"4px 10px",fontSize:11,fontFamily:"'JetBrains Mono',monospace",flexShrink:0}}>✕ close</button>
      </div>

      {camStatus==="denied"&&(
        <div style={{padding:"16px",background:"#FF6B6B15",border:"1px solid #FF6B6B44",borderRadius:12,fontFamily:"'Outfit',sans-serif",fontSize:13,color:"#FF6B6B",textAlign:"center"}}>
          Camera access was denied. Please allow camera access in your browser settings and refresh.
        </div>
      )}

      {camStatus==="active"&&(
        <div className="cam-grid">
          {/* Camera feed */}
          <div style={{position:"relative",borderRadius:12,overflow:"hidden",border:`2px solid ${running?"#3ECFCF44":border}`,minWidth:0}}>
            <video ref={videoRef} style={{width:"100%",display:"block",borderRadius:10,transform:"scaleX(-1)"}} muted playsInline/>
            <canvas ref={canvasRef} width={320} height={240} style={{display:"none"}}/>
            {warning&&(
              <div style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(255,107,107,0.92)",padding:"10px 14px",animation:"warnShake 0.4s",display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:16,flexShrink:0}}>{warning.split(" ")[0]}</span>
                <span style={{fontFamily:"'Outfit',sans-serif",fontSize:12,color:"#fff",fontWeight:600}}>{warning.slice(warning.indexOf(" ")+1)}</span>
              </div>
            )}
            {!running&&(
              <div style={{position:"absolute",inset:0,background:"rgba(7,8,13,0.6)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:"rgba(255,255,255,0.5)",letterSpacing:"0.1em"}}>start timer to track</span>
              </div>
            )}
          </div>

          {/* Stats */}
          <div style={{display:"flex",flexDirection:"column",gap:10,minWidth:0}}>
            <div style={{background:isDark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.03)",border:`1px solid ${attColor}44`,borderRadius:12,padding:"14px",textAlign:"center"}}>
              <div style={{fontFamily:"'Instrument Serif',serif",fontSize:36,color:attColor,lineHeight:1}}>{attentionPct}%</div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:t40,marginTop:4,letterSpacing:"0.1em",textTransform:"uppercase"}}>Attention Rate</div>
            </div>
            {[
              { label:"Frames scanned", value:stats.frames },
              { label:"Distractions", value:stats.distractions, bad:stats.distractions>3 },
              { label:"Confidence", value:stats.lastConfidence!=null?`${Math.round(stats.lastConfidence*100)}%`:"—" },
            ].map(s=>(
              <div key={s.label} style={{background:s.bad?"#FF6B6B10":isDark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.03)",border:`1px solid ${s.bad?"#FF6B6B44":border}`,borderRadius:10,padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:t40,letterSpacing:"0.06em"}}>{s.label}</span>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,color:s.bad?"#FF6B6B":"#3ECFCF",fontWeight:500,flexShrink:0}}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   FOCUS MODULE
───────────────────────────────────────────────────────────── */
const FocusModule = ({ theme }) => {
  const [preset,setPreset]=useState("pomodoro");
  const [manualMins,setManualMins]=useState(20);
  const [phase,setPhase]=useState("work");
  const [timeLeft,setTimeLeft]=useState(25*60);
  const [running,setRunning]=useState(false);
  const [cycle,setCycle]=useState(0);
  const [tabSwitches,setTabSwitches]=useState(0);
  const [activeTime,setActiveTime]=useState(0);
  const [sessionDone,setSessionDone]=useState(false);
  const [focusScore,setFocusScore]=useState(null);
  const [tabWarning,setTabWarning]=useState(false);
  const [camMode,setCamMode]=useState(false);
  const [camDistractions,setCamDistractions]=useState(0);
  const ivRef=useRef(null);
  const activeRef=useRef(0), totalRef=useRef(0), tabRef=useRef(0), camRef=useRef(0);
  const { isDark }=theme;
  const border=isDark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.1)";
  const cardBg=isDark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.03)";
  const t40=isDark?"rgba(255,255,255,0.4)":"rgba(0,0,0,0.4)";
  const t70=isDark?"rgba(255,255,255,0.7)":"rgba(0,0,0,0.7)";
  const sel=POMODORO_PRESETS.find(p=>p.id===preset);

  useEffect(()=>{
    const h=()=>{ if(document.hidden&&running){ tabRef.current+=1; setTabSwitches(tabRef.current); setTabWarning(true); setRunning(false); clearInterval(ivRef.current); setTimeout(()=>setTabWarning(false),4000); } };
    document.addEventListener("visibilitychange",h);
    return ()=>document.removeEventListener("visibilitychange",h);
  },[running]);

  const computeScore=()=>{
    const tabPenalty=tabRef.current*8;
    const camPenalty=camRef.current*5;
    const raw=totalRef.current>0?Math.round((activeRef.current/totalRef.current)*100):100;
    return Math.max(0, raw-tabPenalty-camPenalty);
  };

  const startTimer=()=>{
    const mins=preset==="manual"?manualMins:(sel?.work||25);
    setTimeLeft(mins*60); setPhase("work"); setRunning(true);
    setSessionDone(false); setFocusScore(null);
    setTabSwitches(0); setActiveTime(0); setCamDistractions(0);
    tabRef.current=0; activeRef.current=0; totalRef.current=0; camRef.current=0;
  };

  const stopTimer=()=>{ clearInterval(ivRef.current); setRunning(false); setFocusScore(computeScore()); setSessionDone(true); };

  const resetTimer=()=>{
    clearInterval(ivRef.current); setRunning(false); setSessionDone(false); setFocusScore(null);
    const mins=preset==="manual"?manualMins:(sel?.work||25);
    setTimeLeft(mins*60); setPhase("work"); setTabSwitches(0); setCamDistractions(0);
    activeRef.current=0; totalRef.current=0; tabRef.current=0; camRef.current=0;
  };

  useEffect(()=>{
    if(!running){clearInterval(ivRef.current);return;}
    ivRef.current=setInterval(()=>{
      activeRef.current+=1; totalRef.current+=1; setActiveTime(a=>a+1);
      setTimeLeft(t=>{
        if(t<=1){
          if(phase==="work"&&sel?.brk){ setPhase("break"); setCycle(c=>c+1); return sel.brk*60; }
          else{ clearInterval(ivRef.current); setRunning(false); setFocusScore(computeScore()); setSessionDone(true); return 0; }
        }
        return t-1;
      });
    },1000);
    return ()=>clearInterval(ivRef.current);
  },[running,phase]);

  useEffect(()=>{ if(!running){ const m=preset==="manual"?manualMins:(sel?.work||25); setTimeLeft(m*60); setPhase("work"); } },[preset,manualMins]);

  const handleCamDistraction=()=>{ camRef.current+=1; setCamDistractions(d=>d+1); };

  const mm=Math.floor(timeLeft/60), ss=String(timeLeft%60).padStart(2,"0");
  const totalSecs=(preset==="manual"?manualMins:(phase==="work"?sel?.work:sel?.brk)||25)*60;
  const progress=1-timeLeft/totalSecs;
  const circ=2*Math.PI*80;
  const phaseColor=phase==="work"?"#3ECFCF":"#C8F044";
  const scoreColor=focusScore!=null?(focusScore>=80?"#C8F044":focusScore>=50?"#FF9F1C":"#FF6B6B"):"#3ECFCF";

  return (
    <div style={{animation:"pageIn 0.4s both",minWidth:0}}>
      {tabWarning&&(
        <div style={{marginBottom:16,padding:"12px 18px",background:"#FF6B6B18",border:"1px solid #FF6B6B88",borderRadius:12,display:"flex",alignItems:"center",gap:12,animation:"warnShake 0.4s",flexWrap:"wrap"}}>
          <span style={{fontSize:18,flexShrink:0}}>⚠</span>
          <div>
            <div style={{fontFamily:"'Outfit',sans-serif",fontWeight:600,fontSize:14,color:"#FF6B6B"}}>Tab switch detected — timer paused</div>
            <div style={{fontFamily:"'Outfit',sans-serif",fontSize:12,color:t40}}>Stay on this tab to protect your focus score.</div>
          </div>
        </div>
      )}

      <div className="focus-grid" style={{marginBottom:20}}>
        {/* Timer */}
        <div style={{background:cardBg,border:`1.5px solid ${phaseColor}44`,borderRadius:20,padding:"32px 24px",textAlign:"center",minWidth:0}}>
          <div style={{position:"relative",width:"min(200px, 100%)",height:"min(200px, 100vw - 96px)",margin:"0 auto 22px"}}>
            <svg width="100%" height="100%" viewBox="0 0 200 200" style={{transform:"rotate(-90deg)"}}>
              <circle cx="100" cy="100" r="80" fill="none" stroke={border} strokeWidth="8"/>
              <circle cx="100" cy="100" r="80" fill="none" stroke={phaseColor} strokeWidth="8"
                strokeDasharray={circ} strokeDashoffset={circ*(1-progress)} strokeLinecap="round"
                style={{transition:"stroke-dashoffset 1s linear,stroke 0.5s"}}/>
            </svg>
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:"clamp(28px,5vw,38px)",fontWeight:500,color:phaseColor,animation:running?"timerPulse 2s ease-in-out infinite":"none",lineHeight:1}}>{mm}:{ss}</div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:t40,marginTop:6,letterSpacing:"0.1em",textTransform:"uppercase"}}>{phase==="work"?"Focus":"Break"}</div>
              {cycle>0&&<div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:t40,marginTop:3}}>Cycle {cycle}</div>}
            </div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"center",marginBottom:16,flexWrap:"wrap"}}>
            {!running&&!sessionDone&&<button onClick={startTimer} style={{background:phaseColor,color:"#07080d",border:"none",borderRadius:10,padding:"12px 28px",fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:14,transition:"all 0.2s"}}>▶ Start</button>}
            {running&&<button onClick={stopTimer} style={{background:"#FF6B6B",color:"#fff",border:"none",borderRadius:10,padding:"12px 28px",fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:14}}>■ End</button>}
            {(running||sessionDone)&&<button onClick={resetTimer} style={{background:cardBg,border:`1px solid ${border}`,color:t70,borderRadius:10,padding:"12px 20px",fontFamily:"'Outfit',sans-serif",fontWeight:600,fontSize:14}}>↺</button>}
          </div>
          <button onClick={()=>setCamMode(c=>!c)} style={{background:camMode?"#3ECFCF18":cardBg,border:`1px solid ${camMode?"#3ECFCF66":border}`,color:camMode?"#3ECFCF":t40,borderRadius:8,padding:"8px 16px",fontSize:12,fontFamily:"'JetBrains Mono',monospace",transition:"all 0.2s",width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            <span style={{fontSize:14}}>📷</span>{camMode?"Camera Focus ON — click to disable":"Enable Camera Attention Tracking"}
          </button>
          <div style={{display:"flex",gap:10,marginTop:14}}>
            {[{label:"Tab switches",value:tabSwitches,bad:tabSwitches>3},{label:"Cam alerts",value:camDistractions,bad:camDistractions>5}].map(s=>(
              <div key={s.label} style={{flex:1,background:s.bad?"#FF6B6B10":cardBg,border:`1px solid ${s.bad?"#FF6B6B44":border}`,borderRadius:10,padding:"10px 12px",minWidth:0}}>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:18,color:s.bad?"#FF6B6B":phaseColor}}>{s.value}</div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:t40,textTransform:"uppercase",letterSpacing:"0.08em",marginTop:2}}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Settings + score */}
        <div style={{display:"flex",flexDirection:"column",gap:14,minWidth:0}}>
          <div style={{background:cardBg,border:`1px solid ${border}`,borderRadius:16,padding:"18px"}}>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:t40,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:12}}>Timer Preset</div>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {POMODORO_PRESETS.map(p=>(
                <button key={p.id} onClick={()=>{if(!running){setPreset(p.id);}}} style={{background:preset===p.id?"#3ECFCF18":"transparent",border:`1px solid ${preset===p.id?"#3ECFCF66":border}`,borderRadius:9,padding:"9px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",transition:"all 0.2s",cursor:running?"not-allowed":"pointer",opacity:running?0.5:1}}>
                  <span style={{fontFamily:"'Outfit',sans-serif",fontWeight:preset===p.id?600:400,fontSize:13,color:preset===p.id?"#3ECFCF":t70}}>{p.label}</span>
                  {p.work&&<span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:t40}}>{p.work}m / {p.brk}m</span>}
                </button>
              ))}
            </div>
            {preset==="manual"&&!running&&(
              <div style={{marginTop:12}}>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:t40,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:8}}>Duration — {manualMins} minutes</div>
                <input type="range" min={1} max={120} value={manualMins} onChange={e=>setManualMins(+e.target.value)} style={{width:"100%",accentColor:"#3ECFCF"}}/>
              </div>
            )}
          </div>
          {sessionDone&&focusScore!=null&&(
            <div style={{background:cardBg,border:`1.5px solid ${scoreColor}55`,borderRadius:16,padding:"20px",animation:"fadeUp 0.4s both",textAlign:"center"}}>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:t40,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:10}}>Session Focus Score</div>
              <div style={{fontFamily:"'Instrument Serif',serif",fontSize:56,color:scoreColor,lineHeight:1}}>{focusScore}</div>
              <div style={{fontFamily:"'Outfit',sans-serif",fontSize:12,color:t40,marginTop:8}}>
                {focusScore>=80?"Excellent session 🏆":focusScore>=50?"Good — keep building the habit.":"Lots of distractions — try a shorter timer."}
              </div>
              {camMode&&<div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:t40,marginTop:8}}>Camera alerts: {camDistractions} · Tab switches: {tabSwitches}</div>}
            </div>
          )}
          {!sessionDone&&(
            <div style={{background:cardBg,border:`1px solid ${border}`,borderRadius:16,padding:"18px"}}>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:t40,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:12}}>Tips</div>
              {["Tab switches pause your timer automatically","Camera mode detects if you look away or pick up your phone","Focus score = active time ratio minus distraction penalties","Take your break — it genuinely helps retention"].map((tip,i)=>(
                <div key={i} style={{display:"flex",gap:8,marginBottom:9}}>
                  <span style={{color:"#3ECFCF",fontSize:12,marginTop:2,flexShrink:0}}>◎</span>
                  <span style={{fontFamily:"'Outfit',sans-serif",fontSize:12,color:t40,lineHeight:1.5}}>{tip}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {camMode&&(
        <div style={{animation:"fadeUp 0.3s both"}}>
          <CameraFocus onDistraction={handleCamDistraction} onClose={()=>setCamMode(false)} theme={theme} running={running}/>
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   VISION MODULE
───────────────────────────────────────────────────────────── */
const VisionModule = ({ onPipeToSimplify, theme }) => {
  const [file,setFile]=useState(null);
  const [preview,setPreview]=useState(null);
  const [loading,setLoading]=useState(false);
  const [paragraphs,setParagraphs]=useState([]);
  const [vStatus,setVStatus]=useState("idle"); // idle | uploading | ready | error
  const [errorMsg,setErrorMsg]=useState("");
  // TTS state
  const [currentIdx,setCurrentIdx]=useState(0);
  const [isPaused,setIsPaused]=useState(false);
  const [isSpeaking,setIsSpeaking]=useState(false);
  // Voice command state
  const [isListening,setIsListening]=useState(false);
  const inputRef=useRef(null);
  const parasRef=useRef([]);
  const idxRef=useRef(0);
  const recognitionRef=useRef(null);

  const { isDark }=theme;
  const border=isDark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.1)";
  const cardBg=isDark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.03)";
  const t40=isDark?"rgba(255,255,255,0.4)":"rgba(0,0,0,0.4)";
  const t70=isDark?"rgba(255,255,255,0.7)":"rgba(0,0,0,0.7)";

  // ── TTS helpers ──────────────────────────────────────────
  const speakAt = useCallback((paras, idx) => {
    window.speechSynthesis.cancel();
    if (idx >= paras.length) { setIsSpeaking(false); setIsPaused(false); return; }
    const u = new SpeechSynthesisUtterance(paras[idx]);
    u.rate = 0.88;
    u.onstart = () => { setCurrentIdx(idx); idxRef.current = idx; setIsSpeaking(true); setIsPaused(false); };
    u.onend   = () => { speakAt(paras, idx + 1); };
    u.onerror = () => { setIsSpeaking(false); };
    window.speechSynthesis.speak(u);
  }, []);

  const startReading = useCallback((paras, from=0) => {
    parasRef.current = paras;
    idxRef.current = from;
    speakAt(paras, from);
  }, [speakAt]);

  const pauseReading  = ()=>{ window.speechSynthesis.pause();  setIsPaused(true);  };
  const resumeReading = ()=>{ window.speechSynthesis.resume(); setIsPaused(false); };
  const nextPara      = ()=>{ const next = idxRef.current + 1; if(next < parasRef.current.length) speakAt(parasRef.current, next); };
  const repeatPara    = ()=>{ speakAt(parasRef.current, idxRef.current); };
  const stopReading   = ()=>{ window.speechSynthesis.cancel(); setIsSpeaking(false); setIsPaused(false); setCurrentIdx(0); idxRef.current=0; };

  // ── Voice commands ───────────────────────────────────────
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true; rec.interimResults = false; rec.lang = "en-US";
    rec.onresult = (e) => {
      const cmd = e.results[e.results.length-1][0].transcript.trim().toLowerCase();
      if (cmd.includes("pause"))  pauseReading();
      if (cmd.includes("resume")) resumeReading();
      if (cmd.includes("next"))   nextPara();
      if (cmd.includes("repeat")) repeatPara();
      if (cmd.includes("stop"))   stopReading();
    };
    rec.onend = () => { if(recognitionRef.current===rec) { try{ rec.start(); }catch{} } };
    rec.start();
    recognitionRef.current = rec;
    setIsListening(true);
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) { recognitionRef.current.onend=null; recognitionRef.current.stop(); recognitionRef.current=null; }
    setIsListening(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { window.speechSynthesis.cancel(); stopListening(); }, [stopListening]);

  // ── File handling ─────────────────────────────────────────
  const onFile = (f) => {
    if (!f) return;
    setFile(f); setVStatus("idle"); setParagraphs([]); setErrorMsg(""); stopReading();
    if (f.type.startsWith("image/")) {
      const r = new FileReader(); r.onload = e => setPreview(e.target.result); r.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  };

  const onDrop = (e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); };

  const extract = async () => {
    if (!file) return;
    setLoading(true); setVStatus("uploading"); setParagraphs([]); setErrorMsg(""); stopReading();
    try {
      const paras = await apiVision(file);
      setParagraphs(paras); parasRef.current = paras;
      setVStatus("ready");
      startListening();
      startReading(paras, 0);
    } catch (e) {
      setErrorMsg(e.message); setVStatus("error");
    }
    setLoading(false);
  };

  const toggleMic = () => { isListening ? stopListening() : startListening(); };

  const isReady = vStatus === "ready";
  const progress = paragraphs.length ? ((currentIdx + 1) / paragraphs.length) * 100 : 0;

  return (
    <div style={{animation:"pageIn 0.4s both",minWidth:0}}>

      {/* ── Drop zone ── */}
      <div onDrop={onDrop} onDragOver={e=>e.preventDefault()} onClick={()=>inputRef.current?.click()}
        style={{border:`2px dashed ${file?"#FF9F1C88":border}`,borderRadius:16,padding:"44px 24px",textAlign:"center",cursor:"pointer",marginBottom:14,background:file?"#FF9F1C06":cardBg,transition:"all 0.3s"}}
        onMouseEnter={e=>e.currentTarget.style.borderColor="#FF9F1C88"}
        onMouseLeave={e=>e.currentTarget.style.borderColor=file?"#FF9F1C88":border}
      >
        <input ref={inputRef} type="file" accept="image/*,.pdf" onChange={e=>onFile(e.target.files[0])} style={{display:"none"}} disabled={loading}/>
        {preview
          ? <img src={preview} alt="preview" style={{maxHeight:180,maxWidth:"100%",borderRadius:10,objectFit:"contain"}}/>
          : <>
              <div style={{fontSize:36,color:"#FF9F1C",marginBottom:12,opacity:0.7}}>◉</div>
              <div style={{fontFamily:"'Outfit',sans-serif",fontWeight:600,fontSize:15,marginBottom:6}}>
                {file ? `📄 ${file.name}` : "Drop a file or click to upload"}
              </div>
              <div style={{fontFamily:"'Outfit',sans-serif",fontSize:12,color:t40}}>
                Photos, screenshots, scanned documents, handwritten notes, PDFs
              </div>
            </>
        }
      </div>

      {/* ── File info bar ── */}
      {file&&<div style={{display:"flex",gap:10,marginBottom:20}}>
        <div style={{flex:1,fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:t40,padding:"10px 14px",background:cardBg,border:`1px solid ${border}`,borderRadius:8,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
          📎 {file.name} — {(file.size/1024).toFixed(1)}KB
        </div>
        <button onClick={()=>{setFile(null);setPreview(null);setParagraphs([]);setVStatus("idle");stopReading();}}
          style={{background:cardBg,border:`1px solid ${border}`,color:t40,borderRadius:8,padding:"10px 14px",fontSize:12,fontFamily:"'JetBrains Mono',monospace",flexShrink:0}}>✕</button>
      </div>}

      {/* ── Extract button ── */}
      <button onClick={extract} disabled={!file||loading}
        style={{width:"100%",background:!file?cardBg:loading?"rgba(255,159,28,0.3)":"#FF9F1C",color:!file||loading?t40:"#07080d",border:"none",borderRadius:12,padding:"16px",fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:15,marginBottom:24,transition:"all 0.3s",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
        {loading
          ? <><span style={{animation:"spin 1s linear infinite",display:"inline-block"}}>◎</span>Extracting…</>
          : "◉ Extract & Read Aloud"}
      </button>

      {/* ── Error ── */}
      {vStatus==="error"&&<div style={{marginBottom:16,padding:"12px 18px",background:"#FF6B6B18",border:"1px solid #FF6B6B88",borderRadius:12,fontFamily:"'Outfit',sans-serif",fontSize:13,color:"#FF6B6B"}}>
        ⚠ {errorMsg}
      </div>}

      {/* ── Playback controls ── */}
      {isReady&&paragraphs.length>0&&(
        <div style={{background:cardBg,border:"1.5px solid #FF9F1C44",borderRadius:18,overflow:"hidden",animation:"fadeUp 0.4s both",marginBottom:16}}>

          {/* Header */}
          <div style={{padding:"14px 22px",borderBottom:"1px solid #FF9F1C22",background:"#FF9F1C08",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
            <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
              <span style={{color:"#FF9F1C",fontSize:18,flexShrink:0}}>◉</span>
              <div style={{minWidth:0}}>
                <div style={{fontFamily:"'Instrument Serif',serif",fontSize:17}}>Extracted & Reading</div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:t40,marginTop:2,letterSpacing:"0.08em"}}>VISION AGENT → OCR → TTS</div>
              </div>
            </div>
            <button onClick={()=>onPipeToSimplify(paragraphs.join("\n\n"))}
              style={{background:"#C8F04418",border:"1px solid #C8F04455",color:"#C8F044",borderRadius:8,padding:"7px 12px",fontSize:12,fontFamily:"'JetBrains Mono',monospace",transition:"all 0.2s",flexShrink:0}}>
              ✦ Simplify
            </button>
          </div>

          <div style={{padding:"18px 22px"}}>
            {/* Progress bar */}
            <div style={{height:4,background:border,borderRadius:2,marginBottom:8,overflow:"hidden"}}>
              <div style={{height:"100%",background:"#FF9F1C",borderRadius:2,width:`${progress}%`,transition:"width 0.5s"}}/>
            </div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:t40,letterSpacing:"0.08em",marginBottom:16}}>
              PARAGRAPH {currentIdx+1} OF {paragraphs.length}
            </div>

            {/* Playback buttons */}
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
              {!isPaused
                ? <button onClick={pauseReading}  style={{flex:1,background:"#FF9F1C",color:"#07080d",border:"none",borderRadius:10,padding:"11px 10px",fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:13,minWidth:80}}>⏸ Pause</button>
                : <button onClick={resumeReading} style={{flex:1,background:"#FF9F1C",color:"#07080d",border:"none",borderRadius:10,padding:"11px 10px",fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:13,minWidth:80}}>▶ Resume</button>
              }
              <button onClick={repeatPara} style={{flex:1,background:cardBg,border:`1px solid ${border}`,color:t70,borderRadius:10,padding:"11px 10px",fontFamily:"'Outfit',sans-serif",fontWeight:600,fontSize:13,minWidth:80}}>🔁 Repeat</button>
              <button onClick={nextPara}   style={{flex:1,background:cardBg,border:`1px solid ${border}`,color:t70,borderRadius:10,padding:"11px 10px",fontFamily:"'Outfit',sans-serif",fontWeight:600,fontSize:13,minWidth:80}}>⏭ Next</button>
              <button onClick={stopReading} style={{flex:1,background:"#FF6B6B18",border:"1px solid #FF6B6B55",color:"#FF6B6B",borderRadius:10,padding:"11px 10px",fontFamily:"'Outfit',sans-serif",fontWeight:600,fontSize:13,minWidth:80}}>⏹ Stop</button>
            </div>

            {/* Voice command toggle */}
            <button onClick={toggleMic}
              style={{width:"100%",background:isListening?"#FF9F1C18":cardBg,border:`1px solid ${isListening?"#FF9F1C66":border}`,color:isListening?"#FF9F1C":t40,borderRadius:8,padding:"9px 16px",fontSize:12,fontFamily:"'JetBrains Mono',monospace",transition:"all 0.2s",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:10}}>
              <span style={{fontSize:14}}>🎙</span>{isListening?"Voice Commands ON — click to disable":"Enable Voice Commands"}
            </button>

            {/* Voice commands help */}
            {isListening&&(
              <div style={{padding:"10px 14px",background:"#FF9F1C08",border:"1px solid #FF9F1C22",borderRadius:8,fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:t40,letterSpacing:"0.06em"}}>
                Say: <span style={{color:"#FF9F1C"}}>"Pause"</span> · <span style={{color:"#FF9F1C"}}>"Resume"</span> · <span style={{color:"#FF9F1C"}}>"Next"</span> · <span style={{color:"#FF9F1C"}}>"Repeat"</span> · <span style={{color:"#FF9F1C"}}>"Stop"</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Paragraph list with active highlight ── */}
      {isReady&&paragraphs.length>0&&(
        <div style={{background:cardBg,border:`1px solid ${border}`,borderRadius:18,overflow:"hidden",animation:"fadeUp 0.5s both"}}>
          <div style={{padding:"14px 22px",borderBottom:`1px solid ${border}`,background:isDark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.02)"}}>
            <div style={{fontFamily:"'Instrument Serif',serif",fontSize:16}}>Extracted Text</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:t40,marginTop:2,letterSpacing:"0.08em"}}>VISION AGENT → OCR → CLEANUP</div>
          </div>
          <div style={{padding:"18px 22px",display:"flex",flexDirection:"column",gap:10,maxHeight:380,overflowY:"auto"}}>
            {paragraphs.map((p,i)=>(
              <div key={i}
                onClick={()=>speakAt(parasRef.current,i)}
                style={{padding:"12px 16px",borderRadius:10,cursor:"pointer",transition:"all 0.25s",
                  background: i===currentIdx&&isSpeaking?"#FF9F1C12":cardBg,
                  border:`1.5px solid ${i===currentIdx&&isSpeaking?"#FF9F1C66":border}`,
                  boxShadow: i===currentIdx&&isSpeaking?"0 0 16px #FF9F1C18":"none"
                }}>
                <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:i===currentIdx&&isSpeaking?"#FF9F1C":t40,marginTop:3,flexShrink:0,letterSpacing:"0.06em"}}>
                    {String(i+1).padStart(2,"0")}
                  </span>
                  <span style={{fontFamily:"'Outfit',sans-serif",fontSize:14,color:i===currentIdx&&isSpeaking?t70:t40,lineHeight:1.75,fontWeight:i===currentIdx&&isSpeaking?400:300}}>
                    {p}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   QUIZ MODULE
───────────────────────────────────────────────────────────── */
const QuizModule = ({ theme }) => {
  const [qType,setQType]=useState("mcq"); const [numQ,setNumQ]=useState(3);
  const [input,setInput]=useState(""); const [questions,setQuestions]=useState(null);
  const [answers,setAnswers]=useState({}); const [results,setResults]=useState(null);
  const [loadingGen,setLoadingGen]=useState(false); const [loadingEval,setLoadingEval]=useState(false);
  const [submitted,setSubmitted]=useState(false); const [error,setError]=useState(null);
  const [sourceSummary,setSourceSummary]=useState("");
  const { isDark }=theme;
  const border=isDark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.1)";
  const cardBg=isDark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.03)";
  const t40=isDark?"rgba(255,255,255,0.4)":"rgba(0,0,0,0.4)";
  const t70=isDark?"rgba(255,255,255,0.7)":"rgba(0,0,0,0.7)";

  const generate=async()=>{
    if(!input.trim()) return;
    setLoadingGen(true); setQuestions(null); setAnswers({}); setResults(null); setSubmitted(false); setError(null);
    try{ const res=await apiQuizGenerate(input,qType,numQ); setQuestions(res.questions); setSourceSummary(res.source_summary||""); }
    catch(e){ setError(e.message); }
    setLoadingGen(false);
  };

  const submit=async()=>{
    if(!questions) return;
    setLoadingEval(true); setError(null);
    try{
      const ansArr=questions.map((_,i)=>answers[i]||"");
      const res=await apiQuizEvaluate(questions,ansArr);
      setResults(res); setSubmitted(true);
    } catch(e){ setError(e.message); }
    setLoadingEval(false);
  };

  const answeredCount=Object.keys(answers).length;
  const scoreColor=results?(results.percentage>=80?"#C8F044":results.percentage>=50?"#FF9F1C":"#FF6B6B"):"#FF6B6B";

  return (
    <div style={{animation:"pageIn 0.4s both",minWidth:0}}>
      {/* Question type + count — stacks on mobile */}
      <div className="quiz-header" style={{marginBottom:18}}>
        <div>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:t40,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:10}}>Question Type</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {QUIZ_TYPES.map(t=>(
              <button key={t.id} onClick={()=>setQType(t.id)} className="pill" style={{background:qType===t.id?"#FF6B6B":cardBg,border:`1.5px solid ${qType===t.id?"#FF6B6B":border}`,color:qType===t.id?"#fff":t70,borderRadius:"100px",padding:"8px 16px",fontSize:12,fontFamily:"'Outfit',sans-serif",fontWeight:qType===t.id?600:400,display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace"}}>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:t40,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:10}}>Count</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {[3,5,8,10].map(n=>(
              <button key={n} onClick={()=>setNumQ(n)} style={{background:numQ===n?"#FF6B6B20":cardBg,border:`1px solid ${numQ===n?"#FF6B6B66":border}`,color:numQ===n?"#FF6B6B":t70,borderRadius:8,padding:"8px 14px",fontSize:13,fontFamily:"'JetBrains Mono',monospace",fontWeight:numQ===n?600:400,transition:"all 0.2s"}}>{n}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{marginBottom:12}}>
        <div style={{background:cardBg,border:`1.5px solid rgba(255,107,107,0.2)`,borderRadius:16,overflow:"hidden"}}>
          <textarea value={input} onChange={e=>setInput(e.target.value)} placeholder="Paste the content you want to be tested on…" rows={5}
            style={{width:"100%",padding:"20px 22px",background:"transparent",border:"none",color:theme.text,fontFamily:"'Outfit',sans-serif",fontSize:15,lineHeight:1.7,fontWeight:300,resize:"vertical",minHeight:100}}/>
          <div style={{padding:"10px 18px",borderTop:`1px solid ${border}`,display:"flex",gap:8,flexWrap:"wrap"}}>
            {EXAMPLES.map((ex,i)=>(
              <button key={i} onClick={()=>setInput(ex)} style={{background:cardBg,border:`1px solid ${border}`,color:t40,borderRadius:6,padding:"5px 10px",fontSize:11,fontFamily:"'JetBrains Mono',monospace",transition:"all 0.2s"}}
                onMouseEnter={e=>e.currentTarget.style.color=theme.text}
                onMouseLeave={e=>e.currentTarget.style.color=t40}
              >eg {i+1}</button>
            ))}
          </div>
        </div>
      </div>

      {error&&<div style={{marginBottom:12,padding:"10px 16px",background:"#FF6B6B15",border:"1px solid #FF6B6B55",borderRadius:10,fontFamily:"'Outfit',sans-serif",fontSize:13,color:"#FF6B6B"}}>⚠ {error}</div>}

      <button onClick={generate} disabled={!input.trim()||loadingGen} style={{width:"100%",background:!input.trim()?cardBg:loadingGen?"rgba(255,107,107,0.3)":"#FF6B6B",color:!input.trim()||loadingGen?t40:"#fff",border:"none",borderRadius:12,padding:"16px",fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:15,marginBottom:28,transition:"all 0.3s",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
        {loadingGen?<><span style={{animation:"spin 1s linear infinite",display:"inline-block"}}>◎</span>Generating…</>:`⬡ Generate ${numQ} ${QUIZ_TYPES.find(t=>t.id===qType)?.label} Questions`}
      </button>

      {sourceSummary&&!submitted&&<div style={{marginBottom:16,padding:"10px 16px",background:"#FF6B6B0a",border:"1px solid #FF6B6B22",borderRadius:10,fontFamily:"'Outfit',sans-serif",fontSize:12,color:t40,fontStyle:"italic"}}>Based on: {sourceSummary}</div>}

      {questions&&!submitted&&(
        <div style={{animation:"fadeUp 0.4s both"}}>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:t40,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:14}}>
            Answer All — {answeredCount}/{questions.length} done
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:20}}>
            {questions.map((q,qi)=>(
              <div key={q.id} style={{background:cardBg,border:`1px solid ${answers[qi]!==undefined?"#FF6B6B44":border}`,borderRadius:16,padding:"18px 20px",transition:"border-color 0.3s"}}>
                <div style={{fontFamily:"'Outfit',sans-serif",fontWeight:600,fontSize:14,marginBottom:12,display:"flex",gap:10}}>
                  <span style={{color:"#FF6B6B",fontFamily:"'JetBrains Mono',monospace",flexShrink:0}}>Q{q.id}</span>
                  <span style={{minWidth:0,wordBreak:"break-word"}}>{q.type==="fill_blank"?q.blank_sentence.replace("___","______"):q.question}</span>
                </div>
                {q.type==="mcq"&&<div style={{display:"flex",flexDirection:"column",gap:7}}>
                  {q.options.map((opt,oi)=>(
                    <button key={oi} onClick={()=>setAnswers(a=>({...a,[qi]:opt}))} style={{background:answers[qi]===opt?"#FF6B6B18":cardBg,border:`1.5px solid ${answers[qi]===opt?"#FF6B6B77":border}`,color:answers[qi]===opt?"#FF6B6B":t70,borderRadius:9,padding:"10px 14px",textAlign:"left",fontFamily:"'Outfit',sans-serif",fontSize:13,transition:"all 0.2s",width:"100%",wordBreak:"break-word"}}>{opt}</button>
                  ))}
                </div>}
                {q.type==="true_false"&&<div style={{display:"flex",gap:10}}>
                  {["True","False"].map(opt=>(
                    <button key={opt} onClick={()=>setAnswers(a=>({...a,[qi]:opt}))} style={{flex:1,background:answers[qi]===opt?"#FF6B6B18":cardBg,border:`1.5px solid ${answers[qi]===opt?"#FF6B6B77":border}`,color:answers[qi]===opt?"#FF6B6B":t70,borderRadius:9,padding:"12px",fontFamily:"'Outfit',sans-serif",fontWeight:600,fontSize:14,transition:"all 0.2s"}}>{opt}</button>
                  ))}
                </div>}
                {(q.type==="fill_blank"||q.type==="short_answer")&&(
                  <input type="text" value={answers[qi]||""} onChange={e=>setAnswers(a=>({...a,[qi]:e.target.value}))} placeholder={q.type==="fill_blank"?"Type the missing word…":"Write your answer…"}
                    style={{width:"100%",padding:"11px 14px",background:cardBg,border:`1.5px solid ${answers[qi]?"#FF6B6B44":border}`,borderRadius:9,color:theme.text,fontFamily:"'Outfit',sans-serif",fontSize:14,transition:"border-color 0.2s"}}/>
                )}
              </div>
            ))}
          </div>
          <button onClick={submit} disabled={answeredCount<questions.length||loadingEval} style={{width:"100%",background:answeredCount<questions.length?cardBg:loadingEval?"rgba(255,107,107,0.35)":"#FF6B6B",color:answeredCount<questions.length||loadingEval?t40:"#fff",border:"none",borderRadius:12,padding:"16px",fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:15,transition:"all 0.3s",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
            {loadingEval?<><span style={{animation:"spin 1s linear infinite",display:"inline-block"}}>◎</span>Evaluating…</>:"Submit & Get Results"}
          </button>
        </div>
      )}

      {results&&submitted&&(
        <div style={{animation:"fadeUp 0.4s both"}}>
          <div style={{background:cardBg,border:`1.5px solid ${scoreColor}55`,borderRadius:18,padding:"28px",marginBottom:18,textAlign:"center"}}>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:t40,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:12}}>Your Score</div>
            <div style={{fontFamily:"'Instrument Serif',serif",fontSize:64,color:scoreColor,lineHeight:1}}>{results.percentage}%</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:16,color:scoreColor,marginTop:4}}>Grade {results.grade}</div>
            <div style={{fontFamily:"'Outfit',sans-serif",fontSize:14,color:t40,marginTop:8}}>{results.score} of {results.total} correct</div>
            <div style={{marginTop:14,padding:"12px 16px",background:`${scoreColor}10`,border:`1px solid ${scoreColor}33`,borderRadius:10,fontFamily:"'Outfit',sans-serif",fontSize:13,color:t70,fontStyle:"italic"}}>{results.study_tip}</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
            {results.results.map((r,i)=>(
              <div key={r.id} style={{background:cardBg,border:`1px solid ${r.correct?"#C8F04444":"#FF6B6B44"}`,borderRadius:14,padding:"14px 18px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6,gap:8}}>
                  <span style={{fontFamily:"'Outfit',sans-serif",fontWeight:600,fontSize:13,flex:1,minWidth:0,wordBreak:"break-word"}}>Q{r.id} — {questions[i]?.question}</span>
                  <span style={{color:r.correct?"#C8F044":"#FF6B6B",fontFamily:"'JetBrains Mono',monospace",fontSize:16,flexShrink:0}}>{r.correct?"✓":"✗"}</span>
                </div>
                <div style={{fontFamily:"'Outfit',sans-serif",fontSize:12,color:t40,wordBreak:"break-word"}}>
                  Your answer: <span style={{color:r.correct?"#C8F044":"#FF6B6B"}}>{r.user_answer||"(blank)"}</span>
                  {!r.correct&&<> · Correct: <span style={{color:"#C8F044"}}>{r.correct_answer}</span></>}
                </div>
                <div style={{fontFamily:"'Outfit',sans-serif",fontSize:12,color:t40,marginTop:6,fontStyle:"italic"}}>{r.explanation}</div>
              </div>
            ))}
          </div>
          <button onClick={()=>{setQuestions(null);setAnswers({});setResults(null);setSubmitted(false);setSourceSummary("");}} style={{width:"100%",background:cardBg,border:`1px solid ${border}`,color:t70,borderRadius:12,padding:"14px",fontFamily:"'Outfit',sans-serif",fontWeight:600,fontSize:14,transition:"all 0.2s"}}>
            ↺ Try Again with New Questions
          </button>
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   HOME PAGE
───────────────────────────────────────────────────────────── */
const Home = ({ go }) => {
  const TICKS=["SIMPLIFY · ","FOCUS MODE · ","VISION SCAN · ","QUIZ MODE · ","FOR EVERY BRAIN · ","SIMPLIFY · ","FOCUS MODE · ","VISION SCAN · ","QUIZ MODE · ","FOR EVERY BRAIN · "];
  return (
    <div style={{minHeight:"100vh",background:"#07080d",color:"#fff",overflowX:"hidden"}}>
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0}}>
        <div style={{position:"absolute",top:"8%",left:"55%",width:650,height:650,background:"radial-gradient(circle,#C8F04410 0%,transparent 65%)",animation:"drift 13s ease-in-out infinite"}}/>
        <div style={{position:"absolute",bottom:"10%",left:"2%",width:520,height:520,background:"radial-gradient(circle,#3ECFCF0c 0%,transparent 65%)",animation:"drift2 16s ease-in-out infinite"}}/>
        <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:0.025}}><defs><pattern id="g" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M60 0L0 0 0 60" fill="none" stroke="white" strokeWidth="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>
      </div>
      <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:100,padding:"18px clamp(20px,4vw,52px)",display:"flex",alignItems:"center",justifyContent:"space-between",background:"linear-gradient(to bottom,#07080dbb,transparent)",backdropFilter:"blur(14px)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:30,height:30,background:"#C8F044",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{color:"#07080d",fontSize:14,fontWeight:800,fontFamily:"'Outfit',sans-serif"}}>N</span></div>
          <span style={{fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:15,letterSpacing:"-0.02em"}}>NeuroCompanion</span>
        </div>
        <button onClick={go} style={{background:"#C8F044",color:"#07080d",border:"none",borderRadius:"100px",padding:"10px 26px",fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:13,animation:"glow 3s ease-in-out infinite",transition:"transform 0.2s",flexShrink:0}}
          onMouseEnter={e=>e.currentTarget.style.transform="scale(1.07)"}
          onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}
        >Launch App →</button>
      </nav>

      {/* Hero */}
      <section style={{position:"relative",zIndex:1,minHeight:"100vh",display:"flex",alignItems:"center",padding:"120px clamp(20px,4vw,52px) 80px",maxWidth:1160,margin:"0 auto"}}>
        <div className="home-hero" style={{width:"100%"}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{marginBottom:22,animation:"fadeUp 0.7s 0.1s both"}}>
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:"#C8F044",letterSpacing:"0.2em",textTransform:"uppercase",border:"1px solid #C8F04444",padding:"5px 14px",borderRadius:"100px"}}>Agentic AI · Built for every brain</span>
            </div>
            <h1 style={{fontFamily:"'Instrument Serif',serif",fontSize:"clamp(44px,7vw,94px)",fontWeight:400,lineHeight:1.0,letterSpacing:"-0.03em",marginBottom:28,animation:"fadeUp 0.7s 0.2s both"}}>
              Learning that<br/><em style={{color:"#C8F044"}}>adapts</em> to<br/>your brain.
            </h1>
            <p style={{fontFamily:"'Outfit',sans-serif",fontSize:17,color:"rgba(255,255,255,0.45)",maxWidth:460,lineHeight:1.75,fontWeight:300,marginBottom:44,animation:"fadeUp 0.7s 0.3s both"}}>
              Simplify, focus, scan and test — four AI modules designed for neurodiverse students. Your rules, your format, your pace.
            </p>
            <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap",animation:"fadeUp 0.7s 0.4s both"}}>
              <button onClick={go} style={{background:"#C8F044",color:"#07080d",border:"none",borderRadius:"100px",padding:"17px 40px",fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:15,transition:"all 0.25s cubic-bezier(0.34,1.56,0.64,1)"}}
                onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.06)";e.currentTarget.style.boxShadow="0 0 48px #C8F04466";}}
                onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";e.currentTarget.style.boxShadow="none";}}
              >Start learning differently</button>
              <span style={{fontFamily:"'Outfit',sans-serif",fontSize:12,color:"rgba(255,255,255,0.3)"}}>Free · No signup · Works in browser</span>
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12,animation:"fadeIn 0.8s 0.5s both",flexShrink:0,width:"clamp(220px,30vw,260px)"}}>
            {AGENTS.map((a,i)=>(
              <div key={a.id} style={{display:"flex",alignItems:"center",gap:16,background:"rgba(255,255,255,0.035)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:"15px 22px",transition:"all 0.3s",animation:`fadeUp 0.6s ${0.5+i*0.07}s both`}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=a.color+"66";e.currentTarget.style.background=a.color+"0e";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.07)";e.currentTarget.style.background="rgba(255,255,255,0.035)";}}
              >
                <span style={{fontSize:22,color:a.color,filter:`drop-shadow(0 0 8px ${a.color}88)`,flexShrink:0}}>{a.icon}</span>
                <div style={{minWidth:0}}>
                  <div style={{fontFamily:"'Outfit',sans-serif",fontWeight:600,fontSize:13}}>{a.label}</div>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"rgba(255,255,255,0.3)",marginTop:3,letterSpacing:"0.06em"}}>{a.tagline}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ticker */}
      <div style={{position:"relative",zIndex:1,borderTop:"1px solid rgba(255,255,255,0.05)",borderBottom:"1px solid rgba(255,255,255,0.05)",padding:"13px 0",overflow:"hidden",background:"rgba(255,255,255,0.018)"}}>
        <div style={{display:"flex",width:"max-content",animation:"ticker 22s linear infinite"}}>
          {[...TICKS,...TICKS].map((t,i)=><span key={i} style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:"rgba(255,255,255,0.28)",letterSpacing:"0.16em",paddingRight:28,whiteSpace:"nowrap"}}>{t}</span>)}
        </div>
      </div>

      {/* Features grid */}
      <section style={{position:"relative",zIndex:1,padding:"100px clamp(20px,4vw,52px)",maxWidth:1160,margin:"0 auto"}}>
        <div style={{marginBottom:52}}>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:"#C8F044",letterSpacing:"0.18em",textTransform:"uppercase",marginBottom:14}}>Four modules</div>
          <h2 style={{fontFamily:"'Instrument Serif',serif",fontSize:"clamp(32px,5vw,64px)",fontWeight:400,lineHeight:1.1}}>Every learning challenge<br/><em style={{color:"rgba(255,255,255,0.35)"}}>covered.</em></h2>
        </div>
        <div className="home-features">
          {AGENTS.map(a=>(
            <div key={a.id} style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:18,padding:"28px",transition:"all 0.3s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=a.color+"55";e.currentTarget.style.background=a.color+"0b";e.currentTarget.style.transform="translateY(-3px)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.07)";e.currentTarget.style.background="rgba(255,255,255,0.02)";e.currentTarget.style.transform="translateY(0)";}}
            >
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16,gap:8,flexWrap:"wrap"}}>
                <span style={{fontSize:30,color:a.color,filter:`drop-shadow(0 0 10px ${a.color}66)`,flexShrink:0}}>{a.icon}</span>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:a.color,letterSpacing:"0.12em",textTransform:"uppercase",background:`${a.color}18`,border:`1px solid ${a.color}33`,borderRadius:"100px",padding:"4px 10px"}}>{a.tagline}</span>
              </div>
              <h3 style={{fontFamily:"'Outfit',sans-serif",fontWeight:600,fontSize:17,marginBottom:8}}>{a.label}</h3>
              <p style={{fontFamily:"'Outfit',sans-serif",fontSize:13,color:"rgba(255,255,255,0.4)",lineHeight:1.7,fontWeight:300,marginBottom:14}}>{a.desc}</p>
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                {a.helps.map(h=><span key={h} style={{fontFamily:"'Outfit',sans-serif",fontSize:11,padding:"3px 10px",background:`${a.color}15`,border:`1px solid ${a.color}33`,borderRadius:"100px",color:a.color,fontWeight:500}}>{h}</span>)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{position:"relative",zIndex:1,margin:"0 clamp(20px,4vw,52px) 100px",borderRadius:24,background:"linear-gradient(135deg,#C8F04412,#3ECFCF08,#FF6B6B0a)",border:"1px solid rgba(200,240,68,0.18)",padding:"clamp(40px,8vw,72px) clamp(24px,6vw,60px)",textAlign:"center"}}>
        <h2 style={{fontFamily:"'Instrument Serif',serif",fontSize:"clamp(34px,6vw,68px)",fontWeight:400,lineHeight:1.1,marginBottom:18}}>
          Ready to study<br/><em style={{color:"#C8F044"}}>your way?</em>
        </h2>
        <p style={{fontFamily:"'Outfit',sans-serif",fontSize:15,color:"rgba(255,255,255,0.4)",marginBottom:36,fontWeight:300}}>Four AI modules. Fully customisable. Zero judgement.</p>
        <button onClick={go} style={{background:"#C8F044",color:"#07080d",border:"none",borderRadius:"100px",padding:"18px 50px",fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:16,transition:"all 0.25s cubic-bezier(0.34,1.56,0.64,1)",animation:"glow 3s ease-in-out infinite"}}
          onMouseEnter={e=>e.currentTarget.style.transform="scale(1.06)"}
          onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}
        >Open NeuroCompanion →</button>
      </section>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   APP PAGE
───────────────────────────────────────────────────────────── */
const AppPage = ({ goHome }) => {
  const [agent,setAgent]=useState("simplify");
  const [pipedText,setPipedText]=useState("");
  const [ds,setDs]=useState({ fontSize:15, lineHeight:1.85, fontFamily:"'Outfit',sans-serif", theme:COLOR_THEMES[0], dyslexic:false });
  const theme=ds.theme;
  const { isDark }=theme;
  const border=isDark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.1)";
  const cardBg=isDark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)";
  const t40=isDark?"rgba(255,255,255,0.4)":"rgba(0,0,0,0.4)";
  const t60=isDark?"rgba(255,255,255,0.6)":"rgba(0,0,0,0.6)";
  const upd=(k,v)=>setDs(s=>({...s,[k]:v}));
  const ag=AGENTS.find(a=>a.id===agent);

  return (
    <div style={{minHeight:"100vh",background:theme.bg,color:theme.text,position:"relative",overflowX:"hidden",animation:"pageIn 0.4s both",transition:"background 0.4s,color 0.4s"}}>
      <GlobalStyles theme={theme} dyslexic={ds.dyslexic} fontSize={ds.fontSize} fontFamily={ds.fontFamily} lineHeight={ds.lineHeight}/>
      {isDark&&<div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:250,background:`linear-gradient(to bottom,${ag?.color}06,transparent)`,transition:"background 0.8s"}}/>
        <div style={{position:"absolute",bottom:0,right:0,width:380,height:380,background:"radial-gradient(circle,rgba(200,240,68,0.04) 0%,transparent 70%)",animation:"drift 14s ease-in-out infinite"}}/>
      </div>}

      {/* Header */}
      <div style={{position:"sticky",top:0,zIndex:100,background:isDark?"rgba(7,8,13,0.9)":`${theme.bg}ee`,backdropFilter:"blur(20px)",borderBottom:`1px solid ${border}`,padding:"13px clamp(16px,3vw,32px)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
        <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
          <button onClick={goHome} style={{background:cardBg,border:`1px solid ${border}`,color:t60,borderRadius:8,padding:"7px 14px",fontSize:12,fontFamily:"'JetBrains Mono',monospace",transition:"all 0.2s",flexShrink:0,whiteSpace:"nowrap"}}
            onMouseEnter={e=>e.currentTarget.style.color=theme.text}
            onMouseLeave={e=>e.currentTarget.style.color=t60}
          >← Home</button>
          <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
            <div style={{width:26,height:26,background:"#C8F044",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{color:"#07080d",fontSize:13,fontWeight:800}}>N</span></div>
            <span style={{fontWeight:700,fontSize:14,letterSpacing:"-0.01em",whiteSpace:"nowrap"}}>NeuroCompanion</span>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:t40,marginLeft:4,display:"none"}}>/ APP</span>
          </div>
        </div>
        <DisplayPanel s={ds} onChange={upd} theme={theme}/>
      </div>

      {/* Main content */}
      <div style={{position:"relative",zIndex:1,maxWidth:960,margin:"0 auto",padding:"44px clamp(16px,3vw,32px) 100px"}}>
        <div style={{marginBottom:36,animation:"fadeUp 0.5s both"}}>
          <h1 style={{fontFamily:"'Instrument Serif',serif",fontSize:"clamp(28px,4vw,52px)",fontWeight:400,lineHeight:1.08,letterSpacing:"-0.02em",marginBottom:8}}>
            {ag?<><span style={{color:ag.color}}>{ag.icon}</span> {ag.label}</>:"Choose a module."}
          </h1>
          <p style={{fontSize:13,color:t40,fontWeight:300,maxWidth:540,lineHeight:1.6}}>{ag?.desc}</p>
        </div>

        {/* Agent tabs — responsive grid */}
        <div className="agent-tabs" style={{marginBottom:28,animation:"fadeUp 0.5s 0.1s both"}}>
          {AGENTS.map(a=>(
            <button key={a.id} onClick={()=>setAgent(a.id)} className="agent-card"
              style={{background:agent===a.id?`${a.color}18`:cardBg,border:`1.5px solid ${agent===a.id?a.color+"88":border}`,borderRadius:14,padding:"16px 10px",textAlign:"center",transition:"all 0.25s cubic-bezier(0.34,1.56,0.64,1)",transform:agent===a.id?"scale(1.03)":"scale(1)",boxShadow:agent===a.id?`0 0 22px ${a.color}22`:"none",minWidth:0}}>
              <div className="agent-icon" style={{fontSize:22,color:a.color,marginBottom:7,filter:`drop-shadow(0 0 6px ${a.color}66)`}}>{a.icon}</div>
              <div style={{fontWeight:600,fontSize:12,color:agent===a.id?theme.text:t60}}>{a.label}</div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:t40,marginTop:4,letterSpacing:"0.05em"}}>{a.tagline}</div>
            </button>
          ))}
        </div>

        {ag&&(
          <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:24}}>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:t40,letterSpacing:"0.1em",textTransform:"uppercase",alignSelf:"center",marginRight:4}}>helps with:</span>
            {ag.helps.map(h=><span key={h} style={{fontFamily:"'Outfit',sans-serif",fontSize:12,padding:"4px 12px",background:`${ag.color}15`,border:`1px solid ${ag.color}44`,borderRadius:"100px",color:ag.color,fontWeight:500}}>{h}</span>)}
          </div>
        )}

        {agent==="simplify"&&<SimplifyModule settings={ds} theme={theme} initialText={pipedText} key={pipedText||"default"}/>}
        {agent==="focus"   &&<FocusModule theme={theme}/>}
        {agent==="vision"  &&<VisionModule onPipeToSimplify={t=>{setPipedText(t);setAgent("simplify");}} theme={theme}/>}
        {agent==="quiz"    &&<QuizModule theme={theme}/>}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   ROOT
───────────────────────────────────────────────────────────── */
export default function Root() {
  const [page,setPage]=useState("home");
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        body{background:#07080d;overflow-x:hidden;}
        button{cursor:pointer;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes drift{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(28px,-22px) scale(1.05)}}
        @keyframes drift2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-18px,28px) scale(0.96)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes glow{0%,100%{box-shadow:0 0 20px #C8F04444}50%{box-shadow:0 0 55px #C8F04488}}
        @keyframes pageIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes warnShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
        @keyframes camPulse{0%,100%{box-shadow:0 0 0 0 #3ECFCF44}70%{box-shadow:0 0 0 8px transparent}}
        .agent-icon{transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1);}
        .agent-card:hover .agent-icon{transform:scale(1.16) rotate(-5deg);}
        .pill:hover{transform:scale(1.04);}
        .pill{transition:all 0.2s cubic-bezier(0.34,1.56,0.64,1);}
        .home-hero{display:flex;align-items:center;gap:80px;}
        .home-features{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
        .focus-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;}
        .cam-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start;}
        .agent-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;}
        .quiz-header{display:grid;grid-template-columns:1fr auto;gap:16px;align-items:end;}
        @media(max-width:900px){
          .focus-grid{grid-template-columns:1fr;}
          .home-hero{flex-direction:column;gap:40px;}
          .home-features{grid-template-columns:1fr;}
        }
        @media(max-width:700px){
          .agent-tabs{grid-template-columns:repeat(2,1fr);}
          .cam-grid{grid-template-columns:1fr;}
          .quiz-header{grid-template-columns:1fr;}
        }
      `}</style>
      {page==="home"?<Home go={()=>setPage("app")}/>:<AppPage goHome={()=>setPage("home")}/>}
    </>
  );
}