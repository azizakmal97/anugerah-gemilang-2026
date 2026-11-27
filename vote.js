// ===== Best Dress vote (spec: specs/best-dress-vote.md) =====
// Two name searches, Lelaki and Perempuan, fed by the web app in scripts/best-dress.gs,
// then the voter's own IC, posted to the "Undian Best Dress 2026" Google Form like the other forms.
// The page never shows a count or a ranking: results live only in the owner's private sheet.
// Uses el, formatIcInput, validateField, oneAtATime, postToGoogle, formResponseUrl,
// showSendError from forms.js, and fillRememberedIc and forgetIc from remembered-ic.js; both load first.

const VOTE_MIN_LETTERS = 3; // the web app answers nothing shorter, so the page does not ask
const VOTE_SEARCH_DELAY_MS = 150;
const VOTE_MAX_NAMES = 10; // the web app answers at most this many, so a shorter reply holds every match
const VOTE_SEARCH_TIMEOUT_MS = 10000;
const VOTE_RETRY_MS = 1500; // a busy or failed search is asked once more after this pause
const VOTE_CHECK_AGAIN_MS = 60000; // while the web app still says "not yet", ask again each minute
const VOTE_CACHE_FRESH_MS = 60000; // an older saved reply still shows at once, but the web app is asked again
const VOTE_NOTICE = "Satu undi sahaja bagi setiap No. K/P. Undi pertama yang dikira.";
const PICK_HELP = "Taip sekurang-kurangnya 3 huruf nama, kemudian tekan nama itu dalam senarai yang keluar.";
const PICK_HOW_TO = "Cara mengundi: taip nama, kemudian tekan nama itu dalam senarai. Nama yang ditaip sahaja tanpa dipilih tidak boleh dihantar.";
const PICK_MISSING = "Nama belum dipilih. Taip nama, kemudian tekan nama itu dalam senarai.";
const PICK_TAP_ONE = "Tekan satu nama di bawah untuk memilih.";
const VOTE_LOADING_TEXT = "Memuatkan undian…";
const VOTE_WAITING_TEXT = "Undian Best Dress dibuka pada 5 Disember, 12.00 tengah hari.";
const VOTE_CLOSED_TEXT = "Undian Best Dress sudah ditutup. Pemenang akan diumumkan sebentar lagi.";

// Entry ids come from the vote form's public page (FB_PUBLIC_LOAD_DATA_), like FORMS in forms.js.
// An empty id or link keeps the vote card on "belum disediakan", so a half-set form never loses votes.
const VOTE = {
  thanks: "Terima kasih. Undian anda sudah diterima.",
  fields: [
    // gender matches the attendance form's Jantina answer, so each list holds only that gender
    { key: "lelaki", entry: "1108392799", kind: "pick", label: "Lelaki", gender: "Lelaki", help: PICK_HELP },
    { key: "perempuan", entry: "2135311797", kind: "pick", label: "Perempuan", gender: "Perempuan", help: PICK_HELP },
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
    if (!values[key]) errors[key] = PICK_MISSING;
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

// Same rule as nameKey in scripts/best-dress.gs, so the phone matches names the way the web app does.
function nameKey(text) {
  return String(text || "").toUpperCase().replace(/[^A-Z ]/g, "").replace(/ +/g, " ").trim();
}

// Every search answer is kept on the phone (they are names the web app already sent), so a longer query
// shows matches at once. cache maps a query key to {names, at: when it arrived}. complete: a reply under a
// minute old that held fewer than VOTE_MAX_NAMES names already holds every match, so the web app need not
// be asked again. An older one may miss a guest who checked in since, so it only fills the list meanwhile.
function cachedMatches(cache, key, now = Date.now()) {
  const known = new Set();
  let complete = false;
  cache.forEach(({ names, at }, cachedKey) => {
    names.forEach((name) => known.add(name));
    const fresh = now - at < VOTE_CACHE_FRESH_MS;
    if (fresh && key.includes(cachedKey) && (cachedKey === key || names.length < VOTE_MAX_NAMES)) complete = true;
  });
  const names = [...known].filter((name) => nameKey(name).includes(key)).sort().slice(0, VOTE_MAX_NAMES);
  return { names, complete };
}

// The reply is shaped by our own web app, but it still crosses the network: keep strings only.
// gender ("Lelaki" or "Perempuan") keeps the list to that gender; leave it out for the open-check.
async function searchNames(query, gender = "") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VOTE_SEARCH_TIMEOUT_MS);
  try {
    const genderPart = gender ? `&g=${encodeURIComponent(gender)}` : "";
    const response = await fetch(`${SETTINGS.voteSearchUrl}?q=${encodeURIComponent(query)}${genderPart}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`Name search answered ${response.status}`);
    const reply = await response.json();
    if (reply.busy === true) throw new Error("Name search busy");
    const names = Array.isArray(reply.names) ? reply.names.filter((name) => typeof name === "string") : [];
    return { open: reply.open === true, names: names.slice(0, VOTE_MAX_NAMES) };
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

// One cache per gender (query key -> names), kept for the page's life (see cachedMatches).
const voteNameCaches = { Lelaki: new Map(), Perempuan: new Map() };
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
  warmNameSearch();
}

// The web app keeps the name list for 6 hours and rebuilds it on every check-in, so it reads the
// attendance form (about 5 s) only when no list is kept yet. One throwaway 3-letter search while the
// guest reads the form pays that rare wait early.
function warmNameSearch() {
  searchNames("aaa").catch(() => {}); // nothing to show: the real search reports its own failure
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
  fillRememberedIc(form.querySelector("#f-undi-ic"), "Undi");
  const button = el("button", { class: "btn", type: "submit", text: "Hantar Undian" });
  const status = el("p", { class: "form-status", role: "status", hidden: "" });
  form.prepend(el("p", { class: "pick-how-to", text: PICK_HOW_TO }));
  form.append(el("p", { class: "vote-notice", text: VOTE_NOTICE }), button, status);
  const send = oneAtATime(() => submitVote(form, picks, button, status));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    send();
  });
  return form;
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
  const nameCache = voteNameCaches[field.gender];
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
    status.classList.remove("is-warning");
    status.textContent = `✓ Dipilih: ${name}`;
  };

  const showStatus = (text, warning = false) => {
    status.textContent = text;
    status.classList.toggle("is-warning", warning);
  };

  const showNames = (names) => {
    showOptions(list, names, choose);
    if (names.length) showStatus(PICK_TAP_ONE, true);
  };

  const runSearch = async (query, ticket, isRetry = false) => {
    try {
      const reply = await searchNames(query, field.gender);
      if (reply.open) nameCache.set(nameKey(query), { names: reply.names, at: Date.now() });
      if (ticket !== latest) return;
      if (!reply.open) {
        showVoteNotOpen();
        return;
      }
      showNames(reply.names);
      if (!reply.names.length) showStatus("Nama tidak ditemui. Pastikan dia sudah sahkan kehadiran.");
    } catch (error) {
      if (ticket !== latest) return;
      if (!isRetry) {
        timer = setTimeout(() => runSearch(query, ticket, true), VOTE_RETRY_MS);
        return;
      }
      console.error("Name search failed:", error);
      showStatus("Carian gagal. Semak talian internet dan taip semula.", true);
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
    const cached = cachedMatches(nameCache, nameKey(query));
    if (cached.complete) {
      showNames(cached.names);
      if (!cached.names.length) showStatus("Nama tidak ditemui. Pastikan dia sudah sahkan kehadiran.");
      return;
    }
    if (cached.names.length) showOptions(list, cached.names, choose); // shown now, the web app may add more
    showStatus("Mencari…");
    const ticket = latest;
    timer = setTimeout(() => runSearch(query, ticket), VOTE_SEARCH_DELAY_MS);
  });

  // Leaving the box with a typed but unpicked name says so at once, not only on Hantar.
  // The wait lets a tap on a list option (which blurs the box first) pick the name before the check.
  input.addEventListener("blur", () => {
    setTimeout(() => {
      if (pick.chosen || !input.value.trim()) return;
      errorNode.textContent = PICK_MISSING;
      errorNode.hidden = false;
      input.setAttribute("aria-invalid", "true");
    }, 250);
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
  const again = el("button", { class: "btn-ghost", type: "button", text: "Undi untuk orang lain" });
  again.addEventListener("click", () => {
    forgetIc(); // the next voter must not start with this guest's IC
    renderVote("open");
  });
  const done = el("div", { class: "form-done", tabindex: "-1" }, [el("p", { text: VOTE.thanks }), again]);
  form.replaceWith(done);
  done.focus();
  return "sent";
}
