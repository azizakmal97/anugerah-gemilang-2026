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

// Look of the tab (owner 2026-11-17: "cantikkan"): the event page's own night navy and batik gold.
// Two blocks side by side, Lelaki then Perempuan, each: rank, name, votes, a bar of votes.
var RESULTS_BLOCK_WIDTH = 4;
var RESULTS_COLUMNS = 9; // block, one spacer column, block
var RESULTS_BLOCK_FIRST_COLUMNS = [1, 6];
var RESULTS_BAR_LENGTH = 18;
var RESULTS_BAR_CHARACTER = '█';
var RESULTS_BAND_ROW = 5;
var RESULTS_HEADING_ROW = 6;
var RESULTS_FIRST_ENTRY_ROW = 7;
var RESULTS_EMPTY_TEXT = 'Belum ada undi';
var RESULTS_COLUMN_WIDTHS = [90, 270, 70, 190, 28, 90, 270, 70, 190];
var RESULTS_THEME = {
  navyDeep: '#060e26',
  navy: '#0b1736',
  navyStripe: '#112147',
  navyRaised: '#142a5a',
  gold: '#d6a84e',
  goldLight: '#f2d796',
  cream: '#f6eedb',
  creamMuted: '#d9cfb8'
};

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
    return { timestamp: response.getTimestamp().getTime(), ic: answers['No. Kad Pengenalan'], name: answers['Nama penuh'] };
  });
  // isEventTime, not isVoteOpen: VOTE_TEST_UNTIL only opens the search for a preview, it never counts.
  var tally = tallyVotes(votes, attendees, isEventTime);
  writeResults(openResultsTab(), tally, new Date());
}

/**
 * Pure counting rules. votes: [{timestamp, ic, Lelaki, Perempuan}],
 * attendees: [{timestamp, ic, name}], isCountedTime(ms) says when a vote or an
 * attendance answer may count (isEventTime: 5 Dec, 12.00 to 6.00 pm).
 * Returns {voters, Lelaki: [{rank, name, votes}], Perempuan: [...]}.
 */
function tallyVotes(votes, attendees, isCountedTime) {
  var attendeeByIc = {};
  var displayNameByKey = {};
  attendees.forEach(function (attendee) {
    if (!isCountedTime(attendee.timestamp)) return; // added from home in November: not a voter, not a pick
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

/**
 * The cell values for the whole tab, no Sheets calls (so a test can read them).
 * Returns {values: rows of RESULTS_COLUMNS cells, entryCount}. Rows 1-3 are the
 * title lines, row 4 is a gap, RESULTS_BAND_ROW the category bands,
 * RESULTS_HEADING_ROW the column headings, then one row per ranked name.
 */
function buildResultsGrid(tally, updatedText) {
  var entryCount = Math.max(1, tally.Lelaki.length, tally.Perempuan.length);
  var values = [];
  for (var row = 0; row < RESULTS_FIRST_ENTRY_ROW - 1 + entryCount; row++) {
    var cells = [];
    for (var column = 0; column < RESULTS_COLUMNS; column++) cells.push('');
    values.push(cells);
  }
  values[0][0] = 'Keputusan Best Dress 2026';
  values[1][0] = 'Dikemas kini: ' + updatedText;
  values[2][0] = 'Undi sah: ' + tally.voters;

  RESULTS_CATEGORIES.forEach(function (category, blockIndex) {
    var start = RESULTS_BLOCK_FIRST_COLUMNS[blockIndex] - 1;
    var entries = tally[category];
    values[RESULTS_BAND_ROW - 1][start] = category.toUpperCase();
    ['Kedudukan', 'Nama', 'Undi'].forEach(function (heading, offset) {
      values[RESULTS_HEADING_ROW - 1][start + offset] = heading;
    });
    if (entries.length === 0) values[RESULTS_FIRST_ENTRY_ROW - 1][start + 1] = RESULTS_EMPTY_TEXT;
    entries.forEach(function (entry, index) {
      var cells = values[RESULTS_FIRST_ENTRY_ROW - 1 + index];
      cells[start] = entry.rank;
      cells[start + 1] = entry.name;
      cells[start + 2] = entry.votes;
      cells[start + 3] = voteBar(entry.votes, entries[0].votes);
    });
  });
  return { values: values, entryCount: entryCount };
}

// Entries are sorted, so the first one holds the most votes and gets the full bar.
function voteBar(votes, mostVotes) {
  var length = Math.max(1, Math.round(votes / mostVotes * RESULTS_BAR_LENGTH));
  return new Array(length + 1).join(RESULTS_BAR_CHARACTER);
}

function writeResults(sheet, tally, now) {
  var updatedText = Utilities.formatDate(now, RESULTS_TIME_ZONE, 'd MMM yyyy, h:mm:ss a');
  var grid = buildResultsGrid(tally, updatedText);

  sheet.clear(); // also wipes formatting, which is why styleResults runs on every recount
  sheet.getRange(1, 1, grid.values.length, RESULTS_COLUMNS).setValues(grid.values);
  styleResults(sheet, tally, grid.entryCount);
}

function styleResults(sheet, tally, entryCount) {
  var theme = RESULTS_THEME;

  sheet.setHiddenGridlines(true);
  sheet.setTabColor(theme.gold);
  RESULTS_COLUMN_WIDTHS.forEach(function (width, index) { sheet.setColumnWidth(index + 1, width); });

  // Night-navy cloth over the whole sheet, so no white edge shows below or to the right.
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns())
    .setBackground(theme.navy)
    .setFontColor(theme.cream)
    .setFontFamily('Roboto')
    .setFontSize(11)
    .setVerticalAlignment('middle');

  sheet.getRange(1, 1, 1, RESULTS_COLUMNS).setBackground(theme.navyDeep);
  sheet.getRange(1, 1).setFontFamily('Playfair Display').setFontSize(22).setFontWeight('bold').setFontColor(theme.goldLight);
  sheet.setRowHeight(1, 56);
  sheet.getRange(2, 1, 2, 1).setFontColor(theme.creamMuted).setFontSize(10);
  sheet.setRowHeight(4, 14);
  sheet.setRowHeight(RESULTS_BAND_ROW, 34);
  sheet.setRowHeight(RESULTS_HEADING_ROW, 26);

  RESULTS_CATEGORIES.forEach(function (category, blockIndex) {
    var start = RESULTS_BLOCK_FIRST_COLUMNS[blockIndex];
    sheet.getRange(RESULTS_BAND_ROW, start, 1, RESULTS_BLOCK_WIDTH)
      .setBackground(theme.gold).setFontColor(theme.navyDeep)
      .setFontFamily('Playfair Display').setFontSize(14).setFontWeight('bold');
    sheet.getRange(RESULTS_HEADING_ROW, start, 1, RESULTS_BLOCK_WIDTH)
      .setBackground(theme.navyRaised).setFontColor(theme.goldLight).setFontWeight('bold').setFontSize(10);

    var entries = tally[category];
    for (var index = 0; index < entryCount; index++) {
      var rowNumber = RESULTS_FIRST_ENTRY_ROW + index;
      var rowRange = sheet.getRange(rowNumber, start, 1, RESULTS_BLOCK_WIDTH);
      sheet.setRowHeight(rowNumber, 32);
      if (index % 2 === 1) rowRange.setBackground(theme.navyStripe);
      if (entries[index] && entries[index].rank === 1) rowRange.setFontColor(theme.goldLight).setFontWeight('bold');
    }
    sheet.getRange(RESULTS_FIRST_ENTRY_ROW, start + 3, entryCount, 1).setFontColor(theme.gold).setFontWeight('normal');
    sheet.getRange(RESULTS_HEADING_ROW, start, entryCount + 1, 1).setHorizontalAlignment('center');
    sheet.getRange(RESULTS_HEADING_ROW, start + 2, entryCount + 1, 1).setHorizontalAlignment('center').setFontWeight('bold');
  });
}
