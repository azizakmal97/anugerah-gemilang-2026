/**
 * Best Dress vote, name search (spec: specs/best-dress-vote.md).
 *
 * A web app the event page calls while a guest types a name. It answers with
 * at most 10 names of people who confirmed attendance, only after 3 letters,
 * and only while voting is open (12.00 pm to 5.30 pm, 5 Dec 2026). The reply
 * holds names only: never an IC, never an email, never the full list.
 *
 * Lives in the same Apps Script project as create-forms.gs and e-sijil.gs
 * (one Code.gs), so it reuses findFormNamed and readAnswers from e-sijil.gs
 * and its names must not clash with theirs.
 *
 * How to deploy: Deploy > New deployment > type Web app, Execute as: Me,
 * Who has access: Anyone. Copy the Web app URL into SETTINGS in app.js.
 * After changing this file: Deploy > Manage deployments > edit > New version,
 * so the URL stays the same.
 *
 * Testing before the event: open Project Settings > Script properties and set
 * VOTE_TEST_UNTIL to an end time, for example 2026-11-20T23:00:00+08:00.
 * Search answers until then, then closes again by itself.
 */

var VOTE_OPENS_AT = Date.UTC(2026, 11, 5, 4, 0);   // 12.00 pm, 5 Dec 2026, Malaysia time
var VOTE_CLOSES_AT = Date.UTC(2026, 11, 5, 9, 30); // 5.30 pm, when the Best Dress prizes start
var VOTE_TEST_KEY = 'VOTE_TEST_UNTIL';
var SEARCH_MIN_LETTERS = 3;
var SEARCH_MAX_RESULTS = 10;
var SEARCH_MAX_QUERY = 40;
var NAMES_CACHE_KEY = 'best-dress-names';
var NAMES_CACHE_SECONDS = 300; // a guest who confirms attendance shows up in search within 5 minutes

function doGet(e) {
  var query = String((e && e.parameter && e.parameter.q) || '');
  return jsonReply(searchReply(query, Date.now()));
}

function searchReply(query, nowMs) {
  if (!isVoteOpen(nowMs)) return { open: false, names: [] };
  var key = nameKey(query.slice(0, SEARCH_MAX_QUERY));
  if (key.replace(/ /g, '').length < SEARCH_MIN_LETTERS) return { open: true, names: [] };
  return { open: true, names: matchNames(attendeeNames(), key) };
}

function isVoteOpen(nowMs) {
  if (nowMs >= VOTE_OPENS_AT && nowMs < VOTE_CLOSES_AT) return true;
  var testUntil = Date.parse(PropertiesService.getScriptProperties().getProperty(VOTE_TEST_KEY) || '');
  return !isNaN(testUntil) && nowMs < testUntil;
}

// Upper case, letters and spaces only, single spaces: "  siti  nur'aini " and "SITI NURAINI" match.
function nameKey(text) {
  return String(text).toUpperCase().replace(/[^A-Z ]/g, '').replace(/ +/g, ' ').trim();
}

function matchNames(names, key) {
  var found = [];
  for (var i = 0; i < names.length && found.length < SEARCH_MAX_RESULTS; i++) {
    if (nameKey(names[i]).indexOf(key) !== -1) found.push(names[i]);
  }
  return found;
}

// Distinct attendance names, sorted, cached so 125 phones typing at once do not reread the form.
function attendeeNames() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(NAMES_CACHE_KEY);
  if (cached) return JSON.parse(cached);

  var byKey = {};
  findFormNamed(ATTENDANCE_FORM_TITLE).getResponses().forEach(function (response) {
    var name = String(readAnswers(response)['Nama penuh'] || '').replace(/\s+/g, ' ').trim();
    var key = nameKey(name);
    if (key && !byKey[key]) byKey[key] = name;
  });
  var names = Object.keys(byKey).sort().map(function (key) { return byKey[key]; });
  cache.put(NAMES_CACHE_KEY, JSON.stringify(names), NAMES_CACHE_SECONDS);
  return names;
}

function jsonReply(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
