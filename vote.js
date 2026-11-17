// ===== Best Dress vote (spec: specs/best-dress-vote.md) =====
// Two name searches, Lelaki and Perempuan, fed by the web app in scripts/best-dress.gs,
// then the voter's own IC, posted to the "Undian Best Dress 2026" Google Form like the other forms.
// The page never shows a count or a ranking: results live only in the owner's private sheet.
// Uses el, formatIcInput, validateField, oneAtATime, postToGoogle, formResponseUrl,
// showSendError, attendeeIc and forgetAttendeeIc from forms.js, which loads first.

const VOTE_MIN_LETTERS = 3; // the web app answers nothing shorter, so the page does not ask
const VOTE_SEARCH_DELAY_MS = 300;
const VOTE_SEARCH_TIMEOUT_MS = 10000;
const VOTE_CHECK_AGAIN_MS = 60000; // while the web app still says "not yet", ask again each minute
const VOTE_NOTICE = "Satu undi sahaja bagi setiap No. K/P. Undi pertama yang dikira.";
const PICK_HELP = "Taip sekurang-kurangnya 3 huruf nama, kemudian pilih daripada senarai.";
const VOTE_LOADING_TEXT = "Memuatkan undian…";
const VOTE_WAITING_TEXT = "Undian Best Dress dibuka pada 5 Disember, 12.00 tengah hari.";
const VOTE_CLOSED_TEXT = "Undian Best Dress sudah ditutup. Pemenang akan diumumkan sebentar lagi.";

// Entry ids come from the vote form's public page (FB_PUBLIC_LOAD_DATA_), like FORMS in forms.js.
// An empty id or link keeps the vote card on "belum disediakan", so a half-set form never loses votes.
const VOTE = {
  thanks: "Terima kasih. Undian anda sudah diterima.",
  fields: [
    { key: "lelaki", entry: "1108392799", kind: "pick", label: "Lelaki", help: PICK_HELP },
    { key: "perempuan", entry: "2135311797", kind: "pick", label: "Perempuan", help: PICK_HELP },
    { key: "ic", entry: "1013454233", kind: "ic", label: "No. Kad Pengenalan anda", help: "Untuk semakan satu undi bagi setiap orang. Contoh: 900101-08-1234" },
  ],
};

// ----- Pure rules (tested in tests/vote.test.mjs) -----

function isVoteReady() {
  return Boolean(SETTINGS.voteFormUrl && SETTINGS.voteSearchUrl && VOTE.fields.every((field) => field.entry));
}

// Counted the way the web app counts: letters only, so "a b" or "s1@" never sends a search.
function countLetters(text) {
  return (text || "").replace(/[^A-Za-z]/g, "").length;
}

// values: { lelaki, perempuan } hold the names picked from the list (empty if only typed), ic as typed.
function findVoteErrors(values) {
  const errors = {};
  ["lelaki", "perempuan"].forEach((key) => {
    if (!values[key]) errors[key] = "Pilih satu nama daripada senarai.";
  });
  if (!errors.lelaki && values.lelaki === values.perempuan) {
    errors.perempuan = "Pilih nama yang berlainan untuk Lelaki dan Perempuan.";
  }
  const icError = validateField({ kind: "ic" }, values.ic);
  if (icError) errors.ic = icError;
  return errors;
}

function toVoteBody(values) {
  const body = new URLSearchParams();
  VOTE.fields.forEach((field) => body.append(`entry.${field.entry}`, (values[field.key] || "").trim()));
  return body;
}

// The reply is shaped by our own web app, but it still crosses the network: keep strings only.
async function searchNames(query) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VOTE_SEARCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${SETTINGS.voteSearchUrl}?q=${encodeURIComponent(query)}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`Name search answered ${response.status}`);
    const reply = await response.json();
    const names = Array.isArray(reply.names) ? reply.names.filter((name) => typeof name === "string") : [];
    return { open: reply.open === true, names: names.slice(0, 10) };
  } finally {
    clearTimeout(timer);
  }
}

// The web app's clock decides whether voting is open; the phone's clock only picks the words.
// A "not open" answer in the first half of the day's window means it has not started yet
// (a phone clock running fast, or ?mod=hadir before the day); after that it has closed.
function voteNotOpenReason(now) {
  const halfway = (SETTINGS.attendanceOpensAt + SETTINGS.voteClosesAt) / 2;
  return now < halfway ? "waiting" : "closed";
}

// ----- DOM -----

let voteRenderId = 0; // each render bumps it, so an older check that answers late changes nothing

// state: "hidden" | "open" | "closed", picked by pickVoteState in app.js.
function renderVote(state) {
  voteRenderId += 1;
  const section = document.getElementById("undian");
  const holder = document.getElementById("undian-isi");
  holder.replaceChildren();
  section.hidden = state === "hidden";
  if (state === "closed") {
    holder.append(el("p", { class: "form-status", text: VOTE_CLOSED_TEXT }));
    return;
  }
  if (state !== "open") return;
  if (!isVoteReady()) {
    holder.append(el("p", { class: "form-status", text: "Pautan undian belum disediakan." }));
    return;
  }
  holder.append(el("p", { class: "form-status", text: VOTE_LOADING_TEXT }));
  openWhenServerAgrees(voteRenderId);
}

// The form shows only once the web app says voting is open, so nobody fills in a vote it would refuse.
async function openWhenServerAgrees(renderId) {
  let open = true; // a failed check still shows the form: the name search then says what went wrong
  try {
    open = (await searchNames("")).open;
  } catch (error) {
    console.error("Vote check failed:", error);
  }
  if (renderId !== voteRenderId) return;
  if (!open) {
    showVoteNotOpen();
    return;
  }
  document.getElementById("undian-isi").replaceChildren(buildVoteForm());
}

function showVoteNotOpen() {
  if (voteNotOpenReason(Date.now()) === "closed") {
    renderVote("closed");
    return;
  }
  voteRenderId += 1;
  const renderId = voteRenderId;
  document.getElementById("undian-isi").replaceChildren(el("p", { class: "form-status", text: VOTE_WAITING_TEXT }));
  setTimeout(() => {
    if (renderId === voteRenderId) openWhenServerAgrees(renderId);
  }, VOTE_CHECK_AGAIN_MS);
}

function buildVoteForm() {
  const form = el("form", { class: "event-form", novalidate: "" });
  const picks = {};
  VOTE.fields.forEach((field) => {
    if (field.kind === "pick") {
      picks[field.key] = buildPickField(field);
      form.append(picks[field.key].wrapper);
    } else {
      form.append(buildField({ ...field, entry: `undi-${field.key}` })); // forms.js; the id only names the DOM nodes
    }
  });
  const icInput = form.querySelector("#f-undi-ic");
  if (icInput && attendeeIc) {
    icInput.value = attendeeIc; // set by forms.js after attendance is sent
    form.classList.add("ic-remembered"); // hides the field behind one line (forms.css)
  }
  form.append(buildIcNote(form, icInput));
  const button = el("button", { class: "btn", type: "submit", text: "Hantar Undian" });
  const status = el("p", { class: "form-status", role: "status", hidden: "" });
  form.append(el("p", { class: "vote-notice", text: VOTE_NOTICE }), button, status);
  const send = oneAtATime(() => submitVote(form, picks, button, status));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    send();
  });
  return form;
}

// Shown only while the form has "ic-remembered"; "Tukar" brings the field back for a different IC.
function buildIcNote(form, icInput) {
  const change = el("button", { class: "ic-change", type: "button", text: "Tukar" });
  change.addEventListener("click", () => {
    form.classList.remove("ic-remembered");
    icInput.focus();
  });
  return el("div", { class: "vote-ic-note" }, [
    el("span", { class: "ic-check", "aria-hidden": "true", text: "✓" }),
    el("span", { class: "ic-text", text: "No. K/P anda sudah disahkan semasa daftar." }),
    change,
  ]);
}

function buildPickField(field) {
  const id = `undi-${field.key}`;
  const input = el("input", {
    id, type: "text", autocomplete: "off", autocapitalize: "words", enterkeyhint: "search",
    "aria-describedby": `${id}-help ${id}-status ${id}-err`, "aria-controls": `${id}-list`,
  });
  const list = el("ul", { class: "pick-list", id: `${id}-list`, hidden: "" });
  const status = el("p", { class: "pick-status", id: `${id}-status`, role: "status" });
  const errorNode = el("p", { class: "field-error", id: `${id}-err`, hidden: "" });
  const wrapper = el("div", { class: "field", "data-key": field.key }, [
    el("label", { for: id, text: field.label }),
    el("p", { class: "field-help", id: `${id}-help`, text: field.help }),
    input, list, status, errorNode,
  ]);

  const pick = { wrapper, input, errorNode, chosen: "" };
  let timer = null;
  let latest = 0; // only the newest search may fill the list, however the replies arrive

  const choose = (name) => {
    pick.chosen = name;
    input.value = name;
    input.classList.add("is-chosen");
    input.removeAttribute("aria-invalid");
    errorNode.hidden = true;
    list.replaceChildren();
    list.hidden = true;
    status.textContent = `Pilihan anda: ${name}`;
  };

  const runSearch = async (query, ticket) => {
    status.textContent = "Mencari…";
    try {
      const reply = await searchNames(query);
      if (ticket !== latest) return;
      if (!reply.open) {
        showVoteNotOpen();
        return;
      }
      showOptions(list, reply.names, choose);
      status.textContent = reply.names.length ? "" : "Nama tidak ditemui. Pastikan dia sudah sahkan kehadiran.";
    } catch (error) {
      if (ticket !== latest) return;
      console.error("Name search failed:", error);
      status.textContent = "Carian gagal. Semak talian internet dan taip semula.";
    }
  };

  input.addEventListener("input", () => {
    pick.chosen = "";
    input.classList.remove("is-chosen");
    clearTimeout(timer);
    latest += 1;
    const query = input.value.trim();
    if (countLetters(query) < VOTE_MIN_LETTERS) {
      list.replaceChildren();
      list.hidden = true;
      status.textContent = "";
      return;
    }
    const ticket = latest;
    timer = setTimeout(() => runSearch(query, ticket), VOTE_SEARCH_DELAY_MS);
  });
  return pick;
}

function showOptions(list, names, choose) {
  list.replaceChildren(...names.map((name) => {
    const option = el("button", { class: "pick-option", type: "button", text: name });
    option.addEventListener("click", () => choose(name));
    return el("li", {}, [option]);
  }));
  list.hidden = names.length === 0;
}

function showVoteErrors(form, errors) {
  VOTE.fields.forEach((field) => {
    const wrapper = form.querySelector(`[data-key="${field.key}"], [data-entry="undi-${field.key}"]`);
    const errorNode = wrapper.querySelector(".field-error");
    const control = wrapper.querySelector("input");
    const message = errors[field.key] || "";
    errorNode.textContent = message;
    errorNode.hidden = !message;
    if (message) control.setAttribute("aria-invalid", "true");
    else control.removeAttribute("aria-invalid");
  });
  const first = form.querySelector('[aria-invalid="true"]');
  if (first) first.focus();
}

async function submitVote(form, picks, button, status) {
  const values = {
    lelaki: picks.lelaki.chosen,
    perempuan: picks.perempuan.chosen,
    ic: form.querySelector("#f-undi-ic").value,
  };
  const errors = findVoteErrors(values);
  showVoteErrors(form, errors);
  if (Object.keys(errors).length) return "invalid";

  button.disabled = true;
  button.textContent = "Menghantar…";
  status.hidden = true;
  try {
    await postToGoogle(formResponseUrl(SETTINGS.voteFormUrl), toVoteBody(values));
  } catch (error) {
    console.error("Vote send failed:", error);
    button.disabled = false;
    button.textContent = "Cuba hantar semula";
    showSendError(status, SETTINGS.voteFormUrl);
    return "failed";
  }
  forgetAttendeeIc(); // the next voter must not start with this guest's IC
  const again = el("button", { class: "btn-ghost", type: "button", text: "Undi untuk orang lain" });
  again.addEventListener("click", () => renderVote("open"));
  const done = el("div", { class: "form-done", tabindex: "-1" }, [el("p", { text: VOTE.thanks }), again]);
  form.replaceWith(done);
  done.focus();
  return "sent";
}
