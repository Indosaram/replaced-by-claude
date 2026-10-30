import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const input = resolve(root, "og.html");
const output = resolve(root, "public/og.png");
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

await mkdir(resolve(root, "public"), { recursive: true });

if (existsSync(chrome)) {
  await Bun.$`${chrome} --headless=new --disable-gpu --hide-scrollbars --window-size=1200,630 --virtual-time-budget=3000 --screenshot=${output} file://${input}`.quiet();
} else {
  const view = new Bun.WebView({ width: 1200, height: 630 });
  await view.navigate(`file://${input}`);
  const png = await view.screenshot();
  await Bun.write(output, png);
  view.close();
}

console.log(`wrote ${output}`);
