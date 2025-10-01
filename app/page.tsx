// app/page.tsx — 11+ Adventure (lint-clean v2)
"use client";

import { useEffect, useState } from "react";

/** Types */
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
};

/** Config */
const QUIZ_SECONDS = 10 * 60;
const DAILY_CAP_SECONDS = 30 * 60;
const WRITING_SECONDS = 30 * 60;
const COMP_QUESTION_COUNT = 5;

/** Time helpers */
function todayKey(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function getUsedSecondsToday(){ if(typeof window==="undefined") return 0; return parseInt(localStorage.getItem(`quizTime_${todayKey()}`)||"0")||0; }
function addUsedSecondsToday(n:number){ const k=`quizTime_${todayKey()}`; const cur=getUsedSecondsToday(); localStorage.setItem(k,String(cur+n)); }

/** Utils */
function shuffle<T>(arr: readonly T[]) { const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a;}
function uniqueBy<T>(arr: readonly T[], key:(t:T)=>string){ const s=new Set<string>(); const out:T[]=[]; for(const it of arr){ const k=key(it).toLowerCase().trim(); if(!s.has(k)){ s.add(k); out.push(it);} } return out;}

/** UI */
const Card: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div style={{borderRadius:16,border:"4px solid #3b3b3b",boxShadow:"0 8px 24px rgba(0,0,0,0.1)",padding:16,background:"linear-gradient(135deg,#e8f7e8,#d4eed4)"}}>{children}</div>
);
const BlockButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({children,...props}) => (
  <button {...props} style={{padding:"12px 16px",borderRadius:12,border:"4px solid #2f4f2f",boxShadow:"0 2px 0 rgba(0,0,0,0.15)",background:"#7cc76b",fontWeight:700,letterSpacing:0.2,cursor:"pointer"}}>{children}</button>
);
const Pill: React.FC<{children: React.ReactNode}> = ({children}) => (
  <span style={{display:"inline-block",padding:"6px 12px",borderRadius:999,background:"#cfe9c9",border:"1px solid #5a8151",fontSize:12}}>{children}</span>
);

/** Generators — English (compact) */
function buildEnglishBank(): Question[]{
  const antonyms = [
    ["scarce","plentiful"],
    ["visible","hidden"],
    ["brave","cowardly"],
    ["polite","rude"],
  ] as const;
  const wrongPool = ["rare","tiny","quiet","careful","empty","gentle","many","loud","bold"];
  const q1 = Array.from({length:3}).map((_,i)=>{
    const [w,ant] = antonyms[Math.floor(Math.random()*antonyms.length)];
    const choices = shuffle([ant, ...shuffle(wrongPool).slice(0,3)]);
    return {id:`eng-ant-${i}-${w}`,subject:"english" as const,stem:`Select the best antonym for ${w}:`,choices,answerIndex:choices.indexOf(ant),difficulty:"medium" as const};
  });

  const vocabCtx = [
    {sent:"The room was in a *chaotic* state after the party.", correct:"disordered", wrongs:["silent","gleaming","fragile"]},
    {sent:"She gave a *reluctant* smile.", correct:"unwilling", wrongs:["excited","careless","angry"]},
    {sent:"The old map was *illegible*.", correct:"hard to read", wrongs:["easy to fold","ancient","fake"]},
  ] as const;
  const q2 = Array.from({length:3}).map((_,i)=>{
    const it = vocabCtx[Math.floor(Math.random()*vocabCtx.length)];
    const choices = shuffle([it.correct, ...it.wrongs]);
    return {id:`eng-vctx-${i}`,subject:"english" as const,stem:it.sent+" — The underlined word most nearly means:",choices,answerIndex:choices.indexOf(it.correct),difficulty:"medium" as const};
  });

  const punct = [
    {q:"Choose the correctly punctuated sentence:", correct:"The fox, swift and silent, darted away.", wrongs:["The fox swift and silent darted away.","The fox, swift and silent darted away.","The fox swift, and silent, darted away."]},
    {q:"Which sentence uses an apostrophe correctly?", correct:"It’s nearly time for lunch.", wrongs:["Its nearly time for lunch.","Its’ nearly time for lunch.","It nearly’s time for lunch."]},
  ] as const;
  const q3 = Array.from({length:2}).map((_,i)=>{
    const it = punct[Math.floor(Math.random()*punct.length)];
    const choices = shuffle([it.correct, ...it.wrongs]);
    return {id:`eng-punct-${i}`,subject:"english" as const,stem:it.q,choices,answerIndex:choices.indexOf(it.correct),difficulty:"hard" as const};
  });

  const cloze = [
    {stem:"They decided to ____ the hill before dusk.", correct:"climb", wrongs:["climbs","climbed","climbing"]},
    {stem:"I ____ my packed lunch today.", correct:"forgot", wrongs:["forget","forgets","forgetting"]},
  ] as const;
  const q4 = Array.from({length:2}).map((_,i)=>{
    const it = cloze[Math.floor(Math.random()*cloze.length)];
    const choices = shuffle([it.correct, ...it.wrongs]);
    return {id:`eng-clz-${i}`,subject:"english" as const,stem:it.stem,choices,answerIndex:choices.indexOf(it.correct),difficulty:"easy" as const};
  });

  return [...q1, ...q2, ...q3, ...q4];
}

/** Generators — Maths (compact) */
function buildMathBank(): Question[]{
  const out: Question[] = [];
  for(let i=0;i<4;i++){
    const d = [4,5,8,10][Math.floor(Math.random()*4)];
    const num = [1,2,3][Math.floor(Math.random()*3)];
    const whole = 12+Math.floor(Math.random()*49);
    const ans = Math.round(((num/d)*whole)*100)/100;
    const choices = shuffle([ans, ans+1, Math.max(1,ans-1), ans+2]).map(String);
    out.push({id:`m-frac-${i}-${num}-${d}-${whole}`,subject:"maths",stem:`What is ${num}/${d} of ${whole}?`,choices,answerIndex:choices.indexOf(String(ans)),difficulty:"medium"});
  }
  for(let i=0;i<3;i++){
    const base = 40+Math.floor(Math.random()*161);
    const pct = [10,12,20,25][Math.floor(Math.random()*4)];
    const inc = Math.random()<0.5;
    const ans = Math.round((inc? base*(1+pct/100): base*(1-pct/100))*100)/100;
    const choices = shuffle([ans, ans+1, Math.max(1,ans-1), ans+3]).map(String);
    out.push({id:`m-pct-${i}`,subject:"maths",stem:`${inc?"Increase":"Reduce"} £${base} by ${pct}%`,choices,answerIndex:choices.indexOf(String(ans)),difficulty:"medium"});
  }
  for(let i=0;i<3;i++){
    const price = 2+Math.floor(Math.random()*8);
    const qty = 3+Math.floor(Math.random()*10);
    const ans = price*qty;
    const choices = shuffle([ans, ans+2, Math.max(1,ans-2), ans+5]).map(String);
    out.push({id:`m-word-${i}`,subject:"maths",stem:`Stickers cost £${price} each. How much for ${qty} stickers?`,choices,answerIndex:choices.indexOf(String(ans)),difficulty:"easy"});
  }
  return out;
}

/** Generators — VR (compact) */
function buildVRBank(): Question[]{
  const out: Question[] = [];
  for(let i=0;i<3;i++){
    const start = 65 + Math.floor(Math.random()*19);
    const step = [1,2,3][Math.floor(Math.random()*3)];
    const a = String.fromCharCode(start);
    const b = String.fromCharCode(start+step);
    const c = String.fromCharCode(start+step*2);
    const d = String.fromCharCode(start+step*3);
    const next = String.fromCharCode(start+step*4);
    const choices = shuffle([next,String.fromCharCode(next.charCodeAt(0)+1),String.fromCharCode(next.charCodeAt(0)-1),a]);
    out.push({id:`vr-ser-${i}`,subject:"vr",stem:`Find the next pair: ${a}${b}, ${b}${c}, ${c}${d}, ${d}${next[0]}, __`,choices,answerIndex:choices.indexOf(next),difficulty:"medium"});
  }
  const analogies = [
    {stem:"PUPIL is to SCHOOL as PATIENT is to ____", correct:"HOSPITAL", wrongs:["BED","WARD","NURSE"]},
    {stem:"BEE is to HIVE as BIRD is to ____", correct:"NEST", wrongs:["BARK","FLOCK","EGG"]},
  ] as const;
  for(let i=0;i<2;i++){
    const it = analogies[Math.floor(Math.random()*analogies.length)];
    const choices = shuffle([it.correct, ...it.wrongs]);
    out.push({id:`vr-ana-${i}`,subject:"vr",stem:it.stem,choices,answerIndex:choices.indexOf(it.correct),difficulty:"easy"});
  }
  return out;
}

/** Data loading */
async function loadCurated(subj: Exclude<Subject,"comprehension"|"writing">): Promise<Question[]>{
  const map: Record<Exclude<Subject,"comprehension"|"writing">, string> = { maths:"math", english:"english", vr:"vr", nvr:"nvr" };
  try{
    const res = await fetch(`/questions/${map[subj]}.json`);
    const arr = await res.json() as unknown;
    if(Array.isArray(arr)) {
      const typed = (arr as RawQuestion[]).map((q)=> ({
        id: String(q.id),
        subject: subj,
        stem: String(q.stem),
        choices: q.choices,
        answerIndex: Number(q.answerIndex),
        explanation: q.explanation
      }));
      return typed;
    }
    return [];
  }catch{ return []; }
}
async function loadComprehension(): Promise<Passage[]>{ 
  try{ 
    const res = await fetch("/questions/comprehension.json"); 
    const arr = await res.json() as unknown; 
    return Array.isArray(arr)? arr as Passage[] : []; 
  }catch{ return []; } 
}

/** Page */
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
    const comp = await loadComprehension();
    if(!comp.length) return;
    const chosen = comp[Math.floor(Math.random()*comp.length)];
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

  function buildGenerated(subj: Exclude<Subject,"comprehension"|"writing">): Question[]{
    if(subj==="english") return buildEnglishBank();
    if(subj==="maths") return buildMathBank();
    if(subj==="vr") return buildVRBank();
    return []; // prefer curated for NVR
  }

  async function startQuiz(subj: Subject){
    if(!canStart) return;
    if(subj==="comprehension"){ await startComprehension(); return; }
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

  const correctCount = questions.reduce((acc, q, i)=> acc + (answers[i]===q.answerIndex ? 1 : 0), 0);

  /** Render */
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
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <Pill>Daily: {Math.floor(getUsedSecondsToday()/60)}m / {Math.floor(DAILY_CAP_SECONDS/60)}m</Pill>
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
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:72,height:72,borderRadius:"50%",background:"#9ad27a",border:"4px solid #2f4f2f",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:800}}>
                  {correctCount}/{questions.length}
                </div>
                <div>Score</div>
              </div>
              {questions.map((q,i)=>(
                <div key={q.id} style={{border:"2px solid #6f9e63",borderRadius:10,padding:12,background:"#eef7ea"}}>
                  <div style={{fontWeight:700}}>Q{i+1}. {q.stem}</div>
                  <div>Your answer: <strong>{typeof answers[i]==="number" ? q.choices[answers[i]] : "—"}</strong> • Correct: <strong>{q.choices[q.answerIndex]}</strong></div>
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
