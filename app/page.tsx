// app/page.tsx — Advanced: SVG NVR & Maths diagrams + mixed "Reasoning" quiz
"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type Subject = "maths" | "english" | "vr" | "nvr" | "reasoning";
type Mode = "menu" | "quiz" | "results";

type SvgOption = {
  kind: "shape" | "arrow" | "dots";
  shape?: "triangle" | "square" | "circle" | "diamond";
  fill: "black" | "white";
  rotation?: number; // degrees for arrows/diamonds/triangles
  size?: number; // px
  count?: number; // for 'dots'
  label?: string; // accessible label
};

type Question = {
  id: string;
  subject: Exclude<Subject, "reasoning">; // stored as core subject; reasoning mixes vr+nvr
  stem: string;
  choices: string[];             // text labels; for SVG, we show ["A","B","C","D"]
  answerIndex: number;
  explanation?: string;
  svgOptions?: SvgOption[];      // if present, render visuals for options
};

type AnswerRec = { qid: string; choice: number; correct: boolean };

/** Configurable counts **/
const QUESTION_COUNT: Record<Subject, number> = {
  maths: 12,
  english: 10,
  vr: 10,
  nvr: 8,
  reasoning: 12, // mixed VR + NVR
};
const QUIZ_SECONDS = 10 * 60;
const DAILY_CAP_SECONDS = 30 * 60;

/** Time tracking **/
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
function shuffle<T>(arr: T[]) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function uniqueBy<T>(arr: T[], key: (x: T) => string) { const seen = new Set<string>(); const out: T[] = []; for (const it of arr) { const k = key(it).trim().toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(it); } } return out; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick<T>(arr: T[]) { return arr[Math.floor(Math.random() * arr.length)]; }

/** UI building blocks **/
function Card({ children }: { children: ReactNode }) {
  return <div style={{ borderRadius: 16, border: "4px solid #3b3b3b", boxShadow: "0 8px 24px rgba(0,0,0,0.1)", padding: 16, background: "linear-gradient(135deg,#e8f7e8,#d4eed4)" }}>{children}</div>;
}
function BlockButton(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  const { children, style, ...rest } = props;
  return <button {...rest} style={{ padding: "12px 16px", borderRadius: 12, border: "4px solid #2f4f2f", boxShadow: "0 2px 0 rgba(0,0,0,0.15)", background: "#7cc76b", fontWeight: 700, letterSpacing: 0.2, cursor: "pointer", ...(style || {}) }}>{children}</button>;
}
function Pill({ children }: { children: ReactNode }) {
  return <span style={{ display: "inline-block", padding: "6px 12px", borderRadius: 999, background: "#cfe9c9", border: "1px solid #5a8151", fontSize: 12 }}>{children}</span>;
}

/** SVG helpers **/
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
      {opt.shape === "square" && <rect x="20" y="20" width="60" height="60" fill={fill} stroke={stroke} strokeWidth="4" />}
      {opt.shape === "circle" && <circle cx="50" cy="50" r="30" fill={fill} stroke={stroke} strokeWidth="4" />}
      {opt.shape === "triangle" && <polygon points="50,20 20,80 80,80" fill={fill} stroke={stroke} strokeWidth="4" />}
      {opt.shape === "diamond" && <polygon points="50,15 15,50 50,85 85,50" fill={fill} stroke={stroke} strokeWidth="4" />}
    </svg>
  );
}

function SvgOptionButton({ opt, onClick, label }: { opt: SvgOption; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} aria-label={label} style={{ display: "grid", placeItems: "center", padding: 8, borderRadius: 12, border: "3px solid #2f4f2f", background: "#eef7ea", cursor: "pointer" }}>
      <SvgShape opt={opt} />
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>{label}</div>
    </button>
  );
}

/** JSON bank loading **/
type Bank = Record<Exclude<Subject, "reasoning">, Question[]>;

async function loadBankFromPublic(pathRoot: string): Promise<Bank> {
  const [m, e, v, n] = await Promise.all([
    fetch(`${pathRoot}/math.json`).then((r) => r.json()).catch(() => []),
    fetch(`${pathRoot}/english.json`).then((r) => r.json()).catch(() => []),
    fetch(`${pathRoot}/vr.json`).then((r) => r.json()).catch(() => []),
    fetch(`${pathRoot}/nvr.json`).then((r) => r.json()).catch(() => []),
  ]);
  return { maths: m, english: e, vr: v, nvr: n };
}

/** NVR SVG generators **/
function genNvrSvg(count: number): Question[] {
  const shapes: SvgOption["shape"][] = ["triangle", "square", "circle", "diamond"];
  const out: Question[] = [];
  for (let i = 0; i < count; i++) {
    const mode = pick(["fill", "rotation", "size", "count"]);
    if (mode === "fill") {
      const commonFill: "black" | "white" = Math.random() < 0.5 ? "black" : "white";
      const oddFill: "black" | "white" = commonFill === "black" ? "white" : "black";
      const options: SvgOption[] = [
        { kind: "shape", shape: pick(shapes), fill: commonFill },
        { kind: "shape", shape: pick(shapes), fill: commonFill },
        { kind: "shape", shape: pick(shapes), fill: commonFill },
        { kind: "shape", shape: pick(shapes), fill: oddFill },
      ];
      const order = shuffle([0, 1, 2, 3]);
      out.push({
        id: `nvr-fill-${i}-${commonFill}`,
        subject: "nvr",
        stem: "Which is the odd one out? (by shading)",
        choices: ["A", "B", "C", "D"],
        answerIndex: order.indexOf(3),
        svgOptions: order.map(idx => options[idx]),
        explanation: `Three are ${commonFill}-filled; one is ${oddFill}.`,
      });
    } else if (mode === "rotation") {
      const rot = pick([0, 90, 180, 270]);
      const oddRot = (rot + 45) % 360;
      const options: SvgOption[] = [
        { kind: "arrow", fill: "black", rotation: rot },
        { kind: "arrow", fill: "black", rotation: rot },
        { kind: "arrow", fill: "black", rotation: rot },
        { kind: "arrow", fill: "black", rotation: oddRot },
      ];
      const order = shuffle([0, 1, 2, 3]);
      out.push({
        id: `nvr-rot-${i}-${rot}`,
        subject: "nvr",
        stem: "Which arrow is different? (rotation)",
        choices: ["A", "B", "C", "D"],
        answerIndex: order.indexOf(3),
        svgOptions: order.map(idx => options[idx]),
        explanation: `Three are at ${rot}°, one at ${oddRot}°.`,
      });
    } else if (mode === "size") {
      const commonSize = pick([56, 64, 72]);
      const oddSize = commonSize + 16;
      const shape = pick(shapes);
      const options: SvgOption[] = [
        { kind: "shape", shape, fill: "white", size: commonSize },
        { kind: "shape", shape, fill: "white", size: commonSize },
        { kind: "shape", shape, fill: "white", size: commonSize },
        { kind: "shape", shape, fill: "white", size: oddSize },
      ];
      const order = shuffle([0, 1, 2, 3]);
      out.push({
        id: `nvr-size-${i}-${shape}`,
        subject: "nvr",
        stem: "Which is the odd one out? (by size)",
        choices: ["A", "B", "C", "D"],
        answerIndex: order.indexOf(3),
        svgOptions: order.map(idx => options[idx]),
        explanation: "One is larger than the other three.",
      });
    } else { // count
      const common = pick([3,4,5]);
      const odd = common + 2;
      const options: SvgOption[] = [
        { kind: "dots", fill: "black", count: common },
        { kind: "dots", fill: "black", count: common },
        { kind: "dots", fill: "black", count: common },
        { kind: "dots", fill: "black", count: odd },
      ];
      const order = shuffle([0, 1, 2, 3]);
      out.push({
        id: `nvr-count-${i}-${common}`,
        subject: "nvr",
        stem: "Which set has a different number of dots?",
        choices: ["A", "B", "C", "D"],
        answerIndex: order.indexOf(3),
        svgOptions: order.map(idx => options[idx]),
        explanation: `Three options show ${common} dots; one shows ${odd}.`,
      });
    }
  }
  return out;
}

/** Maths generators (diagrams + properties) **/
function genMathGeometry(count: number): Question[] {
  const out: Question[] = [];
  for (let i = 0; i < count; i++) {
    const kind = pick(["rect-area", "tri-area", "rect-perim", "tri-perim", "angle-line", "angle-tri", "symmetry"]);
    if (kind === "rect-area") {
      const w = randInt(3, 12), h = randInt(3, 12);
      const ans = w * h;
      const choices = shuffle([ans, ans + randInt(1, 5), Math.max(1, ans - randInt(1, 5)), ans + randInt(6, 10)]).map(String);
      out.push({ id: `math-rectA-${i}-${w}x${h}`, subject: "maths", stem: "A rectangle is shown. What is its area (units²)?", choices, answerIndex: choices.indexOf(String(ans)), explanation: `Area = ${w} × ${h} = ${ans}.` });
    } else if (kind === "tri-area") {
      const b = randInt(4, 12), h = randInt(3, 10);
      const ans = 0.5 * b * h; const ansStr = String(Number.isInteger(ans) ? ans : Math.round(ans * 10) / 10);
      const distract = [Number(ansStr) + randInt(1, 4), Math.max(1, Number(ansStr) - randInt(1, 4)), Number(ansStr) + randInt(5, 9)].map(String);
      const choices = shuffle([ansStr, ...distract]);
      out.push({ id: `math-triA-${i}-${b}-${h}`, subject: "maths", stem: "A right triangle is shown. What is its area (units²)?", choices, answerIndex: choices.indexOf(ansStr), explanation: `Area = ½ × ${b} × ${h} = ${ansStr}.` });
    } else if (kind === "rect-perim") {
      const w = randInt(3, 12), h = randInt(3, 12);
      const ans = 2*(w+h);
      const choices = shuffle([ans, ans + 2, Math.max(1, ans - 2), ans + 4]).map(String);
      out.push({ id: `math-rectP-${i}-${w}x${h}`, subject: "maths", stem: "A rectangle is shown. What is its perimeter (units)?", choices, answerIndex: choices.indexOf(String(ans)), explanation: `Perimeter = 2×(w+h) = 2×(${w}+${h}) = ${ans}.` });
    } else if (kind === "tri-perim") {
      const a = randInt(3,10), b = randInt(4,11), c = randInt(5,12);
      const ans = a+b+c;
      const choices = shuffle([ans, ans+1, Math.max(1, ans-1), ans+3]).map(String);
      out.push({ id: `math-triP-${i}-${a}-${b}-${c}`, subject: "maths", stem: "A triangle has side lengths shown. What is its perimeter (units)?", choices, answerIndex: choices.indexOf(String(ans)), explanation: `Perimeter = ${a}+${b}+${c} = ${ans}.` });
    } else if (kind === "angle-line") {
      const known = randInt(40, 140);
      const ans = 180 - known;
      const choices = shuffle([ans, ans + randInt(1,5), Math.max(1, ans - randInt(1,5)), known]).map(String);
      out.push({ id: `math-angL-${i}-${known}`, subject: "maths", stem: "Angles on a straight line add to 180°. Find the missing angle.", choices, answerIndex: choices.indexOf(String(ans)), explanation: `180° − ${known}° = ${ans}°.` });
    } else if (kind === "angle-tri") {
      const a = randInt(30, 80), b = randInt(30, 80); const ans = 180 - a - b;
      const choices = shuffle([ans, ans + randInt(1,4), Math.max(1, ans - randInt(1,4)), a]).map(String);
      out.push({ id: `math-angT-${i}-${a}-${b}`, subject: "maths", stem: "Angles in a triangle add to 180°. Find the missing angle.", choices, answerIndex: choices.indexOf(String(ans)), explanation: `180° − ${a}° − ${b}° = ${ans}°.` });
    } else {
      const shape = pick(["square", "rectangle", "isosceles triangle"]);
      let ans = 0;
      if (shape === "square") ans = 4;
      else if (shape === "rectangle") ans = 2;
      else ans = 1;
      const choices = shuffle([ans, ans + 1, Math.max(0, ans - 1), ans + 2]).map(String);
      out.push({ id: `math-symm-${i}-${shape.replace(" ","_")}`, subject: "maths", stem: `How many lines of symmetry does a ${shape} have?`, choices, answerIndex: choices.indexOf(String(ans)), explanation: `${shape} has ${ans} line(s) of symmetry.` });
    }
  }
  return out;
}

/** Maths diagrams for specific IDs **/
function MathsDiagram({ qid }: { qid: string }) {
  if (qid.startsWith("math-rectA-") || qid.startsWith("math-rectP-")) {
    const parts = qid.split("-");
    const dims = parts[3];
    const [wStr, hStr] = dims.split("x");
    const w = parseInt(wStr, 10), h = parseInt(hStr, 10);
    return (
      <svg width="240" height="150" viewBox="0 0 240 150">
        <rect x="40" y="30" width="150" height="80" fill="#fff" stroke="#333" strokeWidth="4" />
        <text x="115" y="22" textAnchor="middle" fontSize="14" fill="#333">w = {w}</text>
        <text x="198" y="70" textAnchor="middle" transform="rotate(90 198 70)" fontSize="14" fill="#333">h = {h}</text>
      </svg>
    );
  }
  if (qid.startsWith("math-triA-")) {
    const parts = qid.split("-");
    const b = parseInt(parts[3], 10), h = parseInt(parts[4], 10);
    return (
      <svg width="240" height="170" viewBox="0 0 240 170">
        <polygon points="40,140 200,140 40,40" fill="#fff" stroke="#333" strokeWidth="4" />
        <line x1="40" y1="140" x2="200" y2="140" stroke="#333" strokeWidth="2" />
        <line x1="40" y1="140" x2="40" y2="40" stroke="#333" strokeWidth="2" />
        <rect x="40" y="130" width="10" height="10" fill="#fff" stroke="#333" strokeWidth="2" />
        <text x="120" y="158" textAnchor="middle" fontSize="14" fill="#333">base = {b}</text>
        <text x="24" y="85" textAnchor="middle" transform="rotate(-90 24 85)" fontSize="14" fill="#333">height = {h}</text>
      </svg>
    );
  }
  if (qid.startsWith("math-triP-")) {
    const parts = qid.split("-");
    const a = parseInt(parts[3],10), b = parseInt(parts[4],10), c = parseInt(parts[5],10);
    return (
      <svg width="240" height="170" viewBox="0 0 240 170">
        <polygon points="60,140 180,140 120,50" fill="#fff" stroke="#333" strokeWidth="4" />
        <text x="120" y="155" textAnchor="middle" fontSize="14" fill="#333">{a}+{b}+{c}</text>
      </svg>
    );
  }
  if (qid.startsWith("math-angL-")) {
    const known = parseInt(qid.split("-")[3],10);
    return (
      <svg width="260" height="120" viewBox="0 0 260 120">
        <line x1="30" y1="80" x2="230" y2="80" stroke="#333" strokeWidth="4" />
        <line x1="130" y1="80" x2="80" y2="40" stroke="#333" strokeWidth="4" />
        <text x="90" y="48" fontSize="14" fill="#333">{known}°</text>
        <text x="180" y="70" fontSize="14" fill="#333">?</text>
      </svg>
    );
  }
  if (qid.startsWith("math-angT-")) {
    const parts = qid.split("-");
    const a = parseInt(parts[3],10), b = parseInt(parts[4],10);
    return (
      <svg width="240" height="170" viewBox="0 0 240 170">
        <polygon points="40,140 200,140 120,40" fill="none" stroke="#333" strokeWidth="4" />
        <text x="55" y="130" fontSize="14" fill="#333">{a}°</text>
        <text x="180" y="130" fontSize="14" fill="#333">{b}°</text>
        <text x="120" y="80" fontSize="14" fill="#333">?</text>
      </svg>
    );
  }
  return null;
}

/** Page **/
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
  const lastIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    async function loadAll() {
      try {
        // Change "/questions" to "" if your JSON files sit directly under /public
        const loaded = await loadBankFromPublic("/questions");
        setBank(loaded);
      } catch (e) {
        console.error(e);
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
    if (subj === "reasoning") {
      // Mix VR + NVR
      const vrPool = bank.vr ?? [];
      const nvrPool = bank.nvr ?? [];
      const nvrGen = genNvrSvg(Math.max(12, Math.ceil(count / 2) + 6));
      const pool = shuffle([...vrPool, ...nvrPool, ...nvrGen]).sort((a, b) => (lastIdsRef.current.has(a.id) ? 1 : 0) - (lastIdsRef.current.has(b.id) ? 1 : 0));
      let uniq = uniqueBy(pool, q => q.stem).slice(0, count);
      if (uniq.length < count) uniq = uniqueBy([...pool, ...nvrGen], q => q.stem).slice(0, count);
      return uniq;
    }

    const core = bank[subj] || [];
    const generated =
      subj === "nvr" ? genNvrSvg(Math.max(12, count + 6)) :
      subj === "maths" ? genMathGeometry(Math.max(16, Math.ceil(count))) :
      [];
    const pool = shuffle([...core, ...generated]).sort((a, b) => (lastIdsRef.current.has(a.id) ? 1 : 0) - (lastIdsRef.current.has(b.id) ? 1 : 0));
    let uniq = uniqueBy(pool, (q) => q.stem).slice(0, count);
    if (uniq.length < count) {
      uniq = uniqueBy([...core, ...generated, ...pool], (q) => q.stem).slice(0, count);
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
    lastIdsRef.current = new Set(questions.map(q => q.id));
    endQuiz();
  }

  const current = questions[index] || null;
  const correctCount = answers.filter(a => a.correct).length;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#c8e6c9,#a5d6a7)", color: "#20351f", padding: 24, boxSizing: "border-box" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gap: 16 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, textShadow: "2px 2px #8fbf7a", marginBottom: 8 }}>11+ Adventure — Quiz</h1>
        <div style={{ opacity: 0.8, fontSize: 14, marginBottom: 8 }}>Minecraft-inspired • Kent/Bexley • 10-min quizzes • 30-min daily cap</div>

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
                <BlockButton disabled={!canStart} onClick={() => startQuiz("reasoning")} style={{ background: "#a2d06e" }}>Reasoning (VR+NVR)</BlockButton>
              </div>

              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Question counts — Maths: {QUESTION_COUNT.maths} · English: {QUESTION_COUNT.english} · VR: {QUESTION_COUNT.vr} · NVR: {QUESTION_COUNT.nvr} · Reasoning: {QUESTION_COUNT.reasoning}
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
                  <BlockButton onClick={() => setPaused(p => !p)} style={{ background: paused ? "#d9c267" : "#9ad27a" }}>{paused ? "Resume" : "Pause"}</BlockButton>
                  <BlockButton onClick={() => { if (confirm("End this quiz now and see your score?")) finishNow(); }} style={{ background: "#f3a09a" }}>End quiz</BlockButton>
                </div>
              </div>

              <div style={{ fontSize: 20, fontWeight: 700 }}>{current.stem}</div>

              {(current.id.startsWith("math-rect") || current.id.startsWith("math-tri") || current.id.startsWith("math-ang")) && (
                <div style={{ display: "grid", placeItems: "center", padding: 8 }}>
                  <MathsDiagram qid={current.id} />
                </div>
              )}

              <div style={{ display: "grid", gap: 10, gridTemplateColumns: current.svgOptions ? "repeat(auto-fit, minmax(120px, 1fr))" : "1fr" }}>
                {current.svgOptions
                  ? current.svgOptions.map((opt, i) => (
                      <SvgOptionButton key={i} opt={opt} label={current.choices[i] || `Option ${i + 1}`} onClick={() => answer(i)} />
                    ))
                  : current.choices.map((c, i) => (
                      <BlockButton key={i} onClick={() => answer(i)}>{c}</BlockButton>
                    ))}
              </div>
            </div>
          </Card>
        )}

        {mode === "results" && (
          <Card>
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#9ad27a", border: "4px solid #2f4f2f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800 }}>
                  {correctCount}/{questions.length}
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>Results</div>
                  <div style={{ opacity: 0.8, fontSize: 13 }}>Great effort! You scored {correctCount} out of {questions.length}.</div>
                </div>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {questions.map((q, i) => {
                  const a = answers[i];
                  const verdict = a?.correct ? "✅ Correct" : "❌ Incorrect";
                  return (
                    <div key={q.id} style={{ border: "2px solid #6f9e63", borderRadius: 10, padding: 12, background: "#eef7ea" }}>
                      <div style={{ fontWeight: 700 }}>Q{i + 1}. {q.stem}</div>
                      {(q.id.startsWith("math-rect") || q.id.startsWith("math-tri") || q.id.startsWith("math-ang")) && (
                        <div style={{ display: "grid", placeItems: "start", padding: "8px 0" }}>
                          <MathsDiagram qid={q.id} />
                        </div>
                      )}
                      <div style={{ fontSize: 14 }}>
                        Your answer: <strong>{typeof a?.choice === "number" ? q.choices[a.choice] : "—"}</strong> • Correct: <strong>{q.choices[q.answerIndex]}</strong> • {verdict}
                      </div>
                      {q.explanation && <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>Explanation: {q.explanation}</div>}
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <BlockButton onClick={() => setMode("menu")}>Back to Menu</BlockButton>
                <BlockButton onClick={() => subject && startQuiz(subject!)}>Try another {subject ?? ""}</BlockButton>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
