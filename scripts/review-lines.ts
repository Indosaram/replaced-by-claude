// Runs AI-tell and harm reviews over every line in src/lines.ts, applying rewrites in place.
import { readFileSync, writeFileSync } from "node:fs";
import { LINES, SLOT_TRIGGERS, type Trigger } from "../src/lines";

const OMO = "/Users/indo/.bun/bin/omo";
const FILE = "src/lines.ts";
const EVID = ".omo/evidence/x-aggro-app/";
const BATCH = 15;
let fails = 0;

function omo(prompt: string): string {
  const r = Bun.spawnSync([OMO, "-p", "--no-session", "--model", "mahoquot/gpt-6-luna", "--no-tools", "--no-extensions",
    "--no-skills", "--no-context-files", "--system-prompt", "Follow the instructions exactly. Output only what is asked.", "-"],
    { stdin: new TextEncoder().encode(prompt), stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0) {
    console.log("BLOCKED: reviewer unavailable\n" + r.stderr.toString());
    process.exit(2);
  }
  return r.stdout.toString();
}
function json(prompt: string): any[] {
  for (let a = 0; a < 2; a++) {
    const o = omo(prompt);
    try { return JSON.parse(o.slice(o.indexOf("["), o.lastIndexOf("]") + 1)); } catch { fails++; }
  }
  console.log("BLOCKED: reviewer unavailable\nunparseable JSON twice");
  process.exit(2);
}
const numbered = (ls: string[]) => ls.map((l, i) => `${i + 1}. ${l}`).join("\n");
const AI_P = `You are an expert editor who spots AI-written text. These are one-line roast captions for a developer joke site. For EACH line look for AI tells: tidy 'X, which Y' clauses, balanced setup-payoff, 'not X, it's Y', em dashes, colon lists, generic closers, words like landscape/crucial/notably, anything a funny human writing fast would not write. Score 0 = clearly human, 10 = obviously generated. If score > 3 give a rewrite that keeps the joke and placeholders exactly, <= 110 chars, one sentence, no em dashes, no exclamation marks. Return ONLY JSON array: [{"i":n,"ai_score":0-10,"verdict":"human"|"ai"|"unsure","rewrite":"..."}]\n\nLines:\n`;
const HARM_P = `You review roast captions for a public developer joke site. For EACH line answer whether it targets or implies anything about a protected trait, age, body, gender, race, religion, nationality, mental health, family, relationships, employer, salary/income, or real-life circumstances, instead of only GitHub/code habits. Return ONLY JSON array: [{"i":n,"pass":true|false,"reason":"..."}]\n\nLines:\n`;
const SENSITIVE = /\b(old|older|oldest|young|younger|boomer|grandpa|grandma|age|aged|ageing|man|woman|men|women|boy|girl|guy|gender|race|racial|religio\w*|church|god|body|fat|thin|bald|nationality|american|indian|chinese|russian|depress\w*|anxiety|anxious|therapy|adhd|autis\w*|mental|employer|boss|salary|income|wage|paycheck|rent|family|wife|husband|kids?|mom|dad|date|dates|dated|dating|girlfriend|boyfriend|marriage|married)\b/i;
const BANNED = /\b(delve|unleash|game-changer|landscape|crucial|notably|synergy|leverage)|\b(GPT|ChatGPT|OpenAI|Copilot|Cursor|Gemini|Grok|Devin|Windsurf)\b/;
const PH = (s: string) => (s.match(/\{[a-z]+\}/g) ?? []).sort().join(",");
const sub = (l: string) => l.replace(/\{repo\}/g, "abcdefghij0123456789").replace(/\{stale\}/g, "12").replace(/\{count\}/g, "123").replace(/\{lang\}/g, "JavaScript").replace(/\{stars\}/g, "123,456");
function valid(t: Trigger, s: string, keepPh?: string): boolean {
  const x = sub(s);
  if (!s || x.length > 110 || /[—–!#]/.test(x) || /\p{Extended_Pictographic}/u.test(x) || /[.?]\s+\S/.test(x) || !/[.?]$/.test(x)) return false;
  if (!/^[^{}]*(\{(repo|stale|count|lang|stars)\}[^{}]*)*$/.test(s)) return false;
  if (SENSITIVE.test(x.replace(/\{[a-z]+\}/g, "")) || BANNED.test(x)) return false;
  if (t === "longTimeOnGitHub" && !/GitHub|commits|public code/.test(s)) return false;
  if (keepPh !== undefined && PH(s) !== keepPh) return false;
  if (SLOT_TRIGGERS.includes(t) && !/\{(repo|stale|count)\}/.test(s)) return false;
  return true;
}
function rewriteWith(t: Trigger, old: string, why: string, keepPh: boolean): string {
  const slotNote = (t === "longTimeOnGitHub" ? " It must mention GitHub or public code and years, never personal age." : "") + SLOT_TRIGGERS.includes(t) ? " It must contain {repo}, {stale} or {count}." : "";
  const p = `Rewrite this roast caption for a developer joke site (trigger: ${t}). Problem: ${why}. Keep the joke about GitHub/code habits only, dry deadpan, Claude as narrator or subject, one sentence, <= 110 chars, no em or en dashes, no exclamation marks.${keepPh ? (PH(old) ? " Keep exactly these placeholders: " + PH(old) + "." : " Use NO placeholders and no curly braces at all.") : " Placeholders allowed: {repo} {stale} {lang} {count} {stars}."}${slotNote} Return ONLY JSON array: [{"i":1,"rewrite":"..."}]\n\nLine:\n1. ${old}`;
  for (let k = 0; k < 6; k++) {
    const r = json(p)[0]?.rewrite;
    if (process.env.DBG) console.log("cand:", r);
    if (typeof r === "string" && valid(t, r, keepPh ? PH(old) : undefined) && r !== old) return r;
  }
  if (keepPh) return rewriteWith(t, old, why, false);
  throw new Error("no valid rewrite for: " + old);
}
function replaceInFile(old: string, neu: string) {
  const src = readFileSync(FILE, "utf8");
  const a = JSON.stringify(old);
  if (!src.includes(a)) throw new Error("not found in file: " + old);
  writeFileSync(FILE, src.replace(a, JSON.stringify(neu)));
}

type Item = { t: Trigger; text: string; rounds: number; ai?: { ai_score: number; verdict: string }; harm?: { pass: boolean; reason: string } };
const items: Item[] = (Object.keys(LINES) as Trigger[]).flatMap((t) => LINES[t].map((text) => ({ t, text, rounds: 0 })));
const change = (it: Item, neu: string, keepRounds = true) => {
  replaceInFile(it.text, neu);
  it.text = neu; it.ai = undefined; it.harm = undefined;
  if (!keepRounds) it.rounds = 0;
};
const chunks = <T,>(a: T[]) => Array.from({ length: Math.ceil(a.length / BATCH) }, (_, i) => a.slice(i * BATCH, (i + 1) * BATCH));

let iter = 0, reviewCalls = 0, rewrites = 0, replacements = 0, harmFails = 0;
while (items.some((i) => !i.ai || !i.harm?.pass)) {
  if (++iter > 40) throw new Error("did not converge");
  for (const ch of chunks(items.filter((i) => !i.ai))) {
    reviewCalls++;
    const res = json(AI_P + numbered(ch.map((c) => c.text)));
    ch.forEach((it, k) => {
      const r = res.find((x) => x.i === k + 1);
      if (!r) return; // re-reviewed next iteration
      const bad = r.ai_score > 3 || r.verdict === "ai";
      if (!bad) { it.ai = { ai_score: r.ai_score, verdict: r.verdict }; return; }
      if (it.rounds < 2) {
        const keep = PH(it.text);
        const rw = typeof r.rewrite === "string" && valid(it.t, r.rewrite, keep) && r.rewrite !== it.text ? r.rewrite : rewriteWith(it.t, it.text, "reads as AI-written", true);
        change(it, rw); it.rounds++; rewrites++;
      } else {
        change(it, rewriteWith(it.t, it.text, "reads as AI-written, write a fresh different joke", false), false); replacements++;
      }
    });
  }
  for (const ch of chunks(items.filter((i) => i.ai && !i.harm?.pass))) {
    reviewCalls++;
    const res = json(HARM_P + numbered(ch.map((c) => c.text)));
    ch.forEach((it, k) => {
      const r = res.find((x) => x.i === k + 1);
      if (!r) return;
      if (r.pass === true) { it.harm = { pass: true, reason: String(r.reason ?? "") }; return; }
      harmFails++;
      change(it, rewriteWith(it.t, it.text, "flagged by harm review: " + r.reason, false), false);
    });
  }
  console.log(`iter ${iter}: pending ${items.filter((i) => !i.ai || !i.harm?.pass).length}`);
}
const stamp = new Date().toISOString();
writeFileSync(EVID + "task-4-ai-review.json", JSON.stringify({ stamp, count: items.length, lines: items.map((i) => ({ trigger: i.t, line: i.text, ...i.ai })) }, null, 2));
writeFileSync(EVID + "task-4-harm-review.json", JSON.stringify({ stamp, count: items.length, lines: items.map((i) => ({ trigger: i.t, line: i.text, pass: i.harm!.pass, reason: i.harm!.reason })) }, null, 2));
console.log({ lines: items.length, iter, reviewCalls, rewrites, replacements, harmFails, parseRetries: fails });
