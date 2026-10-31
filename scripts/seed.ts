/**
 * Launch-kit seeder. Fetches GitHub data with the authenticated `gh` CLI only,
 * runs the real engine + line picker, and writes:
 *   launch-kit/cards.json        20 celebrity entries
 *   launch-kit/cards-owner.json  the owner's entry (single-element array)
 *   src/examples.json            first 3 entries, stripped to GhUser/GhRepo fields
 *   .omo/evidence/x-aggro-app/task-8-replace.txt   every skip, with its reason
 * Raw gh JSON is cached under /tmp/rbc-seed/ so re-runs do not refetch.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { analyze, factsLine } from "../src/engine.ts";
import { pickLines } from "../src/lines.ts";
import type { GhRepo, GhUser } from "../src/types.ts";

const CACHE = "/tmp/rbc-seed";
const LOG_PATH = ".omo/evidence/x-aggro-app/task-8-replace.txt";
const WANT = 20;
const MAX_CANDIDATES = 80;
const OWNER = "Indosaram";
const BANNED = /\b(age|old|young|body|gender|race|religion|nation|mental|employer|salary|money|family|wife|husband)\b/i;

/** In priority order. `levelsio` has a documented fallback to `levels` on 404. */
const POOL = [
  "nonexistent-login-zz9qq",
  "sindresorhus", "yyx990803", "antirez", "mitchellh", "kentcdodds", "addyosmani", "ThePrimeagen", "t3dotgg", "shadcn",
  "levelsio", "dhh", "jaredpalmer", "wesbos", "developit", "Rich-Harris", "kettanaito", "tannerlinsley",
  "colinhacks", "pacocursey", "rauchg", "simonw", "jakearchibald", "paulirish", "mjackson", "ryanflorence", "sebmarkbage",
  "acdlite", "jlongster", "bradfitz", "fatih", "matklad", "steveklabnik", "BurntSushi", "gaearon", "tj", "karpathy", "swyx",
  "leerob", "mxstbr", "kamranahmedse", "getify", "mrdoob", "feross", "isaacs",
  // expansion: other prominent OSS maintainers
  "tiangolo", "evanw", "ljharb", "bvaughn", "wycats", "substack", "DavidKPiano", "adamwathan", "mcollina", "antfu",
  "JakeWharton", "fabpot", "taylorotwell", "junegunn", "sharkdp", "dtolnay", "mattn", "jashkenas", "gvanrossum", "ry",
  "sorrycc", "tomdale", "sdras", "timneutkens", "Marak", "unjs", "egoist", "posva", "yihui", "hadley",
];
if (POOL.length > MAX_CANDIDATES) throw new Error("pool exceeds 80 candidates");

type Fetched = { notFound: true } | { notFound: false; user: GhUser; repos: GhRepo[] };

async function gh(args: string[]): Promise<{ ok: boolean; out: string; err: string }> {
  const p = Bun.spawn(["gh", "api", ...args], { stdout: "pipe", stderr: "pipe" });
  const [out, err] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
  return { ok: (await p.exited) === 0, out, err };
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return null;
  }
}

async function fetchLogin(login: string): Promise<Fetched> {
  const userPath = `${CACHE}/${login}.user.json`;
  const reposPath = `${CACHE}/${login}.repos.json`;
  const cachedUser = await readJson<GhUser | { __notFound: true }>(userPath);
  if (cachedUser) {
    if ("__notFound" in cachedUser) return { notFound: true };
    const cachedRepos = await readJson<GhRepo[]>(reposPath);
    if (cachedRepos) return { notFound: false, user: cachedUser, repos: cachedRepos };
  }
  const u = await gh([`users/${login}`]);
  if (!u.ok) {
    if (/404|Not Found/i.test(u.err + u.out)) {
      await writeFile(userPath, JSON.stringify({ __notFound: true }));
      return { notFound: true };
    }
    throw new Error(`gh api users/${login} failed: ${u.err.trim() || u.out.trim()}`);
  }
  const r = await gh([`users/${login}/repos?per_page=100&sort=pushed`]);
  if (!r.ok) throw new Error(`gh api users/${login}/repos failed: ${r.err.trim() || r.out.trim()}`);
  await writeFile(userPath, u.out);
  await writeFile(reposPath, r.out);
  return { notFound: false, user: JSON.parse(u.out) as GhUser, repos: JSON.parse(r.out) as GhRepo[] };
}

export type CardEntry = {
  login: string;
  x_handle: string | null;
  label: string;
  lines: string[];
  facts: string;
  autograph: boolean;
  card: string;
};

function build(user: GhUser, repos: GhRepo[], now: Date): CardEntry {
  const r = analyze(user, repos, now);
  const lines = pickLines(r.signals, r.seed);
  return {
    login: user.login,
    x_handle: user.twitter_username?.trim() || null,
    label: r.label,
    lines,
    facts: factsLine(r.signals),
    autograph: r.autograph,
    card: `cards/${user.login}.png`,
  };
}

function strip(user: GhUser, repos: GhRepo[]): { login: string; user: GhUser; repos: GhRepo[] } {
  const u: GhUser = {
    login: user.login,
    public_repos: user.public_repos,
    followers: user.followers,
    created_at: user.created_at,
    twitter_username: user.twitter_username ?? null,
    name: user.name ?? null,
  };
  // The engine only tests descriptions for emptiness, so a short prefix keeps results identical.
  const rs: GhRepo[] = repos.map((x) => ({
    name: x.name,
    fork: x.fork,
    stargazers_count: x.stargazers_count,
    language: x.language,
    pushed_at: x.pushed_at,
    description: x.description === null ? null : x.description.slice(0, 80),
  }));
  return { login: user.login, user: u, repos: rs };
}

await mkdir(CACHE, { recursive: true });
await mkdir("launch-kit/cards", { recursive: true });
await mkdir(".omo/evidence/x-aggro-app", { recursive: true });

const now = new Date();
const log: string[] = [`# task-8 seed log, ${now.toISOString()}`, `# pool=${POOL.length} want=${WANT}`];
const kept: CardEntry[] = [];
const keptRaw: { user: GhUser; repos: GhRepo[] }[] = [];

async function consider(login: string, via?: string): Promise<void> {
  const tag = via ? `${login} (via ${via})` : login;
  const f = await fetchLogin(login);
  if (f.notFound) {
    log.push(
      login.startsWith("nonexistent-login")
        ? `SKIP ${tag}: not found, replaced (deliberately fake login, 404 from gh api users/${login})`
        : `SKIP ${tag}: not found (404)`,
    );
    if (login === "levelsio") await consider("levels", "levelsio 404");
    return;
  }
  const { user, repos } = f;
  if (!user.twitter_username || user.twitter_username.trim() === "") {
    log.push(`SKIP ${tag}: no twitter_username`);
    return;
  }
  if (user.public_repos < 5) {
    log.push(`SKIP ${tag}: public_repos=${user.public_repos} < 5`);
    return;
  }
  const entry = build(user, repos, now);
  const hit = entry.lines.map((l) => BANNED.exec(l)).find((m) => m !== null);
  if (hit) {
    log.push(`SKIP ${tag}: line matched banned word "${hit[0]}": ${entry.lines.find((l) => BANNED.test(l))}`);
    return;
  }
  kept.push(entry);
  keptRaw.push({ user, repos });
  log.push(`KEEP ${tag}: @${entry.x_handle} label=${entry.label} line1=${entry.lines[0]}`);
}

// Prefetch in chunks of 8 so the cache warms in parallel; decisions stay in pool order.
for (let i = 0; i < POOL.length && kept.length < WANT; i += 8) {
  const chunk = POOL.slice(i, i + 8);
  await Promise.all(chunk.map((l) => fetchLogin(l)));
  for (const login of chunk) {
    if (kept.length >= WANT) {
      log.push(`STOP: reached ${WANT} kept, ${login} and later candidates not considered`);
      break;
    }
    await consider(login);
  }
}

if (kept.length < WANT) {
  await writeFile(LOG_PATH, log.join("\n") + "\n");
  throw new Error(`only ${kept.length}/${WANT} kept; pool exhausted (see ${LOG_PATH})`);
}

// Owner: no twitter_username required.
const ownerFetched = await fetchLogin(OWNER);
if (ownerFetched.notFound) throw new Error(`${OWNER} not found`);
const ownerEntry = build(ownerFetched.user, ownerFetched.repos, now);
const ownerHit = ownerEntry.lines.find((l) => BANNED.test(l));
log.push(
  `OWNER ${OWNER}: label=${ownerEntry.label} line1=${ownerEntry.lines[0]}` +
    (ownerHit ? ` | WARNING banned-word match kept for owner: ${ownerHit}` : ""),
);

await writeFile("launch-kit/cards.json", JSON.stringify(kept, null, 2) + "\n");
await writeFile("launch-kit/cards-owner.json", JSON.stringify([ownerEntry], null, 2) + "\n");
await writeFile(
  "src/examples.json",
  JSON.stringify(keptRaw.slice(0, 3).map((k) => strip(k.user, k.repos))) + "\n",
);
await writeFile(LOG_PATH, log.join("\n") + "\n");
console.log(log.join("\n"));
console.log(`wrote ${kept.length} cards + owner`);
