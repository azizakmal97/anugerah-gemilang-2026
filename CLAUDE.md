# Anugerah Gemilang 2026: Event Page (static site)

> Preset: **web**, adapted. No framework, no build step: plain HTML, CSS and browser JS.
> Keep this file under 300 lines.

## 1. What This Is

One-page site for Majlis Anugerah Gemilang dan Apresiasi Budi, PKPD Batang Padang, 5 Dec 2026,
Hotel Grand Kampar. About 125 dental staff open it on their phones from one QR code to confirm
attendance on the day and to send feedback (and get an e-certificate) afterwards.
Owner: Dr Aziz (OMFS unit), who runs attendance, certificates and feedback for the event.

## 2. Stack

| Layer | Choice |
|---|---|
| Markup | `index.html`, one page, Malay copy |
| Styling | `style.css`, CSS custom properties, no framework |
| Logic | `app.js`: page mode by clock (countdown, attendance, feedback). `forms.js`: the in-page forms, posted to Google Forms |
| Motion | `effects.js`: curtain, medallion, gold dust, scroll-linked details. Decoration only |
| Data | None stored here. The page posts answers straight to the Google Forms (links in `SETTINGS`, field ids in `forms.js`); nothing is kept in the browser |
| Testing | `node:test` characterization tests in `tests/` (app.js runs in a vm with a fake DOM) |
| Auth | None. Public page, no personal data on it |
| Deployment | GitHub Pages from `main`, root folder. Push = live in about a minute |
| Live URL | https://azizakmal97.github.io/anugerah-gemilang-2026/ |

## 3. Commands

```bash
npm run dev        # python static server on http://localhost:8765
npm run lint       # node --check on both scripts + antislop checker on index.html, style.css
npm run typecheck  # no TypeScript; prints a note (CI expects the script)
npm test           # node:test, tests/*.test.mjs
npm run build      # scripts/check-site.mjs: every local file the page links exists, scripts parse
```

No dependencies. `package-lock.json` exists only because CI runs `npm ci`.

## 4. Conventions

- Plain browser JS, classic scripts, no modules, no bundler. Globals live in `app.js`, `forms.js`, `remembered-ic.js`
  and `vote.js` only (that load order; `app.js` calls `renderForm` and `renderVote`).
- The attendance IC is kept in the phone's browser by `remembered-ic.js` (spec `specs/remembered-ic.md`, owner
  2026-11-17) so the vote and feedback start filled. The page shows only its last 4 digits.
- `app.js` = behaviour that matters (tested). `effects.js` = motion; the page must work if it fails.
- Every motion respects `prefers-reduced-motion`.
- Malay copy: never a comma before "dan", "atau", "serta", "untuk", "oleh". No em dash.
- Colours only through the tokens in `:root` of `style.css` (see §6).
- Times are Malaysia time (UTC+8) written as `Date.UTC(...)` with the hour minus 8.

## 5. Testing

- Change page modes? Update `tests/app.test.mjs` first. Change a form rule? `tests/forms.test.mjs`.
- Visual changes: open it at 375 px and at desktop width before calling it done, and check
  `document.documentElement.scrollWidth === innerWidth` on mobile (see §10).
- Preview a mode without waiting for the clock: `?mod=sebelum`, `?mod=hadir`, `?mod=selepas`.

## 6. Design System

Direction comes from the event poster: night navy, batik gold, sogan brown. Dark only, by the
owner's choice. Fonts: Cinzel (titles, matches the poster), Great Vibes (script lines),
Source Sans 3 (body, readable on cheap phones). Motifs: kawung, pucuk rebung, parang.
Tokens and reasons: `.claude/skills/design-system/SKILL.md`.

## 7. Architecture Decisions

- Static GitHub Pages, not Google Sites: Sites cannot run custom animation.
- One QR for the whole event: the page switches by clock, so the printed QR never changes.
- Forms stay in Google Forms: responses land in Google Sheets the committee already uses,
  and no personal data passes through this repo.
- The medallion's endless spin is an owner request (animated batik hero), waived for R-19 in
  `style.css` with the reason on the line.

## 8. Git Rules

- Fix mistakes with `git revert`, not `git reset + force push`.
- Never force push unless explicitly asked.
- Never amend an already-pushed commit.
- Every push to `main` goes live. Check the page after pushing.

## 9. Off Limits

- Never commit the meeting minutes, the sample certificate or any signature image. They live
  one folder up (`hi-tea/`), outside this public repo, and must stay there.
- Never put the attendance list or any name list on the page.
  One exception (owner 2026-11-17): the Best Dress vote may show matching names after 3 typed
  letters, fetched live from Google while voting is open. Never a full list, never in this repo.

## 10. Current Focus / Known Issues

- Both Google Forms exist (owner azizakmal@moh.gov.my, Drive folder PKPD BP/hi-tea, built by
  `scripts/create-forms.gs`) and their links are in `SETTINGS` (`app.js`). An empty link makes
  the form area read "Pautan borang belum disediakan".
- Gotcha: a form question added or changed in Google gets a new `entry` id. Re-read the ids from
  the form's public page (`FB_PUBLIC_LOAD_DATA_`) into `FORMS` in `forms.js`, or answers vanish:
  the send is `no-cors`, so Google's refusal is invisible to the page.
- Gotcha: anything wider than the screen (the medallion is 120%+ of a phone) makes phones widen
  the layout viewport and the whole page looks off-centre. `overflow-x: hidden` on `body` is not
  enough; `html`, `body` and `.hero` use `overflow-x: clip`.
- Gotcha: the in-app browser pane, when hidden, returns stale screenshots. Measure with JS.
- FORMS FROZEN from 2026-11-27 to the end of the event (owner): no question added, removed or
  renamed in any of the three Google Forms. A required question the page does not send makes every
  check-in vanish while the page still says "Terima kasih". Event-day checklist: `docs/event-day.md`.
- The Apps Script project lives on the WORK account azizakmal@moh.gov.my (Chrome profile
  xzizakmal97, `/u/1/`), not on xzizakmal97. Load test 2026-11-27: 30 searches at once all failed
  while each search reread the attendance form; the name list is now built per check-in.

---

## 11. Forbidden Patterns

- `.catch(() => {})` or an empty `catch` with no reason comment.
- Hardcoded secrets. There should be none: this site has no keys.
- `innerHTML` with any text that did not come from this repo.
- `eval()` / `Function(...)`.

## 12. File-Size Budgets

See `file-budgets.json`. Hard breach: extract first.

## 13. Session-Start Resume Protocol

See `PROGRESS.md`. If a `🟡 in-progress` phase exists, run `/resume` before any other action.

| File | Role |
|---|---|
| `CLAUDE.md` | Root AI instructions |
| `PROGRESS.md` | Live phase state |
| `git log` | Commit hashes per phase |

## 16. Communication Style

The owner writes in Malay. Reply in short, plain Malay. Lead with the answer.

## 17. Graph-First Exploration

If `graphify-out/GRAPH_REPORT.md` exists, read it first. Five source files today, so no graph yet.

## 18. Test-Before-Commit Gate

```bash
npm run lint && npm test && npm run build && node scripts/check-file-sizes.mjs
```

All green or no commit.

## 21. Document Roles

| File | Role |
|---|---|
| `PROGRESS.md` | WHERE + HOW |
| `docs/HANDOVER.md` | Non-coder owner doc (fill with `/handover`) |
| `git log` | Commit hashes per phase |

## 22. Model Overrides

None. The global rule in `~/.claude/CLAUDE.md` section 1 applies. Design work on this page
runs on Opus (owner rule); the owner chose Opus medium for this site.
