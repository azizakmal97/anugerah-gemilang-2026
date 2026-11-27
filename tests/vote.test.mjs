// Tests for vote.js: when the vote card is ready, what counts as a vote, what is sent to
// Google, and that a name-search reply can only ever bring back a short list of strings.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const FORMS_SOURCE = readFileSync(new URL("../forms.js", import.meta.url), "utf8");
const VOTE_SOURCE = readFileSync(new URL("../vote.js", import.meta.url), "utf8");
const myt = (hour, minute = 0) => Date.UTC(2026, 11, 5, hour - 8, minute); // 5 Dec 2026, Malaysia time
const READY = {
  voteFormUrl: "https://docs.google.com/forms/d/e/VOTE/viewform",
  voteSearchUrl: "https://script.google.com/macros/s/X/exec",
  attendanceOpensAt: myt(12),
  voteClosesAt: myt(17, 30),
};

// The vote card's section and holder, enough to read what renderVote put on the page.
function fakeCard() {
  const holder = {
    children: [],
    replaceChildren(...nodes) { this.children = nodes; },
    append(...nodes) { this.children.push(...nodes); },
  };
  const card = { undian: { hidden: true }, "undian-isi": holder };
  const createElement = (tag) => ({ tag, textContent: "", setAttribute() {}, append() {} });
  return { card, document: { getElementById: (id) => card[id], createElement } };
}

function loadVote({ settings = READY, entries = ["11", "22", "33"], fetch = async () => ({}), now = Date.UTC(2026, 10, 17), timers = [] } = {}) {
  const page = fakeCard();
  const context = {
    SETTINGS: settings, URLSearchParams, AbortController, clearTimeout, console: { error() {} }, fetch,
    document: page.document,
    Date: { now: () => now },
    setTimeout: (run, ms) => { timers.push({ run, ms }); return timers.length; },
  };
  vm.createContext(context);
  // `const` declarations stay in the script scope, so expose what the tests need.
  // buildVoteForm needs a real DOM, so here it only marks where the form would go.
  vm.runInContext(
    `${FORMS_SOURCE}\n${VOTE_SOURCE}\n;VOTE.fields.forEach((field, i) => { field.entry = ${JSON.stringify(entries)}[i]; });
    buildVoteForm = () => ({ tag: "vote-form" });
    globalThis.__vote = { isVoteReady, countLetters, findVoteErrors, toVoteBody, searchNames, voteNotOpenReason, renderVote };`,
    context,
  );
  return { ...context.__vote, card: page.card };
}

const settle = () => new Promise((resolve) => setImmediate(resolve)); // lets the open-check's fetch answer
const shown = (card) => card["undian-isi"].children.map((node) => (node.tag === "vote-form" ? "FORM" : node.textContent));

const plain = (value) => JSON.parse(JSON.stringify(value)); // vm objects fail deepEqual across realms

test("the vote card is ready only with both links and every entry id", () => {
  assert.equal(loadVote().isVoteReady(), true);
  assert.equal(loadVote({ settings: { ...READY, voteSearchUrl: "" } }).isVoteReady(), false);
  assert.equal(loadVote({ settings: { ...READY, voteFormUrl: "" } }).isVoteReady(), false);
  assert.equal(loadVote({ entries: ["11", "", "33"] }).isVoteReady(), false);
});

test("only letters count toward the 3 needed before a search", () => {
  const { countLetters } = loadVote();
  assert.equal(countLetters("si"), 2);
  assert.equal(countLetters("s i 1@"), 2);
  assert.equal(countLetters("Nur'a"), 4);
  assert.equal(countLetters(""), 0);
});

test("a vote needs one picked name in each category and a valid IC", () => {
  const { findVoteErrors } = loadVote();
  assert.deepEqual(plain(findVoteErrors({ lelaki: "Ali", perempuan: "Siti", ic: "900101-08-1234" })), {});
  const errors = plain(findVoteErrors({ lelaki: "", perempuan: "", ic: "9001" }));
  assert.deepEqual(Object.keys(errors).sort(), ["ic", "lelaki", "perempuan"]);
  assert.equal(errors.lelaki, "Nama belum dipilih. Taip nama, kemudian tekan nama itu dalam senarai.");
});

test("the same name cannot win both categories in one vote", () => {
  const { findVoteErrors } = loadVote();
  const errors = plain(findVoteErrors({ lelaki: "Ali", perempuan: "Ali", ic: "900101081234" }));
  assert.deepEqual(Object.keys(errors), ["perempuan"]);
});

test("the vote is sent as the three form entries, trimmed", () => {
  const { toVoteBody } = loadVote();
  const body = toVoteBody({ lelaki: "Ali ", perempuan: " Siti", ic: "900101-08-1234" });
  assert.equal(body.toString(), "entry.11=Ali&entry.22=Siti&entry.33=900101-08-1234");
});

test("a search reply keeps at most 10 strings and reads a closed vote", async () => {
  const names = ["A", 7, { evil: true }, ...Array.from({ length: 12 }, (_, i) => `N${i}`)];
  const fetch = async () => ({ ok: true, json: async () => ({ open: true, names }) });
  const reply = plain(await loadVote({ fetch }).searchNames("abc"));
  assert.equal(reply.open, true);
  assert.equal(reply.names.length, 10);
  assert.ok(reply.names.every((name) => typeof name === "string"));

  const closed = async () => ({ ok: true, json: async () => ({ open: false }) });
  assert.deepEqual(plain(await loadVote({ fetch: closed }).searchNames("abc")), { open: false, names: [] });
});

test("the search query is URL-encoded and a server error is a failure, not an empty list", async () => {
  let asked = "";
  const fetch = async (url) => { asked = url; return { ok: false, status: 500 }; };
  await assert.rejects(loadVote({ fetch }).searchNames("nur aini&x"));
  assert.equal(asked, `${READY.voteSearchUrl}?q=nur%20aini%26x`);
});

test("a 'not open' answer reads as not yet open early in the day and as closed later", () => {
  const { voteNotOpenReason } = loadVote();
  assert.equal(voteNotOpenReason(Date.UTC(2026, 10, 17)), "waiting");
  assert.equal(voteNotOpenReason(myt(11, 58)), "waiting");
  assert.equal(voteNotOpenReason(myt(12, 5)), "waiting");
  assert.equal(voteNotOpenReason(myt(17, 30)), "closed");
  assert.equal(voteNotOpenReason(myt(18)), "closed");
});

test("before voting opens the card shows when it opens, never a form or 'ditutup'", async () => {
  const timers = [];
  const fetch = async () => ({ ok: true, json: async () => ({ open: false, names: [] }) });
  const { renderVote, card } = loadVote({ fetch, timers });
  renderVote("open");
  assert.deepEqual(shown(card), ["Memuatkan undian…"]);
  await settle();
  assert.deepEqual(shown(card), ["Undian Best Dress dibuka pada 5 Disember, 12.00 tengah hari."]);
  assert.equal(timers.at(-1).ms, 60000, "asks the web app again in a minute");
});

test("the form appears once the web app says voting is open, even on a re-check", async () => {
  const timers = [];
  let open = false;
  const fetch = async () => ({ ok: true, json: async () => ({ open, names: [] }) });
  const { renderVote, card } = loadVote({ fetch, timers });
  renderVote("open");
  await settle();
  open = true;
  timers.at(-1).run();
  await settle();
  assert.deepEqual(shown(card), ["FORM"]);
});

test("a 'not open' answer late in the day closes the card", async () => {
  const fetch = async () => ({ ok: true, json: async () => ({ open: false, names: [] }) });
  const { renderVote, card } = loadVote({ fetch, now: myt(17, 29) });
  renderVote("open");
  await settle();
  assert.deepEqual(shown(card), ["Undian Best Dress sudah ditutup. Pemenang akan diumumkan sebentar lagi."]);
});

test("if the open-check fails the form still shows, and a late answer to an old render is ignored", async () => {
  const fetch = async () => { throw new Error("offline"); };
  const { renderVote, card } = loadVote({ fetch });
  renderVote("open");
  renderVote("closed"); // the 6.00 pm tick lands before the check answers
  await settle();
  assert.deepEqual(shown(card), ["Undian Best Dress sudah ditutup. Pemenang akan diumumkan sebentar lagi."]);

  const again = loadVote({ fetch });
  again.renderVote("open");
  await settle();
  assert.deepEqual(shown(again.card), ["FORM"]);
});

test("names already fetched show at once, and a short complete reply needs no new search", () => {
  const { cachedMatches } = loadVoteHelpers();
  const now = Date.now();
  const cache = new Map([["SIT", { names: ["Siti Aminah", "Siti Nur'aini"], at: now }]]);
  assert.deepEqual(plain(cachedMatches(cache, "SITI N", now)), { names: ["Siti Nur'aini"], complete: true });
  assert.deepEqual(plain(cachedMatches(cache, "AMI", now)), { names: ["Siti Aminah"], complete: false });
  const full = new Map([["AMI", { names: Array.from({ length: 10 }, (_, i) => `Amin ${String.fromCharCode(65 + i)}`), at: now }]]);
  assert.equal(cachedMatches(full, "AMIN", now).complete, false, "a reply of 10 may have left names out");
  assert.equal(cachedMatches(full, "AMI", now).complete, true, "the same query is already answered");
});

test("a saved reply over a minute old still shows its names but asks the web app again", () => {
  const { cachedMatches } = loadVoteHelpers();
  const now = Date.now();
  const cache = new Map([["SIT", { names: ["Siti Aminah"], at: now - 60000 }]]);
  assert.deepEqual(plain(cachedMatches(cache, "SITI", now)), { names: ["Siti Aminah"], complete: false });
  assert.equal(cachedMatches(cache, "SITI", now - 1).complete, true, "a second younger it was still trusted");
});

test("an unpicked name is refused with the tap-in-the-list instruction", () => {
  const { findVoteErrors } = loadVote();
  const errors = findVoteErrors({ lelaki: "", perempuan: "Siti", ic: "900101-08-1234" });
  assert.match(errors.lelaki, /tekan nama itu dalam senarai/);
});

function loadVoteHelpers() {
  const context = { SETTINGS: READY, URLSearchParams, console };
  vm.createContext(context);
  vm.runInContext(`${FORMS_SOURCE}\n${VOTE_SOURCE}\n;globalThis.__h = { cachedMatches };`, context);
  return context.__h;
}

test("each name search asks for its own gender's list", async () => {
  let asked = "";
  const fetch = async (url) => { asked = url; return { ok: true, json: async () => ({ open: true, names: [] }) }; };
  await loadVote({ fetch }).searchNames("siti", "Perempuan");
  assert.equal(asked, `${READY.voteSearchUrl}?q=siti&g=Perempuan`);
});

test("a busy reply from the web app is a failure to retry, not an empty list", async () => {
  const fetch = async () => ({ ok: true, json: async () => ({ open: true, names: [], busy: true }) });
  await assert.rejects(loadVote({ fetch }).searchNames("siti", "Perempuan"), /busy/);
});
