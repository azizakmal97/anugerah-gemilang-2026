// Tests for remembered-ic.js: the attendance IC is kept on this phone so the vote card and the
// feedback form start filled, shows only its last 4 digits, and is dropped at the right moments.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const FORMS_SOURCE = readFileSync(new URL("../forms.js", import.meta.url), "utf8");
const REMEMBERED_SOURCE = readFileSync(new URL("../remembered-ic.js", import.meta.url), "utf8");
const IC = "871212-08-0879";
const NAME = "Ali  bin Abu";
const OTHER_IC = "900101-08-1234";

// A phone's browser storage; `broken` acts like a private tab that refuses it.
function fakeStorage({ broken = false } = {}) {
  const saved = new Map();
  const guard = () => { if (broken) throw new Error("storage refused"); };
  return {
    saved,
    getItem: (key) => { guard(); return saved.has(key) ? saved.get(key) : null; },
    setItem: (key, value) => { guard(); saved.set(key, String(value)); },
    removeItem: (key) => { guard(); saved.delete(key); },
  };
}

function classSet() {
  const names = new Set();
  return { names, add: (name) => names.add(name), remove: (name) => names.delete(name), contains: (name) => names.has(name) };
}

// Just enough of a DOM node for el() and the "Tukar" note.
function fakeNode() {
  const node = {
    classList: classSet(),
    children: [],
    textContent: "",
    listeners: {},
    setAttribute(name, value) { if (name === "class") value.split(" ").forEach((one) => node.classList.add(one)); },
    append(...kids) { node.children.push(...kids); },
    addEventListener(type, run) { node.listeners[type] = run; },
    focus() {},
    querySelector(selector) { return node.children.find((kid) => kid.classList.contains(selector.slice(1))) || null; },
  };
  return node;
}

// An IC input inside its field inside a form, like buildField makes.
function fakeIcInput(value = "") {
  const form = { classList: classSet() };
  const field = { classList: classSet(), nextElementSibling: null, after(node) { this.nextElementSibling = node; } };
  const input = { value, form, focused: false, closest: () => field, focus() { this.focused = true; } };
  return { input, field, form };
}

function loadRemembered({ storage = fakeStorage(), now = Date.UTC(2026, 11, 5, 4, 30), page = {} } = {}) {
  const context = {
    SETTINGS: { attendanceFormUrl: "https://docs.google.com/forms/d/e/ABC/viewform", feedbackFormUrl: "https://docs.google.com/forms/d/e/DEF/viewform" },
    document: { createElement: fakeNode, getElementById: (id) => page[id] || null },
    localStorage: storage,
    Date: { now: () => now, UTC: Date.UTC },
    URLSearchParams, AbortController, setTimeout, clearTimeout,
    console: { error() {} },
    fetch: async () => {},
  };
  vm.createContext(context);
  // `const` declarations stay in the script scope, so expose what the tests need.
  vm.runInContext(
    `${FORMS_SOURCE}\n${REMEMBERED_SOURCE}\n;globalThis.__ic = { submitForm, rememberIc, rememberedIc, forgetIc, fillRememberedIc, icLastDigits, IC_STORE_KEY };`,
    context,
  );
  return { ...context.__ic, storage, page };
}

// A sent form with one IC field, enough to drive submitForm without a browser.
function sentForm(value) {
  const control = { value, getAttribute: () => null, removeAttribute() {} };
  const errorNode = { textContent: "", hidden: true };
  const wrapper = { querySelector: () => errorNode, querySelectorAll: () => [control] };
  return {
    querySelector(selector) {
      if (selector.includes(":checked")) return null;
      if (selector.startsWith("[name=")) return control;
      if (selector.startsWith("[data-entry=")) return wrapper;
      return null;
    },
    replaceWith() {},
  };
}
const button = () => ({ disabled: false, textContent: "" });
const status = () => ({ hidden: true, classList: classSet() });
const ATTENDANCE = { settingsKey: "attendanceFormUrl", thanks: "", savesIcEntry: "1", fields: [{ entry: "1", kind: "ic", label: "No. K/P" }] };
const FEEDBACK = { settingsKey: "feedbackFormUrl", thanks: "", fillsIcEntry: "1", fields: [{ entry: "1", kind: "ic", label: "No. K/P" }] };

test("after attendance is sent the IC is kept on the phone and fills the vote card", async () => {
  const card = fakeIcInput();
  const { submitForm, storage, IC_STORE_KEY } = loadRemembered({ page: { "f-undi-ic": card.input } });
  assert.equal(await submitForm(ATTENDANCE, sentForm(IC), button(), status(), () => {}), "sent");
  assert.equal(storage.saved.get(IC_STORE_KEY), IC);
  assert.equal(card.input.value, IC);
  assert.ok(card.form.classList.contains("ic-remembered"), "the field hides behind one line");
});

test("the feedback form starts filled after the page was closed and opened again", () => {
  const storage = fakeStorage();
  loadRemembered({ storage }).rememberIc(IC);
  const later = loadRemembered({ storage, now: Date.UTC(2026, 11, 5, 11, 0) }); // 7.00 pm, a fresh page
  const feedback = fakeIcInput();
  later.fillRememberedIc(feedback.input);
  assert.equal(feedback.input.value, IC);
  assert.ok(feedback.field.classList.contains("ic-field"));
});

test("the line shows only the last 4 digits, never the full IC", () => {
  const { rememberIc, fillRememberedIc, icLastDigits } = loadRemembered();
  assert.equal(icLastDigits("871212080879"), "0879");
  rememberIc(IC);
  const feedback = fakeIcInput();
  fillRememberedIc(feedback.input);
  const line = feedback.field.nextElementSibling.querySelector(".ic-text").textContent;
  assert.equal(line, "No. K/P anda (berakhir 0879) diambil daripada pendaftaran.");
  assert.ok(!line.includes("871212"));
});

test("on a shared phone the line names whose IC it is, for the vote and for feedback", () => {
  const { rememberIc, fillRememberedIc } = loadRemembered();
  rememberIc(IC, NAME);
  const vote = fakeIcInput();
  fillRememberedIc(vote.input, "Undi");
  assert.equal(vote.field.nextElementSibling.querySelector(".ic-text").textContent, "Undi sebagai ALI BIN ABU (K/P berakhir dengan 0879).");
  const feedback = fakeIcInput();
  fillRememberedIc(feedback.input, "Beri maklum balas");
  assert.equal(feedback.field.nextElementSibling.querySelector(".ic-text").textContent, "Beri maklum balas sebagai ALI BIN ABU (K/P berakhir dengan 0879).");
});

test("a second guest's IC never shows with the first guest's name", () => {
  const storage = fakeStorage();
  const { rememberIc, forgetIc, fillRememberedIc } = loadRemembered({ storage });
  rememberIc(IC, NAME);
  rememberIc(OTHER_IC); // a check-in that sent no name
  const card = fakeIcInput();
  fillRememberedIc(card.input, "Undi");
  assert.equal(card.field.nextElementSibling.querySelector(".ic-text").textContent, "No. K/P anda (berakhir 1234) diambil daripada pendaftaran.");
  rememberIc(IC, NAME);
  forgetIc();
  assert.equal(storage.saved.size, 0, "the name goes with the IC");
});

test("Tukar brings the field back", () => {
  const { rememberIc, fillRememberedIc } = loadRemembered();
  rememberIc(IC);
  const feedback = fakeIcInput();
  fillRememberedIc(feedback.input);
  feedback.field.nextElementSibling.querySelector(".ic-change").listeners.click();
  assert.equal(feedback.form.classList.contains("ic-remembered"), false);
  assert.equal(feedback.input.focused, true);
});

test("an IC the guest already typed is not overwritten", () => {
  const card = fakeIcInput(OTHER_IC);
  loadRemembered({ page: { "f-undi-ic": card.input } }).rememberIc(IC);
  assert.equal(card.input.value, OTHER_IC);
});

test("sending feedback drops the IC from the phone", async () => {
  const { rememberIc, submitForm, rememberedIc, storage } = loadRemembered();
  rememberIc(IC);
  assert.equal(await submitForm(FEEDBACK, sentForm(IC), button(), status(), () => {}), "sent");
  assert.equal(rememberedIc(), "");
  assert.equal(storage.saved.size, 0);
});

test("forgetting clears the vote card only if it still holds the remembered IC", () => {
  const card = fakeIcInput();
  const { rememberIc, forgetIc, rememberedIc } = loadRemembered({ page: { "f-undi-ic": card.input } });
  rememberIc(IC);
  forgetIc();
  assert.equal(card.input.value, "");
  assert.equal(card.form.classList.contains("ic-remembered"), false);
  assert.equal(rememberedIc(), "");

  rememberIc(IC);
  card.input.value = OTHER_IC; // the guest changed it by hand
  forgetIc();
  assert.equal(card.input.value, OTHER_IC);
});

test("a saved IC is ignored after 31 Dec, and so is a saved value that is not an IC", () => {
  const storage = fakeStorage();
  loadRemembered({ storage }).rememberIc(IC, NAME);
  assert.equal(loadRemembered({ storage, now: Date.UTC(2026, 11, 31, 16, 0) }).rememberedIc(), "");
  assert.equal(storage.saved.size, 0, "the expired IC is removed, and its name with it");

  storage.setItem("anugerah2026-ic", "<b>hello</b>");
  assert.equal(loadRemembered({ storage }).rememberedIc(), "");
});

test("a browser that refuses storage still keeps the IC for this visit", () => {
  const { rememberIc, rememberedIc, forgetIc } = loadRemembered({ storage: fakeStorage({ broken: true }) });
  rememberIc(IC);
  assert.equal(rememberedIc(), IC);
  forgetIc();
  assert.equal(rememberedIc(), "");
});
