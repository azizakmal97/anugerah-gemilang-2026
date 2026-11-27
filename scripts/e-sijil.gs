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
 * Only guests found in the attendance form (by IC, answers sent on 5 Dec
 * 12.00 to 6.00 pm) get a sijil, for the role they chose there: Peserta gets
 * one PDF, Urus setia gets two (peserta and urus setia) in one email. One set
 * per IC: the same name again sends nothing, a new name sends a replacement.
 * Anyone else gets a short "not in the attendance list" email instead, at most
 * once per IC and per email and 30 a day. Records: sijil-records.gs.
 *
 * Block list: to stop one person getting a sijil, open Project Settings >
 * Script properties and set BLOCKED_ICS to their IC digits (no dashes),
 * comma-separated for more than one. They get no sijil and no email.
 * Never put a blocked IC in this repo: it is public.
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
var BLOCKED_ICS_KEY = 'BLOCKED_ICS';

var PAGE_WIDTH = 595.28;
var PAGE_HEIGHT = 841.89;

var NAME_BOX = { left: 67.5, top: 279, width: 460, height: 57 };
var IC_BOX = { left: 67.5, top: 334.5, width: 460, height: 19.5 };
var NAME_MAX_SIZE = 22.5;
var NAME_CLEAR_WIDTH = 380; // pt between the knots on the name plate, with a little air each side
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

// The form's id is kept in Script properties (FORM_ID_<title>) after the first lookup, so every
// later call opens it directly instead of listing Drive, and a copy someone makes with the same
// title can never be picked by mistake. If the saved id stops opening, the title lookup runs again.
var FORM_ID_PREFIX = 'FORM_ID_';

function findFormNamed(title) {
  var properties = PropertiesService.getScriptProperties();
  var savedId = properties.getProperty(FORM_ID_PREFIX + title);
  if (savedId) {
    try {
      return FormApp.openById(savedId);
    } catch (error) {
      console.warn('Saved id for form "' + title + '" no longer opens, looking it up by title: ' + error);
    }
  }
  var form = findFormByTitle(title);
  properties.setProperty(FORM_ID_PREFIX + title, form.getId());
  return form;
}

function findFormByTitle(title) {
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

// After a new background PNG lands in the Drive folder (P05 redesign): swaps the picture in the
// existing template, keeping its id, trigger and page size, then fits it.
function refreshBackground() {
  refreshBackgroundFor(TEMPLATE_KEY, BACKGROUND_NAME);
}

function refreshUrusetiaBackground() {
  refreshBackgroundFor(URUSETIA_TEMPLATE_KEY, URUSETIA_BACKGROUND_NAME);
}

function refreshBackgroundFor(propertyKey, backgroundName) {
  var presentation = SlidesApp.openById(templateIdFor(propertyKey));
  var image = presentation.getSlides()[0].getImages()[0];
  image.replace(findBackground(findEventFolder(), backgroundName).getBlob());
  presentation.saveAndClose();
  fitTemplateFor(propertyKey);
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
  handleFeedback(readAnswers(e.response), findAttendee);
}

// findGuest is findAttendee, or a stand-in in testFeedbackFlow so the rules can be tried before 5 Dec.
function handleFeedback(answers, findGuest) {
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
  if (isBlocked(ic)) {
    Logger.log('Disekat: sijil tidak dihantar.');
    return;
  }
  var icDigits = digitsOf(ic);
  var attendee = findGuest(ic);
  if (!attendee) {
    Logger.log('Tiada dalam senarai kehadiran: ' + email + '. Sijil tidak dihantar.');
    handleNotListed(name.trim(), icDigits, email);
    return;
  }
  var nameToPrint = printedName(name);
  var claim = claimSijil(icDigits, nameToPrint, attendee.role);
  if (claim.action === 'skip') {
    Logger.log('Sijil untuk No. K/P ini sudah dihantar dengan nama dan peranan yang sama. Tiada apa dihantar.');
    return;
  }
  try {
    sendSijil(name, ic, email, attendee.role, claim.action !== 'new');
  } catch (error) {
    releaseSijilClaim(icDigits, claim.previous); // so the guest can send feedback again and still get it
    throw error;
  }
  logSijilSent(icDigits, nameToPrint, email, attendee.role, claim.action);
}

// Spec A10: strangers must not use up the mail quota, but every case reaches the urus setia's tab.
function handleNotListed(name, icDigits, email) {
  var decision = claimNotListedEmail(icDigits, email);
  if (decision === 'send') {
    try {
      sendNotListedEmail(name, email);
    } catch (error) {
      logNotListed(name, icDigits, email, 'Gagal: ' + error.message);
      throw error;
    }
  }
  logNotListed(name, icDigits, email, NOT_LISTED_NOTES[decision]);
}

// BLOCKED_ICS lives only in Script properties, so no blocked IC ever reaches the public repo.
function isBlocked(ic) {
  var icDigits = String(ic).replace(/\D/g, '');
  if (!icDigits) return false;
  var list = PropertiesService.getScriptProperties().getProperty(BLOCKED_ICS_KEY) || '';
  return list.split(',').some(function (entry) {
    return entry.replace(/\D/g, '') === icDigits;
  });
}

// Newest matching attendance answer wins, so a guest who confirmed twice gets their last role.
// IC is compared by digits only. Attendance has no email question (owner 2026-11-17).
// Only answers sent in the hall count (spec A9), plus the committee's test window (countedTimeRule in best-dress.gs).
function findAttendee(ic) {
  var icDigits = String(ic).replace(/\D/g, '');
  if (!icDigits) return null;
  var responses = findFormNamed(ATTENDANCE_FORM_TITLE).getResponses();
  var isCounted = countedTimeRule();
  for (var i = responses.length - 1; i >= 0; i--) {
    if (!isCounted(responses[i].getTimestamp().getTime())) continue;
    var answers = readAnswers(responses[i]);
    var rowIc = String(answers['No. Kad Pengenalan'] || '').replace(/\D/g, '');
    if (rowIc === icDigits) return { role: answers['Peranan'] || 'Peserta' };
  }
  return null;
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

// Urus setia get the peserta sijil too (owner 2026-11-17: "urusetia patut dapat 2 sijil").
function sijilKinds(isUrusetia) {
  var kinds = [{ templateKey: TEMPLATE_KEY, fileTitle: 'e-Sijil Anugerah Gemilang 2026' }];
  if (isUrusetia) kinds.push({ templateKey: URUSETIA_TEMPLATE_KEY, fileTitle: 'e-Sijil Urus Setia Anugerah Gemilang 2026' });
  return kinds;
}

function sendSijil(name, ic, email, role, replacesEarlier) {
  var isUrusetia = role === URUSETIA_ROLE;
  var kinds = sijilKinds(isUrusetia);
  var templateIds = kinds.map(function (kind) { return templateIdFor(kind.templateKey); }); // fail before any copy

  var cleanName = printedName(name);
  var folder = findEventFolder();
  var copies = [];
  try {
    var pdfs = kinds.map(function (kind, index) {
      var copy = DriveApp.getFileById(templateIds[index]).makeCopy('e-Sijil sementara - ' + cleanName, folder);
      copies.push(copy);
      fillCertificate(copy.getId(), cleanName, formatIc(ic));
      return copy.getAs('application/pdf').setName(kind.fileTitle + ' - ' + cleanName + '.pdf');
    });
    var body = buildEmailBody(name.trim(), isUrusetia, replacesEarlier);
    MailApp.sendEmail({
      to: email,
      subject: 'e-Sijil Majlis Anugerah Gemilang 2026' + (replacesEarlier ? ' (dikemas kini)' : ''),
      body: body,
      // Plain text alone gets hard-wrapped near 76 characters, which leaves gaps on phones.
      htmlBody: toHtmlBody(body),
      attachments: pdfs,
      name: 'PKPD Batang Padang'
    });
  } finally {
    copies.forEach(function (copy) { copy.setTrashed(true); });
  }
}

function fillCertificate(copyId, cleanName, formattedIc) {
  var presentation = SlidesApp.openById(copyId);
  var slide = presentation.getSlides()[0];
  var lines = nameLines(cleanName);
  addCenteredText(slide, NAME_BOX, lines.join('\n'), {
    family: 'Cinzel',
    bold: true,
    size: nameFontSize(lines),
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
  range.getParagraphStyle()
    .setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER)
    .setLineSpacing(100)
    .setSpaceAbove(0)
    .setSpaceBelow(0);
  range.getTextStyle()
    .setFontFamily(style.family)
    .setBold(style.bold)
    .setFontSize(style.size)
    .setForegroundColor(style.color);
  return shape;
}

// A name that would print smaller than NAME_TWO_LINE_BELOW on one line goes on two lines
// (owner 2026-11-17: bigger and easier to read). The break goes before BIN, BINTI, A/L or A/P when
// the name has one, so the guest's own name stays on line 1; otherwise at the space nearest the middle.
var NAME_TWO_LINE_BELOW = 17;
var NAME_TWO_LINE_MAX = 16; // two lines of Cinzel at 16 pt fill the 57 pt name box with a little air
var NAME_BREAK_WORDS = ['BIN', 'BINTI', 'A/L', 'A/P'];

function nameLines(cleanName) {
  if (oneLineSize(cleanName.length) >= NAME_TWO_LINE_BELOW) return [cleanName];
  var words = cleanName.split(/\s+/);
  if (words.length < 2) return [cleanName];
  var breakAt = -1;
  for (var i = 1; i < words.length; i++) {
    if (NAME_BREAK_WORDS.indexOf(words[i]) !== -1) { breakAt = i; break; }
  }
  if (breakAt === -1) breakAt = middleBreak(words);
  return [words.slice(0, breakAt).join(' '), words.slice(breakAt).join(' ')];
}

function middleBreak(words) {
  var total = words.join(' ').length;
  var best = 1;
  var bestGap = Infinity;
  for (var i = 1; i < words.length; i++) {
    var gap = Math.abs(words.slice(0, i).join(' ').length - total / 2);
    if (gap < bestGap) { bestGap = gap; best = i; }
  }
  return best;
}

// Keeps each line clear of the kawung knots at both ends of the name plate (P05 design): a line
// must fit NAME_CLEAR_WIDTH. 0.75 is Cinzel bold capitals per point of size, measured on real long
// names (0.58 to 0.71) plus a margin.
function oneLineSize(letters) {
  return NAME_CLEAR_WIDTH / (Math.max(letters, 1) * 0.75);
}

function nameFontSize(lines) {
  var longest = Math.max.apply(null, lines.map(function (line) { return line.length; }));
  var cap = lines.length > 1 ? NAME_TWO_LINE_MAX : NAME_MAX_SIZE;
  return Math.floor(Math.min(cap, oneLineSize(longest)) * 2) / 2;
}

function formatIc(ic) {
  var digits = String(ic).replace(/\D/g, '');
  if (digits.length !== 12) return '';
  return digits.slice(0, 6) + '-' + digits.slice(6, 8) + '-' + digits.slice(8);
}

function buildEmailBody(name, isUrusetia, replacesEarlier) {
  var thanks = isUrusetia
    ? 'Terima kasih atas sumbangan anda sebagai urus setia Majlis Anugerah Gemilang dan Apresiasi Budi PKPD Batang Padang pada 5 Disember 2026 di Hotel Grand Kampar. Terima kasih juga atas maklum balas anda.'
    : 'Terima kasih kerana hadir ke Majlis Anugerah Gemilang dan Apresiasi Budi PKPD Batang Padang pada 5 Disember 2026 di Hotel Grand Kampar. Terima kasih juga atas maklum balas anda.';
  var attached = isUrusetia
    ? 'Dua e-Sijil anda dilampirkan bersama emel ini: sijil penyertaan dan sijil penghargaan urus setia.'
    : 'e-Sijil anda dilampirkan bersama emel ini.';
  var lines = ['Assalamualaikum dan salam sejahtera ' + name + ',', '', thanks, '', attached];
  if (replacesEarlier) {
    lines.push('', (isUrusetia ? 'Kedua-dua e-Sijil ini' : 'e-Sijil ini') +
      ' menggantikan e-Sijil yang dihantar sebelum ini. Nama pada sijil mengikut maklum balas terbaru anda.');
  }
  return lines.concat(['', 'Urus setia Majlis Anugerah Gemilang 2026', 'PKPD Batang Padang']).join('\n');
}

function sendNotListedEmail(name, email) {
  var body = [
    'Assalamualaikum dan salam sejahtera ' + name + ',',
    '',
    'Terima kasih atas maklum balas anda bagi Majlis Anugerah Gemilang dan Apresiasi Budi PKPD Batang Padang.',
    '',
    'No. Kad Pengenalan anda tidak ditemui dalam senarai kehadiran majlis. Oleh itu e-Sijil belum dapat dihantar.',
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

// The longest name we expect, to check it stays on one line between the knots.
function sendTestLongName() {
  sendSijil('Wan Muhammad Nur Hakimi Bin Wan Mohamad Zainuddin', '900101-08-1234', Session.getActiveUser().getEmail(), 'Peserta');
  Logger.log('Sijil nama panjang dihantar. Kuota emel berbaki: ' + MailApp.getRemainingDailyQuota());
}

// Dry run of the attendance check, no email: logs who would get which sijil.
function testFindAttendee() {
  ['900101-08-1234', '900101081234', ''].forEach(function (ic) {
    var attendee = findAttendee(ic);
    Logger.log((ic || '(kosong)') + ' -> ' + (attendee ? attendee.role : 'tiada dalam senarai'));
  });
}
