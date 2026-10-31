import { describe, expect, test } from "bun:test";
import { LINES, SLOT_TRIGGERS, pickLines, triggersFor, type Trigger } from "../src/lines";
import { extractSignals } from "../src/engine";
import torvaldsLike from "./fixtures/torvalds-like.json";
import junior from "./fixtures/junior.json";
import nulls from "./fixtures/nulls.json";

const NOW = new Date("2026-01-01T00:00:00Z");
const sig = (f: any) => extractSignals(f.user, f.repos, NOW);
const fixtures = { torvaldsLike: sig(torvaldsLike), junior: sig(junior), nulls: sig(nulls) };
const all: [Trigger, string][] = (Object.keys(LINES) as Trigger[]).flatMap((t) => LINES[t].map((l) => [t, l] as [Trigger, string]));
const sub = (l: string) =>
  l.replace(/\{repo\}/g, "abcdefghij0123456789").replace(/\{stale\}/g, "12").replace(/\{count\}/g, "123")
    .replace(/\{lang\}/g, "JavaScript").replace(/\{stars\}/g, "123,456");

describe("lines", () => {
  test("counts", () => {
    for (const t of Object.keys(LINES) as Trigger[]) expect(LINES[t].length).toBeGreaterThanOrEqual(t === "generic" ? 20 : 10);
  });
  test("slot triggers all slotted", () => {
    for (const t of SLOT_TRIGGERS) for (const l of LINES[t]) expect(l).toMatch(/\{(repo|stale|count)\}/);
  });
  test("length, one sentence, dashes, chars", () => {
    for (const [, l] of all) {
      const s = sub(l);
      expect(s.length).toBeLessThanOrEqual(110);
      expect(s).not.toMatch(/[—–]/);
      expect(s).not.toMatch(/[!#]/);
      expect(s).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(s.match(/[.?]\s+\S/g)).toBeNull();
      expect(s).toMatch(/[.?]$/);
    }
  });
  test("banned words and vendors", () => {
    for (const [, l] of all) {
      expect(l).not.toMatch(/\b(delve|unleash|game-changer|landscape|crucial|notably|synergy|leverage)/i);
      expect(l).not.toMatch(/\b(GPT|ChatGPT|OpenAI|Copilot|Cursor|Gemini|Grok|Devin|Windsurf)\b/);
    }
  });
  test("sensitive topics", () => {
    const re = /\b(old|older|oldest|young|younger|boomer|grandpa|grandma|age|aged|ageing|man|woman|men|women|boy|girl|guy|gender|race|racial|religio\w*|church|god|body|fat|thin|bald|nationality|american|indian|chinese|russian|depress\w*|anxiety|anxious|therapy|adhd|autis\w*|mental|employer|boss|salary|income|wage|paycheck|rent|family|wife|husband|kids?|mom|dad|date|dates|dated|dating|girlfriend|boyfriend|marriage|married)\b/i;
    for (const [, l] of all) expect(sub(l).replace(/\{[a-z]+\}/g, "")).not.toMatch(re);
  });
  test("longTimeOnGitHub never personal age", () => {
    for (const l of LINES.longTimeOnGitHub) expect(l).toMatch(/GitHub|commits|public code/);
  });
  test("placeholders known", () => {
    for (const [, l] of all) expect(sub(l)).not.toMatch(/[{}]/);
  });
  test("triggersFor ends in generic", () => {
    for (const s of Object.values(fixtures)) expect(triggersFor(s).at(-1)).toBe("generic");
  });
});

describe("pickLines", () => {
  for (const [name, s] of Object.entries(fixtures)) {
    test(`${name}: 3 distinct, resolved, deterministic`, () => {
      for (let seed = 0; seed < 200; seed++) {
        const a = pickLines(s, seed);
        expect(a.length).toBe(3);
        expect(new Set(a).size).toBe(3);
        for (const l of a) expect(l).not.toMatch(/[{}]/);
        expect(pickLines(s, seed)).toEqual(a);
        if (s.publicRepos >= 1) {
          const names = [s.tutorialRepoName, s.oldestStaleRepoName, s.mostStarredRepoName, s.newestRepoName].filter(Boolean) as string[];
          const slotted = a.filter((l) =>
            names.some((n) => l.includes(n)) || l.includes(String(s.publicRepos)) || l.includes(String(s.staleRepoCount)) || l.includes(String(s.tutorialRepoCount)));
          expect(slotted.length).toBeGreaterThanOrEqual(2);
        }
      }
    });
  }
  test("empty profile still yields 3 clean lines", () => {
    const s = { ...fixtures.junior, publicRepos: 0, newestRepoName: null, mostStarredRepoName: null, oldestStaleRepoName: null,
      tutorialRepoName: null, tutorialRepoCount: 0, staleRepoCount: 0, topLanguages: [], totalStars: 0, noDescriptionCount: 0 };
    for (let seed = 0; seed < 50; seed++) {
      const a = pickLines(s, seed);
      expect(new Set(a).size).toBe(3);
      for (const l of a) expect(l).not.toMatch(/[{}]/);
    }
  });
  test("singular repo grammar", () => {
    const s = { ...fixtures.junior, tutorialRepoCount: 1, publicRepos: 1, staleRepoCount: 1 };
    for (let seed = 0; seed <= 200; seed++) for (const l of pickLines(s, seed)) expect(l).not.toMatch(/\b1 (public |tutorial )?repos\b/);
  });
});
