// ===== The guest's No. K/P, remembered from attendance (spec: specs/remembered-ic.md) =====
// Kept in this phone's browser, so the Best Dress vote and the feedback after 6 pm start filled
// even after the page was closed. The page only ever shows the last 4 digits.
// Uses el and IC_PATTERN from forms.js, which loads first; forms.js and vote.js call the rest.

const IC_STORE_KEY = "anugerah2026-ic";
const IC_KEEP_UNTIL = Date.UTC(2026, 11, 31, 16, 0); // 1 Jan 2027, 12.00 am Malaysia time
let icThisVisit = ""; // used when the browser refuses storage (some private tabs)

// ----- Pure rules (tested in tests/remembered-ic.test.mjs) -----

function icLastDigits(ic) {
  return (ic || "").replace(/\D/g, "").slice(-4);
}

function rememberedIc() {
  let saved = "";
  try {
    saved = localStorage.getItem(IC_STORE_KEY) || "";
    if (saved && (!IC_PATTERN.test(saved) || Date.now() >= IC_KEEP_UNTIL)) {
      localStorage.removeItem(IC_STORE_KEY);
      saved = "";
    }
  } catch (error) {
    console.error("Could not read the saved IC, the field starts empty:", error);
  }
  return saved || icThisVisit;
}

function rememberIc(ic) {
  icThisVisit = (ic || "").trim();
  try {
    localStorage.setItem(IC_STORE_KEY, icThisVisit);
  } catch (error) {
    console.error("Could not save the IC, it is kept for this visit only:", error);
  }
  const voteIc = document.getElementById("f-undi-ic"); // the vote card, if it is already on screen
  if (voteIc && !voteIc.value) fillRememberedIc(voteIc);
}

// Drops the IC for good, and from the vote card too, unless the guest typed a different one there.
function forgetIc() {
  const voteIc = document.getElementById("f-undi-ic");
  if (voteIc) {
    if (voteIc.value === rememberedIc()) voteIc.value = "";
    voteIc.form?.classList.remove("ic-remembered"); // the field must be visible again for the next person
  }
  icThisVisit = "";
  try {
    localStorage.removeItem(IC_STORE_KEY);
  } catch (error) {
    console.error("Could not remove the saved IC:", error);
  }
}

// ----- DOM -----

// Fills an empty IC field and hides it behind one line with the last 4 digits (forms.css).
// "Tukar" brings the field back, for a guest who registered someone else on this phone.
function fillRememberedIc(input) {
  const ic = rememberedIc();
  if (!input || !ic || input.value) return;
  input.value = ic;
  const field = input.closest(".field");
  field.classList.add("ic-field");
  const note = field.nextElementSibling?.classList.contains("ic-note") ? field.nextElementSibling : buildIcNote(input);
  note.querySelector(".ic-text").textContent = `No. K/P anda (berakhir ${icLastDigits(ic)}) diambil daripada pendaftaran.`;
  field.after(note);
  input.form.classList.add("ic-remembered");
}

function buildIcNote(input) {
  const change = el("button", { class: "ic-change", type: "button", text: "Tukar" });
  change.addEventListener("click", () => {
    input.form.classList.remove("ic-remembered");
    input.focus();
  });
  return el("div", { class: "ic-note" }, [
    el("span", { class: "ic-check", "aria-hidden": "true", text: "✓" }),
    el("span", { class: "ic-text" }),
    change,
  ]);
}
