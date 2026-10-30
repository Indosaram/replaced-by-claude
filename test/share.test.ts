import { describe, expect, test } from "bun:test";
import { SITE_URL } from "../src/config.ts";
import { wrapLines } from "../src/card.ts";
import { intentUrl, shareText } from "../src/share.ts";

describe("shareText", () => {
  test("fits in 280 chars for the longest login", () => {
    expect(shareText("a".repeat(39), "89d 23h").length).toBeLessThanOrEqual(280);
  });

  test("contains handle, site url and ?u=", () => {
    const t = shareText("torvalds", "4h 12m");
    expect(t).toContain("@indo_yoon");
    expect(t).toContain(SITE_URL);
    expect(t).toContain("?u=");
  });

  test("encodes the login", () => {
    expect(shareText("a b", "1h")).toContain("?u=a%20b");
  });
});

describe("intentUrl", () => {
  test("round-trips the text", () => {
    const prefix = "https://x.com/intent/post?text=";
    const text = shareText("torvalds", "4h 12m");
    const url = intentUrl(text);
    expect(url.startsWith(prefix)).toBe(true);
    expect(decodeURIComponent(url.slice(prefix.length))).toBe(text);
  });
});

describe("wrapLines", () => {
  const measure = (s: string) => s.length * 10;

  test("truncates with an ellipsis when over maxLines", () => {
    const lines = wrapLines(measure, "one two three four five six seven", 100, 2);
    expect(lines.length).toBe(2);
    expect(lines[1]!.endsWith("\u2026")).toBe(true);
    expect(measure(lines[1]!)).toBeLessThanOrEqual(100);
  });

  test("short text stays on one line", () => {
    expect(wrapLines(measure, "one two", 100, 2)).toEqual(["one two"]);
  });
});
