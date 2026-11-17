// The owner's Malay copy rule, for the text that lives in the scripts: the antislop checker
// reads only index.html and the CSS, so a comma before these words in JS would slip through.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PAGE_SCRIPTS = ["app.js", "forms.js", "remembered-ic.js", "vote.js", "effects.js"];
const COMMA_BEFORE = /,\s+(dan|atau|serta|untuk|oleh)\b/;

test("no Malay line in the page scripts has a comma before dan, atau, serta, untuk or oleh", () => {
  for (const file of PAGE_SCRIPTS) {
    const lines = readFileSync(new URL(`../${file}`, import.meta.url), "utf8").split("\n");
    lines.forEach((line, index) => {
      assert.doesNotMatch(line, COMMA_BEFORE, `${file}:${index + 1}`);
    });
  }
});
