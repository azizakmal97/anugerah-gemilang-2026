# Delivery Gate: Best Dress vote card (P06), 2026-11-17

antislop mode: during (global preference). Direction: CLAUDE.md §6 + design-system skill (night navy, batik gold, sogan).
Design Read: a second, quieter card under the attendance card for dental staff on phones, Nusantara batik language, dial ENERGY 2 / RHYTHM 2 / MOTION 1.

## Block 1: Hard Gate
- R-02 PASS: no em dash in vote.js, forms.css additions, index.html section (grep).
- R-03 PASS: 375 px, `scrollWidth === innerWidth` (375); long names wrap inside the full-width option rows; card is 520 px max on desktop.
- R-17/R-18/R-36/R-38 PASS: no counts, no ranking, no "leading" shown (spec A7); names come only from the live search.
- R-23/R-24 PASS: no new assets, no nav changes.
- R-25 PASS: cream on navy, cream-muted on navy, gold-light on navy, cream on navy-raised option rows: all above 4.5:1 (same pairs as P03).
- R-26 PASS: each option button picks a name; Hantar Undian validates then posts; "Undi untuk orang lain" re-renders; fallback link opens the Google Form.
- R-27 PASS: empty (fewer than 3 letters: no list), loading ("Mencari…"), no match ("Nama tidak ditemui…"), search error ("Carian gagal…"), send error (message + Google Form link + retry), closed (server or clock), not-ready (no links yet), done.
- R-28 PASS: no FAQ.
- R-32 PASS: native input and button elements, Tab reaches each option; gold focus ring on options and inputs.
- R-33/R-34 PASS: written in source; one dark theme by owner choice.
- R-35 PASS: localhost ?mod=hadir with a stubbed search and send: "ahm" -> 3 options; "zzz" -> no-match line; empty submit -> errors on Perempuan and IC, focus moves to Perempuan; two taps on Hantar while offline -> one send, "Cuba hantar semula" + fallback link; retry -> thanks; "Undi untuk orang lain" -> fresh form; server answering closed -> closed line. ?mod=sebelum and ?mod=selepas -> card hidden. Only console error was the simulated offline send.
- R-37 PASS: direction exists.

## Block 2: Purpose-Gate
- R-01 PASS: gold gradient only on the one Hantar pill (house rule); chosen name gets a faint gold wash to mark the choice.
- R-12/R-13 PASS: the vote card is flat on purpose, so the attendance card stays the one lifted element.
- R-19 PASS: no animation.
- Others: not used.

## Block 3: Liveliness
- Dials declared; focal point stays the attendance card; one accent (gold notice line and Hantar); motif: same thin gold line and input tiles as the batik action card.

## Block 4: Craftsmanship
- C-1..C-5 PASS. R-11 PASS: 4px fields and options, pill only on the one action. R-15 PASS: "Hantar Undian" names the action. R-29 PASS: no new colours.
