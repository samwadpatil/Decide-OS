/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ─── DECISION ENGINE LOGIC ──────────────────────────────────────────────────

const DECISION_TYPES = {
  LOGICAL: "logical",
  EMOTIONAL: "emotional",
  IMPULSE: "impulse",
  PREFERENCE: "preference",
  AMBIGUOUS: "ambiguous",
};

function classifyDecision(text: string) {
  const t = text.toLowerCase();
  const logicalKw = ["job","career","buy","purchase","invest","salary","cost","price","choose between","compare","which laptop","which phone","school","college","degree","offer","contract","business","should i take","accept","reject"];
  const emotionalKw = ["breakup","relationship","friend","love","hurt","angry","sad","feel","heart","miss","trust","fight","toxic","family","partner","marriage","divorce","lonely","grief","forgive","apology"];
  const impulseKw = ["smoke","cigarette","junk","fast food","skip","procrastinat","binge","scroll","drink","crave","urge","tempt","snack","lazy","quit","distract","impulse","urge","give in","resist"];
  const preferenceKw = ["eat","food","wear","watch","play","listen","movie","music","sport","restaurant","outfit","weekend","tonight","now","should i go","football","basketball","game","coffee","tea","pizza","burger","what to","which one"];
  const ambiguousKw = ["lost","life","purpose","meaning","don't know","confused","future","what should i do","everything","nothing","overwhelm","direction","where do i","who am i","point of"];

  const score = (kws: string[]) => kws.reduce((s, k) => s + (t.includes(k) ? 1 : 0), 0);
  const scores: Record<string, number> = {
    [DECISION_TYPES.LOGICAL]: score(logicalKw),
    [DECISION_TYPES.EMOTIONAL]: score(emotionalKw),
    [DECISION_TYPES.IMPULSE]: score(impulseKw),
    [DECISION_TYPES.PREFERENCE]: score(preferenceKw),
    [DECISION_TYPES.AMBIGUOUS]: score(ambiguousKw),
  };
  const max = Math.max(...Object.values(scores));
  if (max === 0) return DECISION_TYPES.AMBIGUOUS;
  return Object.keys(scores).find((k) => scores[k] === max) || DECISION_TYPES.AMBIGUOUS;
}

function buildSystemPrompt() {
  return `You are the Universal Decision Engine — a structured, intelligent decision system. You are NOT a chatbot.

CRITICAL RULES FOR INVALID INPUTS:
1. GREETINGS & GIBBERISH: If the user says "hi", "hello", "wassup", or types random gibberish, you MUST reject it. Set isRejected=true, phase="output", recommendation="I am a decision engine, not a chatbot. Please tell me about a choice or dilemma you are facing.", and leave all other fields empty.
2. UNETHICAL & TROLLING: If the user asks something illegal, harmful, unethical, gross, or obvious trolling (e.g., "should I eat poop"), you MUST reject it. Set isRejected=true, phase="output", recommendation="I cannot help with this request. Please ask a serious question about a valid decision.", and leave all other fields empty.

DECISION TYPE RULES (Only apply if isRejected=false):
- LOGICAL: Use criteria + weighted scoring. Give clear recommendation with trade-offs.
- EMOTIONAL: Do NOT give immediate yes/no. Ask 3-4 reflective questions first, then give nuanced recommendation.
- IMPULSE: Identify short-term reward vs long-term cost. Bias toward long-term wellbeing. Coach-like tone.
- PREFERENCE: Use simple heuristics. Ask 2-3 quick contextual questions. Quick rec + alternative.
- AMBIGUOUS: Do NOT force answer. Reframe problem. Ask guiding questions to clarify intent.

PHASE RULES:
- LOGICAL with enough info → output directly
- EMOTIONAL → always gather first (1 round)
- IMPULSE → gather only if truly unclear (often output directly)
- PREFERENCE → gather if missing key context (mood, group size, environment), else output
- AMBIGUOUS → almost always gather first

OUTPUT FORMAT — respond ONLY with valid JSON, no markdown, no backticks:
{
  "phase": "gather" or "output",
  "isRejected": boolean,
  "questions": ["q1","q2","q3"],
  "recommendation": "clear recommendation text",
  "reasoning": "explain based on context and user patterns",
  "tradeoffs": "what is gained vs lost",
  "alternative": "second option",
  "insight": "optional behavioral pattern observation"
}

Rules:
- If isRejected=true: provide recommendation only.
- If phase=gather: provide questions array only (2-4 questions max)
- If phase=output and isRejected=false: provide recommendation, reasoning, tradeoffs, alternative (insight is optional)
- Keep text concise, warm, specific. No generic advice. No filler sentences.`;
}

function buildUserMessage(decision: any, userProfile: any, history: any[]) {
  const profileStr = userProfile
    ? `User profile — Priority: ${userProfile.priority}, Decision style: ${userProfile.style}, Biggest struggle: ${userProfile.struggle}.`
    : "";
  const historyStr =
    history.length > 0
      ? `Recent decisions: ${history.slice(-3).map((h) => `"${h.query}"${h.regret !== null ? (h.regret ? " (regretted)" : " (satisfied)") : ""}`).join("; ")}.`
      : "";

  const typeInstructions: Record<string, string> = {
    logical: `Suggested type: LOGICAL. Use structured criteria + weighted scoring. Ask about options if not clear. Calculate trade-offs explicitly.`,
    emotional: `Suggested type: EMOTIONAL. This involves feelings. First gather context with 3-4 reflective questions. Then give nuanced guidance with next steps.`,
    impulse: `Suggested type: IMPULSE. Identify the short-term urge vs long-term cost. Strongly favor long-term wellbeing. Be supportive like a coach.`,
    preference: `Suggested type: PREFERENCE. Quick heuristics only. If context is missing, ask 2-3 targeted questions (mood/energy/group/environment). Then give quick rec + alternative.`,
    ambiguous: `Suggested type: AMBIGUOUS. Do NOT force an answer. Reframe and ask 2-3 guiding questions to help clarify what the user actually wants.`,
  };

  return `(Note: First evaluate if this is a valid decision. If it is a greeting, gibberish, or unethical, reject it immediately setting isRejected=true.)

${typeInstructions[decision.type] || ""}

${profileStr}
${historyStr}

User's input: "${decision.query}"`;
}

async function callGemini(messages: any[]) {
  try {
    const geminiMessages = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: geminiMessages,
      config: {
        systemInstruction: buildSystemPrompt(),
        temperature: 0.7,
        responseMimeType: "application/json",
      }
    });

    const text = response.text || "{}";
    const cleaned = text.replace(/```json\n?|```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error("Gemini API Error:", error);
    return { phase: "output", recommendation: "Error connecting to AI.", reasoning: "", tradeoffs: "", alternative: "" };
  }
}

// ─── STYLES ─────────────────────────────────────────────────────────────────

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #080810;
    --surface: #10101c;
    --surface2: #181828;
    --border: rgba(255,255,255,0.07);
    --border2: rgba(255,255,255,0.12);
    --accent: #7c6aff;
    --accent2: #ff6a9b;
    --accent3: #6affd4;
    --text: #e4e4f0;
    --muted: #5c5c7a;
    --logical: #6a9bff;
    --emotional: #ff6a9b;
    --impulse: #ffaa6a;
    --preference: #6affd4;
    --ambiguous: #c46aff;
  }

  body {
    font-family: 'DM Sans', sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    overflow-x: hidden;
  }

  .app {
    position: relative; min-height: 100vh;
    background:
      radial-gradient(ellipse 60% 40% at 20% 10%, rgba(124,106,255,0.06) 0%, transparent 70%),
      radial-gradient(ellipse 50% 35% at 80% 80%, rgba(255,106,155,0.04) 0%, transparent 70%),
      var(--bg);
  }

  .header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 32px;
    border-bottom: 1px solid var(--border);
    position: sticky; top: 0; z-index: 100;
    background: rgba(8,8,16,0.88);
    backdrop-filter: blur(16px);
  }
  .logo {
    font-family: 'Syne', sans-serif;
    font-size: 17px; font-weight: 800; letter-spacing: -0.5px;
    display: flex; align-items: center; gap: 10px;
  }
  .logo-mark {
    width: 30px; height: 30px; border-radius: 8px;
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%);
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; flex-shrink: 0;
  }
  .nav { display: flex; gap: 4px; }
  .nav-btn {
    padding: 7px 14px; border-radius: 8px; border: 1px solid transparent;
    background: transparent; color: var(--muted); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 400;
    transition: all 0.18s;
  }
  .nav-btn:hover { color: var(--text); background: var(--surface2); }
  .nav-btn.active { color: var(--text); background: var(--surface2); border-color: var(--border2); }

  /* ONBOARDING */
  .onboard {
    max-width: 540px; margin: 0 auto; padding: 72px 24px 48px;
    animation: fadeUp 0.5s ease both;
  }
  .tag {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 12px; border-radius: 20px;
    background: rgba(124,106,255,0.1); border: 1px solid rgba(124,106,255,0.25);
    color: var(--accent); font-size: 11px; font-weight: 500; letter-spacing: 1.5px;
    text-transform: uppercase; margin-bottom: 28px;
  }
  .tag-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); animation: pulse 2s ease infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

  h1 {
    font-family: 'Syne', sans-serif; font-size: clamp(30px, 5vw, 46px);
    font-weight: 800; line-height: 1.08; margin-bottom: 18px;
    letter-spacing: -1.5px;
  }
  h1 em {
    font-style: normal;
    background: linear-gradient(100deg, var(--accent) 0%, var(--accent2) 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .onboard-desc {
    color: var(--muted); font-size: 15px; line-height: 1.65; margin-bottom: 44px;
    font-weight: 300;
  }

  .pq { margin-bottom: 28px; }
  .pq-label {
    font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 1.5px; color: var(--muted);
    margin-bottom: 12px;
  }
  .pq-opts { display: flex; gap: 8px; flex-wrap: wrap; }
  .pq-opt {
    padding: 9px 16px; border-radius: 9px; border: 1px solid var(--border);
    background: var(--surface); color: var(--muted); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 400;
    transition: all 0.15s;
  }
  .pq-opt:hover { border-color: var(--border2); color: var(--text); }
  .pq-opt.sel { border-color: var(--accent); color: var(--accent); background: rgba(124,106,255,0.1); }

  .start-btn {
    width: 100%; padding: 15px; border-radius: 12px; border: none;
    background: linear-gradient(120deg, var(--accent) 0%, #9b6aff 50%, var(--accent2) 100%);
    color: white; font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700;
    cursor: pointer; letter-spacing: 0.3px; margin-top: 8px;
    transition: opacity 0.15s, transform 0.15s;
    position: relative; overflow: hidden;
  }
  .start-btn::after {
    content: ''; position: absolute; inset: 0;
    background: rgba(255,255,255,0.08);
    opacity: 0; transition: opacity 0.15s;
  }
  .start-btn:hover:not(:disabled)::after { opacity: 1; }
  .start-btn:hover:not(:disabled) { transform: translateY(-1px); }
  .start-btn:disabled { opacity: 0.35; cursor: not-allowed; }

  /* ENGINE */
  .engine { max-width: 680px; margin: 0 auto; padding: 44px 24px; }

  .q-label {
    font-family: 'Syne', sans-serif; font-size: 10px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 2px; color: var(--muted);
    margin-bottom: 10px; display: flex; align-items: center; gap: 10px;
  }
  .q-label::after { content: ''; flex: 1; height: 1px; background: var(--border); }

  .input-wrap { position: relative; }
  .q-input {
    width: 100%; padding: 18px 56px 18px 18px;
    border-radius: 14px; border: 1px solid var(--border);
    background: var(--surface); color: var(--text);
    font-family: 'DM Sans', sans-serif; font-size: 15px; line-height: 1.55;
    resize: none; outline: none; transition: border-color 0.18s;
    min-height: 72px; overflow: hidden;
  }
  .q-input:focus { border-color: rgba(124,106,255,0.45); }
  .q-input::placeholder { color: var(--muted); }
  .q-input:disabled { opacity: 0.5; }
  .submit-btn {
    position: absolute; right: 10px; bottom: 10px;
    width: 38px; height: 38px; border-radius: 9px; border: none;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    color: white; cursor: pointer; font-size: 17px;
    display: flex; align-items: center; justify-content: center;
    transition: opacity 0.15s;
  }
  .submit-btn:hover { opacity: 0.85; }
  .submit-btn:disabled { opacity: 0.25; cursor: not-allowed; }

  /* TYPE BADGE */
  .type-badge {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 5px 12px; border-radius: 20px; font-size: 12px;
    font-weight: 500; margin: 16px 0 20px;
    animation: fadeIn 0.25s ease both;
  }
  .td { width: 5px; height: 5px; border-radius: 50%; }
  .t-logical { background: rgba(106,155,255,0.1); color: var(--logical); border: 1px solid rgba(106,155,255,0.25); }
  .t-emotional { background: rgba(255,106,155,0.1); color: var(--emotional); border: 1px solid rgba(255,106,155,0.25); }
  .t-impulse { background: rgba(255,170,106,0.1); color: var(--impulse); border: 1px solid rgba(255,170,106,0.25); }
  .t-preference { background: rgba(106,255,212,0.1); color: var(--preference); border: 1px solid rgba(106,255,212,0.25); }
  .t-ambiguous { background: rgba(196,106,255,0.1); color: var(--ambiguous); border: 1px solid rgba(196,106,255,0.25); }
  .t-rejected { background: rgba(92,92,122,0.1); color: var(--muted); border: 1px solid rgba(92,92,122,0.25); }

  /* LOADING */
  .loading {
    display: flex; align-items: center; gap: 12px;
    padding: 20px 0; color: var(--muted); font-size: 13px;
  }
  .spin {
    width: 18px; height: 18px; border-radius: 50%;
    border: 2px solid var(--border2); border-top-color: var(--accent);
    animation: spin 0.75s linear infinite; flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* PAUSE */
  .pause-box {
    background: rgba(255,170,106,0.06); border: 1px solid rgba(255,170,106,0.25);
    border-radius: 14px; padding: 24px; margin-bottom: 20px;
    animation: fadeUp 0.35s ease both;
  }
  .pause-hd {
    font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700;
    color: var(--impulse); margin-bottom: 6px;
  }
  .pause-sub { font-size: 13px; color: var(--muted); line-height: 1.55; margin-bottom: 18px; }
  .pause-num {
    font-family: 'Syne', sans-serif; font-size: 44px; font-weight: 800;
    color: var(--impulse); text-align: center; line-height: 1;
    margin-bottom: 14px;
  }
  .pause-bar { background: rgba(255,170,106,0.12); border-radius: 4px; height: 3px; overflow: hidden; }
  .pause-fill { height: 100%; background: var(--impulse); border-radius: 4px; transition: width 1s linear; }

  /* GATHER */
  .gather { animation: fadeUp 0.35s ease both; }
  .gather-note {
    font-size: 13px; color: var(--muted); line-height: 1.6;
    padding: 12px 16px; background: var(--surface);
    border-radius: 9px; border-left: 2px solid var(--accent);
    margin-bottom: 20px;
  }
  .gq { margin-bottom: 14px; }
  .gq label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 7px; }
  .gq input {
    width: 100%; padding: 11px 14px; border-radius: 9px;
    border: 1px solid var(--border); background: var(--surface);
    color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 14px;
    outline: none; transition: border-color 0.15s;
  }
  .gq input:focus { border-color: rgba(124,106,255,0.45); }
  .go-btn {
    margin-top: 6px; padding: 12px 24px; border-radius: 9px; border: none;
    background: linear-gradient(120deg, var(--accent), var(--accent2));
    color: white; font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700;
    cursor: pointer; transition: opacity 0.15s;
  }
  .go-btn:hover { opacity: 0.85; }

  /* OUTPUT */
  .output { animation: fadeUp 0.4s ease both; }
  .cards { display: flex; flex-direction: column; gap: 10px; }
  .card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 14px; padding: 18px 20px; transition: border-color 0.15s;
  }
  .card:hover { border-color: var(--border2); }
  .card.c-rec { border-color: rgba(124,106,255,0.28); background: rgba(124,106,255,0.04); }
  .card.c-ins { border-color: rgba(106,255,212,0.2); background: rgba(106,255,212,0.025); }
  .card-top { display: flex; align-items: center; gap: 9px; margin-bottom: 10px; }
  .card-ico {
    width: 28px; height: 28px; border-radius: 7px; font-size: 13px;
    display: flex; align-items: center; justify-content: center;
    background: var(--surface2); flex-shrink: 0;
  }
  .card-ttl {
    font-family: 'Syne', sans-serif; font-size: 10px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 1.5px; color: var(--muted);
  }
  .card-body { font-size: 14px; line-height: 1.68; }

  .acts { display: flex; gap: 8px; margin-top: 18px; flex-wrap: wrap; align-items: center; }
  .acts-label { font-size: 12px; color: var(--muted); }
  .act-btn {
    padding: 8px 14px; border-radius: 8px; border: 1px solid var(--border);
    background: var(--surface); color: var(--muted); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 12px;
    transition: all 0.15s; display: flex; align-items: center; gap: 5px;
  }
  .act-btn:hover { background: var(--surface2); color: var(--text); border-color: var(--border2); }
  .act-good { color: #6aff9b; border-color: rgba(106,255,155,0.25); }
  .act-good:hover { background: rgba(106,255,155,0.07) !important; }
  .act-good.marked { background: rgba(106,255,155,0.1) !important; border-color: rgba(106,255,155,0.4) !important; }
  .act-bad { color: var(--accent2); border-color: rgba(255,106,155,0.25); }
  .act-bad:hover { background: rgba(255,106,155,0.07) !important; }
  .act-bad.marked { background: rgba(255,106,155,0.1) !important; border-color: rgba(255,106,155,0.4) !important; }
  .act-new { color: var(--accent); border-color: rgba(124,106,255,0.25); }
  .act-new:hover { background: rgba(124,106,255,0.08) !important; }

  /* HISTORY */
  .section { max-width: 680px; margin: 0 auto; padding: 44px 24px; }
  .sec-title {
    font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800;
    letter-spacing: -0.5px; margin-bottom: 4px;
  }
  .sec-sub { color: var(--muted); font-size: 13px; margin-bottom: 28px; }

  .hist-list { display: flex; flex-direction: column; gap: 8px; }
  .hist-item {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 14px 18px; cursor: default;
    transition: border-color 0.15s;
  }
  .hist-item:hover { border-color: var(--border2); }
  .hist-top { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
  .hist-q { font-size: 14px; font-weight: 500; flex: 1; }
  .hist-date { font-size: 11px; color: var(--muted); }
  .hist-rec { font-size: 12px; color: var(--muted); margin-top: 3px; line-height: 1.5; }
  .rdot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .r-good { background: #6aff9b; }
  .r-bad { background: var(--accent2); }
  .r-none { background: var(--muted); opacity: 0.5; }

  /* PATTERNS */
  .stats-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; }
  .stat-box {
    flex: 1; min-width: 110px; background: var(--surface);
    border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px;
  }
  .stat-n {
    font-family: 'Syne', sans-serif; font-size: 30px; font-weight: 800;
    background: linear-gradient(120deg, var(--accent), var(--accent2));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text; line-height: 1;
  }
  .stat-l { font-size: 11px; color: var(--muted); margin-top: 4px; }
  .pat-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 18px 20px; margin-bottom: 10px;
  }
  .pat-lbl {
    font-family: 'Syne', sans-serif; font-size: 10px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 1.5px; color: var(--muted);
    margin-bottom: 7px;
  }
  .pat-val { font-size: 15px; font-weight: 500; }
  .pat-sub { font-size: 12px; color: var(--muted); margin-top: 5px; line-height: 1.5; }

  /* PROFILE SETTINGS MODAL */
  .modal-overlay {
    position: fixed; inset: 0; z-index: 200;
    background: rgba(8,8,16,0.7); backdrop-filter: blur(8px);
    display: flex; align-items: center; justify-content: center;
    padding: 24px; animation: fadeIn 0.2s ease both;
  }
  .modal {
    background: var(--surface); border: 1px solid var(--border2);
    border-radius: 18px; padding: 28px; width: 100%; max-width: 460px;
    animation: fadeUp 0.25s ease both;
  }
  .modal-hd {
    font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 800;
    letter-spacing: -0.3px; margin-bottom: 4px;
  }
  .modal-sub { font-size: 13px; color: var(--muted); margin-bottom: 24px; }
  .modal-acts { display: flex; gap: 8px; margin-top: 24px; justify-content: flex-end; }
  .modal-cancel {
    padding: 10px 18px; border-radius: 9px; border: 1px solid var(--border);
    background: transparent; color: var(--muted); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; transition: all 0.15s;
  }
  .modal-cancel:hover { color: var(--text); border-color: var(--border2); }
  .modal-save {
    padding: 10px 20px; border-radius: 9px; border: none;
    background: linear-gradient(120deg, var(--accent), var(--accent2));
    color: white; font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700;
    cursor: pointer; transition: opacity 0.15s;
  }
  .modal-save:hover { opacity: 0.85; }

  /* Priority quick-switch in header */
  .priority-chip {
    display: flex; align-items: center; gap: 6px;
    padding: 5px 10px 5px 8px; border-radius: 20px;
    border: 1px solid var(--border); background: var(--surface);
    cursor: pointer; transition: all 0.15s; font-size: 12px; color: var(--muted);
  }
  .priority-chip:hover { border-color: var(--border2); color: var(--text); }
  .priority-chip-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }
  .priority-chip strong { color: var(--text); font-weight: 500; }

  /* EMPTY */
  .empty { text-align: center; padding: 56px 24px; color: var(--muted); }
  .empty-ico { font-size: 40px; margin-bottom: 14px; opacity: 0.35; }
  .empty-t { font-size: 13px; }

  /* ANIMATIONS */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }

  /* MOBILE RESPONSIVENESS */
  @media (max-width: 640px) {
    .header {
      flex-direction: column;
      align-items: flex-start;
      gap: 16px;
      padding: 16px 20px;
    }
    .header > .header-right {
      width: 100%;
      justify-content: space-between;
      flex-wrap: wrap;
    }
    .nav {
      width: 100%;
      justify-content: space-between;
    }
    .nav-btn {
      flex: 1;
      text-align: center;
      padding: 8px 10px;
      font-size: 12px;
    }
    .onboard {
      padding: 40px 20px 30px;
    }
    h1 {
      font-size: 32px;
    }
    .engine, .section {
      padding: 24px 16px;
    }
    .q-input {
      font-size: 16px; /* Prevents iOS/Android auto-zoom */
      padding: 16px 50px 16px 16px;
    }
    .submit-btn {
      width: 44px;
      height: 44px;
      right: 6px;
      bottom: 6px;
    }
    .stats-row {
      flex-direction: column;
    }
    .priority-chip {
      padding: 6px 12px;
    }
    .modal {
      padding: 20px;
    }
    .pq-opts {
      gap: 6px;
    }
    .pq-opt {
      padding: 8px 12px;
      font-size: 12px;
      flex: 1 1 calc(50% - 6px);
      text-align: center;
    }
  }
`;

const TYPE_META: Record<string, any> = {
  logical:    { label: "Logical Decision",     emoji: "⚖️", cls: "t-logical",    dot: "var(--logical)" },
  emotional:  { label: "Emotional Decision",   emoji: "💙", cls: "t-emotional",  dot: "var(--emotional)" },
  impulse:    { label: "Impulse Decision",     emoji: "⚡", cls: "t-impulse",    dot: "var(--impulse)" },
  preference: { label: "Preference Decision",  emoji: "✨", cls: "t-preference", dot: "var(--preference)" },
  ambiguous:  { label: "Open-Ended",           emoji: "🔭", cls: "t-ambiguous",  dot: "var(--ambiguous)" },
  rejected:   { label: "Invalid Request",      emoji: "🚫", cls: "t-rejected",   dot: "var(--muted)" },
};

// ─── PAUSE TIMER ─────────────────────────────────────────────────────────────
function PauseTimer({ onDone }: { onDone: () => void }) {
  const [secs, setSecs] = useState(60);
  useEffect(() => {
    if (secs <= 0) { onDone(); return; }
    const t = setTimeout(() => setSecs(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs, onDone]);
  const pct = ((60 - secs) / 60) * 100;
  return (
    <div className="pause-box">
      <div className="pause-hd">⏸ Pause Before Deciding</div>
      <div className="pause-sub">
        Impulse decisions feel urgent — but the urge usually fades. Give yourself 60 seconds before acting.
      </div>
      <div className="pause-num">{secs}s</div>
      <div className="pause-bar">
        <div className="pause-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── PROFILE MODAL ───────────────────────────────────────────────────────────
function ProfileModal({ profile, onSave, onClose }: { profile: any, onSave: (p: any) => void, onClose: () => void }) {
  const [local, setLocal] = useState({ ...profile });
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-hd">Edit Your Profile</div>
        <div className="modal-sub">Changes apply to all future decisions immediately.</div>

        <div className="pq" style={{ marginBottom: 20 }}>
          <div className="pq-label">What matters most to you right now?</div>
          <div className="pq-opts">
            {["Growth", "Money", "Health", "Peace"].map(o => (
              <button key={o} className={`pq-opt${local.priority === o ? " sel" : ""}`}
                onClick={() => setLocal((p: any) => ({ ...p, priority: o }))}>{o}</button>
            ))}
          </div>
        </div>

        <div className="pq" style={{ marginBottom: 20 }}>
          <div className="pq-label">How do you prefer to decide?</div>
          <div className="pq-opts">
            {["Fast & Decisive", "Thoughtful & Careful", "Depends on context"].map(o => (
              <button key={o} className={`pq-opt${local.style === o ? " sel" : ""}`}
                onClick={() => setLocal((p: any) => ({ ...p, style: o }))}>{o}</button>
            ))}
          </div>
        </div>

        <div className="pq" style={{ marginBottom: 0 }}>
          <div className="pq-label">Biggest decision struggle?</div>
          <div className="pq-opts">
            {["Overthinking", "Impulsiveness", "Fear of Regret", "Too many options"].map(o => (
              <button key={o} className={`pq-opt${local.struggle === o ? " sel" : ""}`}
                onClick={() => setLocal((p: any) => ({ ...p, struggle: o }))}>{o}</button>
            ))}
          </div>
        </div>

        <div className="modal-acts">
          <button className="modal-cancel" onClick={onClose}>Cancel</button>
          <button className="modal-save" onClick={() => onSave({ ...local })}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("home");
  const [profile, setProfile] = useState<any>(null);
  const [draft, setDraft] = useState({ priority: "", style: "", struggle: "" });
  const [editingProfile, setEditingProfile] = useState(false);
  const [query, setQuery] = useState("");
  const [decision, setDecision] = useState<any>(null);
  const [phase, setPhase] = useState<string | null>(null); // null | loading | gather | pause | output
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [output, setOutput] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [msgs, setMsgs] = useState<any[]>([]);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = "auto";
      taRef.current.style.height = Math.min(taRef.current.scrollHeight, 180) + "px";
    }
  }, [query]);

  const canStart = draft.priority && draft.style && draft.struggle;
  const busy = phase === "loading" || phase === "pause";

  async function submitQuery() {
    if (!query.trim() || busy) return;
    const type = classifyDecision(query);
    const dec = { query: query.trim(), type };
    setDecision(dec);
    setOutput(null);
    setQuestions([]);
    setAnswers({});
    setPhase("loading");

    const userMsg = buildUserMessage(dec, profile, history);
    const newMsgs = [{ role: "user", content: userMsg }];
    setMsgs(newMsgs);

    const result = await callGemini(newMsgs);

    if (result.phase === "gather") {
      setQuestions(result.questions || []);
      setPhase(type === DECISION_TYPES.IMPULSE ? "pause" : "gather");
    } else {
      finalize(dec, result);
    }
  }

  async function submitGather() {
    const ansText = questions
      .map((q, i) => `Q: ${q}\nA: ${answers[i] || "(not answered)"}`)
      .join("\n\n");
    setPhase("loading");
    const newMsgs = [
      ...msgs,
      { role: "assistant", content: JSON.stringify({ phase: "gather", questions }) },
      { role: "user", content: `My answers:\n\n${ansText}\n\nNow give me the full structured decision output as JSON.` },
    ];
    setMsgs(newMsgs);
    const result = await callGemini(newMsgs);
    finalize(decision, result);
  }

  function finalize(dec: any, result: any) {
    setOutput(result);
    setPhase("output");
    const finalType = result.isRejected ? "rejected" : dec.type;
    if (result.isRejected) {
      setDecision({ ...dec, type: "rejected" });
    }
    const entry = {
      id: Date.now(),
      query: dec.query,
      type: finalType,
      recommendation: result.recommendation || "",
      date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      regret: null,
    };
    setHistory(prev => [entry, ...prev]);
  }

  function markRegret(id: number, val: boolean) {
    setHistory(prev => prev.map(h => h.id === id ? { ...h, regret: val } : h));
  }

  function reset() {
    setQuery("");
    setDecision(null);
    setPhase(null);
    setOutput(null);
    setQuestions([]);
    setAnswers({});
  }

  const regret = history.filter(h => h.regret === true).length;
  const satisfied = history.filter(h => h.regret === false).length;
  const typeFreq = history.reduce((a, h) => { a[h.type] = (a[h.type] || 0) + 1; return a; }, {});
  const topType = Object.entries(typeFreq).sort((a: any, b: any) => b[1] - a[1])[0] as [string, number] | undefined;
  const currentHistEntry = output ? history[0] : null;

  return (
    <>
      <style>{css}</style>
      <div className="app">
        {/* HEADER */}
        <header className="header">
          <div className="logo">
            <div className="logo-mark">⚡</div>
            DecideOS
          </div>
          {profile && (
            <div className="header-right" style={{display:"flex",alignItems:"center",gap:8}}>
              <button className="priority-chip" onClick={() => setEditingProfile(true)} title="Change your profile">
                <span className="priority-chip-dot" />
                <strong>{profile.priority}</strong>
                <span style={{opacity:0.5}}>· Edit</span>
              </button>
              <nav className="nav">
                <button className={`nav-btn${page==="engine"?" active":""}`} onClick={() => setPage("engine")}>Decide</button>
                <button className={`nav-btn${page==="history"?" active":""}`} onClick={() => setPage("history")}>History {history.length > 0 && `(${history.length})`}</button>
                <button className={`nav-btn${page==="patterns"?" active":""}`} onClick={() => setPage("patterns")}>Patterns</button>
              </nav>
            </div>
          )}
        </header>

        {/* ONBOARDING */}
        {!profile && (
          <div className="onboard">
            <div className="tag"><span className="tag-dot" />Universal Decision Engine</div>
            <h1>Decide with <em>clarity</em>,<br />not chaos.</h1>
            <p className="onboard-desc">
              3 quick questions — then the engine adapts its entire reasoning process to you. No generic advice. No one-size-fits-all.
            </p>

            <div className="pq">
              <div className="pq-label">What matters most to you right now?</div>
              <div className="pq-opts">
                {["Growth","Money","Health","Peace"].map(o => (
                  <button key={o} className={`pq-opt${draft.priority===o?" sel":""}`}
                    onClick={() => setDraft(p => ({...p, priority: o}))}>{o}</button>
                ))}
              </div>
            </div>

            <div className="pq">
              <div className="pq-label">How do you prefer to decide?</div>
              <div className="pq-opts">
                {["Fast & Decisive","Thoughtful & Careful","Depends on context"].map(o => (
                  <button key={o} className={`pq-opt${draft.style===o?" sel":""}`}
                    onClick={() => setDraft(p => ({...p, style: o}))}>{o}</button>
                ))}
              </div>
            </div>

            <div className="pq">
              <div className="pq-label">Biggest decision struggle?</div>
              <div className="pq-opts">
                {["Overthinking","Impulsiveness","Fear of Regret","Too many options"].map(o => (
                  <button key={o} className={`pq-opt${draft.struggle===o?" sel":""}`}
                    onClick={() => setDraft(p => ({...p, struggle: o}))}>{o}</button>
                ))}
              </div>
            </div>

            <button className="start-btn" disabled={!canStart} onClick={() => { setProfile({...draft}); setPage("engine"); }}>
              Launch Decision Engine →
            </button>
          </div>
        )}

        {/* ENGINE */}
        {profile && page === "engine" && (
          <div className="engine">
            <div style={{ marginBottom: 24 }}>
              <div className="q-label">What decision are you facing?</div>
              <div className="input-wrap">
                <textarea
                  ref={taRef}
                  className="q-input"
                  placeholder="e.g. Should I quit my job? I keep craving junk food. Football or basketball tonight?"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitQuery(); } }}
                  disabled={busy || phase === "gather" || phase === "output"}
                  rows={2}
                />
                <button className="submit-btn"
                  onClick={submitQuery}
                  disabled={!query.trim() || busy || phase === "gather" || phase === "output"}>
                  →
                </button>
              </div>
            </div>

            {/* Type badge */}
            {decision && phase && (
              <div className={`type-badge ${TYPE_META[decision.type].cls}`}>
                <span className="td" style={{ background: TYPE_META[decision.type].dot }} />
                {TYPE_META[decision.type].emoji} {TYPE_META[decision.type].label}
              </div>
            )}

            {/* Loading */}
            {phase === "loading" && (
              <div className="loading"><div className="spin" />Analyzing your decision…</div>
            )}

            {/* Pause */}
            {phase === "pause" && <PauseTimer onDone={() => setPhase("gather")} />}

            {/* Gather */}
            {phase === "gather" && questions.length > 0 && (
              <div className="gather">
                <div className="gather-note">I need a bit more context to reason well about this.</div>
                {questions.map((q, i) => (
                  <div key={i} className="gq">
                    <label>{q}</label>
                    <input type="text" placeholder="Your answer…"
                      value={answers[i] || ""}
                      onChange={e => setAnswers(prev => ({...prev, [i]: e.target.value}))}
                      onKeyDown={e => { if (e.key === "Enter") submitGather(); }}
                    />
                  </div>
                ))}
                <button className="go-btn" onClick={submitGather}>Analyze →</button>
              </div>
            )}

            {/* Output */}
            {phase === "output" && output && (
              <div className="output">
                <div className="cards">
                  {output.recommendation && (
                    <div className="card c-rec">
                      <div className="card-top">
                        <div className="card-ico">{output.isRejected ? "🚫" : "✅"}</div>
                        <div className="card-ttl">{output.isRejected ? "System Message" : "Recommendation"}</div>
                      </div>
                      <div className="card-body">{output.recommendation}</div>
                    </div>
                  )}
                  {output.reasoning && (
                    <div className="card">
                      <div className="card-top">
                        <div className="card-ico">🧠</div>
                        <div className="card-ttl">Reasoning</div>
                      </div>
                      <div className="card-body">{output.reasoning}</div>
                    </div>
                  )}
                  {output.tradeoffs && (
                    <div className="card">
                      <div className="card-top">
                        <div className="card-ico">⚖️</div>
                        <div className="card-ttl">Trade-offs</div>
                      </div>
                      <div className="card-body">{output.tradeoffs}</div>
                    </div>
                  )}
                  {output.alternative && (
                    <div className="card">
                      <div className="card-top">
                        <div className="card-ico">🔁</div>
                        <div className="card-ttl">Alternative Path</div>
                      </div>
                      <div className="card-body">{output.alternative}</div>
                    </div>
                  )}
                  {output.insight && (
                    <div className="card c-ins">
                      <div className="card-top">
                        <div className="card-ico">💡</div>
                        <div className="card-ttl">Pattern Insight</div>
                      </div>
                      <div className="card-body">{output.insight}</div>
                    </div>
                  )}
                </div>

                <div className="acts">
                  <span className="acts-label">Outcome?</span>
                  {currentHistEntry && (
                    <>
                      <button className={`act-btn act-good${currentHistEntry.regret===false?" marked":""}`}
                        onClick={() => markRegret(currentHistEntry.id, false)}>
                        👍 Good call
                      </button>
                      <button className={`act-btn act-bad${currentHistEntry.regret===true?" marked":""}`}
                        onClick={() => markRegret(currentHistEntry.id, true)}>
                        😬 Regret this
                      </button>
                    </>
                  )}
                  <button className="act-btn act-new" onClick={reset}>+ New Decision</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* HISTORY */}
        {profile && page === "history" && (
          <div className="section">
            <div className="sec-title">Decision History</div>
            <div className="sec-sub">{history.length} decisions · Green = good outcome · Red = regret · Grey = pending</div>
            {history.length === 0 ? (
              <div className="empty"><div className="empty-ico">📋</div><div className="empty-t">No decisions yet. Make your first one.</div></div>
            ) : (
              <div className="hist-list">
                {history.map(h => (
                  <div key={h.id} className="hist-item">
                    <div className="hist-top">
                      <span className={`rdot ${h.regret===null?"r-none":h.regret?"r-bad":"r-good"}`} />
                      <span className={`type-badge ${TYPE_META[h.type].cls}`} style={{margin:0,fontSize:10,padding:"2px 8px"}}>
                        {TYPE_META[h.type].emoji} {h.type}
                      </span>
                      <span className="hist-q">{h.query}</span>
                      <span className="hist-date">{h.date}</span>
                    </div>
                    {h.recommendation && (
                      <div className="hist-rec">→ {h.recommendation.slice(0,130)}{h.recommendation.length>130?"…":""}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PATTERNS */}
        {profile && page === "patterns" && (
          <div className="section">
            <div className="sec-title">Your Patterns</div>
            <div className="sec-sub">Behavioral insights from your decision history</div>

            <div className="stats-row">
              <div className="stat-box"><div className="stat-n">{history.length}</div><div className="stat-l">Decisions Made</div></div>
              <div className="stat-box"><div className="stat-n">{satisfied}</div><div className="stat-l">Good Outcomes</div></div>
              <div className="stat-box"><div className="stat-n">{regret}</div><div className="stat-l">Regretted</div></div>
            </div>

            <div className="pat-card">
              <div className="pat-lbl">Your Profile</div>
              <div className="pat-val">Priority: {profile.priority} · Style: {profile.style}</div>
              <div className="pat-sub">Biggest struggle: {profile.struggle}</div>
            </div>

            {topType && (
              <div className="pat-card">
                <div className="pat-lbl">Most Common Decision Type</div>
                <div className="pat-val">{TYPE_META[topType[0]]?.emoji} {topType[0]} ({topType[1]} time{topType[1]>1?"s":""})</div>
                <div className="pat-sub">This is where you spend most of your mental energy.</div>
              </div>
            )}

            {regret > satisfied && history.length >= 3 && (
              <div className="pat-card" style={{borderColor:"rgba(255,106,155,0.3)"}}>
                <div className="pat-lbl">⚠️ Pattern Detected</div>
                <div className="pat-val">You're regretting more than you're satisfied with.</div>
                <div className="pat-sub">Try using the reflective questions more thoroughly before finalizing decisions.</div>
              </div>
            )}

            {profile.struggle === "Impulsiveness" && history.filter(h=>h.type==="impulse").length >= 2 && (
              <div className="pat-card" style={{borderColor:"rgba(255,170,106,0.25)"}}>
                <div className="pat-lbl">💡 Impulse Pattern</div>
                <div className="pat-val">You've faced {history.filter(h=>h.type==="impulse").length} impulse decisions.</div>
                <div className="pat-sub">Your profile flags impulsiveness — the pause mechanism is your most important tool.</div>
              </div>
            )}

            {history.length === 0 && (
              <div className="empty"><div className="empty-ico">🔭</div><div className="empty-t">Make some decisions to see your patterns emerge.</div></div>
            )}
          </div>
        )}
        {/* PROFILE EDIT MODAL */}
        {editingProfile && profile && (
          <ProfileModal
            profile={profile}
            onSave={(updated) => { setProfile(updated); setEditingProfile(false); }}
            onClose={() => setEditingProfile(false)}
          />
        )}
      </div>
    </>
  );
}
