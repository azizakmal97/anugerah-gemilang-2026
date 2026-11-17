# Forms inside the event page

Date: 2026-11-17 · Status: agreed (owner choice 2026-11-17: guests fill the forms on the page, in the batik look)

## Stories

### S1 (P1): A guest confirms attendance on the page during the event
Why P1: the attendance list is the reason the QR exists.

Acceptance:
- A1. Given the page is in attendance mode, when a guest opens it, then an attendance form shows on the page with Nama penuh, Klinik atau unit (the 7 clinics) and Emel, using the same labels and help text as the Google Form.
- A2. Given a filled attendance form, when the guest presses Hantar, then the answer lands as a new row in the same response sheet the Google Form fills.
- A3. Given the answer was sent, then the form is replaced by the Google Form's own thank-you text.

### S2 (P1): A guest sends feedback and gets the e-sijil
Why P1: feedback is what triggers the e-sijil email.

- A4. Given the page is in after-event mode, when a guest opens it, then a feedback form shows with the three 1 to 5 ratings, the optional comment, Nama penuh, No. Kad Pengenalan and Emel, same labels and help text as the Google Form.
- A5. Given a filled feedback form, when the guest presses Hantar, then the answer lands in the response sheet and the e-sijil email arrives as it does for the Google Form.

### S3 (P1): Mistakes are caught before sending
Why P1: a wrong email or IC means a lost certificate.

- A6. Given a required field is empty, when the guest presses Hantar, then nothing is sent and that field says what is missing.
- A7. Given an email that is not an email, or an IC not in the form 900101-08-1234 (dashes optional), then nothing is sent and the field says the right format.

## Edge cases
- Double tap on Hantar: only one answer is sent; the button is disabled while sending.
- No signal or the send fails: the guest sees a clear message to try again, plus a link to the Google Form; nothing says "sent".
- Countdown mode (before the event): no form shows, as today.
- Phone with reduced motion: the form works with no animation.

## Out of scope
- Showing who has already confirmed, or any name list on the page.
- Editing an answer after sending.
- Remembering the IC or any answer on the phone.

## Assumptions
- The Google Form links stay as a fallback for a failed send.
- After a send, a small "Hantar untuk orang lain" link clears the form, so one phone can register a second guest.
- The IC is sent straight to Google and is never saved in the browser or this repo.
