// app/page.tsx — 11+ Quiz + Writing (Typing & Paper) with Expanded English coverage
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/** ------------------- Types ------------------- */
type Subject = "maths" | "english" | "vr" | "nvr" | "reasoning" | "writing";
type Mode = "menu" | "quiz" | "results" | "writing" | "writingResults" | "writingPaper" | "writingPaperResults";

type SvgOption = {
  kind: "shape" | "arrow" | "dots";
  shape?: "triangle" | "square" | "circle" | "diamond";
  fill: "black" | "white";
  rotation?: number;
  size?: number;
  count?: number;
  label?: string;
};

type Question = {
  id: string;
  subject: Exclude<Subject, "reasoning" | "writing">;
  stem: string;
  choices: string[];
  answerIndex: number;
  explanation?: string;
  svgOptions?: SvgOption[];
};

type AnswerRec = { qid: string; choice: number; correct: boolean };

type WritingPrompt = {
  id: string;
  type: "narrative" | "descriptive" | "persuasive" | "recount" | "letter" | "report";
  text: string;
  hint?: string;
  kent_style?: boolean;
};

/** ------------------- Config ------------------- */
const QUESTION_COUNT: Record<Exclude<Subject, "writing">, number> = {
  maths: 12,
  english: 12,
  vr: 10,
  nvr: 8,
  reasoning: 12,
};
const QUIZ_SECONDS = 10 * 60;
const DAILY_CAP_SECONDS = 30 * 60;
const WRITING_SECONDS_DEFAULT = 40 * 60;

/** ------------------- Time helpers ------------------- */
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

/** ------------------- Utils ------------------- */
function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function uniqueBy<T>(arr: T[], key: (x: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of arr) {
    const k = key(it).trim().toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(it);
    }
  }
  return out;
}
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** ------------------- UI bits ------------------- */
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
function BlockButton(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
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

/** ------------------- SVG helpers (NVR) ------------------- */
function SvgShape({ opt }: { opt: SvgOption }) {
  const size = opt.size ?? 64;
  const stroke = "#333";
  const fill = opt.fill === "black" ? "#333" : "#fff";
  if (opt.kind === "arrow") {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: `rotate(${opt.rotation ?? 0}deg)` }}>
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill={fill} stroke={stroke} />
          </marker>
        </defs>
        <line x1="10" y1="50" x2="80" y2="50" stroke={stroke} strokeWidth="8" markerEnd="url(#arrowhead)" />
      </svg>
    );
  }
  if (opt.kind === "dots") {
    const n = opt.count ?? 3;
    const r = 6;
    const gap = 20;
    const cols = 4;
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        {Array.from({ length: n }).map((_, i) => {
          const row = Math.floor(i / cols);
          const col = i % cols;
          const cx = 20 + col * gap;
          const cy = 20 + row * gap;
          return <circle key={i} cx={cx} cy={cy} r={r} fill="#333" />;
        })}
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: `rotate(${opt.rotation ?? 0}deg)` }}>
      {opt.shape === "square" && <rect x="20" y="20" width="60" height="60" fill={fill} stroke="#333" strokeWidth="4" />}
      {opt.shape === "circle" && <circle cx="50" cy="50" r="30" fill={fill} stroke="#333" strokeWidth="4" />}
      {opt.shape === "triangle" && <polygon points="50,20 20,80 80,80" fill={fill} stroke="#333" strokeWidth="4" />}
      {opt.shape === "diamond" && <polygon points="50,15 15,50 50,85 85,50" fill={fill} stroke="#333" strokeWidth="4" />}
    </svg>
  );
}
function SvgOptionButton({ opt, onClick, label }: { opt: SvgOption; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        display: "grid",
        placeItems: "center",
        padding: 8,
        borderRadius: 12,
        border: "3px solid #2f4f2f",
        background: "#eef7ea",
        cursor: "pointer",
      }}
    >
      <SvgShape opt={opt} />
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>{label}</div>
    </button>
  );
}

/** ------------------- JSON bank loading ------------------- */
type Bank = Record<"maths" | "english" | "vr" | "nvr", Question[]>;
async function loadBankFromPublic(pathRoot: string): Promise<Bank> {
  const [m, e, v, n] = await Promise.all([
    fetch(`${pathRoot}/math.json`).then((r) => r.json()).catch(() => []),
    fetch(`${pathRoot}/english.json`).then((r) => r.json()).catch(() => []),
    fetch(`${pathRoot}/vr.json`).then((r) => r.json()).catch(() => []),
    fetch(`${pathRoot}/nvr.json`).then((r) => r.json()).catch(() => []),
  ]);
  return { maths: m, english: e, vr: v, nvr: n };
}
async function loadWritingPrompts(pathRoot: string): Promise<WritingPrompt[]> {
  return fetch(`${pathRoot}/writing-prompts.json`).then((r) => r.json()).catch(() => []);
}

/** ------------------- Generators (NVR + Maths diagrams) ------------------- */
function genNvrSvg(count: number): Question[] {
  const shapes: Required<SvgOption>["shape"][] = ["triangle", "square", "circle", "diamond"];
  const out: Question[] = [];
  for (let i = 0; i < count; i++) {
    const mode = pick(["fill", "rotation", "size", "count"]);
    if (mode === "fill") {
      const common: "black" | "white" = Math.random() < 0.5 ? "black" : "white";
      const odd = common === "black" ? "white" : "black";
      const options = [
        { kind: "shape", shape: pick(shapes), fill: common },
        { kind: "shape", shape: pick(shapes), fill: common },
        { kind: "shape", shape: pick(shapes), fill: common },
        { kind: "shape", shape: pick(shapes), fill: odd },
      ] as SvgOption[];
      const order = shuffle([0, 1, 2, 3]);
      out.push({
        id: `nvr-fill-${i}-${common}`,
        subject: "nvr",
        stem: "Which is the odd one out? (by shading)",
        choices: ["A", "B", "C", "D"],
        answerIndex: order.indexOf(3),
        svgOptions: order.map((x) => options[x]),
        explanation: `Three are ${common}-filled; one is ${odd}.`,
      });
    } else if (mode === "rotation") {
      const rot = pick([0, 90, 180, 270]);
      const odd = (rot + 45) % 360;
      const options = [
        { kind: "arrow", fill: "black", rotation: rot },
        { kind: "arrow", fill: "black", rotation: rot },
        { kind: "arrow", fill: "black", rotation: rot },
        { kind: "arrow", fill: "black", rotation: odd },
      ] as SvgOption[];
      const order = shuffle([0, 1, 2, 3]);
      out.push({
        id: `nvr-rot-${i}-${rot}`,
        subject: "nvr",
        stem: "Which arrow is different? (rotation)",
        choices: ["A", "B", "C", "D"],
        answerIndex: order.indexOf(3),
        svgOptions: order.map((x) => options[x]),
        explanation: `Three at ${rot}°, one at ${odd}°.`, // eslint-disable-line no-useless-escape
      });
    } else if (mode === "size") {
      const size = pick([56, 64, 72]);
      const odd = size + 16;
      const shape = pick(shapes);
      const options = [
        { kind: "shape", shape, fill: "white", size },
        { kind: "shape", shape, fill: "white", size },
        { kind: "shape", shape, fill: "white", size },
        { kind: "shape", shape, fill: "white", size: odd },
      ] as SvgOption[];
      const order = shuffle([0, 1, 2, 3]);
      out.push({
        id: `nvr-size-${i}-${shape}`,
        subject: "nvr",
        stem: "Which is the odd one out? (by size)",
        choices: ["A", "B", "C", "D"],
        answerIndex: order.indexOf(3),
        svgOptions: order.map((x) => options[x]),
        explanation: "One is larger than the other three.",
      });
    } else {
      const common = pick([3, 4, 5]);
      const odd = common + 2;
      const options = [
        { kind: "dots", fill: "black", count: common },
        { kind: "dots", fill: "black", count: common },
        { kind: "dots", fill: "black", count: common },
        { kind: "dots", fill: "black", count: odd },
      ] as SvgOption[];
      const order = shuffle([0, 1, 2, 3]);
      out.push({
        id: `nvr-count-${i}-${common}`,
        subject: "nvr",
        stem: "Which set has a different number of dots?",
        choices: ["A", "B", "C", "D"],
        answerIndex: order.indexOf(3),
        svgOptions: order.map((x) => options[x]),
        explanation: `Three show ${common} dots; one shows ${odd}.`,
      });
    }
  }
  return out;
}

function genMathGeometry(count: number): Question[] {
  const out: Question[] = [];
  for (let i = 0; i < count; i++) {
    const kind = pick(["rect-area", "tri-area", "rect-perim", "tri-perim", "angle-line", "angle-tri", "symmetry"]);
    if (kind === "rect-area") {
      const w = randInt(3, 12);
      const h = randInt(3, 12);
      const ans = w * h;
      const choices = shuffle([ans, ans + randInt(1, 5), Math.max(1, ans - randInt(1, 5)), ans + randInt(6, 10)]).map(String);
      out.push({
        id: `math-rectA-${i}-${w}x${h}`,
        subject: "maths",
        stem: "A rectangle is shown. What is its area (units²)?",
        choices,
        answerIndex: choices.indexOf(String(ans)),
        explanation: `Area = ${w} × ${h} = ${ans}.`,
      });
    } else if (kind === "tri-area") {
      const b = randInt(4, 12);
      const h = randInt(3, 10);
      const ans = 0.5 * b * h;
      const ansStr = String(Number.isInteger(ans) ? ans : Math.round(ans * 10) / 10);
      const choices = shuffle([
        ansStr,
        String(Number(ansStr) + randInt(1, 4)),
        String(Math.max(1, Number(ansStr) - randInt(1, 4))),
        String(Number(ansStr) + randInt(5, 9)),
      ]);
      out.push({
        id: `math-triA-${i}-${b}-${h}`,
        subject: "maths",
        stem: "A right triangle is shown. What is its area (units²)?",
        choices,
        answerIndex: choices.indexOf(ansStr),
        explanation: `Area = ½ × ${b} × ${h} = ${ansStr}.`,
      });
    } else if (kind === "rect-perim") {
      const w = randInt(3, 12);
      const h = randInt(3, 12);
      const ans = 2 * (w + h);
      const choices = shuffle([ans, ans + 2, Math.max(1, ans - 2), ans + 4]).map(String);
      out.push({
        id: `math-rectP-${i}-${w}x${h}`,
        subject: "maths",
        stem: "A rectangle is shown. What is its perimeter (units)?",
        choices,
        answerIndex: choices.indexOf(String(ans)),
        explanation: `Perimeter = 2×(w+h) = 2×(${w}+${h}) = ${ans}.`,
      });
    } else if (kind === "tri-perim") {
      const a = randInt(3, 10);
      const b = randInt(4, 11);
      const c = randInt(5, 12);
      const ans = a + b + c;
      const choices = shuffle([ans, ans + 1, Math.max(1, ans - 1), ans + 3]).map(String);
      out.push({
        id: `math-triP-${i}-${a}-${b}-${c}`,
        subject: "maths",
        stem: "A triangle has side lengths shown. What is its perimeter (units)?",
        choices,
        answerIndex: choices.indexOf(String(ans)),
        explanation: `Perimeter = ${a}+${b}+${c} = ${ans}.`,
      });
    } else if (kind === "angle-line") {
      const known = randInt(40, 140);
      const ans = 180 - known;
      const choices = shuffle([ans, ans + randInt(1, 5), Math.max(1, ans - randInt(1, 5)), known]).map(String);
      out.push({
        id: `math-angL-${i}-${known}`,
        subject: "maths",
        stem: "Angles on a straight line add to 180°. Find the missing angle.",
        choices,
        answerIndex: choices.indexOf(String(ans)),
        explanation: `180° − ${known}° = ${ans}°.`, // eslint-disable-line no-useless-escape
      });
    } else if (kind === "angle-tri") {
      const a = randInt(30, 80);
      const b = randInt(30, 80);
      const ans = 180 - a - b;
      const choices = shuffle([ans, ans + randInt(1, 4), Math.max(1, ans - randInt(1, 4)), a]).map(String);
      out.push({
        id: `math-angT-${i}-${a}-${b}`,
        subject: "maths",
        stem: "Angles in a triangle add to 180°. Find the missing angle.",
        choices,
        answerIndex: choices.indexOf(String(ans)),
        explanation: `180° − ${a}° − ${b}° = ${ans}°.`, // eslint-disable-line no-useless-escape
      });
    } else {
      const shape = pick(["square", "rectangle", "isosceles triangle"]);
      const ans = shape === "square" ? 4 : shape === "rectangle" ? 2 : 1;
      const choices = shuffle([ans, ans + 1, Math.max(0, ans - 1), ans + 2]).map(String);
      out.push({
        id: `math-symm-${i}-${shape.replace(" ", "_")}`,
        subject: "maths",
        stem: `How many lines of symmetry does a ${shape} have?`,
        choices,
        answerIndex: choices.indexOf(String(ans)),
        explanation: `${shape} has ${ans} line(s) of symmetry.`,
      });
    }
  }
  return out;
}

/** ------------------- Maths diagrams ------------------- */
function MathsDiagram({ qid }: { qid: string }) {
  if (qid.startsWith("math-rectA-") || qid.startsWith("math-rectP-")) {
    const dims = qid.split("-")[3];
    const [wStr, hStr] = dims.split("x");
    const w = parseInt(wStr, 10);
    const h = parseInt(hStr, 10);
    return (
      <svg width="240" height="150" viewBox="0 0 240 150">
        <rect x="40" y="30" width="150" height="80" fill="#fff" stroke="#333" strokeWidth="4" />
        <text x="115" y="22" textAnchor="middle" fontSize="14" fill="#333">
          w = {w}
        </text>
        <text x="198" y="70" textAnchor="middle" transform="rotate(90 198 70)" fontSize="14" fill="#333">
          h = {h}
        </text>
      </svg>
    );
  }
  if (qid.startsWith("math-triA-")) {
    const parts = qid.split("-");
    const b = parseInt(parts[3], 10);
    const h = parseInt(parts[4], 10);
    return (
      <svg width="240" height="170" viewBox="0 0 240 170">
        <polygon points="40,140 200,140 40,40" fill="#fff" stroke="#333" strokeWidth="4" />
        <line x1="40" y1="140" x2="200" y2="140" stroke="#333" strokeWidth="2" />
        <line x1="40" y1="140" x2="40" y2="40" stroke="#333" strokeWidth="2" />
        <rect x="40" y="130" width="10" height="10" fill="#fff" stroke="#333" strokeWidth="2" />
        <text x="120" y="158" textAnchor="middle" fontSize="14" fill="#333">
          base = {b}
        </text>
        <text x="24" y="85" textAnchor="middle" transform="rotate(-90 24 85)" fontSize="14" fill="#333">
          height = {h}
        </text>
      </svg>
    );
  }
  if (qid.startsWith("math-triP-")) {
    const parts = qid.split("-");
    const a = parseInt(parts[3], 10);
    const b = parseInt(parts[4], 10);
    const c = parseInt(parts[5], 10);
    return (
      <svg width="240" height="170" viewBox="0 0 240 170">
        <polygon points="60,140 180,140 120,50" fill="#fff" stroke="#333" strokeWidth="4" />
        <text x="120" y="155" textAnchor="middle" fontSize="14" fill="#333">
          {a}+{b}+{c}
        </text>
      </svg>
    );
  }
  if (qid.startsWith("math-angL-")) {
    const known = parseInt(qid.split("-")[3], 10);
    return (
      <svg width="260" height="120" viewBox="0 0 260 120">
        <line x1="30" y1="80" x2="230" y2="80" stroke="#333" strokeWidth="4" />
        <line x1="130" y1="80" x2="80" y2="40" stroke="#333" strokeWidth="4" />
        <text x="90" y="48" fontSize="14" fill="#333">
          {known}°
        </text>
        <text x="180" y="70" fontSize="14" fill="#333">
          ?
        </text>
      </svg>
    );
  }
  if (qid.startsWith("math-angT-")) {
    const parts = qid.split("-");
    const a = parseInt(parts[3], 10);
    const b = parseInt(parts[4], 10);
    return (
      <svg width="240" height="170" viewBox="0 0 240 170">
        <polygon points="40,140 200,140 120,40" fill="none" stroke="#333" strokeWidth="4" />
        <text x="55" y="130" fontSize="14" fill="#333">
          {a}°
        </text>
        <text x="180" y="130" fontSize="14" fill="#333">
          {b}°
        </text>
        <text x="120" y="80" fontSize="14" fill="#333">
          ?
        </text>
      </svg>
    );
  }
  return null;
}

/** ------------------- English Generators (Expanded) ------------------- */
function genEnglishSynonyms(count = 4): Question[] {
  const pairs = [
    ["happy", "cheerful"],
    ["angry", "furious"],
    ["small", "tiny"],
    ["fast", "quick"],
    ["eager", "keen"],
    ["brave", "courageous"],
  ] as const;
  const qs: Question[] = [];
  for (let i = 0; i < count; i++) {
    const [w, syn] = pick(pairs);
    const wrongs = ["tired", "worried", "reluctant", "slow", "large", "dull"];
    const choices = shuffle([syn, ...shuffle(wrongs).slice(0, 3)]);
    qs.push({
      id: `eng-syn-${i}-${w}`,
      subject: "english",
      stem: `Choose the best synonym for '${w}':`,
      choices,
      answerIndex: choices.indexOf(syn),
      explanation: `'${syn}' is closest in meaning to '${w}'.`,
    });
  }
  return qs;
}

function genEnglishPrefixes(count = 3): Question[] {
  const meanings = {
    un: "not/undo",
    re: "again",
    dis: "not/opposite",
    mis: "wrongly",
    pre: "before",
  } as const;
  type Prefix = keyof typeof meanings;
  const prefixes = Object.keys(meanings) as Prefix[];
  const roots = ["do", "place", "cover", "lead", "read"] as const;
  const qs: Question[] = [];
  for (let i = 0; i < count; i++) {
    const p = pick(prefixes);
    const r = pick(roots);
    const word = `${p}${r}`;
    const correct = meanings[p];
    const others = ["together", "after", "without"];
    const choices = shuffle([correct, ...others]);
    qs.push({
      id: `eng-pre-${i}-${word}`,
      subject: "english",
      stem: `What does the prefix in '${word}' mean?`,
      choices,
      answerIndex: choices.indexOf(correct),
      explanation: `'${p}-' means ${correct}.`,
    });
  }
  return qs;
}

function genEnglishSuffixes(count = 3): Question[] {
  const bases = [
    ["happy", "happiness"],
    ["kind", "kindness"],
    ["hope", "hopeful"],
    ["care", "careless"],
    ["run", "runner"],
  ] as const;
  const qs: Question[] = [];
  for (let i = 0; i < count; i++) {
    const [base, derived] = pick(bases);
    const suffix = derived.substring(base.length);
    const wrongs = ["ing", "ed", "ful", "ness", "less", "er"].filter((s) => s !== suffix);
    const choices = shuffle([suffix, ...shuffle(wrongs).slice(0, 3)]);
    qs.push({
      id: `eng-suf-${i}-${base}`,
      subject: "english",
      stem: `Which suffix correctly forms a new word from '${base}'?`,
      choices,
      answerIndex: choices.indexOf(suffix),
      explanation: `Adding '${suffix}' to '${base}' makes '${derived}'.`,
    });
  }
  return qs;
}

function genEnglishHomophones(count = 3): Question[] {
  const sets = [
    { sentence: "I left my book over ____.", correct: "there", wrongs: ["their", "they're", "thare"] },
    { sentence: "She said ____ going to the park.", correct: "they're", wrongs: ["there", "their", "thier"] },
    { sentence: "This is ____ dog.", correct: "their", wrongs: ["there", "they're", "thier"] },
    { sentence: "I would like ____ help with this.", correct: "your", wrongs: ["you're", "yore", "yours"] },
    { sentence: "I think ____ very kind.", correct: "you're", wrongs: ["your", "yore", "they're"] },
  ] as const;
  const qs: Question[] = [];
  for (let i = 0; i < count; i++) {
    const s = pick(sets);
    const choices = shuffle([s.correct, ...s.wrongs]);
    qs.push({
      id: `eng-homo-${i}`,
      subject: "english",
      stem: s.sentence,
      choices,
      answerIndex: choices.indexOf(s.correct),
      explanation: `Correct answer is '${s.correct}'.`,
    });
  }
  return qs;
}

function genEnglishGrammar(count = 3): Question[] {
  const stems = [
    { question: "Which sentence is correct?", correct: "She runs quickly.", wrongs: ["She run quickly.", "She running quickly.", "She is run quickly."] },
    { question: "Choose the sentence with correct punctuation.", correct: "It's raining outside.", wrongs: ["Its raining outside.", "Its' raining outside.", "It raining outside."] },
    { question: "Which is the adjective in: 'The tall tree swayed.'?", correct: "tall", wrongs: ["tree", "swayed", "the"] },
  ] as const;
  const qs: Question[] = [];
  for (let i = 0; i < count; i++) {
    const item = pick(stems);
    const choices = shuffle([item.correct, ...item.wrongs]);
    qs.push({
      id: `eng-gram-${i}`,
      subject: "english",
      stem: item.question,
      choices,
      answerIndex: choices.indexOf(item.correct),
      explanation: `Correct: '${item.correct}'.`,
    });
  }
  return qs;
}

function genEnglishCloze(count = 2): Question[] {
  const texts = [
    { stem: "It was a ____ day and the children were excited to play outside.", correct: "sunny", wrongs: ["sonny", "sunni", "snowy"] },
    { stem: "She ____ to the shop to buy some bread.", correct: "went", wrongs: ["gone", "goes", "was"] },
    { stem: "They decided to ____ a film together.", correct: "watch", wrongs: ["washing", "witch", "walk"] },
  ] as const;
  const qs: Question[] = [];
  for (let i = 0; i < count; i++) {
    const t = pick(texts);
    const choices = shuffle([t.correct, ...t.wrongs]);
    qs.push({
      id: `eng-cloze-${i}`,
      subject: "english",
      stem: t.stem,
      choices,
      answerIndex: choices.indexOf(t.correct),
      explanation: `Best fit: '${t.correct}'.`,
    });
  }
  return qs;
}

function buildEnglishBank(): Question[] {
  return [
    ...genEnglishSynonyms(4),
    ...genEnglishPrefixes(3),
    ...genEnglishSuffixes(3),
    ...genEnglishHomophones(3),
    ...genEnglishGrammar(3),
    ...genEnglishCloze(2),
  ];
}

/** ------------------- Writing helpers ------------------- */
function countWords(s: string) { return (s.trim().match(/\b[\w'-]+\b/g) || []).length; }
function sentencesList(s: string) { return (s.trim().match(/[^.!?]+[.!?]+/g) || []).map((x) => x.trim()); }
function typeTokenRatio(s: string) { const words = (s.toLowerCase().match(/\b[a-z']+\b/g) || []); const set = new Set(words); return words.length ? set.size / words.length : 0; }
function estimateReadingAge(s: string) { const words = (s.match(/\b[\w'-]+\b/g) || []).length; const sentencesN = sentencesList(s).length || 1; const syllables = (s.toLowerCase().match(/[aeiouy]{1,2}/g) || []).length; const fk = 0.39 * (words / sentencesN) + 11.8 * (syllables / Math.max(1, words)) - 15.59; return Math.max(6, Math.round(fk)); }
type WritingReport = { score: number; band: "Developing" | "Secure" | "Strong"; notes: string[]; metrics: { words: number; sentences: number; ttr: number; readingAge: number; spellingFlags: number } };
function assessWriting(s: string): WritingReport {
  const w = countWords(s); const sens = sentencesList(s).length; const ttr = typeTokenRatio(s); const ra = estimateReadingAge(s); const spellingFlags = (s.match(/\b(i)\b/g) || []).length;
  let score = 0; const notes: string[] = [];
  if (w < 120) { notes.push("Try to write more than a short paragraph (aim 250–450 words)."); }
  else if (w < 220) { notes.push("Add more detail to reach around 250–450 words."); score += 1; }
  else if (w <= 500) { notes.push("Good length for 11+: around 250–450 words."); score += 2; }
  else { notes.push("Consider trimming to stay concise (under ~500 words)."); score += 1; }
  if (sens < 6) { notes.push("Try more sentences and vary openings/connectives."); } else { notes.push("Nice number of sentences; vary lengths for flow."); score += 1; }
  if (ttr > 0.5) { notes.push("Great variety of vocabulary."); score += 2; } else if (ttr > 0.4) { notes.push("Decent word variety."); score += 1; } else { notes.push("Try not to repeat words; use precise vocabulary."); }
  if (spellingFlags > 0) { notes.push("Watch out for capital 'I' — use uppercase when it stands alone."); }
  notes.push("Make sure you have a clear beginning, middle and end.");
  const band = score >= 5 ? "Strong" : score >= 3 ? "Secure" : "Developing";
  return { score, band, notes, metrics: { words: w, sentences: sens, ttr, readingAge: ra, spellingFlags } };
}

/** ------------------- Page ------------------- */
export default function Page() {
  const [mode, setMode] = useState<Mode>("menu");
  const [subject, setSubject] = useState<Subject | null>(null);
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(QUIZ_SECONDS);
  const [answers, setAnswers] = useState<AnswerRec[]>([]);
  const [dailyUsed, setDailyUsed] = useState(0);
  const [paused, setPaused] = useState(false);

  const [bank, setBank] = useState<Bank>({ maths: [], english: [], vr: [], nvr: [] });
  const [questions, setQuestions] = useState<Question[]>([]);

  const [prompts, setPrompts] = useState<WritingPrompt[]>([]);
  const [writing, setWriting] = useState<string>("");
  const [writingPrompt, setWritingPrompt] = useState<WritingPrompt | null>(null);
  const [writingTimeChoice, setWritingTimeChoice] = useState<number>(WRITING_SECONDS_DEFAULT);
  const [writingTime, setWritingTime] = useState<number>(WRITING_SECONDS_DEFAULT);

  useEffect(() => {
    (async () => {
      const loaded = await loadBankFromPublic("/questions").catch(() => ({ maths: [], english: [], vr: [], nvr: [] } as Bank));
      setBank(loaded);
      const wp = await loadWritingPrompts("/questions").catch(() => []);
      setPrompts(wp);
      setDailyUsed(getUsedSecondsToday());
    })();
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
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [mode, paused, secondsLeft, endQuiz]);

  useEffect(() => {
    if (!(mode === "writing" || mode === "writingPaper") || paused) return;
    if (writingTime <= 0) { setMode(mode === "writing" ? "writingResults" : "writingPaperResults"); return; }
    const t = setTimeout(() => setWritingTime((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [mode, paused, writingTime]);

  const canStart = dailyUsed < DAILY_CAP_SECONDS;
  const remainingToday = Math.max(0, DAILY_CAP_SECONDS - dailyUsed);

  function buildQuizSet(subj: Exclude<Subject, "writing">, count: number): Question[] {
    if (subj === "reasoning") {
      const pool = shuffle([...(bank.vr || []), ...(bank.nvr || []), ...genNvrSvg(Math.max(12, Math.ceil(count / 2) + 6))]);
      let uniq = uniqueBy(pool, (q) => q.stem).slice(0, count);
      if (uniq.length < count) uniq = uniqueBy([...pool, ...genNvrSvg(count + 6)], (q) => q.stem).slice(0, count);
      return uniq;
    }
    if (subj === "english") {
      const generated = buildEnglishBank();
      const pool = shuffle([...(bank.english || []), ...generated]);
      let uniq = uniqueBy(pool, (q) => q.stem).slice(0, count);
      if (uniq.length < count) uniq = uniqueBy([...pool, ...generated], (q) => q.stem).slice(0, count);
      return uniq;
    }
    const core = bank[subj] || [];
    const generated = subj === "nvr" ? genNvrSvg(Math.max(12, count + 6)) : subj === "maths" ? genMathGeometry(Math.max(16, Math.ceil(count))) : [];
    const pool = shuffle([...core, ...generated]);
    let uniq = uniqueBy(pool, (q) => q.stem).slice(0, count);
    if (uniq.length < count) uniq = uniqueBy([...core, ...generated, ...pool], (q) => q.stem).slice(0, count);
    return uniq;
  }

  function startQuiz(subj: Exclude<Subject, "writing">) {
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
    setAnswers((prev) => [...prev, { qid: q.id, choice: choiceIndex, correct }]);
    if (index + 1 < questions.length) setIndex((i) => i + 1);
    else finishNow();
  }
  function finishNow() { endQuiz(); }

  function startWritingTyping() {
    if (!canStart) return;
    const p = pick(prompts.length ? prompts : [{ id: "fallback", type: "narrative", text: "Write a story that begins with: 'The door creaked open...'", kent_style: true }]);
    setSubject("writing");
    setWriting("");
    setWritingPrompt(p);
    setWritingTime(Math.min(writingTimeChoice, remainingToday));
    setPaused(false);
    setMode("writing");
  }
  function startWritingPaper() {
    if (!canStart) return;
    const p = pick(prompts.length ? prompts : [{ id: "fallback", type: "narrative", text: "Write a story that begins with: 'The door creaked open...'", kent_style: true }]);
    setSubject("writing");
    setWritingPrompt(p);
    setWritingTime(Math.min(writingTimeChoice, remainingToday));
    setPaused(false);
    setMode("writingPaper");
  }

  const current = questions[index] || null;

  const writingMetrics = useMemo(() => ({ words: countWords(writing), sentences: sentencesList(writing).length, readingAge: estimateReadingAge(writing) }), [writing]);
  const writingReport = useMemo(() => (mode === "writingResults" ? assessWriting(writing) : null), [mode, writing]);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#c8e6c9,#a5d6a7)", color: "#20351f", padding: 24, boxSizing: "border-box" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gap: 16 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, textShadow: "2px 2px #8fbf7a", marginBottom: 8 }}>11+ Adventure — Quiz &amp; Writing</h1>
        <div style={{ opacity: 0.8, fontSize: 14, marginBottom: 8 }}>Minecraft-inspired • Kent/Bexley • 10-min quizzes • 30-min daily cap • Writing task</div>

        {mode === "menu" && (
          <Card>
            <div style={{ display: "grid", gap: 12 }}>
              {!canStart && (
                <div style={{ padding: 12, borderRadius: 10, background: "#ffe8d2", border: "2px solid #cc8a4a" }}>
                  <div style={{ fontWeight: 700 }}>Daily time done — amazing work!</div>
                  <div>You&apos;ve reached 30 minutes today. Come back tomorrow. 💚</div>
                </div>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                <BlockButton disabled={!canStart} onClick={() => startQuiz("maths")}>Maths</BlockButton>
                <BlockButton disabled={!canStart} onClick={() => startQuiz("english")}>English</BlockButton>
                <BlockButton disabled={!canStart} onClick={() => startQuiz("vr")}>VR</BlockButton>
                <BlockButton disabled={!canStart} onClick={() => startQuiz("nvr")}>NVR</BlockButton>
                <BlockButton disabled={!canStart} onClick={startWritingTyping} style={{ background: "#9ad27a" }}>Writing (Typing)</BlockButton>
                <BlockButton disabled={!canStart} onClick={startWritingPaper} style={{ background: "#9ad27a" }}>Writing (Paper Mode)</BlockButton>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>Writing time:</span>
                <BlockButton onClick={() => setWritingTimeChoice(30 * 60)} style={{ background: writingTimeChoice === 30 * 60 ? "#6fc15c" : "#bfe3b5" }}>30m</BlockButton>
                <BlockButton onClick={() => setWritingTimeChoice(40 * 60)} style={{ background: writingTimeChoice === 40 * 60 ? "#6fc15c" : "#bfe3b5" }}>40m</BlockButton>
                <Pill>Selected: {Math.floor(writingTimeChoice / 60)}m</Pill>
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
                  <Pill>Time: {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}</Pill>
                  <BlockButton onClick={() => setPaused((p) => !p)} style={{ background: paused ? "#d9c267" : "#9ad27a" }}>{paused ? "Resume" : "Pause"}</BlockButton>
                  <BlockButton onClick={() => { if (confirm("End this quiz now and see your score?")) finishNow(); }} style={{ background: "#f3a09a" }}>End quiz</BlockButton>
                </div>
              </div>

              <div style={{ fontSize: 20, fontWeight: 700 }}>{current.stem}</div>

              <div style={{ display: "grid", gap: 10, gridTemplateColumns: current.svgOptions ? "repeat(auto-fit, minmax(120px, 1fr))" : "1fr" }}>
                {current.svgOptions
                  ? current.svgOptions.map((opt, i) => <SvgOptionButton key={i} opt={opt} label={current.choices[i] || `Option ${i + 1}`} onClick={() => answer(i)} />)
                  : current.choices.map((c, i) => (<BlockButton key={i} onClick={() => answer(i)}>{c}</BlockButton>))}
              </div>
            </div>
          </Card>
        )}

        {mode === "results" && (
          <Card>
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#9ad27a", border: "4px solid #2f4f2f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800 }}>
                  {answers.filter((a) => a.correct).length}/{questions.length}
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>Results</div>
                  <div style={{ opacity: 0.8, fontSize: 13 }}>Great effort! You scored {answers.filter((a) => a.correct).length} out of {questions.length}.</div>
                </div>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {questions.map((q, i) => {
                  const a = answers[i];
                  const verdict = a?.correct ? "✅ Correct" : "❌ Incorrect";
                  return (
                    <div key={q.id} style={{ border: "2px solid #6f9e63", borderRadius: 10, padding: 12, background: "#eef7ea" }}>
                      <div style={{ fontWeight: 700 }}>Q{i + 1}. {q.stem}</div>
                      <div style={{ fontSize: 14 }}>Your answer: <strong>{typeof a?.choice === "number" ? q.choices[a.choice] : "—"}</strong> • Correct: <strong>{q.choices[q.answerIndex]}</strong> • {verdict}</div>
                      {q.explanation && <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>Explanation: {q.explanation}</div>}
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <BlockButton onClick={() => setMode("menu")}>Back to Menu</BlockButton>
                <BlockButton onClick={() => subject && startQuiz(subject as Exclude<Subject, "writing">)}>Try another {subject ?? ""}</BlockButton>
              </div>
            </div>
          </Card>
        )}

        {mode === "writing" && writingPrompt && (
          <Card>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <Pill>Writing (Typing)</Pill>
                  <Pill>Time: {Math.floor(writingTime / 60)}:{String(writingTime % 60).padStart(2, "0")}</Pill>
                  <Pill>Words: {writingMetrics.words}</Pill>
                  <Pill>Sentences: {writingMetrics.sentences}</Pill>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <BlockButton onClick={() => setPaused((p) => !p)} style={{ background: paused ? "#d9c267" : "#9ad27a" }}>{paused ? "Resume" : "Pause"}</BlockButton>
                  <BlockButton onClick={() => { if (confirm("Finish writing and view feedback?")) setMode("writingResults"); }} style={{ background: "#f3a09a" }}>Finish</BlockButton>
                </div>
              </div>

              <div style={{ fontSize: 18, fontWeight: 800 }}>{writingPrompt.text}</div>
              {writingPrompt.hint && <div style={{ fontSize: 14, opacity: 0.8 }}>Hint: {writingPrompt.hint}</div>}
              <div style={{ fontSize: 12, opacity: 0.75 }}>Guidance: aim for ~250–450 words. Keep focus and organise paragraphs.</div>

              <textarea
                value={writing}
                onChange={(e) => setWriting(e.target.value)}
                rows={16}
                style={{ width: "100%", padding: 12, border: "3px solid #2f4f2f", borderRadius: 12, background: "#fffef9", fontSize: 16, lineHeight: 1.5 }}
                placeholder="Plan for 5–10 minutes, then write your piece. No autocorrect is enabled so spelling can be assessed."
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                aria-label="Writing response"
              />
            </div>
          </Card>
        )}

        {mode === "writingResults" && writingReport && (
          <Card>
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#9ad27a", border: "4px solid #2f4f2f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800 }}>{writingReport.band}</div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>Writing feedback</div>
                  <div style={{ opacity: 0.8, fontSize: 13 }}>Score: {writingReport.score} • Words: {writingReport.metrics.words} • Sentences: {writingReport.metrics.sentences} • Reading age≈ {writingReport.metrics.readingAge}+</div>
                </div>
              </div>

              <ul style={{ marginLeft: 18 }}>{writingReport.notes.map((n, i) => (<li key={i} style={{ marginBottom: 6 }}>{n}</li>))}</ul>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <BlockButton onClick={() => setMode("menu")}>Back to Menu</BlockButton>
                <BlockButton onClick={startWritingTyping}>Try another Writing prompt</BlockButton>
              </div>
            </div>
          </Card>
        )}

        {mode === "writingPaper" && writingPrompt && (
          <Card>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <Pill>Writing (Paper Mode)</Pill>
                  <Pill>Time: {Math.floor(writingTime / 60)}:{String(writingTime % 60).padStart(2, "0")}</Pill>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <BlockButton onClick={() => setPaused((p) => !p)} style={{ background: paused ? "#d9c267" : "#9ad27a" }}>{paused ? "Resume" : "Pause"}</BlockButton>
                  <BlockButton onClick={() => { if (confirm("Finish the paper-mode timer and show checklist?")) setMode("writingPaperResults"); }} style={{ background: "#f3a09a" }}>Finish</BlockButton>
                </div>
              </div>

              <div style={{ fontSize: 18, fontWeight: 800 }}>{writingPrompt.text}</div>
              {writingPrompt.hint && <div style={{ fontSize: 14, opacity: 0.8 }}>Hint: {writingPrompt.hint}</div>}
              <div style={{ fontSize: 12, opacity: 0.75 }}>Use your own paper. Plan ~5–10 minutes; write ~25–30 minutes. Keep to ~250–450 words.</div>

              <div style={{ padding: 12, border: "2px dashed #5a8151", borderRadius: 12, background: "#f7fff2" }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Paper Mode</div>
                <div style={{ fontSize: 14, opacity: 0.85 }}>Write by hand. When you are done, press &quot;Finish&quot; to view a quick self-review checklist.</div>
              </div>
            </div>
          </Card>
        )}

        {mode === "writingPaperResults" && (
          <Card>
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>Paper Mode — Self-review checklist</div>
                <div style={{ opacity: 0.8, fontSize: 13 }}>Use this checklist to improve your draft before you share it.</div>
              </div>
              <ul style={{ marginLeft: 18 }}>
                <li>Clear beginning, middle and end.</li>
                <li>Paragraphs used to organise ideas.</li>
                <li>Sentence openings vary (not always &quot;I&quot; or &quot;Then&quot;).</li>
                <li>Precise verbs and nouns; avoid repetition.</li>
                <li>Punctuation: full stops, commas, speech marks used correctly.</li>
                <li>Spelling: tricky words checked (especially homophones).</li>
                <li>Focus on the prompt throughout; avoid wandering off-topic.</li>
              </ul>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <BlockButton onClick={() => setMode("menu")}>Back to Menu</BlockButton>
                <BlockButton onClick={startWritingPaper}>Try another Writing prompt</BlockButton>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
