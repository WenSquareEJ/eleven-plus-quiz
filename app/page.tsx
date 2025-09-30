import React, { useEffect, useState } from "react";

// 11+ PRACTICE STARTER — Minecraft-styled, Kent/Bexley focus
// 10-min quizzes • 30-min daily cap • Settings (Year 4 / Year 5 / Final Dash)

// ------------------------------
// Types
// ------------------------------

type Subject = "maths" | "english" | "vr" | "nvr";
type GradeLevel = "Y4" | "Y5" | "DASH";

type Question = {
  id: string;
  subject: Subject;
  stem: string;
  choices?: string[];
  answerIndex?: number;
  answerText?: string;
  explanation?: string;
};

// ------------------------------
// Simple question bank (replace/expand later)
// ------------------------------

const BASE_BANK: Question[] = [
  {
    id: "maths-01",
    subject: "maths",
    stem: "What is 3/4 of 20?",
    choices: ["12", "13", "14", "15"],
    answerIndex: 3,
    explanation: "3/4 × 20 = 15",
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

// ------------------------------
// Timers
// ------------------------------

const QUIZ_SECONDS = 10 * 60; // 10 minutes per quiz
const DAILY_CAP_SECONDS = 30 * 60; // 30 minutes per day

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function getUsedSecondsToday(): number {
  const key = `quizTime_${todayKey()}`;
  if (typeof window === "undefined") return 0;
  return parseInt(localStorage.getItem(key) || "0", 10) || 0;
}

function addUsedSecondsToday(delta: number) {
  const key = `quizTime_${todayKey()}`;
  const cur = getUsedSecondsToday();
  localStorage.setItem(key, String(cur + delta));
}

// ------------------------------
// UI helpers (Minecraft-y)
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
    className="px-4 py-3 rounded-xl border-4 border-[#2f4f2f] shadow bg-[#7cc76b] hover:bg-[#8dde79] font-semibold tracking-wide"
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

type Mode = "menu" | "quiz" | "results";
type AnswerRecord = { qid: string; correct: boolean; givenIndex?: number };

const Page: React.FC = () => {
  const [mode, setMode] = useState<Mode>("menu");
  const [subject, setSubject] = useState<Subject | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(QUIZ_SECONDS);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
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

  function startQuiz(subj: Subject) {
    if (!canStart) return;
    const qs = BASE_BANK.filter((q) => q.subject === subj);
    setSubject(subj);
    setQuestions(qs);
    setIndex(0);
    setAnswers([]);
    setSecondsLeft(QUIZ_SECONDS);
    setStartedAt(Date.now());
    setMode("quiz");
  }

  function answerCurrent(choiceIndex: number) {
    const q = questions[index];
    if (!q) return;
    const correct = q.answerIndex === choiceIndex;
    setAnswers((prev) => [...prev, { qid: q.id, correct, givenIndex: choiceIndex }]);
    if (index + 1 < questions.length && secondsLeft > 0) setIndex((i) => i + 1);
    else endQuiz();
  }

  function endQuiz() {
    const elapsed = Math.max(0, QUIZ_SECONDS - secondsLeft);
    addUsedSecondsToday(elapsed);
    setDailyUsed(getUsedSecondsToday());
    setMode("results");
  }

  const current = questions[index];
  const correctCount = answers.filter((a) => a.correct).length;

  const header = (
    <div className="w-full flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h1
          className="text-2xl sm:text-3xl font-extrabold tracking-tight"
          style={{ textShadow: "2px 2px #8fbf7a" }}
        >
          11+ Adventure — Quiz
        </h1>
        <div className="flex items-center gap-2">
          <Pill>
            Daily: {Math.floor(dailyUsed / 60)}m/{Math.floor(DAILY_CAP_SECONDS / 60)}m
          </Pill>
          {mode === "quiz" && (
            <Pill>
              Time Left: {Math.floor(secondsLeft / 60)}:
              {String(secondsLeft % 60).padStart(2, "0")}
            </Pill>
          )}
        </div>
      </div>
      <div className="text-sm opacity-80">
        Minecraft-inspired • Kent/Bexley • Y4/Y5/Final Dash • 10-minute quizzes • 30-minute daily cap
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#c8e6c9,#a5d6a7)] text-[#20351f] p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {header}

        {mode === "menu" && (
          <Card>
            <div className="flex flex-col gap-4">
              <div className="text-lg">Choose a realm to explore:</div>
              {!canStart && (
                <div className="p-3 rounded-lg bg-[#ffe8d2] border-2 border-[#cc8a4a]">
                  <div className="font-semibold">Daily time done — amazing work!</div>
                  <div>
                    You've reached 30 minutes today. Come back tomorrow for more quests. 💚
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <Pill>
                  Q {index + 1} / {questions.length}
                </Pill>
                <Pill>Subject: {subject}</Pill>
              </div>
              <div className="text-xl font-bold">{current.stem}</div>
              <div className="grid gap-3">
                {current.choices?.map((c, i) => (
                  <BlockButton key={i} onClick={() => answerCurrent(i)}>
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
              <div className="flex items-center gap-3 flex-wrap">
                <Pill>
                  Score: {correctCount} / {questions.length}
                </Pill>
                <Pill>Time used today: {Math.floor(getUsedSecondsToday() / 60)}m</Pill>
              </div>
              <div className="grid gap-3">
                {questions.map((q, i) => {
                  const ar = answers[i];
                  const verdict = ar?.correct ? "✅ Correct" : "❌ Incorrect";
                  const chosen =
                    typeof ar?.givenIndex === "number" ? q.choices?.[ar.givenIndex] : "—";
                  const correctAns =
                    typeof q.answerIndex === "number"
                      ? q.choices?.[q.answerIndex]
                      : q.answerText;
                  return (
                    <div
                      key={q.id}
                      className="rounded-lg border-2 border-[#6f9e63] p-3 bg-[#eef7ea]"
                    >
                      <div className="font-semibold">
                        Q{i + 1}. {q.stem}
                      </div>
                      <div className="text-sm">
                        Your answer: <span className="font-semibold">{chosen}</span> • Correct:{" "}
                        <span className="font-semibold">{correctAns}</span> • {verdict}
                      </div>
                      {q.explanation && (
                        <div className="text-sm opacity-90 mt-1">
                          Explanation: {q.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-3 flex-wrap">
                <BlockButton onClick={() => setMode("menu")}>Back to Menu</BlockButton>
                <BlockButton onClick={() => startQuiz(subject || "maths")}>
                  Try another {subject}
                </BlockButton>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Page;
