/**
 * Mails every guest who sends the feedback form a personal e-sijil (PDF).
 * Standalone Apps Script project. Use the same Google account that owns the
 * forms.
 *
 * How to run:
 * 1. Upload sijil-latar-A4.png to Drive folder PKPD BP/hi-tea.
 * 2. Open https://script.google.com, make a New project, paste this whole
 *    file and Save.
 * 3. Press Services (+) in the left bar, add "Google Slides API" and keep the
 *    name Slides.
 * 4. Pick setupSijil in the function menu and press Run, allow the
 *    permissions. This builds the template and installs the form trigger.
 *    Safe to run again.
 * 5. Pick sendTestSijil and press Run. A sample sijil arrives in your own
 *    inbox. Check it before the event.
 * 6. Urus setia sijil: upload sijil-urusetia-latar-A4.png to the same folder,
 *    run setupUrusetiaTemplate, set its page to A4 by hand, run
 *    fitUrusetiaTemplate, then sendTestUrusetia.
 *
 * Only guests found in the attendance form (by IC, or by email) get a sijil,
 * for the role they chose there. Anyone else gets a short "not in the
 * attendance list" email instead.
 */

var FEEDBACK_TITLE = 'Maklum Balas Majlis Anugerah Gemilang 2026';
var BACKGROUND_NAME = 'sijil-latar-A4.png';
var TEMPLATE_TITLE = 'Templat e-Sijil Anugerah Gemilang 2026';
var TEMPLATE_KEY = 'TEMPLATE_ID';
var ATTENDANCE_FORM_TITLE = 'Kehadiran Majlis Anugerah Gemilang 2026';
var URUSETIA_ROLE = 'Urus setia';
var URUSETIA_BACKGROUND_NAME = 'sijil-urusetia-latar-A4.png';
var URUSETIA_TEMPLATE_TITLE = 'Templat e-Sijil Urus Setia Anugerah Gemilang 2026';
var URUSETIA_TEMPLATE_KEY = 'URUSETIA_TEMPLATE_ID';
var HANDLER_NAME = 'onFeedbackSubmit';

var PAGE_WIDTH = 595.28;
var PAGE_HEIGHT = 841.89;

var NAME_BOX = { left: 67.5, top: 279, width: 460, height: 57 };
var IC_BOX = { left: 67.5, top: 334.5, width: 460, height: 19.5 };
var NAME_MAX_SIZE = 22.5;
var NAME_COLOR = '#f2d796';
var IC_COLOR = '#d9cfb8';
var IC_SIZE = 11.25;

function setupSijil() {
  buildTemplate(BACKGROUND_NAME, TEMPLATE_TITLE, TEMPLATE_KEY);
  installTrigger(findFormNamed(FEEDBACK_TITLE));
  Logger.log('Pencetus borang maklum balas dipasang. Jalankan sendTestSijil untuk ujian.');
}

function setupUrusetiaTemplate() {
  buildTemplate(URUSETIA_BACKGROUND_NAME, URUSETIA_TEMPLATE_TITLE, URUSETIA_TEMPLATE_KEY);
  Logger.log('Tukar halaman ke A4, kemudian jalankan fitUrusetiaTemplate dan sendTestUrusetia.');
}

function buildTemplate(backgroundName, title, propertyKey) {
  var folder = findEventFolder();
  var presentationId = createTemplate(findBackground(folder, backgroundName), title);
  DriveApp.getFileById(presentationId).moveTo(folder);
  PropertiesService.getScriptProperties().setProperty(propertyKey, presentationId);
  Logger.log('Templat siap: ' + DriveApp.getFileById(presentationId).getUrl());
}

function findEventFolder() {
  var folders = DriveApp.getFoldersByName('hi-tea');
  while (folders.hasNext()) {
    var folder = folders.next();
    var parents = folder.getParents();
    if (parents.hasNext() && parents.next().getName() === 'PKPD BP') return folder;
  }
  throw new Error('Folder PKPD BP/hi-tea tiada. Muat naik ' + BACKGROUND_NAME + ' ke folder PKPD BP/hi-tea dahulu.');
}

function findBackground(folder, backgroundName) {
  var files = folder.getFilesByName(backgroundName);
  if (!files.hasNext()) {
    throw new Error('Muat naik ' + backgroundName + ' ke folder PKPD BP/hi-tea dahulu.');
  }
  return files.next();
}

function findFormNamed(title) {
  var files = DriveApp.getFilesByType(MimeType.GOOGLE_FORMS);
  while (files.hasNext()) {
    var file = files.next();
    if (file.getName() === title && !file.isTrashed()) return FormApp.openById(file.getId());
  }
  throw new Error('Borang "' + title + '" tiada dalam akaun ini.');
}

// The Slides API ignores pageSize on create (seen 2026-11-17: the deck came out 16:9),
// so after setupSijil set File > Page setup > Custom 21 x 29.7 cm by hand, then run fitTemplate.
function createTemplate(background, title) {
  var created = Slides.Presentations.create({
    title: title,
    pageSize: {
      width: { magnitude: PAGE_WIDTH, unit: 'PT' },
      height: { magnitude: PAGE_HEIGHT, unit: 'PT' }
    }
  });
  var presentation = SlidesApp.openById(created.presentationId);
  var slide = presentation.getSlides()[0];
  slide.getPageElements().forEach(function (element) { element.remove(); });
  var image = slide.insertImage(background.getBlob(), 0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  image.sendToBack();
  presentation.saveAndClose();
  return created.presentationId;
}

// Run after the template's page is set to A4 by hand: stretches the background to the full page.
function fitTemplate() {
  fitTemplateFor(TEMPLATE_KEY);
}

function fitUrusetiaTemplate() {
  fitTemplateFor(URUSETIA_TEMPLATE_KEY);
}

function fitTemplateFor(propertyKey) {
  var presentation = SlidesApp.openById(templateIdFor(propertyKey));
  var width = presentation.getPageWidth();
  var height = presentation.getPageHeight();
  if (Math.abs(width - PAGE_WIDTH) > 1 || Math.abs(height - PAGE_HEIGHT) > 1) {
    throw new Error('Saiz halaman templat ' + width + ' x ' + height + ' pt. Tukar ke File > Page setup > Custom 21 x 29.7 cm dahulu.');
  }
  var image = presentation.getSlides()[0].getImages()[0];
  image.setLeft(0).setTop(0).setWidth(PAGE_WIDTH).setHeight(PAGE_HEIGHT);
  presentation.saveAndClose();
  Logger.log('Templat A4 siap: latar memenuhi halaman.');
}

function installTrigger(form) {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === HANDLER_NAME) ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger(HANDLER_NAME).forForm(form).onFormSubmit().create();
}

function onFeedbackSubmit(e) {
  var answers = readAnswers(e.response);
  var name = answers['Nama penuh'];
  var email = answers['Emel'];
  if (!name || !email) {
    Logger.log('Jawapan tiada nama atau emel. Sijil tidak dihantar.');
    return;
  }
  var quota = MailApp.getRemainingDailyQuota();
  if (quota <= 0) {
    Logger.log('KUOTA EMEL HABIS. Sijil untuk ' + email + ' tidak dihantar.');
    throw new Error('Kuota emel harian habis. Sijil untuk ' + email + ' belum dihantar.');
  }
  var ic = answers['No. Kad Pengenalan'] || '';
  var attendee = findAttendee(ic, email);
  if (!attendee) {
    Logger.log('Tiada dalam senarai kehadiran: ' + email + '. Sijil tidak dihantar.');
    sendNotListedEmail(name.trim(), email);
    return;
  }
  sendSijil(name, ic, email, attendee.role);
}

// Newest matching attendance answer wins, so a guest who confirmed twice gets their last role.
// IC is compared by digits only; email (any case) is the fallback for a mistyped IC.
function findAttendee(ic, email) {
  var icDigits = String(ic).replace(/\D/g, '');
  var cleanEmail = String(email).trim().toLowerCase();
  var responses = findFormNamed(ATTENDANCE_FORM_TITLE).getResponses();
  var byEmail = null;
  for (var i = responses.length - 1; i >= 0; i--) {
    var answers = readAnswers(responses[i]);
    var attendee = { role: answers['Peranan'] || 'Peserta' };
    var rowIc = String(answers['No. Kad Pengenalan'] || '').replace(/\D/g, '');
    if (icDigits && rowIc === icDigits) return attendee;
    var rowEmail = String(answers['Emel'] || '').trim().toLowerCase();
    if (!byEmail && cleanEmail && rowEmail === cleanEmail) byEmail = attendee;
  }
  return byEmail;
}

function readAnswers(response) {
  var answers = {};
  response.getItemResponses().forEach(function (itemResponse) {
    answers[itemResponse.getItem().getTitle()] = String(itemResponse.getResponse());
  });
  return answers;
}

function templateIdFor(propertyKey) {
  var templateId = PropertiesService.getScriptProperties().getProperty(propertyKey);
  if (templateId) return templateId;
  if (propertyKey === URUSETIA_TEMPLATE_KEY) {
    throw new Error('Templat urus setia belum dibuat. Jalankan setupUrusetiaTemplate dahulu.');
  }
  throw new Error('Templat belum dibuat. Jalankan setupSijil dahulu.');
}

function sendSijil(name, ic, email, role) {
  var isUrusetia = role === URUSETIA_ROLE;
  var templateId = templateIdFor(isUrusetia ? URUSETIA_TEMPLATE_KEY : TEMPLATE_KEY);

  var cleanName = name.trim().toUpperCase();
  var copy = DriveApp.getFileById(templateId).makeCopy('e-Sijil sementara - ' + cleanName, findEventFolder());
  try {
    fillCertificate(copy.getId(), cleanName, formatIc(ic));
    var pdf = copy.getAs('application/pdf')
      .setName('e-Sijil Anugerah Gemilang 2026 - ' + cleanName + '.pdf');
    MailApp.sendEmail({
      to: email,
      subject: 'e-Sijil Majlis Anugerah Gemilang 2026',
      body: buildEmailBody(name.trim(), isUrusetia),
      // Plain text alone gets hard-wrapped near 76 characters, which leaves gaps on phones.
      htmlBody: toHtmlBody(buildEmailBody(name.trim(), isUrusetia)),
      attachments: [pdf],
      name: 'PKPD Batang Padang'
    });
  } finally {
    copy.setTrashed(true);
  }
}

function fillCertificate(copyId, cleanName, formattedIc) {
  var presentation = SlidesApp.openById(copyId);
  var slide = presentation.getSlides()[0];
  addCenteredText(slide, NAME_BOX, cleanName, {
    family: 'Cinzel',
    bold: true,
    size: nameFontSize(cleanName),
    color: NAME_COLOR
  });
  if (formattedIc) {
    addCenteredText(slide, IC_BOX, 'No. K/P: ' + formattedIc, {
      family: 'Source Sans 3',
      bold: false,
      size: IC_SIZE,
      color: IC_COLOR
    });
  }
  presentation.saveAndClose();
}

function addCenteredText(slide, box, text, style) {
  var shape = slide.insertTextBox(text, box.left, box.top, box.width, box.height);
  shape.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);
  var range = shape.getText();
  range.getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
  range.getTextStyle()
    .setFontFamily(style.family)
    .setBold(style.bold)
    .setFontSize(style.size)
    .setForegroundColor(style.color);
  return shape;
}

// Shrinks long names so they stay on one line; 0.78 is the average capital width per point of size.
function nameFontSize(cleanName) {
  var fitted = NAME_BOX.width / (Math.max(cleanName.length, 1) * 0.78);
  return Math.round(Math.min(NAME_MAX_SIZE, fitted) * 2) / 2;
}

function formatIc(ic) {
  var digits = String(ic).replace(/\D/g, '');
  if (digits.length !== 12) return '';
  return digits.slice(0, 6) + '-' + digits.slice(6, 8) + '-' + digits.slice(8);
}

function buildEmailBody(name, isUrusetia) {
  var thanks = isUrusetia
    ? 'Terima kasih atas sumbangan anda sebagai urus setia Majlis Anugerah Gemilang dan Apresiasi Budi PKPD Batang Padang pada 5 Disember 2026 di Hotel Grand Kampar. Terima kasih juga atas maklum balas anda.'
    : 'Terima kasih kerana hadir ke Majlis Anugerah Gemilang dan Apresiasi Budi PKPD Batang Padang pada 5 Disember 2026 di Hotel Grand Kampar. Terima kasih juga atas maklum balas anda.';
  return [
    'Assalamualaikum dan salam sejahtera ' + name + ',',
    '',
    thanks,
    '',
    'e-Sijil anda dilampirkan bersama emel ini.',
    '',
    'Urus setia Majlis Anugerah Gemilang 2026',
    'PKPD Batang Padang'
  ].join('\n');
}

function sendNotListedEmail(name, email) {
  var body = [
    'Assalamualaikum dan salam sejahtera ' + name + ',',
    '',
    'Terima kasih atas maklum balas anda bagi Majlis Anugerah Gemilang dan Apresiasi Budi PKPD Batang Padang.',
    '',
    'No. Kad Pengenalan dan emel anda tidak ditemui dalam senarai kehadiran majlis. Oleh itu e-Sijil belum dapat dihantar.',
    '',
    'Jika anda hadir pada 5 Disember 2026, sila hubungi urus setia majlis supaya kehadiran anda dapat disemak.',
    '',
    'Urus setia Majlis Anugerah Gemilang 2026',
    'PKPD Batang Padang'
  ].join('\n');
  MailApp.sendEmail({
    to: email,
    subject: 'e-Sijil Majlis Anugerah Gemilang 2026: kehadiran tidak ditemui',
    body: body,
    htmlBody: toHtmlBody(body),
    name: 'PKPD Batang Padang'
  });
}

function toHtmlBody(text) {
  var escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped.split('\n\n').map(function (paragraph) {
    return '<p>' + paragraph.replace(/\n/g, '<br>') + '</p>';
  }).join('');
}

function sendTestSijil() {
  sendSijil('Nama Contoh Bin Abdullah', '900101-08-1234', Session.getActiveUser().getEmail(), 'Peserta');
  Logger.log('Sijil ujian dihantar. Kuota emel berbaki: ' + MailApp.getRemainingDailyQuota());
}

function sendTestUrusetia() {
  sendSijil('Nama Contoh Bin Abdullah', '900101-08-1234', Session.getActiveUser().getEmail(), URUSETIA_ROLE);
  Logger.log('Sijil urus setia ujian dihantar. Kuota emel berbaki: ' + MailApp.getRemainingDailyQuota());
}

// Dry run of the attendance check, no email: logs who would get which sijil.
function testFindAttendee() {
  [['900101-08-1234', 'tiada@contoh.my'], ['', Session.getActiveUser().getEmail()]].forEach(function (pair) {
    var attendee = findAttendee(pair[0], pair[1]);
    Logger.log(pair.join(' / ') + ' -> ' + (attendee ? attendee.role : 'tiada dalam senarai'));
  });
}
