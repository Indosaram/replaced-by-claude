import { appendFile, cp, mkdir, readFile, rm } from "node:fs/promises";

await rm("dist-qa", { recursive: true, force: true });
const result = await Bun.build({
  entrypoints: ["qa/harness.ts"],
  outdir: "dist-qa",
  target: "browser",
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
await cp("qa/share-harness.html", "dist-qa/share-harness.html");
await mkdir("dist-qa/fonts", { recursive: true });
await cp("public/fonts", "dist-qa/fonts", { recursive: true });

const gitignore = await readFile(".gitignore", "utf8");
if (!gitignore.split("\n").some((l) => l.trim() === "dist-qa")) {
  await appendFile(".gitignore", (gitignore.endsWith("\n") ? "" : "\n") + "dist-qa\n");
}
console.log("harness build ok");
