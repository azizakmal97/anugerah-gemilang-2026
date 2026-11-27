// ===== Settings: the only part to edit =====
const SETTINGS = {
  // Paste the "Send" link of each Google Form here. The page posts answers to the same form;
  // the link is also the fallback when a send fails. Empty = the page says "not ready".
  attendanceFormUrl: "https://docs.google.com/forms/d/e/1FAIpQLSdeJcNFkM2DSM9uO1kvrXqTUH-1IUHxdPF0-GElP2HS6ReoRQ/viewform",
  feedbackFormUrl: "https://docs.google.com/forms/d/e/1FAIpQLScePvaOIe15yw6V39JPmsJX9Iai1sI7z5mOh_DDlwRHzLy5vw/viewform",
  // All times are Malaysia time (UTC+8), written as UTC instants.
  attendanceOpensAt: Date.UTC(2026, 11, 5, 4, 0),  // 5 Dec 2026, 12.00 pm
  eventStartsAt: Date.UTC(2026, 11, 5, 6, 0),      // 5 Dec 2026, 2.00 pm
  feedbackOpensAt: Date.UTC(2026, 11, 5, 8, 0),    // 5 Dec 2026, 4.00 pm: feedback joins attendance (owner 2026-11-21)
  attendanceClosesAt: Date.UTC(2026, 11, 5, 10, 0), // 5 Dec 2026, 6.00 pm
  // Best Dress vote (vote.js): the vote form's "Send" link and the name-search web app URL
  // (scripts/best-dress.gs). Voting opens and closes with attendance (owner 2026-11-17: 6.00 pm, not 5.30).
  voteFormUrl: "https://docs.google.com/forms/d/e/1FAIpQLSegopqOizhGqnmYCD3mqQ4dLvWvSzXXl0f4GbyO9ZQbgExziA/viewform",
  voteSearchUrl: "https://script.google.com/macros/s/AKfycbx_HYRODCfk-Ff0Ogf7zH4BSzQosu_OTy--uYuadhiM7Gw-P2XVfeDWvgiF_ewFfb9Xzw/exec",
  voteClosesAt: Date.UTC(2026, 11, 5, 10, 0), // 5 Dec 2026, 6.00 pm
};

// Page modes, picked by the clock. Add ?mod=sebelum|hadir|selepas to preview one.
const MODES = {
  sebelum: {
    kicker: "Majlis bermula dalam",
    text: "",
    showCountdown: true,
    note: "Borang pengesahan kehadiran akan muncul di sini pada hari majlis, 5 Disember, mulai 12.00 tengah hari.",
  },
  hadir: {
    kicker: "Selamat datang!",
    text: "Sahkan kehadiran anda. Ambil masa kurang seminit.",
    form: "attendance",
  },
  selepas: {
    kicker: "Terima kasih kerana hadir",
    text: "Isi borang maklum balas ringkas ini. Sijil anda akan dihantar ke emel selepas borang dihantar.",
    form: "feedback",
  },
};

// Shown on the attendance form before 12.00 pm (a ?mod=hadir preview, a committee test, a phone
// clock running fast): the server counts only check-ins sent from 12.00 pm (isEventTime in best-dress.gs).
const EARLY_ATTENDANCE_NOTE = "Kehadiran yang dihantar sebelum 12.00 tengah hari tidak dikira. Sila hantar semula selepas 12.00 tengah hari.";

function pickMode(now) {
  const requested = new URLSearchParams(location.search).get("mod");
  if (requested && MODES[requested]) return requested;
  if (now < SETTINGS.attendanceOpensAt) return "sebelum";
  if (now < SETTINGS.attendanceClosesAt) return "hadir";
  return "selepas";
}

// The vote card shows only on the day, beside attendance; after 6.00 pm it says voting is closed.
function pickVoteState(modeName, now) {
  if (modeName !== "hadir") return "hidden";
  return now < SETTINGS.voteClosesAt ? "open" : "closed";
}

// From 4.00 pm the feedback form sits under attendance and the vote, so one QR covers all three.
// After 6.00 pm feedback becomes the main card, so this one goes away. A preview before the day
// (?mod=hadir) shows it too, the same way it shows the vote open.
function pickEarlyFeedbackState(modeName, now) {
  if (modeName !== "hadir") return "hidden";
  const previewBeforeDay = now < SETTINGS.attendanceOpensAt;
  return previewBeforeDay || now >= SETTINGS.feedbackOpensAt ? "open" : "hidden";
}

function renderEarlyFeedback(state) {
  const isOpen = state === "open";
  document.getElementById("maklum-balas").hidden = !isOpen;
  renderForm(isOpen ? "feedback" : null, "maklum-balas-isi"); // forms.js
}

function isEarlyAttendance(modeName, now) {
  return modeName === "hadir" && now < SETTINGS.attendanceOpensAt;
}

function renderAction(modeName, isEarly = false) {
  const mode = MODES[modeName];
  const kicker = document.getElementById("action-kicker");
  const text = document.getElementById("action-text");
  const note = document.getElementById("action-note");

  kicker.textContent = mode.kicker;
  text.textContent = mode.text;
  text.hidden = !mode.text;
  document.getElementById("countdown").hidden = !mode.showCountdown;
  const noteText = isEarly ? EARLY_ATTENDANCE_NOTE : mode.note || "";
  note.textContent = noteText;
  note.hidden = !noteText;

  renderForm(mode.form || null); // forms.js
}

function updateCountdown() {
  const msLeft = Math.max(0, SETTINGS.eventStartsAt - Date.now());
  const totalMinutes = Math.floor(msLeft / 60000);
  setCountdownDigit("cd-hari", Math.floor(totalMinutes / 1440));
  setCountdownDigit("cd-jam", Math.floor((totalMinutes % 1440) / 60));
  setCountdownDigit("cd-minit", totalMinutes % 60);
}

// Only a digit that changed gets the small drop-in, so the eye catches time passing.
function setCountdownDigit(id, value) {
  const digit = document.getElementById(id);
  const text = String(value);
  if (digit.textContent === text) return;
  digit.textContent = text;
  digit.classList.remove("tick");
  void digit.offsetWidth; // restart the CSS animation
  digit.classList.add("tick");
}

// Re-check every 30 s so an open phone flips mode at 12.00, 4.00 and 6.00 pm without a reload.
let currentMode = null; // with the early-attendance flag, so the 12.00 pm note goes without a reload
let currentVoteState = null;
let currentEarlyFeedbackState = null;
function tick() {
  const now = Date.now();
  const modeName = pickMode(now);
  const isEarly = isEarlyAttendance(modeName, now);
  const modeKey = `${modeName}${isEarly ? "-awal" : ""}`;
  if (modeKey !== currentMode) {
    currentMode = modeKey;
    renderAction(modeName, isEarly);
  }
  const voteState = pickVoteState(modeName, now);
  if (voteState !== currentVoteState) {
    currentVoteState = voteState;
    renderVote(voteState); // vote.js
  }
  const earlyFeedbackState = pickEarlyFeedbackState(modeName, now);
  if (earlyFeedbackState !== currentEarlyFeedbackState) {
    currentEarlyFeedbackState = earlyFeedbackState;
    renderEarlyFeedback(earlyFeedbackState);
  }
  if (MODES[modeName].showCountdown) updateCountdown();
}
tick();
setInterval(tick, 30000);
