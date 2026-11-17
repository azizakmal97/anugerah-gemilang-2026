// Tests for scripts/best-dress.gs, the name search behind the Best Dress vote.
// Privacy rules under test: closed outside voting hours, nothing before 3 letters,
// at most 10 names, and a reply that carries names only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const SOURCE = readFileSync(new URL("../scripts/best-dress.gs", import.meta.url), "utf8");
const OPEN = Date.UTC(2026, 11, 5, 4, 0); // 12.00 pm, 5 Dec, Malaysia time
const CLOSE = Date.UTC(2026, 11, 5, 9, 30); // 5.30 pm

function loadSearch({ attendees = [], properties = {} } = {}) {
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
  const searchReply = (query, nowMs) => JSON.parse(JSON.stringify(context.searchReply(query, nowMs)));
  return { searchReply, formReads: () => formReads };
}

const guest = (name, ic = "900101081234") => ({ "Nama penuh": name, "No. Kad Pengenalan": ic, Peranan: "Peserta" });

test("search is closed before 12.00 pm and from 5.30 pm on 5 Dec", () => {
  const { searchReply } = loadSearch({ attendees: [guest("Siti Aminah")] });
  assert.deepEqual(searchReply("siti", OPEN - 1), { open: false, names: [] });
  assert.deepEqual(searchReply("siti", CLOSE), { open: false, names: [] });
  assert.deepEqual(searchReply("siti", OPEN).names, ["Siti Aminah"]);
  assert.deepEqual(searchReply("siti", CLOSE - 1).names, ["Siti Aminah"]);
});

test("VOTE_TEST_UNTIL opens search early and closes it by itself", () => {
  const properties = { VOTE_TEST_UNTIL: "2026-11-20T23:00:00+08:00" };
  const { searchReply } = loadSearch({ attendees: [guest("Siti Aminah")], properties });
  const testUntil = Date.parse(properties.VOTE_TEST_UNTIL);
  assert.equal(searchReply("siti", testUntil - 1).open, true);
  assert.equal(searchReply("siti", testUntil).open, false);
  assert.equal(loadSearch({ properties: { VOTE_TEST_UNTIL: "bukan tarikh" } }).searchReply("siti", OPEN - 1).open, false);
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
