import { cp, mkdir, readFile, writeFile, rm, access } from "node:fs/promises";
import { SITE_URL } from "../src/config.ts";

await rm("dist", { recursive: true, force: true });
const result = await Bun.build({
  entrypoints: ["src/main.ts"],
  outdir: "dist",
  minify: true,
  target: "browser",
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
await mkdir("dist", { recursive: true });
const html = (await readFile("index.html", "utf8")).replaceAll("%SITE_URL%", SITE_URL);
await writeFile("dist/index.html", html);
await cp("src/style.css", "dist/style.css");
try {
  await access("public");
  await cp("public", "dist", { recursive: true });
} catch {}
console.log("build ok");
