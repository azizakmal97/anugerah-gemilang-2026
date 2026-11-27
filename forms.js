// ===== In-page forms: attendance and feedback, sent to the same Google Forms =====
// Labels, help text and thank-you lines copy docs/forms.md, so both routes read the same.
// Field ids ("entry") come from each Google Form's public page (FB_PUBLIC_LOAD_DATA_).

// Only the feedback name goes on the e-sijil, so only it carries the spelling warning.
const NAME_HELP = "Eja nama anda dengan betul kerana nama ini akan dicetak pada sijil.";
const ATTENDANCE_NAME_HELP = "Tulis nama penuh anda.";
const RATING_ENDS = ["Kurang memuaskan", "Sangat memuaskan"];
const ROLES = ["Peserta", "Urus setia"]; // picks which e-sijil the guest gets
const GENDERS = ["Lelaki", "Perempuan"]; // splits the Best Dress name lists (scripts/best-dress.gs)
const CLINICS = ["KP Tapah", "KP Slim River", "KP Sungkai", "KP Bidor", "KP Tanjung Malim", "OMFS HSR", "Paeds Dental HSR"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IC_PATTERN = /^\d{6}-?\d{2}-?\d{4}$/; // same rule as the Google Form
const SEND_TIMEOUT_MS = 15000;

const FORMS = {
  attendance: {
    settingsKey: "attendanceFormUrl",
    submitLabel: "Sahkan Kehadiran",
    savesIcEntry: "718418112", // remembered once attendance is sent (remembered-ic.js)
    thanks: "Terima kasih. Kehadiran anda sudah direkod. Selamat menikmati majlis!",
    fields: [
      { entry: "562932983", kind: "text", label: "Nama penuh", help: ATTENDANCE_NAME_HELP, autocomplete: "name", uppercase: true },
      { entry: "718418112", kind: "ic", label: "No. Kad Pengenalan", help: "Untuk semakan sijil anda. Contoh: 900101-08-1234" },
      { entry: "1133614257", kind: "choice", label: "Jantina", options: GENDERS, missing: "Sila pilih jantina anda." },
      { entry: "1345289916", kind: "select", label: "Klinik atau unit", options: CLINICS },
      { entry: "75149903", kind: "choice", label: "Peranan", options: ROLES },
    ],
  },
  feedback: {
    settingsKey: "feedbackFormUrl",
    fillsIcEntry: "1284108868", // starts filled from attendance; the IC is dropped once feedback is sent
    submitLabel: "Hantar dan dapatkan sijil",
    thanks: "Terima kasih atas maklum balas anda. Jika No. K/P anda ada dalam senarai kehadiran, sijil akan sampai ke emel anda dalam masa terdekat. Jika tidak nampak, semak folder spam.",
    fields: [
      { entry: "1530453899", kind: "rating", label: "Secara keseluruhan, bagaimana penilaian anda terhadap majlis ini?" },
      { entry: "1508823172", kind: "rating", label: "Bagaimana pengacaraan dan atur cara majlis?" },
      { entry: "1916321474", kind: "rating", label: "Bagaimana makanan dan tempat majlis?" },
      { entry: "300279887", kind: "comment", label: "Ada cadangan atau komen untuk majlis akan datang?", help: "Pilihan. Boleh dibiarkan kosong.", optional: true },
      { entry: "720915841", kind: "text", label: "Nama penuh", help: NAME_HELP, autocomplete: "name", uppercase: true },
      { entry: "1284108868", kind: "ic", label: "No. Kad Pengenalan", help: "Untuk dicetak pada sijil. Contoh: 900101-08-1234" },
      { entry: "190592119", kind: "email", label: "Emel", help: "Sijil anda akan dihantar ke emel ini. Semak ejaan emel sebelum menghantar." },
    ],
  },
};

// ----- Pure rules (tested in tests/forms.test.mjs) -----

function validateField(field, rawValue) {
  const value = (rawValue || "").trim();
  if (!value) {
    if (field.optional) return "";
    if (field.kind === "select") return "Sila pilih klinik atau unit.";
    if (field.kind === "rating") return "Sila pilih satu nilai, 1 hingga 5.";
    if (field.missing) return field.missing;
    if (field.kind === "choice") return "Sila pilih peranan anda.";
    return "Sila isi ruangan ini.";
  }
  if (field.kind === "email" && !EMAIL_PATTERN.test(value)) return "Emel ini tidak sah. Contoh: nama@moh.gov.my";
  if (field.kind === "ic" && !IC_PATTERN.test(value)) return "Format No. K/P: 900101-08-1234";
  return "";
}

// Shapes an IC as it is typed: 871212080879 → 871212-08-0879. A dash is added only once
// the next digit arrives, so backspace over a dash never fights the guest.
function formatIcInput(rawValue) {
  const digits = (rawValue || "").replace(/\D/g, "").slice(0, 12);
  const parts = [digits.slice(0, 6), digits.slice(6, 8), digits.slice(8)].filter(Boolean);
  return parts.join("-");
}

function findErrors(spec, values) {
  const errors = {};
  spec.fields.forEach((field) => {
    const message = validateField(field, values[field.entry]);
    if (message) errors[field.entry] = message;
  });
  return errors;
}

function toFormBody(spec, values) {
  const body = new URLSearchParams();
  spec.fields.forEach((field) => {
    const value = (values[field.entry] || "").trim();
    // Names go out in capitals even when autofill or paste skipped the typing handler.
    body.append(`entry.${field.entry}`, field.uppercase ? value.toUpperCase() : value);
  });
  return body;
}

function formResponseUrl(viewUrl) {
  return viewUrl.replace(/\/viewform.*$/, "/formResponse");
}

// Wraps a send so a double tap while one is in flight does nothing.
function oneAtATime(send) {
  let pending = false;
  return async (...args) => {
    if (pending) return "busy";
    pending = true;
    try {
      return await send(...args);
    } finally {
      pending = false;
    }
  };
}

// Google answers with no CORS headers, so the reply is unreadable ("opaque").
// fetch only rejects when the request never left the phone, which is the failure we can see.
async function postToGoogle(url, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    await fetch(url, { method: "POST", mode: "no-cors", body, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ----- DOM -----

function el(tag, attributes = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attributes).forEach(([name, value]) => {
    if (name === "text") node.textContent = value;
    else node.setAttribute(name, value);
  });
  children.forEach((child) => node.append(child));
  return node;
}

// The main card's holder is "borang"; only that form owns the instruction line above it.
function renderForm(formName, holderId = "borang") {
  const holder = document.getElementById(holderId);
  const ownsInstruction = holderId === "borang";
  holder.replaceChildren();
  holder.hidden = !formName;
  if (!formName) return;
  if (ownsInstruction) showInstruction(true);
  const spec = FORMS[formName];
  if (!SETTINGS[spec.settingsKey]) {
    holder.append(el("p", { class: "form-status", text: "Pautan borang belum disediakan." }));
    return;
  }
  holder.append(buildForm(spec, () => renderForm(formName, holderId), ownsInstruction));
  if (spec.fillsIcEntry) fillRememberedIc(document.getElementById(`f-${spec.fillsIcEntry}`)); // remembered-ic.js
}

function buildForm(spec, restart, ownsInstruction) {
  const form = el("form", { class: "event-form", novalidate: "" });
  spec.fields.forEach((field) => form.append(buildField(field)));
  const button = el("button", { class: "btn", type: "submit", text: spec.submitLabel });
  const status = el("p", { class: "form-status", role: "status", hidden: "" });
  form.append(button, status);
  const send = oneAtATime(() => submitForm(spec, form, button, status, restart, ownsInstruction));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    send();
  });
  return form;
}

function buildField(field) {
  const id = `f-${field.entry}`;
  const errorNode = el("p", { class: "field-error", id: `${id}-err`, hidden: "" });
  const helpNode = field.help ? el("p", { class: "field-help", id: `${id}-help`, text: field.help }) : null;
  const describedBy = [helpNode && `${id}-help`, `${id}-err`].filter(Boolean).join(" ");

  if (field.kind === "rating") return buildRating(field, errorNode, describedBy);
  if (field.kind === "choice") return buildChoice(field, errorNode, describedBy);

  const control = buildControl(field, id, describedBy);
  const wrapper = el("div", { class: "field", "data-entry": field.entry });
  wrapper.append(el("label", { for: id, text: field.label }));
  if (helpNode) wrapper.append(helpNode);
  wrapper.append(control, errorNode);
  return wrapper;
}

function buildControl(field, id, describedBy) {
  const shared = { id, name: field.entry, "aria-describedby": describedBy };
  if (field.kind === "select") {
    const select = el("select", shared, [el("option", { value: "", text: "Pilih satu" })]);
    field.options.forEach((option) => select.append(el("option", { value: option, text: option })));
    return select;
  }
  if (field.kind === "comment") return el("textarea", { ...shared, rows: "3" });
  const byKind = {
    text: { type: "text", autocomplete: field.autocomplete || "off", ...(field.uppercase && { autocapitalize: "characters" }) },
    email: { type: "email", autocomplete: "email", inputmode: "email" },
    ic: { type: "text", autocomplete: "off", inputmode: "numeric", maxlength: "14" },
  };
  const input = el("input", { ...shared, ...byKind[field.kind] });
  if (field.kind === "ic") input.addEventListener("input", () => { input.value = formatIcInput(input.value); });
  if (field.uppercase) input.addEventListener("input", () => keepCaretWhile(input, () => { input.value = input.value.toUpperCase(); }));
  return input;
}

// Rewriting input.value moves the caret to the end, which breaks fixing a typo mid-name.
function keepCaretWhile(input, rewrite) {
  const caret = input.selectionStart;
  rewrite();
  input.setSelectionRange(caret, caret);
}

function buildRating(field, errorNode, describedBy) {
  const scale = el("div", { class: "rating" });
  for (let score = 1; score <= 5; score += 1) {
    const input = el("input", { type: "radio", name: field.entry, value: String(score), "aria-describedby": describedBy });
    scale.append(el("label", {}, [input, el("span", { text: String(score) })]));
  }
  const ends = el("p", { class: "rating-ends", "aria-hidden": "true" }, RATING_ENDS.map((text) => el("span", { text })));
  return el("fieldset", { class: "field", "data-entry": field.entry }, [el("legend", { text: field.label }), scale, ends, errorNode]);
}

// Same gold tiles as the rating, one per option, for a short either-or answer.
function buildChoice(field, errorNode, describedBy) {
  const tiles = el("div", { class: "rating rating-choice" });
  field.options.forEach((option) => {
    const input = el("input", { type: "radio", name: field.entry, value: option, "aria-describedby": describedBy });
    tiles.append(el("label", {}, [input, el("span", { text: option })]));
  });
  return el("fieldset", { class: "field", "data-entry": field.entry }, [el("legend", { text: field.label }), tiles, errorNode]);
}

function readValues(spec, form) {
  const values = {};
  spec.fields.forEach((field) => {
    const checked = form.querySelector(`[name="${field.entry}"]:checked`);
    const control = form.querySelector(`[name="${field.entry}"]`);
    const isRadio = field.kind === "rating" || field.kind === "choice";
    values[field.entry] = isRadio ? (checked ? checked.value : "") : control.value;
  });
  return values;
}

function showErrors(spec, form, errors) {
  spec.fields.forEach((field) => {
    const wrapper = form.querySelector(`[data-entry="${field.entry}"]`);
    const errorNode = wrapper.querySelector(".field-error");
    const message = errors[field.entry] || "";
    errorNode.textContent = message;
    errorNode.hidden = !message;
    wrapper.querySelectorAll("input, select, textarea").forEach((control) => {
      if (message) control.setAttribute("aria-invalid", "true");
      else control.removeAttribute("aria-invalid");
    });
  });
  const first = form.querySelector('[aria-invalid="true"]');
  if (first) first.focus();
}

async function submitForm(spec, form, button, status, restart, ownsInstruction = true) {
  const values = readValues(spec, form);
  const errors = findErrors(spec, values);
  showErrors(spec, form, errors);
  if (Object.keys(errors).length) return "invalid";

  button.disabled = true;
  button.textContent = "Menghantar…";
  status.hidden = true;
  const viewUrl = SETTINGS[spec.settingsKey];
  try {
    await postToGoogle(formResponseUrl(viewUrl), toFormBody(spec, values));
  } catch (error) {
    console.error("Form send failed:", error);
    button.disabled = false;
    button.textContent = "Cuba hantar semula";
    showSendError(status, viewUrl);
    return "failed";
  }
  if (spec.savesIcEntry) rememberIc(values[spec.savesIcEntry]);
  if (spec.fillsIcEntry) forgetIc();
  showThanks(form, spec.thanks, ownsInstruction, () => {
    if (spec.savesIcEntry) forgetIc(); // "Hantar untuk orang lain": the next person starts empty
    restart();
  });
  return "sent";
}

function showSendError(status, viewUrl) {
  const fallback = el("a", { href: viewUrl, target: "_blank", rel: "noopener", text: "isi di Borang Google" });
  status.replaceChildren("Jawapan belum dihantar. Semak talian internet dan cuba lagi atau ", fallback, ".");
  status.classList.add("is-error");
  status.hidden = false;
}

function showThanks(form, thanks, ownsInstruction, restart) {
  const again = el("button", { class: "btn-ghost", type: "button", text: "Hantar untuk orang lain" });
  again.addEventListener("click", restart);
  const done = el("div", { class: "form-done", tabindex: "-1" }, [el("p", { text: thanks }), again]);
  form.replaceWith(done);
  if (ownsInstruction) showInstruction(false);
  done.focus();
}

// The "isi borang ini" line above the form reads wrong once the form is sent.
function showInstruction(visible) {
  const line = document.getElementById("action-text");
  if (line) line.hidden = !visible || !line.textContent;
}
