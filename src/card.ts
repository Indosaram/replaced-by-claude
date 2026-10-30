export type CardInput = {
  login: string;
  label: string;
  line: string;
  facts: string;
  autograph?: boolean;
};

const PAPER = "#F4EDE1";
const INK = "#1F1B16";
const MUTED = "#6B6257";
const ACCENT = "#C2410C";
const RULE = "#D9CBB5";

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
    const face = new FontFace("Inter", `url(${base}inter-600.woff2)`, { weight: "600" });
    document.fonts.add(face);
    pending.push(face.load());
  }
  await Promise.all(pending);
  await document.fonts.load("700 120px Fraunces");
  await document.fonts.load("600 32px Inter");
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

export async function renderCard(input: CardInput): Promise<Blob> {
  await ensureFonts();
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 675;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas unavailable");

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, 1200, 675);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  ctx.fillStyle = MUTED;
  ctx.font = "600 30px Inter, sans-serif";
  ctx.fillText(`@${input.login}`, 60, 90);

  ctx.fillStyle = INK;
  ctx.font = "600 34px Inter, sans-serif";
  ctx.fillText("Claude replaces me in", 60, 170);

  let size = 170;
  ctx.font = `700 ${size}px Fraunces, serif`;
  while (size > 8 && ctx.measureText(input.label).width > 1080) {
    size -= 4;
    ctx.font = `700 ${size}px Fraunces, serif`;
  }
  ctx.fillStyle = ACCENT;
  ctx.fillText(input.label, 60, 330);

  ctx.fillStyle = INK;
  ctx.font = "600 30px Inter, sans-serif";
  const verdict = wrapLines((s) => ctx.measureText(s).width, input.line, 1080, 2);
  verdict.forEach((l, i) => ctx.fillText(l, 60, 400 + i * 42));

  ctx.fillStyle = MUTED;
  ctx.font = "600 24px Inter, sans-serif";
  ctx.fillText(input.facts, 60, 510);

  if (input.autograph) {
    ctx.fillStyle = ACCENT;
    ctx.font = "600 22px Inter, sans-serif";
    ctx.fillText("Claude asked for your autograph first", 60, 548);
  }

  ctx.strokeStyle = RULE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(60, 585);
  ctx.lineTo(1140, 585);
  ctx.stroke();

  ctx.fillStyle = MUTED;
  ctx.font = "600 24px Inter, sans-serif";
  ctx.fillText("indosaram.github.io/replaced-by-claude  \u00b7  by @indo_yoon", 60, 628);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))), "image/png");
  });
}
