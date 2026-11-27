// Tests for findFormNamed in scripts/e-sijil.gs: the form id is saved after the first title
// lookup, reused after that, and a saved id that stops opening falls back to the title.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const SOURCE = readFileSync(new URL("../scripts/e-sijil.gs", import.meta.url), "utf8");
const TITLE = "Kehadiran Majlis Anugerah Gemilang 2026";

function loadFinder({ properties = {}, files = [{ id: "form-1", name: TITLE }], openable = ["form-1"] } = {}) {
  let driveListings = 0;
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => properties[key] ?? null,
        setProperty: (key, value) => { properties[key] = value; },
      }),
    },
    DriveApp: {
      getFilesByType: () => {
        driveListings += 1;
        const queue = files.map((file) => ({ getId: () => file.id, getName: () => file.name, isTrashed: () => false }));
        return { hasNext: () => queue.length > 0, next: () => queue.shift() };
      },
    },
    MimeType: { GOOGLE_FORMS: "forms" },
    FormApp: {
      openById: (id) => {
        if (!openable.includes(id)) throw new Error(`No item with the given ID: ${id}`);
        return { getId: () => id };
      },
    },
    console: { warn() {} },
  };
  vm.createContext(context);
  vm.runInContext(SOURCE, context);
  return { findFormNamed: context.findFormNamed, properties, driveListings: () => driveListings };
}

test("the first lookup goes by title and saves the id; later ones skip Drive", () => {
  const { findFormNamed, properties, driveListings } = loadFinder();
  assert.equal(findFormNamed(TITLE).getId(), "form-1");
  assert.equal(properties[`FORM_ID_${TITLE}`], "form-1");
  assert.equal(findFormNamed(TITLE).getId(), "form-1");
  assert.equal(driveListings(), 1);
});

test("a saved id that no longer opens falls back to the title and saves the new id", () => {
  const { findFormNamed, properties } = loadFinder({
    properties: { [`FORM_ID_${TITLE}`]: "deleted-form" },
    files: [{ id: "form-2", name: TITLE }],
    openable: ["form-2"],
  });
  assert.equal(findFormNamed(TITLE).getId(), "form-2");
  assert.equal(properties[`FORM_ID_${TITLE}`], "form-2");
});

test("a title with no form still says which form is missing", () => {
  const { findFormNamed } = loadFinder({ files: [] });
  assert.throws(() => findFormNamed(TITLE), /Borang "Kehadiran Majlis Anugerah Gemilang 2026" tiada/);
});
