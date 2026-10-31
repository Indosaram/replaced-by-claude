import { describe, expect, test } from "bun:test";
import { fetchProfile, formatReset, normalizeUsername } from "../src/github.ts";
import type { GhRepo, GhUser } from "../src/types.ts";

const USER: GhUser = { login: "torvalds", public_repos: 1, followers: 5, created_at: "2011-09-03T15:26:22Z" };
const REPOS: GhRepo[] = [
  { name: "linux", fork: false, stargazers_count: 100, language: "C", pushed_at: "2024-01-01T00:00:00Z", description: "kernel" },
];

const USER_URL = "https://api.github.com/users/torvalds";
const REPOS_URL = "https://api.github.com/users/torvalds/repos?per_page=100&sort=pushed";

type Call = { url: string; init?: RequestInit };

function fakeFetch(respond: (url: string) => Response | Error) {
  const calls: Call[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const r = respond(url);
    if (r instanceof Error) throw r;
    return r;
  }) as typeof fetch;
  return { impl, calls };
}

const json = (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), init);
const okResponder = (url: string) => (url.includes("/repos") ? json(REPOS) : json(USER));

function memoryStorage(): Storage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  };
}

describe("normalizeUsername", () => {
  test("accepts plain and decorated handles", () => {
    expect(normalizeUsername("torvalds")).toBe("torvalds");
    expect(normalizeUsername("  @torvalds  ")).toBe("torvalds");
    expect(normalizeUsername("https://github.com/gaearon/")).toBe("gaearon");
    expect(normalizeUsername("http://www.github.com/sindresorhus")).toBe("sindresorhus");
    expect(normalizeUsername("github.com/tj/repo")).toBe("tj");
  });

  test("rejects invalid logins", () => {
    expect(normalizeUsername("@@bad name")).toBeNull();
    expect(normalizeUsername("-x")).toBeNull();
    expect(normalizeUsername("x-")).toBeNull();
    expect(normalizeUsername("a--b")).toBeNull();
    expect(normalizeUsername("")).toBeNull();
    expect(normalizeUsername("   ")).toBeNull();
    expect(normalizeUsername("a".repeat(40))).toBeNull();
  });
});

describe("fetchProfile", () => {
  test("success makes exactly 2 sequential requests and caches the result", async () => {
    const { impl, calls } = fakeFetch(okResponder);
    const storage = memoryStorage();
    const r = await fetchProfile("torvalds", { fetchImpl: impl, storage, now: () => 1_000 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.cached).toBe(false);
    expect(r.profile).toEqual({ user: USER, repos: REPOS, fetchedAt: 1_000 });
    expect(calls.map((c) => c.url)).toEqual([USER_URL, REPOS_URL]);
    for (const c of calls) {
      const headers = new Headers(c.init?.headers);
      expect(headers.get("accept")).toBe("application/vnd.github+json");
      expect(headers.has("authorization")).toBe(false);
    }
    expect(JSON.parse(storage.data.get("rbc:v1:torvalds")!)).toEqual({ user: USER, repos: REPOS, fetchedAt: 1_000 });
  });

  test("cache key is lower-cased login; URL encodes the login as given", async () => {
    const { impl, calls } = fakeFetch(okResponder);
    const storage = memoryStorage();
    await fetchProfile("TorValds", { fetchImpl: impl, storage, now: () => 1 });
    expect(calls[0]!.url).toBe("https://api.github.com/users/TorValds");
    expect(storage.data.has("rbc:v1:torvalds")).toBe(true);
  });

  test("second call within 24h hits the cache with no network", async () => {
    const { impl, calls } = fakeFetch(okResponder);
    const storage = memoryStorage();
    await fetchProfile("torvalds", { fetchImpl: impl, storage, now: () => 1_000 });
    const r = await fetchProfile("torvalds", { fetchImpl: impl, storage, now: () => 1_000 + 86_400_000 - 1 });
    expect(calls.length).toBe(2);
    expect(r.ok && r.cached).toBe(true);
  });

  test("refetches once the cache is 24h old", async () => {
    const { impl, calls } = fakeFetch(okResponder);
    const storage = memoryStorage();
    await fetchProfile("torvalds", { fetchImpl: impl, storage, now: () => 1_000 });
    const r = await fetchProfile("torvalds", { fetchImpl: impl, storage, now: () => 1_000 + 86_400_000 });
    expect(calls.length).toBe(4);
    expect(r.ok && !r.cached && r.profile.fetchedAt === 1_000 + 86_400_000).toBe(true);
  });

  test("ignores corrupt cache entries", async () => {
    const { impl, calls } = fakeFetch(okResponder);
    const storage = memoryStorage();
    storage.setItem("rbc:v1:torvalds", "{not json");
    const r = await fetchProfile("torvalds", { fetchImpl: impl, storage, now: () => 5 });
    expect(r.ok && !r.cached).toBe(true);
    expect(calls.length).toBe(2);
  });

  test("works with storage null", async () => {
    const { impl, calls } = fakeFetch(okResponder);
    const r = await fetchProfile("torvalds", { fetchImpl: impl, storage: null, now: () => 5 });
    expect(r.ok).toBe(true);
    expect(calls.length).toBe(2);
  });

  test("404 -> not_found and repos are not requested", async () => {
    const { impl, calls } = fakeFetch(() => json({ message: "Not Found" }, { status: 404 }));
    const r = await fetchProfile("torvalds", { fetchImpl: impl, storage: memoryStorage() });
    expect(r).toEqual({ ok: false, error: { kind: "not_found" } });
    expect(calls.map((c) => c.url)).toEqual([USER_URL]);
  });

  test("403 with remaining 0 -> rate_limited with the reset Date", async () => {
    const { impl } = fakeFetch(() =>
      json({}, { status: 403, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1700000000" } }),
    );
    const r = await fetchProfile("torvalds", { fetchImpl: impl, storage: null });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.kind).toBe("rate_limited");
    if (r.error.kind !== "rate_limited") return;
    expect(r.error.resetAt?.getTime()).toBe(1_700_000_000_000);
  });

  test("rate limit without a reset header -> resetAt null", async () => {
    const { impl } = fakeFetch(() => json({}, { status: 429, headers: { "x-ratelimit-remaining": "0" } }));
    const r = await fetchProfile("torvalds", { fetchImpl: impl, storage: null });
    expect(r).toEqual({ ok: false, error: { kind: "rate_limited", resetAt: null } });
  });

  test("403 without rate-limit headers -> busy", async () => {
    const { impl } = fakeFetch(() => json({}, { status: 403 }));
    const r = await fetchProfile("torvalds", { fetchImpl: impl, storage: null });
    expect(r).toEqual({ ok: false, error: { kind: "busy" } });
  });

  test("429 with remaining 0 -> rate_limited", async () => {
    const { impl } = fakeFetch(() =>
      json({}, { status: 429, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1700000100" } }),
    );
    const r = await fetchProfile("torvalds", { fetchImpl: impl, storage: null });
    expect(r.ok).toBe(false);
    if (r.ok || r.error.kind !== "rate_limited") throw new Error("expected rate_limited");
    expect(r.error.resetAt?.getTime()).toBe(1_700_000_100_000);
  });

  test("429 with remaining > 0 -> busy", async () => {
    const { impl } = fakeFetch(() => json({}, { status: 429, headers: { "x-ratelimit-remaining": "3" } }));
    const r = await fetchProfile("torvalds", { fetchImpl: impl, storage: null });
    expect(r).toEqual({ ok: false, error: { kind: "busy" } });
  });

  test("fetch throwing TypeError -> offline", async () => {
    const { impl } = fakeFetch(() => new TypeError("Failed to fetch"));
    const r = await fetchProfile("torvalds", { fetchImpl: impl, storage: null });
    expect(r).toEqual({ ok: false, error: { kind: "offline" } });
  });

  test("500 -> unknown with status", async () => {
    const { impl } = fakeFetch(() => json({}, { status: 500 }));
    const r = await fetchProfile("torvalds", { fetchImpl: impl, storage: null });
    expect(r).toEqual({ ok: false, error: { kind: "unknown", status: 500 } });
  });

  test("repos request failing maps the same way", async () => {
    const { impl, calls } = fakeFetch((url) => (url.includes("/repos") ? json({}, { status: 500 }) : json(USER)));
    const storage = memoryStorage();
    const r = await fetchProfile("torvalds", { fetchImpl: impl, storage });
    expect(r).toEqual({ ok: false, error: { kind: "unknown", status: 500 } });
    expect(calls.length).toBe(2);
    expect(storage.data.size).toBe(0);
  });

  test("setItem throwing (quota) still returns ok", async () => {
    const { impl } = fakeFetch(okResponder);
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
    const r = await fetchProfile("torvalds", { fetchImpl: impl, storage, now: () => 1 });
    expect(r.ok && !r.cached).toBe(true);
  });
});

describe("formatReset", () => {
  test("null -> vague fallback", () => {
    expect(formatReset(null)).toBe("in a few minutes");
  });

  test("formats local HH:MM with zero padding", () => {
    expect(formatReset(new Date(2024, 0, 2, 3, 4))).toBe("03:04");
    expect(formatReset(new Date(2024, 0, 2, 23, 59))).toBe("23:59");
  });
});
