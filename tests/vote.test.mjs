// Tests for vote.js: when the vote card is ready, what counts as a vote, what is sent to
// Google, and that a name-search reply can only ever bring back a short list of strings.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const FORMS_SOURCE = readFileSync(new URL("../forms.js", import.meta.url), "utf8");
const VOTE_SOURCE = readFileSync(new URL("../vote.js", import.meta.url), "utf8");
const READY = { voteFormUrl: "https://docs.google.com/forms/d/e/VOTE/viewform", voteSearchUrl: "https://script.google.com/macros/s/X/exec" };

function loadVote({ settings = READY, entries = ["11", "22", "33"], fetch = async () => ({}) } = {}) {
  const context = { SETTINGS: settings, URLSearchParams, AbortController, setTimeout, clearTimeout, console: { error() {} }, fetch };
  vm.createContext(context);
  // `const` declarations stay in the script scope, so expose what the tests need.
  vm.runInContext(
    `${FORMS_SOURCE}\n${VOTE_SOURCE}\n;VOTE.fields.forEach((field, i) => { field.entry = ${JSON.stringify(entries)}[i]; });
    globalThis.__vote = { isVoteReady, countLetters, findVoteErrors, toVoteBody, searchNames };`,
    context,
  );
  return context.__vote;
}

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
  assert.equal(errors.lelaki, "Pilih satu nama daripada senarai.");
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
