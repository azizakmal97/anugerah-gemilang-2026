// Characterization tests for app.js: the clock-driven page modes and which form each shows.
// app.js is a plain browser script, so it runs here inside a vm with a tiny fake DOM.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const APP_SOURCE = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const ELEMENT_IDS = ["action-kicker", "action-text", "action-note", "countdown", "cd-hari", "cd-jam", "cd-minit", "maklum-balas", "maklum-balas-isi"];

function fakeElement() {
  const attributes = {};
  return {
    textContent: "",
    hidden: false,
    offsetWidth: 0,
    classList: { add() {}, remove() {} },
    setAttribute(name, value) { attributes[name] = String(value); },
    getAttribute(name) { return name in attributes ? attributes[name] : null; },
    removeAttribute(name) { delete attributes[name]; },
  };
}

function loadApp({ search = "" } = {}) {
  const elements = Object.fromEntries(ELEMENT_IDS.map((id) => [id, fakeElement()]));
  const formCalls = [];
  const voteCalls = [];
  const earlyFeedbackCalls = [];
  const context = {
    // forms.js has its own tests; here only which form goes into which holder matters.
    renderForm: (formName, holderId = "borang") => (holderId === "borang" ? formCalls : earlyFeedbackCalls).push(formName),
    renderVote: (state) => voteCalls.push(state), // vote.js has its own tests
    document: { getElementById: (id) => elements[id] },
    location: { search },
    URLSearchParams,
    Date,
    setInterval: () => 0,
  };
  vm.createContext(context);
  // `const` declarations stay in the script scope, so expose what the tests need.
  vm.runInContext(`${APP_SOURCE}\n;globalThis.__app = { SETTINGS, pickMode, pickVoteState, pickEarlyFeedbackState, renderEarlyFeedback, renderAction };`, context);
  return { app: context.__app, elements, formCalls, voteCalls, earlyFeedbackCalls };
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

test("attendance time shows the attendance form, feedback time the feedback form", () => {
  const { app, formCalls } = loadApp();
  formCalls.length = 0; // loading the page already rendered the current mode once
  app.renderAction("hadir");
  app.renderAction("selepas");
  assert.deepEqual(formCalls, ["attendance", "feedback"]);
});

test("the countdown mode shows the countdown and no form", () => {
  const { app, elements, formCalls } = loadApp();
  formCalls.length = 0;
  app.renderAction("sebelum");
  assert.deepEqual(formCalls, [null]);
  assert.equal(elements.countdown.hidden, false);
});

test("the Best Dress vote is open from 12.00 pm, closed from 6.00 pm, hidden on other days", () => {
  const { app } = loadApp();
  assert.equal(app.pickVoteState("sebelum", myt(11, 59)), "hidden");
  assert.equal(app.pickVoteState("hadir", myt(12)), "open");
  assert.equal(app.pickVoteState("hadir", myt(17, 59)), "open");
  assert.equal(app.pickVoteState("hadir", myt(18)), "closed");
  assert.equal(app.pickVoteState("selepas", myt(18)), "hidden");
});

test("the page draws the vote card once on load", () => {
  const { voteCalls } = loadApp();
  assert.equal(voteCalls.length, 1);
});

test("feedback joins attendance and the vote from 4.00 pm, then moves to the main card at 6.00 pm", () => {
  const { app } = loadApp();
  assert.equal(app.pickEarlyFeedbackState("hadir", myt(15, 59)), "hidden");
  assert.equal(app.pickEarlyFeedbackState("hadir", myt(16)), "open");
  assert.equal(app.pickEarlyFeedbackState("hadir", myt(17, 59)), "open");
  assert.equal(app.pickEarlyFeedbackState("selepas", myt(18)), "hidden");
  assert.equal(app.pickEarlyFeedbackState("sebelum", myt(11, 59)), "hidden");
});

test("a ?mod=hadir preview before the day shows the early feedback card", () => {
  const { app } = loadApp();
  assert.equal(app.pickEarlyFeedbackState("hadir", Date.UTC(2026, 10, 21)), "open");
});

test("the early feedback card puts the feedback form in its own holder, and clears it when closed", () => {
  const { app, elements, earlyFeedbackCalls } = loadApp();
  earlyFeedbackCalls.length = 0;
  app.renderEarlyFeedback("open");
  assert.equal(elements["maklum-balas"].hidden, false);
  app.renderEarlyFeedback("hidden");
  assert.equal(elements["maklum-balas"].hidden, true);
  assert.deepEqual(earlyFeedbackCalls, ["feedback", null]);
});
