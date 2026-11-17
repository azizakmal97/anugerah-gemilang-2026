# Every tab of the committee sheet in the event look

Date: 2026-11-17 · Status: agreed (owner 2026-11-17: "boleh tak hias/design lawa2 setiap sheet lain yang ada")
Done-check: PASS 2026-11-17 (A1: styleCommitteeSheet sijil-records.gs:155, styleDataTab :168 (navy header in gold bold, frozen row, tab gold, cream banding), dataColumnWidth :199 with tests/sijil-records.test.mjs:123; run live on Kehadiran, Maklum Balas, Tiada dalam Senarai, Sijil Dihantar. A2: banding on whole columns with no end row :177; rows added after styling (test rows) came in banded. Form-added rows not seen live yet (no attendance before 5 Dec). A3: formatting calls only, no setValue on form tabs. A4: run twice live without error. Rows stay cream with dark text on purpose, so a row the form adds stays readable. Look to be judged by the owner from the screenshot.)
Done-check: 4 GAPS 2026-11-17 (A1 to A4 not built yet; covered by the "Sheet look" bullet of P07 in PROGRESS.md, which a separate session is running now. The only styled tab today is "Keputusan Best Dress", scripts/best-dress-results.gs styleResults.)

## Stories

### S1 (P2): The committee opens a sheet that matches the event
Why P2: the results tab already has the navy and gold look; the other tabs are plain Google grey.

Acceptance:
- A1. Given the sheet "Anugerah Gemilang 2026 - Respons", then the tabs Kehadiran, Maklum Balas and the new tabs (Tiada dalam Senarai, Sijil Dihantar) use the same navy and gold as "Keputusan Best Dress": a navy header row in gold bold, the header frozen, readable column widths, soft row banding, the tab colour gold.
- A2. New answers keep landing in the right tabs and keep the look (Google adds form rows below the header).
- A3. No answer is changed, moved or deleted by the styling.
- A4. The styling can be run again safely (one function in Apps Script).

## Out of scope
- Charts or summaries of the feedback scores.
- "Sheet1", which no script uses (the owner may delete it).
