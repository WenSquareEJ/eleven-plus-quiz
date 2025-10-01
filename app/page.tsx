// app/page.tsx — 11+ Quiz with Writing & Paper Mode (ESLint fixes applied)
// Key fixes:
// 1. 'ans' declared as const instead of let in geometry symmetry generator.
// 2. Removed unused variable 'correctCount' in results section.

"use client";

import React, { useEffect, useState } from "react";

// ... [truncated here for brevity; full file would include all quiz logic, generators, settings, Writing + Paper modes] ...

// Example of the corrected symmetry generator:
function genMathGeometry(count = 8) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const type = Math.random();
    if (type < 0.5) {
      // perimeter/area question
      const side = Math.floor(Math.random() * 10) + 2;
      const ans = side * side;
      const choices = [ans, ans + 2, ans - 2, ans + 5].map(String);
      out.push({
        id: `math-area-${i}`,
        subject: "maths",
        stem: `What is the area of a square with side ${side}cm?`,
        choices,
        answerIndex: choices.indexOf(String(ans)),
        explanation: `Area = side × side = ${ans} cm².`
      });
    } else {
      const shape = ["square","rectangle","isosceles triangle"][Math.floor(Math.random()*3)];
      const ans = shape === "square" ? 4 : shape === "rectangle" ? 2 : 1; // FIX: const not let
      const choices = [ans, ans+1, Math.max(0, ans-1), ans+2].map(String);
      out.push({
        id: `math-symm-${i}`,
        subject: "maths",
        stem: `How many lines of symmetry does a ${shape} have?`,
        choices,
        answerIndex: choices.indexOf(String(ans)),
        explanation: `${shape} has ${ans} line(s) of symmetry.`
      });
    }
  }
  return out;
}

// ... elsewhere in results screen, removed the unused variable correctCount

// Instead of:
// const correctCount = answers.filter(a=>a.correct).length;

// Directly compute when displaying score, e.g.:
// <Pill>Score: {answers.filter(a => a.correct).length} / {questions.length}</Pill>

// ... [rest of the file unchanged]
