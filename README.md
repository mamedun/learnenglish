# SpeakUp (LearnEnglish) — AI English Conversation & Fluency Coach

Selamat datang di repositori resmi **SpeakUp (LearnEnglish)** — platform komprehensif pembelajaran bahasa Inggris interaktif berbasis web yang memadukan latihan *Speaking*, *Listening Lab*, *Shadowing Practice*, percakapan *AI Roleplay*, dan percakapan suara *Real-Time Gemini Live*.

Dokumentasi ini disusun secara lengkap dan mendalam agar dapat dipahami dengan mudah oleh **pengguna akhir (end-user)**, **pengembang (developer)**, maupun **agen AI** yang akan melanjutkan pengembangan di sesi berikutnya.

---

## Daftar Isi
1. [Ringkasan & Visi Produk](#1-ringkasan--visi-produk)
2. [Fitur-Fitur Utama Aplikasi](#2-fitur-fitur-utama-aplikasi)
   - [A. Listening Lab (Laboratorium Listening & Shadowing)](#a-listening-lab-laboratorium-listening--shadowing)
   - [B. AI Lesson / Practice Studio](#b-ai-lesson--practice-studio)
   - [C. Gemini Live Lesson (Real-Time Voice Conversation)](#c-gemini-live-lesson-real-time-voice-conversation)
   - [D. Gamifikasi, Journey Map, & Progres](#d-gamifikasi-journey-map--progres)
   - [E. Studio Admin & Panel Manajemen](#e-studio-admin--panel-manajemen)
3. [Arsitektur & Tech Stack](#3-arsitektur--tech-stack)
4. [Peta Struktur Direktori Proyek](#4-peta-struktur-direktori-proyek)
5. [Sistem Suara & Visualizer Audio Real-Time](#5-sistem-suara--visualizer-audio-real-time)
6. [Referensi Endpoint REST API](#6-referensi-endpoint-rest-api)
7. [Autentikasi, Keamanan, & Sesi](#7-autentikasi-keamanan--sesi)
8. [Panduan Instalasi & Menjalankan Aplikasi](#8-panduan-instalasi--menjalankan-aplikasi)
9. [Panduan Deployment Produksi (Apache & Nginx)](#9-panduan-deployment-produksi-apache--nginx)
10. [Panduan Khusus untuk Pengembang & Agen AI Berikutnya](#10-panduan-khusus-untuk-pengembang--agen-ai-berikutnya)

---

## 1. Ringkasan & Visi Produk

**SpeakUp (LearnEnglish)** dirancang untuk mengatasi hambatan terbesar pembelajar bahasa Inggris: **kurangnya partner bicara yang suportif, rasa cemas saat berbicara, dan minimnya feedback pengucapan yang spesifik**. 

Platform ini menghadirkan pengalaman belajar mandiri berstandar CEFR (jenjang A1 hingga C2) dan IELTS yang imersif melalui:
- **Audio Native Kokoro TTS & Cerita Interaktif**: Melatih telinga menangkap aksen, intonasi, dan kosakata kontekstual.
- **Latihan Shadowing Dual-Mode**: Memilih antara penilaian fonetik lokal gratis (browser) atau penilaian AI mendalam dengan laporan artikulasi & kelancaran.
- **Tutor Digital AI**: Memberikan koreksi tata bahasa (*grammar*), sinonim lebih natural, dan penilaian skor instan.
- **Percakapan Bebas Real-Time (Gemini Live)**: Simulasi percakapan telepon dua arah yang spontan dengan jeda latensi sangat rendah.

---

## 2. Fitur-Fitur Utama Aplikasi

### A. Listening Lab (Laboratorium Listening & Shadowing)
- **Audio Cerita Berjenjang**: Setiap unit listening memiliki narasi audio berkualitas tinggi dengan dukungan **Kokoro TTS** (Heart-American, Puck-American, Emma-British, George-British) atau suara bawaan browser.
- **Kuis Pemahaman (Comprehension Check)**: Soal latihan interaktif (pilihan ganda, melengkapi kalimat) yang diperiksa langsung secara aman oleh server (`POST /api/listening/check`).
- **Shadowing & Speaking Task**:
  - **Tombol Hero Interaktif (*Eye-Catching Action Button*)**: Tombol besar bergaya kartu modern dengan ikon mikrofon berdenyut, status live yang jelas, dan tag biaya/gratis.
  - **Mode Penilaian Sistem (Gratis · 0 Diamond)**:
    - Menggunakan Web Speech API browser untuk mentranskripsikan suara menjadi teks secara instan.
    - Teks dapat diedit di perangkat mobile bila ada kata yang terlewat.
    - Algoritma pencocokan fonetik cerdas (`speechSimilarity.js`) menggunakan **Double Metaphone**, pemetaan homofon (*there/their/they're*), normalisasi ejaan UK/US (*color/colour*), dan jarak Levenshtein fuzzy.
    - Skor **hanya muncul setelah tombol periksa diklik secara eksplisit** (mencegah skor prematur).
  - **Mode Penilaian AI (Analisis Suara & Artikulasi Langsung)**:
    - Merekam suara langsung (*direct audio*) tanpa transkripsi lokal.
    - Menyediakan pemutar preview audio agar pengguna dapat mendengarkan kembali suaranya sebelum dikirim.
    - Mengirim rekaman ke AI Server untuk menganalisis akurasi pengucapan, kejelasan artikulasi kata, dan kelancaran (*stutter detection*).
    - Menampilkan kartu **Laporan Artikulasi & Kejelasan AI** (`articulationReport`) serta persentase skor.
  - **Visualizer Gelombang Suara Audio-Reactive (Web Audio API)**:
    - Waveform **benar-benar tenang dan statis saat kondisi hening**.
    - Waveform **bergejolak dinamis mengikuti desibel dan volume suara** pengguna saat berbicara.

---

### B. AI Lesson / Practice Studio
- **Latihan Percakapan Berbasis Skenario**: Pengguna berdialog giliran-demi-giliran (*turn-based*) dengan persona tutor AI sesuai topik (pekerjaan, perjalanan, debat, wawancara).
- **Alur Audio Hero yang Menarik**: Tombol dengarkan soal dan instruksi dilengkapi bar visualizer interaktif.
- **Progres Pembelajaran Fleksibel**:
  - Mendukung mode alur **Berurutan (Sequential)** maupun **Bebas (Independent)** yang dapat dikonfigurasi per kursus melalui Course Studio.
- **Modal Perayaan Gamifikasi (Celebration Modal)**:
  - Efek konfeti meriah (`canvas-confetti`) dan kartu ucapan selamat saat pengguna berhasil mencapai target skor poin minimum.
- **Riwayat Rekaman Percakapan**:
  - Rekaman audio jawaban dapat diputar kembali.
  - Penghapusan kartu riwayat otomatis menghapus rekaman terkait di database serta file audio fisik di server.

---

### C. Gemini Live Lesson (Real-Time Voice Conversation)
- **Percakapan Telepon Dua Arah dengan Maya**: Pengguna berbicara secara bebas tanpa perlu mengetik teks; tutor AI merespons secara langsung melalui suara.
- **Pilihan Topik Beragam**: Wawancara kerja, *ordering at a restaurant*, diskusi film, simulasi IELTS speaking part 2.
- **Sistem Billing Transparan**: Penggunaan dihitung dalam blok waktu cadangan diamond per menit.
- **Review Pasca Sesi**: Rangkuman kekuatan (*strengths*), aspek yang perlu diperbaiki (*improvements*), dan contoh kalimat revisi natural.

---

### D. Gamifikasi, Journey Map, & Progres
- **Peta Petualangan (Journey Map)**: Menampilkan visualisasi jalur belajar dari A1 Pemula hingga C2 Mahir yang difilter otomatis berdasarkan kursus aktif terakhir.
- **XP, Level, & Daily Streak**: Membangun konsistensi belajar harian dengan reward XP dan perhitungan *streak*.
- **Piala & Badge Pencapaian**: Koleksi medali atas kelulusan unit dan performa berbicara.
- **Ekonomi Diamond**: Saldo diamond digunakan untuk fitur-fitur bertenaga AI (Penilaian AI dan Gemini Live). Pengguna dengan hak Admin memiliki akses tak terbatas (*Unlimited Diamonds*).

---

### E. Studio Admin & Panel Manajemen
Akses khusus administrator untuk mengelola seluruh aspek aplikasi secara terpadu:
- **Course Studio**:
  - Pembuatan kursus baru, jenjang (Levels), unit speaking, dan materi listening.
  - Konfigurasi alur belajar per kursus: *Sequential Progression* (terkunci berurutan) atau *Free/Independent Access* (bebas pilih lesson).
  - Penetapan harga beli kursus (dalam IDR/Diamond).
- **Manajemen Pengguna & Pembelian**:
  - Pencarian, filter status, pengubahan saldo diamond, reset password, dan audit transaksi kursus pengguna.
- **Manajemen Iklan Global (Ads Studio)**:
  - Konfigurasi banner ads, interstitial, dan reward ads.
- **Akses & Kebijakan (Settings)**:
  - Pengaturan biaya diamond penilaian audio langsung (`cost_listening_direct_audio`).
  - Ambang batas kelulusan speaking (*Similarity Threshold* 50%–100%).
  - Pemilihan AI Provider global (Clario, Gemini Server AI, OpenRouter, Free API Key SG1–SG10).
  - Manajemen cache suara Kokoro TTS (kapasitas 1 GB dengan penghapusan otomatis LRU).

---

## 3. Arsitektur & Tech Stack

| Lapisan | Teknologi | Deskripsi |
| :--- | :--- | :--- |
| **Frontend UI** | React 18 (JSX), Vite | Komponen modular, transisi cepat, responsif mobile & desktop |
| **State Management**| Zustand | Menyimpan state autentikasi, user profile, katalog kursus, dan progres |
| **Ikon & Feedback** | Lucide React, Sonner | Ikon modern dan sistem notifikasi toast halus |
| **Audio Processing** | Web Audio API, Canvas | Analisis FFT `AnalyserNode` real-time, visualizer 60 FPS |
| **TTS Engine** | Kokoro TTS (TTS.Rocks) | Text-to-speech berkualitas tinggi dengan aksen US dan UK |
| **Backend API** | PHP 8.1+ | RESTful API berbasis JSON tanpa framework berat, performa tinggi |
| **Database** | SQLite 3 dengan WAL Mode | Penyimpanan relasional ringan, transaksi cepat, ACID compliant |
| **Keamanan** | JWT, HttpOnly Cookies, AES-256-GCM | Token akses memori, refresh token terenkripsi, proteksi data |

---

## 4. Peta Struktur Direktori Proyek

```text
learnenglish/
├── api/                             # Backend PHP REST API
│   ├── config.example.php           # Template konfigurasi backend tanpa rahasia
│   ├── config.php                   # Konfigurasi privat (kunci enkripsi, paths, kredensial)
│   ├── index.php                    # Router utama API, endpoint assessment, audio, users, auth
│   ├── courseware.php               # Endpoint kursus, progres, modul listening, dan studio
│   ├── migrate.php                  # Skrip CLI & web migrasi database otomatis
│   ├── router.php                   # Router untuk development server PHP bawaan
│   ├── seeds/                       # Seed data JSON katalog dan kurikulum awal
│   ├── db/                          # Direktori database SQLite (data.db)
│   └── uploads/                     # Direktori penyimpanan rekaman suara pengguna
├── src/                             # Kode Sumber Frontend (React JSX)
│   ├── app/
│   │   └── App.jsx                  # Komponen induk, routing utama, navigasi topbar/sidebar
│   ├── components/                  # Komponen pakai ulang
│   │   ├── AudioRadarWaveform.jsx   # Visualizer gelombang suara & radar reaktif Web Audio API
│   │   ├── AudioRadarWaveform.css   # Styling visualizer, tema emerald/coral/purple
│   │   ├── ProcessingStatus.jsx     # Indikator status loading proses AI
│   │   ├── ModuleLoading.jsx        # Skeleton loader
│   │   └── ModuleErrorBoundary.jsx  # Penangkap error runtime
│   ├── features/                    # Modul fitur berbasis domain
│   │   ├── admin/                   # Halaman Admin, Course Studio, Ads, User Management
│   │   ├── auth/                    # Halaman Login & Registrasi
│   │   ├── courses/                 # Daftar & Detail Kursus
│   │   ├── listening/               # Listening Lab & Speaking Task (Shadowing)
│   │   ├── live/                    # Percakapan suara Gemini Live
│   │   ├── progress/                # Journey Map, Profil, XP & Achievements
│   │   ├── settings/                # Pengaturan suara TTS & akun pengguna
│   │   └── speaking/                # AI Lesson Practice Page & Skenario Roleplay
│   ├── hooks/                       # Custom React Hooks
│   │   ├── useSpeechRecognition.js  # Wrapper Web Speech API dengan filter duplikasi mobile
│   │   └── useSmallViewport.js      # Deteksi ukuran layar responsif
│   ├── lib/                         # Utilitas & Logika Bisnis
│   │   ├── speechSimilarity.js      # Algoritma pencocokan fonetik Metaphone & fuzzy
│   │   ├── audio.js                 # Konversi rekaman audio ke WAV
│   │   ├── formatTime.js            # Formatter durasi waktu (MM:SS)
│   │   └── ttsRocks.js              # Integrasi Kokoro TTS player
│   ├── styles.css                   # Gaya dasar aplikasi
│   ├── overrides.css                # Komponen kustom, radar pulse, hero buttons
│   └── theme.css                    # Variabel warna dan tema desain
├── tests/                           # Skrip pengujian otomatis (Node & Python)
├── index.html                       # Entry point HTML
├── package.json                     # Dependensi frontend npm
└── vite.config.js                   # Konfigurasi bundler Vite
```

---

## 5. Sistem Suara & Visualizer Audio Real-Time

Platform ini mengimplementasikan visualizer suara berbasis **Web Audio API (`AudioContext` & `AnalyserNode`)** yang digambar pada HTML5 Canvas pada 60 FPS:

1. **Responsif Terhadap Desibel Suara**:
   - Nilai desibel diekstrak dari frekuensi data mikrofon secara real-time.
   - **Kondisi Hening**: Semua bar berada di posisi dasar berupa kapsul statis (*flat resting pills* setinggi 4px), radar sonar tidak memancar agresif, dan teks berbunyi `● Hening (Menunggu suaramu…)`.
   - **Kondisi Berbicara**: Bar equalizer bergejolak melompat tinggi secara proporsional dengan volume suara pengguna, radar sonar memancar seirama intensitas suara, dan indikator berbunyi `● Suara terdeteksi — mic merespons (Volume: XX%)`.
2. **Desain Sentris Simetris (*Center-Weighted*)**:
   - Frekuensi vokal manusia diletakkan di tengah dan melandai ke sisi kiri-kanan, menghasilkan visualisasi gelombang suara organik layaknya aplikasi rekaman modern.
3. **Fisika Pegas Halus (*Fluid Spring Physics*)**:
   - Lonjakan bar naik cepat (*fast attack*) dan turun secara bertahap (*smooth decay*), mencegah visualizer terlihat patah-patah atau bergetar liar.

### Sistem Loading Toast Berkarakter Gamifikasi (Mascot Loading Toast)
Setiap proses asinkron yang membutuhkan waktu (seperti pengiriman rekaman audio ke server AI, sintesis suara Kokoro TTS melalui GPU/WASM CPU pada smartphone, atau pemeriksaan fonetik) kini menampilkan **Mascot Bottom Loading Toast** yang melayang dari bagian bawah layar:
- **Karakter Maskot Pip**: Karakter burung hantu robot 3D bergaya claymation yang ramah dan ekspresif:
  - `pip-thinking.png`: Saat AI sedang menganalisis jawaban suara, mengevaluasi tata bahasa, atau mencocokkan naskah.
  - `pip-audio.png`: Saat Kokoro TTS sedang memuat model atau merender gelombang suara audio dengan headphone dan nada musik.
  - `pip-success.png`: Saat respons berhasil diterima dan audio siap diputar (merayakan dengan bintang emas sebelum toast menghilang).
- **Dual Progress Bar**:
  - *Determinate Progress*: Menampilkan persentase unduhan/generasi audio real-time (0–100%) jika didukung.
  - *Indeterminate Progress*: Animasi *infinite candy-stripe shimmer* saat menunggu respons dari server AI eksternal.

### Konversi Audio Client-Side ke MP3 128kbps Mono
Untuk menghemat ruang penyimpanan server secara signifikan serta mempercepat waktu transfer jaringan di perangkat seluler pengguna:
- **Encoding MP3 128kbps Mono di Browser**: Menggunakan pustaka murni JavaScript `@breezystack/lamejs` tanpa dependensi eksternal, seluruh audio vokal diproses secara lokal langsung pada browser pengguna (`src/lib/audio.js`).
- **Penyimpanan Cache Kokoro TTS**: Hasil sintesis suara Kokoro (single speaker maupun multi-speaker composite dialog) dikonversi menjadi file MP3 mono 128kbps sebelum disimpan ke server cache shared (`POST api/tts-cache`). File yang tersimpan menyusut drastis dari ~1.5–5 MB (WAV uncompressed) menjadi hanya ~100–350 KB (MP3 128kbps).
- **Pengiriman Rekaman ke AI & Arsip Akun**: Rekaman suara mikrofon pengguna yang dikirim ke AI untuk penilaian (`POST api/assess-audio`) atau disimpan ke arsip latihan akun (`POST api/audio`) secara otomatis dikonversi ke MP3 128kbps mono di sisi klien sebelum dikirim melalui jaringan.
- **Dukungan Backend Terintegrasi**: Server PHP (`api/tts_cache.php` dan `api/index.php`) telah diperbarui untuk menerima tipe `audio/mpeg` dan `audio/mp3`, menyimpannya dengan format MP3 yang tepat, dan meneruskan format audio ke model AI upstream (Gemini / OpenRouter / Free AI key).

---

## 6. Referensi Endpoint REST API

Default root API: `https://domain.com/learnenglish/api/` (atau sesuai konfigurasi base path).

### Autentikasi & Akun
- `POST auth/register` — Mendaftarkan akun pembelajar baru.
- `POST auth/login` — Login pengguna; mengembalikan JWT token di memori dan cookie refresh `HttpOnly`.
- `POST auth/refresh` — Merotasi dan memperbarui token akses.
- `POST auth/logout` — Mencabut sesi pengguna di server.
- `GET me` — Mengambil data profil, progres, dan saldo diamond pengguna saat ini.
- `POST account/password` — Mengubah password akun.

### Pembelajaran & Konten
- `GET catalog` — Mengambil daftar materi kursus (tanpa menyertakan kunci jawaban).
- `POST listening/check` — Memeriksa jawaban kuis listening secara aman di server.
- `GET progress` & `PUT progress` — Menyimpan dan menyinkronkan status penyelesaian unit.
- `POST speech-score` — Menilai kecocokan teks naskah dan transkrip.
- `POST assess-audio` — Mengunggah audio rekaman untuk penilaian langsung fonetik, artikulasi, dan kelancaran oleh AI.
- `POST live-token` & `POST live-assessment` — Mengambil token sesi Gemini Live dan review evaluasi percakapan.
- `POST audio` & `DELETE audio/{id}` — Mengunggah dan menghapus arsip rekaman audio pengguna beserta file fisiknya.

### Studio Admin
- `GET/POST admin/courses` — Manajemen katalog kursus dan penetapan mode progres.
- `GET/POST/PUT/DELETE admin/units` — Manajemen unit speaking.
- `GET/POST/PUT/DELETE admin/listening` — Manajemen cerita dan soal listening.
- `GET/PUT admin/settings` — Pengaturan kebijakan, biaya diamond, dan provider AI.
- `GET/PUT admin/users` — Manajemen akun pengguna dan saldo diamond.
- `GET/PUT admin/ads` — Pengaturan iklan global.
- `GET/DELETE admin/tts-cache` — Manajemen cache file WAV suara Kokoro.

---

## 7. Autentikasi, Keamanan, & Sesi

- **Model Dual-Token**:
  - **Access Token (JWT HS256)**: Berlaku 15 menit dan **hanya disimpan dalam memori JavaScript (Zustand store)**. Token ini tidak pernah disimpan di `localStorage` atau `sessionStorage` sehingga kebal terhadap serangan XSS pencurian token.
  - **Refresh Token (30 Hari)**: Token acak 64 karakter disimpan sebagai cookie `HttpOnly`, `SameSite=Lax` (atau `None` untuk cross-origin HTTPS), dan `Secure`. Di database, hanya hash SHA-256 yang disimpan. Setiap kali refresh terjadi, refresh token dirotasi.
- **Enkripsi Kunci Rahasia**:
  - API Key provider AI eksternal (Gemini, OpenRouter, Clario) disimpan di database dalam bentuk terenkripsi menggunakan algoritma **AES-256-GCM** dengan kunci `APP_ENCRYPTION_KEY`.
- **Proteksi Akses File**:
  - File `.htaccess` memblokir akses HTTP langsung ke direktori database SQLite, file upload privat, dan file konfigurasi.
---

## 8. Panduan Instalasi & Menjalankan Aplikasi

### Kebutuhan Sistem
- **Node.js**: Versi 20.x atau lebih baru.
- **PHP**: Versi 8.1 atau lebih baru dengan ekstensi:
  - `pdo_sqlite`
  - `openssl`
  - `fileinfo`
  - `curl` (disarankan)

### Langkah Menjalankan di Komputer Lokal

1. **Clone Repositori & Masuk ke Folder**:
   ```bash
   git clone https://github.com/mamedun/learnenglish.git
   cd learnenglish
   ```

2. **Pasang Dependensi Frontend**:
   ```bash
   npm install
   ```

3. **Siapkan Konfigurasi Backend**:
   ```bash
   cp api/config.example.php api/config.php
   ```
   Buka `api/config.php` dan pastikan mengisi `APP_ENCRYPTION_KEY` dengan string acak minimal 32 karakter:
   ```php
   'APP_ENCRYPTION_KEY' => 'ganti-dengan-32-karakter-acak-rahasia-anda',
   ```

4. **Jalankan Migrasi Database**:
   ```bash
   php api/migrate.php
   ```
   *Skrip ini akan membuat tabel SQLite dan mengimpor katalog awal dari `api/seeds/` secara otomatis.*

5. **Jalankan Backend & Frontend**:
   - **Terminal 1 (PHP Server)**:
     ```bash
     php -S 0.0.0.0:8787 api/router.php
     ```
   - **Terminal 2 (Vite Frontend Dev)**:
     ```bash
     npm run dev
     ```

6. **Buka Aplikasi**:
   Akses `http://localhost:5173/learnenglish/` pada browser Anda.

---

## 9. Panduan Deployment Produksi (Apache & Nginx)

1. **Build Frontend**:
   Tentukan base path pada `.env.production` (default: `VITE_BASE_PATH=/learnenglish`):
   ```bash
   npm run build
   ```
   Salin isi direktori `dist/` ke direktori web publik server Anda.

2. **Konfigurasi Backend Server**:
   Tempatkan folder `api/` pada server web. Pastikan permissions folder `api/db/`, `api/uploads/`, dan `api/tts_cache/` dapat dibaca dan ditulis oleh proses web server (`www-data` / `nginx`):
   ```bash
   chmod 750 api/db api/uploads api/tts_cache
   chown -R www-data:www-data api/db api/uploads api/tts_cache
   ```

3. **Konfigurasi Nginx (Contoh Blok Lokasi)**:
   ```nginx
   # Blokir akses langsung ke folder privat
   location ^~ /learnenglish/api/db/      { return 404; }
   location ^~ /learnenglish/api/uploads/ { return 404; }
   location ^~ /learnenglish/api/seeds/   { return 404; }
   location ~* ^/learnenglish/api/(?:config(?:\.example)?|bootstrap|catalog|auth|router|migrate)\.php$ { return 404; }
   location ~* ^/learnenglish/(?:\.env.*|.*\.(?:db|sqlite|sqlite3)(?:-wal|-shm)?)$ { return 404; }

   # Teruskan request API ke PHP-FPM
   location /learnenglish/api/ {
       try_files $uri $uri/ /learnenglish/api/index.php?$query_string;
       location ~ \.php$ {
           include fastcgi_params;
           fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
           fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
       }
   }

   # SPA Frontend Fallback
   location /learnenglish/ {
       try_files $uri $uri/ /learnenglish/index.html;
   }
   ```

---

## 10. Panduan Khusus untuk Pengembang & Agen AI Berikutnya

Jika Anda adalah agen AI atau developer yang melanjutkan pekerjaan pada repositori ini:

1. **Aturan Branch Git**:
   - Sesi pengembangan ini terikat pada branch **`arena/01a0fcfc-learnenglish`**.
   - Selalu lakukan commit dan push ke branch ini (`git push origin arena/01a0fcfc-learnenglish`). Jangan beralih ke branch lain.
2. **Kesesuaian CSS & Gaya Desain**:
   - Aplikasi menggunakan kombinasi tema alam modern: nuansa hijau zamrud (`#315c45`, `#449e6b`), aksen coral hangat (`#d76154`, `#f27c70`), dan ungu AI (`#5c4bcb`, `#7867ea`).
   - Jangan menambahkan library styling eksternal baru (seperti Tailwind atau Bootstrap) karena tata letak utama sudah tertata rapi dalam `styles.css`, `overrides.css`, `theme.css`, dan modul CSS lokal.
3. **Prinsip User Experience (UX)**:
   - Hindari memunculkan dialog konfirmasi (*popup confirmation*) berulang kali sebelum tindakan wajar (seperti merekam atau mengirim penilaian); prioritaskan pengalaman pengguna yang langsung (*instant & fluid action*).
   - Pastikan setiap fitur suara memiliki feedback visual instan (*audio reactive*) sehingga pengguna tahu perangkat inputnya bekerja normal.
4. **Validasi Build**:
   - Sebelum mengakhiri sesi pengerjaan, selalu jalankan `npm run build` untuk memverifikasi bahwa seluruh bundel terkompilasi bersih tanpa peringatan error sintaks atau missing imports.

---

*SpeakUp — Learn English with Confidence, Clarity, and Flow.*
