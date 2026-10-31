import { describe, expect, test } from "bun:test";
import {
  analyze,
  clampMinutes,
  extractSignals,
  factsLine,
  formatMinutes,
  hashSeed,
  seededRandom,
} from "../src/engine.ts";
import type { GhRepo, GhUser } from "../src/types.ts";
import torvaldsLike from "./fixtures/torvalds-like.json";
import junior from "./fixtures/junior.json";
import empty from "./fixtures/empty.json";
import nulls from "./fixtures/nulls.json";

type Fixture = { user: GhUser; repos: GhRepo[] };

const NOW = new Date("2026-10-30T12:00:00Z");
const fixtures: Record<string, Fixture> = {
  "torvalds-like": torvaldsLike,
  junior,
  empty,
  nulls,
};

function repo(over: Partial<GhRepo> = {}): GhRepo {
  return {
    name: "thing",
    fork: false,
    stargazers_count: 0,
    language: "TypeScript",
    pushed_at: "2026-10-01T00:00:00Z",
    description: "d",
    ...over,
  };
}

function starFixture(stars: number): Fixture {
  return {
    user: { login: "famous", public_repos: 1, followers: 1, created_at: "2010-01-01T00:00:00Z" },
    repos: [repo({ name: "big", stargazers_count: stars })],
  };
}

describe("hashSeed / seededRandom", () => {
  test("hashSeed is case-insensitive and matches FNV-1a vectors", () => {
    expect(hashSeed("TorValds")).toBe(hashSeed("torvalds"));
    expect(hashSeed("")).toBe(0x811c9dc5);
    expect(hashSeed("a")).toBe(0xe40c292c);
  });

  test("seededRandom is deterministic and in [0, 1)", () => {
    const a = seededRandom(123);
    const b = seededRandom(123);
    for (let i = 0; i < 50; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(seededRandom(1)()).not.toBe(seededRandom(2)());
  });
});

describe("analyze", () => {
  test("same input twice deep-equals", () => {
    for (const { user, repos } of Object.values(fixtures)) {
      expect(analyze(user, repos, NOW)).toEqual(analyze(user, repos, NOW));
    }
  });

  test("username case does not change the outcome", () => {
    const { user, repos } = fixtures["torvalds-like"]!;
    const a = analyze({ ...user, login: "TorValds" }, repos, NOW);
    const b = analyze({ ...user, login: "torvalds" }, repos, NOW);
    expect(a.minutes).toBe(b.minutes);
    expect(a.label).toBe(b.label);
  });

  test("zero repos: numeric label, zero ratios, no NaN/undefined", () => {
    const { user, repos } = fixtures.empty!;
    const r = analyze(user, repos, NOW);
    expect(r.label).toMatch(/^\d/);
    expect(r.signals.publicRepos).toBe(0);
    expect(r.signals.forkRatio).toBe(0);
    expect(r.signals.staleRatio).toBe(0);
    expect(r.signals.tutorialRatio).toBe(0);
    expect(r.signals.topLanguageShare).toBe(0);
    expect(r.signals.newestRepoName).toBeNull();
    expect(r.signals.mostStarredRepoName).toBeNull();
    expect(r.signals.oldestStaleRepoName).toBeNull();
    expect(r.signals.tutorialRepoName).toBeNull();
    const json = JSON.stringify(r);
    expect(json).not.toContain("NaN");
    expect(json).not.toContain("undefined");
    expect(Number.isInteger(r.minutes)).toBe(true);
  });

  test("null language / description and 0 stars do not throw", () => {
    const { user, repos } = fixtures.nulls!;
    const r = analyze(user, repos, NOW);
    expect(r.signals.topLanguages).toEqual([]);
    expect(r.signals.langCount).toBe(0);
    expect(r.signals.noDescriptionCount).toBe(3);
    expect(r.signals.totalStars).toBe(0);
    expect(r.signals.newestRepoName).toBe("c"); // non-fork preferred, newest push
    expect(r.signals.mostStarredRepoName).toBeNull();
    const json = JSON.stringify(r);
    expect(json).not.toContain("NaN");
    expect(json).not.toContain("undefined");
    expect(r.label).toMatch(/^\d/);
  });

  test("250000 stars is an autograph, 249999 is not; label stays numeric", () => {
    const a = starFixture(250_000);
    const ra = analyze(a.user, a.repos, NOW);
    expect(ra.autograph).toBe(true);
    expect(ra.label).toMatch(/^\d/);
    const b = starFixture(249_999);
    const rb = analyze(b.user, b.repos, NOW);
    expect(rb.autograph).toBe(false);
    expect(rb.label).toMatch(/^\d/);
  });

  test("torvalds-like fixture is an autograph; junior is not", () => {
    const t = fixtures["torvalds-like"]!;
    const j = fixtures.junior!;
    expect(analyze(t.user, t.repos, NOW).autograph).toBe(true);
    expect(analyze(j.user, j.repos, NOW).autograph).toBe(false);
  });

  test("junior replaces faster than the high-star user", () => {
    const t = fixtures["torvalds-like"]!;
    const j = fixtures.junior!;
    expect(analyze(j.user, j.repos, NOW).minutes).toBeLessThan(analyze(t.user, t.repos, NOW).minutes);
  });

  test("formula is applied exactly for a known case", () => {
    const user: GhUser = { login: "formula", public_repos: 1, followers: 0, created_at: "2020-01-01T00:00:00Z" };
    const repos = [repo({ stargazers_count: 9 })];
    const rand = seededRandom(hashSeed("formula"))();
    const expected = Math.round(240 * (1 + Math.log10(10)) * (0.85 + 0.3 * rand));
    const r = analyze(user, repos, NOW);
    expect(r.minutes).toBe(expected);
    expect(r.seed).toBe(hashSeed("formula"));
  });

  test("minutes are clamped to [3, 129600]", () => {
    expect(clampMinutes(-5)).toBe(3);
    expect(clampMinutes(0)).toBe(3);
    expect(clampMinutes(1e9)).toBe(129_600);
    for (const stars of [0, 10, 1_000_000_000_000]) {
      const f = starFixture(stars);
      const r = analyze(f.user, f.repos, NOW);
      expect(r.minutes).toBeGreaterThanOrEqual(3);
      expect(r.minutes).toBeLessThanOrEqual(129_600);
    }
    // 3 languages + 1e300 stars: raw value is ~186k min, so analyze() must land exactly on the cap.
    const huge: Fixture = {
      user: { login: "cap", public_repos: 3, followers: 0, created_at: "2010-01-01T00:00:00Z" },
      repos: [
        repo({ name: "a", language: "Go", stargazers_count: 1e300 }),
        repo({ name: "b", language: "Rust" }),
        repo({ name: "c", language: "Zig" }),
      ],
    };
    const capped = analyze(huge.user, huge.repos, NOW);
    expect(capped.minutes).toBe(129_600);
    expect(capped.label).toBe("90d 0h");
    expect(capped.tier).toBe("weeks");
  });

  test("tiers follow the minute thresholds", () => {
    const tierOf = (stars: number) => {
      const f = starFixture(stars);
      return analyze(f.user, f.repos, NOW);
    };
    const r = tierOf(0);
    expect(r.tier).toBe(r.minutes < 60 ? "instant" : r.minutes < 2880 ? "hours" : r.minutes < 20160 ? "days" : "weeks");
    expect(tierOf(1e300).tier).toBe("weeks");
  });
});

describe("formatMinutes", () => {
  test("boundaries", () => {
    expect(formatMinutes(3)).toBe("3m");
    expect(formatMinutes(59)).toBe("59m");
    expect(formatMinutes(60)).toBe("1h 0m");
    expect(formatMinutes(252)).toBe("4h 12m");
    expect(formatMinutes(2879)).toBe("47h 59m");
    expect(formatMinutes(2880)).toBe("2d 0h");
    expect(formatMinutes(129_600)).toBe("90d 0h");
  });
});

describe("extractSignals", () => {
  test("junior fixture signals", () => {
    const { user, repos } = fixtures.junior!;
    const s = extractSignals(user, repos, NOW);
    expect(s.publicRepos).toBe(12);
    expect(s.forkRatio).toBeCloseTo(4 / 12);
    expect(s.totalStars).toBe(3);
    expect(s.staleRepoCount).toBe(10);
    expect(s.staleRatio).toBeCloseTo(10 / 12);
    expect(s.oldestStaleRepoName).toBe("hello-world");
    expect(s.tutorialRepoName).toBe("todo-app");
    expect(s.tutorialRepoCount).toBe(8);
    expect(s.topLanguages).toEqual(["JavaScript", "Python", "C"]);
    expect(s.langCount).toBe(4);
    expect(s.accountAgeYears).toBe(6);
    expect(s.newestRepoName).toBe("notes");
    expect(s.mostStarredRepoName).toBe("leetcode-solutions");
  });

  test("stale uses a strict 365 day cutoff", () => {
    const now = new Date("2026-10-30T00:00:00Z");
    const edge = new Date(now.getTime() - 365 * 86_400_000).toISOString();
    const over = new Date(now.getTime() - 365 * 86_400_000 - 1000).toISOString();
    const s = extractSignals(
      { login: "x", public_repos: 2, followers: 0, created_at: "2020-01-01T00:00:00Z" },
      [repo({ name: "edge", pushed_at: edge }), repo({ name: "over", pushed_at: over })],
      now,
    );
    expect(s.staleRepoCount).toBe(1);
    expect(s.oldestStaleRepoName).toBe("over");
  });

  test("newest repo prefers non-forks even when a fork is newer", () => {
    const s = extractSignals(
      { login: "x", public_repos: 2, followers: 0, created_at: "2020-01-01T00:00:00Z" },
      [repo({ name: "fork", fork: true, pushed_at: "2026-10-29T00:00:00Z" }), repo({ name: "own", pushed_at: "2026-01-01T00:00:00Z" })],
      NOW,
    );
    expect(s.newestRepoName).toBe("own");
  });

  test("account age floors to whole years", () => {
    const base = { login: "x", public_repos: 0, followers: 0 };
    expect(extractSignals({ ...base, created_at: "2025-11-01T00:00:00Z" }, [], NOW).accountAgeYears).toBe(0);
    expect(extractSignals({ ...base, created_at: "2025-10-30T00:00:00Z" }, [], NOW).accountAgeYears).toBe(1);
    expect(extractSignals({ ...base, created_at: "2011-09-03T15:26:22Z" }, [], NOW).accountAgeYears).toBe(15);
  });

  test("publicRepos is the sample size, not user.public_repos", () => {
    const s = extractSignals({ login: "x", public_repos: 99, followers: 0, created_at: "2020-01-01T00:00:00Z" }, [], NOW);
    expect(s.publicRepos).toBe(0);
    expect(s.totalPublicRepos).toBe(99);
  });

  test("totalPublicRepos reflects the real count while publicRepos stays the 100-repo sample", () => {
    const sample = Array.from({ length: 100 }, (_, i) => repo({ name: `r${i}` }));
    const s = extractSignals({ login: "x", public_repos: 351, followers: 0, created_at: "2020-01-01T00:00:00Z" }, sample, NOW);
    expect(s.totalPublicRepos).toBe(351);
    expect(s.publicRepos).toBe(100);
    expect(s.staleRatio).toBe(0);
  });

  test("totalPublicRepos never drops below the sample size", () => {
    const sample = [repo({ name: "a" }), repo({ name: "b" })];
    const s = extractSignals({ login: "x", public_repos: 1, followers: 0, created_at: "2020-01-01T00:00:00Z" }, sample, NOW);
    expect(s.totalPublicRepos).toBe(2);
  });

  test("fork-only repos are never named, but still counted", () => {
    const s = extractSignals(
      { login: "x", public_repos: 4, followers: 0, created_at: "2020-01-01T00:00:00Z" },
      [
        repo({ name: "react", fork: true, stargazers_count: 200_000, pushed_at: "2015-01-01T00:00:00Z" }),
        repo({ name: "todo-fork", fork: true, pushed_at: "2015-01-01T00:00:00Z" }),
        repo({ name: "mine", stargazers_count: 5, pushed_at: "2020-01-01T00:00:00Z" }),
        repo({ name: "fresh", stargazers_count: 1, pushed_at: "2026-10-01T00:00:00Z" }),
      ],
      NOW,
    );
    expect(s.oldestStaleRepoName).toBe("mine");
    expect(s.mostStarredRepoName).toBe("mine");
    expect(s.tutorialRepoName).toBeNull();
    expect(s.staleRepoCount).toBe(3);
    expect(s.tutorialRepoCount).toBe(1);
    expect(s.totalStars).toBe(200_006);
  });

  test("an all-fork profile names no repo at all", () => {
    const s = extractSignals(
      { login: "x", public_repos: 2, followers: 0, created_at: "2020-01-01T00:00:00Z" },
      [
        repo({ name: "react", fork: true, stargazers_count: 9, pushed_at: "2015-01-01T00:00:00Z" }),
        repo({ name: "demo", fork: true, stargazers_count: 3, pushed_at: "2026-10-01T00:00:00Z" }),
      ],
      NOW,
    );
    expect(s.newestRepoName).toBeNull();
    expect(s.oldestStaleRepoName).toBeNull();
    expect(s.mostStarredRepoName).toBeNull();
    expect(s.tutorialRepoName).toBeNull();
    expect(s.publicRepos).toBe(2);
    expect(s.staleRepoCount).toBe(1);
    expect(s.tutorialRepoCount).toBe(1);
  });
});

describe("factsLine", () => {
  test("non-empty for every fixture, and never NaN/undefined", () => {
    for (const { user, repos } of Object.values(fixtures)) {
      const line = factsLine(analyze(user, repos, NOW).signals);
      expect(line.length).toBeGreaterThan(0);
      expect(line).not.toContain("NaN");
      expect(line).not.toContain("undefined");
    }
  });

  test("zero repos", () => {
    const { user, repos } = fixtures.empty!;
    expect(factsLine(analyze(user, repos, NOW).signals)).toBe("0 public repos · nothing to replace, technically");
  });

  test("junior leads with stale and tutorial counts", () => {
    const { user, repos } = fixtures.junior!;
    expect(factsLine(analyze(user, repos, NOW).signals)).toBe("10 of 12 repos untouched for a year · 8 named like tutorials");
  });

  test("always two facts joined by ' · ' when there are repos", () => {
    for (const key of ["torvalds-like", "junior", "nulls"]) {
      const { user, repos } = fixtures[key]!;
      expect(factsLine(analyze(user, repos, NOW).signals).split(" · ")).toHaveLength(2);
    }
  });

  test("age only ever appears as 'N years on GitHub'", () => {
    for (const { user, repos } of Object.values(fixtures)) {
      const line = factsLine(analyze(user, repos, NOW).signals);
      expect(line).not.toMatch(/\bold\b|years? old|aged?\b/i);
    }
  });
});
