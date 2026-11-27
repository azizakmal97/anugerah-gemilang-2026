// Tests for scripts/best-dress-results.gs: the counting rules behind the private Best Dress results.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = (name) => readFileSync(new URL(`../scripts/${name}`, import.meta.url), "utf8");
const OPEN = Date.UTC(2026, 11, 5, 4, 0); // 12.00 pm, 5 Dec, Malaysia time
const CLOSE = Date.UTC(2026, 11, 5, 10, 0); // 6.00 pm
const MINUTE = 60 * 1000;

function loadTally(properties = {}) {
  const context = {
    VOTE_FORM_TITLE: "Undian Best Dress 2026",
    ATTENDANCE_FORM_TITLE: "Kehadiran Majlis Anugerah Gemilang 2026",
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => properties[key] ?? null }) },
  };
  vm.createContext(context);
  vm.runInContext(read("best-dress.gs"), context);
  vm.runInContext(read("best-dress-results.gs"), context);
  // JSON round trip: vm arrays fail deepEqual across realms.
  // Same rule as production: the day, plus the committee's test window when its properties are set.
  const tally = (votes, attendees, isCountedTime = context.countedTimeRule()) =>
    JSON.parse(JSON.stringify(context.tallyVotes(votes, attendees, isCountedTime)));
  tally.rule = (nowMs) => context.countedTimeRule(nowMs); // the rule as it reads at a given moment
  return tally;
}

const attendee = (name, ic, timestamp = OPEN + MINUTE) => ({ name, ic, timestamp });
const vote = (ic, Lelaki, Perempuan, timestamp = OPEN + MINUTE) => ({ ic, Lelaki, Perempuan, timestamp });

const ATTENDEES = [
  attendee("Ali Bin Abu", "900101-08-1111"),
  attendee("Ahmad Zaki", "900101-08-2222"),
  attendee("Siti Aminah", "900101-08-3333"),
  attendee("Nur Aini", "900101-08-4444"),
  attendee("Mira Sofea", "900101-08-5555"),
];

test("the first vote per IC counts, even when a later vote sits earlier in the array", () => {
  const tally = loadTally();
  const result = tally(
    [vote("900101-08-5555", "Ahmad Zaki", "Siti Aminah", OPEN + 10 * MINUTE), vote("900101-08-5555", "Ali Bin Abu", "Nur Aini", OPEN + MINUTE)],
    ATTENDEES,
  );
  assert.equal(result.voters, 1);
  assert.deepEqual(result.Lelaki, [{ rank: 1, name: "Ali Bin Abu", votes: 1 }]);
  assert.deepEqual(result.Perempuan, [{ rank: 1, name: "Nur Aini", votes: 1 }]);
});

test("IC matches by digits, with or without dashes", () => {
  const tally = loadTally();
  const result = tally([vote("900101081111", "Ahmad Zaki", "Siti Aminah"), vote("900101-08-1111", "Ali Bin Abu", "Nur Aini", OPEN + 2 * MINUTE)], ATTENDEES);
  assert.equal(result.voters, 1);
  assert.equal(result.Lelaki[0].name, "Ahmad Zaki");
});

test("a voter who is not on the attendance list is ignored", () => {
  const result = loadTally()([vote("800808-08-9999", "Ahmad Zaki", "Siti Aminah")], ATTENDEES);
  assert.deepEqual(result, { voters: 0, Lelaki: [], Perempuan: [] });
});

test("a self-vote pick is dropped but the other pick still counts", () => {
  const result = loadTally()([vote("900101-08-1111", "ali  bin abu", "Siti Aminah")], ATTENDEES);
  assert.equal(result.voters, 1);
  assert.deepEqual(result.Lelaki, []);
  assert.deepEqual(result.Perempuan, [{ rank: 1, name: "Siti Aminah", votes: 1 }]);
});

test("a pick who did not confirm attendance is ignored", () => {
  const result = loadTally()([vote("900101-08-1111", "Orang Luar", "Siti Aminah")], ATTENDEES);
  assert.deepEqual(result.Lelaki, []);
  assert.equal(result.Perempuan.length, 1);
});

test("votes before 12.00 pm or from 6.00 pm are not counted, and an early vote does not use up the IC", () => {
  const result = loadTally()(
    [
      vote("900101-08-5555", "Ahmad Zaki", "Siti Aminah", OPEN - 1),
      vote("900101-08-4444", "Ali Bin Abu", "Siti Aminah", CLOSE),
      vote("900101-08-5555", "Ali Bin Abu", "Nur Aini", OPEN),
    ],
    ATTENDEES,
  );
  assert.equal(result.voters, 1);
  assert.deepEqual(result.Lelaki, [{ rank: 1, name: "Ali Bin Abu", votes: 1 }]);
  assert.deepEqual(result.Perempuan, [{ rank: 1, name: "Nur Aini", votes: 1 }]);
});

test("votes and attendance inside the committee's test window count only while it is set", () => {
  const properties = { TEST_FROM: "2026-11-21T12:00:00+08:00", VOTE_TEST_UNTIL: "2026-11-30T23:59:00+08:00" };
  const inWindow = Date.parse("2026-11-22T10:00:00+08:00");
  const people = ATTENDEES.map((person) => ({ ...person, timestamp: inWindow }));
  const votes = [vote("900101-08-1111", "Ahmad Zaki", "Siti Aminah", inWindow)];
  const tally = loadTally(properties);
  assert.equal(tally(votes, people, tally.rule(inWindow + MINUTE)).voters, 1);
  assert.equal(loadTally()(votes, people).voters, 0); // window deleted: the test vote is gone
});

test("a test window left set stops counting its answers once it has ended", () => {
  const properties = { TEST_FROM: "2026-11-21T12:00:00+08:00", VOTE_TEST_UNTIL: "2026-11-30T23:59:00+08:00" };
  const inWindow = Date.parse("2026-11-22T10:00:00+08:00");
  const people = ATTENDEES.map((person) => ({ ...person, timestamp: inWindow }));
  const votes = [vote("900101-08-1111", "Ahmad Zaki", "Siti Aminah", inWindow)];
  const tally = loadTally(properties);
  assert.equal(tally(votes, people, tally.rule(OPEN + MINUTE)).voters, 0, "on the day, nobody deleted the window");
});

test("attendance sent outside 5 Dec, 12.00 to 6.00 pm, makes neither a voter nor a pick", () => {
  const fromHome = Date.parse("2026-11-17T21:00:00+08:00");
  const people = [
    attendee("Ali Bin Abu", "900101-08-1111"),
    attendee("Orang Rumah", "900101-08-6666", fromHome),
    attendee("Siti Lewat", "900101-08-7777", CLOSE),
  ];
  const result = loadTally()(
    [vote("900101-08-6666", "Ali Bin Abu", ""), vote("900101-08-1111", "", "Siti Lewat", OPEN + 2 * MINUTE)],
    people,
  );
  assert.deepEqual(result, { voters: 1, Lelaki: [], Perempuan: [] });
});

test("a tie at 5th place lists every tied name, and tied names share the rank", () => {
  const people = Array.from({ length: 7 }, (_, i) => attendee(`Calon ${"ABCDEFG"[i]}`, `91010108${1000 + i}`));
  const voters = Array.from({ length: 8 }, (_, i) => attendee(`Pengundi ${i}`, `92010108${2000 + i}`));
  // Calon A gets 2 votes; B to G get 1 each, so 5th place (1 vote) is shared by B to G.
  const picks = ["Calon A", "Calon A", "Calon B", "Calon C", "Calon D", "Calon E", "Calon F", "Calon G"];
  const votes = voters.map((voter, i) => vote(voter.ic, picks[i], ""));
  const result = loadTally()(votes, [...people, ...voters]);
  assert.equal(result.Lelaki.length, 7);
  assert.deepEqual(result.Lelaki[0], { rank: 1, name: "Calon A", votes: 2 });
  assert.deepEqual(result.Lelaki.slice(1).map((row) => row.rank), [2, 2, 2, 2, 2, 2]);
});

test("only the top 5 show when 5th place is not tied", () => {
  const people = Array.from({ length: 6 }, (_, i) => attendee(`Calon ${"ABCDEF"[i]}`, `91010108${1000 + i}`));
  const voters = Array.from({ length: 21 }, (_, i) => attendee(`Pengundi ${i}`, `92010108${2000 + i}`));
  const wanted = { "Calon A": 6, "Calon B": 5, "Calon C": 4, "Calon D": 3, "Calon E": 2, "Calon F": 1 };
  const picks = Object.entries(wanted).flatMap(([name, n]) => Array(n).fill(name));
  const votes = voters.map((voter, i) => vote(voter.ic, picks[i], ""));
  const result = loadTally()(votes, [...people, ...voters]);
  assert.deepEqual(result.Lelaki.map((row) => row.name), ["Calon A", "Calon B", "Calon C", "Calon D", "Calon E"]);
});

test("names match ignoring case and spacing, and show the attendee's own spelling", () => {
  const result = loadTally()([vote("900101-08-1111", "  AHMAD   zaki ", "siti AMINAH")], ATTENDEES);
  assert.deepEqual(result.Lelaki, [{ rank: 1, name: "Ahmad Zaki", votes: 1 }]);
  assert.deepEqual(result.Perempuan, [{ rank: 1, name: "Siti Aminah", votes: 1 }]);
});

test("the tally never carries an IC", () => {
  const result = loadTally()([vote("900101-08-1111", "Ahmad Zaki", "Siti Aminah")], ATTENDEES);
  assert.doesNotMatch(JSON.stringify(result), /\d{6}/);
});

function loadGrid() {
  const context = {
    VOTE_FORM_TITLE: "Undian Best Dress 2026",
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
  };
  vm.createContext(context);
  vm.runInContext(read("best-dress.gs"), context);
  vm.runInContext(read("best-dress-results.gs"), context);
  return (tally) => JSON.parse(JSON.stringify(context.buildResultsGrid(tally, "17 Nov 2026, 7:45:12 PM")));
}

test("the tab grid puts Lelaki on the left, Perempuan on the right, with a bar per name", () => {
  const grid = loadGrid()({
    voters: 20,
    Lelaki: [
      { rank: 1, name: "Ali", votes: 10 },
      { rank: 2, name: "Abu", votes: 5 },
    ],
    Perempuan: [{ rank: 1, name: "Siti", votes: 4 }],
  });
  const [title, updated, voters, gap, band, heading, first, second] = grid.values;
  assert.equal(grid.entryCount, 2);
  assert.equal(title[0], "Keputusan Best Dress 2026");
  assert.equal(updated[0], "Dikemas kini: 17 Nov 2026, 7:45:12 PM");
  assert.equal(voters[0], "Undi sah: 20");
  assert.deepEqual(gap, Array(9).fill(""));
  assert.deepEqual([band[0], band[5]], ["LELAKI", "PEREMPUAN"]);
  assert.deepEqual(heading, ["Kedudukan", "Nama", "Undi", "", "", "Kedudukan", "Nama", "Undi", ""]);
  assert.deepEqual(first.slice(0, 3), [1, "Ali", 10]);
  assert.deepEqual(first.slice(5, 8), [1, "Siti", 4]);
  assert.deepEqual(second.slice(0, 3), [2, "Abu", 5]);
  assert.equal(second[5], "", "the shorter block leaves its cells empty");
});

test("the top name gets the full bar and others scale to it, never below one block", () => {
  const grid = loadGrid()({
    voters: 100,
    Lelaki: [
      { rank: 1, name: "Ali", votes: 40 },
      { rank: 2, name: "Abu", votes: 20 },
      { rank: 3, name: "Zaid", votes: 1 },
    ],
    Perempuan: [],
  });
  const bars = [grid.values[6][3], grid.values[7][3], grid.values[8][3]];
  assert.equal(bars[0].length, 18);
  assert.equal(bars[1].length, 9);
  assert.equal(bars[2].length, 1);
});

test("a block with no votes says so instead of staying blank", () => {
  const grid = loadGrid()({ voters: 0, Lelaki: [], Perempuan: [] });
  assert.equal(grid.entryCount, 1);
  assert.equal(grid.values[6][1], "Belum ada undi");
  assert.equal(grid.values[6][6], "Belum ada undi");
});
