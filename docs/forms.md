# Draf borang Google (P01)

Soalan untuk dua borang. Diluluskan pemilik pada 2026-11-17. Dibuat pada 2026-11-17 oleh `scripts/create-forms.gs`.

## 1. Borang Kehadiran

- **Tajuk:** Kehadiran Majlis Anugerah Gemilang 2026
- **Penerangan:** Sahkan kehadiran anda di Majlis Anugerah Gemilang dan Apresiasi Budi PKPD Batang Padang. Ambil masa kurang seminit.
- **Kumpul emel:** matikan (borang ini tidak bertanya emel)
- **Had satu jawapan:** tidak (tiada log masuk)

| # | Soalan | Teks bantuan | Jenis | Wajib | Pilihan |
|---|---|---|---|---|---|
| 1 | Nama penuh | Tulis nama penuh anda. | Jawapan pendek | Ya | - |
| 2 | No. Kad Pengenalan | Untuk semakan sijil anda. Contoh: 900101-08-1234 | Jawapan pendek (pengesahan: corak 900101-08-1234) | Ya | - |
| 3 | Jantina | - | Pilihan berganda | Ya | Lelaki; Perempuan |
| 4 | Klinik atau unit | - | Dropdown | Ya | KP Tapah; KP Slim River; KP Sungkai; KP Bidor; KP Tanjung Malim; OMFS HSR; Paeds Dental HSR |
| 5 | Peranan | - | Pilihan berganda | Ya | Peserta; Urus setia |

Soalan 2 dan 5 ditambah pada P04 (`addAttendanceQuestions`). Soalan 3 (Jantina) ditambah pada 2026-11-27 oleh fungsi yang sama supaya senarai nama Best Dress Lelaki dan Perempuan diasingkan. Soalan Emel dibuang pada 2026-11-17 (`removeAttendanceEmail`, keputusan pemilik). Sijil hanya dihantar kepada tetamu yang No. K/P-nya ada dalam borang ini, mengikut peranan yang dipilih.

**Mesej selepas hantar:** Terima kasih. Kehadiran anda sudah direkod. Selamat menikmati majlis!

## 2. Borang Maklum Balas

- **Tajuk:** Maklum Balas Majlis Anugerah Gemilang 2026
- **Penerangan:** Kongsi pandangan anda dalam kurang dua minit. Sijil penyertaan akan dihantar ke emel anda selepas borang dihantar.
- **Kumpul emel:** matikan (emel ditanya sebagai soalan di bawah)

| # | Soalan | Teks bantuan | Jenis | Wajib | Pilihan |
|---|---|---|---|---|---|
| 1 | Secara keseluruhan, bagaimana penilaian anda terhadap majlis ini? | - | Skala linear 1 hingga 5 | Ya | 1 = Kurang memuaskan; 5 = Sangat memuaskan |
| 2 | Bagaimana pengacaraan dan atur cara majlis? | - | Skala linear 1 hingga 5 | Ya | 1 = Kurang memuaskan; 5 = Sangat memuaskan |
| 3 | Bagaimana makanan dan tempat majlis? | - | Skala linear 1 hingga 5 | Ya | 1 = Kurang memuaskan; 5 = Sangat memuaskan |
| 4 | Ada cadangan atau komen untuk majlis akan datang? | Pilihan. Boleh dibiarkan kosong. | Perenggan | Tidak | - |
| 5 | Nama penuh | Eja nama anda dengan betul kerana nama ini akan dicetak pada sijil. | Jawapan pendek | Ya | - |
| 6 | No. Kad Pengenalan | Untuk dicetak pada sijil. Contoh: 900101-08-1234 | Jawapan pendek (pengesahan: corak 900101-08-1234) | Ya | - |
| 7 | Emel | Sijil anda akan dihantar ke emel ini. Semak ejaan emel sebelum menghantar. | Jawapan pendek (pengesahan: emel) | Ya | - |

**Mesej selepas hantar:** Terima kasih atas maklum balas anda. Sijil penyertaan akan sampai ke emel anda dalam masa terdekat. Jika tidak nampak, semak folder spam.

No. Kad Pengenalan hanya muncul pada PDF sijil tetamu itu sendiri dan dalam hamparan respons. Ia tidak pernah dipaparkan di laman web.
