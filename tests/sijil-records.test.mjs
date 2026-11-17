// Tests for the e-sijil send rules (specs/attendee-only-sijil.md A7, A10 to A12):
// scripts/e-sijil.gs handleFeedback and sendSijil with scripts/sijil-records.gs, Google faked.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = (name) => readFileSync(new URL(`../scripts/${name}`, import.meta.url), "utf8");
const SOURCES = ["e-sijil.gs", "best-dress.gs", "best-dress-results.gs", "sijil-records.gs"].map(read);

function loadSijil() {
  const properties = { TEMPLATE_ID: "peserta-template", URUSETIA_TEMPLATE_ID: "urusetia-template" };
  const mails = [];
  const sentRows = [];
  const notListedRows = [];
  const trashed = [];
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => properties[key] ?? null,
        setProperty: (key, value) => { properties[key] = value; },
        setProperties: (values) => Object.assign(properties, values),
        deleteProperty: (key) => { delete properties[key]; },
      }),
    },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    Utilities: { formatDate: () => "2026-12-05" },
    MailApp: { getRemainingDailyQuota: () => 1000, sendEmail: (mail) => mails.push(mail) },
    DriveApp: {
      getFileById: (templateId) => ({
        makeCopy: () => ({
          getId: () => `copy-of-${templateId}`,
          getAs: () => ({ setName: (name) => ({ name, templateId }) }),
          setTrashed: () => trashed.push(templateId),
        }),
      }),
    },
    Logger: { log: () => {} },
  };
  vm.createContext(context);
  SOURCES.forEach((source) => vm.runInContext(source, context));
  // Google-only parts replaced after loading, so the rules run as written.
  context.findEventFolder = () => ({});
  context.fillCertificate = () => {};
  context.logSijilSent = (...row) => sentRows.push(row);
  context.logNotListed = (...row) => notListedRows.push(row);

  const send = (name, ic, role, email = "tetamu@contoh.my") =>
    context.handleFeedback(
      { "Nama penuh": name, Emel: email, "No. Kad Pengenalan": ic },
      () => (role ? { role } : null),
    );
  return { context, send, properties, mails, sentRows, notListedRows, trashed };
}

test("a peserta gets one PDF, an urus setia gets both PDFs in one email", () => {
  const { send, mails, trashed } = loadSijil();
  send("Ali Bin Abu", "900101-08-1111", "Peserta");
  send("Siti Aminah", "900101-08-2222", "Urus setia");
  assert.equal(mails.length, 2);
  assert.deepEqual([...mails[0].attachments].map((pdf) => pdf.templateId), ["peserta-template"]);
  assert.deepEqual([...mails[1].attachments].map((pdf) => pdf.templateId), ["peserta-template", "urusetia-template"]);
  assert.match(mails[1].attachments[1].name, /^e-Sijil Urus Setia Anugerah Gemilang 2026 - SITI AMINAH\.pdf$/);
  assert.match(mails[1].body, /Dua e-Sijil anda dilampirkan/);
  assert.equal(trashed.length, 3, "every temporary copy goes to the bin");
});

test("the same IC with the same printed name gets nothing new", () => {
  const { send, mails, sentRows } = loadSijil();
  send("Ali Bin Abu", "900101-08-1111", "Peserta");
  send("  ali  bin ABU ", "900101081111", "Peserta");
  assert.equal(mails.length, 1);
  assert.equal(sentRows.length, 1);
});

test("the same IC with a new name gets a replacement that says so", () => {
  const { send, mails, sentRows } = loadSijil();
  send("Ali Bin Abu", "900101-08-1111", "Peserta");
  send("Ali Bin Abu Bakar", "900101-08-1111", "Peserta");
  assert.equal(mails.length, 2);
  assert.match(mails[1].subject, /\(dikemas kini\)$/);
  assert.match(mails[1].body, /menggantikan e-Sijil yang dihantar sebelum ini/);
  assert.deepEqual(sentRows.map((row) => [row[1], row[4]]), [["ALI BIN ABU", "new"], ["ALI BIN ABU BAKAR", "replace"]]);
});

test("a failed send frees the IC so the guest can try again", () => {
  const { context, send, mails, properties } = loadSijil();
  context.MailApp.sendEmail = () => { throw new Error("Kuota habis"); };
  assert.throws(() => send("Ali Bin Abu", "900101-08-1111", "Peserta"), /Kuota habis/);
  assert.equal(properties.SIJIL_IC_900101081111, undefined);
  context.MailApp.sendEmail = (mail) => mails.push(mail);
  send("Ali Bin Abu", "900101-08-1111", "Peserta");
  assert.equal(mails.length, 1);
});

test("the sijil log never holds a full IC", () => {
  const { context } = loadSijil();
  assert.equal(context.maskedIc("900101081111"), "xxxxxx-xx-1111");
  assert.equal(context.maskedIc(""), "");
});

test("'tidak ditemui' goes once per IC and once per email, and every case is logged", () => {
  const { send, mails, notListedRows } = loadSijil();
  send("Orang Luar", "800808-08-9999", null, "a@contoh.my");
  send("Orang Luar", "800808-08-9999", null, "b@contoh.my"); // same IC, new email
  send("Orang Lain", "800808-08-8888", null, "A@Contoh.my "); // same email, new IC
  assert.equal(mails.length, 1);
  assert.deepEqual(notListedRows.map((row) => row[3]), [
    "Dihantar",
    "Tidak dihantar: sudah dihantar untuk No. K/P ini",
    "Tidak dihantar: sudah dihantar ke emel ini",
  ]);
});

test("'tidak ditemui' stops at 30 a day", () => {
  const { send, mails, notListedRows, properties } = loadSijil();
  for (let i = 0; i < 31; i++) send("Orang Luar", `8008080${String(10000 + i)}`, null, `orang${i}@contoh.my`);
  assert.equal(mails.length, 30);
  assert.equal(notListedRows[30][3], "Tidak dihantar: had 30 emel sehari");
  assert.equal(properties["TIADA_COUNT_2026-12-05"], "30");
});

test("tab columns are wide enough for a date, and wider for names and emails", () => {
  const { context } = loadSijil();
  assert.equal(context.dataColumnWidth("Masa", 60), 150);
  assert.equal(context.dataColumnWidth("Nama pada sijil", 120), 280);
  assert.equal(context.dataColumnWidth("Emel makluman", 90), 280);
  assert.equal(context.dataColumnWidth("Cadangan untuk majlis akan datang", 900), 320);
});
