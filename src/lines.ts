import type { Signals } from "./types";
import { seededRandom } from "./engine";

export type Trigger =
  | "tutorialRepos" | "forkHeavy" | "staleRepos" | "highStars" | "polyglot"
  | "noDescriptions" | "newAccount" | "longTimeOnGitHub" | "fewRepos"
  | "manyRepos" | "singleLanguageJS" | "singleLanguagePython" | "generic";

export const LINES: Record<Trigger, string[]> = {
  tutorialRepos: [
    "Claude checked {repo} and the tutorial's been going on a bit, huh.",
    "You finished the tutorial before you finished {repo}.",
    "You have {count} tutorial repos and still call it practice.",
    "Is {repo} a project or just a long note to self?",
    "Is {repo} still practice or did you mean to ship it?",
    "You named {repo} like the tutorial was going to finish itself.",
    "{count} tutorial repos and you still haven't made the thing you meant to make.",
    "Claude can tell {repo} was typed along with a video.",
    "You opened {repo} with a todo list and called that a start.",
    "You pushed {repo} once and called that a workflow.",
  ],
  forkHeavy: [
    "{count} repos and your biggest contribution is the fork button.",
    "Most of your repos say forked from and you use GitHub like bookmarks.",
    "You fork things for later, and later never shows up.",
    "Is {repo} yours or did you just click fork again?",
    "You forked {repo}, changed nothing, and walked away.",
    "{count} repos and half of them look like someone else's project with a new name.",
    "{repo} has your name on it and someone else's commits.",
    "You forked {repo} and now you're reviewing your own changes.",
    "Did you write any of the {count} repos, or just collect them?",
    "You forked {repo} so fast the original author got a notification.",
  ],
  staleRepos: [
    "You still count {repo} as active because it has a README.",
    "How many years does {repo} need before you call it archived?",
    "{repo} last passed its build when people still used Google Reader.",
    "Claude is not brave enough to find out if {repo} still compiles.",
    "You left {stale} repos alone for a year and still haven't deleted them.",
    "Claude opened {repo} and the lockfile made no sense.",
    "Did {repo} get abandoned before or after you picked a new framework?",
    "Is {repo} still a project or has the TODO taken over?",
    "I wouldn't run {repo} without a dependency audit and a snack.",
    "You left {repo} untouched for a year and still call it active.",
  ],
  highStars: [
    "People star {repo} and leave you to fix the bugs.",
    "Did {repo} get {stars} stars before you wrote the tests?",
    "Claude approved the PR in {repo} without scrolling past the title.",
    "{repo} has more stars than recent commits.",
    "{repo} has {stars} stars and you still call it a side project.",
    "{stars} stars and Claude still can't find the contributing guide in {repo}.",
    "You refresh the stars on {repo} more than you review pull requests.",
    "Claude opened {repo} and the issues tab felt like a waiting room.",
    "You check {repo} for new stars like it's a build status.",
    "How many stars does {repo} need before you update the README?",
  ],
  polyglot: [
    "You use four languages and still google how to print hello in {lang}.",
    "You switch stacks the second one needs debugging.",
    "Claude opened {repo} and found four languages, all of them YAML.",
    "You know all four languages and have half a project in each.",
    "You learned four languages so every bug can have a different accent.",
    "You use four languages and still name every variable temp.",
    "Every language you touch gets one repo and one broken build.",
    "You switch to {lang} whenever the error message gets personal.",
    "You use {lang} all the time and barely touch the rest.",
    "Did you learn four languages or just collect their syntax errors?",
  ],
  noDescriptions: [
    "Did {repo} ship or did the description just never load?",
    "{count} repos and apparently words cost extra.",
    "You write code for {repo} but not one sentence about it.",
    "Claude opened {repo} and couldn't tell if it was a project.",
    "I can't tell if {repo} is a library or a diary from that description.",
    "You have {count} repos and at least three need a sentence about what they do.",
    "You left {repo} without a description like the code explains itself.",
    "Your newest repo {repo} has a description so mysterious it's blank.",
    "Claude opened {repo} and still has no clue what it does.",
    "You pushed {repo} but skipped the part where anyone can tell what it is.",
  ],
  newAccount: [
    "Claude read your commit messages and hasn't made a sound since.",
    "Your green squares are so fresh GitHub is still counting on its fingers.",
    "{repo} has more TODOs than commits.",
    "You made {repo} and checked for stars before the first file hit disk.",
    "Did {repo} ever make it past localhost?",
    "Your initial commit is doing a lot of the work here.",
    "You have {count} repos and somehow every one needs a README.",
    "You made {repo} then left the issue tracker to gather dust.",
    "Is {repo} a repo or a place to park unfinished tutorials?",
    "Your GitHub account is new and {repo} already has legacy code.",
  ],
  longTimeOnGitHub: [
    "You have been on GitHub for a decade and still test in production.",
    "You use GitHub like a backup drive with a comment box.",
    "You have ten years on GitHub and still name branches test2.",
    "How many years on GitHub before you add a test?",
    "A decade on GitHub and you still haven't deleted a single branch.",
    "Ten years on GitHub and Claude found every file except a test.",
    "You have been on GitHub for a decade and still commit straight to main.",
    "Does GitHub count your README edits as a release?",
    "GitHub knows you refactor when the bug report says please stop.",
    "You have spent ten years on GitHub avoiding merge conflicts by never merging.",
  ],
  fewRepos: [
    "When did you last run the tests in {repo}?",
    "Is {repo} still in progress or did you just forget the push?",
    "{repo} has more config files than actual features.",
    "You pushed {repo} once and started telling people it's open source.",
    "You have {count} repos and somehow none has a working setup guide.",
    "You made {count} repos and still keep starting over in a new one.",
    "You have {count} repos and all the issues are assigned to future you.",
    "{repo} has a setup guide that skips the part where it actually runs.",
    "When did you last open {repo} without checking its stars?",
    "You named the repo {repo} like the name was the hard part.",
  ],
  manyRepos: [
    "{count} repos and every README says TODO like it's a long-term plan.",
    "Maybe finish one of those {count} repos for a change.",
    "You made {repo} then opened GitHub to see if anyone noticed.",
    "Out of {count} public repos, {repo} was the last one you touched.",
    "Claude reviewed {count} repos by reading the folder names.",
    "{count} repos and Claude is guessing half are called new-project.",
    "Claude suspects you maintain {count} repos by just not opening them.",
    "Claude found {count} repos that never made it past the initial commit.",
    "Is {repo} still a project or did you forget why you made it?",
    "Claude tried to star every one of your {count} repos and got rate limited.",
  ],
  singleLanguageJS: [
    "Claude checked {repo} and GitHub thinks you only know JavaScript.",
    "Claude found your {lang} buried under node_modules.",
    "You know one language, but somehow need a new framework every Tuesday.",
    "Claude counted {count} copies of final.js and every one is marked canonical.",
    "The README in {repo} describes software you haven't written yet.",
    "Claude read your {lang} commits and found WIP squatting on main.",
    "Your {lang} profile is mostly semicolons you forgot you typed.",
    "Why does {repo} need a framework just to print a button?",
    "Claude opened {repo} and the package.json was longer than the code.",
    "You start every {lang} project by making another config file.",
  ],
  singleLanguagePython: [
    "You use Python so much your other language is the GitHub search bar.",
    "Your Python came with a requirements.txt held together by version pins.",
    "Did you pick Python or did Python pick every repo?",
    "The wip branch in {repo} has clocked in for everyone again.",
    "Your {lang} profile is notebooks you swear you'll export one day.",
    "Claude opened your main.py and your other main.py and then another main.py.",
    "Your GitHub has one setting and it is Python.",
    "Claude says every {lang} script starts with an import and a prayer.",
    "You treat every problem like it asked for a Python script.",
    "You use Python so much even your README needs an interpreter.",
  ],
  generic: [
    "Claude saw your profile and hid the commit button from you.",
    "That temporary branch has been around longer than half your code.",
    "Claude opened {repo} and immediately went looking for undo.",
    "You spent longer picking a license than writing the first function.",
    "Claude found {count} public repos and clicked the wrong README.",
    "In {repo}, one function does two jobs badly.",
    "You keep pushing code like the tests can't see it.",
    "Claude found draft PRs in {repo} that have been open forever.",
    "Claude opened {count} repos and somehow every folder was called utils.",
    "Claude closed every TODO in {repo} without touching the code.",
    "Claude saw don't touch this in {repo} and treated it like a dare.",
    "Claude read the README, then asked where the product was.",
    "Claude read your commit message twice and still couldn't tell what changed.",
    "Your best GitHub habit is remembering your password.",
    "Claude reviewed your pull requests and typed ship it without scrolling.",
    "You wrote a README before deciding what the code does.",
    "Claude found the bug in your commit to {repo}, right where you left it.",
    "Claude looked for a license in {repo} and found vibes.",
    "Claude reads your diffs like Stack Overflow owes it money.",
    "Why does {repo} have a utils folder and a helpers folder?",
    "Claude reviewed {repo} and asked where the rest of the project went.",
    "You call it a side project until someone asks for a demo.",
  ],
};

export const SLOT_TRIGGERS: Trigger[] = (Object.keys(LINES) as Trigger[]).filter(
  (t) => t !== "generic" && LINES[t].every((l) => /\{(repo|stale|count)\}/.test(l)),
);

export function triggersFor(s: Signals): Trigger[] {
  const out: Trigger[] = [];
  const top = s.topLanguages[0];
  if (s.tutorialRepoCount >= 1) out.push("tutorialRepos");
  if (s.staleRepoCount >= 2) out.push("staleRepos");
  if (s.forkRatio > 0.5) out.push("forkHeavy");
  if (s.totalStars >= 1000) out.push("highStars");
  if (s.langCount >= 4) out.push("polyglot");
  if (s.noDescriptionCount >= 3) out.push("noDescriptions");
  if (s.totalPublicRepos >= 60) out.push("manyRepos");
  if (s.totalPublicRepos >= 1 && s.totalPublicRepos <= 5) out.push("fewRepos");
  if ((top === "JavaScript" || top === "TypeScript") && s.langCount <= 2) out.push("singleLanguageJS");
  if (top === "Python" && s.langCount <= 2) out.push("singleLanguagePython");
  if (s.accountAgeYears < 2) out.push("newAccount");
  if (s.accountAgeYears >= 10) out.push("longTimeOnGitHub");
  out.push("generic");
  return out;
}

type Slots = { repo: string | null; stale: string; count: string; lang: string | null; stars: string };

function slotsFor(s: Signals, t: Trigger): Slots {
  let repo = s.newestRepoName;
  if (t === "tutorialRepos") repo = s.tutorialRepoName;
  else if (t === "staleRepos") repo = s.oldestStaleRepoName;
  else if (t === "highStars") repo = s.mostStarredRepoName;
  const count = t === "tutorialRepos" ? s.tutorialRepoCount : s.totalPublicRepos;
  return {
    repo: repo || null,
    stale: s.staleRepoCount > 0 ? String(s.staleRepoCount) : "",
    count: count > 0 ? String(count) : "",
    lang: s.topLanguages[0] || null,
    stars: s.totalStars > 0 ? s.totalStars.toLocaleString("en-US") : "",
  };
}

const SLOT_RE = /\{(repo|stale|count|lang|stars)\}/g;
const VALUE_RE = /\{(repo|stale|count)\}/;

function fill(line: string, slots: Slots): string | null {
  let ok = true;
  const out = line.replace(SLOT_RE, (_, k: keyof Slots) => {
    const v = slots[k];
    if (!v) ok = false;
    return v ?? "";
  });
  if (!ok) return null;
  return out.replace(/\b1 ((?:public |tutorial )?)repos\b/g, "1 $1repo");
}

function shuffle<T>(a: T[], rnd: () => number): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export function pickLines(s: Signals, seed: number): string[] {
  const rnd = seededRandom(seed);
  const triggers = triggersFor(s);
  type Cand = { text: string; slot: boolean; trig: Trigger };
  const byTrig = new Map<Trigger, Cand[]>();
  for (const t of triggers) {
    const slots = slotsFor(s, t);
    const cands: Cand[] = [];
    for (const l of shuffle(LINES[t], rnd)) {
      const text = fill(l, slots);
      if (text !== null) cands.push({ text, slot: VALUE_RE.test(l), trig: t });
    }
    byTrig.set(t, cands);
  }
  const specific = shuffle(triggers.filter((t) => t !== "generic" && (byTrig.get(t)?.length ?? 0) > 0), rnd);
  // slot triggers first, so the 2-of-3 rule holds
  specific.sort((a, b) => Number(SLOT_TRIGGERS.includes(b)) - Number(SLOT_TRIGGERS.includes(a)));
  const picked: Cand[] = [];
  const seen = new Set<string>();
  const take = (c: Cand | undefined) => {
    if (c && !seen.has(c.text) && picked.length < 3) {
      seen.add(c.text);
      picked.push(c);
      return true;
    }
    return false;
  };
  const need = s.publicRepos >= 1;
  for (const t of specific) {
    if (picked.length >= 3) break;
    const list = byTrig.get(t)!;
    // prefer a slot line from this trigger
    take(list.find((c) => c.slot) ?? list[0]);
  }
  const gen = byTrig.get("generic") ?? [];
  const genSlot = gen.filter((c) => c.slot);
  const genPlain = gen.filter((c) => !c.slot);
  const slotCount = () => picked.filter((c) => c.slot).length;
  while (picked.length < 3) {
    const pool = need && slotCount() < 2 ? genSlot : [...genPlain, ...genSlot];
    const before = picked.length;
    for (const c of pool) if (take(c)) break;
    if (picked.length === before) for (const c of gen) if (take(c)) break;
    if (picked.length === before) break;
  }
  // enforce 2-of-3 slot rule by swapping non-slot picks for slot generic lines
  if (need) {
    for (let i = 0; i < picked.length && slotCount() < 2; i++) {
      if (!picked[i].slot) {
        const rep = genSlot.find((c) => !seen.has(c.text));
        if (rep) {
          seen.delete(picked[i].text);
          seen.add(rep.text);
          picked[i] = rep;
        }
      }
    }
  }
  return picked.map((c) => c.text);
}
