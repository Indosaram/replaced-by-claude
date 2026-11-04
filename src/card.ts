import { drawClaude } from "./claude-logo.ts";

export type CardInput = {
  login: string;
  name?: string | null;
  avatarUrl?: string | null;
  label: string;
  line: string;
  facts: string;
  autograph?: boolean;
};

const PAPER = "#FAF4E9";
const INK = "#1F1B16";
const MUTED = "#6B6257";
const ACCENT = "#C2410C";
const CLAUDE = "#D97757";
const RULE = "#D9CBB5";

const WIDTH = 1200;
const HEIGHT = 675;
const MARGIN = 64;
const RIGHT = WIDTH - MARGIN;

const hasFace = (family: string): boolean =>
  [...document.fonts].some((f) => f.family.replace(/["']/g, "") === family);

export async function ensureFonts(base = "./fonts/"): Promise<void> {
  const pending: Promise<FontFace>[] = [];
  // check() returns true for families with no registered face, so test registration instead.
  if (!hasFace("Fraunces")) {
    const face = new FontFace("Fraunces", `url(${base}fraunces-700.woff2)`, { weight: "700" });
    document.fonts.add(face);
    pending.push(face.load());
  }
  if (!hasFace("Inter")) {
    const regular = new FontFace("Inter", `url(${base}inter-400.woff2)`, { weight: "400" });
    const semibold = new FontFace("Inter", `url(${base}inter-600.woff2)`, { weight: "600" });
    document.fonts.add(regular);
    document.fonts.add(semibold);
    pending.push(regular.load(), semibold.load());
  }
  await Promise.all(pending);
  await document.fonts.load("700 120px Fraunces");
  await document.fonts.load("600 32px Inter");
  await document.fonts.load("400 22px Inter");
}

function loadAvatar(input: CardInput): Promise<HTMLImageElement | null> {
  const url =
    input.avatarUrl?.trim() ||
    `https://avatars.githubusercontent.com/${encodeURIComponent(input.login)}?size=240`;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img.naturalWidth > 0 ? img : null);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function wrapLines(
  measure: (s: string) => number,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || measure(candidate) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;

  const kept = lines.slice(0, maxLines - 1);
  let last = lines.slice(maxLines - 1).join(" ");
  while (last.length > 0 && measure(`${last}\u2026`) > maxWidth) {
    last = last.slice(0, -1).trimEnd();
  }
  kept.push(`${last}\u2026`);
  return kept;
}

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  login: string,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "#E8DCC9";
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  if (img) {
    const scale = Math.max((r * 2) / img.naturalWidth, (r * 2) / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  } else {
    ctx.fillStyle = ACCENT;
    ctx.font = "700 38px Fraunces, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(login.slice(0, 1).toUpperCase(), cx, cy + 2);
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  start: number,
  min: number,
  family: string,
  weight: string,
): number {
  let size = start;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > min && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

export async function renderCard(input: CardInput): Promise<Blob> {
  const [avatar] = await Promise.all([loadAvatar(input), ensureFonts()]);

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas unavailable");

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  drawClaude(ctx, 900, 232, 400, "rgba(217, 119, 87, 0.055)");

  drawAvatar(ctx, avatar, input.login, MARGIN + 34, 92, 34);

  const textX = MARGIN + 84;
  const name = (input.name ?? "").trim();
  const showName = name.length > 0 && name.toLowerCase() !== input.login.toLowerCase();
  if (showName) {
    fitFont(ctx, name, 620, 27, 20, "Fraunces, serif", "700");
    ctx.fillStyle = INK;
    ctx.fillText(name, textX, 84);
    ctx.font = "600 20px Inter, sans-serif";
    ctx.fillStyle = MUTED;
    ctx.fillText(`@${input.login}`, textX, 112);
  } else {
    fitFont(ctx, `@${input.login}`, 620, 27, 20, "Fraunces, serif", "700");
    ctx.fillStyle = INK;
    ctx.fillText(`@${input.login}`, textX, 86);
    ctx.font = "600 15px Inter, sans-serif";
    ctx.fillStyle = MUTED;
    (ctx as unknown as { letterSpacing: string }).letterSpacing = "2.4px";
    ctx.fillText("GITHUB PROFILE", textX, 112);
    (ctx as unknown as { letterSpacing: string }).letterSpacing = "0px";
  }

  ctx.font = "700 30px Fraunces, serif";
  const wordmark = "Claude";
  const wordmarkWidth = ctx.measureText(wordmark).width;
  const wordmarkX = RIGHT - wordmarkWidth;
  drawClaude(ctx, wordmarkX - 14 - 30, 64, 30, CLAUDE);
  ctx.fillStyle = INK;
  ctx.fillText(wordmark, wordmarkX, 92);

  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(MARGIN, 146);
  ctx.lineTo(RIGHT, 146);
  ctx.stroke();

  ctx.fillStyle = MUTED;
  ctx.font = "600 17px Inter, sans-serif";
  (ctx as unknown as { letterSpacing: string }).letterSpacing = "3.4px";
  ctx.fillText("A VERY SCIENTIFIC ESTIMATE", MARGIN, 202);
  (ctx as unknown as { letterSpacing: string }).letterSpacing = "0px";

  fitFont(ctx, input.label, 760, 176, 72, "Fraunces, serif", "700");
  ctx.fillStyle = ACCENT;
  ctx.fillText(input.label, MARGIN, 360);

  ctx.fillStyle = ACCENT;
  ctx.fillRect(MARGIN, 398, 4, 86);
  ctx.font = "600 31px Inter, sans-serif";
  ctx.fillStyle = INK;
  const verdict = wrapLines((s) => ctx.measureText(s).width, input.line, 1000, 2);
  verdict.forEach((l, i) => ctx.fillText(l, MARGIN + 28, 430 + i * 46));

  const factsY = input.autograph ? 522 : 538;
  fitFont(ctx, input.facts, 1072, 21, 16, "Inter, sans-serif", "600");
  ctx.fillStyle = MUTED;
  ctx.fillText(input.facts, MARGIN, factsY);

  if (input.autograph) {
    ctx.font = "600 17px Inter, sans-serif";
    const badge = "Claude asked for your autograph first";
    const textWidth = ctx.measureText(badge).width;
    const pillW = textWidth + 30;
    const pillH = 34;
    const pillY = 548;
    ctx.beginPath();
    ctx.roundRect(MARGIN, pillY, pillW, pillH, pillH / 2);
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = ACCENT;
    ctx.fillText(badge, MARGIN + 15, pillY + 23);
  }

  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(MARGIN, 602);
  ctx.lineTo(RIGHT, 602);
  ctx.stroke();

  ctx.font = "600 19px Inter, sans-serif";
  ctx.fillStyle = MUTED;
  ctx.fillText("indosaram.github.io/replaced-by-claude", MARGIN, 638);

  const by = "by ";
  const handle = "@indo_yoon";
  const byWidth = ctx.measureText(by).width;
  const handleWidth = ctx.measureText(handle).width;
  const handleX = RIGHT - handleWidth;
  ctx.fillStyle = MUTED;
  ctx.fillText(by, handleX - byWidth, 638);
  ctx.fillStyle = ACCENT;
  ctx.fillText(handle, handleX, 638);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))), "image/png");
  });
}
