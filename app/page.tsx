"use client";

import React, { useEffect, useState } from "react";

// ------------------------------
// Types
// ------------------------------
type Subject = "maths" | "english" | "vr" | "nvr";
type GradeLevel = "Y4" | "Y5" | "DASH"; // Final dash = high intensity pre-exam

type Question = {
  id: string;
  subject: Subject;
  type: "mcq";
  stem: string;
  choices: string[];
  answerIndex: number;
  explanation?: string;
  tags?: string[];
};

// ------------------------------
// Sample questions
// ------------------------------
const BASE_BANK: Question[] = [
  {
    id: "math-fractions-01",
    subject: "maths",
    type: "mcq",
    stem: "What is 3/4 of 20?",
    choices: ["10", "12", "15", "18"],
    answerIndex: 2,
    explanation: "3/4 × 20 = 15",
    tags: ["year:5", "kent", "bexley"],
  },
  {
    id: "eng-vocab-01",
    subject: "english",
    type: "mcq",
    stem: "Choose the best synonym for ‘eager’:",
    choices: ["reluctant", "keen", "tired", "worried"],
    answerIndex: 1,
    explanation: "‘Keen’ is closest in meaning to ‘eager’.",
    tags: ["year:4", "year:5"],
  },
  {
    id: "vr-sequence-01",
    subject: "vr",
    type: "mcq",
    stem: "Find the next pair: AB, BC, CD, DE, __",
    choices: ["EF", "FG", "AE", "DD"],
    answerIndex: 0,
    explanation: "Letters move forward by one.",
    tags: ["year:4", "year:5"],
  },
  {
    id: "nvr-odd-01",
    subject: "nvr",
    type: "mcq",
    stem: "Which is the odd one out?",
    choices: ["▲ black triangle", "■ black square", "● black circle", "□ white square"],
    answerIndex: 3,
    explanation: "All are black-filled except the white square.",
    tags: ["year:4", "year:5"],
  },
];

// ------------------------------
// Settings & Timers
// ------------------------------
const QUIZ_SECONDS = 10 * 60;
const DAILY_CAP_SECONDS = 30 * 60;

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function getUsedSecondsToday(): number {
  const key = `quizTime_${todayKey()}`;
  const v = (typeof window !== "undefined" && localStorage.getItem(key)) || "0";
  return parseInt(v, 10) || 0;
}
function addUsedSecondsToday(delta: number) {
  const key = `quizTime_${todayKey()}`;
  const cur = getUsedSecondsToday();
  localStorage.setItem(key, String(cur + delta));
}

// ------------------------------
// UI Components (Minecraft-style)
// ------------------------------
const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-2xl border-4 border-[#3b3b3b] shadow-xl p-4 bg-gradient-to-br from-[#e8f7e8] to-[#d4eed4]">
    {children}
  </div>
);

const BlockButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
  children,
  ...props
}) => (
  <button
    className="px-4 py-3 rounded-xl border-4 border-[#2f4f2f] shadow active:translate-y-0.5 bg-[#7cc76b] hover:bg-[#8dde79] font-semibold tracking-wide"
    {...props}
  >
    {children}
  </button>
);

const Pill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-block px-3 py-1 rounded-full bg-[#cfe9c9] border border-[#5a8151] text-sm">
    {children}
  </span>
);

// ------------------------------
// Main Component
// ------------------------------
export default function Page() {
  const [mode, setMode] = useState<"menu" | "quiz" | "results">("menu");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(QUIZ_SECONDS);
  const [answers, setAnswers] = useState<number[]>([]);
  const [dailyUsed, setDailyUsed] = useState<number>(0);

  useEffect(() => {
    setDailyUsed(getUsedSecondsToday());
  }, []);

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

  function startQuiz() {
    if (!canStart) return;
    setQuestions(BASE_BANK);
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
    addUsedSecondsToday(elapsed);
    setDailyUsed(getUsedSecondsToday());
    setMode("results");
  }

  const current = questions[index];
  const correctCount = answers.filter(
    (a, i) => questions[i]?.answerIndex === a
  ).length;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#c8e6c9,#a5d6a7)] text-[#20351f] p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-extrabold">11+ Adventure — Quiz</h1>
        <div className="text-sm opacity-80">
          Minecraft-inspired • Kent/Bexley • Year 4/5/Final Dash • 10-min
          quizzes • 30-min daily cap
        </div>

        {mode === "menu" && (
          <Card>
            <div className="flex flex-col gap-4">
              {!canStart && (
                <div className="p-3 rounded-lg bg-[#ffe8d2] border-2 border-[#cc8a4a]">
                  <div className="font-semibold">Daily time done!</div>
                  <div>Come back tomorrow for more quests. 💚</div>
                </div>
              )}
              <BlockButton disabled={!canStart} onClick={startQuiz}>
                Start Quiz
              </BlockButton>
            </div>
          </Card>
        )}

        {mode === "quiz" && current && (
          <Card>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <Pill>
                  Q {index + 1}/{questions.length}
                </Pill>
                <Pill>
                  Time: {Math.floor(secondsLeft / 60)}:
                  {String(secondsLeft % 60).padStart(2, "0")}
                </Pill>
              </div>
              <div className="text-xl font-bold">{current.stem}</div>
              <div className="grid gap-3">
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
            <div className="flex flex-col gap-4">
              <div className="text-2xl font-extrabold">Results</div>
              <Pill>
                Score: {correctCount}/{questions.length}
              </Pill>
              <BlockButton onClick={() => setMode("menu")}>
                Back to Menu
              </BlockButton>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
