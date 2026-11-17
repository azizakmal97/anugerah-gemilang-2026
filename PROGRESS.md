# Progress Tracker

**Active phase:** _none_ (⏸ P04 waiting on the owner's live test, A1 and A3)
**Last update:** 2026-11-17, Opus 5.5 · medium (owner override: P05 done, P04 waiting on the owner's live test)
**Last commit:** _none yet_
**Plan reference:** `AUDIT_AND_ROADMAP.md` (if exists) OR project README roadmap section.
**Model strategy:** the global rule `~/.claude/CLAUDE.md` section 1 (without it: `AGENTS.md` → "Model Selection per Task"); this project's overrides in `CLAUDE.md` §22. Every phase below MUST carry an explicit `Model:` and `Effort:` line.

---

## Resume instructions for new Claude sessions

Read this in order on EVERY session start (after CLAUDE.md auto-loads):

1. Read **CLAUDE.md** (auto on session start) — pay attention to §13 resume protocol.
2. Read **THIS file** (`PROGRESS.md`).
3. Run `git log --oneline -20` — see recent commits including `wip:` markers from any dying session.
4. Run `git status` — see if any file is mid-edit (signal of dying-session death).
5. Find the phase marked `🟡 in-progress` below — that's where work continues.
6. Read its "Plan for this phase" sub-section + cross-reference with wip commits + uncommitted files.
7. Decide:
   - Uncommitted changes match the plan → finish in-flight edit, commit it.
   - Uncommitted changes don't match plan → likely garbage, `git checkout -- <file>` to discard.
   - No uncommitted changes → continue from next bullet in plan.
8. Run phase verification (`typecheck + build + test`) before doing more work.
9. Resume per the plan.

---

## Per-edit discipline (the only way to survive token-limit death)

**Assume the session can die after ANY tool call.** Every edit gets its own commit immediately. Never batch.

```
# Per-edit pattern:
1. Edit/Write ONE focused change.
2. Run: typecheck && build (verify compiles).
3. Run: git add <file> && git commit -m "wip(phase-id): brief desc".
```

At phase end:
1. Run all verification (typecheck + build + test).
2. Edit this file → mark phase `done` + summary + commit hash.
3. Commit: `done(phase-id): summary`.

If session dies mid-phase, NO MARK as done. Next session picks up exactly where stopped.

---

## Three-layer death defense (proactive, not reactive)

When the Claude session hits the token / usage limit, it **dies without warning** — no exit message, no closing commit, no summary. Whatever was about to happen in the next tool call simply does not happen. Defense must be proactive — assume death is possible after ANY tool call.

### Layer 1 — Intent on disk BEFORE action

At the START of every phase (not the end), the FIRST two tool calls are:

1. Edit this file → mark phase `🟡 in-progress` AND write its "Plan for this phase" block (explicit list of edits to make).
2. `git add PROGRESS.md && git commit -m "wip(<phase-id>): starting <brief>"`

If the session dies after step 2, the next session reads this file and sees both "what I was about to do" and a clean git state.

### Layer 2 — Commit + push after EVERY small edit (not at end of phase)

Each tool-call edit is its own checkpoint:

```bash
# Per-edit pattern (every meaningful change):
1. Edit one focused file/region.
2. typecheck && build   # verify still compiles
3. git add <file> && git commit -m "wip(<phase-id>): <brief>"
   # post-commit-push.js hook auto-pushes to remote.
```

Worst case if session dies mid-edit = ONE file half-modified. `git status` shows it. Next session reads the plan → either finishes that one edit or `git checkout -- <file>` and retries. `wip:` prefix makes it clear which commits are intermediate; squashing with `git rebase -i` at phase end is optional.

**Push is non-negotiable.** Local-only commits die with the disk. Remote push survives machine swap. The `post-commit-push.js` hook auto-runs after every successful commit. If push fails (offline / no remote / auth), commit stays local and the next successful push catches up — but be aware: if both disk AND offline window coincide, work IS lost. Configure a remote on day 1.

### Layer 3 — Phase completion is a SEPARATE final action

```bash
# Phase-completion sequence:
0. If the phase has a spec: run `/done-check`. Only `DONE-CHECK: PASS` continues.
1. Run all verification (typecheck && build && test).
2. Edit this file → mark phase ✅ done + summary + last commit hash.
3. git add PROGRESS.md && git commit -m "done(<phase-id>): <summary>"
   # auto-pushed by post-commit-push.js hook
```

If the session dies BEFORE step 2, the phase stays `in-progress`. Next session reads the wip commits + runs verification → decides if work is actually complete and marks done.

### Anti-patterns to avoid

| Don't | Do |
|---|---|
| "I'll commit at the end of the phase" | Commit after every edit |
| "Let me make all the edits, then run tests" | Run typecheck + build after each edit, before commit |
| "I'll update the progress file when done" | Update progress file FIRST, commit it, THEN do work |
| Squash commits as you go (slow + risky) | Leave `wip:` commits, squash at phase end if time permits |
| Trust that "the AI will know to clean up" | Assume session dies after every tool call; plan accordingly |

### Optional safety net — auto-checkpoint cron

Belt+suspenders mode for the paranoid: a 5-minute cron / GitHub Actions workflow during active refactor windows:

```bash
# scripts/auto-checkpoint.sh
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -m "auto-checkpoint: $(date -Iseconds)" --no-verify
fi
```

Trade-off: commits broken intermediate states. Easy to `git reset` later. Use only if the `wip:` commit discipline isn't enough on its own.

---

## What lives where

| File | Purpose | Updated when |
|---|---|---|
| `CLAUDE.md` | AI agent root instructions. §13 = session-start protocol. | Once, at start of project |
| `PROGRESS.md` | Live state of all phases | After every phase status change |
| `AUDIT_AND_ROADMAP.md` (if exists) | Full plan — referenced by progress tracker | Rarely (only on plan revisions) |
| `audit-history/` (optional) | Frozen records of closed audits (e.g. `audit-history/2026-05-10-security.md`) | Never edit after closing |
| `specs/<slug>.md` | WHAT one feature must do and how we know it's done | When the feature is agreed; `/done-check` reads it |
| `git log` | Commit hashes per phase | Every commit |

### Audit-history convention

When an audit is fully closed (all findings resolved), move it to `audit-history/YYYY-MM-DD-<scope>.md`. Frozen — never edit after move. New audits start fresh from `AUDIT_AND_ROADMAP.template.md`. Keeps history queryable without polluting active plan.

---

## Stopping criteria (when it's safe to pause)

Acceptable pauses:
- End of any phase (clean break, all tests green).
- End of any week.

Do NOT pause:
- Mid-phase (commit + resume notes first).
- Mid-migration (always finish + verify a migration in one session).

---

## Owner check-in cadence (non-coder friendly)

Every Friday:
1. Read week's `PROGRESS.md` updates. Do every `Waiting on owner` step first: the AI cannot do them for you, and work that depends on them stays parked until you do.
2. Click through the live app — does anything feel different?
3. Run `npm test` (or preset equivalent) locally — all green?
4. Check latest commits — anything surprising?
5. If anything unclear, ask the AI to explain in plain English (reference `docs/HANDOVER.md` glossary).

---

## Phase Status Legend

- ⬜ pending
- 🟡 in-progress
- ✅ done
- ⛔ blocked
- ⏭️ skipped
- ⏸ waiting for a different model; `/autonomous` resumes it when a session on that model runs

---

## Phase Log

> Add phases below as work proceeds. One block per phase.

### ⬜ EXAMPLE-P00 — Example phase title

**Status:** pending
**Started:** _YYYY-MM-DD_
**Completed:** _YYYY-MM-DD_
**Commits:** _hash → hash_
**Spec:** _specs/<slug>.md, or none_
**Model:** _Sonnet | Opus | Haiku | DeepSeek Pro | DeepSeek Flash | Gemini Pro | Gemini Flash — see `~/.claude/CLAUDE.md` section 1_
**Effort:** _low | medium | high_

**Plan for this phase:**
- [ ] Edit file A *(Model: ...)*
- [ ] Add file B *(Model: ...)*
- [ ] Test C *(Model: ...)*

**Delivered:**
- _list what shipped_

**Safeguards added (plain words):**
- _e.g. "If someone double-clicks Pay, they are charged once." See `.claude/rules/production-readiness.md`_

**Waiting on owner:**
- _steps only you can do (account settings, decisions), click by click. Empty = nothing_

**Verified:**
- _typecheck / build / test outputs_

**Rollback:**
- _how to undo if needed_


### ✅ INIT-P00 — Project bootstrap

**Model:** Opus 5.5 · **Effort:** medium (owner choice)
**Status:** done
**Started:** 2026-11-17
**Completed:** 2026-11-17

**Delivered:**
- Batik event page live on GitHub Pages, three clock modes, official logos.
- Template applied and adapted to a static site: node:test tests, check-site build, file budgets, CLAUDE.md.
- antislop checker now reads linked local stylesheets (was reporting every class as undefined); same fix pushed to vibe-coding-template (1622c58).
- Plan confirmed by owner: one QR. Before: countdown. 5 Dec 12 pm: big "Sahkan Kehadiran" button, tentatif, hotel map. After 6 pm: "Isi maklum balas dan dapatkan sijil".
- Official tentatif (AJK Protokol) added as a schedule section.

**Safeguards added (plain words):**
- If a Google Form link is missing, the button says so instead of going nowhere (no dead links).
- Phones can no longer be pushed sideways by the spinning medallion (viewport overflow).

**Verified:**
- `npm run lint`, `npm test` (7 pass), `npm run build`, `check-file-sizes` all green.
- Mobile 375 px: page width equals screen width, 16 px gutters both sides.

---

### ✅ P01 — Google Forms for attendance and feedback

**Status:** done
**Completed:** 2026-11-17
**Started:** 2026-11-17

**Model:** Sonnet 5.5 · **Effort:** medium

**Plan for this phase:**
- [x] Attendance form: nama penuh (as on certificate), klinik, emel. Nothing else.
- [x] Feedback form: short rating + comments, plus emel for the e-sijil.
- [x] Paste both "Send" links into `SETTINGS` in `app.js`; test now sets an empty link itself.
- [x] Print QR to the live URL for the registration desk: A4 poster in the batik theme, built by `print/make_qr_poster.py` into `hi-tea/qr/` (PNG 300 dpi + PDF), scan-checked at five sizes.

**Delivered so far:**
- Both forms built 2026-11-17 by `scripts/create-forms.gs` on azizakmal@moh.gov.my (Apps Script project "Untitled project"), saved in Drive folder PKPD BP/hi-tea with one response sheet "Anugerah Gemilang 2026 - Respons".
- Both forms open without sign-in (checked logged-out with curl).
- QR gotcha: rounded finder eyes or small round dots stop OpenCV reading the code; the poster keeps square eyes and 92% dots.

**Waiting on owner:**
- (done 2026-11-17) Approve the form questions: approved, clinic list added.
- (done 2026-11-17) Allow the Apps Script permissions.
- Gemini proofread of the form copy is still owed (quota ran out 2026-11-17).

---

### ✅ P02 — e-sijil by Apps Script

**Status:** done
**Completed:** 2026-11-17
**Started:** 2026-11-17
**Model:** Opus 5.5 · **Effort:** high for the certificate design, Sonnet 5.5 · medium for the script

**Plan for this phase:**
- [x] Certificate background (A4 portrait, batik theme, signature) built by `print/make_sijil.py` into `hi-tea/sijil/sijil-latar-A4.png` (Model: Opus 5.5 · high). Sample with a name: `hi-tea/sijil/_sijil-contoh-nama.png`.
- [x] (b254f61, run 2026-11-17) Add a required "No. Kad Pengenalan" short-answer question to the feedback form (after Nama penuh; validation regex `^\d{6}-?\d{2}-?\d{4}$`; help text: "Untuk dicetak pada sijil. Contoh: 900101-08-1234") through Apps Script on the existing form, and add it to `docs/forms.md`. The IC appears only on that guest's own PDF and in the response sheet, never on the site (Model: Sonnet 5.5 · medium).
- [x] (daf6775 + 519b733 `scripts/e-sijil.gs`, set up 2026-11-17) Apps Script: A4 Slides template with the background and a name box; on feedback submit fill the name, export PDF, email it; check the mail quota first (Model: Sonnet 5.5 · medium).
- [x] Test with the owner's own email first (Model: Sonnet 5.5 · low). Second test PDF checked: A4, name and IC placed right, email text flows on phones.

**Setup done (2026-11-17):** all four scripts ran in Apps Script "Untitled project" (azizakmal@moh.gov.my, Claude in Chrome /u/1); feedback trigger installed. Template "Templat e-Sijil Anugerah Gemilang 2026" is in PKPD BP/hi-tea, page set to A4 by hand (the Slides API ignores pageSize).

**Original spec:** Name box for the script: on an A4 portrait slide (595.28 x 841.89 pt) put the name text box at left 67.5 pt, top 279 pt, width 460 pt, height 57 pt, Cinzel bold, gold-light #f2d796 (dark-mode certificate, owner 2026-11-17), centred both ways, text = the guest's name in capitals; shrink the font from 22.5 pt for long names so it stays on one line. IC (owner 2026-11-17, "letak IC sekali"): a second text box at left 67.5 pt, top 334.5 pt, width 460 pt, height 19.5 pt, Source Sans 3 11.25 pt, #d9cfb8, centred, text "No. K/P: 000000-00-0000" (digits normalised to that dash format). Background = `hi-tea/sijil/sijil-latar-A4.png` uploaded to the Drive folder PKPD BP/hi-tea (it is NOT in this repo). Forms and the response sheet are on azizakmal@moh.gov.my; the Apps Script project that built them is "Untitled project" there. Mail quota: about 1,500 a day on that work account; read `MailApp.getRemainingDailyQuota()` before sending.

**Waiting on owner:**
- Gemini proofread of the e-sijil email and IC help text is owed (quota out until about 2026-11-23).
- (done 2026-11-17) Signer: Dr. Mohamad Noor bin Sairi, Pegawai Pergigian Daerah. Owner confirmed he agreed to his signature from `hi-tea/contoh sijil.jpeg` being used. The signature file stays in `hi-tea/sijil/`, never in this repo.

---

### ✅ P03 — Forms inside the site, in the batik design

**Status:** done
**Completed:** 2026-11-17
**Started:** 2026-11-17
**Spec:** specs/in-site-forms.md

**Model:** Opus 5.5 · **Effort:** medium (design on a settled look), Sonnet 5.5 · medium for the tests
**Owner choice (2026-11-17):** guests fill attendance and feedback ON the website, styled like the page, not in a Google tab. Answers must still land in the same Google Forms response sheet, so the e-sijil script is unchanged.

**Plan for this phase:**
- [x] Read each form's `entry.<id>` field ids (Apps Script `form.getItems()` ids, or the form's prefilled link) and the `formResponse` URL; put them in `SETTINGS` in `app.js` (Model: Sonnet 5.5 · low).
- [x] Attendance form on the page during `hadir`: nama penuh, klinik dropdown (7 clinics), emel; feedback form during `selepas`: three 1–5 ratings, comments, nama penuh, No. K/P, emel. Same labels and help text as `docs/forms.md` (Model: Opus 5.5 · medium).
- [x] Submit with `fetch(..., { method: "POST", mode: "no-cors" })` to `formResponse`; the response is unreadable, so validate on the page first (required fields, email, IC `^\d{6}-?\d{2}-?\d{4}$`), disable the button while sending, then show the thank-you text from the form. On a network error show a clear retry message and a link to the Google Form as the fallback (Model: Opus 5.5 · medium).
- [x] Tests in `tests/app.test.mjs`: validation rules, mode decides which form shows, button disabled while sending (Model: Sonnet 5.5 · medium).
- [x] Check at 375 px and desktop, then send one real test answer and see it in the response sheet (Model: Sonnet 5.5 · low).

**Depends on:** P02 bullet "Add No. Kad Pengenalan question" (the IC field id must exist first).

**Delivered:** `forms.js` + `forms.css`; the action card shows the attendance form 12 pm to 6 pm on 5 Dec and the feedback form after. Real test from the page: both rows reached the response sheet and the e-sijil email arrived. DONE-CHECK: PASS (A1 to A7). Gate: `anti-slop/gates/2026-11-17-in-site-forms.md`. Attendance help text no longer mentions the sijil (owner: the sijil name comes from the feedback form), on the page and in the Google Form.

**Waiting on owner:**
- (done 2026-11-17) Claude deleted the two UJIAN LAMAN test rows. Delete any rows from your own manual test before 5 Dec.

**Safeguards added (plain words):**
- If a guest double-taps Hantar, only one answer is sent (button disabled while sending).
- If the phone has no signal, the guest is told and nothing looks "sent" when it was not.

---

### ⏸ P04 — e-sijil only for people who really came

**Status:** waiting on owner: end-to-end test on the live page (A1, A3)
**Started:** 2026-11-17
**Spec:** specs/attendee-only-sijil.md
**Model:** Sonnet 5.5 · **Effort:** medium (Apps Script + site), Opus 5.5 · medium for any copy
**Why (owner 2026-11-17):** a shared QR would let someone who did not come fill feedback and get a sijil.
**Owner choice (2026-11-17): A only** (a hall code can be passed on too). Send the sijil only when the feedback email or IC is also in the attendance tab. No approval step (owner 2026-11-17: "I don't have time to approve, just trust them"): an unmatched answer gets no sijil, only a short email saying their name is not in the attendance list and to contact the urus setia.
**Also (owner 2026-11-17): separate sijil for peserta and urusetia.** Decided (owner 2026-11-17: "just make a choice", then "just trust them"): a required "Peranan" choice (Peserta / Urus setia) on the attendance form, trusted as given. Whoever is in the attendance tab gets the sijil for the role they chose there, sent automatically. Urus setia sijil: SIJIL PENGHARGAAN, "atas sumbangan sebagai urus setia", own background.

**Plan for this phase:**
- [x] Spec with the owner's choice, `specs/attendee-only-sijil.md` (Model: Opus 5.5 · medium)
- [x] IC auto-format while typing on both forms: digits only, dashes added after 6 and 8 digits (871212080879 → 871212-08-0879), max 14 characters; test in `tests/forms.test.mjs` (Model: Sonnet 5.5 · medium, tiny, run here)
- [x] `scripts/create-forms.gs`: one-off `addAttendanceQuestions` adds required "No. Kad Pengenalan" (same rule as feedback) and "Peranan" (Peserta / Urus setia) to the attendance form, safe to run twice; update `docs/forms.md` (Model: Sonnet 5.5 · medium)
- [x] `scripts/e-sijil.gs`: in `onFeedbackSubmit`, look up the attendance answers (IC digits first, email as fallback); matched → sijil for the role chosen there; unmatched → short "tiada dalam senarai kehadiran" email, no sijil (Model: Sonnet 5.5 · medium; email copy Opus 5.5 · medium)
- [x] (run 2026-11-17; entry ids IC 718418112, Peranan 75149903) Run `addAttendanceQuestions` in Apps Script (Claude in Chrome, /u/1), read the two new entry ids, add both fields to `FORMS.attendance` in `forms.js` + tests (Model: Sonnet 5.5 · low)
- [x] (76d2e00 → 2573d52, run 2026-11-17) Owner 2026-11-17: no email on attendance. Emel dropped from `forms.js`, `buildAttendanceForm`, `docs/forms.md`; `removeAttendanceEmail` run in Apps Script; `findAttendee` matches IC digits only; spec A2 removed (Model: Opus 5.5 · medium, owner override)
- [x] A7: urus setia template built from the P05 background, A4 by hand, fitted; `sendTestUrusetia` PDF checked (Model: Opus 5.5 · medium, owner override)
- [x] (e396d8f, run 2026-11-17) A8: owner block list added. `onFeedbackSubmit` skips any IC listed in the Script property `BLOCKED_ICS` (no sijil, no email). The list lives only in Apps Script settings, never in this repo. Dry run in Apps Script: listed IC true, other IC false; temporary function removed (Model: Opus 5.5 · low)
- [ ] A1, A3: owner test on the live page: confirm attendance with IC (`?mod=hadir`), send feedback with the same IC (`?mod=selepas`), sijil arrives; feedback with an unknown IC gets the "tiada dalam senarai kehadiran" email. Delete the test rows after (Model: Sonnet 5.5 · low)

**Resume note (2026-11-17, later):** code, live site, Apps Script and both templates are done; attendance has no email, matching is by IC only. Only the owner's live test (A1, A3) is left, then re-run /done-check and mark P04 done.
Incident 2026-11-17: a mis-picked function ran `createForms` and made duplicate forms + sheet; all three trashed (Drive trash, created 13:18), live forms untouched. Finders now skip trashed files.

**Safeguards added (plain words):**
- Someone who fills feedback without confirming attendance gets no sijil, only a polite email to contact the urus setia.
- A guest is matched by IC digits only, typed with or without dashes (owner 2026-11-17 dropped the email question, so a wrong IC now means no sijil and the polite email).
- If the urus setia template is missing, the script stops and Google emails the owner, instead of sending the wrong sijil.
- Someone on the owner's block list gets no sijil and no email; their IC is kept in Apps Script settings only, so it never appears in this public repo.

**Waiting on owner:**
- Test A1 and A3 on the live page (links in the bullet above), then tell Claude the result.
- Gemini proofread owed for the new Malay lines (attendance IC help, urus setia email, "tiada dalam senarai" email, now "No. Kad Pengenalan anda tidak ditemui"); quota out until about 2026-11-23.

### ✅ P05 — Redesign the e-sijil in real batik (peserta + urus setia)

**Status:** done
**Started:** 2026-11-17
**Completed:** 2026-11-17
**Commits:** 3f7ad21 → 1e0d647
**Model:** Opus 5.5 · **Effort:** medium (owner override: owner said "guna medium", 2026-11-17, for the new look normally tagged high)
**Owner 2026-11-17:** the script line "Nusantara Batik" under the venue looks hanging and odd, AND the whole sijil "doesn't look like batik theme". So this is a redesign, not a nudge. Two versions: peserta and urus setia.

**Plan:**
- [x] Redesign `print/make_sijil.py` + `print/sijil.template.html`: sogan parang cloth frame, pucuk rebung rows top and bottom, kawung field, kawung knots at the corners, a dark name plate edged in rebung, one parang band above the signature. Motifs are the website's own tiles. "Nusantara Batik" line removed: the cloth carries the theme. Name box (top 279 pt, h 57) and IC box (top 334.5 pt) unchanged (Model: Opus 5.5 · medium, owner override)
- [x] Urus setia version `sijil-urusetia-latar-A4.png`: SIJIL PENGHARGAAN, "Setinggi-tinggi penghargaan kepada", "atas sumbangan sebagai urus setia" (Model: Opus 5.5 · medium, owner override)
- [x] Both PNGs in `hi-tea/sijil/` and `hi-tea/` (Drive). Apps Script: code pasted at 1e0d647, `removeAttendanceEmail`, `refreshBackground` (new: swaps the peserta image in place, then fits), `setupUrusetiaTemplate`, A4 by hand, `fitUrusetiaTemplate`, `sendTestSijil`, `sendTestUrusetia`. Both PDFs checked in Gmail: A4, new batik, name and IC inside the plate (Model: Opus 5.5 · medium, owner override)

**Colour rework (owner 2026-11-17: colours not attractive, "especially the brown", wants gradients, then "gold and navy didn't match"):** sijil colours are now options in `THEMES` (`print/make_sijil.py --options` renders one small sample each). Owner picked **A, `emas-nila`**: gold frame flowing into navy, navy batik lines on the gold, gold glow on the navy field. Both PNGs re-rendered, `refreshBackground` + new `refreshUrusetiaBackground` run, `sendTestSijil` + `sendTestUrusetia` PDFs checked in Gmail (Model: Opus 5.5 · medium, owner override).

**Long names (owner 2026-11-17: "make sure kalau nama dia panjang still boleh muat"):** `nameFontSize` now fits the name into 380 pt between the kawung knots (Cinzel bold measured at 0.58 to 0.71 per letter; rule uses 0.75). Then (owner: "kenapa tak jadi 2 baris?") names that would print under 17 pt go on two lines at up to 16 pt, broken before BIN / BINTI / A/L / A/P (else nearest the middle). `sendTestLongName` (49 letters) PDF checked: two lines at 16 pt, clear of both knots and the IC. Build now also parses both `.gs` files (a broken `
` escape had blocked the Apps Script save).
Incident 2026-11-17 14:03: a mis-click hit Debug and ran `createForms` for 11 s; it made a Kehadiran form, Maklum Balas form and Respons sheet in My Drive root. All three moved to the Bin; the real ones in hi-tea untouched.

**Delivered:** urus setia template "Templat e-Sijil Urus Setia Anugerah Gemilang 2026" in PKPD BP/hi-tea. Previews: `hi-tea/sijil/_sijil-latar-A4-contoh-nama.png`, `_sijil-urusetia-latar-A4-contoh-nama.png`.

**Waiting on owner:**
- Look at the two test sijil in your inbox. Say if you want any change.
- Gemini proofread owed for "Setinggi-tinggi penghargaan kepada" and "atas sumbangan sebagai urus setia" (quota out until about 2026-11-23).
- Old previews in `hi-tea/sijil/` (`_sijil-contoh-nama.png`, `_pilihan-*.png`) are only for choosing; delete them if you like (Claude's recycle script cannot reach J:).

**Verified:** lint, 18 tests, build, file sizes green; full-size crops of frame, plate and band checked; both emailed PDFs viewed.
