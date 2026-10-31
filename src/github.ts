import type { GhRepo, GhUser } from "./types.ts";

export const USERNAME_RE = /^[a-z\d](?:[a-z\d-]{0,38})$/i;

export type FetchError =
  | { kind: "not_found" }
  | { kind: "rate_limited"; resetAt: Date | null }
  | { kind: "busy" }
  | { kind: "offline" }
  | { kind: "unknown"; status: number };

export type Profile = { user: GhUser; repos: GhRepo[]; fetchedAt: number };

export type FetchProfileResult =
  | { ok: true; profile: Profile; cached: boolean }
  | { ok: false; error: FetchError };

const CACHE_TTL_MS = 86_400_000;
const API = "https://api.github.com";

/** Turns pasted input (handle, @handle, profile URL) into a bare login, or null if it can't be one. */
export function normalizeUsername(raw: string): string | null {
  let s = raw.trim();
  if (s.startsWith("@")) s = s.slice(1);
  for (const prefix of ["https://", "http://", "www.", "github.com/"]) {
    if (s.toLowerCase().startsWith(prefix)) s = s.slice(prefix.length);
  }
  const slash = s.indexOf("/");
  if (slash !== -1) s = s.slice(0, slash);
  if (!USERNAME_RE.test(s)) return null;
  if (s.includes("--") || s.endsWith("-")) return null;
  return s;
}

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function readCache(storage: Storage | null, key: string, now: number): Profile | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Profile> | null;
    if (!p || typeof p.fetchedAt !== "number" || !p.user || !Array.isArray(p.repos)) return null;
    const age = now - p.fetchedAt;
    if (age < 0 || age >= CACHE_TTL_MS) return null;
    return p as Profile;
  } catch {
    return null;
  }
}

function mapFailure(res: Response): FetchError {
  if (res.status === 404) return { kind: "not_found" };
  if (res.status === 403 || res.status === 429) {
    if (res.headers.get("x-ratelimit-remaining") === "0") {
      const reset = Number(res.headers.get("x-ratelimit-reset"));
      const resetAt = res.headers.get("x-ratelimit-reset") && Number.isFinite(reset) ? new Date(reset * 1000) : null;
      return { kind: "rate_limited", resetAt };
    }
    return { kind: "busy" };
  }
  return { kind: "unknown", status: res.status };
}

type Fetched<T> = { ok: true; data: T } | { ok: false; error: FetchError };

async function getJson<T>(fetchImpl: typeof fetch, url: string): Promise<Fetched<T>> {
  let res: Response;
  try {
    res = await fetchImpl(url, { headers: { Accept: "application/vnd.github+json" } });
  } catch {
    return { ok: false, error: { kind: "offline" } };
  }
  if (!res.ok) return { ok: false, error: mapFailure(res) };
  try {
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, error: { kind: "busy" } };
  }
}

export async function fetchProfile(
  login: string,
  opts: { fetchImpl?: typeof fetch; storage?: Storage | null; now?: () => number } = {},
): Promise<FetchProfileResult> {
  const now = opts.now ?? Date.now;
  const storage = opts.storage === undefined ? defaultStorage() : opts.storage;
  const key = `rbc:v1:${login.toLowerCase()}`;

  const hit = readCache(storage, key, now());
  if (hit) return { ok: true, profile: hit, cached: true };

  const fetchImpl = opts.fetchImpl ?? fetch;
  const name = encodeURIComponent(login);

  const user = await getJson<GhUser>(fetchImpl, `${API}/users/${name}`);
  if (!user.ok) return { ok: false, error: user.error };
  const repos = await getJson<GhRepo[]>(fetchImpl, `${API}/users/${name}/repos?per_page=100&sort=pushed`);
  if (!repos.ok) return { ok: false, error: repos.error };

  const profile: Profile = { user: user.data, repos: repos.data, fetchedAt: now() };
  try {
    storage?.setItem(key, JSON.stringify(profile));
  } catch {
    // quota exceeded or storage disabled: the cache is best-effort
  }
  return { ok: true, profile, cached: false };
}

/** Local 24h "HH:MM" of a rate-limit reset, or a vague fallback when unknown. */
export function formatReset(d: Date | null): string {
  if (!d) return "in a few minutes";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
