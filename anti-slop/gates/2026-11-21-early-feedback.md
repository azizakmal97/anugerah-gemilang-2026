# Delivery Gate: feedback card from 4.00 pm (owner 2026-11-21), 2026-11-21

antislop mode: during. Direction: CLAUDE.md §6 + design-system skill.
Design Read: one more quiet card under the vote card, same `vote-card` look, so one QR shows attendance, vote and feedback from 4.00 pm.

## Block 1: Hard Gate
- R-02 PASS: no em dash in the new copy or code.
- R-03 PASS: 375 px, `scrollWidth === innerWidth`; ids on the page stay unique (attendance and early feedback use different entry ids).
- R-25 PASS: same text and colour pairs as the vote card (gold-light title, cream lede).
- R-26/R-27 PASS: the card reuses the feedback form from forms.js, with its errors, send failure, retry and thanks; sending it no longer hides the attendance instruction line.
- R-35 PASS: localhost ?mod=hadir at 375 px: attendance form, vote card, then this card with 7 feedback questions; ?mod=selepas keeps feedback as the main card only (unit test).
- R-37 PASS: direction exists.

## Block 2 to 4
- No new colours, motion or assets. Copy proofread by Gemini: only note was "emel" to "e-mel", kept "emel" to match the rest of the page and the Google Form.
