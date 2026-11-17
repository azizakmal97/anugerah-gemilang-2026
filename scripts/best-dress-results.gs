/**
 * Best Dress vote results (spec: specs/best-dress-vote.md, S2).
 *
 * Counts the vote form's responses into the tab "Keputusan Best Dress" of the
 * committee's response sheet (the attendance form's destination), so only the
 * committee can see it. The tab updates itself on every vote. It never holds an
 * IC: only names and counts.
 *
 * Lives in the same Apps Script project as create-forms.gs, e-sijil.gs and
 * best-dress.gs (one Code.gs), so it reuses their helpers and its names must
 * not clash with theirs.
 *
 * How to run: after createVoteForm has made the vote form, pick
 * setupBestDressResults and press Run, allow the permissions, then read the
 * sheet link in the Execution log. Safe to run twice. To recount by hand, pick
 * refreshBestDressResults.
 */

var RESULTS_TAB_NAME = 'Keputusan Best Dress';
var RESULTS_HANDLER = 'onVoteSubmit';
var RESULTS_TOP_COUNT = 5;
var RESULTS_CATEGORIES = ['Lelaki', 'Perempuan'];
var RESULTS_TIME_ZONE = 'Asia/Kuala_Lumpur';
var RESULTS_COLUMNS = 3;

function setupBestDressResults() {
  var tab = openResultsTab();
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === RESULTS_HANDLER) ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger(RESULTS_HANDLER).forForm(findFormNamed(VOTE_FORM_TITLE)).onFormSubmit().create();
  refreshBestDressResults();
  Logger.log('Tab keputusan Best Dress: ' + tab.getParent().getUrl() + '#gid=' + tab.getSheetId());
}

// Owner 2026-11-17: results sit with the committee, in the sheet the attendance form already feeds.
function openResultsTab() {
  var destinationId = findFormNamed(ATTENDANCE_FORM_TITLE).getDestinationId();
  var spreadsheet = SpreadsheetApp.openById(destinationId);
  return spreadsheet.getSheetByName(RESULTS_TAB_NAME) || spreadsheet.insertSheet(RESULTS_TAB_NAME);
}

function onVoteSubmit() {
  refreshBestDressResults();
}

// Two votes landing together run two recounts; the lock stops the older one writing last.
function refreshBestDressResults() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    writeCurrentResults();
  } finally {
    lock.releaseLock();
  }
}

function writeCurrentResults() {
  var votes = findFormNamed(VOTE_FORM_TITLE).getResponses().map(function (response) {
    var answers = readAnswers(response);
    return {
      timestamp: response.getTimestamp().getTime(),
      ic: answers['No. Kad Pengenalan'],
      Lelaki: answers['Lelaki'],
      Perempuan: answers['Perempuan']
    };
  });
  var attendees = findFormNamed(ATTENDANCE_FORM_TITLE).getResponses().map(function (response) {
    var answers = readAnswers(response);
    return { ic: answers['No. Kad Pengenalan'], name: answers['Nama penuh'] };
  });
  var tally = tallyVotes(votes, attendees, isVoteOpen);
  writeResults(openResultsTab(), tally, new Date());
}

/**
 * Pure counting rules. votes: [{timestamp, ic, Lelaki, Perempuan}],
 * attendees: [{ic, name}], isCountedTime(ms) says when a vote may count.
 * Returns {voters, Lelaki: [{rank, name, votes}], Perempuan: [...]}.
 */
function tallyVotes(votes, attendees, isCountedTime) {
  var attendeeByIc = {};
  var displayNameByKey = {};
  attendees.forEach(function (attendee) {
    var icDigits = digitsOf(attendee.ic);
    var key = nameKey(attendee.name || '');
    if (!icDigits || !key) return;
    attendeeByIc[icDigits] = key;
    if (!displayNameByKey[key]) displayNameByKey[key] = String(attendee.name).replace(/\s+/g, ' ').trim();
  });

  var counts = {};
  RESULTS_CATEGORIES.forEach(function (category) { counts[category] = {}; });
  var seenIcs = {};
  var voters = 0;

  votes.slice().sort(function (a, b) { return a.timestamp - b.timestamp; }).forEach(function (vote) {
    var icDigits = digitsOf(vote.ic);
    // Time first: a test vote before 12.00 pm must not use up the guest's real vote.
    if (!icDigits || seenIcs[icDigits] || !isCountedTime(vote.timestamp)) return;
    seenIcs[icDigits] = true;
    var voterKey = attendeeByIc[icDigits];
    if (!voterKey) return;

    voters += 1;
    RESULTS_CATEGORIES.forEach(function (category) {
      var pickKey = nameKey(vote[category] || '');
      if (!displayNameByKey[pickKey] || pickKey === voterKey) return;
      counts[category][pickKey] = (counts[category][pickKey] || 0) + 1;
    });
  });

  var tally = { voters: voters };
  RESULTS_CATEGORIES.forEach(function (category) {
    tally[category] = rankTop(counts[category], displayNameByKey);
  });
  return tally;
}

// Top 5 plus every name tied with 5th place; tied names share the rank (1, 1, 3).
function rankTop(countsByKey, displayNameByKey) {
  var rows = Object.keys(countsByKey).map(function (key) {
    return { name: displayNameByKey[key], votes: countsByKey[key] };
  });
  rows.sort(function (a, b) {
    if (b.votes !== a.votes) return b.votes - a.votes;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
  var cutoff = rows.length >= RESULTS_TOP_COUNT ? rows[RESULTS_TOP_COUNT - 1].votes : 0;
  return rows
    .filter(function (row) { return row.votes >= cutoff; })
    .map(function (row, index, kept) {
      var firstTied = index;
      while (firstTied > 0 && kept[firstTied - 1].votes === row.votes) firstTied -= 1;
      return { rank: firstTied + 1, name: row.name, votes: row.votes };
    });
}

function digitsOf(text) {
  return String(text || '').replace(/\D/g, '');
}

function writeResults(sheet, tally, now) {
  var rows = [
    ['Keputusan Best Dress 2026'],
    ['Dikemas kini: ' + Utilities.formatDate(now, RESULTS_TIME_ZONE, 'd MMM yyyy, h:mm:ss a')],
    ['Undi sah: ' + tally.voters]
  ];
  RESULTS_CATEGORIES.forEach(function (category) {
    rows.push([''], [category], ['Kedudukan', 'Nama', 'Undi']);
    tally[category].forEach(function (entry) { rows.push([entry.rank, entry.name, entry.votes]); });
  });

  sheet.clear();
  var padded = rows.map(function (row) {
    while (row.length < RESULTS_COLUMNS) row.push('');
    return row;
  });
  sheet.getRange(1, 1, padded.length, RESULTS_COLUMNS).setValues(padded);
}
