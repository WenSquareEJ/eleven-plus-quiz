"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Types **/
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

/** Minimal bank (expand later) **/
const BASE_BANK: Question[] = [
  {
    id: "maths-01",
    subject: "maths",
    stem: "What is 3/4 of 20?",
    choices: ["12", "13", "14", "15"],
    answerIndex: 3,
    explanation: "3/4 × 20 = 15.",
  },
  {
    id: "english-01",
    subject: "english",
    stem: "Choose the best synonym for ‘eager’:",
    choices: ["reluctant", "keen", "tired", "worried"],
    answerIndex: 1,
    explanation: "‘Keen’ is closest in meaning to ‘eager’.",
  },
  {
    id: "vr-01",
    subject: "vr",
    stem: "Find the next pair: AB, BC, CD, DE, __",
    choices: ["EF", "FG", "DD", "AE"],
    answerIndex: 0,
    explanation: "Letters move forward by one.",
  },
  {
    id: "nvr-01",
    subject: "nvr",
    stem: "Which is the odd one out?",
    choices: ["▲ black triangle", "■ black square", "● black circle", "□ white square"],
    answerIndex: 3,
    explanation: "All are black-filled except the white square.",
  },
];

/** Timers **/
const QUIZ_SECONDS = 10 * 60; // 10min per quiz
const DAILY_CAP_SECONDS = 30 * 60; // 30min per day

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

/** Simple Minecraft-y UI (inline styles = no Tailwind needed) **/
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

/** Page Component **/
export default function Page() {
  const [mode, setMode] = useState<Mode>("menu");
  const [subject, setSubject] = useState<Subject | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(QUIZ_SECONDS);
  const [answers, setAnswers] = useState<number[]>([]);
  const [dailyUsed, setDailyUsed] = useState(0);

  useEffect(() => {
    setDailyUsed(getUsedSecondsToday());
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (mode !== "quiz") return;
    if (secondsLeft <= 0) {
      endQuiz();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [mode, secondsLeft]);

  const canStart = dailyUsed < DAILY_CAP_SECONDS;

  function startQuiz(subj: Subject) {
    if (!canStart) return;
    setSubject(subj);
    setQuestions(BASE_BANK.filter((q) => q.subject === subj));
    setIndex(0);
    setAnswers([]);
    setSecondsLeft(Math.min(QUIZ_SECONDS, DAILY_CAP_SECONDS - dailyUsed));
    setMode("quiz");
  }

  function answer(choiceIndex: number) {
    setAnswers((prev) => [...prev, choiceIndex]);
    if (index + 1 < questions.length) setIndex((i) => i + 1);
    else endQuiz();
  }

  function endQuiz() {
    const elapsed = QUIZ_SECONDS - secondsLeft;
    addUsedSecondsToday(Math.max(0, elapsed));
    setDailyUsed(getUsedSecondsToday());
    setMode("results");
  }

  const current = questions[index] || null;
  const correctCount = answers.filter((a, i) => questions[i]?.answerIndex === a).length;

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
      <div style={{ maxWidth: 880, margin: "0 auto", display: "grid", gap: 16 }}>
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
                  <div>You've reached 30 minutes today. Come back tomorrow. 💚</div>
                </div>
              )}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0,1fr))",
                  gap: 12,
                }}
              >
                <BlockButton disabled={!canStart} onClick={() => startQuiz("maths")}>
                  Maths
                </BlockButton>
                <BlockButton disabled={!canStart} onClick={() => startQuiz("english")}>
                  English
                </BlockButton>
                <BlockButton disabled={!canStart} onClick={() => startQuiz("vr")}>
                  VR
                </BlockButton>
                <BlockButton disabled={!canStart} onClick={() => startQuiz("nvr")}>
                  NVR
                </BlockButton>
              </div>
            </div>
          </Card>
        )}

        {mode === "quiz" && current && (
          <Card>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
                <Pill>
                  Q {index + 1}/{questions.length}
                </Pill>
                <Pill>
                  Time: {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
                </Pill>
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
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>Results</div>
              <Pill>
                Score: {correctCount}/{questions.length}
              </Pill>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <BlockButton onClick={() => setMode("menu")}>Back to Menu</BlockButton>
                <BlockButton onClick={() => subject && startQuiz(subject)}>
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
