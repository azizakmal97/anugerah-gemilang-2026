/**
 * What the e-sijil has already sent (spec: specs/attendee-only-sijil.md A10 to A12)
 * and the look of the committee sheet (spec: specs/sheet-look.md).
 *
 * Lives in the same Apps Script project as the other .gs files (one Code.gs),
 * so it uses findFormNamed and ATTENDANCE_FORM_TITLE (e-sijil.gs) and
 * RESULTS_THEME (best-dress-results.gs). Its names must not clash with theirs.
 *
 * Two tabs in the committee sheet "Anugerah Gemilang 2026 - Respons", made on
 * first use. Neither holds a full IC, only its last 4 digits.
 * - "Tiada dalam Senarai": every feedback whose IC is not on the attendance
 *   list, and whether the short "tidak ditemui" email went out.
 * - "Sijil Dihantar": every sijil sent.
 *
 * What was sent is remembered in Script properties, which only the owner can
 * open: TIADA_IC_<digits>, TIADA_EMEL_<email>, TIADA_COUNT_<date>, and
 * SIJIL_IC_<digits> (the name printed last time and the role it was sent for).
 * To let a guest get the "tidak ditemui" email again, delete their TIADA_ key
 * there. After the committee's test runs, pick clearSijilRecords and press Run:
 * a tester's record would otherwise stop their real sijil on the day.
 *
 * Look of the sheet: pick styleCommitteeSheet and press Run. Safe to run again;
 * it changes no answer.
 */

var NOT_LISTED_TAB = 'Tiada dalam Senarai';
var NOT_LISTED_HEADERS = ['Masa', 'Nama', 'No. K/P (4 digit akhir)', 'Emel', 'Emel makluman'];
var NOT_LISTED_DAILY_LIMIT = 30; // the owner's mail quota is about 1,500 a day and real guests need it
var NOT_LISTED_NOTES = {
  send: 'Dihantar',
  ic: 'Tidak dihantar: sudah dihantar untuk No. K/P ini',
  email: 'Tidak dihantar: sudah dihantar ke emel ini',
  limit: 'Tidak dihantar: had ' + NOT_LISTED_DAILY_LIMIT + ' emel sehari'
};
var SENT_TAB = 'Sijil Dihantar';
var SENT_HEADERS = ['Masa', 'No. K/P (4 digit akhir)', 'Nama pada sijil', 'Emel', 'Peranan', 'Catatan'];
var SENT_NOTES = {
  'new': 'Baharu',
  replace: 'Ganti sijil lama (nama berubah)',
  role: 'Ganti sijil lama (peranan berubah)'
};
var SIJIL_RECORD_PREFIX = 'SIJIL_IC_';
var NOT_LISTED_RECORD_PREFIX = 'TIADA_';
var RECORD_LOCK_WAIT_MS = 60000;
var RECORD_TIME_ZONE = 'Asia/Kuala_Lumpur';

// Soft cream rows under the navy header. Light on purpose: a row the form adds keeps Google's
// black text, which stays readable here but would vanish on navy.
var DATA_ROW_COLOR = '#fbf7ee';
var DATA_STRIPE_COLOR = '#f3e9d2';
// Tabs are styled before the answers arrive, so widths cannot come from the data alone:
// a date needs about 150 px, a full name or an email (or a note about one) about 280.
var DATA_COLUMN_MIN = 150;
var DATA_COLUMN_MAX = 320;
var DATA_COLUMN_WIDE = 280;
var DATA_WIDE_HEADER = /nama|emel/i;

/** Pure. seen: {ic, email: already sent there?, countToday}. Returns a NOT_LISTED_NOTES key. */
function notListedDecision(seen) {
  if (seen.ic) return 'ic';
  if (seen.email) return 'email';
  if (seen.countToday >= NOT_LISTED_DAILY_LIMIT) return 'limit';
  return 'send';
}

/**
 * Pure. previous and current: {name, role} of this IC's last sijil (previous null if none) and of
 * this one. Returns new | skip | replace (name changed) | role (role changed). Skips only when both
 * match, so an urus setia who tested as Peserta still gets the urus setia sijil on the day.
 */
function sijilAction(previous, current) {
  if (!previous) return 'new';
  if (previous.name !== current.name) return 'replace';
  return previous.role === current.role ? 'skip' : 'role';
}

// Reads a SIJIL_IC_ value. Records written before 27 Nov hold the name alone, with no role:
// such a record never matches a role, so the guest gets a fresh sijil rather than none.
function readSijilRecord(stored) {
  if (!stored) return null;
  try {
    var record = JSON.parse(stored);
    if (record && typeof record.name === 'string') return { name: record.name, role: String(record.role || '') };
  } catch (error) {
    // not JSON: an older record that holds the printed name only
  }
  return { name: stored, role: '' };
}

// The name exactly as the sijil prints it, so any visible spelling fix counts as a new name.
function printedName(name) {
  return String(name).trim().replace(/\s+/g, ' ').toUpperCase();
}

function maskedIc(icDigits) {
  return icDigits ? 'xxxxxx-xx-' + icDigits.slice(-4) : '';
}

function emailKey(email) {
  return String(email).trim().toLowerCase();
}

// One script lock for every check-then-mark, so two quick submits cannot both pass the check.
function withRecordLock(work) {
  var lock = LockService.getScriptLock();
  lock.waitLock(RECORD_LOCK_WAIT_MS);
  try {
    return work(PropertiesService.getScriptProperties());
  } finally {
    lock.releaseLock();
  }
}

// Decides and, when the answer is send, marks the IC, the email and today's count in one step.
function claimNotListedEmail(icDigits, email) {
  return withRecordLock(function (properties) {
    var countKey = 'TIADA_COUNT_' + Utilities.formatDate(new Date(), RECORD_TIME_ZONE, 'yyyy-MM-dd');
    var countToday = Number(properties.getProperty(countKey) || 0);
    var decision = notListedDecision({
      ic: Boolean(icDigits) && Boolean(properties.getProperty('TIADA_IC_' + icDigits)),
      email: Boolean(properties.getProperty('TIADA_EMEL_' + emailKey(email))),
      countToday: countToday
    });
    if (decision !== 'send') return decision;
    var marks = {};
    marks[countKey] = String(countToday + 1);
    marks['TIADA_EMEL_' + emailKey(email)] = '1';
    if (icDigits) marks['TIADA_IC_' + icDigits] = '1';
    properties.setProperties(marks);
    return decision;
  });
}

// Returns {action, previous}. Marks the new name and role straight away; releaseSijilClaim undoes it
// if the send fails. previous is the stored text, so the release puts back exactly what was there.
function claimSijil(icDigits, nameToPrint, role) {
  return withRecordLock(function (properties) {
    var key = SIJIL_RECORD_PREFIX + icDigits;
    var previous = properties.getProperty(key);
    var current = { name: nameToPrint, role: role };
    var action = sijilAction(readSijilRecord(previous), current);
    if (action !== 'skip') properties.setProperty(key, JSON.stringify(current));
    return { action: action, previous: previous };
  });
}

function releaseSijilClaim(icDigits, previous) {
  withRecordLock(function (properties) {
    var key = SIJIL_RECORD_PREFIX + icDigits;
    if (previous) properties.setProperty(key, previous);
    else properties.deleteProperty(key);
  });
}

// Run once after the committee's tests (1 Dec cleanup, and again after the rehearsal): forgets every
// sijil sent and every "tidak ditemui" email, so testers get their real sijil on the day. Changes no
// sheet row: the two record tabs keep their history.
function clearSijilRecords() {
  var removed = withRecordLock(function (properties) {
    var keys = properties.getKeys().filter(function (key) {
      return key.indexOf(SIJIL_RECORD_PREFIX) === 0 || key.indexOf(NOT_LISTED_RECORD_PREFIX) === 0;
    });
    keys.forEach(function (key) { properties.deleteProperty(key); });
    return keys.length;
  });
  Logger.log('Rekod sijil dibuang: ' + removed + '. Penguji akan menerima sijil sebenar pada hari majlis.');
}

function logNotListed(name, icDigits, email, note) {
  openCommitteeTab(NOT_LISTED_TAB, NOT_LISTED_HEADERS).appendRow([new Date(), name, maskedIc(icDigits), email, note]);
}

function logSijilSent(icDigits, nameToPrint, email, role, action) {
  openCommitteeTab(SENT_TAB, SENT_HEADERS).appendRow([new Date(), maskedIc(icDigits), nameToPrint, email, role, SENT_NOTES[action]]);
}

// The committee sheet is the attendance form's destination (owner 2026-11-17).
function committeeSpreadsheet() {
  return SpreadsheetApp.openById(findFormNamed(ATTENDANCE_FORM_TITLE).getDestinationId());
}

function openCommitteeTab(name, headers) {
  var spreadsheet = committeeSpreadsheet();
  var sheet = spreadsheet.getSheetByName(name);
  if (sheet) return sheet;
  sheet = spreadsheet.insertSheet(name);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  styleDataTab(sheet);
  return sheet;
}

// Styles every tab a form writes to (Kehadiran, Maklum Balas) and the two record tabs.
// The results tab styles itself on every recount; "Sheet1" is left alone.
function styleCommitteeSheet() {
  openCommitteeTab(NOT_LISTED_TAB, NOT_LISTED_HEADERS);
  openCommitteeTab(SENT_TAB, SENT_HEADERS);
  committeeSpreadsheet().getSheets().forEach(function (sheet) {
    var isRecordTab = sheet.getName() === NOT_LISTED_TAB || sheet.getName() === SENT_TAB;
    if (sheet.getFormUrl() || isRecordTab) {
      styleDataTab(sheet);
      Logger.log('Digayakan: ' + sheet.getName());
    }
  });
}

// Formatting only, never a value, so it is safe to run again (spec A3, A4).
function styleDataTab(sheet) {
  var theme = RESULTS_THEME;
  var lastColumn = Math.max(sheet.getLastColumn(), 1);
  var lastLetter = sheet.getRange(1, lastColumn).getA1Notation().replace(/\d+/g, '');

  sheet.setFrozenRows(1);
  sheet.setTabColor(theme.gold);
  sheet.getBandings().forEach(function (banding) { banding.remove(); });
  // Whole columns with no end row, so rows the form adds later are banded too (spec A2).
  sheet.getRange('A:' + lastLetter)
    .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false)
    .setHeaderRowColor(theme.navy)
    .setFirstRowColor(DATA_ROW_COLOR)
    .setSecondRowColor(DATA_STRIPE_COLOR);

  sheet.getRange(1, 1, 1, lastColumn)
    .setFontColor(theme.goldLight)
    .setFontWeight('bold')
    .setVerticalAlignment('middle')
    .setWrap(true);
  sheet.setRowHeight(1, 44);

  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  sheet.autoResizeColumns(1, lastColumn);
  headers.forEach(function (header, index) {
    var column = index + 1;
    sheet.setColumnWidth(column, dataColumnWidth(String(header), sheet.getColumnWidth(column)));
  });
}

/** Pure: a readable width for one column, from its header and the width its content asks for. */
function dataColumnWidth(header, contentWidth) {
  var floor = DATA_WIDE_HEADER.test(header) ? DATA_COLUMN_WIDE : DATA_COLUMN_MIN;
  return Math.min(DATA_COLUMN_MAX, Math.max(floor, contentWidth));
}

// Try A10 to A12 before 5 Dec: no attendance row can match yet, so a stand-in decides the role.
// Mails the owner three times (urus setia pair, the replacement pair, one "tidak ditemui").
// Then run cleanUpTestFeedback.
var TEST_SIJIL_IC = '000000-00-0001';
var TEST_NOT_LISTED_IC = '000000-00-0002';

function testFeedbackFlow() {
  var me = Session.getActiveUser().getEmail();
  var asUrusetia = function () { return { role: URUSETIA_ROLE }; };
  var notListed = function () { return null; };
  var answers = function (name, ic) {
    return { 'Nama penuh': name, 'Emel': me, 'No. Kad Pengenalan': ic };
  };
  handleFeedback(answers('Nama Ujian Satu', TEST_SIJIL_IC), asUrusetia);   // new: two PDFs
  handleFeedback(answers('Nama  ujian satu', TEST_SIJIL_IC), asUrusetia);  // same printed name: skip
  handleFeedback(answers('Nama Ujian Dua', TEST_SIJIL_IC), asUrusetia);    // new name: replace
  handleFeedback(answers('Nama Ujian', TEST_NOT_LISTED_IC), notListed);    // "tidak ditemui" sent
  handleFeedback(answers('Nama Ujian', TEST_NOT_LISTED_IC), notListed);    // second time: not sent
  Logger.log('Ujian selesai. Semak peti masuk dan tab "' + SENT_TAB + '" serta "' + NOT_LISTED_TAB + '". Kemudian jalankan cleanUpTestFeedback.');
}

function cleanUpTestFeedback() {
  var me = Session.getActiveUser().getEmail();
  var testMasks = [maskedIc(digitsOf(TEST_SIJIL_IC)), maskedIc(digitsOf(TEST_NOT_LISTED_IC))];
  withRecordLock(function (properties) {
    properties.deleteProperty(SIJIL_RECORD_PREFIX + digitsOf(TEST_SIJIL_IC));
    properties.deleteProperty('TIADA_IC_' + digitsOf(TEST_NOT_LISTED_IC));
    properties.deleteProperty('TIADA_EMEL_' + emailKey(me));
    var countKey = 'TIADA_COUNT_' + Utilities.formatDate(new Date(), RECORD_TIME_ZONE, 'yyyy-MM-dd');
    var count = Number(properties.getProperty(countKey) || 0);
    if (count > 0) properties.setProperty(countKey, String(count - 1));
  });
  [[SENT_TAB, SENT_HEADERS, 1], [NOT_LISTED_TAB, NOT_LISTED_HEADERS, 2]].forEach(function (tab) {
    var sheet = openCommitteeTab(tab[0], tab[1]);
    var icColumn = tab[2];
    var values = sheet.getDataRange().getValues();
    for (var row = values.length - 1; row >= 1; row--) {
      if (testMasks.indexOf(values[row][icColumn]) !== -1 && emailKey(values[row][3]) === emailKey(me)) {
        sheet.deleteRow(row + 1);
      }
    }
  });
  Logger.log('Rekod ujian dibuang.');
}
