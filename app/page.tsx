// app/page.tsx
"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/** Subjects & Types **/
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

/** --- Configurable question counts (tweak these anytime) --- **/
const QUESTION_COUNT: Record<Subject, number> = {
  maths: 12,
  english: 10,
  vr: 10,
  nvr: 8,
};

/** Timers **/
const QUIZ_SECONDS = 10 * 60; // 10 minutes per quiz
const DAILY_CAP_SECONDS = 30 * 60; // 30 minutes/day across quizzes

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

/** Utils **/
function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function uniqueBy<T>(arr: T[], key: (x: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const k = key(item).trim().toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(item);
    }
  }
  return out;
}

/** Base bank (hand-written items) **/
const BASE_BANK: Question[] = [
  // Maths
  { id: "m-01", subject: "maths", stem: "What is 3/4 of 20?", choices: ["12", "13", "14", "15"], answerIndex: 3, explanation: "3/4 x 20 = 15." },
  { id: "m-02", subject: "maths", stem: "480 ÷ 6 = ?", choices: ["60", "70", "75", "80"], answerIndex: 3, explanation: "480/6 = 80." },
  // English
  { id: "e-01", subject: "english", stem: "Choose the best synonym for 'eager':", choices: ["reluctant", "keen", "tired", "worried"], answerIndex: 1, explanation: "'Keen' is closest in meaning to 'eager'." },
  { id: "e-02", subject: "english", stem: "Pick the correct spelling:", choices: ["begining", "beginning", "beggining", "begininng"], answerIndex: 1, explanation: "Double 'n' -> beginning." },
  // VR
  { id: "v-01", subject: "vr", stem: "Find the next pair: AB, BC, CD, DE, __", choices: ["EF", "FG", "AE", "DD"], answerIndex: 0, explanation: "Shift +1." },
  // NVR (descriptive)
  { id: "n-01", subject: "nvr", stem: "Which is the odd one out?", choices: ["▲ black triangle", "■ black square", "● black circle", "□ white square"], answerIndex: 3, explanation: "Only one is white." },
];

/** Generators **/
function genMaths(n: number): Question[] {
  const out: Question[] = [];
  for (let i = 0; i < n; i++) {
    const type = Math.random() < 0.5 ? "mult" : "frac";
    if (type === "mult") {
      const a = randInt(2, 12), b = randInt(2, 12), ans = a * b;
      const choices = shuffle([ans, ans + randInt(1, 4), Math.max(1, ans - randInt(1, 4)), ans + randInt(5, 9)]).map(String);
      out.push({
        id: `gm-${i}-${a}x${b}`,
        subject: "maths",
        stem: `What is ${a} x ${b}?`,
        choices,
        answerIndex: choices.indexOf(String(ans)),
        explanation: `${a} x ${b} = ${ans}.`,
      });
    } else {
      const denom = pick([4, 5, 8, 10]);
      const num = pick([1, 2, 3]);
      const whole = randInt(10, 60);
      const correct = (num / denom) * whole;
      const corr = String(correct % 1 === 0 ? correct : Math.round(correct * 100) / 100);
      const distract = [Number(corr) + randInt(1, 3), Number(corr) - randInt(1, 3), Number(corr) + randInt(4, 7)].map(String);
      const choices = shuffle([corr, ...distract]);
      out.push({
        id: `gf-${i}-${num}-${denom}-${whole}`,
        subject: "maths",
        stem: `What is ${num}/${denom} of ${whole}?`,
        choices,
        answerIndex: choices.indexOf(corr),
        explanation: `${num}/${denom} x ${whole} = ${corr}.`,
      });
    }
  }
  return out;
}
function genEnglish(n: number): Question[] {
  const pairs = [
    ["happy", "cheerful"], ["angry", "furious"], ["small", "tiny"], ["fast", "quick"], ["eager", "keen"], ["brave", "courageous"],
  ];
  const wrongs = ["tired", "worried", "reluctant", "slow", "large", "dull"];
  const out: Question[] = [];
  for (let i = 0; i < n; i++) {
    const [w, syn] = pick(pairs);
    const choices = shuffle([syn, ...shuffle(wrongs).slice(0, 3)]);
    out.push({
      id: `ge-${i}-${w}`,
      subject: "english",
      stem: `Choose the best synonym for '${w}':`,
      choices,
      answerIndex: choices.indexOf(syn),
      explanation: `'${syn}' is closest in meaning to '${w}'.`,
    });
  }
  return out;
}
function genVR(n: number): Question[] {
  const out: Question[] = [];
  for (let i = 0; i < n; i++) {
    const shift = pick([1, 2]);
    const a = String.fromCharCode(65 + randInt(0, 20));
    const b = String.fromCharCode(a.charCodeAt(0) + shift);
    const c = String.fromCharCode(b.charCodeAt(0) + shift);
    const d = String.fromCharCode(c.charCodeAt(0) + shift);
    const next = String.fromCharCode(d.charCodeAt(0) + shift);
    const choices = shuffle([next, String.fromCharCode(next.charCodeAt(0) + 1), String.fromCharCode(next.charCodeAt(0) - 1), a]);
    out.push({
      id: `gv-${i}-${a}-${shift}`,
      subject: "vr",
      stem: `Find the next pair: ${a}${b}, ${b}${c}, ${c}${d}, ${d}${next}, __`,
      choices,
      answerIndex: choices.indexOf(next),
      explanation: `Shift by ${shift}.`,
    });
  }
  return out;
}
function genNVR(n: number): Question[] {
  const shapes = ["▲ triangle", "■ square", "● circle", "◆ diamond"];
  const out: Question[] = [];
  for (let i = 0; i < n; i++) {
    const commonFill = Math.random() < 0.5 ? "black" : "white";
    const oddFill = commonFill === "black" ? "white" : "black";
    const options = [
      `${shapes[0]} ${commonFill}`,
      `${shapes[1]} ${commonFill}`,
      `${shapes[2]} ${commonFill}`,
      `${shapes[3]} ${oddFill}`,
    ];
    const choices = shuffle(options);
    const correct = choices.findIndex((s) => s.endsWith(oddFill));
    out.push({
      id: `gn-${i}-${commonFill}`,
      subject: "nvr",
      stem: "Which is the odd one out? (descriptive)",
      choices,
      answerIndex: correct,
      explanation: `Three share fill=${commonFill}; one is ${oddFill}.`,
    });
  }
  return out;
}

/** Build a fresh randomized set for a subject, avoiding last quiz's IDs and removing duplicates by stem **/
function buildQuizSet(subj: Subject, count: number, lastIds: Set<string>): Question[] {
  const base = BASE_BANK.filter((q) => q.subject === subj);

  // Build a large generated pool
  let generated: Question[] = [];
  const genOnce =
    subj === "maths" ? () => genMaths(8) :
    subj === "english" ? () => genEnglish(8) :
    subj === "vr" ? () => genVR(8) :
    () => genNVR(8);

  for (let i = 0; i < 4; i++) generated = generated.concat(genOnce());

  // Combine, shuffle, prefer not-in-last, then dedupe by stem
  const pool = shuffle([...base, ...generated]).sort((a, b) => {
    const A = lastIds.has(a.id) ? 1 : 0;
    const B = lastIds.has(b.id) ? 1 : 0;
    return A - B;
  });

  let uniquePool = uniqueBy(pool, (q) => q.stem);
  let finalSet = uniquePool.slice(0, count);

  // If still not enough, keep generating until enough unique stems
  while (finalSet.length < count) {
    const more = genOnce();
    uniquePool = uniqueBy([...uniquePool, ...more], (q) => q.stem);
    finalSet = uniquePool.slice(0, count);
  }

  return finalSet;
}

/** UI helpers **/
function Card({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "4px solid #3b3b3b",
        boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
        padding: 16,
        background: "linear-gradient(135deg,#e8f7e8,#d4eed4)",
      }}
    >
      {children}
    </div>
  );
}
function BlockButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }
) {
  const { children, style, ...rest } = props;
  return (
    <button
      {...rest}
      style={{
        padding: "12px 16px",
        borderRadius: 12,
        border: "4px solid #2f4f2f",
        boxShadow: "0 2px 0 rgba(0,0,0,0.15)",
        background: "#7cc76b",
        fontWeight: 700,
        letterSpacing: 0.2,
        cursor: "pointer",
        ...(style || {}),
      }}
    >
      {children}
    </button>
  );
}
function Pill({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "6px 12px",
        borderRadius: 999,
        background: "#cfe9c9",
        border: "1px solid #5a8151",
        fontSize: 12,
      }}
    >
      {children}
    </span>
  );
}

/** Page **/
export default function Page() {
  const [mode, setMode] = useState<Mode>("menu");
  const [subject, setSubject] = useState<Subject | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(QUIZ_SECONDS);
  const [answers, setAnswers] = useState<AnswerRec[]>([]);
  const [dailyUsed, setDailyUsed] = useState(0);
  const [paused, setPaused] = useState(false);

  // Track last quiz's question IDs to avoid immediate repetition
  const lastIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setDailyUsed(getUsedSecondsToday());
  }, []);

  const endQuiz = useCallback(() => {
    const elapsed = Math.max(0, QUIZ_SECONDS - secondsLeft);
    addUsedSecondsToday(elapsed);
    setDailyUsed(getUsedSecondsToday());
    setMode("results");
  }, [secondsLeft]);

  // Timer
  useEffect(() => {
    if (mode !== "quiz" || paused) return;
    if (secondsLeft <= 0) {
      endQuiz();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [mode, paused, secondsLeft, endQuiz]);

  const canStart = dailyUsed < DAILY_CAP_SECONDS;
  const remainingToday = Math.max(0, DAILY_CAP_SECONDS - dailyUsed);

  function startQuiz(subj: Subject) {
    if (!canStart) return;
    const count = QUESTION_COUNT[subj];
    const set = buildQuizSet(subj, count, lastIdsRef.current);
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
    setAnswers((prev) => [...prev, { qid: q.id, choice: choiceIndex, correct }]);
    if (index + 1 < questions.length) setIndex((i) => i + 1);
    else finishNow();
  }

  function finishNow() {
    // Save this run's IDs to avoid reusing them immediately
    lastIdsRef.current = new Set(questions.map((q) => q.id));
    endQuiz();
  }

  const current = questions[index] || null;
  const correctCount = answers.filter((a) => a.correct).length;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#c8e6c9,#a5d6a7)",
        color: "#20351f",
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto", display: "grid", gap: 16 }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            textShadow: "2px 2px #8fbf7a",
            marginBottom: 8,
          }}
        >
          11+ Adventure — Quiz
        </h1>
        <div style={{ opacity: 0.8, fontSize: 14, marginBottom: 8 }}>
          Minecraft-inspired • Kent/Bexley • 10-min quizzes • 30-min daily cap
        </div>

        {mode === "menu" && (
          <Card>
            <div style={{ display: "grid", gap: 12 }}>
              {!canStart && (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    background: "#ffe8d2",
                    border: "2px solid #cc8a4a",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>Daily time done — amazing work!</div>
                  <div>You&apos;ve reached 30 minutes today. Come back tomorrow. 💚</div>
                </div>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                <BlockButton disabled={!canStart} onClick={() => startQuiz("maths")}>Maths</BlockButton>
                <BlockButton disabled={!canStart} onClick={() => startQuiz("english")}>English</BlockButton>
                <BlockButton disabled={!canStart} onClick={() => startQuiz("vr")}>VR</BlockButton>
                <BlockButton disabled={!canStart} onClick={() => startQuiz("nvr")}>NVR</BlockButton>
              </div>

              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Question counts — Maths: {QUESTION_COUNT.maths} · English: {QUESTION_COUNT.english} · VR: {QUESTION_COUNT.vr} · NVR: {QUESTION_COUNT.nvr}
              </div>
            </div>
          </Card>
        )}

        {mode === "quiz" && current && (
          <Card>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <Pill>Q {index + 1}/{questions.length}</Pill>
                  <Pill>Subject: {subject}</Pill>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <Pill>
                    Time: {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
                  </Pill>
                  <BlockButton
                    onClick={() => setPaused((p) => !p)}
                    style={{ background: paused ? "#d9c267" : "#9ad27a" }}
                  >
                    {paused ? "Resume" : "Pause"}
                  </BlockButton>
                  <BlockButton
                    onClick={() => {
                      if (confirm("End this quiz now and see your score?")) finishNow();
                    }}
                    style={{ background: "#f3a09a" }}
                  >
                    End quiz
                  </BlockButton>
                </div>
              </div>

              <div style={{ fontSize: 20, fontWeight: 700 }}>{current.stem}</div>

              <div style={{ display: "grid", gap: 10 }}>
                {current.choices.map((c, i) => (
                  <BlockButton key={i} onClick={() => answer(i)}>
                    {c}
                  </BlockButton>
                ))}
              </div>
            </div>
          </Card>
        )}

        {mode === "results" && (
          <Card>
            <div style={{ display: "grid", gap: 16 }}>
              {/* Big score at the top */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    background: "#9ad27a",
                    border: "4px solid #2f4f2f",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    fontWeight: 800,
                  }}
                >
                  {correctCount}/{questions.length}
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>Results</div>
                  <div style={{ opacity: 0.8, fontSize: 13 }}>
                    Great effort! You scored {correctCount} out of {questions.length}.
                  </div>
                </div>
              </div>

              {/* Review list */}
              <div style={{ display: "grid", gap: 8 }}>
                {questions.map((q, i) => {
                  const a = answers[i];
                  const verdict = a?.correct ? "✅ Correct" : "❌ Incorrect";
                  return (
                    <div key={q.id} style={{ border: "2px solid #6f9e63", borderRadius: 10, padding: 12, background: "#eef7ea" }}>
                      <div style={{ fontWeight: 700 }}>
                        Q{i + 1}. {q.stem}
                      </div>
                      <div style={{ fontSize: 14 }}>
                        Your answer: <strong>{typeof a?.choice === "number" ? q.choices[a.choice] : "—"}</strong> • Correct:{" "}
                        <strong>{q.choices[q.answerIndex]}</strong> • {verdict}
                      </div>
                      {q.explanation && <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>Explanation: {q.explanation}</div>}
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <BlockButton onClick={() => setMode("menu")}>Back to Menu</BlockButton>
                <BlockButton onClick={() => subject && startQuiz(subject!)}>
                  Try another {subject ?? ""}
                </BlockButton>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
