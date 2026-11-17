# Best Dress vote

Date: 2026-11-17 · Status: agreed (owner answers 2026-11-17)
Done-check: PASS 2026-11-17

## Stories

### S1 (P1): A guest at the event votes for one man and one woman for Best Dress
Why P1: the owner wants the winners chosen by the guests, not a panel.

Acceptance:
- A1. Given voting is open, when a guest opens the page, then a Best Dress vote shows with two picks: Lelaki and Perempuan.
- A2. Given the guest types at least 3 letters of a name, then matching names of people who confirmed attendance appear, and the guest picks one for each category.
- A3. Given the guest enters their own No. K/P and sends the vote, then the vote is counted only if that IC is on the attendance list.
- A4. Given the same IC votes again, then only that IC's first vote counts, and the page says before sending: "Satu undi sahaja bagi setiap No. K/P. Undi pertama yang dikira."
- A5. Given a guest picks their own name, then that pick is not counted.

### S2 (P1): Only the owner sees the results
Why P1: the owner announces the winners at the event; results must not be public.

- A6. Given votes are in, when the owner asks for the results, then they get the top 5 for Lelaki and the top 5 for Perempuan with vote counts, privately (email to the owner, or a sheet only the owner can open).
- A7. The page never shows any count, ranking or "who is leading".

## Edge cases
- No match for the typed letters: "Nama tidak ditemui. Pastikan dia sudah sahkan kehadiran."
- Voting closed: the vote section says so and accepts nothing.
- Double tap on Hantar: one vote is sent.
- No signal: clear retry message, nothing says "sent".
- Tie at 5th place: all tied names are listed.

## Out of scope
- Photos of the candidates.
- Showing results on the page or on a screen.
- Voting from outside the attendance list.

## Assumptions
- Owner 2026-11-17 ("ya sheet peribadi"): the top 5 for each category live in a private Google Sheet on the owner's account that updates by itself; the owner opens it on the phone at 5.30 pm. No email.
- Owner 2026-11-17 ("sorang boleh undi seorang laki dan seorang perempuan sahaja"): one vote per IC, exactly one man and one woman, both required. First vote counts, so nobody can change it later.
- Owner 2026-11-17 ("undian dibuka sepanjang program berlangsung. 5.30 dah start sampaikan hadiah"): voting opens with attendance at 12.00 pm on 5 Dec and closes at 5.30 pm sharp, when the Best Dress prizes start. A vote sent after 5.30 pm is not counted.
- Owner 2026-11-17 ("nama boleh muncul lepas type huruf"): names show only after 3 typed letters, loaded live from Google while voting is open, never stored in this repo, never a full list.
- The voter's IC is the same IC rule and auto-format as the other forms.
- No gender is stored: the guest decides who goes under Lelaki and who under Perempuan.
- Votes land in a Google Form response sheet like the other forms, and an Apps Script on the owner's account counts them.

## Open questions
- None.
