// Tests for the inline script in index.html's head: if effects.js never opens the page, the
// curtain goes and the form shows 3 s after the page is parsed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const HTML = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const HEAD_SCRIPT = HTML.match(/<head>[\s\S]*?<script>([\s\S]*?)<\/script>/)[1];

function runHead() {
  const classes = new Set();
  const listeners = {};
  const timers = [];
  const context = {
    document: {
      documentElement: { classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name), contains: (name) => classes.has(name) } },
      addEventListener: (type, run) => { listeners[type] = run; },
    },
    sessionStorage: { getItem: () => null },
    setTimeout: (run, ms) => timers.push({ run, ms }),
  };
  vm.createContext(context);
  vm.runInContext(HEAD_SCRIPT, context);
  return { classes, parsed: () => listeners.DOMContentLoaded(), timers };
}

test("with no effects.js the page opens and the curtain hides 3 s after parsing", () => {
  const { classes, parsed, timers } = runHead();
  assert.ok(classes.has("first-visit"), "the curtain is up at first");
  parsed();
  assert.equal(timers[0].ms, 3000);
  timers[0].run();
  assert.ok(classes.has("opened"));
  assert.ok(!classes.has("first-visit"), "first-visit gone, so the CSS hides the curtain");
});

test("a page effects.js already opened is left alone", () => {
  const { classes, parsed, timers } = runHead();
  parsed();
  classes.add("opened"); // effects.js parted the curtain in time
  timers[0].run();
  assert.ok(classes.has("first-visit"), "the curtain animation is not cut short");
});
