// Tests for scripts/best-dress.gs, the name search behind the Best Dress vote.
// Privacy rules under test: closed outside voting hours, nothing before 3 letters,
// at most 10 names, and a reply that carries names only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const SOURCE = readFileSync(new URL("../scripts/best-dress.gs", import.meta.url), "utf8");
const OPEN = Date.UTC(2026, 11, 5, 4, 0); // 12.00 pm, 5 Dec, Malaysia time
const CLOSE = Date.UTC(2026, 11, 5, 10, 0); // 6.00 pm

function loadSearch({ attendees = [], properties = {}, lockFree = true } = {}) {
  let formReads = 0;
  const cacheStore = {};
  const context = {
    ATTENDANCE_FORM_TITLE: "Kehadiran Majlis Anugerah Gemilang 2026",
    findFormNamed: () => ({
      getResponses: () => {
        formReads += 1;
        return attendees;
      },
    }),
    readAnswers: (response) => response,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => properties[key] ?? null }) },
    LockService: { getScriptLock: () => ({ tryLock: () => lockFree, releaseLock() {} }) },
    console: { error() {} },
    ContentService: { createTextOutput: (text) => ({ text, setMimeType() { return this; } }), MimeType: { JSON: "json" } },
    CacheService: {
      getScriptCache: () => ({
        get: (key) => cacheStore[key] ?? null,
        put: (key, value) => { cacheStore[key] = value; },
      }),
    },
  };
  vm.createContext(context);
  vm.runInContext(SOURCE, context);
  // JSON round trip: the reply goes out as JSON anyway, and vm arrays fail deepEqual across realms.
  // gender is optional here, so the older tests read as before: no g sent keeps every guest.
  const searchReply = (query, nowMs, gender = "") => JSON.parse(JSON.stringify(context.searchReply(query, gender, nowMs)));
  const doGet = (q, g) => JSON.parse(context.doGet({ parameter: { q, g } }).text);
  return { searchReply, doGet, context, cacheStore, formReads: () => formReads };
}

// readAnswers is faked as identity, so one object is both the response and its answers.
const guest = (name, ic = "900101081234", sentAt = OPEN + 60 * 1000, jantina = "") => ({
  "Nama penuh": name,
  ...(jantina && { Jantina: jantina }),
  "No. Kad Pengenalan": ic,
  Peranan: "Peserta",
  getTimestamp: () => new Date(sentAt),
});

test("search is closed before 12.00 pm and from 6.00 pm on 5 Dec", () => {
  const { searchReply } = loadSearch({ attendees: [guest("Siti Aminah")] });
  assert.deepEqual(searchReply("siti", OPEN - 1), { open: false, names: [] });
  assert.deepEqual(searchReply("siti", CLOSE), { open: false, names: [] });
  assert.deepEqual(searchReply("siti", OPEN).names, ["Siti Aminah"]);
  assert.deepEqual(searchReply("siti", CLOSE - 1).names, ["Siti Aminah"]);
});

const TEST_WINDOW = { TEST_FROM: "2026-11-21T12:00:00+08:00", VOTE_TEST_UNTIL: "2026-11-30T23:59:00+08:00" };
const TEST_FROM = Date.parse(TEST_WINDOW.TEST_FROM);
const TEST_UNTIL = Date.parse(TEST_WINDOW.VOTE_TEST_UNTIL);

test("the committee's test window opens search early and closes it by itself", () => {
  const { searchReply } = loadSearch({ properties: TEST_WINDOW });
  assert.equal(searchReply("siti", TEST_FROM - 1).open, false);
  assert.equal(searchReply("siti", TEST_FROM).open, true);
  assert.equal(searchReply("siti", TEST_UNTIL - 1).open, true);
  assert.equal(searchReply("siti", TEST_UNTIL).open, false);
});

test("a half-set or broken test window opens nothing", () => {
  const onlyUntil = { VOTE_TEST_UNTIL: TEST_WINDOW.VOTE_TEST_UNTIL };
  assert.equal(loadSearch({ properties: onlyUntil }).searchReply("siti", TEST_FROM + 1).open, false);
  const broken = { TEST_FROM: "bukan tarikh", VOTE_TEST_UNTIL: TEST_WINDOW.VOTE_TEST_UNTIL };
  assert.equal(loadSearch({ properties: broken }).searchReply("siti", TEST_FROM + 1).open, false);
});

test("attendance sent inside the test window is searchable only while the window is set", () => {
  const attendees = [
    guest("Siti Ujian", "900101084444", TEST_FROM + 60 * 1000),
    guest("Siti Lama", "900101085555", TEST_FROM - 60 * 1000),
  ];
  assert.deepEqual(loadSearch({ attendees, properties: TEST_WINDOW }).searchReply("siti", TEST_FROM + 120 * 1000).names, ["Siti Ujian"]);
  // Window deleted after testing: on the day, the test answer no longer counts.
  assert.deepEqual(loadSearch({ attendees }).searchReply("siti", OPEN + 1).names, []);
});

test("only attendance sent on 5 Dec, 12.00 to 6.00 pm, is searchable", () => {
  const attendees = [
    guest("Siti Awal", "900101081111", Date.parse("2026-11-17T20:00:00+08:00")),
    guest("Siti Lewat", "900101082222", CLOSE),
    guest("Siti Hadir", "900101083333", OPEN),
  ];
  const { searchReply } = loadSearch({ attendees });
  assert.deepEqual(searchReply("siti", OPEN + 1).names, ["Siti Hadir"]);
});

test("fewer than 3 letters returns no names, even with spaces or symbols", () => {
  const { searchReply, formReads } = loadSearch({ attendees: [guest("Siti Aminah")] });
  for (const query of ["", "si", "s i", "s1@", "  ab "]) {
    assert.deepEqual(searchReply(query, OPEN), { open: true, names: [] }, query);
  }
  assert.equal(formReads(), 0, "no attendance read for a short query");
});

test("matches inside the name, ignoring case, spaces and apostrophes", () => {
  const { searchReply } = loadSearch({ attendees: [guest("Nur'Aini  binti Ahmad"), guest("Ahmad Faizal")] });
  assert.deepEqual(searchReply("ahmad", OPEN).names, ["Ahmad Faizal", "Nur'Aini binti Ahmad"]);
  assert.deepEqual(searchReply("NURAINI", OPEN).names, ["Nur'Aini binti Ahmad"]);
  assert.deepEqual(searchReply("zzz", OPEN).names, []);
});

test("never more than 10 names, and a guest who confirmed twice shows once", () => {
  const attendees = Array.from({ length: 15 }, (_, i) => guest(`Ali ${"ABCDEFGHIJKLMNO"[i]}`));
  attendees.push(guest("ali  a"));
  const { searchReply } = loadSearch({ attendees });
  const names = searchReply("ali", OPEN).names;
  assert.equal(names.length, 10);
  assert.equal(new Set(names.map((n) => n.toUpperCase())).size, 10);
});

test("the reply carries names only: no IC, no role", () => {
  const { searchReply } = loadSearch({ attendees: [guest("Siti Aminah", "900101-08-1234")] });
  assert.deepEqual(searchReply("siti", OPEN), { open: true, names: ["Siti Aminah"] });
});

test("the attendance list is read once and then served from the cache", () => {
  const { searchReply, formReads } = loadSearch({ attendees: [guest("Siti Aminah")] });
  searchReply("siti", OPEN);
  searchReply("amin", OPEN);
  assert.equal(formReads(), 1);
});

test("a gendered search lists only that gender, plus guests who never answered Jantina", () => {
  const attendees = [
    guest("Ahmad Lelaki", "900101081111", OPEN + 1, "Lelaki"),
    guest("Ahmad Perempuan", "900101082222", OPEN + 1, "Perempuan"),
    guest("Ahmad Lama", "900101083333", OPEN + 1),
  ];
  const { searchReply } = loadSearch({ attendees });
  assert.deepEqual(searchReply("ahmad", OPEN + 2, "Lelaki").names, ["Ahmad Lama", "Ahmad Lelaki"]);
  assert.deepEqual(searchReply("ahmad", OPEN + 2, "Perempuan").names, ["Ahmad Lama", "Ahmad Perempuan"]);
  assert.equal(searchReply("ahmad", OPEN + 2, "x").names.length, 3, "an unknown g filters nothing");
});

test("the reply never carries a guest's Jantina, only names", () => {
  const { searchReply } = loadSearch({ attendees: [guest("Siti Aminah", "900101081234", OPEN + 1, "Perempuan")] });
  assert.deepEqual(searchReply("siti", OPEN + 2, "Perempuan"), { open: true, names: ["Siti Aminah"] });
});

test("after a check-in refreshes the list, searches never read the form", () => {
  const { context, searchReply, formReads } = loadSearch({ attendees: [guest("Siti Aminah")] });
  context.refreshNameList();
  assert.equal(formReads(), 1);
  for (let i = 0; i < 30; i++) searchReply("siti", OPEN + 1);
  assert.equal(formReads(), 1, "30 searches reuse the list the check-in built");
});

test("while another search rebuilds the list, the reply says busy instead of failing", () => {
  const { doGet, formReads } = loadSearch({ attendees: [guest("Siti Aminah")], lockFree: false, properties: {
    TEST_FROM: new Date(Date.now() - 60000).toISOString(), VOTE_TEST_UNTIL: new Date(Date.now() + 60000).toISOString(),
  } });
  assert.deepEqual(doGet("siti", "Perempuan"), { open: true, names: [], busy: true });
  assert.equal(formReads(), 0, "no form read without the lock");
});
