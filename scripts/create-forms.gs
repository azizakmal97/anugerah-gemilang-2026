/**
 * Builds the two Google Forms for Majlis Anugerah Gemilang 2026 and one
 * spreadsheet that collects both sets of responses. Questions follow
 * docs/forms.md exactly.
 *
 * How to run: open https://script.google.com while signed in to the Google
 * account that should own the forms, make a New project, paste this whole
 * file, Save, pick createForms in the function menu, press Run, allow the
 * permissions, then read the links in the Execution log.
 *
 * Feedback form already exists and still needs the IC question? Pick
 * addIcQuestion instead and press Run. It adds "No. Kad Pengenalan" after
 * "Nama penuh" and skips itself if the question is already there.
 *
 * Attendance form already exists and still needs IC and Peranan? Pick
 * addAttendanceQuestions and press Run. Safe to run twice.
 */

var CLINICS = [
  'KP Tapah',
  'KP Slim River',
  'KP Sungkai',
  'KP Bidor',
  'KP Tanjung Malim',
  'OMFS HSR',
  'Paeds Dental HSR'
];

var NAME_HELP = 'Eja nama anda dengan betul kerana nama ini akan dicetak pada sijil.';
var ATTENDANCE_NAME_HELP = 'Tulis nama penuh anda.'; // the e-sijil name comes from the feedback form only
var IC_TITLE = 'No. Kad Pengenalan';
var IC_HELP = 'Untuk dicetak pada sijil. Contoh: 900101-08-1234';
var ATTENDANCE_IC_HELP = 'Untuk semakan sijil anda. Contoh: 900101-08-1234';
var ROLE_TITLE = 'Peranan';
var ROLES = ['Peserta', 'Urus setia'];
var IC_PATTERN = '^\\d{6}-?\\d{2}-?\\d{4}$';
var IC_PATTERN_HELP = 'Format: 900101-08-1234';
var ATTENDANCE_TITLE = 'Kehadiran Majlis Anugerah Gemilang 2026';
var FEEDBACK_TITLE = 'Maklum Balas Majlis Anugerah Gemilang 2026';
var RATING_LOW = 'Kurang memuaskan';
var RATING_HIGH = 'Sangat memuaskan';

function createForms() {
  var spreadsheet = SpreadsheetApp.create('Anugerah Gemilang 2026 - Respons');
  var attendanceForm = buildAttendanceForm();
  var feedbackForm = buildFeedbackForm();

  attendanceForm.setDestination(FormApp.DestinationType.SPREADSHEET, spreadsheet.getId());
  feedbackForm.setDestination(FormApp.DestinationType.SPREADSHEET, spreadsheet.getId());
  moveToEventFolder([spreadsheet.getId(), attendanceForm.getId(), feedbackForm.getId()]);

  Logger.log('Pautan borang kehadiran (hantar kepada Claude): ' + attendanceForm.getPublishedUrl());
  Logger.log('Pautan borang maklum balas (hantar kepada Claude): ' + feedbackForm.getPublishedUrl());
  Logger.log('Pautan sunting borang kehadiran: ' + attendanceForm.getEditUrl());
  Logger.log('Pautan sunting borang maklum balas: ' + feedbackForm.getEditUrl());
  Logger.log('Pautan hamparan respons: ' + spreadsheet.getUrl());
}

// Files land in My Drive root; move them to the event folder (My Drive/PKPD BP/hi-tea) if this account has it.
function moveToEventFolder(fileIds) {
  var folders = DriveApp.getFoldersByName('hi-tea');
  while (folders.hasNext()) {
    var folder = folders.next();
    var parents = folder.getParents();
    if (parents.hasNext() && parents.next().getName() === 'PKPD BP') {
      fileIds.forEach(function (id) { DriveApp.getFileById(id).moveTo(folder); });
      Logger.log('Disimpan dalam folder: ' + folder.getUrl());
      return;
    }
  }
  Logger.log('Folder PKPD BP/hi-tea tiada dalam akaun ini; fail kekal di My Drive.');
}

function buildAttendanceForm() {
  var form = createBaseForm(
    ATTENDANCE_TITLE,
    'Sahkan kehadiran anda di Majlis Anugerah Gemilang dan Apresiasi Budi PKPD Batang Padang. Ambil masa kurang seminit.',
    'Terima kasih. Kehadiran anda sudah direkod. Selamat menikmati majlis!'
  );

  addShortText(form, 'Nama penuh', ATTENDANCE_NAME_HELP);
  addIcItem(form, ATTENDANCE_IC_HELP);
  form.addListItem()
    .setTitle('Klinik atau unit')
    .setChoiceValues(CLINICS)
    .setRequired(true);
  addRoleItem(form);
  addEmail(form, 'Emel', 'Gunakan emel yang anda semak.');
  return form;
}

function buildFeedbackForm() {
  var form = createBaseForm(
    FEEDBACK_TITLE,
    'Kongsi pandangan anda dalam kurang dua minit. Sijil penyertaan akan dihantar ke emel anda selepas borang dihantar.',
    'Terima kasih atas maklum balas anda. Sijil penyertaan akan sampai ke emel anda dalam masa terdekat. Jika tidak nampak, semak folder spam.'
  );

  addRating(form, 'Secara keseluruhan, bagaimana penilaian anda terhadap majlis ini?');
  addRating(form, 'Bagaimana pengacaraan dan atur cara majlis?');
  addRating(form, 'Bagaimana makanan dan tempat majlis?');
  form.addParagraphTextItem()
    .setTitle('Ada cadangan atau komen untuk majlis akan datang?')
    .setHelpText('Pilihan. Boleh dibiarkan kosong.')
    .setRequired(false);
  addShortText(form, 'Nama penuh', NAME_HELP);
  addIcItem(form, IC_HELP);
  addEmail(form, 'Emel', 'Sijil anda akan dihantar ke emel ini. Semak ejaan emel sebelum menghantar.');
  return form;
}

function createBaseForm(title, description, confirmation) {
  return FormApp.create(title)
    .setDescription(description)
    .setConfirmationMessage(confirmation)
    .setCollectEmail(false)
    .setRequireLogin(false)
    .setLimitOneResponsePerUser(false)
    .setAllowResponseEdits(false)
    .setShowLinkToRespondAgain(false);
}

function addShortText(form, title, helpText) {
  return form.addTextItem()
    .setTitle(title)
    .setHelpText(helpText)
    .setRequired(true);
}

function addEmail(form, title, helpText) {
  var item = addShortText(form, title, helpText);
  item.setValidation(FormApp.createTextValidation().requireTextIsEmail().build());
  return item;
}

function addRating(form, title) {
  return form.addScaleItem()
    .setTitle(title)
    .setBounds(1, 5)
    .setLabels(RATING_LOW, RATING_HIGH)
    .setRequired(true);
}

function addIcItem(form, helpText) {
  var item = addShortText(form, IC_TITLE, helpText);
  item.setValidation(FormApp.createTextValidation()
    .requireTextMatchesPattern(IC_PATTERN)
    .setHelpText(IC_PATTERN_HELP)
    .build());
  return item;
}

function addRoleItem(form) {
  return form.addMultipleChoiceItem()
    .setTitle(ROLE_TITLE)
    .setChoiceValues(ROLES)
    .setRequired(true);
}

// One-off for the feedback form that already exists. Safe to run twice.
function addIcQuestion() {
  var form = findFormByTitle(FEEDBACK_TITLE);
  var items = form.getItems();
  var nameItem = null;
  for (var i = 0; i < items.length; i++) {
    if (items[i].getTitle() === IC_TITLE) {
      Logger.log('Soalan "' + IC_TITLE + '" sudah ada. Tiada apa diubah.');
      return;
    }
    if (items[i].getTitle() === 'Nama penuh') nameItem = items[i];
  }
  if (!nameItem) throw new Error('Soalan "Nama penuh" tiada dalam borang maklum balas.');

  var newItem = addIcItem(form, IC_HELP);
  form.moveItem(newItem.getIndex(), nameItem.getIndex() + 1);
  Logger.log('Siap. Soalan "' + IC_TITLE + '" ditambah selepas "Nama penuh".');
  Logger.log('Pautan sunting borang maklum balas: ' + form.getEditUrl());
}

// One-off for the attendance form that already exists (P04). The e-sijil goes only to
// guests found here, so it needs the IC to match on and the role that picks the sijil.
// Adds IC after "Nama penuh" and Peranan after "Klinik atau unit". Safe to run twice.
function addAttendanceQuestions() {
  var form = findFormByTitle(ATTENDANCE_TITLE);
  if (!findItem(form, IC_TITLE)) {
    var icItem = addIcItem(form, ATTENDANCE_IC_HELP);
    form.moveItem(icItem.getIndex(), requireItem(form, 'Nama penuh').getIndex() + 1);
    Logger.log('Soalan "' + IC_TITLE + '" ditambah selepas "Nama penuh".');
  }
  if (!findItem(form, ROLE_TITLE)) {
    var roleItem = addRoleItem(form);
    form.moveItem(roleItem.getIndex(), requireItem(form, 'Klinik atau unit').getIndex() + 1);
    Logger.log('Soalan "' + ROLE_TITLE + '" ditambah selepas "Klinik atau unit".');
  }
  Logger.log('Pautan sunting borang kehadiran: ' + form.getEditUrl());
}

function findItem(form, title) {
  var items = form.getItems();
  for (var i = 0; i < items.length; i++) {
    if (items[i].getTitle() === title) return items[i];
  }
  return null;
}

function requireItem(form, title) {
  var item = findItem(form, title);
  if (!item) throw new Error('Soalan "' + title + '" tiada dalam borang "' + form.getTitle() + '".');
  return item;
}

// The d/e/ id in the published link is not the form id, so find it by title in Drive.
function findFormByTitle(title) {
  var files = DriveApp.getFilesByType(MimeType.GOOGLE_FORMS);
  while (files.hasNext()) {
    var file = files.next();
    if (file.getName() === title) return FormApp.openById(file.getId());
  }
  throw new Error('Borang "' + title + '" tiada dalam akaun ini.');
}
