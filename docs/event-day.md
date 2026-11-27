# Event day checklist: Majlis Anugerah Gemilang, 5 Dec 2026

Owner: Dr Aziz. Written 2026-11-27 after the system review.

## 1. Forms are frozen (from 27 Nov)

Do not add, remove or rename any question in the three Google Forms (Kehadiran, Maklum Balas,
Undian Best Dress). The page sends answers blind (`no-cors`): if Google refuses one because a
required question is missing, the guest still sees "Terima kasih" and the answer is lost.

## 2. Cleanup, 1 Dec (calendar reminder 9 am)

- [ ] Delete script properties `TEST_FROM` and `VOTE_TEST_UNTIL` (Apps Script > Project Settings).
- [ ] Delete the test rows in the response sheets, including "UJIAN JANTINA WANITA" (IC 900101-08-0000).
- [ ] Apps Script editor: pick `clearSijilRecords` and press Run. It forgets every test sijil and
      "tidak ditemui" email, so testers still get their real sijil on the day.

## 3. Rehearsal, 3 or 4 Dec (about 15 minutes, two phones)

Set a short test window first: `TEST_FROM` = now, `VOTE_TEST_UNTIL` = now + 1 hour.

- [ ] Phone A: open the QR link, `?mod=hadir`. Check in as "UJIAN LELAKI" (Lelaki).
- [ ] Phone B: check in as "UJIAN WANITA" (Perempuan).
- [ ] Within a minute: both names appear in the response sheet.
- [ ] Phone A: vote. "ujian" under Lelaki shows only UJIAN LELAKI; under Perempuan only UJIAN WANITA.
- [ ] Typing a name without tapping it is refused; tapping it then sending works.
- [ ] Results tab "Keputusan Best Dress" shows the vote.
- [ ] `?mod=selepas`: send feedback with Phone A's IC and a real email. The e-sijil arrives.
- [ ] Delete both test properties again and the test rows.
- [ ] Run `clearSijilRecords` again (Apps Script editor). Done.

## 4. In the hall, 5 Dec

- [ ] Before 12 pm: open the page on mobile data AND on the hotel wifi. Note which is faster.
- [ ] If the internet fails: guests sign the printed attendance sheet (name, IC, Jantina, klinik,
      peranan). Best Dress falls back to paper slips. The committee types the sheet into the
      attendance form BEFORE 6 pm: answers sent after 6 pm do not count, so a guest typed in late
      gets no e-sijil.
- [ ] Bring: printed attendance sheet (about 130 rows), 130 vote slips, pens, the QR poster.
