// Tests for forms.js: what counts as a valid answer, what gets sent to Google,
// and that a send can neither run twice nor pretend to succeed when it failed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const FORMS_SOURCE = readFileSync(new URL("../forms.js", import.meta.url), "utf8");

function loadForms({ fetch = async () => {} } = {}) {
  const page = { "action-text": Object.assign(fakeNode(), { textContent: "Isi borang ini." }) }; // the line above the form
  const context = {
    SETTINGS: { attendanceFormUrl: "https://docs.google.com/forms/d/e/ABC/viewform", feedbackFormUrl: "" },
    document: { createElement: fakeNode, getElementById: (id) => page[id] || null },
    URLSearchParams,
    AbortController,
    setTimeout,
    clearTimeout,
    console: { error() {} },
    fetch,
  };
  vm.createContext(context);
  // `const` declarations stay in the script scope, so expose what the tests need.
  vm.runInContext(
    `${FORMS_SOURCE}\n;globalThis.__forms = { FORMS, formatIcInput, validateField, findErrors, toFormBody, formResponseUrl, oneAtATime, submitForm, moveForm };`,
    context,
  );
  return { ...context.__forms, page };
}

function fakeNode() {
  const attributes = {};
  return {
    textContent: "",
    hidden: false,
    disabled: false,
    children: [],
    classes: [],
    classList: { add(name) { this.owner.classes.push(name); } },
    setAttribute(name, value) { attributes[name] = String(value); },
    getAttribute(name) { return name in attributes ? attributes[name] : null; },
    removeAttribute(name) { delete attributes[name]; },
    append(...nodes) { this.children.push(...nodes); },
    replaceChildren(...nodes) { this.children = nodes; },
    addEventListener() {},
    focus() {},
  };
}

function node() {
  const created = fakeNode();
  created.classList.owner = created;
  return created;
}

// A form with one text field, enough to drive submitForm without a browser.
function fakeForm(value) {
  const control = Object.assign(node(), { value });
  const errorNode = node();
  const wrapper = { querySelector: () => errorNode, querySelectorAll: () => [control] };
  const form = {
    replacedWith: null,
    querySelector(selector) {
      if (selector.includes(":checked")) return null;
      if (selector.startsWith("[name=")) return control;
      if (selector.startsWith("[data-entry=")) return wrapper;
      return control.getAttribute("aria-invalid") ? control : null;
    },
    replaceWith(replacement) { this.replacedWith = replacement; },
  };
  return { form, errorNode };
}

const ONE_FIELD = { settingsKey: "attendanceFormUrl", thanks: "Terima kasih.", fields: [{ entry: "1", kind: "text", label: "Nama penuh" }] };

test("required fields must be filled, the comment may stay empty", () => {
  const { validateField } = loadForms();
  assert.equal(validateField({ kind: "text" }, "   "), "Sila isi ruangan ini.");
  assert.equal(validateField({ kind: "select" }, ""), "Sila pilih klinik atau unit.");
  assert.equal(validateField({ kind: "rating" }, ""), "Sila pilih satu nilai, 1 hingga 5.");
  assert.equal(validateField({ kind: "comment", optional: true }, ""), "");
});

test("email must look like an email", () => {
  const { validateField } = loadForms();
  assert.equal(validateField({ kind: "email" }, "nama@moh.gov.my"), "");
  assert.match(validateField({ kind: "email" }, "nama.moh.gov.my"), /tidak sah/);
  assert.match(validateField({ kind: "email" }, "nama @moh.gov.my"), /tidak sah/);
});

test("IC follows the Google Form rule: 12 digits, dashes optional", () => {
  const { validateField } = loadForms();
  assert.equal(validateField({ kind: "ic" }, "900101-08-1234"), "");
  assert.equal(validateField({ kind: "ic" }, "900101081234"), "");
  assert.match(validateField({ kind: "ic" }, "90010108123"), /900101-08-1234/);
  assert.match(validateField({ kind: "ic" }, "900101 08 1234"), /900101-08-1234/);
});

test("IC gets its dashes while typing, keeps digits only and stops at 12 digits", () => {
  const { formatIcInput, validateField } = loadForms();
  assert.equal(formatIcInput("871212080879"), "871212-08-0879");
  assert.equal(formatIcInput("8712"), "8712");
  assert.equal(formatIcInput("871212"), "871212"); // no trailing dash, so backspace still works
  assert.equal(formatIcInput("8712120"), "871212-0");
  assert.equal(formatIcInput("87121208"), "871212-08");
  assert.equal(formatIcInput("871212 08 0879 99"), "871212-08-0879");
  assert.equal(formatIcInput("a871212-08-0879"), "871212-08-0879");
  assert.equal(formatIcInput(""), "");
  assert.equal(validateField({ kind: "ic" }, formatIcInput("871212080879")), "");
});

test("every field of both forms is checked, and a complete answer has no errors", () => {
  const { FORMS, findErrors } = loadForms();
  const empty = findErrors(FORMS.feedback, {});
  assert.equal(Object.keys(empty).length, FORMS.feedback.fields.length - 1); // all but the comment
  const filled = { 562932983: "Siti Aminah", 718418112: "871212-08-0879", 1133614257: "Perempuan", 1345289916: "KP Tapah", 75149903: "Peserta" };
  assert.deepEqual({ ...findErrors(FORMS.attendance, filled) }, {});
});

test("attendance asks for IC and role, so the e-sijil can be matched and picked", () => {
  const { FORMS, findErrors, validateField } = loadForms();
  const byEntry = Object.fromEntries(FORMS.attendance.fields.map((field) => [field.entry, field]));
  assert.equal(byEntry[718418112].kind, "ic");
  assert.deepEqual([...byEntry[75149903].options], ["Peserta", "Urus setia"]);
  assert.equal(validateField(byEntry[75149903], ""), "Sila pilih peranan anda.");
  const errors = findErrors(FORMS.attendance, { 562932983: "Siti", 1345289916: "KP Tapah" });
  assert.deepEqual(Object.keys(errors).sort(), ["1133614257", "718418112", "75149903"]);
  assert.equal(errors[1133614257], "Sila pilih jantina anda.");
  assert.deepEqual([...byEntry[1133614257].options], ["Lelaki", "Perempuan"]);
});

test("attendance asks no email: the sijil is matched by IC only (owner 2026-11-17)", () => {
  const { FORMS } = loadForms();
  assert.equal(FORMS.attendance.fields.some((field) => field.kind === "email"), false);
});

test("answers go to Google as entry.<id> fields on the formResponse address", () => {
  const { FORMS, toFormBody, formResponseUrl } = loadForms();
  const body = toFormBody(FORMS.attendance, { 562932983: "  Siti Aminah ", 718418112: "871212-08-0879", 1133614257: "Perempuan", 1345289916: "KP Bidor", 75149903: "Urus setia" });
  assert.equal(body.get("entry.1133614257"), "Perempuan");
  assert.equal(body.get("entry.75149903"), "Urus setia");
  assert.equal(body.get("entry.562932983"), "SITI AMINAH", "names are sent in capitals");
  assert.equal(body.get("entry.1345289916"), "KP Bidor");
  assert.equal(formResponseUrl("https://docs.google.com/forms/d/e/ABC/viewform?usp=sf_link"), "https://docs.google.com/forms/d/e/ABC/formResponse");
});

test("both name fields are marked for capitals and nothing else is", () => {
  const { FORMS } = loadForms();
  const capitalFields = [...FORMS.attendance.fields, ...FORMS.feedback.fields].filter((field) => field.uppercase);
  assert.deepEqual(capitalFields.map((field) => field.label), ["Nama penuh", "Nama penuh"]);
});

test("a comment keeps its own letter case when sent", () => {
  const { FORMS, toFormBody } = loadForms();
  const body = toFormBody(FORMS.feedback, { 300279887: "Terima kasih", 720915841: "ali" });
  assert.equal(body.get("entry.300279887"), "Terima kasih");
  assert.equal(body.get("entry.720915841"), "ALI");
});

test("a double tap while sending sends only once", async () => {
  const { oneAtATime } = loadForms();
  let sends = 0;
  let finish;
  const send = oneAtATime(() => { sends += 1; return new Promise((resolve) => { finish = resolve; }); });
  const first = send();
  assert.equal(await send(), "busy");
  finish("sent");
  assert.equal(await first, "sent");
  assert.equal(sends, 1);
});

test("an invalid answer is never sent and the field shows why", async () => {
  let fetched = false;
  const { submitForm } = loadForms({ fetch: async () => { fetched = true; } });
  const { form, errorNode } = fakeForm("");
  const status = node();
  const result = await submitForm(ONE_FIELD, form, node(), status, () => {});
  assert.equal(result, "invalid");
  assert.equal(fetched, false);
  assert.equal(errorNode.hidden, false);
  assert.equal(errorNode.textContent, "Sila isi ruangan ini.");
  assert.equal(status.hidden, false, "the line beside the button says something is missing");
  assert.match(status.textContent, /belum diisi/);
});

test("the button is disabled while sending, then the thanks replace the form and its instruction", async () => {
  let finish;
  const { submitForm, page } = loadForms({ fetch: () => new Promise((resolve) => { finish = resolve; }) });
  const { form } = fakeForm("Siti Aminah");
  const button = node();
  const sending = submitForm(ONE_FIELD, form, button, node(), () => {});
  assert.equal(button.disabled, true);
  finish();
  assert.equal(await sending, "sent");
  assert.ok(form.replacedWith, "form was replaced by the thank-you block");
  assert.equal(page["action-text"].hidden, true, "the 'isi borang' line is gone once it is sent");
});

test("a failed send says so, offers the Google Form and lets the guest retry", async () => {
  const { submitForm } = loadForms({ fetch: async () => { throw new TypeError("Failed to fetch"); } });
  const { form } = fakeForm("Siti Aminah");
  const button = node();
  const status = node();
  assert.equal(await submitForm(ONE_FIELD, form, button, status, () => {}), "failed");
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, "Cuba hantar semula");
  assert.equal(status.hidden, false);
  assert.deepEqual(status.classes, ["is-error"]);
  assert.equal(form.replacedWith, null, "nothing says sent");
});

test("moveForm carries a half-typed form, and its typing, into the main card", () => {
  const { moveForm, page } = loadForms();
  const typed = { tag: "form", value: "ALI BIN ABU" };
  const holder = (childNodes) => Object.assign(node(), { childNodes, querySelector: (tag) => childNodes.find((kid) => kid.tag === tag) || null });
  page["maklum-balas-isi"] = holder([typed]);
  page.borang = Object.assign(holder([]), { hidden: true });
  assert.equal(moveForm("maklum-balas-isi", "borang"), true);
  assert.equal(page.borang.children[0], typed, "the same node moves, so nothing typed is lost");
  assert.equal(page.borang.hidden, false);
  assert.equal(page["maklum-balas-isi"].hidden, true);

  page["maklum-balas-isi"] = holder([]);
  assert.equal(moveForm("maklum-balas-isi", "borang"), false, "nothing to move: the caller draws a fresh form");
});
