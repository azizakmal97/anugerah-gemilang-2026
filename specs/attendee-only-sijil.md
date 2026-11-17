# e-sijil only for people who came, by role

Date: 2026-11-17 · Status: agreed (owner choices 2026-11-17: match against attendance only, no approval step, trust the chosen role; later the same day: no email on attendance, match by IC only)
Done-check: 2 GAPS 2026-11-17 (A1, A3 not yet tested end to end on the live page; A2 removed; A7 met, both test sijil sent; re-checked after the sijil colour options incl. the gold theme option, which touch no spec item; same after the final gold-to-navy colours)

## Stories

### S1 (P1): Only a guest who confirmed attendance gets an e-sijil
Why P1: one shared QR means anyone could fill feedback and get a sijil without coming.

Acceptance:
- A1. Given a guest confirmed attendance with an IC, when they send feedback with the same IC, then their e-sijil arrives as today.
- A2. Removed (owner 2026-11-17: no email on the attendance form, so the match is by IC only). Numbers are kept so A3 onwards do not move.
- A3. Given the IC is not in the attendance answers, when they send feedback, then no sijil is sent, and a short email says their name is not in the attendance list and to contact the urus setia.
- A4. Given the IC is typed with or without dashes on either form, then it still matches.

### S2 (P1): Attendance asks for IC and role
Why P1: the match and the sijil type both come from the attendance answer.

- A5. Given the attendance form, on the page or in Google, then it asks for No. Kad Pengenalan (required, same rule and help as feedback) and Peranan (Peserta or Urus setia, required), and no email.
- A6. Given a guest types an IC on either page form, then the digits get dashes after 6 and 8 digits as they type (871212080879 shows as 871212-08-0879), letters and spaces are dropped, and it stops at 14 characters.

### S3 (P2): Urus setia get their own sijil
Why P2: the peserta sijil already works; the urus setia sijil needs its own design (P05).

- A7. Given the matched attendance answer says Urus setia, then the sijil sent is the urus setia one (SIJIL PENGHARGAAN, "atas sumbangan sebagai urus setia"); Peserta gets the peserta sijil.

## Edge cases
- Guest confirmed attendance twice (two rows): the newest matching row decides the role.
- Feedback sent twice: two emails, as today. No dedup.
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
