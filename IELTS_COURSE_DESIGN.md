# Desain kurikulum SpeakUp yang terinspirasi IELTS

## Prinsip dan batas klaim

SpeakUp adalah aplikasi latihan, **bukan IELTS resmi**, bukan produk/mitra IELTS, dan skor AI bukan hasil tes atau prediksi resmi. Materi latihan ditulis sendiri dengan mengambil pola keterampilan, bukan menyalin soal/konten berhak cipta.

IELTS Speaking resmi berlangsung 11–14 menit dan terdiri dari tiga bagian: Part 1 topik pribadi/familiar (4–5 menit), Part 2 individual long turn dengan waktu persiapan satu menit dan bicara sampai dua menit, lalu Part 3 diskusi terkait yang lebih luas/abstrak (4–5 menit). Speaking Academic dan General Training memakai format yang sama. Penilaian Speaking memakai Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy, dan Pronunciation. Referensi resmi: https://ielts.org/for-test-takers/test-format dan https://ielts.org/organisations/ielts-scoring-in-detail.

## Enam jenjang pembelajaran

| Jenjang aplikasi | Fokus latihan | Penggunaan pola IELTS |
|---|---|---|
| A1 Fondasi speaking | Kalimat sederhana, informasi personal, rumah, keluarga, rutinitas, minat. Bangun keberanian dan dasar bahasa terlebih dahulu. | Pola tanya-jawab Part 1 yang dipermudah; belum diberi prediksi band. |
| A2 Jawaban berkembang | Jawaban lebih panjang dengan alasan, contoh, urutan waktu, dan deskripsi visual. | Part 1 familiar topics; kartu latihan gambar adalah enrichment umum, **bukan format resmi IELTS Speaking**. |
| B1 Mandiri & terstruktur | Perluas jawaban, cerita pengalaman, dan long turn dengan cue card. | Part 1 + Part 2: satu menit persiapan, respons target 1–2 menit, follow-up. |
| B2 Spontan & analitis | Bandingkan, jelaskan sebab-akibat, membangun argumen dan menyikapi ide abstrak. | Part 2 + Part 3 yang terhubung tematis; jawab dengan alasan dan contoh. |
| C1 Mahir profesional | Nuansa, register, fleksibilitas, diskusi yang seimbang dan extended responses. | Simulasi Speaking tiga bagian dengan durasi resmi 11–14 menit di checkpoint. |
| C2 Presisi & fleksibel | Topik abstrak, implikatur, argumentasi spontan dan presisi leksikal. | Simulasi lanjutan tiga bagian; fokus refleksi, bukan menjanjikan Band 9. |

Tabel jenjang CEFR dan IELTS **bukan ekuivalensi satu-banding-satu**. IELTS sendiri menjelaskan pemetaan CEFR bersifat kompleks. Panduan umum yang dipublikasikan IELTS menempatkan B1 sekitar 4.0–5.0, B2 5.5–6.5, C1 7.0–8.0, C2 8.5–9.0; A1/A2 tidak diberi padanan band pada tabel tersebut. Untuk itu UI menggunakan label “rough guide”, bukan syarat masuk atau jaminan skor. Sumber: https://ielts.org/organisations/ielts-for-organisations/compare-ielts/ielts-and-the-cefr dan https://ielts.org/news-and-insights/finding-the-right-english-proficiency-test-for-you.

## Rubrik latihan dan transparansi AI

Setiap respons dapat menerima bintang 1–5 sebagai feedback/momentum produk, **terpisah dari band IELTS**. Empat kriteria IELTS-style ditampilkan dalam skala 0–9 dengan interval 0.5 hanya bila ada cukup bukti. Transcript teks bisa membantu memberi feedback kosakata dan grammar, tetapi tidak cukup untuk menilai jeda, kecepatan, intelligibility, stress/intonasi atau pronunciation dengan andal. Dalam implementasi saat ini, pronunciation ditandai `not_scored`, dan Fluency & Coherence ditandai `provisional`/kosong bila tidak ada bukti audio. Overall speaking band dibiarkan kosong jika empat kriteria tidak bisa dinilai. Jangan tampilkan skor sebagai “resmi”.

## Visual exercises

A2-U1 memakai ilustrasi generatif orisinal untuk latihan mengamati dan menjelaskan adegan pasar. Ini berguna untuk kosakata, deskripsi dan inferensi sederhana, tetapi tidak boleh diberi label “soal IELTS Speaking resmi”: format Speaking resmi adalah wawancara/cue card/diskusi, bukan gambar. Visual juga dapat dipakai sebagai enrichment conversation di luar mock test.

## Kebijakan video YouTube

Katalog video soal di aplikasi sengaja **kosong** saat ini. Pencarian menemukan kanal IELTS by IDP dan materi resmi terkait, tetapi belum memverifikasi satu video pendek tertentu beserta durasi, subtitle/transkrip, kelayakan embed, dan kumpulan pertanyaan yang akurat. Karena itu aplikasi tidak membuat video/pertanyaan fiktif. Panel Admin menampilkan kanal IELTS by IDP sebagai tempat kurasi manual; video baru sebaiknya masuk hanya setelah editor memeriksa sumber, URL/ID video, durasi, subtitle, hak penggunaan/embedding, level, dan pertanyaan yang jawabannya benar-benar terdapat dalam video. Referensi pengantar IDP: https://ielts.idp.com/prepare/article-youtube-for-ielts-preparation.

## Sumber IELTS resmi

- Format Speaking: https://ielts.org/for-test-takers/test-format
- IELTS Speaking dan kriteria: https://ielts.org/take-a-test/test-types/ielts-general-training-test/ielts-general-training-format-speaking
- Sample questions Academic: https://www.ielts.org/take-a-test/preparation-resources/sample-test-questions/academic-test
- Sample questions General Training: https://www.ielts.org/take-a-test/preparation-resources/sample-test-questions/general-training-test
- Band scoring: https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail
- CEFR comparison: https://ielts.org/organisations/ielts-for-organisations/compare-ielts/ielts-and-the-cefr
