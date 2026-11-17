// Characterization tests for app.js: the clock-driven page modes and the form button.
// app.js is a plain browser script, so it runs here inside a vm with a tiny fake DOM.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const APP_SOURCE = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const ELEMENT_IDS = ["action-kicker", "action-text", "action-btn", "action-note", "countdown", "cd-hari", "cd-jam", "cd-minit"];

function fakeElement() {
  const attributes = {};
  return {
    textContent: "",
    hidden: false,
    href: "",
    target: "",
    rel: "",
    offsetWidth: 0,
    classList: { add() {}, remove() {} },
    setAttribute(name, value) { attributes[name] = String(value); },
    getAttribute(name) { return name in attributes ? attributes[name] : null; },
    removeAttribute(name) { delete attributes[name]; },
  };
}

function loadApp({ search = "" } = {}) {
  const elements = Object.fromEntries(ELEMENT_IDS.map((id) => [id, fakeElement()]));
  const context = {
    document: { getElementById: (id) => elements[id] },
    location: { search },
    URLSearchParams,
    Date,
    setInterval: () => 0,
  };
  vm.createContext(context);
  // `const` declarations stay in the script scope, so expose what the tests need.
  vm.runInContext(`${APP_SOURCE}\n;globalThis.__app = { SETTINGS, pickMode, renderAction };`, context);
  return { app: context.__app, elements };
}

const myt = (hour, minute = 0) => Date.UTC(2026, 11, 5, hour - 8, minute); // 5 Dec 2026, Malaysia time

test("before 12.00 pm on the day the page counts down", () => {
  const { app } = loadApp();
  assert.equal(app.pickMode(Date.UTC(2026, 10, 17)), "sebelum");
  assert.equal(app.pickMode(myt(11, 59)), "sebelum");
});

test("from 12.00 pm to 6.00 pm the page asks for attendance", () => {
  const { app } = loadApp();
  assert.equal(app.pickMode(myt(12)), "hadir");
  assert.equal(app.pickMode(myt(17, 59)), "hadir");
});

test("from 6.00 pm the page asks for feedback", () => {
  const { app } = loadApp();
  assert.equal(app.pickMode(myt(18)), "selepas");
  assert.equal(app.pickMode(Date.UTC(2027, 0, 1)), "selepas");
});

test("?mod= previews a mode, and an unknown value falls back to the clock", () => {
  assert.equal(loadApp({ search: "?mod=selepas" }).app.pickMode(myt(9)), "selepas");
  assert.equal(loadApp({ search: "?mod=salah" }).app.pickMode(myt(9)), "sebelum");
});

test("with no form link the button is shown as not ready, never as a dead link", () => {
  const { app, elements } = loadApp();
  app.SETTINGS.attendanceFormUrl = "";
  app.renderAction("hadir");
  const button = elements["action-btn"];
  assert.equal(button.hidden, false);
  assert.equal(button.getAttribute("aria-disabled"), "true");
  assert.equal(button.textContent, "Pautan borang belum disediakan");
});

test("with a form link the button opens it in a new tab", () => {
  const { app, elements } = loadApp();
  app.SETTINGS.feedbackFormUrl = "https://forms.gle/example";
  app.renderAction("selepas");
  const button = elements["action-btn"];
  assert.equal(button.href, "https://forms.gle/example");
  assert.equal(button.target, "_blank");
  assert.equal(button.getAttribute("aria-disabled"), null);
});

test("the countdown mode hides the button", () => {
  const { app, elements } = loadApp();
  app.renderAction("sebelum");
  assert.equal(elements["action-btn"].hidden, true);
  assert.equal(elements.countdown.hidden, false);
});
