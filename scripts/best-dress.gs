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
var NAMES_CACHE_KEY = 'best-dress-names-v2'; // v2: entries carry the guest's Jantina
var NAMES_CACHE_SECONDS = 30; // a new check-in shows in search within 30 s (owner 2026-11-27: 5 minutes too long)

function doGet(e) {
  var parameters = (e && e.parameter) || {};
  return jsonReply(searchReply(String(parameters.q || ''), String(parameters.g || ''), Date.now()));
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

// Distinct attendees ({ name, gender }) from attendance that counts (countedTimeRule), sorted, cached so 125 phones typing at once do not reread the form.
function attendeeNames() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(NAMES_CACHE_KEY);
  if (cached) return JSON.parse(cached);

  var byKey = {};
  var isCounted = countedTimeRule();
  findFormNamed(ATTENDANCE_FORM_TITLE).getResponses().forEach(function (response) {
    if (!isCounted(response.getTimestamp().getTime())) return;
    var answers = readAnswers(response);
    var name = String(answers['Nama penuh'] || '').replace(/\s+/g, ' ').trim();
    var key = nameKey(name);
    if (key && !byKey[key]) byKey[key] = { name: name, gender: String(answers['Jantina'] || '') };
  });
  var attendees = Object.keys(byKey).sort().map(function (key) { return byKey[key]; });
  cache.put(NAMES_CACHE_KEY, JSON.stringify(attendees), NAMES_CACHE_SECONDS);
  return attendees;
}

function jsonReply(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
