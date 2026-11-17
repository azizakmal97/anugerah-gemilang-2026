# Progress Tracker

**Active phase:** P01
**Last update:** 2026-11-17 (closed; resume at P01 bullet 1)
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

### 🟡 P01 — Google Forms for attendance and feedback

**Status:** in-progress
**Started:** 2026-11-17

**Model:** Sonnet 5.5 · **Effort:** medium

**Plan for this phase:**
- [ ] Attendance form: nama penuh (as on certificate), klinik, emel. Nothing else.
- [ ] Feedback form: short rating + comments, plus emel for the e-sijil.
- [ ] Paste both "Send" links into `SETTINGS` in `app.js`; update tests if behaviour changes.
- [ ] Print QR to the live URL for the registration desk.

**Waiting on owner:**
- Approve the form questions before they go to staff (draft in docs/forms.md).

---

### ⬜ P02 — e-sijil by Apps Script

**Model:** Opus 5.5 · **Effort:** high for the certificate design, Sonnet 5.5 · medium for the script

**Plan for this phase:**
- [ ] Certificate template (Google Slides) in the event look, signature from the sample certificate (kept out of this repo).
- [ ] On feedback submit: fill name, export PDF, email it. Test with the owner's own email first.

**Waiting on owner:**
- Who signs the participant certificate, and confirm the signature image may be used.
