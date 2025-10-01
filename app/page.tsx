"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";

/** ========= Types ========= */
type Subject = "maths" | "english" | "vr" | "nvr" | "comprehension" | "writing";
type Mode = "menu" | "quiz" | "results" | "practice" | "writing" | "writingResults";

type GradeLevel = "Y4" | "Y5" | "DASH";
type Board = "Kent" | "Bexley" | "Generic";

type ShapeKind = "triangle" | "square" | "circle" | "diamond";
type FillKind = "black" | "white";

type SvgAtom = {
  shape: ShapeKind;
  fill: FillKind;
  size: number;       // 10-60 px
  rotation?: number;  // degrees
  x: number;          // 0-100 (100x100 viewbox)
  y: number;          // 0-100
};

type Question = {
  id: string;
  subject: Exclude<Subject,"writing">;
  stem: string;
  choices: string[];         // For SVG options still ["A","B","C","D"]
  answerIndex: number;
  explanation?: string;
  tags?: string[];           // ["year:5","topic:fractions","skill:...","difficulty:medium"]
  exam_board?: Board[];
  svgChoiceSets?: SvgAtom[][]; // If present, render as SVG tiles
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
const APP_NAME = "ElevenEdge";
const QUIZ_SECONDS = 10 * 60;
const DAILY_CAP_SECONDS = 30 * 60;
const WRITING_SECONDS = 30 * 60;
const COMP_QUESTION_COUNT = 5;

/** Target counts per subject */
const TARGET_COUNTS: Record<Exclude<Subject,"comprehension"|"writing">, number> = {
  maths: 12, english: 12, vr: 10, nvr: 10,
};

/** Topic quotas per subject */
const MATHS_QUOTA = { arithmetic: 4, fracpct: 3, geometry: 2, word: 2, data: 1 } as const;
const ENGLISH_QUOTA = { vocab: 4, grammar: 4, cloze: 2, improve: 2 } as const;
const VR_QUOTA = { sequences: 4, analogies: 3, codes: 3 } as const;
const NVR_QUOTA = { odd: 4, rotation: 3, reflection: 2, matrix: 1 } as const;

/** ========= Time helpers ========= */
function todayKey(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
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
function randInt(min:number,max:number){ return Math.floor(Math.random()*(max-min+1))+min; }
function stemHash(stem:string){
  let h=0; for(let i=0;i<stem.length;i++){ h=(h*31 + stem.charCodeAt(i))|0; } return h.toString();
}
function uniqueByIdThenStem<T extends {id:string; stem?:string}>(arr: readonly T[]){
  const seenId=new Set<string>(), seenStem=new Set<string>(); const out:T[]=[];
  for(const it of arr){
    const sid=it.id; const sh = it.stem ? stemHash(it.stem) : "";
    if(seenId.has(sid)) continue;
    if(sh && seenStem.has(sh)) continue;
    seenId.add(sid); if(sh) seenStem.add(sh);
    out.push(it);
  }
  return out;
}

/** Recent-ID buffer across back-to-back quizzes (session only) */
const RECENT_KEY = "recentIds_v1";

function getRecentIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function pushRecentIds(ids: string[]) {
  if (typeof window === "undefined") return;
  const merged = [...getRecentIds(), ...ids];
  const dedup = Array.from(new Set(merged));
  sessionStorage.setItem(RECENT_KEY, JSON.stringify(dedup.slice(-120)));
}

function filterNotRecent<T extends { id: string }>(arr: readonly T[]) {
  const recent = new Set(getRecentIds());
  return arr.filter((q) => !recent.has(q.id));
}

/** ========= Minecraft-y UI ========= */
const Card: React.FC<{children: React.ReactNode; className?: string; style?: React.CSSProperties}> = ({children, className, style}) => (
  <div className={className} style={{borderRadius:16,border:"4px solid #3b3b3b",boxShadow:"0 8px 24px rgba(0,0,0,0.1)",padding:16,background:"linear-gradient(135deg,#e8f7e8,#d4eed4)",...style}}>{children}</div>
);
const BlockButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({children,style,...props}) => (
  <button {...props} style={{padding:"12px 16px",borderRadius:12,border:"4px solid #2f4f2f",boxShadow:"0 2px 0 rgba(0,0,0,0.15)",background:"#7cc76b",fontWeight:700,letterSpacing:0.2,cursor:"pointer",...style}}>{children}</button>
);
const Pill: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children,style}) => (
  <span style={{display:"inline-block",padding:"6px 12px",borderRadius:999,background:"#cfe9c9",border:"1px solid #5a8151",fontSize:12,...style}}>{children}</span>
);

/** ========= SVG Renderer (NVR / Maths diagrams) ========= */
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

const chipStyle = (active:boolean): React.CSSProperties => ({ outline: active ? "4px solid #2f4f2f" : "none", background: active ? "#8dde79" : "#7cc76b" });

/** Banner (logo space + title + right slot) */
const Banner: React.FC<{right?: React.ReactNode}> = ({right}) => (
  <div style={{position:"sticky",top:0,zIndex:20,background:"linear-gradient(180deg,#bde2b9,#a5d6a7)",borderBottom:"4px solid #2f4f2f"}}>
    <div style={{maxWidth:980,margin:"0 auto",padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:48,height:48,border:"4px solid #2f4f2f",borderRadius:8,background:"#eaf7e6"}} aria-label="Logo placeholder" />
        <div>
          <div className="text-xl sm:text-2xl font-extrabold" style={{textShadow:"2px 2px #8fbf7a"}}>{APP_NAME}</div>
          <div className="text-xs opacity-80">11+ Practice</div>
        </div>
      </div>
      <div>{right}</div>
    </div>
  </div>
);

/** Profile Bar shown on Home */
const ProfileBar: React.FC<{settings: Settings; onChange:(s:Settings)=>void;}> = ({settings,onChange}) => {
  function update<K extends keyof Settings>(k: K, v: Settings[K]){ const next={...settings,[k]:v}; onChange(next); saveSettings(next); }
  function toggleBoard(b: Board){ const has=settings.boards.includes(b); update("boards", has ? settings.boards.filter(x=>x!==b) : [...settings.boards, b]); }

  return (
    <Card>
      <div style={{display:"grid",gap:12}}>
        <div style={{fontWeight:800}}>Profile</div>

        <div>
          <div className="font-semibold mb-1">Year group</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <BlockButton style={chipStyle(settings.grade==="Y4")} onClick={()=>update("grade","Y4")}>Year 4</BlockButton>
            <BlockButton style={chipStyle(settings.grade==="Y5")} onClick={()=>update("grade","Y5")}>Year 5</BlockButton>
            <BlockButton style={chipStyle(settings.grade==="DASH")} onClick={()=>update("grade","DASH")}>Final Dash</BlockButton>
          </div>
        </div>

        <div>
          <div className="font-semibold mb-1">Exam profiles</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {(["Kent","Bexley","Generic"] as Board[]).map(b=>(
              <BlockButton key={b} style={chipStyle(settings.boards.includes(b))} onClick={()=>toggleBoard(b)}>{b}</BlockButton>
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

        <div className="text-sm opacity-80">
          Current: <strong>{settings.grade==="DASH"?"Final Dash":settings.grade}</strong> • Boards: {settings.boards.join(", ")} • Harder: {settings.allowHarder ? "On" : "Off"}
        </div>
      </div>
    </Card>
  );
};

/** ========= Generators ========= */
/** Helpers to pick difficulty windows by grade/difficulty toggle */
function allowDifficulties(grade: GradeLevel, harder:boolean): Array<"easy"|"medium"|"hard">{
  if(grade==="Y4") return harder? ["easy","medium"] : ["easy","medium"];
  if(grade==="Y5") return harder? ["easy","medium","hard"] : ["easy","medium"];
  return harder? ["medium","hard"] : ["medium"]; // DASH
}
function yearTag(grade: GradeLevel){ return grade==="Y4"?"year:4":grade==="Y5"?"year:5":"year:6"; }

/** ---- English generators (vocab, grammar, cloze, improvement) ---- */
function genEnglish(settings: Settings){
  const out: Question[] = [];
  const diffs = allowDifficulties(settings.grade, settings.allowHarder);

  // vocab (synonyms/antonyms + vocab-in-context)
  const synPairs: ReadonlyArray<readonly [string,string,string[]]> = [
    ["happy","joyful",["sad","tired","slow"]],
    ["angry","furious",["calm","sleepy","gentle"]],
    ["small","tiny",["large","huge","giant"]],
    ["fast","quick",["slow","late","lazy"]],
    ["brave","courageous",["afraid","timid","shy"]],
    ["eager","keen",["reluctant","worried","tired"]]
  ];
  for(let i=0;i<3;i++){
    const [w,correct,wr] = synPairs[randInt(0,synPairs.length-1)];
    const choices = shuffle([correct, ...shuffle(wr).slice(0,3)]);
    out.push({id:`eng-vocab-syn-${Date.now()}-${i}`,subject:"english",stem:`Choose a synonym for “${w}”:`,choices,answerIndex:choices.indexOf(correct),explanation:`“${correct}” is closest in meaning to “${w}”.`,tags:[yearTag(settings.grade),"topic:vocab","skill:synonym",`difficulty:${shuffle(diffs)[0]}`]});
  }
  const antPairs: ReadonlyArray<readonly [string,string,string[]]> = [
    ["scarce","plentiful",["rare","limited","few"]],
    ["visible","hidden",["seen","clear","bright"]],
    ["polite","rude",["kind","helpful","nice"]]
  ];
  for(let i=0;i<1;i++){
    const [w,correct,wr] = antPairs[randInt(0,antPairs.length-1)];
    const choices = shuffle([correct, ...shuffle(wr).slice(0,3)]);
    out.push({id:`eng-vocab-ant-${Date.now()}-${i}`,subject:"english",stem:`Select the best antonym for “${w}”:`,choices,answerIndex:choices.indexOf(correct),explanation:`Antonym of “${w}” is “${correct}”.`,tags:[yearTag(settings.grade),"topic:vocab","skill:antonym",`difficulty:${shuffle(diffs)[0]}`]});
  }
  // grammar/punct
  const grammar = [
    {q:"Choose the correctly punctuated sentence:", correct:"The fox, swift and silent, darted away.", wrongs:["The fox swift and silent darted away.","The fox, swift and silent darted away.","The fox swift, and silent, darted away."]},
    {q:"Which sentence uses an apostrophe correctly?", correct:"It’s nearly time for lunch.", wrongs:["Its nearly time for lunch.","Its’ nearly time for lunch.","It nearly’s time for lunch."]}
  ] as const;
  for(let i=0;i<2;i++){
    const it = grammar[randInt(0,grammar.length-1)];
    const choices = shuffle([it.correct, ...it.wrongs]);
    out.push({id:`eng-grammar-${Date.now()}-${i}`,subject:"english",stem:it.q,choices,answerIndex:choices.indexOf(it.correct),explanation:"Check commas/apostrophes use.",tags:[yearTag(settings.grade),"topic:grammar","skill:punctuation",`difficulty:${shuffle(diffs)[0]}`]});
  }
  // cloze
  const cloze = [
    {stem:"They decided to ____ the hill before dusk.", correct:"climb", wrongs:["climbs","climbed","climbing"]},
    {stem:"I ____ my packed lunch today.", correct:"forgot", wrongs:["forget","forgets","forgetting"]},
  ] as const;
  for(let i=0;i<2;i++){
    const it = cloze[randInt(0,cloze.length-1)];
    const choices = shuffle([it.correct, ...it.wrongs]);
    out.push({id:`eng-cloze-${Date.now()}-${i}`,subject:"english",stem:it.stem,choices,answerIndex:choices.indexOf(it.correct),explanation:`Correct tense/inflection is “${it.correct}”.`,tags:[yearTag(settings.grade),"topic:cloze","skill:vocab-in-context",`difficulty:${shuffle(diffs)[0]}`]});
  }
  // sentence improvement
  const improve = [
    {bad:"The cat sleep on the mat.", good:"The cat sleeps on the mat.", other:["The cat slepts on the mat.","The cat sleeping on the mat."]},
    {bad:"We was going to the park.", good:"We were going to the park.", other:["We are went to the park.","We be going to the park."]}
  ] as const;
  for(let i=0;i<2;i++){
    const it = improve[randInt(0,improve.length-1)];
    const choices = shuffle([it.good, ...it.other]);
    out.push({id:`eng-improve-${Date.now()}-${i}`,subject:"english",stem:`Choose the best version: ${it.bad}`,choices,answerIndex:choices.indexOf(it.good),explanation:"Subject–verb agreement/tense.",tags:[yearTag(settings.grade),"topic:improve","skill:sentence",`difficulty:${shuffle(diffs)[0]}`]});
  }

  return out;
}

/** ---- Maths generators (arithmetic, fractions/percent, geometry, word, data) ---- */
function genMaths(settings: Settings){
  const out: Question[] = [];
  const y = settings.grade;

  // Arithmetic ×/÷ easier for Y4
  for(let i=0;i<4;i++){
    const a = y==="Y4" ? randInt(2,12) : randInt(6,18);
    const b = y==="Y4" ? randInt(2,12) : randInt(6,18);
    const ans = a*b;
    const choices = shuffle([ans, ans+randInt(1,4), Math.max(1,ans-randInt(1,4)), ans+randInt(5,8)]).map(String);
    out.push({id:`m-arith-${Date.now()}-${i}`,subject:"maths",stem:`What is ${a} × ${b}?`,choices,answerIndex:choices.indexOf(String(ans)),explanation:`${a} × ${b} = ${ans}.`,tags:[yearTag(y),"topic:arithmetic","skill:multiplication",`difficulty:${y==="DASH"?"medium":"easy"}`]});
  }

  // Fractions/percentages
  for(let i=0;i<3;i++){
    const denom = [4,5,8,10][randInt(0,3)], num=[1,2,3][randInt(0,2)], whole = y==="Y4" ? randInt(8,30) : randInt(12,60);
    const ans = Math.round(((num/denom)*whole)*100)/100;
    const choices = shuffle([ans, ans+1, Math.max(1,ans-1), ans+2]).map(String);
    out.push({id:`m-frac-${Date.now()}-${i}`,subject:"maths",stem:`What is ${num}/${denom} of ${whole}?`,choices,answerIndex:choices.indexOf(String(ans)),explanation:`${num}/${denom} × ${whole} = ${ans}.`,tags:[yearTag(y),"topic:fracpct","skill:frac-of-whole",`difficulty:${y==="DASH"?"hard":"medium"}`]});
  }

  // Geometry (area compare) with SVG tiles
  for(let i=0;i<2;i++){
    const rects = Array.from({length:4}).map(()=>({w:randInt(3,12), h:randInt(3,12)}));
    const areas = rects.map(r=>r.w*r.h);
    const correct = areas.indexOf(Math.max(...areas));
    const options: SvgAtom[][] = rects.map(()=>[{shape:"square",fill:"white",size:56,x:50,y:50}]);
    const stem = `Which rectangle has the largest area? (A: ${rects[0].w}×${rects[0].h}, B: ${rects[1].w}×${rects[1].h}, C: ${rects[2].w}×${rects[2].h}, D: ${rects[3].w}×${rects[3].h})`;
    out.push({id:`m-geom-${Date.now()}-${i}`,subject:"maths",stem,choices:["A","B","C","D"],answerIndex:correct,explanation:`Compare areas w×h; the largest product wins.`,svgChoiceSets:options,tags:[yearTag(y),"topic:geometry","skill:area",`difficulty:${y==="DASH"?"medium":"easy"}`]});
  }

  // Word problems
  for(let i=0;i<2;i++){
    const price = randInt(2,8), qty = y==="Y4"? randInt(3,8) : randInt(5,12), extra = randInt(1,4);
    const ans = price*qty + extra;
    const choices = shuffle([ans, ans+2, Math.max(1,ans-2), ans+5]).map(String);
    out.push({id:`m-word-${Date.now()}-${i}`,subject:"maths",stem:`Stickers cost £${price} each. Tom buys ${qty} stickers and a £${extra} notebook. How much in total?`,choices,answerIndex:choices.indexOf(String(ans)),explanation:`Total = ${price}×${qty} + ${extra} = £${ans}.`,tags:[yearTag(y),"topic:word","skill:two-step",`difficulty:${y==="DASH"?"hard":"medium"}`]});
  }

  // Data (read simple value)
  for(let i=0;i<1;i++){
    const apples = randInt(6,12), bananas = randInt(3,10), pears = randInt(2,8);
    const data = {apples,bananas,pears};
    const maxKey = Object.entries(data).sort((a,b)=>b[1]-a[1])[0][0];
    const choices = shuffle(["apples","bananas","pears"]);
    out.push({id:`m-data-${Date.now()}-${i}`,subject:"maths",stem:`A tally shows: apples=${apples}, bananas=${bananas}, pears=${pears}. Which fruit had the highest count?`,choices,answerIndex:choices.indexOf(maxKey),explanation:`Compare counts; ${maxKey} is highest.`,tags:[yearTag(y),"topic:data","skill:read-data",`difficulty:${y==="DASH"?"medium":"easy"}`]});
  }

  return out;
}

/** ---- VR generators (sequences, analogies, codes) ---- */
function genVR(settings: Settings){
  const out: Question[] = [];
  const y = settings.grade;

  // sequences
  for(let i=0;i<VR_QUOTA.sequences;i++){
    const start = 65 + randInt(0,18);
    const step = settings.allowHarder ? [1,2,3][randInt(0,2)] : 1;
    const a = String.fromCharCode(start);
    const b = String.fromCharCode(start+step);
    const c = String.fromCharCode(start+step*2);
    const d = String.fromCharCode(start+step*3);
    const next = String.fromCharCode(start+step*4);
    const choices = shuffle([next,String.fromCharCode(next.charCodeAt(0)+1),String.fromCharCode(next.charCodeAt(0)-1),a]);
    out.push({id:`vr-seq-${Date.now()}-${i}`,subject:"vr",stem:`Find the next pair: ${a}${b}, ${b}${c}, ${c}${d}, ${d}${next[0]}, __`,choices,answerIndex:choices.indexOf(next),explanation:`Step is +${step} through the alphabet.`,tags:[yearTag(y),"topic:sequences","skill:alpha-step",`difficulty:${y==="DASH"?"hard":"medium"}`]});
  }

  // analogies
  const analogies = [
    {stem:"PUPIL is to SCHOOL as PATIENT is to ____", correct:"HOSPITAL", wrongs:["BED","WARD","NURSE"]},
    {stem:"BEE is to HIVE as BIRD is to ____", correct:"NEST", wrongs:["BARK","FLOCK","EGG"]},
    {stem:"AUTHOR is to BOOK as PAINTER is to ____", correct:"CANVAS", wrongs:["INK","BRUSH","GALLERY"]},
  ] as const;
  for(let i=0;i<VR_QUOTA.analogies;i++){
    const it = analogies[randInt(0,analogies.length-1)];
    const choices = shuffle([it.correct, ...it.wrongs]);
    out.push({id:`vr-ana-${Date.now()}-${i}`,subject:"vr",stem:it.stem,choices,answerIndex:choices.indexOf(it.correct),explanation:`Map the relationship across.`,tags:[yearTag(y),"topic:analogies","skill:semantic",`difficulty:${y==="DASH"?"medium":"easy"}`]});
  }

  // codes (A=1 etc.)
  for(let i=0;i<VR_QUOTA.codes;i++){
    const word = ["BAD","ACE","BEG","FED","CAB"][randInt(0,4)];
    const encode = (s:string)=> s.split("").map(ch=> (ch.charCodeAt(0)-64)).join("-");
    const correct = encode(word);
    const choices = shuffle([correct, encode("CAB"), "2-2-2", "1-1-1"]);
    out.push({id:`vr-code-${Date.now()}-${i}`,subject:"vr",stem:`Code the word ${word} where A=1, B=2...`,choices,answerIndex:choices.indexOf(correct),explanation:`Convert letters to positions in alphabet.`,tags:[yearTag(y),"topic:codes","skill:alpha-numeric",`difficulty:${y==="DASH"?"hard":"medium"}`]});
  }

  return out;
}

/** ---- NVR generators (odd, rotation, reflection, matrix-lite) ---- */
function genNVR(settings: Settings){
  const out: Question[] = [];
  const y = settings.grade;

  // odd-one-out by fill
  for(let i=0;i<NVR_QUOTA.odd;i++){
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
    out.push({id:`nvr-odd-${Date.now()}-${i}`,subject:"nvr",stem:"Which is the odd one out?",choices:["A","B","C","D"],answerIndex:answer,explanation:`Three share fill=${commonFill}; one is ${oddFill}.`,svgChoiceSets:shuffled,tags:[yearTag(y),"topic:odd","skill:fill",`difficulty:${y==="DASH"?"medium":"easy"}`]});
  }

  // rotation odd-one-out
  for(let i=0;i<NVR_QUOTA.rotation;i++){
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
    out.push({id:`nvr-rot-${Date.now()}-${i}`,subject:"nvr",stem:"Which figure has a different rotation?",choices:["A","B","C","D"],answerIndex:answer,explanation:"One tile does not follow the 90° step.",svgChoiceSets:shuffled,tags:[yearTag(y),"topic:rotation","skill:angle",`difficulty:${y==="DASH"?"hard":"medium"}`]});
  }

  // reflection (simple): three mirrored one not
  for(let i=0;i<NVR_QUOTA.reflection;i++){
    const mirror = Math.random()<0.5 ? "vertical":"horizontal";
    const makeTri = (rot:number,flip=false): SvgAtom => ({shape:"triangle",fill:"black",size:56,x:50 + (flip?5:-5),y:50,rotation:rot});
    const opts: SvgAtom[][] = [
      [makeTri(0,false)], [makeTri(0,true)], [makeTri(0,true)], [makeTri(0,true)]
    ];
    const order = shuffle([0,1,2,3]);
    const answer = order.indexOf(0);
    const shuffled = order.map(idx=>opts[idx]);
    out.push({id:`nvr-refl-${Date.now()}-${i}`,subject:"nvr",stem:`Which shape is not a ${mirror} reflection of the others?`,choices:["A","B","C","D"],answerIndex:answer,explanation:"One triangle is not mirrored like the others.",svgChoiceSets:shuffled,tags:[yearTag(y),"topic:reflection","skill:symmetry",`difficulty:${y==="DASH"?"hard":"medium"}`]});
  }

  // matrix-lite (pattern change): three same, one wrong
  for(let i=0;i<NVR_QUOTA.matrix;i++){
    const sizes=[40,48,56,64]; const idxWrong = randInt(0,3);
    const opts = sizes.map((sz,idx)=>([{shape:"circle",fill: idx===idxWrong?"white":"black",size:sz,x:50,y:50}]));
    const order = shuffle([0,1,2,3]);
    const answer = order.indexOf(idxWrong);
    const shuffled = order.map(i2=>opts[i2]);
    out.push({id:`nvr-matrix-${Date.now()}-${i}`,subject:"nvr",stem:"Which option breaks the pattern?",choices:["A","B","C","D"],answerIndex:answer,explanation:"Three share fill & size pattern; one differs.",svgChoiceSets:shuffled,tags:[yearTag(y),"topic:matrix","skill:pattern",`difficulty:${y==="DASH"?"hard":"medium"}`]});
  }

  return out;
}

/** ========= Data loading ========= */
async function loadCurated(subj: Exclude<Subject,"comprehension"|"writing">, settings: Settings): Promise<Question[]>{
  const map: Record<Exclude<Subject,"comprehension"|"writing">, string> = { maths:"math", english:"english", vr:"vr", nvr:"nvr" };
  try{
    const res = await fetch(`/questions/${map[subj]}.json`, { cache:"no-store" });
    const arr = await res.json() as unknown;
    if(Array.isArray(arr)) {
      const ytag = yearTag(settings.grade);
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
          const yearOk = !q.tags?.length || q.tags.includes(ytag);
          const boardOk = !q.exam_board?.length || q.exam_board.some(b=> settings.boards.includes(b));
          const diffOk = settings.allowHarder ? true : !(q.tags||[]).includes("difficulty:hard");
          return yearOk && boardOk && diffOk;
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

/** ========= Pool building with quotas & recent buffer ========= */
function tagValue(tags: string[]|undefined, prefix:string): string|undefined{
  if(!tags) return undefined;
  const t = tags.find(t=>t.startsWith(prefix));
  return t ? t.slice(prefix.length) : undefined;
}
function partitionByTopic(qs: Question[], subject: Exclude<Subject,"comprehension"|"writing">){
  const groups: Record<string, Question[]> = {};
  qs.forEach(q=>{
    const topic = tagValue(q.tags,"topic:") || "misc";
    if(!groups[topic]) groups[topic]=[];
    groups[topic].push(q);
  });
  return groups;
}
function takeFrom(group: Question[]|undefined, n:number): Question[]{
  if(!group || group.length===0 || n<=0) return [];
  return shuffle(group).slice(0,n);
}
function buildWithQuota(subject: Exclude<Subject,"comprehension"|"writing">, curated: Question[], generated: Question[], settings: Settings): Question[]{
  const ytag = yearTag(settings.grade);
  const filtered = uniqueByIdThenStem(filterNotRecent(
    [...curated, ...generated].filter(q=>{
      const yearOk = !q.tags?.length || q.tags.includes(ytag);
      const boardOk = !q.exam_board?.length || q.exam_board.some(b=> settings.boards.includes(b));
      const diff = tagValue(q.tags,"difficulty:") || "medium";
      const diffOk = settings.allowHarder ? true : diff!=="hard";
      return yearOk && boardOk && diffOk;
    })
  ));

  const byTopic = partitionByTopic(filtered, subject);
  const selections: Question[] = [];

  if(subject==="maths"){
    selections.push(
      ...takeFrom(byTopic["arithmetic"], MATHS_QUOTA.arithmetic),
      ...takeFrom(byTopic["fracpct"], MATHS_QUOTA.fracpct),
      ...takeFrom(byTopic["geometry"], MATHS_QUOTA.geometry),
      ...takeFrom(byTopic["word"], MATHS_QUOTA.word),
      ...takeFrom(byTopic["data"], MATHS_QUOTA.data),
    );
  } else if(subject==="english"){
    selections.push(
      ...takeFrom(byTopic["vocab"], ENGLISH_QUOTA.vocab),
      ...takeFrom(byTopic["grammar"], ENGLISH_QUOTA.grammar),
      ...takeFrom(byTopic["cloze"], ENGLISH_QUOTA.cloze),
      ...takeFrom(byTopic["improve"], ENGLISH_QUOTA.improve),
    );
  } else if(subject==="vr"){
    selections.push(
      ...takeFrom(byTopic["sequences"], VR_QUOTA.sequences),
      ...takeFrom(byTopic["analogies"], VR_QUOTA.analogies),
      ...takeFrom(byTopic["codes"], VR_QUOTA.codes),
    );
  } else if(subject==="nvr"){
    // prefer items with svgChoiceSets
    const svgFirst = filtered.filter(q=>Array.isArray(q.svgChoiceSets)&&q.svgChoiceSets.length===4);
    const svgByTopic = partitionByTopic(svgFirst, subject);
    selections.push(
      ...takeFrom(svgByTopic["odd"]?.length? svgByTopic["odd"]:byTopic["odd"], NVR_QUOTA.odd),
      ...takeFrom(svgByTopic["rotation"]?.length? svgByTopic["rotation"]:byTopic["rotation"], NVR_QUOTA.rotation),
      ...takeFrom(svgByTopic["reflection"]?.length? svgByTopic["reflection"]:byTopic["reflection"], NVR_QUOTA.reflection),
      ...takeFrom(svgByTopic["matrix"]?.length? svgByTopic["matrix"]:byTopic["matrix"], NVR_QUOTA.matrix),
    );
  }

  // top up if short
  const need = TARGET_COUNTS[subject] - selections.length;
  if(need>0){
    const rest = filtered.filter(q=>!selections.find(s=>s.id===q.id));
    selections.push(...rest.slice(0,need));
  }

  const final = uniqueByIdThenStem(selections).slice(0, TARGET_COUNTS[subject]);
  pushRecentIds(final.map(q=>q.id));
  return final;
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
  const [paused,setPaused]=useState(false);

  useEffect(()=>{ setDailyUsed(getUsedSecondsToday()); setSettings(loadSettings()); },[]);

  // Quiz timer
  useEffect(()=>{
    if(mode!=="quiz" || paused) return;
    if(secondsLeft<=0){ setMode("results"); addUsedSecondsToday(QUIZ_SECONDS); setDailyUsed(getUsedSecondsToday()); return; }
    const t=setTimeout(()=>setSecondsLeft(s=>s-1),1000); return ()=>clearTimeout(t);
  },[mode,paused,secondsLeft]);

  // Writing timer
  useEffect(()=>{
    if(mode!=="writing" || paused) return;
    if(writingTime<=0){ setMode("writingResults"); return; }
    const t=setTimeout(()=>setWritingTime(s=>s-1),1000); return ()=>clearTimeout(t);
  },[mode,paused,writingTime]);

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
      tags:[yearTag(settings.grade),"topic:comprehension"]
    }));
    setSubject("comprehension");
    setQuestions(qs);
    setIndex(0);
    setAnswers([]);
    setSecondsLeft(Math.min(QUIZ_SECONDS, remainingToday));
    setPaused(false);
    setMode("quiz");
  }

  async function startQuiz(subj: Subject){
    if(!canStart) return;
    if(subj==="comprehension"){ await startComprehension(); return; }
    if(subj==="writing"){
      setSubject("writing"); setWriting(""); setWritingTime(Math.min(WRITING_SECONDS, remainingToday)); setPaused(false); setMode("writing"); return;
    }

    const curated = await loadCurated(subj, settings);
    const generated =
      subj==="english" ? genEnglish(settings) :
      subj==="maths"   ? genMaths(settings)   :
      subj==="vr"      ? genVR(settings)      :
      genNVR(settings);

    const selected = buildWithQuota(subj, curated, generated, settings);

    setSubject(subj);
    setQuestions(selected);
    setIndex(0);
    setAnswers([]);
    setSecondsLeft(Math.min(QUIZ_SECONDS, remainingToday));
    setPaused(false);
    setMode("quiz");
  }

  /** ===== Answer & score ===== */
  function answer(i:number){
    setAnswers(prev=>[...prev,i]);
    if(index+1<questions.length) setIndex(x=>x+1); else setMode("results");
  }
  const correctCount = useMemo(()=>questions.reduce((acc, q, i)=> acc + (answers[i]===q.answerIndex ? 1 : 0), 0),[questions,answers]);

  /** ===== Header Right ===== */
  const headerRight = (
    <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <Pill>Daily: {Math.floor(dailyUsed/60)}m/{Math.floor(DAILY_CAP_SECONDS/60)}m</Pill>
      {mode==="quiz" && <Pill>Time: {Math.floor(secondsLeft/60)}:{String(secondsLeft%60).padStart(2,"0")}</Pill>}
      {mode==="writing" && <Pill>Time: {Math.floor(writingTime/60)}:{String(writingTime%60).padStart(2,"0")}</Pill>}
    </div>
  );

  const current = questions[index];

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(180deg,#c8e6c9,#a5d6a7)",color:"#20351f"}}>
      <Banner right={headerRight} />
      <div style={{maxWidth:980,margin:"0 auto",padding:"16px",display:"grid",gap:16}}>
        {mode==="menu" && (
          <>
            <ProfileBar settings={settings} onChange={setSettings} />
            <Card>
              <div style={{display:"grid",gap:12}}>
                {!canStart && (
                  <div style={{padding:12,borderRadius:10,background:"#ffe8d2",border:"2px solid #cc8a4a"}}>
                    <div style={{fontWeight:700}}>Daily time done — amazing work!</div>
                    <div>You&apos;ve reached 30 minutes today. Come back tomorrow for more quests. 💚</div>
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
                  Counts — Maths {TARGET_COUNTS.maths} • English {TARGET_COUNTS.english} • VR {TARGET_COUNTS.vr} • NVR {TARGET_COUNTS.nvr} • Comprehension up to {COMP_QUESTION_COUNT}
                </div>
                <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                  <BlockButton onClick={()=>setMode("practice")} style={{background:"#9cd67c"}}>Practice Hub</BlockButton>
                </div>
              </div>
            </Card>
          </>
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
                <div style={{display:"flex",gap:8}}>
                  <BlockButton onClick={()=>setPaused(p=>!p)} style={{background:"#e6e06b"}}>{paused?"Resume":"Pause"}</BlockButton>
                  <BlockButton onClick={()=>setMode("results")} style={{background:"#f3a09a"}}>End quiz</BlockButton>
                </div>
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
                <div style={{display:"flex",gap:8}}>
                  <BlockButton onClick={()=>setPaused(p=>!p)} style={{background:"#e6e06b"}}>{paused?"Resume":"Pause"}</BlockButton>
                  <BlockButton onClick={()=>setMode("writingResults")} style={{background:"#9ad27a"}}>Finish</BlockButton>
                </div>
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
          © 2025 • {APP_NAME} • Minecraft-inspired UI (non-affiliated). Open JSON banks under /public/questions.
        </footer>
      </div>
    </div>
  );
}
