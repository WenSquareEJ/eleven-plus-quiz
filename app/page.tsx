// app/page.tsx — Full (Minecraft style) with Expansion Pack + generators
"use client";
import { useEffect, useMemo, useState } from "react";

type Subject = "maths" | "english" | "vr" | "nvr" | "comprehension" | "writing";
type Mode = "menu" | "quiz" | "results" | "writing" | "writingResults";

type Question = {
  id: string;
  subject: Exclude<Subject, "writing">;
  stem: string;
  choices: string[];
  answerIndex: number;
  explanation?: string;
  difficulty?: "easy" | "medium" | "hard";
  tags?: string[];
  svgOptions?: any[]; // for NVR SVG buttons
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

type WritingPrompt = { id: string; text: string };

const QUIZ_SECONDS = 10 * 60;
const DAILY_CAP_SECONDS = 30 * 60;
const WRITING_SECONDS = 30 * 60;
const COMP_QUESTION_COUNT = 5;

function todayKey(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function getUsedSecondsToday(){ if(typeof window==="undefined") return 0; return parseInt(localStorage.getItem(`quizTime_${todayKey()}`)||"0")||0; }
function addUsedSecondsToday(n:number){ const k=`quizTime_${todayKey()}`; const cur=getUsedSecondsToday(); localStorage.setItem(k,String(cur+n)); }

function shuffle<T>(arr: T[]) { const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a;}
function uniqueBy<T>(arr:T[], key:(t:T)=>string){ const s=new Set<string>(); const out:T[]=[]; for(const it of arr){ const k=key(it).toLowerCase().trim(); if(!s.has(k)){ s.add(k); out.push(it);} } return out;}
function randInt(min:number,max:number){ return Math.floor(Math.random()*(max-min+1))+min; }
function pick<T>(a: T[]){ return a[Math.floor(Math.random()*a.length)]; }

// --- Basic Minecraft UI helpers ---
const Card: React.FC<{children:any, className?:string}> = ({children}) => (
  <div style={{borderRadius:16,border:"4px solid #3b3b3b",boxShadow:"0 8px 24px rgba(0,0,0,0.1)",padding:16,background:"linear-gradient(135deg,#e8f7e8,#d4eed4)"}}>{children}</div>
);
const BlockButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({children,...props}) => (
  <button {...props} style={{padding:"12px 16px",borderRadius:12,border:"4px solid #2f4f2f",boxShadow:"0 2px 0 rgba(0,0,0,0.15)",background:"#7cc76b",fontWeight:700,letterSpacing:0.2,cursor:"pointer"}}>{children}</button>
);
const Pill: React.FC<{children:any}> = ({children}) => (
  <span style={{display:"inline-block",padding:"6px 12px",borderRadius:999,background:"#cfe9c9",border:"1px solid #5a8151",fontSize:12}}>{children}</span>
);

// --- English generators (extra variety) ---
function genEnglishAntonyms(n=3): Question[]{
  const items=[["scarce","plentiful"],["visible","hidden"],["brave","cowardly"],["polite","rude"]];
  const qs:Question[]=[];
  for(let i=0;i<n;i++){
    const [w,ant]=pick(items as any);
    const wrongs=["rare","tiny","quiet","careful","empty","gentle"];
    const choices = shuffle([ant,...shuffle(wrongs).slice(0,3)]);
    qs.push({id:`eng-ant-${i}-${w}`,subject:"english",stem:`Select the best antonym for ${w}:`,choices,answerIndex:choices.indexOf(ant),difficulty:"medium"});
  }
  return qs;
}
function genEnglishVocabCtx(n=3): Question[]{
  const items=[
    {sent:"The room was in a *chaotic* state after the party.", correct:"disordered", wrongs:["silent","gleaming","fragile"]},
    {sent:"She gave a *reluctant* smile.", correct:"unwilling", wrongs:["excited","careless","angry"]},
    {sent:"The old map was *illegible*.", correct:"hard to read", wrongs:["easy to fold","ancient","fake"]},
  ];
  const out:Question[]=[];
  for(let i=0;i<n;i++){ const it=pick(items as any); const choices=shuffle([it.correct,...it.wrongs]); out.push({id:`eng-vctx-${i}`,subject:"english",stem:it.sent+" — The underlined word most nearly means:",choices,answerIndex:choices.indexOf(it.correct),difficulty:"medium"}); }
  return out;
}
function genEnglishPunct(n=2): Question[]{
  const items=[
    {q:"Choose the correctly punctuated sentence:", correct:"The fox, swift and silent, darted away.", wrongs:["The fox swift and silent darted away.","The fox, swift and silent darted away.","The fox swift, and silent, darted away."]},
    {q:"Which sentence uses an apostrophe correctly?", correct:"It’s nearly time for lunch.", wrongs:["Its nearly time for lunch.","Its’ nearly time for lunch.","It nearly’s time for lunch."]},
  ];
  const out:Question[]=[];
  for(let i=0;i<n;i++){ const it=pick(items as any); const choices=shuffle([it.correct,...it.wrongs]); out.push({id:`eng-punct-${i}`,subject:"english",stem:it.q,choices,answerIndex:choices.indexOf(it.correct),difficulty:"hard"}); }
  return out;
}
function genEnglishCloze(n=2): Question[]{
  const items=[
    {stem:"They decided to ____ the hill before dusk.", correct:"climb", wrongs:["climbs","climbed","climbing"]},
    {stem:"I ____ my packed lunch today.", correct:"forgot", wrongs:["forget","forgets","forgetting"]},
  ];
  const out:Question[]=[];
  for(let i=0;i<n;i++){ const it=pick(items as any); const choices=shuffle([it.correct,...it.wrongs]); out.push({id:`eng-clz-${i}`,subject:"english",stem:it.stem,choices,answerIndex:choices.indexOf(it.correct),difficulty:"easy"}); }
  return out;
}
function buildEnglishBank(): Question[]{
  return [...genEnglishAntonyms(3), ...genEnglishVocabCtx(3), ...genEnglishPunct(2), ...genEnglishCloze(2)];
}

// --- Maths generators (extra) ---
function genMathFractions(n=4): Question[]{
  const out:Question[]=[];
  for(let i=0;i<n;i++){
    const d = pick([4,5,8,10]);
    const num = pick([1,2,3]);
    const whole = randInt(12,60);
    const ans = (num/d)*whole;
    const correct = Math.round(ans*100)/100;
    const choices = shuffle([correct, correct+randInt(1,3), Math.max(1,correct-randInt(1,3)), correct+randInt(4,6)]).map(x=>String(x));
    out.push({id:`m-frac-${i}-${num}-${d}-${whole}`,subject:"maths",stem:`What is ${num}/${d} of ${whole}?`,choices,answerIndex:choices.indexOf(String(correct)),difficulty:"medium",explanation:`${num}/${d} × ${whole} = ${correct}.`});
  }
  return out;
}
function genMathPercent(n=3): Question[]{
  const out:Question[]=[];
  for(let i=0;i<n;i++){
    const base = randInt(40,200);
    const pct = pick([10,12,20,25]);
    const inc = Math.random()<0.5;
    const ans = Math.round((inc? base*(1+pct/100) : base*(1-pct/100))*100)/100;
    const choices = shuffle([ans, ans+randInt(1,5), Math.max(1,ans-randInt(1,5)), ans+randInt(6,10)]).map(String);
    out.push({id:`m-pct-${i}-${base}-${pct}-${inc?'inc':'dec'}`,subject:"maths",stem:`${inc?"Increase":"Reduce"} £${base} by ${pct}%`,choices,answerIndex:choices.indexOf(String(ans)),difficulty:"medium",explanation:`£${base} × ${inc?"(1 + ":"(1 - "}${pct}/100) = ${ans}.`});
  }
  return out;
}
function genMathWord(n=3): Question[]{
  const out:Question[]=[];
  for(let i=0;i<n;i++){
    const price = randInt(2,9);
    const qty = randInt(3,12);
    const ans = price*qty;
    const choices = shuffle([ans, ans+randInt(1,4), Math.max(1,ans-randInt(1,4)), ans+randInt(5,9)]).map(String);
    out.push({id:`m-word-${i}`,subject:"maths",stem:`Stickers cost £${price} each. How much for ${qty} stickers?`,choices,answerIndex:choices.indexOf(String(ans)),difficulty:"easy",explanation:`£${price} × ${qty} = £${ans}.`});
  }
  return out;
}
function buildMathBank(): Question[]{ return [...genMathFractions(4), ...genMathPercent(3), ...genMathWord(3)]; }

// --- VR simple generators ---
function genVRSeries(n=3): Question[]{
  const out:Question[]=[];
  for(let i=0;i<n;i++){
    const start = 65 + randInt(0,18);
    const step = pick([1,2,3]);
    const a = String.fromCharCode(start);
    const b = String.fromCharCode(start+step);
    const c = String.fromCharCode(start+step*2);
    const d = String.fromCharCode(start+step*3);
    const next = String.fromCharCode(start+step*4);
    const choices = shuffle([next,String.fromCharCode(next.charCodeAt(0)+1),String.fromCharCode(next.charCodeAt(0)-1),a]);
    out.push({id:`vr-ser-${i}`,subject:"vr",stem:`Find the next pair: ${a}${b}, ${b}${c}, ${c}${d}, ${d}${next[0]}, __`,choices,answerIndex:choices.indexOf(next),difficulty:"medium"});
  }
  return out;
}
function genVRAnalogies(n=2): Question[]{ 
  const items=[
    {stem:"PUPIL is to SCHOOL as PATIENT is to ____", correct:"HOSPITAL", wrongs:["BED","WARD","NURSE"]},
    {stem:"BEE is to HIVE as BIRD is to ____", correct:"NEST", wrongs:["BARK","FLOCK","EGG"]},
  ];
  const out:Question[]=[]; 
  for(let i=0;i<n;i++){ const it=pick(items as any); const choices=shuffle([it.correct,...it.wrongs]); out.push({id:`vr-ana-${i}`,subject:"vr",stem:it.stem,choices,answerIndex:choices.indexOf(it.correct),difficulty:"easy"}); }
  return out;
}
function buildVRBank(): Question[]{ return [...genVRSeries(3), ...genVRAnalogies(2)]; }

// --- NVR placeholder (SVG handled elsewhere in your previous version). Keep curated JSON preferred. ---

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

  useEffect(()=>{ setDailyUsed(getUsedSecondsToday()); },[]);

  useEffect(()=>{
    if(mode!=="quiz") return;
    if(secondsLeft<=0){ setMode("results"); addUsedSecondsToday(QUIZ_SECONDS); return; }
    const t=setTimeout(()=>setSecondsLeft(s=>s-1),1000); return ()=>clearTimeout(t);
  },[mode,secondsLeft]);

  useEffect(()=>{
    if(mode!=="writing") return;
    if(writingTime<=0){ setMode("writingResults"); return; }
    const t=setTimeout(()=>setWritingTime(s=>s-1),1000); return ()=>clearTimeout(t);
  },[mode,writingTime]);

  const canStart = dailyUsed < DAILY_CAP_SECONDS;
  const remainingToday = Math.max(0, DAILY_CAP_SECONDS - dailyUsed);

  async function startComprehension(){
    if(!canStart) return;
    try{
      const res = await fetch("/questions/comprehension.json");
      const bank: Passage[] = await res.json();
      if(!Array.isArray(bank) || bank.length===0) return;
      const chosen = bank[Math.floor(Math.random()*bank.length)];
      setPassage(chosen);
      const qs = chosen.questions.slice(0,COMP_QUESTION_COUNT).map((q,i)=>({ id:`${chosen.id}-${i}`, subject:"comprehension", stem:q.stem, choices:q.choices, answerIndex:q.answerIndex, explanation:q.explanation }));
      setSubject("comprehension");
      setQuestions(qs);
      setIndex(0);
      setAnswers([]);
      setSecondsLeft(Math.min(QUIZ_SECONDS, remainingToday));
      setMode("quiz");
    }catch(e){ console.error(e); }
  }

  async function loadCurated(subj: Exclude<Subject,"comprehension"|"writing">): Promise<Question[]>{
    try{
      const res = await fetch(`/questions/${subj==="maths"?"math":"english"===subj?"english":subj}.json`);
      const arr: Question[] = await res.json();
      return Array.isArray(arr)?arr:[];
    }catch{ return []; }
  }

  function buildGenerated(subj: Exclude<Subject,"comprehension"|"writing">): Question[]{
    if(subj==="english") return buildEnglishBank();
    if(subj==="maths") return buildMathBank();
    if(subj==="vr") return buildVRBank();
    return []; // prefer curated for NVR
  }

  async function startQuiz(subj: Subject){
    if(!canStart) return;
    if(subj==="comprehension"){ startComprehension(); return; }
    if(subj==="writing"){
      setSubject("writing"); setWriting(""); setWritingTime(Math.min(WRITING_SECONDS, remainingToday)); setMode("writing"); return;
    }
    const curated = await loadCurated(subj);
    const generated = buildGenerated(subj);
    const pool = uniqueBy(shuffle([...curated, ...generated]), q=>q.stem);
    const need = subj==="nvr"?8: subj==="vr"?10:12;
    const set = pool.slice(0, need);
    setSubject(subj);
    setQuestions(set);
    setIndex(0);
    setAnswers([]);
    setSecondsLeft(Math.min(QUIZ_SECONDS, remainingToday));
    setMode("quiz");
  }

  function answer(i:number){
    setAnswers(prev=>[...prev,i]);
    if(index+1<questions.length) setIndex(x=>x+1); else setMode("results");
  }

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(180deg,#c8e6c9,#a5d6a7)",color:"#20351f",padding:24}}>
      <div style={{maxWidth:980,margin:"0 auto",display:"grid",gap:16}}>
        <h1 style={{fontSize:28,fontWeight:800,textShadow:"2px 2px #8fbf7a"}}>11+ Adventure</h1>
        <div style={{opacity:0.8,fontSize:14}}>Minecraft-inspired • Kent/Bexley • 10-min tests • 30-min daily cap • Writing (typed)</div>

        {mode==="menu" && (
          <Card>
            <div style={{display:"grid",gap:12}}>
              {!canStart && (
                <div style={{padding:12,borderRadius:10,background:"#ffe8d2",border:"2px solid #cc8a4a"}}>
                  <div style={{fontWeight:700}}>Daily time done — great effort!</div>
                  <div>Come back tomorrow.</div>
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
              <div style={{fontSize:12,opacity:0.75}}>
                Counts — Maths 12 • English 12 • VR 10 • NVR 8 • Comprehension up to 5
              </div>
            </div>
          </Card>
        )}

        {mode==="quiz" && (
          <Card>
            <div style={{display:"grid",gap:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <Pill>Q {index+1}/{questions.length}</Pill>
                  <Pill>Time {Math.floor(secondsLeft/60)}:{String(secondsLeft%60).padStart(2,"0")}</Pill>
                </div>
                <BlockButton onClick={()=>setMode("results")} style={{background:"#f3a09a"}}>End quiz</BlockButton>
              </div>

              {subject==="comprehension" && passage && (
                <div style={{padding:12,border:"2px dashed #5a8151",borderRadius:12,background:"#f7fff2"}}>
                  <div style={{fontWeight:800,marginBottom:6}}>{passage.title||"Passage"}</div>
                  <div style={{whiteSpace:"pre-wrap"}}>{passage.text}</div>
                </div>
              )}

              <div style={{fontSize:20,fontWeight:700}}>{questions[index]?.stem}</div>
              <div style={{display:"grid",gap:10}}>
                {questions[index]?.choices?.map((c, i)=>(
                  <BlockButton key={i} onClick={()=>answer(i)}>{c}</BlockButton>
                ))}
              </div>
            </div>
          </Card>
        )}

        {mode==="results" && (
          <Card>
            <div style={{display:"grid",gap:12}}>
              <div style={{fontSize:22,fontWeight:800}}>Results</div>
              {questions.map((q,i)=>(
                <div key={q.id} style={{border:"2px solid #6f9e63",borderRadius:10,padding:12,background:"#eef7ea"}}>
                  <div style={{fontWeight:700}}>Q{i+1}. {q.stem}</div>
                  <div>Correct: <strong>{q.choices[q.answerIndex]}</strong></div>
                </div>
              ))}
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
              <textarea spellCheck={false} autoCorrect="off" autoCapitalize="off" value={writing} onChange={e=>setWriting(e.target.value)} rows={16} style={{width:"100%",padding:12,border:"3px solid #2f4f2f",borderRadius:12,background:"#fffef9",fontSize:16,lineHeight:1.5}}/>
            </div>
          </Card>
        )}

        {mode==="writingResults" && (
          <Card>
            <div style={{display:"grid",gap:12}}>
              <div style={{fontSize:22,fontWeight:800}}>Your writing</div>
              <div style={{whiteSpace:"pre-wrap",border:"2px solid #6f9e63",borderRadius:10,padding:12,background:"#eef7ea"}}>{writing}</div>
              <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                <BlockButton onClick={()=>setMode("menu")}>Back to Menu</BlockButton>
                <BlockButton onClick={()=>startQuiz("writing")}>Try another prompt</BlockButton>
              </div>
            </div>
          </Card>
        )}

        <footer style={{fontSize:12,opacity:0.7,textAlign:"center",paddingTop:24}}>© 2025 • 11+ Adventure • Minecraft-inspired UI (non-affiliated).</footer>
      </div>
    </div>
  );
}
