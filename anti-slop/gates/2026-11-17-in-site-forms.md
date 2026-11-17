# Delivery Gate: in-site forms (P03), 2026-11-17

antislop mode: during (global preference). Direction: CLAUDE.md §6 + design-system skill (night navy, batik gold, sogan).
Design Read: event action card for dental staff on phones, Nusantara batik language, dial ENERGY 2 / RHYTHM 2 / MOTION 1.

## Block 1: Hard Gate
- R-02 PASS: no em dash in forms.js, forms.css, app.js copy (grep).
- R-03 PASS: 375 px, `scrollWidth - innerWidth = 0`; tiles 5 across fit, inputs full width.
- R-17/R-18/R-36/R-38 PASS: no numbers, testimonials or claims added; labels copy the real Google Forms.
- R-23/R-24 PASS: no new assets, no nav changes.
- R-25 PASS: cream #f6eedb and cream-muted #d9cfb8 on navy-deep, alert #ffb4a2 on navy-deep, navy-deep on gold-light: all above 4.5:1.
- R-26 PASS: Hantar validates then posts; "Hantar untuk orang lain" re-renders the form; fallback link opens the Google Form.
- R-27 PASS: sending state (button disabled, "Menghantar…"), error state (message + Google Form link + retry), done state (thanks), not-ready state (empty link).
- R-28 PASS: no FAQ.
- R-32 PASS: native inputs, radios stay focusable (opacity 0, not display none), visible gold focus ring on inputs and tiles; `.form-done` outline removed only because it is a non-interactive tabindex=-1 target for screen readers.
- R-33/R-34 PASS: written in source; one dark theme by owner choice.
- R-35 PASS: ran on localhost: empty feedback Hantar -> 5 field errors, focus to first, nothing sent; attendance filled -> button "Menghantar…" disabled -> thanks; feedback filled -> thanks; both rows seen in the response sheet; e-sijil email "UJIAN LAMAN SILA PADAM.pdf" arrived.
- R-37 PASS: direction exists.

## Block 2: Purpose-Gate
- R-01 PASS: gold gradient only on the submit pill and the chosen rating tile (marks the one choice / one action).
- R-12/R-13 PASS: no new shadow or glow.
- R-19 PASS: no new animation.
- Others: not used.

## Block 3: Liveliness
- Dials declared; one focal point (the action card); one accent (gold on the chosen tile and Hantar); motif: rating tiles reuse the countdown tile, so the form belongs to the card.

## Block 4: Craftsmanship
- C-1..C-5 PASS. R-11 PASS: 4px fields, pill only on the one action (house rule). R-15 PASS: CTAs say the action ("Sahkan Kehadiran", "Hantar dan dapatkan sijil"). R-29 PASS: one functional alert colour added as a token.

Result: no FAIL.
