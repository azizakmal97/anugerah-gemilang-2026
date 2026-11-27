// Tests for clearAllTestData in scripts/sijil-records.gs: ends the test window, empties the three
// forms and their response tabs (header kept), forgets sijil records and drops the cached names.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = (name) => readFileSync(new URL(`../scripts/${name}`, import.meta.url), "utf8");
const SOURCES = ["create-forms.gs", "e-sijil.gs", "best-dress.gs", "best-dress-results.gs", "sijil-records.gs"].map(read);
const TITLES = ["Kehadiran Majlis Anugerah Gemilang 2026", "Maklum Balas Majlis Anugerah Gemilang 2026", "Undian Best Dress 2026"];

function fakeSheet(name, formId, rows, maxRows = rows) {
  const sheet = {
    name, rows, maxRows, deleted: [],
    getFormUrl: () => (formId ? `https://docs.google.com/forms/d/${formId}/viewform` : null),
    getLastRow: () => sheet.rows,
    getMaxRows: () => sheet.maxRows,
    insertRowAfter: () => { sheet.maxRows += 1; },
    deleteRows: (start, count) => {
      assert.ok(sheet.maxRows - count >= 2, "a sheet must keep a row below its header");
      sheet.deleted.push([start, count]);
      sheet.rows -= count;
      sheet.maxRows -= count;
    },
  };
  return sheet;
}

function loadCleanup() {
  const properties = {
    TEST_FROM: "2026-11-21T12:00:00+08:00", VOTE_TEST_UNTIL: "2026-11-30T23:59:00+08:00",
    SIJIL_IC_0001: "{}", TIADA_IC_0002: "1", TEMPLATE_ID: "keep",
  };
  const forms = TITLES.map((title, index) => ({ id: `form-${index}`, title, answers: 3 + index }));
  const sheets = [
    fakeSheet("Kehadiran", "form-0", 4, 4),       // full sheet: needs a blank row first
    fakeSheet("Maklum Balas", "form-1", 5, 1000),
    fakeSheet("Undian", "form-2", 1, 1000),       // header only already
    fakeSheet("Sijil Dihantar", null, 9, 1000),   // not a response tab: untouched
  ];
  const removedCacheKeys = [];
  let recounts = 0;
  const formApi = (form) => ({
    getId: () => form.id,
    getTitle: () => form.title,
    getResponses: () => new Array(form.answers),
    deleteAllResponses: () => { form.answers = 0; },
    getDestinationId: () => "committee-sheet",
  });
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => properties[key] ?? null,
        setProperty: (key, value) => { properties[key] = value; },
        deleteProperty: (key) => { delete properties[key]; },
        getKeys: () => Object.keys(properties),
      }),
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    CacheService: { getScriptCache: () => ({ removeAll: (keys) => removedCacheKeys.push(...keys) }) },
    SpreadsheetApp: { openById: () => ({ getSheets: () => sheets }) },
    FormApp: { openByUrl: (url) => ({ getId: () => url.split("/")[5] }) },
    Logger: { log: () => {} },
    console: { warn: () => {} },
  };
  vm.createContext(context);
  SOURCES.forEach((source) => vm.runInContext(source, context));
  context.findFormNamed = (title) => formApi(forms.find((form) => form.title === title));
  context.refreshBestDressResults = () => { recounts += 1; };
  return { context, properties, forms, sheets, removedCacheKeys, recounts: () => recounts };
}

test("clearAllTestData empties the three forms and their tabs, keeping each header", () => {
  const { context, forms, sheets } = loadCleanup();
  context.clearAllTestData();
  assert.deepEqual(forms.map((form) => form.answers), [0, 0, 0]);
  assert.deepEqual(sheets.map((sheet) => sheet.rows), [1, 1, 1, 9]);
  assert.deepEqual(sheets[0].deleted, [[2, 3]]);
  assert.deepEqual(sheets[2].deleted, [], "a header-only tab is left as it is");
});

test("clearAllTestData ends the test window, forgets sijil records and drops the name cache", () => {
  const { context, properties, removedCacheKeys, recounts } = loadCleanup();
  context.clearAllTestData();
  assert.deepEqual(Object.keys(properties), ["TEMPLATE_ID"]);
  assert.deepEqual(removedCacheKeys.sort(), ["best-dress-names-v2", "best-dress-names-v3"]);
  assert.equal(recounts(), 1, "the results tab is recounted to empty");
});
