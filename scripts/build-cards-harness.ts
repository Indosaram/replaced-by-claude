import { cp, mkdir, rm, writeFile } from "node:fs/promises";

const out = "dist-qa/cards";
await rm(out, { recursive: true, force: true });
const result = await Bun.build({ entrypoints: ["qa/cards-harness.ts"], outdir: out, target: "browser" });
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
await mkdir(`${out}/fonts`, { recursive: true });
await cp("public/fonts", `${out}/fonts`, { recursive: true });
await writeFile(
  `${out}/index.html`,
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>cards harness</title></head><body><script type="module" src="cards-harness.js"></script></body></html>\n`,
);
console.log("cards harness build ok");
