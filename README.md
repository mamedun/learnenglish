# SpeakUp — petualangan belajar bahasa Inggris

Aplikasi React **JSX** + Vite dan API PHP/SQLite untuk latihan bahasa Inggris yang terinspirasi IELTS. URL frontend: `/learnenglish/`; API: `/learnenglish/api/`. Ini **bukan** produk, tes, sertifikat, atau prediksi skor resmi IELTS.

## Analisis repositori & keputusan implementasi

Dokumen [desain kurikulum](./IELTS_COURSE_DESIGN.md) menentukan enam jenjang A1–C2, batas klaim IELTS, rubrik feedback AI, dan larangan membuat soal video tanpa verifikasi sumber. [Peta aset gambar](./IMAGE_PROMPTS.md) mencatat ilustrasi listening/speaking yang sudah ada. Di atas fondasi itu, aplikasi sekarang memiliki:

| Area | Implementasi |
| --- | --- |
| Frontend | React JSX/JavaScript (`src/*.jsx`, `src/*.js`), tanpa TSX, konfigurasi TypeScript, atau dependensi TypeScript. Tema ungu-koral, font Fredoka + Nunito, layout responsif, ilustrasi petualangan, ikon vektor, dashboard XP/streak/badge. |
| Konten | SQLite sebagai **sumber data runtime** untuk jenjang, 48 unit speaking, 18 lesson listening, 36 soal dan kunci jawaban. Seed JSON orisinal di `api/seeds/catalog.json` dipakai **sekali** saat tabel jenjang katalog kosong; bukan database kedua yang disinkronkan. |
| Admin | Akun bootstrap dari konfigurasi server privat; diwajibkan mengganti password awal (minimal 12 karakter) sebelum memakai fitur. Studio Admin mengelola unit, lesson, soal, kunci, publikasi/arsip, urutan, dan metadata jenjang tanpa rebuild frontend. |
| Belajar | Regular mendapat listening; Premium/Admin mendapat AI Speaking dan Live. Audio arsip hanya dengan persetujuan. Progres per akun, jawaban listening dicek server, XP dan streak tersimpan di SQLite. |
| Operasional | API health, session cookie, CORS allowlist, pembatasan akses berdasar peran, lockdown, tutup registrasi, konfigurasi provider terenkripsi, impor/ekspor progres. |

### Mengapa katalog di database?

**Kelebihan:** Admin bisa memperbarui materi tanpa deploy/build; satu katalog dipakai semua akun/perangkat; soal dan kunci dikelola transaksional; kunci jawaban **tidak** dikirim dalam endpoint katalog peserta; pengarsipan mempertahankan ID agar riwayat progres lama tetap masuk akal. Seed satu kali mempertahankan materi dari repositori untuk instalasi baru.

**Kekurangan/trade-off:** Server + disk SQLite harus tersedia/ditulis setiap saat; perlu backup, migrasi skema, izin file, dan pengawasan kapasitas/konkurensi untuk skala lebih besar. Katalog sekarang butuh request API alih-alih hanya file statis/CDN; pertanyaan yang diperbarui memperoleh ID baru sehingga jawaban yang sedang dibuka peserta perlu dimuat ulang. Mengedit JSON seed setelah instalasi **tidak** mengubah database yang sudah berjalan; lakukan perubahan lewat Studio. Soal dan skrip listening terlihat di client agar latihan dapat diakses; hanya kunci dan penjelasannya yang tetap di server.

### Batas produk yang disengaja

- Listening memakai naskah tetap + browser speech synthesis (ketersediaan suara tergantung browser/OS), bukan AI, speech recognition, atau skor band IELTS. `POST listening/check` memeriksa pilihan di server; XP bersifat motivasional, **bukan nilai ujian atau anti-cheat formal**.
- AI Lesson/Live hanya Premium/Admin; feedback berbasis teks tidak cukup untuk menilai pronunciation atau overall band. Pengiriman audio ke Gemini untuk evaluasi memerlukan consent terpisah dari pengarsipan. Live memakai token singkat yang dibuat server, bukan long-lived key di browser; live audio tidak disimpan oleh SpeakUp. Premium diberikan manual oleh admin (tidak ada pembayaran).
- Bank video sengaja kosong sampai satu video spesifik terverifikasi URL/izin, transkrip atau subtitle, durasi, dan kunci jawabannya. Gambar latihan deskripsi bukan bagian resmi IELTS Speaking. Lihat [IELTS_COURSE_DESIGN.md](./IELTS_COURSE_DESIGN.md).

## Jalankan lokal

Persyaratan: Node.js 20+, PHP 8.1+ dengan `pdo_sqlite`, `openssl`, `fileinfo`, session; `curl` dianjurkan (ada fallback HTTP stream). Jalankan dari root repositori:

```bash
npm ci
cp .env.example .env
cp .env.development.example .env.development.local
```

Set `.env` **privat** (tidak dimasukkan Git); minimal `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD`, `APP_ENCRYPTION_KEY` (>=32 karakter acak), dan `CORS_ALLOWED_ORIGINS`. Password bootstrap minimal 8 karakter, tetapi penggantinya wajib unik dan **minimal 12 karakter**. Akun admin dibuat otomatis saat API membuka SQLite **jika email yang dikonfigurasi belum ada**, termasuk pada database lama; akun yang sudah memakai email itu tidak ditimpa atau dinaikkan haknya. Set `ADMIN_PASSWORD` sebelum login pertama; perubahan berikutnya pada `.env` tidak mereset password akun yang ada. Setelah mengganti password melalui aplikasi, hapus password bootstrap dari konfigurasi server; jangan dipakai di instalasi publik. Contoh `.env.example` tidak berisi kredensial nyata.

Dalam `.env.development.local`, ubah proxy agar menunjuk ke server PHP lokal:

```env
VITE_API_PROXY_TARGET=http://127.0.0.1:8787
VITE_API_PROXY_PATH_PREFIX=
```

Lalu jalankan di dua terminal:

```bash
php -S 0.0.0.0:8787 api/router.php
npm run dev
```

Buka `http://localhost:5173/learnenglish/`. Browser hanya mengakses URL relatif `/learnenglish/api/…` di origin Vite; Vite meneruskan ke PHP. Alternatif: set `VITE_API_PROXY_TARGET=https://rikisample.test` dan `VITE_API_PROXY_PATH_PREFIX=/learnenglish` jika host PHP `.test` pengguna sudah tersedia. Jangan menaruh API key Gemini/Clario di variabel `VITE_*`.

## Deploy produksi

1. `npm ci && npm run build`, salin **isi** `dist/` ke `/learnenglish/` di web root. Salin folder `api/` (termasuk `api/seeds/catalog.json` dan aturan deny `.htaccess`) ke `/learnenglish/api/`. Jangan menimpa aturan rewrite produksi tanpa meninjaunya. Pastikan SPA fallback tidak menangkap `/learnenglish/api/*`.
2. Siapkan environment **di luar web root** (misalnya `ENV_FILE=/secure/path/speakup.env`), dengan `APP_ENCRYPTION_KEY` kuat dan `ADMIN_*` sebelum kunjungan pertama. Default DB `api/db/data.db`, audio `api/uploads/{user_id}/`; atur `DATA_DB_PATH`/`UPLOADS_DIR` ke jalur absolut di luar web root bila mungkin. Proses PHP harus dapat menulis database, WAL, dan folder upload. Jangan pernah menyajikan `.env`, SQLite, seed JSON, atau file audio langsung sebagai aset publik.
3. Dengan Apache, `.htaccess` melarang akses ke `api/db/`, `api/uploads/`, dan `api/seeds/`; dengan **Nginx, `.htaccess` diabaikan**. Tambahkan deny berikut (sesuaikan root/regex dengan server), dan pastikan path privat tidak diarahkan ke SPA atau PHP sebagai static file:

   ```nginx
   location ^~ /learnenglish/api/db/      { return 404; }
   location ^~ /learnenglish/api/uploads/ { return 404; }
   location ^~ /learnenglish/api/seeds/   { return 404; }
   location ~* ^/learnenglish/(?:\.env.*|.*\.(?:db|sqlite|sqlite3|log)(?:-wal|-shm)?)$ { return 404; }
   ```

4. Gunakan HTTPS dan akses API satu-origin jika bisa. `CORS_ALLOWED_ORIGINS` berisi origin persis, bukan `*` dengan cookie. `SESSION_SAMESITE=Lax` untuk satu-origin; jika sengaja beda origin dan keduanya HTTPS, atur `VITE_API_BASE_URL=https://api.example.com/learnenglish/api`, allowlist frontend di API, dan `SESSION_SAMESITE=None` (cookie Secure). Pastikan sesi tidak terblokir oleh pengaturan cookie browser.
5. Untuk pengiriman audio WAV sementara dengan consent, atur PHP `upload_max_filesize=16M`, `post_max_size=16M`, `max_execution_time=90` (batas aplikasi 12 MB). Pasang API key server-side dari Studio Admin, tersimpan AES-256-GCM dengan `APP_ENCRYPTION_KEY`; cadangkan key bersamaan dengan database agar konfigurasi terenkripsi tetap bisa dibaca.
6. Verifikasi `/learnenglish/api/health`, login pertama dan rotasi password admin, pendaftaran, listening Regular, batas Premium, update Studio, pengaturan admin, dan unduhan audio milik akun sendiri. Kesehatan API (`ok:true`, SQLite) **tidak** sendiri membuktikan UI/proxy/fitur berjalan. Backup database SQLite secara konsisten (termasuk WAL saat aktif) dan audio bersama; rahasiakan backup.

Ilustrasi petualangan baru ada di `public/images/speakup-adventure.png`; aset pelajaran yang sudah ada tetap di `public/images/listening/` dan `public/images/speaking/`. Lihat [IMAGE_PROMPTS.md](./IMAGE_PROMPTS.md).

## Endpoint API utama (`/learnenglish/api/`)

- `GET health`, `GET me`, `POST register/login/logout`, `POST account/password`
- `GET catalog` — katalog terbit untuk pengguna login, **tanpa kunci jawaban**; `POST listening/check` — hasil benar/salah/penjelasan dari server
- `GET/PUT/DELETE progress` — progres akun, termasuk XP dan streak
- `GET admin/catalog`; `POST/PUT/DELETE admin/units` dan `admin/listening`; `PUT admin/levels/{id}` — hanya admin
- `GET/PUT admin/settings`, `GET/PUT admin/users` — hanya admin
- `POST/GET/DELETE audio`, `POST assess-audio`, `POST chat`, `POST live-token`, `POST live-assessment`, `GET models` — fitur Premium/Admin sesuai consent dan konfigurasi provider

## Pengujian

```bash
npm run build
npm audit --omit=dev --audit-level=high
```

`tests/smoke_api.py` adalah pengujian integrasi yang **mengubah password, katalog, serta pengaturan**. Jalankan hanya dengan **database baru yang dibuang setelah tes**, dan server di `localhost`; **jangan** arahkan ke DB produksi atau preview utama. Contoh, pada dua terminal:

```bash
DATA_DB_PATH="$PWD/api/db/smoke.db" php -S 0.0.0.0:8788 api/router.php
SMOKE_API_BASE=http://127.0.0.1:8788/learnenglish/api \
  SMOKE_ADMIN_EMAIL=<email-bootstrap-privat> \
  SMOKE_ADMIN_PASSWORD=<password-bootstrap-privat> python3 tests/smoke_api.py
```

Saat selesai, hentikan server, lalu hapus DB uji yang tidak diperlukan. Skrip memeriksa bootstrap/rotasi password, hak akses, 6/48/18/36 seed, CRUD + arsip, koreksi jawaban server, progres, CORS, lockdown, dan penutupan registrasi. Tes UI manual: login admin -> wajib ganti password -> Studio Admin; daftar Regular -> selesaikan lesson listening -> XP tetap setelah reload; uji desktop/mobile.
