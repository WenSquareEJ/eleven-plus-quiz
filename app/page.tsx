"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

// =========================
// Types
// =========================

type YearGroup = "Year 4" | "Year 5" | "Final Dash";
type Difficulty = "Easy" | "Medium" | "Hard";
type Subject = "Maths" | "English" | "VR" | "NVR" | "Comprehension" | "Writing";

type QuestionType = "mcq" | "short" | "nvr";

interface Option {
  id: string;
  text?: string;
  svg?: React.ReactNode;
  correct: boolean;
}

interface Question {
  id: string;
  subject: Subject;
  type: QuestionType;
  prompt: string;
  options?: Option[]; // for mcq & nvr
  answer?: string; // for short
  diagram?: React.ReactNode; // for diagrams if needed
}

interface PassageMCQOption { id: string; text: string; correct: boolean }
interface PassageMCQ { id: string; question: string; options: PassageMCQOption[] }
interface Passage { id: string; title: string; body: string; questions: PassageMCQ[] }

interface WritingBank {
  narrative: string[];
  descriptive: string[];
  persuasive: string[];
  factual: string[];
}

// Utility helpers
const rand = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;
const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const uid = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const byDifficulty = (difficulty: Difficulty, base: number): number => {
  switch (difficulty) {
    case "Easy": return base;
    case "Medium": return Math.max(base + 1, Math.round(base * 1.5));
    case "Hard": return Math.max(base + 2, Math.round(base * 2));
    default: return base;
  }
};

const byYear = (year: YearGroup, base: number): number => {
  if (year === "Year 5") return Math.round(base * 1.2);
  if (year === "Final Dash") return Math.round(base * 1.4);
  return base;
};

// =========================
// Maths Generator
// =========================
function generateMathsQuestions(year: YearGroup, difficulty: Difficulty): Question[] {
  const total = rand(8, 12);
  const qs: Question[] = [];
  const used = new Set<string>();

  const makeUnique = (key: string): boolean => {
    if (used.has(key)) return false;
    used.add(key);
    return true;
  };

  const ops = ["+", "-", "×", "÷"] as const;
  const maxN = byYear(year, byDifficulty(difficulty, 20));

  while (qs.length < total) {
    const pick = rand(1, 7);
    if (pick === 1) {
      // Arithmetic
      const a = rand(2, maxN);
      const b = rand(2, maxN);
      const op = ops[rand(0, ops.length - 1)];
      const key = `arith:${a}${op}${b}`;
      if (!makeUnique(key)) continue;
      let ans = 0;
      if (op === "+") ans = a + b;
      if (op === "-") ans = a - b;
      if (op === "×") ans = a * b;
      if (op === "÷") ans = Math.floor(a / Math.max(1, b));
      const distractors = shuffle([ans + rand(1, 5), ans - rand(1, 5), ans + rand(6, 10), ans - rand(6, 10)]).slice(0, 3);
      const options: Option[] = shuffle([ans, ...distractors]).map((n) => ({ id: uid(), text: String(n), correct: n === ans }));
      qs.push({ id: uid(), subject: "Maths", type: "mcq", prompt: `Calculate: ${a} ${op} ${b}`, options });
    } else if (pick === 2) {
      // Fractions (compare)
      const n1 = rand(1, 9), d1 = rand(2, 12);
      const n2 = rand(1, 9), d2 = rand(2, 12);
      const key = `frac:${n1}/${d1}vs${n2}/${d2}`;
      if (!makeUnique(key)) continue;
      const v1 = n1 / d1, v2 = n2 / d2;
      const correct = v1 > v2 ? `${n1}/${d1}` : `${n2}/${d2}`;
      const options: Option[] = shuffle([
        { id: uid(), text: `${n1}/${d1}`, correct: correct === `${n1}/${d1}` },
        { id: uid(), text: `${n2}/${d2}`, correct: correct === `${n2}/${d2}` },
        { id: uid(), text: "Equal", correct: v1 === v2 },
      ]);
      qs.push({ id: uid(), subject: "Maths", type: "mcq", prompt: "Which fraction is larger?", options });
    } else if (pick === 3) {
      // Ratios
      const a = rand(1, 9), b = rand(1, 9);
      const scale = rand(2, byDifficulty(difficulty, 4));
      const key = `ratio:${a}:${b}@${scale}`;
      if (!makeUnique(key)) continue;
      const ans = `${a * scale}:${b * scale}`;
      const options: Option[] = shuffle([
        ans,
        `${a * (scale + 1)}:${b * (scale + 1)}`,
        `${a * Math.max(1, scale - 1)}:${b * Math.max(1, scale - 1)}`,
        `${a * (scale + 2)}:${b * (scale + 3)}`,
      ]).map((t) => ({ id: uid(), text: t, correct: t === ans }));
      qs.push({ id: uid(), subject: "Maths", type: "mcq", prompt: `Scale the ratio ${a}:${b} by ${scale}.`, options });
    } else if (pick === 4) {
      // Geometry: perimeter of rectangle
      const w = rand(3, byDifficulty(difficulty, 10));
      const h = rand(3, byDifficulty(difficulty, 10));
      const key = `geoP:${w}x${h}`;
      if (!makeUnique(key)) continue;
      const ans = 2 * (w + h);
      const options: Option[] = shuffle([ans, ans + 2, ans - 2, ans + 4]).map((n) => ({ id: uid(), text: `${n} units`, correct: n === ans }));
      const diagram = (
        <svg width={160} height={100} viewBox="0 0 160 100" aria-label="rectangle" role="img">
          <rect x={20} y={20} width={w * 8} height={h * 8} fill="#94d82d" stroke="#2b8a3e" strokeWidth={3} />
        </svg>
      );
      qs.push({ id: uid(), subject: "Maths", type: "mcq", prompt: `Find the perimeter of the rectangle (w=${w}, h=${h}).`, options, diagram });
    } else if (pick === 5) {
      // Patterns
      const start = rand(1, 15);
      const step = rand(2, byDifficulty(difficulty, 6));
      const seq = [start, start + step, start + 2 * step, start + 3 * step];
      const key = `pattern:${seq.join(",")}`;
      if (!makeUnique(key)) continue;
      const ans = start + 4 * step;
      const options: Option[] = shuffle([ans, ans + step, ans - step, ans + step + 1]).map((n) => ({ id: uid(), text: String(n), correct: n === ans }));
      qs.push({ id: uid(), subject: "Maths", type: "mcq", prompt: `Find the next number: ${seq.join(", ")}, …`, options });
    } else if (pick === 6) {
      // Word problem (rate)
      const speed = rand(3, byDifficulty(difficulty, 6));
      const time = rand(10, byDifficulty(difficulty, 30));
      const key = `word:${speed}@${time}`;
      if (!makeUnique(key)) continue;
      const ans = speed * time;
      const options: Option[] = shuffle([ans, ans + rand(1, 10), ans - rand(1, 10), ans + rand(5, 15)]).map((n) => ({ id: uid(), text: `${n} m`, correct: n === ans }));
      qs.push({ id: uid(), subject: "Maths", type: "mcq", prompt: `A child walks ${speed} m per minute for ${time} minutes. How far do they travel?`, options });
    } else {
      // Area of right triangle
      const b = rand(4, byDifficulty(difficulty, 12));
      const h = rand(4, byDifficulty(difficulty, 12));
      const key = `geoA:${b}x${h}`;
      if (!makeUnique(key)) continue;
      const ans = Math.floor((b * h) / 2);
      const options: Option[] = shuffle([ans, ans + 2, ans - 2, ans + 4]).map((n) => ({ id: uid(), text: `${n} square units`, correct: n === ans }));
      const diagram = (
        <svg width={160} height={100} viewBox="0 0 160 100" aria-label="right triangle" role="img">
          <polygon points={`20,80 ${20 + b * 6},80 20,${80 - h * 6}`} fill="#b2f2bb" stroke="#2b8a3e" strokeWidth={3} />
        </svg>
      );
      qs.push({ id: uid(), subject: "Maths", type: "mcq", prompt: `Find the area of the right triangle (base=${b}, height=${h}).`, options, diagram });
    }
  }
  return qs;
}

// =========================
// English Generator
// =========================
function generateEnglishQuestions(_year: YearGroup, _difficulty: Difficulty): Question[] {
  const total = rand(8, 12);
  const qs: Question[] = [];
  const used = new Set<string>();
  const vocabBase: Array<{ word: string; syn: string; wrongs: string[] }> = [
    { word: "brave", syn: "courageous", wrongs: ["timid", "careless", "fragile"] },
    { word: "rapid", syn: "fast", wrongs: ["slow", "lazy", "late"] },
    { word: "ancient", syn: "old", wrongs: ["modern", "fresh", "early"] },
    { word: "vivid", syn: "bright", wrongs: ["dull", "dim", "pale"] },
  ];

  const punctBase: Array<{ s: string; missing: string; answer: string }> = [
    { s: "lets go to the park", missing: "'", answer: "let's go to the park" },
    { s: "wheres my book", missing: "'", answer: "where's my book" },
    { s: "tom s bike is red", missing: "'", answer: "tom's bike is red" },
  ];

  const clozeBase: Array<{ text: string; blanks: Array<{ idx: number; options: string[]; answer: string }> }> = [
    { text: "The cat __ on the mat and __ happily.", blanks: [ { idx: 2, options: ["sat", "sit", "sits", "set"], answer: "sat" }, { idx: 7, options: ["purrs", "purred", "purring", "purr"], answer: "purred" } ] },
    { text: "We __ to the museum and __ fossils.", blanks: [ { idx: 1, options: ["go", "went", "gone", "going"], answer: "went" }, { idx: 6, options: ["saw", "seen", "see", "seeing"], answer: "saw" } ] },
  ];

  const makeUnique = (key: string): boolean => {
    if (used.has(key)) return false;
    used.add(key);
    return true;
  };

  while (qs.length < total) {
    const kind = rand(1, 5);
    if (kind === 1) {
      // Vocabulary (synonyms)
      const pick = vocabBase[rand(0, vocabBase.length - 1)];
      const key = `syn:${pick.word}`;
      if (!makeUnique(key)) continue;
      const optionsText = shuffle([pick.syn, ...pick.wrongs]).slice(0, 4);
      const options: Option[] = optionsText.map((t) => ({ id: uid(), text: t, correct: t === pick.syn }));
      qs.push({ id: uid(), subject: "English", type: "mcq", prompt: `Choose a synonym for "${pick.word}"`, options });
    } else if (kind === 2) {
      // Antonyms
      const pick = vocabBase[rand(0, vocabBase.length - 1)];
      const key = `ant:${pick.word}`;
      if (!makeUnique(key)) continue;
      const correct = pick.wrongs[0];
      const options: Option[] = shuffle([pick.syn, ...pick.wrongs]).map((t) => ({ id: uid(), text: t, correct: t === correct }));
      qs.push({ id: uid(), subject: "English", type: "mcq", prompt: `Choose an antonym for "${pick.word}"`, options });
    } else if (kind === 3) {
      // Punctuation
      const pick = punctBase[rand(0, punctBase.length - 1)];
      const key = `punc:${pick.s}`;
      if (!makeUnique(key)) continue;
      const options: Option[] = shuffle([
        { id: uid(), text: pick.answer, correct: true },
        { id: uid(), text: pick.s, correct: false },
        { id: uid(), text: pick.s.toUpperCase(), correct: false },
        { id: uid(), text: pick.s + pick.missing, correct: false },
      ]);
      qs.push({ id: uid(), subject: "English", type: "mcq", prompt: `Add the missing punctuation: "${pick.s}"`, options });
    } else if (kind === 4) {
      // Grammar usage
      const isPlural = rand(0, 1) === 1;
      const noun = isPlural ? "dogs" : "dog";
      const correct = isPlural ? "are" : "is";
      const key = `gram:${noun}-${correct}`;
      if (!makeUnique(key)) continue;
      const options: Option[] = shuffle(["is", "are", "was", "were"]).map((t) => ({ id: uid(), text: t, correct: t === correct }));
      qs.push({ id: uid(), subject: "English", type: "mcq", prompt: `${noun} ____ running in the park.`, options });
    } else {
      // Cloze
      const pick = clozeBase[rand(0, clozeBase.length - 1)];
      const key = `cloze:${pick.text}`;
      if (!makeUnique(key)) continue;
      const b = pick.blanks[0];
      const options: Option[] = b.options.map((t) => ({ id: uid(), text: t, correct: t === b.answer }));
      const rendered = pick.text.replace("__", "____");
      qs.push({ id: uid(), subject: "English", type: "mcq", prompt: rendered, options });
    }
  }
  return qs;
}

// =========================
// Verbal Reasoning (VR) Generator
// =========================
function generateVRQuestions(_year: YearGroup, _difficulty: Difficulty): Question[] {
  const total = rand(8, 12);
  const qs: Question[] = [];
  const used = new Set<string>();
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  while (qs.length < total) {
    const kind = rand(1, 4);
    if (kind === 1) {
      // Letter sequence
      const startIdx = rand(0, 20);
      const step = byDifficulty(_difficulty, rand(1, 3));
      const seq = [0, 1, 2, 3].map((i) => alphabet[(startIdx + i * step) % 26]);
      const ans = alphabet[(startIdx + 4 * step) % 26];
      const key = `vr-seq:${seq.join("")}-${step}`;
      if (used.has(key)) continue; used.add(key);
      const options: Option[] = shuffle([
        ans,
        alphabet[(startIdx + 4 * step + 1) % 26],
        alphabet[(startIdx + 4 * step - 1 + 26) % 26],
        alphabet[(startIdx + 5 * step) % 26]
      ]).map((t) => ({ id: uid(), text: t, correct: t === ans }));
      qs.push({ id: uid(), subject: "VR", type: "mcq", prompt: `Find the next letter: ${seq.join(" - ")}, …`, options });
    } else if (kind === 2) {
      // Word codes (A=1, B=2 ...)
      const wordList = ["CAB", "BEND", "GLOVE", "MINE", "QUIZ"];
      const word = wordList[rand(0, wordList.length - 1)];
      const code = word.split("").map((ch) => alphabet.indexOf(ch) + 1).join("-");
      const key = `vr-code:${word}`; if (used.has(key)) continue; used.add(key);
      const options: Option[] = shuffle([
        { id: uid(), text: code, correct: true },
        { id: uid(), text: code.split("-").reverse().join("-"), correct: false },
        { id: uid(), text: code.replace(/-/g, ":"), correct: false },
        { id: uid(), text: code.replace(/\d+/g, (m) => String(Number(m) + 1)), correct: false },
      ]);
      qs.push({ id: uid(), subject: "VR", type: "mcq", prompt: `Using A=1, B=2 … what is the code for "${word}"?`, options });
    } else if (kind === 3) {
      // Analogies
      const pairs = [
        ["hot", "cold", "day", "night"],
        ["sun", "star", "planet", "earth"],
        ["puppy", "dog", "kitten", "cat"],
      ];
      const p = pairs[rand(0, pairs.length - 1)];
      const key = `vr-ana:${p.join("-")}`; if (used.has(key)) continue; used.add(key);
      const ans = p[3];
      const options: Option[] = shuffle([ans, p[2], p[0], p[1]]).map((t) => ({ id: uid(), text: t, correct: t === ans }));
      qs.push({ id: uid(), subject: "VR", type: "mcq", prompt: `${p[0]} is to ${p[1]} as ${p[2]} is to ____`, options });
    } else {
      // Logic puzzle (true/false inference)
      const a = rand(1, 9), b = rand(1, 9);
      const sumEven = (a + b) % 2 === 0;
      const key = `vr-logic:${a}-${b}`; if (used.has(key)) continue; used.add(key);
      const options: Option[] = shuffle([
        { id: uid(), text: "True", correct: sumEven },
        { id: uid(), text: "False", correct: !sumEven },
      ]);
      qs.push({ id: uid(), subject: "VR", type: "mcq", prompt: `If a=${a} and b=${b}, then a+b is even. True or False?`, options });
    }
  }
  return qs;
}

// =========================
// Non-Verbal Reasoning (NVR) Generator
// =========================
function shapeSVG(kind: "square" | "circle" | "triangle", size: number, fill: string, rotate: number): React.ReactElement {
  const s = size;
  const half = s / 2;
  const common = { transform: `rotate(${rotate} ${half} ${half})` } as React.SVGProps<SVGGElement>;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} role="img" aria-label={kind}>
      <g {...common}>
        {kind === "square" && <rect x={10} y={10} width={s - 20} height={s - 20} fill={fill} stroke="#1b5e20" strokeWidth={3} />}
        {kind === "circle" && <circle cx={half} cy={half} r={(s - 20) / 2} fill={fill} stroke="#1b5e20" strokeWidth={3} />}
        {kind === "triangle" && <polygon points={`${half},12 12,${s - 12} ${s - 12},${s - 12}`} fill={fill} stroke="#1b5e20" strokeWidth={3} />}
      </g>
    </svg>
  );
}

function generateNVRQuestions(_year: YearGroup, _difficulty: Difficulty): Question[] {
  const total = rand(8, 12);
  const qs: Question[] = [];
  const used = new Set<string>();
  const kinds = ["square", "circle", "triangle"] as const;
  const fills = ["#a3e635", "#86efac", "#93c5fd", "#fca5a5"];

  while (qs.length < total) {
    const kind = kinds[rand(0, kinds.length - 1)];
    const fill = fills[rand(0, fills.length - 1)];
    const rotate = [0, 90, 180, 270][rand(0, 3)];
    const key = `nvr:${kind}-${fill}-${rotate}`;
    if (used.has(key)) continue; used.add(key);

    const correctIndex = rand(0, 3);
    const options: Option[] = new Array(4).fill(null).map((_, i) => {
      const isOdd = i === correctIndex;
      const optFill = isOdd ? fills[(fills.indexOf(fill) + 1) % fills.length] : fill;
      const optRot = isOdd ? ((rotate + 90) % 360) : rotate;
      return {
        id: uid(),
        svg: shapeSVG(kind, 60, optFill, optRot),
        correct: isOdd,
      };
    });

    qs.push({ id: uid(), subject: "NVR", type: "nvr", prompt: "Choose the odd one out:", options });
  }

  return qs;
}

// =========================
// UI & Logic
// =========================

const SUBJECTS: Subject[] = ["Maths", "English", "VR", "NVR", "Comprehension", "Writing"];

const PAGE_STYLES: React.CSSProperties = {
  fontFamily: "'Press Start 2P', monospace",
};

export default function Page(): JSX.Element {
  const [year, setYear] = useState<YearGroup>("Year 5");
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [subject, setSubject] = useState<Subject | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(30 * 60);
  const [ended, setEnded] = useState<boolean>(false);
  const [passages, setPassages] = useState<Passage[]>([]);
  const [writingBank, setWritingBank] = useState<WritingBank | null>(null);
  const [writingText, setWritingText] = useState<string>("");
  const [writingPrompt, setWritingPrompt] = useState<string>("");
  const timerRef = useRef<number | null>(null);

  // Load JSON assets from public/
  useEffect(() => {
    void (async () => {
      try {
        const p = await fetch("/data/comprehension.json").then((r) => r.json()) as { passages: Passage[] };
        setPassages(p.passages);
      } catch { /* noop */ }
      try {
        const w = await fetch("/data/writing_prompts.json").then((r) => r.json()) as WritingBank;
        setWritingBank(w);
      } catch { /* noop */ }
    })();
  }, []);

  // Timer
  useEffect(() => {
    if (!startedAt || ended) return;
    timerRef.current = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          window.clearInterval(timerRef.current ?? undefined);
          setEnded(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => window.clearInterval(timerRef.current ?? undefined);
  }, [startedAt, ended]);

  const startQuiz = useCallback((s: Subject) => {
    setSubject(s);
    setAnswers({});
    setEnded(false);
    setTimeLeft(30 * 60);
    setStartedAt(Date.now());

    if (s === "Maths") setQuestions(generateMathsQuestions(year, difficulty));
    else if (s === "English") setQuestions(generateEnglishQuestions(year, difficulty));
    else if (s === "VR") setQuestions(generateVRQuestions(year, difficulty));
    else if (s === "NVR") setQuestions(generateNVRQuestions(year, difficulty));
    else if (s === "Comprehension") {
      const pool = passages.length > 0 ? passages : [];
      const pick = pool.length > 0 ? pool[rand(0, pool.length - 1)] : null;
      if (pick) {
        const qsC: Question[] = pick.questions.map((q) => ({
          id: q.id,
          subject: "Comprehension",
          type: "mcq",
          prompt: `${pick.title}: ${q.question}`,
          options: q.options.map((o) => ({ id: o.id, text: o.text, correct: o.correct })),
        }));
        setQuestions(qsC);
      } else {
        setQuestions([]);
      }
    } else if (s === "Writing") {
      if (writingBank) {
        const genres: Array<keyof WritingBank> = ["narrative", "descriptive", "persuasive", "factual"];
        const g = genres[rand(0, genres.length - 1)];
        const arr = writingBank[g];
        const prompt = arr[rand(0, arr.length - 1)];
        setWritingPrompt(`[${g.toUpperCase()}] ${prompt}`);
      } else {
        setWritingPrompt("Write a story about a hidden door in your school.");
      }
      setWritingText("");
      setQuestions([]);
    }
  }, [difficulty, passages, writingBank, year]);

  const submit = useCallback(() => {
    setEnded(true);
  }, []);

  const score = useMemo(() => {
    if (subject === "Writing") return 0;
    const right = questions.filter((q) => {
      if (!q.options) return false;
      const chosen = answers[q.id];
      const correct = q.options.find((o) => o.correct)?.id;
      return chosen === correct;
    }).length;
    return right;
  }, [answers, questions, subject]);

  const totalQs = questions.length;

  const handleAnswer = (qid: string, oid: string): void => {
    if (ended) return;
    setAnswers((prev) => ({ ...prev, [qid]: oid }));
  };

  // Heuristic writing feedback (offline)
  const writingFeedback = useMemo(() => {
    if (!ended || subject !== "Writing") return null;
    const text = writingText.trim();
    const words = text.length > 0 ? text.split(/\s+/) : [];
    const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.length > 0);
    const longSent = sentences.filter((s) => s.split(/\s+/).length > 25).length;
    const repeats = (() => {
      const freq: Record<string, number> = {};
      words.forEach((w) => { const k = w.toLowerCase(); freq[k] = (freq[k] ?? 0) + 1; });
      return Object.entries(freq).filter(([, n]) => n >= 5).map(([w]) => w);
    })();
    const misspellHints = ["definately", "recieve", "seperate", "occured", "wich", "becuase"];
    const foundMiss = misspellHints.filter((m) => text.toLowerCase().includes(m));
    return {
      wordCount: words.length,
      sentenceCount: sentences.length,
      longSentences: longSent,
      repeatedWords: repeats,
      possibleMisspellings: foundMiss,
      suggestions: [
        longSent > 0 ? "Break long sentences into two for clarity." : "Good sentence lengths overall.",
        repeats.length > 0 ? `Try synonyms for: ${repeats.join(", ")}.` : "Nice word variety.",
        foundMiss.length > 0 ? `Check spelling of: ${foundMiss.join(", ")}.` : "Spelling looks clean.",
        text.endsWith(" ") ? "Remove trailing spaces." : "",
      ].filter(Boolean),
    };
  }, [ended, subject, writingText]);

  const timeMMSS = useMemo(() => {
    const m = Math.floor(timeLeft / 60).toString().padStart(2, "0");
    const s = (timeLeft % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }, [timeLeft]);

  return (
    <main style={PAGE_STYLES} className="min-h-screen bg-gradient-to-b from-emerald-900 to-emerald-700 text-emerald-50">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
        * { box-sizing: border-box; }
        .card { background:#1e3a1e; border:4px solid #2f6b2f; border-radius:12px; box-shadow: 0 6px 0 #123512; }
        .btn { background:#3d7a3d; border:3px solid #123512; padding:10px 14px; border-radius:10px; cursor:pointer; }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 4px 0 #0d2b0d; }
        .btn:disabled { opacity:0.6; cursor:not-allowed; }
        .select, select, option { background:#204d20; border:3px solid #123512; color:#eaffea; padding:8px; border-radius:8px; }
        .grid { display:grid; gap: 12px; }
        .logoBlock { width:48px; height:48px; background:linear-gradient(145deg,#64dd64,#2a7a2a); border:4px solid #0b3b0b; border-radius:8px; }
        .option { display:flex; align-items:center; gap:10px; padding:10px; background:#173317; border:3px solid #0b3b0b; border-radius:10px; }
        .option.selected { outline:4px solid #64dd64; }
        .svgOpt { display:flex; align-items:center; justify-content:center; width:70px; height:70px; background:#102610; border-radius:8px; }
      `}</style>

      {/* Header */}
      <header className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="logoBlock" aria-label="ElevenEdge logo" />
          <h1 className="text-xl md:text-2xl">ElevenEdge</h1>
        </div>
        <div className="text-sm card px-4 py-2">Daily 30-min practice · Timer: <span aria-live="polite">{timeMMSS}</span></div>
      </header>

      {/* Controls */}
      <section className="card mx-4 p-4 grid md:grid-cols-3">
        <div className="grid">
          <label htmlFor="year">Year group</label>
          <select id="year" className="select" value={year} onChange={(e) => setYear(e.target.value as YearGroup)}>
            <option>Year 4</option>
            <option>Year 5</option>
            <option>Final Dash</option>
          </select>
        </div>
        <div className="grid">
          <label htmlFor="difficulty">Difficulty</label>
          <select id="difficulty" className="select" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
            <option>Easy</option>
            <option>Medium</option>
            <option>Hard</option>
          </select>
        </div>
        <div className="grid">
          <label>Start a subject</label>
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map((s) => (
              <button key={s} className="btn" onClick={() => startQuiz(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Banner */}
      <section className="mx-4 my-3 card p-4 text-center">
        <p>Welcome to your daily 11+ training. Choose a subject to begin — no repeated questions per session, and you get a friendly score summary at the end!</p>
      </section>

      {/* Quiz Area / Writing Area */}
      <section className="mx-4 my-4 card p-4">
        {!subject && <p>Select a subject to start your quiz.</p>}

        {subject && subject !== "Writing" && (
          <div className="grid gap-3">
            {questions.map((q, idx) => (
              <div key={q.id} className="grid gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-300">Q{idx + 1}.</span>
                  <p>{q.prompt}</p>
                </div>
                {q.diagram && <div className="flex">{q.diagram}</div>}
                <div className="grid md:grid-cols-2 gap-2">
                  {q.options?.map((o) => (
                    <button
                      key={o.id}
                      className={`option ${answers[q.id] === o.id ? "selected" : ""}`}
                      onClick={() => handleAnswer(q.id, o.id)}
                      disabled={ended}
                      aria-pressed={answers[q.id] === o.id}
                    >
                      {o.svg ? <span className="svgOpt">{o.svg}</span> : null}
                      {o.text ? <span>{o.text}</span> : null}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex gap-2">
              <button className="btn" onClick={submit} disabled={ended || timeLeft === 0}>Submit</button>
              <button className="btn" onClick={() => { setSubject(null); setQuestions([]); setAnswers({}); setEnded(false); setTimeLeft(30*60); setStartedAt(null); }}>End Session</button>
            </div>

            {(ended || timeLeft === 0) && subject && (
              <div className="card p-3">
                <h2 className="text-lg">Score Summary</h2>
                <p>You scored <strong>{score}</strong> out of <strong>{totalQs}</strong>.</p>
                <p>{timeLeft === 0 ? "Time's up! Great effort — come back tomorrow for more." : "Nice work!"}</p>
              </div>
            )}
          </div>
        )}

        {subject === "Writing" && (
          <div className="grid gap-3">
            <div className="card p-3">
              <h2 className="text-lg">30-minute Writing</h2>
              <p className="text-emerald-300">Prompt:</p>
              <p>{writingPrompt}</p>
            </div>

            <textarea
              value={writingText}
              onChange={(e) => setWritingText(e.target.value)}
              className="w-full min-h-[220px] p-3 text-emerald-900"
              placeholder="Type here..."
              spellCheck={false}
              autoCorrect="off"
            />

            <div className="flex gap-2">
              <button className="btn" onClick={submit} disabled={ended || timeLeft === 0}>Finish</button>
              <button className="btn" onClick={() => { setSubject(null); setWritingText(""); setEnded(false); setTimeLeft(30*60); setStartedAt(null); }}>End Session</button>
            </div>

            {(ended || timeLeft === 0) && writingFeedback && (
              <div className="card p-3">
                <h3 className="text-lg">Post-writing Feedback</h3>
                <ul className="list-disc pl-6">
                  <li>Words: {writingFeedback.wordCount}</li>
                  <li>Sentences: {writingFeedback.sentenceCount}</li>
                  <li>Long sentences (&gt;25 words): {writingFeedback.longSentences}</li>
                  {writingFeedback.repeatedWords.length > 0 && <li>Repeated words: {writingFeedback.repeatedWords.join(", ")}</li>}
                  {writingFeedback.possibleMisspellings.length > 0 && <li>Possible misspellings: {writingFeedback.possibleMisspellings.join(", ")}</li>}
                </ul>
                <p className="mt-2">Suggestions:</p>
                <ul className="list-disc pl-6">
                  {writingFeedback.suggestions.map((s) => <li key={s}>{s}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <footer className="p-4 text-center text-xs opacity-80">© {new Date().getFullYear()} ElevenEdge — Be sharp like a diamond pickaxe! ⛏️</footer>
    </main>
  );
}
