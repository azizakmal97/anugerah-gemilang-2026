# No. K/P remembered from attendance

Date: 2026-11-17 · Status: agreed (owner 2026-11-17: "nombor kad pengenalan di maklum balas pun boleh tak buat tak perlu isi (diambil dari pendaftaran sahaja)", then chose "Dalam telefon")
Replaces the "page memory only, never browser storage" line of `best-dress-vote.md` A8.

## Stories

### S1 (P1): A guest types their No. K/P once, at attendance
Why P1: feedback opens after 6 pm, hours after attendance, so page memory alone is lost when the tab is closed or reloaded.

Acceptance:
- A1. Given a guest confirmed attendance on this phone, when the feedback form shows (after 6 pm, even after the page was closed and opened again), then its No. K/P is already filled and hidden behind one line that shows only the last 4 digits ("No. K/P anda (berakhir 0879) diambil daripada pendaftaran.") with a "Tukar" button that brings the field back.
- A2. The Best Dress vote card shows the same line, with the last 4 digits, so a guest who registered someone else on their phone notices before voting.
- A3. The IC is kept only in this phone's browser, never sent anywhere except the Google Forms it is typed for, and never shown in full on the page.
- A4. The IC is dropped from the phone when: feedback is sent; the guest taps "Hantar untuk orang lain" after attendance or "Undi untuk orang lain" after a vote; or on 1 Jan 2027.
- A5. Sending a vote does not drop it, so feedback after 6 pm still starts filled.

## Edge cases
- No attendance on this phone, browser storage blocked or cleared: the field shows empty, as today.
- A second person confirms attendance on the same phone: their IC replaces the first.
- A saved value that is not a valid IC is ignored and removed.

## Out of scope
- Filling the name or email.
- Looking the IC up from Google.
