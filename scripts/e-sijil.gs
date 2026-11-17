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
 */

var FEEDBACK_TITLE = 'Maklum Balas Majlis Anugerah Gemilang 2026';
var BACKGROUND_NAME = 'sijil-latar-A4.png';
var TEMPLATE_TITLE = 'Templat e-Sijil Anugerah Gemilang 2026';
var TEMPLATE_KEY = 'TEMPLATE_ID';
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
  var folder = findEventFolder();
  var background = findBackground(folder);
  var presentationId = createTemplate(background);
  DriveApp.getFileById(presentationId).moveTo(folder);
  PropertiesService.getScriptProperties().setProperty(TEMPLATE_KEY, presentationId);
  installTrigger(findFeedbackForm());
  Logger.log('Templat siap: ' + DriveApp.getFileById(presentationId).getUrl());
  Logger.log('Pencetus borang maklum balas dipasang. Jalankan sendTestSijil untuk ujian.');
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

function findBackground(folder) {
  var files = folder.getFilesByName(BACKGROUND_NAME);
  if (!files.hasNext()) {
    throw new Error('Muat naik ' + BACKGROUND_NAME + ' ke folder PKPD BP/hi-tea dahulu.');
  }
  return files.next();
}

function findFeedbackForm() {
  var files = DriveApp.getFilesByType(MimeType.GOOGLE_FORMS);
  while (files.hasNext()) {
    var file = files.next();
    if (file.getName() === FEEDBACK_TITLE) return FormApp.openById(file.getId());
  }
  throw new Error('Borang "' + FEEDBACK_TITLE + '" tiada dalam akaun ini.');
}

// SlidesApp cannot set the page size, so the Advanced service creates the A4 deck.
function createTemplate(background) {
  var created = Slides.Presentations.create({
    title: TEMPLATE_TITLE,
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
  sendSijil(name, answers['No. Kad Pengenalan'] || '', email);
}

function readAnswers(response) {
  var answers = {};
  response.getItemResponses().forEach(function (itemResponse) {
    answers[itemResponse.getItem().getTitle()] = String(itemResponse.getResponse());
  });
  return answers;
}

function sendSijil(name, ic, email) {
  var templateId = PropertiesService.getScriptProperties().getProperty(TEMPLATE_KEY);
  if (!templateId) throw new Error('Templat belum dibuat. Jalankan setupSijil dahulu.');

  var cleanName = name.trim().toUpperCase();
  var copy = DriveApp.getFileById(templateId).makeCopy('e-Sijil sementara - ' + cleanName, findEventFolder());
  try {
    fillCertificate(copy.getId(), cleanName, formatIc(ic));
    var pdf = copy.getAs('application/pdf')
      .setName('e-Sijil Anugerah Gemilang 2026 - ' + cleanName + '.pdf');
    MailApp.sendEmail({
      to: email,
      subject: 'e-Sijil Majlis Anugerah Gemilang 2026',
      body: buildEmailBody(name.trim()),
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

function buildEmailBody(name) {
  return [
    'Assalamualaikum dan salam sejahtera ' + name + ',',
    '',
    'Terima kasih kerana hadir ke Majlis Anugerah Gemilang dan Apresiasi Budi PKPD Batang Padang pada 5 Disember 2026 di Hotel Grand Kampar. Terima kasih juga atas maklum balas anda.',
    '',
    'e-Sijil anda dilampirkan bersama emel ini.',
    '',
    'Urus setia Majlis Anugerah Gemilang 2026',
    'PKPD Batang Padang'
  ].join('\n');
}

function sendTestSijil() {
  sendSijil('Nama Contoh Bin Abdullah', '900101-08-1234', Session.getActiveUser().getEmail());
  Logger.log('Sijil ujian dihantar. Kuota emel berbaki: ' + MailApp.getRemainingDailyQuota());
}
