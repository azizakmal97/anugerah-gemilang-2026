/**
 * Best Dress vote, name search (spec: specs/best-dress-vote.md).
 *
 * A web app the event page calls while a guest types a name. It answers with
 * at most 10 names of people who confirmed attendance, only after 3 letters,
 * only of the asked gender (g=Lelaki or g=Perempuan; a guest with no Jantina
 * answer, such as a test row sent before the question existed, shows in both),
 * and only while voting is open (12.00 pm to 6.00 pm, 5 Dec 2026). The reply
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
 * Testing before the event (owner 2026-11-21: the committee tests it for real):
 * open Project Settings > Script properties and set TEST_FROM and
 * VOTE_TEST_UNTIL, for example 2026-11-21T12:00:00+08:00 and
 * 2026-11-30T23:59:00+08:00. Inside that window the search is open and every
 * answer sent in it counts like the day: names show in search, votes are
 * tallied and feedback gets a sijil. Delete both properties when testing ends:
 * every test answer then stops counting at once (see countedTimeRule).
 */

// The one rule for which answers count (owner 2026-11-17, audit: the forms are public, so anyone
// could fill them in from home): sent on 5 Dec between 12.00 pm and 6.00 pm, Malaysia time.
// Used for attendance rows by findAttendee (e-sijil.gs), attendeeNames here and the voter list in
// best-dress-results.gs, and for votes by tallyVotes.
var EVENT_OPENS_AT = Date.UTC(2026, 11, 5, 4, 0);   // 12.00 pm, 5 Dec 2026
var EVENT_CLOSES_AT = Date.UTC(2026, 11, 5, 10, 0); // 6.00 pm: attendance and voting close (was 5.30 for votes)

function isEventTime(ms) {
  return ms >= EVENT_OPENS_AT && ms < EVENT_CLOSES_AT;
}

var VOTE_TEST_KEY = 'VOTE_TEST_UNTIL';
var TEST_FROM_KEY = 'TEST_FROM';
var SEARCH_MIN_LETTERS = 3;
var SEARCH_MAX_RESULTS = 10;
var SEARCH_MAX_QUERY = 40;
var NAMES_CACHE_KEY = 'best-dress-names-v3'; // v3: {count, attendees}; v2 entries carried Jantina
// The list is rebuilt by refreshNameList on every check-in (trigger from setupNameSearch), so searches
// never read the form themselves. Load test 2026-11-27: 30 searches at once that each reread the form
// all failed. The cache only needs to outlive the event day; 6 hours is CacheService's maximum.
var NAMES_CACHE_SECONDS = 21600;
var NAMES_LOCK_WAIT_MS = 10000; // a search waits this long for another to finish rebuilding the list
var NAMES_STORE_LOCK_WAIT_MS = 2000; // a check-in holds the lock only to store the list it built
var NAMES_REFRESH_HANDLER = 'refreshNameList';

function doGet(e) {
  var parameters = (e && e.parameter) || {};
  try {
    return jsonReply(searchReply(String(parameters.q || ''), String(parameters.g || ''), Date.now()));
  } catch (error) {
    // A readable "busy" lets the page retry, where a thrown error would show Google's HTML error page.
    console.error('Name search failed: ' + error);
    return jsonReply({ open: true, names: [], busy: true });
  }
}

function searchReply(query, gender, nowMs) {
  if (!isVoteOpen(nowMs)) return { open: false, names: [] };
  var key = nameKey(query.slice(0, SEARCH_MAX_QUERY));
  if (key.replace(/ /g, '').length < SEARCH_MIN_LETTERS) return { open: true, names: [] };
  return { open: true, names: matchNames(attendeeNames(), key, gender) };
}

function isVoteOpen(nowMs) {
  return countedTimeRule()(nowMs);
}

// Which answers count: those sent on the day, plus those sent inside the committee's test window
// while it is set. Script properties are read once here, not once per answer.
function countedTimeRule() {
  var properties = PropertiesService.getScriptProperties();
  var testFrom = Date.parse(properties.getProperty(TEST_FROM_KEY) || '');
  var testUntil = Date.parse(properties.getProperty(VOTE_TEST_KEY) || '');
  var hasTestWindow = !isNaN(testFrom) && !isNaN(testUntil);
  return function (ms) {
    if (isEventTime(ms)) return true;
    return hasTestWindow && ms >= testFrom && ms < testUntil;
  };
}

// Upper case, letters and spaces only, single spaces: "  siti  nur'aini " and "SITI NURAINI" match.
function nameKey(text) {
  return String(text).toUpperCase().replace(/[^A-Z ]/g, '').replace(/ +/g, ' ').trim();
}

// attendees: [{ name, gender }]. An unknown gender in the query (or none) keeps everyone.
function matchNames(attendees, key, gender) {
  var byGender = gender === 'Lelaki' || gender === 'Perempuan';
  var found = [];
  for (var i = 0; i < attendees.length && found.length < SEARCH_MAX_RESULTS; i++) {
    var attendee = attendees[i];
    if (byGender && attendee.gender && attendee.gender !== gender) continue;
    if (nameKey(attendee.name).indexOf(key) !== -1) found.push(attendee.name);
  }
  return found;
}

// Distinct attendees ({ name, gender }) from attendance that counts (countedTimeRule), sorted.
// Read from the cache; on a miss, one search at a time rebuilds it (the others wait, then reuse it).
function attendeeNames() {
  var cache = CacheService.getScriptCache();
  var cached = readNameList(cache);
  if (cached) return cached.attendees;

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(NAMES_LOCK_WAIT_MS)) throw new Error('Name list is being rebuilt; try again');
  try {
    cached = readNameList(cache); // another search may have rebuilt it while this one waited
    return cached ? cached.attendees : storeNameList(cache, buildNameList());
  } finally {
    lock.releaseLock();
  }
}

// Attendance form submit trigger: a new check-in is searchable within seconds. The form is read
// with no lock held, so a queue of check-ins never keeps the script lock (and sijil claims) waiting.
function refreshNameList() {
  var list = buildNameList();
  var lock = LockService.getScriptLock();
  var locked = lock.tryLock(NAMES_STORE_LOCK_WAIT_MS);
  try {
    storeNameList(CacheService.getScriptCache(), list); // unlocked if busy: the count check still holds
  } finally {
    if (locked) lock.releaseLock();
  }
}

// Run once from the editor (pick setupNameSearch, press Run). Safe to run twice.
function setupNameSearch() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === NAMES_REFRESH_HANDLER) ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger(NAMES_REFRESH_HANDLER).forForm(findFormNamed(ATTENDANCE_FORM_TITLE)).onFormSubmit().create();
  refreshNameList();
  Logger.log('Siap. Senarai nama Best Dress dikemas kini setiap kali kehadiran dihantar.');
}

function readNameList(cache) {
  var cached = cache.get(NAMES_CACHE_KEY);
  return cached ? JSON.parse(cached) : null;
}

// A list built from fewer responses than the cached one is older: it never overwrites it.
function storeNameList(cache, list) {
  var cached = readNameList(cache);
  if (cached && cached.count > list.count) return cached.attendees;
  cache.put(NAMES_CACHE_KEY, JSON.stringify(list), NAMES_CACHE_SECONDS);
  return list.attendees;
}

// Returns {count: responses read, attendees}. Reads the form; stores nothing.
function buildNameList() {
  var byKey = {};
  var isCounted = countedTimeRule();
  var responses = findFormNamed(ATTENDANCE_FORM_TITLE).getResponses();
  responses.forEach(function (response) {
    if (!isCounted(response.getTimestamp().getTime())) return;
    var answers = readAnswers(response);
    var name = String(answers['Nama penuh'] || '').replace(/\s+/g, ' ').trim();
    var key = nameKey(name);
    if (key && !byKey[key]) byKey[key] = { name: name, gender: String(answers['Jantina'] || '') };
  });
  var attendees = Object.keys(byKey).sort().map(function (key) { return byKey[key]; });
  return { count: responses.length, attendees: attendees };
}

function jsonReply(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
