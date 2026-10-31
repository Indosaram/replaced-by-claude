import type { GhRepo, GhUser, Result, Signals, Tier } from "./types.ts";

export const MIN_MINUTES = 3;
export const MAX_MINUTES = 129_600; // 90 days
export const AUTOGRAPH_STARS = 250_000;

const DAY_MS = 86_400_000;
const STALE_MS = 365 * DAY_MS;
const TUTORIAL_RE = /todo|clone|tutorial|practice|test|demo|hello|portfolio|dotfiles|leetcode/i;

/** FNV-1a 32-bit over the UTF-8 bytes of the lowercased username. */
export function hashSeed(username: string): number {
  let h = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(username.toLowerCase())) {
    h ^= byte;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32: returns floats in [0, 1). */
export function seededRandom(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ratio(count: number, total: number): number {
  return total === 0 ? 0 : count / total;
}

function pushedMs(repo: GhRepo): number {
  const t = Date.parse(repo.pushed_at);
  return Number.isNaN(t) ? 0 : t;
}

function wholeYearsSince(createdAt: string, now: Date): number {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return 0;
  let years = now.getUTCFullYear() - created.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - created.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < created.getUTCDate())) years -= 1;
  return Math.max(0, years);
}

export function extractSignals(user: GhUser, repos: GhRepo[], now: Date): Signals {
  const n = repos.length;
  const nowMs = now.getTime();

  let forks = 0;
  let totalStars = 0;
  let stale = 0;
  let tutorials = 0;
  let noDescription = 0;
  const langCounts = new Map<string, number>();

  let newest: GhRepo | null = null;
  let mostStarred: GhRepo | null = null;
  let oldestStale: GhRepo | null = null;
  let tutorialRepo: GhRepo | null = null;

  for (const repo of repos) {
    if (repo.fork) forks += 1;
    totalStars += repo.stargazers_count;
    if (repo.language) langCounts.set(repo.language, (langCounts.get(repo.language) ?? 0) + 1);
    if (!repo.description || repo.description.trim() === "") noDescription += 1;

    const pushed = pushedMs(repo);
    if (nowMs - pushed > STALE_MS) {
      stale += 1;
      if (!repo.fork && (oldestStale === null || pushed < pushedMs(oldestStale))) oldestStale = repo;
    }
    if (TUTORIAL_RE.test(repo.name)) {
      tutorials += 1;
      if (!repo.fork) tutorialRepo ??= repo;
    }

    // Named repos are never forks; the counts and star totals above still include them.
    if (repo.fork) continue;
    if (mostStarred === null || repo.stargazers_count > mostStarred.stargazers_count) mostStarred = repo;
    // The later push wins (first seen on ties).
    if (newest === null || pushed > pushedMs(newest)) newest = repo;
  }

  const ranked = [...langCounts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  return {
    publicRepos: n,
    totalPublicRepos: Math.max(user.public_repos ?? 0, n),
    forkRatio: ratio(forks, n),
    totalStars,
    topLanguages: ranked.slice(0, 3).map(([lang]) => lang),
    langCount: langCounts.size,
    topLanguageShare: ranked.length > 0 ? ratio(ranked[0]![1], n) : 0,
    staleRepoCount: stale,
    staleRatio: ratio(stale, n),
    tutorialRepoCount: tutorials,
    tutorialRatio: ratio(tutorials, n),
    noDescriptionCount: noDescription,
    accountAgeYears: wholeYearsSince(user.created_at, now),
    followers: user.followers,
    newestRepoName: newest ? newest.name : null,
    mostStarredRepoName: mostStarred && mostStarred.stargazers_count > 0 ? mostStarred.name : null,
    oldestStaleRepoName: oldestStale ? oldestStale.name : null,
    tutorialRepoName: tutorialRepo ? tutorialRepo.name : null,
  };
}

export function clampMinutes(m: number): number {
  if (!Number.isFinite(m)) return MIN_MINUTES;
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, m));
}

export function tierFor(minutes: number): Tier {
  if (minutes < 60) return "instant";
  if (minutes < 48 * 60) return "hours";
  if (minutes < 14 * 24 * 60) return "days";
  return "weeks";
}

export function formatMinutes(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m}m`;
  if (m < 48 * 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  const d = Math.floor(m / 1440);
  return `${d}d ${Math.floor((m % 1440) / 60)}h`;
}

export function analyze(user: GhUser, repos: GhRepo[], now: Date): Result {
  const signals = extractSignals(user, repos, now);
  const seed = hashSeed(user.login);
  const rand = seededRandom(seed);

  let m = 240;
  m *= 1 - 0.5 * signals.tutorialRatio;
  if (signals.forkRatio > 0.5) m *= 0.6;
  m *= 1 + Math.log10(1 + signals.totalStars);
  m *= Math.pow(1.5, Math.max(Math.min(signals.langCount, 3), 1) - 1);
  if (signals.staleRatio > 0.6) m *= 0.7;
  m *= 0.85 + 0.3 * rand();

  const minutes = Math.round(clampMinutes(m));
  return {
    login: user.login,
    minutes,
    label: formatMinutes(minutes),
    tier: tierFor(minutes),
    autograph: signals.totalStars >= AUTOGRAPH_STARS,
    signals,
    seed,
  };
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** Two computed facts, joined by ' · '. Never mentions the visitor's age beyond 'N years on GitHub'. */
export function factsLine(s: Signals): string {
  if (s.publicRepos === 0) return "0 public repos · nothing to replace, technically";

  const n = s.publicRepos;
  const facts: string[] = [];

  if (s.staleRepoCount > 0) {
    facts.push(`${s.staleRepoCount} of ${n} ${plural(n, "repo", "repos")} untouched for a year`);
  }
  if (s.tutorialRepoCount > 0) {
    facts.push(
      s.tutorialRepoCount === 1
        ? "1 named like a tutorial"
        : `${s.tutorialRepoCount} named like tutorials`,
    );
  }
  const forkPct = Math.round(s.forkRatio * 100);
  if (forkPct >= 1) facts.push(`${forkPct}% of repos are forks`);
  const topLang = s.topLanguages[0];
  if (topLang !== undefined) {
    facts.push(`${topLang} in ${Math.round(s.topLanguageShare * 100)}% of repos`);
  }
  if (s.totalStars > 0) {
    facts.push(`${Math.round(s.totalStars).toLocaleString("en-US")} ${plural(s.totalStars, "star", "stars")} total`);
  }
  if (s.accountAgeYears >= 1) {
    facts.push(`${s.accountAgeYears} ${plural(s.accountAgeYears, "year", "years")} on GitHub`);
  }
  facts.push(`${n} public ${plural(n, "repo", "repos")}`);

  return facts.slice(0, 2).join(" · ");
}
