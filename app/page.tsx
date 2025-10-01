"use client";

import React, { useEffect, useState } from "react";

// Types
type Subject = "maths" | "english" | "vr" | "nvr" | "comprehension" | "writing";

type Question = {
  id: string;
  subject: Subject;
  stem: string;
  choices?: string[];
  answerIndex?: number;
  explanation?: string;
  svgChoiceSets?: string[][];
};

type Passage = {
  id: string;
  title?: string;
  text: string;
  questions: Question[];
};

// Utility: deduplicate by id
function uniqueById<T extends { id: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  return arr.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

// Utility: shuffle
function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

// Main Page
const Page: React.FC = () => {
  const [mode, setMode] = useState<"menu" | "quiz" | "results" | "writing">("menu");
  const [subject, setSubject] = useState<Subject | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [passage, setPassage] = useState<Passage | null>(null);
  const [writingText, setWritingText] = useState("");
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [dailyLeft, setDailyLeft] = useState<number>(30 * 60);

  // Daily cap timer
  useEffect(() => {
    if (mode === "quiz" || mode === "writing") {
      const t = setInterval(() => {
        setDailyLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(t);
    }
  }, [mode]);

  // Quiz / writing timers
  useEffect(() => {
    if ((mode === "quiz" || mode === "writing") && timeLeft > 0) {
      const t = setTimeout(() => setTimeLeft((tl) => tl - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [mode, timeLeft]);

  async function startComprehension() {
    const res = await fetch("/questions/comprehension.json");
    const data: Passage[] = await res.json();
    const chosen = data[Math.floor(Math.random() * data.length)];
    setPassage(chosen);
    setQuestions(uniqueById(shuffle(chosen.questions).slice(0, 5)));
    setSubject("comprehension");
    setIndex(0);
    setAnswers([]);
    setTimeLeft(10 * 60);
    setMode("quiz");
  }

  async function startQuiz(subj: Subject) {
    if (dailyLeft <= 0) {
      alert("Daily 30m cap reached!");
      return;
    }
    if (subj === "comprehension") {
      startComprehension();
      return;
    }
    if (subj === "writing") {
      setSubject("writing");
      setWritingText("");
      setTimeLeft(30 * 60); // 30 minutes
      setMode("writing");
      return;
    }

    // Generate sample questions (placeholder procedural)
    let qs: Question[] = [];
    if (subj === "maths") {
      for (let i = 0; i < 12; i++) {
        const a = Math.floor(Math.random() * 20) + 1;
        const b = Math.floor(Math.random() * 20) + 1;
        qs.push({
          id: `math-${i}-${a}-${b}`,
          subject: "maths",
          stem: `What is ${a} + ${b}?`,
          choices: [`${a + b}`, `${a + b + 1}`, `${a + b - 1}`, `${a + b + 2}`],
          answerIndex: 0,
        });
      }
    } else if (subj === "english") {
      qs = [
        {
          id: "eng-1",
          subject: "english",
          stem: "Which is a synonym of 'happy'?",
          choices: ["sad", "joyful", "angry", "tired"],
          answerIndex: 1,
        },
        {
          id: "eng-2",
          subject: "english",
          stem: "Choose the correct sentence:",
          choices: [
            "The cat sleep on the mat.",
            "The cat sleeps on the mat.",
            "The cat slepts on the mat.",
            "The cat sleeping on the mat.",
          ],
          answerIndex: 1,
        },
      ];
    } else if (subj === "vr") {
      qs = [
        {
          id: "vr-1",
          subject: "vr",
          stem: "What comes next: A, C, E, G, ?",
          choices: ["I", "H", "J", "K"],
          answerIndex: 0,
        },
      ];
    } else if (subj === "nvr") {
      qs = [
        {
          id: "nvr-1",
          subject: "nvr",
          stem: "Pick the odd-one-out shape:",
          svgChoiceSets: [
            ["square", "circle"],
            ["square", "circle", "triangle"],
            ["triangle", "triangle"],
            ["circle", "circle"],
          ],
          answerIndex: 2,
        },
      ];
    }

    qs = uniqueById(shuffle(qs));
    setQuestions(qs);
    setSubject(subj);
    setIndex(0);
    setAnswers([]);
    setTimeLeft(10 * 60);
    setMode("quiz");
  }

  function answerCurrent(i: number) {
    setAnswers((prev) => [...prev, i]);
    if (index + 1 < questions.length) setIndex((x) => x + 1);
    else setMode("results");
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {mode === "menu" && (
        <div>
          <h1 className="text-2xl font-bold mb-4">11+ Adventure Menu</h1>
          <p className="mb-2">Daily time left: {Math.floor(dailyLeft / 60)}m</p>
          <div className="grid gap-2">
            <button className="p-3 bg-green-200" onClick={() => startQuiz("maths")}>Maths</button>
            <button className="p-3 bg-green-200" onClick={() => startQuiz("english")}>English</button>
            <button className="p-3 bg-green-200" onClick={() => startQuiz("vr")}>Verbal Reasoning</button>
            <button className="p-3 bg-green-200" onClick={() => startQuiz("nvr")}>Non-Verbal Reasoning</button>
            <button className="p-3 bg-green-200" onClick={() => startQuiz("comprehension")}>Comprehension</button>
            <button className="p-3 bg-green-200" onClick={() => startQuiz("writing")}>Writing (typed, 30m)</button>
          </div>
        </div>
      )}

      {mode === "quiz" && subject === "comprehension" && passage && (
        <div>
          <h2 className="font-bold mb-2">{passage.title || "Passage"}</h2>
          <div className="p-3 border mb-4 whitespace-pre-line">{passage.text}</div>
          <div>
            <p className="font-semibold mb-2">{questions[index].stem}</p>
            {questions[index].choices?.map((c, i) => (
              <button key={i} className="block p-2 m-1 bg-blue-200" onClick={() => answerCurrent(i)}>{c}</button>
            ))}
          </div>
          <div className="mt-2">Time left: {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}</div>
        </div>
      )}

      {mode === "quiz" && subject !== "comprehension" && subject !== "writing" && (
        <div>
          <p className="font-semibold mb-2">{questions[index].stem}</p>
          {questions[index].choices?.map((c, i) => (
            <button key={i} className="block p-2 m-1 bg-blue-200" onClick={() => answerCurrent(i)}>{c}</button>
          ))}
          {questions[index].svgChoiceSets && (
            <div className="flex gap-2 mt-2">
              {questions[index].svgChoiceSets.map((shapes, i) => (
                <button key={i} onClick={() => answerCurrent(i)} className="p-2 border">
                  {shapes.map((s, j) => (
                    <svg key={j} width="40" height="40">
                      {s === "square" && <rect x="5" y="5" width="30" height="30" stroke="black" fill="white" />}
                      {s === "circle" && <circle cx="20" cy="20" r="15" stroke="black" fill="white" />}
                      {s === "triangle" && <polygon points="20,5 35,35 5,35" stroke="black" fill="white" />}
                    </svg>
                  ))}
                </button>
              ))}
            </div>
          )}
          <div className="mt-2">Time left: {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}</div>
        </div>
      )}

      {mode === "writing" && (
        <div>
          <h2 className="font-bold mb-2">Writing Task (30 minutes)</h2>
          <p className="mb-2">Write your story or essay here. Autocorrect is disabled so spelling can be checked.</p>
          <textarea
            className="w-full h-64 border p-2"
            value={writingText}
            onChange={(e) => setWritingText(e.target.value)}
            spellCheck={false}
          />
          <div className="mt-2">Time left: {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}</div>
          <button className="p-2 bg-green-300 mt-3" onClick={() => setMode("results")}>Finish</button>
        </div>
      )}

      {mode === "results" && (
        <div>
          <h2 className="text-xl font-bold mb-2">Results</h2>
          {subject === "writing" && (
            <div>
              <p>Your writing (typed):</p>
              <div className="p-3 border whitespace-pre-line">{writingText}</div>
            </div>
          )}
          {subject !== "writing" && questions.map((q, i) => (
            <div key={q.id} className="mb-2">
              <p>{q.stem}</p>
              <p>Your answer: {typeof answers[i] === "number" ? q.choices?.[answers[i]] : "—"}; Correct: {q.choices?.[q.answerIndex || 0]}</p>
            </div>
          ))}
          <button className="p-2 bg-green-300 mt-3" onClick={() => setMode("menu")}>Back to menu</button>
        </div>
      )}
    </div>
  );
};

export default Page;
