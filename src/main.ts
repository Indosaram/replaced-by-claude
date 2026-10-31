import { analyze, factsLine } from "./engine.ts";
import { fetchProfile, formatReset, normalizeUsername, type FetchError } from "./github.ts";
import { pickLines } from "./lines.ts";
import { renderCard } from "./card.ts";
import { downloadCard, shareCard } from "./share.ts";
import type { GhRepo, GhUser, Result } from "./types.ts";
import examplesJson from "./examples.json";
import customLinesJson from "./custom-lines.json";

type Example = { login: string; user: GhUser; repos: GhRepo[] };

const examples = examplesJson as unknown as Example[];
const customLines = customLinesJson as unknown as Record<string, string[]>;

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

const form = $<HTMLFormElement>("lookup-form");
const input = $<HTMLInputElement>("username");
const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
const statusEl = $("status");
const resultEl = $("result");
const labelEl = $("result-label");
const factsEl = $("facts");
const badgeEl = $("badge");
const verdictsEl = $("verdicts");
const previewEl = $<HTMLImageElement>("card-preview");
const shareBtn = $<HTMLButtonElement>("share-btn");
const downloadBtn = $<HTMLButtonElement>("download-btn");
const shareHintEl = $("share-hint");
const exampleEl = $("example");

let currentBlob: Blob | null = null;
let currentBlobPromise: Promise<Blob> | null = null;
let currentLogin = "";
let currentLabel = "";
let previewUrl: string | null = null;
let runId = 0;

function setStatus(text: string, isError = false): void {
  statusEl.textContent = text;
  statusEl.classList.toggle("is-error", isError);
}

function linesFor(login: string, r: Result): string[] {
  const custom = customLines[login.toLowerCase()];
  if (Array.isArray(custom) && custom.length === 3 && custom.every((l) => typeof l === "string")) return custom;
  return pickLines(r.signals, r.seed);
}

function fillVerdicts(list: HTMLElement, lines: string[]): void {
  list.replaceChildren(
    ...lines.map((line) => {
      const li = document.createElement("li");
      li.textContent = line;
      return li;
    }),
  );
}

function errorCopy(e: FetchError): string {
  switch (e.kind) {
    case "not_found":
      return "GitHub has never heard of you. Claude replaced you before you started.";
    case "rate_limited":
      return `Too many people getting replaced right now. Try again at ${formatReset(e.resetAt)}.`;
    case "busy":
      return "GitHub is rate limiting us. Try again in a few minutes.";
    case "offline":
      return "You're offline. Claude can wait. It's very patient.";
    case "unknown":
      return `GitHub said ${e.status}. Try again in a bit.`;
  }
}

function renderExample(): void {
  const ex = examples[0];
  if (!ex) return;
  const r = analyze(ex.user, ex.repos, new Date());
  const lines = linesFor(ex.login, r);

  const heading = document.createElement("p");
  heading.className = "result-kicker";
  heading.textContent = "Meanwhile, here's someone else getting replaced:";
  const label = document.createElement("p");
  label.className = "result-label";
  label.textContent = r.label;
  const facts = document.createElement("p");
  facts.className = "facts";
  facts.textContent = factsLine(r.signals);
  const list = document.createElement("ol");
  list.className = "verdicts";
  fillVerdicts(list, lines);

  exampleEl.replaceChildren(heading, label, facts, list);
  exampleEl.hidden = false;
}

function showResult(login: string, r: Result): void {
  const lines = linesFor(login, r);
  const facts = factsLine(r.signals);

  labelEl.textContent = r.label;
  factsEl.textContent = facts;
  fillVerdicts(verdictsEl, lines);
  if (r.autograph) {
    badgeEl.textContent = "Claude asked for your autograph first";
    badgeEl.hidden = false;
  } else {
    badgeEl.textContent = "";
    badgeEl.hidden = true;
  }
  shareHintEl.textContent = "";
  exampleEl.hidden = true;
  resultEl.hidden = false;
  setStatus("");

  const myRun = ++runId;
  currentBlob = null;
  currentLogin = login;
  currentLabel = r.label;
  shareBtn.disabled = true;
  downloadBtn.disabled = true;

  const blobPromise = renderCard({ login, label: r.label, line: lines[0] ?? "", facts, autograph: r.autograph });
  currentBlobPromise = blobPromise;
  blobPromise.then(
    (blob) => {
      if (myRun !== runId) return;
      currentBlob = blob;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(blob);
      previewEl.src = previewUrl;
      shareBtn.disabled = false;
      downloadBtn.disabled = false;
    },
    () => {
      if (myRun !== runId) return;
      shareHintEl.textContent = "Couldn't draw your card. Your verdict still stands.";
    },
  );
}

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const login = normalizeUsername(input.value);
  if (!login) {
    setStatus("That doesn't look like a GitHub username.", true);
    return;
  }
  setStatus("Asking GitHub about you...");
  submit.disabled = true;
  const t0 = performance.now();
  try {
    const res = await fetchProfile(login);
    history.replaceState(null, "", `?u=${encodeURIComponent(login)}`);
    if (res.ok) {
      const r = analyze(res.profile.user, res.profile.repos, new Date());
      showResult(login, r);
      document.documentElement.dataset.renderMs = String(Math.round(performance.now() - t0));
    } else {
      resultEl.hidden = true;
      exampleEl.hidden = true;
      setStatus(errorCopy(res.error), true);
      if (res.error.kind === "rate_limited" || res.error.kind === "busy") renderExample();
    }
  } catch {
    resultEl.hidden = true;
    exampleEl.hidden = true;
    setStatus("Something broke. Claude is looking into it. Try again in a bit.", true);
  } finally {
    submit.disabled = false;
  }
});

shareBtn.addEventListener("click", () => {
  if (!currentBlob || !currentBlobPromise) return;
  shareCard({
    blob: currentBlob,
    blobPromise: currentBlobPromise,
    login: currentLogin,
    label: currentLabel,
    onHint: (m) => {
      shareHintEl.textContent = m;
    },
  });
});

downloadBtn.addEventListener("click", () => {
  if (!currentBlob) return;
  downloadCard(currentBlob, currentLogin);
});

const initial = new URLSearchParams(location.search).get("u");
if (initial) {
  input.value = initial;
  form.requestSubmit();
}
