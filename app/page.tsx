"use client";

import type React from "react";
import { useEffect, useState } from "react";

/** ========= Types ========= */
type Subject = "maths" | "english" | "vr" | "nvr" | "comprehension" | "writing";
type Mode = "menu" | "quiz" | "results" | "practice" | "settings" | "writing" | "writingResults";

type GradeLevel = "Y4" | "Y5" | "DASH";
type Board = "Kent" | "Bexley" | "Generic";

type ShapeKind = "triangle" | "square" | "circle" | "diamond";
type FillKind = "black" | "white";

type SvgAtom = {
  shape: ShapeKind;
  fill: FillKind;
  size: number;       // 10-60 px
  rotation?: number;  // degrees
  x: number;          // 0-100 in 100x100 viewbox
  y: number;          // 0-100
};

type Question = {
  id: string;
  subject: Exclude<Subject,"writing">;
  stem: string;
  choices: string[];         // For SVG options we still keep ["A","B","C","D"]
  answerIndex: number;
  explanation?: string;
  difficulty?: "easy" | "medium" | "hard";
  tags?: string[];           // e.g. ["year:4","kent"]
  exam_board?: Board[];
  svgChoiceSets?: SvgAtom[][]; // If present, render as SVG tiles instead of text
};

type Passage = {
  id: string;
  title?: string;
  text: string;
  questions: Array<{
    stem: string;
    choices: string[];
    answerIndex: number;
    explanation?: string;
  }>;
};

type RawQuestion = {
  id: string | number;
  stem: string;
  choices: string[];
  answerIndex: number;
  explanation?: string;
  svgChoiceSets?: SvgAtom[][];
  tags?: string[];
  exam_board?: Board[];
};

/** ========= Config ========= */
const QUIZ_SECONDS = 10 * 60;
const DAILY_CAP_SECONDS = 30 * 60;
const WRITING_SECONDS = 30 * 60;
const COMP_QUESTION_COUNT = 5;
const PER_SUBJECT_COUNT: Record<Exclude<Subject,"comprehension"|"writing">, number> = {
  maths: 12, english: 12, vr: 10, nvr: 10,
};

/** ========= Time helpers ========= */
function todayKey(){
  const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function getUsedSecondsToday(){
  if(typeof window==="undefined") return 0;
  return parseInt(localStorage.getItem(`quizTime_${todayKey()}`)||"0")||0;
}
function addUsedSecondsToday(n:number){
  const k=`quizTime_${todayKey()}`;
  const cur=getUsedSecondsToday();
  localStorage.setItem(k, String(cur+n));
}

/** ========= Utils ========= */
function shuffle<T>(arr: readonly T[]){
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
function stemHash(stem:string){
  // Small stable hash to catch near-identical stems if ids collide
  let h=0;
  for(let i=0;i<stem.length;i++){ h=(h*31 + stem.charCodeAt(i))|0; }
  return h.toString();
}
function uniqueByIdThenStem<T extends {id:string; stem?:string}>(arr: readonly T[]){
  const seenId=new Set<string>();
  const seenStem=new Set<string>();
  const out:T[]=[];
  for(const it of arr){
    const id=it.id;
    const st=(it.stem?stemHash(it.stem):"");
    if(seenId.has(id)) continue;
    if(st && seenStem.has(st)) continue;
    seenId.add(id); if(st) seenStem.add(st);
    out.push(it);
  }
  return out;
}
function randInt(min:number,max:number){ return Math.floor(Math.random()*(max-min+1))+min; }

/** ========= Minecraft-y UI ========= */
const Card: React.FC<{children: React.ReactNode; className?: string}> = ({children, className}) => (
  <div className={className} style={{borderRadius:16,border:"4px solid #3b3b3b",boxShadow:"0 8px 24px rgba(0,0,0,0.1)",padding:16,background:"linear-gradient(135deg,#e8f7e8,#d4eed4)"}}>{children}</div>
);
const BlockButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({children,...props}) => (
  <button {...props} style={{padding:"12px 16px",borderRadius:12,border:"4px solid #2f4f2f",boxShadow:"0 2px 0 rgba(0,0,0,0.15)",background:"#7cc76b",fontWeight:700,letterSpacing:0.2,cursor:"pointer"}}>{children}</button>
);
const Pill: React.FC<{children: React.ReactNode}> = ({children}) => (
  <span style={{display:"inline-block",padding:"6px 12px",borderRadius:999,background:"#cfe9c9",border:"1px solid #5a8151",fontSize:12}}>{children}</span>
);

/** ========= SVG Renderer (NVR / simple Maths diagrams) ========= */
function shapePath(atom: SvgAtom){
  const fill = atom.fill==="black" ? "#222" : "#fff";
  const stroke = "#222";
  const cx = atom.x; const cy = atom.y; const size = atom.size;
  const rot = atom.rotation ?? 0;
  const transform = `rotate(${rot}, ${cx}, ${cy})`;

  if(atom.shape==="circle"){
    return <circle cx={cx} cy={cy} r={size/2} fill={fill} stroke={stroke} strokeWidth={2} />;
  }
  if(atom.shape==="square"){
    const x = cx - size/2; const y = cy - size/2;
    return <rect x={x} y={y} width={size} height={size} fill={fill} stroke={stroke} strokeWidth={2} transform={transform}/>;
  }
  if(atom.shape==="triangle"){
    const h = (Math.sqrt(3)/2)*size;
    const points = [
      `${cx},${cy - (2/3)*h}`,
      `${cx - size/2},${cy + (1/3)*h}`,
      `${cx + size/2},${cy + (1/3)*h}`
    ].join(" ");
    return <polygon points={points} fill={fill} stroke={stroke} strokeWidth={2} transform={transform}/>;
  }
  // diamond
  const pts = [
    `${cx},${cy - size/2}`,
    `${cx + size/2},${cy}`,
    `${cx},${cy + size/2}`,
    `${cx - size/2},${cy}`
  ].join(" ");
  return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={2} transform={transform}/>;
}
const SvgChoice: React.FC<{atoms: SvgAtom[]}> = ({atoms}) => (
  <svg viewBox="0 0 100 100" width={116} height={116} style={{background:"#f8fff6",border:"3px solid #2f4f2f",borderRadius:12}}>
    {atoms.map((a, idx)=> <g key={idx}>{shapePath(a)}</g>)}
  </svg>
);

/** ========= Settings ========= */
type Settings = {
  grade: GradeLevel;
  boards: Board[];
  allowHarder: boolean;
};
const DEFAULT_SETTINGS: Settings = {
  grade: "Y4",
  boards: ["Kent","Bexley"],
  allowHarder: false
};
function loadSettings(): Settings{
  if(typeof window==="undefined") return DEFAULT_SETTINGS;
  try{ const raw = localStorage.getItem("settings"); return raw ? {...DEFAULT_SETTINGS, ...JSON.parse(raw)} : DEFAULT_SETTINGS; }catch{ return DEFAULT_SETTINGS; }
}
function saveSettings(s: Settings){ localStorage.setItem("settings", JSON.stringify(s)); }

const SettingsPanel: React.FC<{settings: Settings; onChange:(s:Settings)=>void; onClose:()=>void}> = ({settings,onChange,onClose}) => {
  function update<K extends keyof Settings>(k: K, v: Settings[K]){ const next={...settings,[k]:v}; onChange(next); saveSettings(next); }
  function toggleBoard(b: Board){ const has=settings.boards.includes(b); update("boards", has ? settings.boards.filter(x=>x!==b) : [...settings.boards, b]); }
  return (
    <Card>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div className="text-xl font-extrabold">Settings</div>
        <button onClick={onClose} className="underline text-sm">Close</button>
      </div>
      <div style={{display:"grid",gap:12,marginTop:8}}>
        <div>
          <div className="font-semibold mb-1">Grade level</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <BlockButton onClick={()=>update("grade","Y4")} style={{outline: settings.grade==="Y4" ? "4px solid #2f4f2f" : "none"}}>Year 4</BlockButton>
            <BlockButton onClick={()=>update("grade","Y5")} style={{outline: settings.grade==="Y5" ? "4px solid #2f4f2f" : "none"}}>Year 5</BlockButton>
            <BlockButton onClick={()=>update("grade","DASH")} style={{outline: settings.grade==="DASH" ? "4px solid #2f4f2f" : "none"}}>Final Dash</BlockButton>
          </div>
        </div>
        <div>
          <div className="font-semibold mb-1">Exam profiles</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {(["Kent","Bexley","Generic"] as Board[]).map(b=>(
              <BlockButton key={b} onClick={()=>toggleBoard(b)} style={{outline: settings.boards.includes(b) ? "4px solid #2f4f2f" : "none"}}>{b}</BlockButton>
            ))}
          </div>
        </div>
        <div>
          <div className="font-semibold mb-1">Difficulty</div>
          <label style={{display:"flex",gap:8,alignItems:"center"}}>
            <input type="checkbox" checked={settings.allowHarder} onChange={e=>update("allowHarder", e.target.checked)} />
            <span>Allow harder variants</span>
          </label>
        </div>
      </div>
    </Card>
  );
};

/** ========= Generators ========= */
/* English */
function genEnglish(settings: Settings): Question[]{
  const qs: Question[] = [];
  // Synonyms
  const synPairs: ReadonlyArray<readonly [string,string]> = [
    ["happy","joyful"],["angry","furious"],["small","tiny"],["fast","quick"],["brave","courageous"],["eager","keen"]
  ];
  for(let i=0;i<3;i++){
    const [w,s] = synPairs[randInt(0, synPairs.length-1)];
    const wrongs = shuffle(["sad","tired","slow","worried","lazy","gentle","quiet"]).slice(0,3);
    const choices = shuffle([s, ...wrongs]);
    qs.push({id:`eng-syn-${Date.now()}-${i}`, subject:"english", stem:`Choose a synonym for “${w}”:`, choices, answerIndex: choices.indexOf(s), explanation:`“${s}” is closest in meaning to “${w}”.`, tags:[settings.grade==="Y4"?"year:4":"year:5"] });
  }
  // Antonyms
  const antPairs: ReadonlyArray<readonly [string,string]> = [
    ["scarce","plentiful"],["visible","hidden"],["polite","rude"],["brave","cowardly"]
  ];
  for(let i=0;i<2;i++){
    const [w,a] = antPairs[randInt(0, antPairs.length-1)];
    const wrongs = shuffle(["tiny","friendly","eager","warm","shy"]).slice(0,3);
    const choices = shuffle([a, ...wrongs]);
    qs.push({id:`eng-ant-${Date.now()}-${i}`, subject:"english", stem:`Select the best antonym for “${w}”:`, choices, answerIndex: choices.indexOf(a)});
  }
  // Vocab in context
  const vocabCtx = [
    {sent:"The room was in a *chaotic* state after the party.", correct:"disordered", wrongs:["silent","gleaming","fragile"]},
    {sent:"She gave a *reluctant* smile.", correct:"unwilling", wrongs:["excited","careless","angry"]},
    {sent:"The old map was *illegible*.", correct:"hard to read", wrongs:["easy to fold","ancient","fake"]},
  ] as const;
  for(let i=0;i<3;i++){
    const it = vocabCtx[randInt(0, vocabCtx.length-1)];
    const choices = shuffle([it.correct, ...it.wrongs]);
    qs.push({id:`eng-vctx-${Date.now()}-${i}`, subject:"english", stem: it.sent+" — The underlined word most nearly means:", choices, answerIndex: choices.indexOf(it.correct)});
  }
  // Grammar / punctuation
  const punct = [
    {q:"Choose the correctly punctuated sentence:", correct:"The fox, swift and silent, darted away.", wrongs:["The fox swift and silent darted away.","The fox, swift and silent darted away.","The fox swift, and silent, darted away."]},
    {q:"Which sentence uses an apostrophe correctly?", correct:"It’s nearly time for lunch.", wrongs:["Its nearly time for lunch.","Its’ nearly time for lunch.","It nearly’s time for lunch."]},
  ] as const;
  for(let i=0;i<2;i++){
    const it = punct[randInt(0, punct.length-1)];
    const choices = shuffle([it.correct, ...it.wrongs]);
    qs.push({id:`eng-punct-${Date.now()}-${i}`, subject:"english", stem: it.q, choices, answerIndex: choices.indexOf(it.correct), difficulty:"hard"});
  }
  return uniqueByIdThenStem(qs);
}

/* Maths (+ simple geometry) */
function genMaths(settings: Settings): Question[]{
  const qs: Question[] = [];
  // Times tables
  for(let i=0;i<3;i++){
    const a = randInt(2, 12), b = randInt(2, 12);
    const ans = a*b;
    const choices = shuffle([ans, ans+randInt(1,4), Math.max(1,ans-randInt(1,4)), ans+randInt(5,8)]).map(String);
    qs.push({id:`m-mul-${Date.now()}-${i}`, subject:"maths", stem:`What is ${a} × ${b}?`, choices, answerIndex: choices.indexOf(String(ans)), tags:[settings.grade==="Y4"?"year:4":"year:5"]});
  }
  // Subtraction
  for(let i=0;i<2;i++){
    const big = randInt(60, 200), small = randInt(1, 59);
    const ans = big - small;
    const choices = shuffle([ans, ans+randInt(1,4), Math.max(1,ans-randInt(1,4)), ans+randInt(5,9)]).map(String);
    qs.push({id:`m-sub-${Date.now()}-${i}`, subject:"maths", stem:`Calculate ${big} − ${small}`, choices, answerIndex: choices.indexOf(String(ans))});
  }
  // Fractions of whole
  for(let i=0;i<3;i++){
    const denom = [4,5,8,10][randInt(0,3)], num=[1,2,3][randInt(0,2)], whole=randInt(12,60);
    const ans = Math.round(((num/denom)*whole)*100)/100;
    const choices = shuffle([ans, ans+1, Math.max(1,ans-1), ans+2]).map(String);
    qs.push({id:`m-frac-${Date.now()}-${i}`, subject:"maths", stem:`What is ${num}/${denom} of ${whole}?`, choices, answerIndex: choices.indexOf(String(ans))});
  }
  // Percentage inc/dec
  for(let i=0;i<2;i++){
    const base = randInt(40,200), pct=[10,12,20,25][randInt(0,3)], inc=Math.random()<0.5;
    const ans = Math.round((inc? base*(1+pct/100): base*(1-pct/100))*100)/100;
    const choices = shuffle([ans, ans+1, Math.max(1,ans-1), ans+3]).map(String);
    qs.push({id:`m-pct-${Date.now()}-${i}`, subject:"maths", stem:`${inc?"Increase":"Reduce"} £${base} by ${pct}%`, choices, answerIndex: choices.indexOf(String(ans))});
  }
  // Geometry — compare areas via labelled options (show SVG tiles as placeholders)
  for(let i=0;i<2;i++){
    const rects = Array.from({length:4}).map(()=>({w:randInt(3,12), h:randInt(3,12)}));
    const areas = rects.map(r=>r.w*r.h);
    const correct = areas.indexOf(Math.max(...areas));
    const options: SvgAtom[][] = rects.map(()=>[{shape:"square",fill:"white",size:56,x:50,y:50}]);
    const stem = `Which rectangle has the largest area? (A: ${rects[0].w}×${rects[0].h}, B: ${rects[1].w}×${rects[1].h}, C: ${rects[2].w}×${rects[2].h}, D: ${rects[3].w}×${rects[3].h})`;
    qs.push({id:`m-geom-rect-${Date.now()}-${i}`, subject:"maths", stem, choices:["A","B","C","D"], answerIndex: correct, svgChoiceSets: options});
  }
  // Multi-step word problem
  for(let i=0;i<2;i++){
    const price = randInt(2,8), qty = randInt(3,12), extra = randInt(1,4);
    const ans = price*qty + extra;
    const choices = shuffle([ans, ans+2, Math.max(1,ans-2), ans+5]).map(String);
    qs.push({id:`m-word-${Date.now()}-${i}`, subject:"maths", stem:`Stickers cost £${price} each. Tom buys ${qty} stickers and a £${extra} notebook. How much in total?`, choices, answerIndex: choices.indexOf(String(ans))});
  }
  return uniqueByIdThenStem(qs);
}

/* VR */
function genVR(settings: Settings): Question[]{
  const qs: Question[] = [];
  for(let i=0;i<4;i++){
    const start = 65 + randInt(0,18);
    const step = [1,2,3][randInt(0,2)];
    const a = String.fromCharCode(start);
    const b = String.fromCharCode(start+step);
    const c = String.fromCharCode(start+step*2);
    const d = String.fromCharCode(start+step*3);
    const next = String.fromCharCode(start+step*4);
    const choices = shuffle([next,String.fromCharCode(next.charCodeAt(0)+1),String.fromCharCode(next.charCodeAt(0)-1),a]);
    qs.push({id:`vr-ser-${Date.now()}-${i}`, subject:"vr", stem:`Find the next pair: ${a}${b}, ${b}${c}, ${c}${d}, ${d}${next[0]}, __`, choices, answerIndex: choices.indexOf(next), difficulty:"medium"});
  }
  const analogies = [
    {stem:"PUPIL is to SCHOOL as PATIENT is to ____", correct:"HOSPITAL", wrongs:["BED","WARD","NURSE"]},
    {stem:"BEE is to HIVE as BIRD is to ____", correct:"NEST", wrongs:["BARK","FLOCK","EGG"]},
    {stem:"AUTHOR is to BOOK as PAINTER is to ____", correct:"CANVAS", wrongs:["INK","BRUSH","GALLERY"]},
  ] as const;
  for(let i=0;i<3;i++){
    const it = analogies[randInt(0, analogies.length-1)];
    const choices = shuffle([it.correct, ...it.wrongs]);
    qs.push({id:`vr-ana-${Date.now()}-${i}`, subject:"vr", stem:it.stem, choices, answerIndex: choices.indexOf(it.correct), difficulty:"easy"});
  }
  // Simple codes (A=1 etc.)
  for(let i=0;i<3;i++){
    const word = ["BAD","ACE","BEG"][randInt(0,2)];
    const encode = (s:string)=> s.split("").map(ch=> (ch.charCodeAt(0)-64)).join("-");
    const correct = encode(word);
    const alt = encode("CAB");
    const choices = shuffle([correct, alt, "2-2-2", "1-1-1"]);
    qs.push({id:`vr-code-${Date.now()}-${i}`, subject:"vr", stem:`Code the word ${word} where A=1, B=2...`, choices, answerIndex: choices.indexOf(correct)});
  }
  return uniqueByIdThenStem(qs);
}

/* NVR — SVG odd-one-out & rotation */
function genNVR(settings: Settings): Question[]{
  const qs: Question[] = [];
  // Fill odd-one-out
  for(let i=0;i<5;i++){
    const commonFill: FillKind = Math.random()<0.5 ? "black":"white";
    const oddFill: FillKind = commonFill==="black" ? "white":"black";
    const shapes: ShapeKind[] = ["triangle","square","circle","diamond"];
    const opts: SvgAtom[][] = [
      [{shape:shapes[0],fill:commonFill,size:56,x:50,y:50}],
      [{shape:shapes[1],fill:commonFill,size:56,x:50,y:50}],
      [{shape:shapes[2],fill:commonFill,size:56,x:50,y:50}],
      [{shape:shapes[3],fill:oddFill,size:56,x:50,y:50}],
    ];
    const order = shuffle([0,1,2,3]);
    const answer = order.indexOf(3);
    const shuffled = order.map(idx=>opts[idx]);
    qs.push({id:`nvr-odd-fill-${Date.now()}-${i}`, subject:"nvr", stem:"Which is the odd one out?", choices:["A","B","C","D"], answerIndex: answer, svgChoiceSets: shuffled, difficulty:"easy"});
  }
  // Rotation odd-one-out
  for(let i=0;i<5;i++){
    const baseRot = [0,90,180][randInt(0,2)];
    const opts: SvgAtom[][] = [
      [{shape:"square",fill:"black",size:56,x:50,y:50,rotation:baseRot}],
      [{shape:"square",fill:"black",size:56,x:50,y:50,rotation:(baseRot+90)%360}],
      [{shape:"square",fill:"black",size:56,x:50,y:50,rotation:(baseRot+180)%360}],
      [{shape:"square",fill:"black",size:56,x:50,y:50,rotation:45}],
    ];
    const order = shuffle([0,1,2,3]);
    const answer = order.indexOf(3);
    const shuffled = order.map(idx=>opts[idx]);
    qs.push({id:`nvr-rot-odd-${Date.now()}-${i}`, subject:"nvr", stem:"Which figure has a different rotation?", choices:["A","B","C","D"], answerIndex: answer, svgChoiceSets: shuffled, difficulty:"medium"});
  }
  return uniqueByIdThenStem(qs);
}

/** ========= Data loading ========= */
async function loadCurated(subj: Exclude<Subject,"comprehension"|"writing">, settings: Settings): Promise<Question[]>{
  const map: Record<Exclude<Subject,"comprehension"|"writing">, string> = { maths:"math", english:"english", vr:"vr", nvr:"nvr" };
  try{
    const res = await fetch(`/questions/${map[subj]}.json`, { cache:"no-store" });
    const arr = await res.json() as unknown;
    if(Array.isArray(arr)) {
      const yearTag = settings.grade==="Y4" ? "year:4" : settings.grade==="Y5" ? "year:5" : "year:6";
      const typed = (arr as RawQuestion[])
        .map((q)=> ({
          id: String(q.id),
          subject: subj,
          stem: String(q.stem),
          choices: Array.isArray(q.choices) ? q.choices.map(String) : [],
          answerIndex: Number(q.answerIndex),
          explanation: q.explanation,
          svgChoiceSets: q.svgChoiceSets,
          tags: q.tags || [],
          exam_board: q.exam_board || ["Generic"]
        }))
        .filter(q=>{
          const yearOk = !q.tags?.length || q.tags.includes(yearTag);
          const boardOk = !q.exam_board?.length || q.exam_board.some(b=> settings.boards.includes(b));
          return yearOk && boardOk;
        });
      return uniqueByIdThenStem(typed);
    }
    return [];
  }catch{
    return [];
  }
}
async function loadComprehension(): Promise<Passage[]>{ 
  try{ 
    const res = await fetch("/questions/comprehension.json", { cache:"no-store" }); 
    const arr = await res.json() as unknown; 
    return Array.isArray(arr)? arr as Passage[] : []; 
  }catch{ return []; } 
}

/** ========= Page ========= */
export default function Page(){
  const [mode,setMode]=useState<Mode>("menu");
  const [subject,setSubject]=useState<Subject|null>(null);
  const [questions,setQuestions]=useState<Question[]>([]);
  const [index,setIndex]=useState(0);
  const [answers,setAnswers]=useState<number[]>([]);
  const [secondsLeft,setSecondsLeft]=useState(QUIZ_SECONDS);
  const [dailyUsed,setDailyUsed]=useState(0);
  const [passage,setPassage]=useState<Passage|null>(null);
  const [writing,setWriting]=useState<string>("");
  const [writingTime,setWritingTime]=useState(WRITING_SECONDS);
  const [settings,setSettings]=useState<Settings>(DEFAULT_SETTINGS);

  useEffect(()=>{ setDailyUsed(getUsedSecondsToday()); setSettings(loadSettings()); },[]);

  // Quiz timer
  useEffect(()=>{
    if(mode!=="quiz") return;
    if(secondsLeft<=0){ setMode("results"); addUsedSecondsToday(QUIZ_SECONDS); setDailyUsed(getUsedSecondsToday()); return; }
    const t=setTimeout(()=>setSecondsLeft(s=>s-1),1000); return ()=>clearTimeout(t);
  },[mode,secondsLeft]);

  // Writing timer
  useEffect(()=>{
    if(mode!=="writing") return;
    if(writingTime<=0){ setMode("writingResults"); return; }
    const t=setTimeout(()=>setWritingTime(s=>s-1),1000); return ()=>clearTimeout(t);
  },[mode,writingTime]);

  const canStart = dailyUsed < DAILY_CAP_SECONDS;
  const remainingToday = Math.max(0, DAILY_CAP_SECONDS - dailyUsed);

  /** ===== Start flows ===== */
  async function startComprehension(){
    if(!canStart) return;
    const comp = await loadComprehension();
    if(!comp.length) return;
    const chosen = comp[randInt(0, comp.length-1)];
    setPassage(chosen);
    const qs: Question[] = chosen.questions.slice(0,COMP_QUESTION_COUNT).map((q,i)=>({
      id:`${chosen.id}-${i}`,
      subject:"comprehension",
      stem:q.stem,
      choices:q.choices,
      answerIndex:q.answerIndex,
      explanation:q.explanation,
    }));
    setSubject("comprehension");
    setQuestions(qs);
    setIndex(0);
    setAnswers([]);
    setSecondsLeft(Math.min(QUIZ_SECONDS, remainingToday));
    setMode("quiz");
  }

  function generateFor(subj: Exclude<Subject,"comprehension"|"writing">): Question[]{
    if(subj==="english") return genEnglish(settings);
    if(subj==="maths") return genMaths(settings);
    if(subj==="vr") return genVR(settings);
    if(subj==="nvr") return genNVR(settings);
    return [];
  }

  async function startQuiz(subj: Subject){
    if(!canStart) return;
    if(subj==="comprehension"){ await startComprehension(); return; }
    if(subj==="writing"){
      setSubject("writing"); setWriting(""); setWritingTime(Math.min(WRITING_SECONDS, remainingToday)); setMode("writing"); return;
    }

    const curated = await loadCurated(subj, settings);
    const generated = generateFor(subj);

    // Build pool per rules:
    // - NVR prefers SVG-generated; curated NVR only if it has svgChoiceSets
    // - Otherwise mix curated + generated
    let pool: Question[] = [];
    if(subj==="nvr"){
      const curatedSVG = curated.filter(q=>Array.isArray(q.svgChoiceSets) && q.svgChoiceSets.length===4);
      pool = uniqueByIdThenStem([...generated, ...curatedSVG]);
    } else {
      pool = uniqueByIdThenStem(shuffle([...curated, ...generated]));
    }

    const need = PER_SUBJECT_COUNT[subj as Exclude<Subject,"comprehension"|"writing">];
    const selected = pool.slice(0, need); // already deduped
    setSubject(subj);
    setQuestions(selected);
    setIndex(0);
    setAnswers([]);
    setSecondsLeft(Math.min(QUIZ_SECONDS, remainingToday));
    setMode("quiz");
  }

  /** ===== Answer & score ===== */
  function answer(i:number){
    setAnswers(prev=>[...prev,i]);
    if(index+1<questions.length) setIndex(x=>x+1); else setMode("results");
  }
  const correctCount = questions.reduce((acc, q, i)=> acc + (answers[i]===q.answerIndex ? 1 : 0), 0);

  /** ===== UI ===== */
  const current = questions[index];

  const Header = (
    <div className="w-full" style={{display:"flex",flexDirection:"column",gap:6}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <h1 className="text-2xl sm:text-3xl font-extrabold" style={{textShadow:"2px 2px #8fbf7a"}}>11+ Adventure</h1>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <Pill>Daily: {Math.floor(dailyUsed/60)}m/{Math.floor(DAILY_CAP_SECONDS/60)}m</Pill>
          {mode==="quiz" && <Pill>Time Left: {Math.floor(secondsLeft/60)}:{String(secondsLeft%60).padStart(2,"0")}</Pill>}
          {mode==="writing" && <Pill>Time Left: {Math.floor(writingTime/60)}:{String(writingTime%60).padStart(2,"0")}</Pill>}
        </div>
      </div>
      <div className="text-sm opacity-80">Minecraft-inspired • Kent/Bexley • Y4/Y5/Final Dash • 10-minute quizzes • 30-minute daily cap</div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(180deg,#c8e6c9,#a5d6a7)",color:"#20351f",padding:16}}>
      <div style={{maxWidth:980,margin:"0 auto",display:"grid",gap:16}}>
        {Header}

        {mode==="menu" && (
          <Card>
            <div style={{display:"grid",gap:12}}>
              {!canStart && (
                <div style={{padding:12,borderRadius:10,background:"#ffe8d2",border:"2px solid #cc8a4a"}}>
                  <div style={{fontWeight:700}}>Daily time done — amazing work!</div>
                  <div>You've reached 30 minutes today. Come back tomorrow for more quests. 💚</div>
                </div>
              )}
              <div style={{display:"flex",flexWrap:"wrap",gap:12}}>
                <BlockButton disabled={!canStart} onClick={()=>startQuiz("maths")}>Maths</BlockButton>
                <BlockButton disabled={!canStart} onClick={()=>startQuiz("english")}>English</BlockButton>
                <BlockButton disabled={!canStart} onClick={()=>startQuiz("vr")}>VR</BlockButton>
                <BlockButton disabled={!canStart} onClick={()=>startQuiz("nvr")}>NVR</BlockButton>
                <BlockButton disabled={!canStart} onClick={()=>startComprehension()}>Comprehension</BlockButton>
                <BlockButton disabled={!canStart} onClick={()=>startQuiz("writing")}>Writing (typed, 30m)</BlockButton>
              </div>
              <div className="text-sm opacity-80">
                Counts — Maths {PER_SUBJECT_COUNT.maths} • English {PER_SUBJECT_COUNT.english} • VR {PER_SUBJECT_COUNT.vr} • NVR {PER_SUBJECT_COUNT.nvr} • Comprehension up to {COMP_QUESTION_COUNT}
              </div>
              <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                <BlockButton onClick={()=>setMode("practice")} style={{background:"#9cd67c"}}>Practice Hub</BlockButton>
                <BlockButton onClick={()=>setMode("settings")} style={{background:"#c2e88f"}}>Settings</BlockButton>
              </div>
            </div>
          </Card>
        )}

        {mode==="settings" && (
          <SettingsPanel settings={settings} onChange={setSettings} onClose={()=>setMode("menu")} />
        )}

        {mode==="practice" && (
          <Card>
            <div style={{display:"grid",gap:10}}>
              <div className="text-xl font-bold">Practice Hub (links)</div>
              <div className="opacity-80 text-sm">Open-licensed content can be added to your local question bank with attribution. Proprietary materials should be used via links.</div>
              <ul className="list-disc pl-6 space-y-1">
                <li><a className="underline" href="https://11plus.gl-assessment.co.uk/free-materials/" target="_blank" rel="noreferrer">GL Assessment: Free Familiarisation Materials</a></li>
                <li><a className="underline" href="https://www.bbc.co.uk/bitesize" target="_blank" rel="noreferrer">BBC Bitesize (Maths & English)</a></li>
                <li><a className="underline" href="https://nrich.maths.org/" target="_blank" rel="noreferrer">NRICH problem solving</a></li>
                <li><a className="underline" href="https://www.thenational.academy/" target="_blank" rel="noreferrer">Oak National Academy (grammar, reading)</a></li>
              </ul>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <BlockButton onClick={()=>setMode("menu")}>Back</BlockButton>
              </div>
            </div>
          </Card>
        )}

        {mode==="quiz" && current && (
          <Card>
            <div style={{display:"grid",gap:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <Pill>Q {index+1}/{questions.length}</Pill>
                  <Pill>Subject: {subject}</Pill>
                </div>
                <BlockButton onClick={()=>setMode("results")} style={{background:"#f3a09a"}}>End quiz</BlockButton>
              </div>

              {subject==="comprehension" && passage && (
                <div style={{padding:12,border:"2px dashed #5a8151",borderRadius:12,background:"#f7fff2"}}>
                  <div style={{fontWeight:800,marginBottom:6}}>{passage.title||"Passage"}</div>
                  <div style={{whiteSpace:"pre-wrap"}}>{passage.text}</div>
                </div>
              )}

              <div className="text-lg font-bold">{current.stem}</div>

              {current.svgChoiceSets ? (
                <div style={{display:"grid",gap:10,gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))"}}>
                  {current.svgChoiceSets.map((atoms, i)=>(
                    <button key={i} onClick={()=>answer(i)} style={{background:"transparent",border:"none",padding:0,cursor:"pointer"}}>
                      <SvgChoice atoms={atoms}/>
                      <div style={{textAlign:"center",marginTop:6,fontWeight:700}}>{"ABCD"[i]}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{display:"grid",gap:10}}>
                  {current.choices.map((c, i)=>(
                    <BlockButton key={i} onClick={()=>answer(i)}>{c}</BlockButton>
                  ))}
                </div>
              )}

              <div className="text-xs opacity-70">Boards: {(current.exam_board||["Generic"]).join(", ")} {current.tags?.length? `• Tags: ${current.tags.join(", ")}`:""}</div>
            </div>
          </Card>
        )}

        {mode==="results" && (
          <Card>
            <div style={{display:"grid",gap:12}}>
              <div className="text-2xl font-extrabold">Results</div>
              <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                <div style={{width:72,height:72,borderRadius:"50%",background:"#9ad27a",border:"4px solid #2f4f2f",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:800}}>
                  {correctCount}/{questions.length}
                </div>
                <div>Score</div>
              </div>
              <div style={{display:"grid",gap:10}}>
                {questions.map((q,i)=>{
                  const your = answers[i];
                  const yourText = typeof your==="number" ? (q.svgChoiceSets ? "Option "+("ABCD"[your]) : q.choices[your]) : "—";
                  const correctText = q.svgChoiceSets ? "Option "+("ABCD"[q.answerIndex]) : q.choices[q.answerIndex];
                  return (
                    <div key={q.id} style={{border:"2px solid #6f9e63",borderRadius:10,padding:12,background:"#eef7ea"}}>
                      <div className="font-semibold">Q{i+1}. {q.stem}</div>
                      <div className="text-sm">Your answer: <strong>{yourText}</strong> • Correct: <strong>{correctText}</strong></div>
                      {q.explanation && <div className="text-sm opacity-90 mt-1">Explanation: {q.explanation}</div>}
                    </div>
                  );
                })}
              </div>
              <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                <BlockButton onClick={()=>setMode("menu")}>Back to Menu</BlockButton>
                <BlockButton onClick={()=>subject && startQuiz(subject)}>Try another {subject||""}</BlockButton>
              </div>
            </div>
          </Card>
        )}

        {mode==="writing" && (
          <Card>
            <div style={{display:"grid",gap:12}}>
              <div style={{display:"flex",gap:8,alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <Pill>Writing (typing)</Pill>
                  <Pill>Time {Math.floor(writingTime/60)}:{String(writingTime%60).padStart(2,"0")}</Pill>
                </div>
                <BlockButton onClick={()=>setMode("writingResults")} style={{background:"#9ad27a"}}>Finish</BlockButton>
              </div>
              <div style={{fontWeight:800}}>Write a story that begins with: “The door creaked open …”</div>
              <textarea
                spellCheck={false} autoCorrect="off" autoCapitalize="off"
                value={writing} onChange={e=>setWriting(e.target.value)} rows={16}
                style={{width:"100%",padding:12,border:"3px solid #2f4f2f",borderRadius:12,background:"#fffef9",fontSize:16,lineHeight:1.5}}
              />
            </div>
          </Card>
        )}

        {mode==="writingResults" && (
          <Card>
            <div style={{display:"grid",gap:12}}>
              <div className="text-2xl font-extrabold">Your writing</div>
              <div style={{whiteSpace:"pre-wrap",border:"2px solid #6f9e63",borderRadius:10,padding:12,background:"#eef7ea"}}>{writing}</div>
              <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                <BlockButton onClick={()=>setMode("menu")}>Back to Menu</BlockButton>
                <BlockButton onClick={()=>startQuiz("writing")}>Try another prompt</BlockButton>
              </div>
            </div>
          </Card>
        )}

        <footer style={{fontSize:12,opacity:0.7,textAlign:"center",paddingTop:24}}>
          © 2025 • 11+ Adventure • Minecraft-inspired UI (non-affiliated). Open JSON banks under /public/questions.
        </footer>
      </div>
    </div>
  );
}
