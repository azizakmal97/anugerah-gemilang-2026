// Tests for the Best Dress recount triggers in scripts/best-dress-results.gs: one recount a minute
// while voting is open (not one per vote), and the last recount at 6.01 pm removes that trigger.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = (name) => readFileSync(new URL(`../scripts/${name}`, import.meta.url), "utf8");

function loadTriggers({ properties = {}, triggers = [] } = {}) {
  let recounts = 0;
  const created = [];
  const deleted = [];
  const builder = (handler) => ({
    timeBased: () => ({
      everyMinutes: (minutes) => ({ create: () => created.push({ handler, minutes }) }),
      at: (date) => ({ create: () => created.push({ handler, at: date.getTime() }) }),
    }),
  });
  const context = {
    VOTE_FORM_TITLE: "Undian Best Dress 2026",
    ATTENDANCE_FORM_TITLE: "Kehadiran Majlis Anugerah Gemilang 2026",
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => properties[key] ?? null }) },
    ScriptApp: {
      getProjectTriggers: () => triggers.map((handler) => ({ getHandlerFunction: () => handler })),
      deleteTrigger: (trigger) => deleted.push(trigger.getHandlerFunction()),
      newTrigger: builder,
    },
    Logger: { log() {} },
  };
  vm.createContext(context);
  vm.runInContext(read("best-dress.gs"), context);
  vm.runInContext(read("best-dress-results.gs"), context);
  context.writeCurrentResults = () => { recounts += 1; };
  context.openResultsTab = () => ({ getParent: () => ({ getUrl: () => "url" }), getSheetId: () => 1 });
  return { context, created, deleted, recounts: () => recounts };
}

test("setup swaps the old per-vote trigger for one recount a minute", () => {
  const { context, created, deleted } = loadTriggers({ triggers: ["onVoteSubmit", "refreshNameList"] });
  context.setupBestDressResults();
  assert.deepEqual(deleted, ["onVoteSubmit"], "the name-list trigger stays");
  assert.deepEqual(created.map((trigger) => ({ ...trigger })), [{ handler: "recountWhileVoting", minutes: 1 }]);
});

test("the minute trigger recounts only while voting is open", () => {
  const now = Date.now();
  const open = loadTriggers({ properties: {
    TEST_FROM: new Date(now - 60000).toISOString(), VOTE_TEST_UNTIL: new Date(now + 60000).toISOString(),
  } });
  open.context.recountWhileVoting();
  assert.equal(open.recounts(), 1);
  const closed = loadTriggers();
  closed.context.recountWhileVoting();
  assert.equal(closed.recounts(), 0, "outside the day and with no test window it only reads the clock");
});

test("the 6.01 pm recount also removes the minute trigger", () => {
  const { context, deleted, recounts } = loadTriggers({ triggers: ["recountWhileVoting", "recountAfterVoting"] });
  context.recountAfterVoting();
  assert.deepEqual(deleted, ["recountWhileVoting"]);
  assert.equal(recounts(), 1);
});
