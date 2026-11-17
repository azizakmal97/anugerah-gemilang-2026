# e-sijil only for people who came, by role

Date: 2026-11-17 · Status: agreed (owner choices 2026-11-17: match against attendance only, no approval step, trust the chosen role; later the same day: no email on attendance, match by IC only)
Live test 2026-11-17 19:17: A1 and A3 passed on the live page (sijil arrived for a matched IC; unmatched IC got only the "kehadiran tidak ditemui" email); test rows deleted.
Done-check: PASS 2026-11-17 (P07 re-run. A1, A4, A5, A6, A8 unchanged. A3: first unmatched email still goes, now through handleNotListed e-sijil.gs:214. A7: sijilKinds e-sijil.gs:271, sendSijil :277, tests/sijil-records.test.mjs:56, live: urus setia email with 2 PDFs in the owner's inbox 17 Nov 21:11. A9: isEventTime best-dress.gs:32 used by findAttendee e-sijil.gs:245, attendeeNames best-dress.gs:82, tallyVotes best-dress-results.gs:152 and :168; tests/best-dress.test.mjs:65, tests/best-dress-results.test.mjs:94; form closes by closeAttendanceForm best-dress-results.gs:112, time-based trigger seen on the Triggers page (no automated test: Apps Script trigger). A10: notListedDecision sijil-records.gs:54, claimNotListedEmail :92, tests/sijil-records.test.mjs:102 and :115, live: one email then "Tidak dihantar" row. A11, A12: claimSijil sijil-records.gs:112, tests/sijil-records.test.mjs:68, :76, :86, live: skip logged, replacement email "(dikemas kini)" and both rows in Sijil Dihantar; test rows and keys removed. Nothing from Out of scope built.)

## Stories

### S1 (P1): Only a guest who confirmed attendance gets an e-sijil
Why P1: one shared QR means anyone could fill feedback and get a sijil without coming.

Acceptance:
- A1. Given a guest confirmed attendance with an IC, when they send feedback with the same IC, then their e-sijil arrives as today.
- A2. Removed (owner 2026-11-17: no email on the attendance form, so the match is by IC only). Numbers are kept so A3 onwards do not move.
- A3. Given the IC is not in the attendance answers, when they send feedback, then no sijil is sent, and a short email says their name is not in the attendance list and to contact the urus setia.
- A4. Given the IC is typed with or without dashes on either form, then it still matches.
- A9. Only attendance answers sent on 5 Dec between 12.00 pm and 6.00 pm count, for the e-sijil, the vote and the name search (audit 2026-11-17: the forms are public, so anyone could add themselves from home). The attendance form stops taking answers at 6.00 pm by itself.
- A10. Given the IC is not on the list, the "tidak ditemui" email goes at most once per IC and once per email address, and at most 30 such emails a day, so strangers cannot use up the owner's daily mail quota (about 1,500) that real guests need. Every such answer is listed in a tab "Tiada dalam Senarai" so the urus setia can follow up.
- A8. Given a guest's IC is on the owner's block list (kept in Apps Script settings, never in this repo), when they send feedback, then no sijil and no email are sent.

### S2 (P1): Attendance asks for IC and role
Why P1: the match and the sijil type both come from the attendance answer.

- A5. Given the attendance form, on the page or in Google, then it asks for No. Kad Pengenalan (required, same rule and help as feedback) and Peranan (Peserta or Urus setia, required), and no email.
- A6. Given a guest types an IC on either page form, then the digits get dashes after 6 and 8 digits as they type (871212080879 shows as 871212-08-0879), letters and spaces are dropped, and it stops at 14 characters.

### S3 (P2): Urus setia get their own sijil
Why P2: the peserta sijil already works; the urus setia sijil needs its own design (P05).

- A7. Given the matched attendance answer says Urus setia, then they get two sijil in one email: the peserta one (penyertaan) and the urus setia one (SIJIL PENGHARGAAN, "atas sumbangan sebagai urus setia"). Owner 2026-11-17: "urusetia patut dapat 2 sijil". Peserta gets the peserta sijil only.

### S4 (P1): One set of sijil per guest, fixable when the name was misspelled
Why P1: a guest who sends feedback twice must not collect extra sijil, but a guest who misspelled their name must be able to get a corrected one (owner 2026-11-17).

- A11. Given an IC already got its sijil, when feedback comes again with the same IC and the same name, then nothing new is sent.
- A12. Given an IC already got its sijil, when feedback comes again with the same IC and a different name, then a new sijil with the new name is sent, and the email says it replaces the earlier one. Every sijil sent is listed (time, IC last 4 digits, name, email, role) in a tab "Sijil Dihantar".

## Edge cases
- Guest confirmed attendance twice (two rows): the newest matching row decides the role.
- Feedback sent twice: see A11 and A12.
- Urus setia template not built yet: the script stops with a clear error for that guest, and Google mails the owner the failure, rather than sending the wrong sijil.
- Mail quota out: unchanged from today (error, owner notified).

## Out of scope
- An approval step or a hall code.
- Checking that a guest claiming Urus setia really is one.
- Showing on the page whether a guest is on the attendance list.

## Assumptions
- Attendance answers given before the IC question existed (tests only) are ignored; the test rows were deleted.
- The IC never appears on the page or in this repo; it lives only in the Google response sheet and the guest's own PDF.
- The unmatched email is plain, short and polite; no sijil is attached.
