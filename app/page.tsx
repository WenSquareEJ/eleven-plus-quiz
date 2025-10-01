'use client';

import React, { useEffect, useState } from "react";

// Types
type Subject = "maths" | "english" | "vr" | "nvr" | "comprehension";

type Question = {
  id: string;
  subject: Subject;
  stem: string;
  choices?: string[];
  answerIndex?: number;
  explanation?: string;
};

type Passage = {
  id: string;
  text: string;
  questions: Question[];
};

// Component
const Page: React.FC = () => {
  const [mode, setMode] = useState<"menu"|"quiz"|"results">("menu");
  const [subject, setSubject] = useState<Subject | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [passage, setPassage] = useState<Passage | null>(null);

  // Load comprehension JSON if needed
  async function startComprehension() {
    const res = await fetch("/questions/comprehension.json");
    const data: Passage[] = await res.json();
    const chosen = data[Math.floor(Math.random()*data.length)];
    setPassage(chosen);
    setQuestions(chosen.questions);
    setSubject("comprehension");
    setIndex(0);
    setAnswers([]);
    setMode("quiz");
  }

  function startQuiz(subj: Subject) {
    if(subj === "comprehension") { startComprehension(); return; }
    // simple placeholders for others
    const qs: Question[] = [
      { id: "1", subject: subj, stem: `Sample ${subj} Q`, choices:["A","B","C","D"], answerIndex:0 }
    ];
    setQuestions(qs);
    setSubject(subj);
    setIndex(0);
    setAnswers([]);
    setMode("quiz");
  }

  function answerCurrent(i:number) {
    setAnswers(prev=>[...prev, i]);
    if(index+1 < questions.length) setIndex(x=>x+1); else setMode("results");
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {mode==="menu" && (
        <div>
          <h1 className="text-2xl font-bold mb-4">11+ Adventure Menu</h1>
          <div className="grid gap-2">
            <button className="p-3 bg-green-200" onClick={()=>startQuiz("maths")}>Maths</button>
            <button className="p-3 bg-green-200" onClick={()=>startQuiz("english")}>English</button>
            <button className="p-3 bg-green-200" onClick={()=>startQuiz("vr")}>Verbal Reasoning</button>
            <button className="p-3 bg-green-200" onClick={()=>startQuiz("nvr")}>Non Verbal Reasoning</button>
            <button className="p-3 bg-green-200" onClick={()=>startQuiz("comprehension")}>Comprehension</button>
          </div>
        </div>
      )}

      {mode==="quiz" && subject==="comprehension" && passage && (
        <div>
          <h2 className="font-bold mb-2">Read the passage</h2>
          <div className="p-3 border mb-4 whitespace-pre-line">{passage.text}</div>
          <div>
            <p className="font-semibold mb-2">{questions[index].stem}</p>
            {questions[index].choices?.map((c,i)=>(
              <button key={i} className="block p-2 m-1 bg-blue-200" onClick={()=>answerCurrent(i)}>{c}</button>
            ))}
          </div>
        </div>
      )}

      {mode==="quiz" && subject!=="comprehension" && (
        <div>
          <p>{questions[index].stem}</p>
          {questions[index].choices?.map((c,i)=>(
            <button key={i} className="block p-2 m-1 bg-blue-200" onClick={()=>answerCurrent(i)}>{c}</button>
          ))}
        </div>
      )}

      {mode==="results" && (
        <div>
          <h2 className="text-xl font-bold mb-2">Results</h2>
          {questions.map((q,i)=>(
            <div key={q.id} className="mb-2">
              <p>{q.stem}</p>
              <p>Your answer: {typeof answers[i]==="number"?q.choices?.[answers[i]]:"—"}; Correct: {q.choices?.[q.answerIndex||0]}</p>
            </div>
          ))}
          <button className="p-2 bg-green-300 mt-3" onClick={()=>setMode("menu")}>Back to menu</button>
        </div>
      )}
    </div>
  );
};

export default Page;
