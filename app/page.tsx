// app/page.tsx (client) — loads questions from /questions/*.json
"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type Subject = "maths" | "english" | "vr" | "nvr";
type Mode = "menu" | "quiz" | "results";

type Question = {
  id: string;
  subject: Subject;
  stem: string;
  choices: string[];
  answerIndex: number;
  explanation?: string;
};
type AnswerRec = { qid: string; choice: number; correct: boolean };

const QUESTION_COUNT: Record<Subject, number> = { maths: 12, english: 10, vr: 10, nvr: 8 };
const QUIZ_SECONDS = 10 * 60;
const DAILY_CAP_SECONDS = 30 * 60;

function todayKey() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function getUsedSecondsToday(): number {
  if (typeof window === "undefined") return 0;
  const v = localStorage.getItem(`quizTime_${todayKey()}`) ?? "0";
  return parseInt(v, 10) || 0;
}
function addUsedSecondsToday(delta: number) {
  const key = `quizTime_${todayKey()}`;
  const cur = getUsedSecondsToday();
  localStorage.setItem(key, String(cur + delta));
}

// utils
function shuffle<T>(arr: T[]) { const a = [...arr]; for (let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
function uniqueBy<T>(arr: T[], key: (x:T)=>string) { const seen=new Set<string>(); const out:T[]=[]; for(const it of arr){const k=key(it).trim().toLowerCase(); if(!seen.has(k)){seen.add(k); out.push(it);} } return out; }

// UI
function Card({ children }: { children: ReactNode }) {
  return <div style={{borderRadius:16,border:"4px solid #3b3b3b",boxShadow:"0 8px 24px rgba(0,0,0,0.1)",padding:16,background:"linear-gradient(135deg,#e8f7e8,#d4eed4)"}}>{children}</div>;
}
function BlockButton(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  const { children, style, ...rest } = props;
  return <button {...rest} style={{padding:"12px 16px",borderRadius:12,border:"4px solid #2f4f2f",boxShadow:"0 2px 0 rgba(0,0,0,0.15)",background:"#7cc76b",fontWeight:700,letterSpacing:0.2,cursor:"pointer",...(style||{})}}>{children}</button>;
}
function Pill({ children }: { children: ReactNode }) {
  return <span style={{display:"inline-block",padding:"6px 12px",borderRadius:999,background:"#cfe9c9",border:"1px solid #5a8151",fontSize:12}}>{children}</span>;
}

export default function Page() {
  const [mode, setMode] = useState<Mode>("menu");
  const [subject, setSubject] = useState<Subject | null>(null);
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(QUIZ_SECONDS);
  const [answers, setAnswers] = useState<AnswerRec[]>([]);
  const [dailyUsed, setDailyUsed] = useState(0);
  const [paused, setPaused] = useState(false);

  const [bank, setBank] = useState<Record<Subject, Question[]>>({ maths:[], english:[], vr:[], nvr:[] });
  const [questions, setQuestions] = useState<Question[]>([]);

  const lastIdsRef = useRef<Set<string>>(new Set());

  // Load JSON banks from /public/questions/*.json
  useEffect(() => {
    async function loadAll() {
      try {
        const [m,e,v,n] = await Promise.all([
          fetch("/questions/math.json").then(r=>r.json()),
          fetch("/questions/english.json").then(r=>r.json()),
          fetch("/questions/vr.json").then(r=>r.json()),
          fetch("/questions/nvr.json").then(r=>r.json()),
        ]);
        setBank({ maths:m, english:e, vr:v, nvr:n });
      } catch (err) {
        console.error("Failed to load banks", err);
      }
    }
    loadAll();
    setDailyUsed(getUsedSecondsToday());
  }, []);

  const endQuiz = useCallback(() => {
    const elapsed = Math.max(0, QUIZ_SECONDS - secondsLeft);
    addUsedSecondsToday(elapsed);
    setDailyUsed(getUsedSecondsToday());
    setMode("results");
  }, [secondsLeft]);

  useEffect(() => {
    if (mode !== "quiz" || paused) return;
    if (secondsLeft <= 0) { endQuiz(); return; }
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [mode, paused, secondsLeft, endQuiz]);

  const canStart = dailyUsed < DAILY_CAP_SECONDS;
  const remainingToday = Math.max(0, DAILY_CAP_SECONDS - dailyUsed);

  function buildQuizSet(subj: Subject, count: number): Question[] {
    const all = bank[subj] || [];
    // Prefer items not used in the last quiz, then de-duplicate by stem
    const pool = shuffle(all).sort((a,b)=> (lastIdsRef.current.has(a.id)?1:0) - (lastIdsRef.current.has(b.id)?1:0));
    let uniq = uniqueBy(pool, q=>q.stem).slice(0, count);
    // If not enough (rare), just take more unique stems
    if (uniq.length < count) {
      uniq = uniqueBy(all, q=>q.stem).slice(0, count);
    }
    return uniq;
  }

  function startQuiz(subj: Subject) {
    if (!canStart) return;
    const count = QUESTION_COUNT[subj];
    const set = buildQuizSet(subj, count);
    setSubject(subj);
    setQuestions(set);
    setIndex(0);
    setAnswers([]);
    setSecondsLeft(Math.min(QUIZ_SECONDS, remainingToday));
    setPaused(false);
    setMode("quiz");
  }

  function answer(choiceIndex: number) {
    const q = questions[index];
    if (!q) return;
    const correct = choiceIndex === q.answerIndex;
    setAnswers(prev => [...prev, { qid: q.id, choice: choiceIndex, correct }]);
    if (index + 1 < questions.length) setIndex(i => i + 1);
    else finishNow();
  }

  function finishNow() {
    lastIdsRef.current = new Set(questions.map(q=>q.id));
    endQuiz();
  }

  const current = questions[index] || null;
  const correctCount = answers.filter(a => a.correct).length;

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(180deg,#c8e6c9,#a5d6a7)",color:"#20351f",padding:24,boxSizing:"border-box"}}>
      <div style={{maxWidth:960,margin:"0 auto",display:"grid",gap:16}}>
        <h1 style={{fontSize:28,fontWeight:800,textShadow:"2px 2px #8fbf7a",marginBottom:8}}>11+ Adventure — Quiz</h1>
        <div style={{opacity:0.8,fontSize:14,marginBottom:8}}>Minecraft-inspired • Kent/Bexley • 10-min quizzes • 30-min daily cap</div>

        {mode==="menu" && (
          <Card>
            <div style={{display:"grid",gap:12}}>
              {!canStart && (
                <div style={{padding:12,borderRadius:10,background:"#ffe8d2",border:"2px solid #cc8a4a"}}>
                  <div style={{fontWeight:700}}>Daily time done — amazing work!</div>
                  <div>You&apos;ve reached 30 minutes today. Come back tomorrow. 💚</div>
                </div>
              )}

              <div style={{display:"flex",flexWrap:"wrap",gap:12}}>
                <BlockButton disabled={!canStart} onClick={()=>startQuiz("maths")}>Maths</BlockButton>
                <BlockButton disabled={!canStart} onClick={()=>startQuiz("english")}>English</BlockButton>
                <BlockButton disabled={!canStart} onClick={()=>startQuiz("vr")}>VR</BlockButton>
                <BlockButton disabled={!canStart} onClick={()=>startQuiz("nvr")}>NVR</BlockButton>
              </div>

              <div style={{fontSize:12,opacity:0.75}}>Question counts — Maths: {QUESTION_COUNT.maths} · English: {QUESTION_COUNT.english} · VR: {QUESTION_COUNT.vr} · NVR: {QUESTION_COUNT.nvr}</div>
            </div>
          </Card>
        )}

        {mode==="quiz" && current && (
          <Card>
            <div style={{display:"grid",gap:12}}>
              <div style={{display:"flex",gap:8,justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                  <Pill>Q {index + 1}/{questions.length}</Pill>
                  <Pill>Subject: {subject}</Pill>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                  <Pill>Time: {Math.floor(secondsLeft/60)}:{String(secondsLeft%60).padStart(2,"0")}</Pill>
                  <BlockButton onClick={()=>setPaused(p=>!p)} style={{background: paused ? "#d9c267" : "#9ad27a"}}>{paused ? "Resume" : "Pause"}</BlockButton>
                  <BlockButton onClick={()=>{ if (confirm("End this quiz now and see your score?")) finishNow(); }} style={{background:"#f3a09a"}}>End quiz</BlockButton>
                </div>
              </div>

              <div style={{fontSize:20,fontWeight:700}}>{current.stem}</div>
              <div style={{display:"grid",gap:10}}>
                {current.choices.map((c,i)=>(
                  <BlockButton key={i} onClick={()=>answer(i)}>{c}</BlockButton>
                ))}
              </div>
            </div>
          </Card>
        )}

        {mode==="results" && (
          <Card>
            <div style={{display:"grid",gap:16}}>
              <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                <div style={{width:80,height:80,borderRadius:"50%",background:"#9ad27a",border:"4px solid #2f4f2f",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:800}}>
                  {correctCount}/{questions.length}
                </div>
                <div>
                  <div style={{fontSize:22,fontWeight:800}}>Results</div>
                  <div style={{opacity:0.8,fontSize:13}}>Great effort! You scored {correctCount} out of {questions.length}.</div>
                </div>
              </div>

              <div style={{display:"grid",gap:8}}>
                {questions.map((q,i)=>{
                  const a = answers[i];
                  const verdict = a?.correct ? "✅ Correct" : "❌ Incorrect";
                  return (
                    <div key={q.id} style={{border:"2px solid #6f9e63",borderRadius:10,padding:12,background:"#eef7ea"}}>
                      <div style={{fontWeight:700}}>Q{i+1}. {q.stem}</div>
                      <div style={{fontSize:14}}>
                        Your answer: <strong>{typeof a?.choice==="number" ? q.choices[a.choice] : "—"}</strong> • Correct: <strong>{q.choices[q.answerIndex]}</strong> • {verdict}
                      </div>
                      {q.explanation && <div style={{fontSize:13,opacity:0.9,marginTop:4}}>Explanation: {q.explanation}</div>}
                    </div>
                  );
                })}
              </div>

              <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                <BlockButton onClick={()=>setMode("menu")}>Back to Menu</BlockButton>
                <BlockButton onClick={()=>subject && startQuiz(subject!)}>Try another {subject ?? ""}</BlockButton>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
