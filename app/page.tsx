"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

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

/** Small helpers **/
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
function uniqueBy<T>(items: T[], key: (x: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const k = key(it);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(it);
    }
  }
  return out;
}

/** --- A tiny base bank (hand-written items) --- **/
const BASE_BANK: Question[] = [
  // Maths (a few handcrafted)
  { id: "m-01", subject: "maths", stem: "What is 3/4 of 20?", choices: ["12", "13", "14", "15"], answerIndex: 3, explanation: "3/4 × 20 = 15." },
  { id: "m-02", subject: "maths", stem: "480 ÷ 6 = ?", choices: ["60", "70", "75", "80"], answerIndex: 3, explanation: "480/6 = 80." },

  // English
  { id: "e-01", subject: "english", stem: "Choose the best synonym for ‘eager’:", choices: ["reluctant", "keen", "tired", "worried"], answerIndex: 1, explanation: "‘Keen’ ≈ ‘eager’." },
  { id: "e-02", subject: "english", stem: "Pick the correct spelling:", choices: ["begining", "beginning", "beggining", "begininng"], answerIndex: 1, explanation: "Double ‘n’ → beginning." },

  // VR
  { id: "v-01", subject: "vr", stem: "Find the next pair: AB, BC, CD, DE, __", choices: ["EF", "FG", "AE", "DD"], answerIndex: 0, explanation: "Shift +1." },

  // NVR (descriptive)
  { id: "n-01", subject: "nvr", stem: "Which is the odd one out?", choices: ["▲ black triangle", "■ black square", "● black circle", "□ white square"], answerIndex: 3, explanation: "Only one is white." },
];

/** --- Procedural generators to ensure fresh/new sets every quiz --- **/
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
        stem: `What is ${a} × ${b}?`,
        choices,
        answerIndex: choices.indexOf(String(ans)),
        explanation: `${a} × ${b} = ${ans}.`,
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
        explanation: `${num}/${denom} × ${whole} = ${corr}.`,
      });
    }
  }
  return out;
}

function genEnglish(n: number): Question[] {
  const pairs = [
    ["happy", "cheerful"], ["angry", "furious"], ["small", "tiny"], ["fast", "quick"], ["eager", "keen"], ["brave", "courageous"],
  ];
  const wrongs = ["tired",
