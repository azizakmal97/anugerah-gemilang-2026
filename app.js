// ===== Settings: the only part to edit =====
const SETTINGS = {
  // Paste the "Send" link of each Google Form here. Empty = button shows "not ready".
  attendanceFormUrl: "",
  feedbackFormUrl: "",
  // All times are Malaysia time (UTC+8), written as UTC instants.
  attendanceOpensAt: Date.UTC(2026, 11, 5, 4, 0),  // 5 Dec 2026, 12.00 pm
  eventStartsAt: Date.UTC(2026, 11, 5, 6, 0),      // 5 Dec 2026, 2.00 pm
  attendanceClosesAt: Date.UTC(2026, 11, 5, 10, 0), // 5 Dec 2026, 6.00 pm
};

// Page modes, picked by the clock. Add ?mod=sebelum|hadir|selepas to preview one.
const MODES = {
  sebelum: {
    kicker: "Majlis bermula dalam",
    text: "",
    showCountdown: true,
    note: "Pengesahan kehadiran dibuka pada 5 Disember, 12.00 tengah hari. Imbas kod QR di meja pendaftaran.",
  },
  hadir: {
    kicker: "Selamat datang!",
    text: "Sahkan kehadiran anda sebelum masuk ke dewan. Nama anda akan dicetak pada sijil, jadi isi dengan ejaan penuh.",
    buttonLabel: "Sahkan kehadiran saya",
    formKey: "attendanceFormUrl",
  },
  selepas: {
    kicker: "Terima kasih kerana hadir",
    text: "Isi borang maklum balas ringkas ini. Sijil penyertaan anda akan dihantar ke emel sejurus selepas borang dihantar.",
    buttonLabel: "Isi maklum balas dan dapatkan sijil",
    formKey: "feedbackFormUrl",
  },
};

function pickMode(now) {
  const requested = new URLSearchParams(location.search).get("mod");
  if (requested && MODES[requested]) return requested;
  if (now < SETTINGS.attendanceOpensAt) return "sebelum";
  if (now < SETTINGS.attendanceClosesAt) return "hadir";
  return "selepas";
}

function renderAction(modeName) {
  const mode = MODES[modeName];
  const kicker = document.getElementById("action-kicker");
  const text = document.getElementById("action-text");
  const button = document.getElementById("action-btn");
  const note = document.getElementById("action-note");

  kicker.textContent = mode.kicker;
  text.textContent = mode.text;
  text.hidden = !mode.text;
  document.getElementById("countdown").hidden = !mode.showCountdown;
  note.textContent = mode.note || "";
  note.hidden = !mode.note;

  if (!mode.formKey) {
    button.hidden = true;
    return;
  }
  button.hidden = false;
  const url = SETTINGS[mode.formKey];
  if (url) {
    button.href = url;
    button.target = "_blank";
    button.rel = "noopener";
    button.textContent = mode.buttonLabel;
    button.removeAttribute("aria-disabled");
  } else {
    button.removeAttribute("href");
    button.textContent = "Pautan borang belum disediakan";
    button.setAttribute("aria-disabled", "true");
  }
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

// Re-check every 30 s so an open phone flips mode at 12.00 and 6.00 pm without a reload.
let currentMode = null;
function tick() {
  const modeName = pickMode(Date.now());
  if (modeName !== currentMode) {
    currentMode = modeName;
    renderAction(modeName);
  }
  if (MODES[modeName].showCountdown) updateCountdown();
}
tick();
setInterval(tick, 30000);
