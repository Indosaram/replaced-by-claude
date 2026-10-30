import { expect, test } from "bun:test";
import { SITE_URL } from "../src/config.ts";

test("SITE_URL ends with repo path", () => {
  expect(SITE_URL.endsWith("/replaced-by-claude/")).toBe(true);
});
