# SpeakUp — petualangan belajar bahasa Inggris

Aplikasi React **JSX** + Vite dan API PHP/SQLite untuk latihan bahasa Inggris yang terinspirasi IELTS. URL frontend: `/learnenglish/`; API: `/learnenglish/api/`. Ini **bukan** tes atau sertifikasi IELTS resmi.

## Arsitektur

- **Frontend:** `src/app/` merangkai fitur; `src/features/{auth,admin,dashboard,listening,speaking,live,progress,settings}/` berisi halaman; `src/components/` berisi status loading/error; `src/store/` menyimpan auth dan progres global dengan Zustand; `src/api.js` menangani HTTP, Bearer token, satu proses refresh untuk request bersamaan, dan retry. Modul yang jarang dibuka di-*lazy load* dengan skeleton, status aksesibel, dan fallback jika unduhan modul gagal. Semua tetap JSX/JavaScript.
- **Pilihan dependensi:** Zustand dipakai karena state sesi dan belajar digunakan lintas halaman. `lucide-react` dan **Sonner** sudah menyediakan ikon/toast; tidak ditambah React-Toastify. `fetch` yang ada mendukung file biner, error, dan retry sehingga axios belum diperlukan. ECharts, TanStack Table, React Player, dan react-pdf belum diperlukan: belum ada grafik kompleks/tabel besar/video terverifikasi/PDF. Tambahkan hanya saat fiturnya benar-benar ada.
- **Konten:** SQLite menyimpan 6 jenjang A1–C2, 48 unit speaking, 18 lesson listening, 36 soal, dan kunci. `api/seeds/catalog.json` digunakan sekali saat katalog kosong. Studio Admin mengedit/publikasi/arsip langsung di SQLite; kunci listening tidak dikirim ke katalog peserta dan dicek melalui `POST listening/check`.
- **Batas produk:** Regular mendapat listening; Premium/Admin mendapat AI Speaking/Live. Audio arsip memerlukan persetujuan terpisah dari pengiriman audio ke AI. XP/streak/badge adalah motivasi, bukan skor IELTS atau proteksi anti-cheat. Bank video tetap kosong sampai sumber dan kunci soal diverifikasi. Lihat [IELTS_COURSE_DESIGN.md](./IELTS_COURSE_DESIGN.md) dan [IMAGE_PROMPTS.md](./IMAGE_PROMPTS.md).
- **TTS:** Kokoro melalui TTS.Rocks menjadi default browser untuk semua akun, dengan suara pilihan, WebGPU/WASM, preload, dan cache model di IndexedDB. Browser Native tetap dapat dipilih. Model pertama kali diunduh ke perangkat.
- **AI global & input speaking:** Admin memilih satu provider global (Clario atau IchanLabs) dan mode live transcription browser (adapter Web Speech API mengikuti pola `paulmagadi/speech-to-text-converter`) vs rekaman yang dikirim setelah persetujuan. Gemini Live tetap memakai alurnya sendiri. Adapter IchanLabs sengaja belum mengirim request sampai sample kontrak API resmi tersedia; sistem tidak menebak header/path/payload dan tidak fallback ke Clario saat IchanLabs dipilih. Latihan read-aloud membandingkan kata dengan tanda baca diabaikan; kecocokan 90% menyelesaikan speaking.

### Login yang bertahan tanpa menyimpan token di browser storage

PHP membuat **JWT akses HS256 berlaku 15 menit** dan menyimpannya hanya dalam memori Zustand; token tidak masuk `localStorage`. **Refresh token acak berlaku 30 hari sejak aktivitas terakhir**, dirotasi pada setiap `POST auth/refresh`, dikirim sebagai cookie `HttpOnly`, `SameSite=Lax` (default), dan hanya hash SHA-256-nya yang disimpan di tabel `auth_sessions`. Akses dipulihkan setelah reload; jika JWT kedaluwarsa, frontend me-refresh sekali untuk request yang sedang berjalan. Logout mencabut sesi di server; penggantian password mencabut semua sesi lama. User lama yang masih memiliki sesi PHP valid dimigrasikan sekali saat refresh. Setelah 30 hari tanpa aktivitas, login ulang tetap diperlukan.

Untuk API beda origin, atur allowlist origin persis, HTTPS, dan `SESSION_SAMESITE=None`. Cookie `Secure` diwajibkan. Jika PHP berada di belakang proxy HTTPS, aktifkan `TRUST_HTTPS_PROXY` **hanya jika proxy tepercaya menimpa** header `X-Forwarded-Proto`. Gunakan HTTPS di produksi; jangan gunakan `*` untuk CORS berkredensial. Jangan mengganti `APP_ENCRYPTION_KEY` tanpa rencana rotasi: JWT lama terputus dan API key provider terenkripsi mungkin tidak dapat dibaca.

### Mengapa katalog di database?

**Pro:** Admin dapat memperbarui materi tanpa rebuild; semua akun memakai katalog yang sama; kunci soal tetap di server; arsip mempertahankan ID/progres. **Kontra:** PHP/SQLite harus tersedia dan dapat menulis, termasuk direktori untuk WAL; butuh backup dan migrasi skema. Seed JSON yang diedit setelah instalasi tidak menyinkronkan database lama. Mengedit soal mengganti ID pertanyaan; hindari publikasi saat peserta sedang mengerjakannya.

## Konfigurasi: `.env*` hanya untuk frontend, `config.php` hanya untuk PHP

**PHP tidak membaca `.env`, `ENV_FILE`, atau `getenv()` lagi.** Semua konfigurasi backend berasal dari `api/config.php` (tidak masuk Git) yang mengembalikan array PHP. `api/config.example.php` memuat default aman **tanpa rahasia**. Di server:

```bash
cp api/config.example.php api/config.php
chmod 600 api/config.php
```

Edit file privat itu, minimal `APP_ENCRYPTION_KEY` (>=32 karakter acak), `ADMIN_EMAIL` dan `ADMIN_PASSWORD` bootstrap jika admin belum ada, `DATA_DB_PATH`, `UPLOADS_DIR`, dan `CORS_ALLOWED_ORIGINS`. Untuk database yang sudah ada, gunakan path **absolut** ke file yang benar (misalnya `__DIR__ . '/db/data.db'`); path relatif dalam config diartikan relatif terhadap `api/`, bukan working directory PHP. Akun admin hanya dibuat jika email tersebut belum ada; perubahan password di config tidak mereset akun. Setelah login awal admin wajib mengganti password (baru minimal 12 karakter); hapus password bootstrap dari config sesudahnya.

**Jangan commit atau kirim `api/config.php` ke web sebagai file publik.** Apache `.htaccess` menghalangi akses langsung ke config, helper, seed, DB, dan upload. Di Nginx `.htaccess` tidak berlaku: tambahkan deny untuk config dan folder privat. Idealnya simpan DB/upload di luar web root melalui path di `api/config.php`.

Frontend menggunakan `.env.development.local` / `.env.production.local` yang **hanya** berisi variabel `VITE_*`; salin dari `.env.development.example` / `.env.production.example` jika perlu. Vite default mem-proxy PHP lokal; produksi same-origin memakai `/learnenglish/api` otomatis tanpa `VITE_API_BASE_URL`. Jika backend pengembangan di `rikisample.test`, set `VITE_API_PROXY_TARGET=https://rikisample.test` dan `VITE_API_PROXY_PATH_PREFIX=/learnenglish`; jika backend lokal di port 8787, gunakan `VITE_API_PROXY_TARGET=http://127.0.0.1:8787` dan `VITE_API_PROXY_PATH_PREFIX=`. Jangan pernah menaruh kredensial PHP/API key di `VITE_*`.

### Jalankan lokal

Persyaratan: Node.js 20+, PHP 8.1+ dengan `pdo_sqlite`, `openssl`, `fileinfo`, session; `curl` disarankan untuk provider (ada fallback HTTP stream).

```bash
npm ci
cp api/config.example.php api/config.php
# isi APP_ENCRYPTION_KEY dan kredensial bootstrap secara privat
php -S 0.0.0.0:8787 api/router.php    # terminal pertama
npm run dev                            # terminal kedua
```

Buka `http://localhost:5173/learnenglish/`. Login/bootstrap gagal bila `APP_ENCRYPTION_KEY` masih kosong (health menampilkan `auth_configured:false`). Password user baru minimal 10 karakter. Untuk mengecek API: `http://localhost:8787/learnenglish/api/health`. Browser di Vite memakai URL relatif dan proxy; tidak memanggil `localhost` dari kode frontend yang di-deploy.

## Menangani `GET /api/health` dan `/api/me` HTTP 503

**503 bukan kesalahan `api.js` di browser**: server PHP merespons gagal menyiapkan SQLite. File `.db` yang sudah ada **belum membuktikan** bahwa PHP web server memiliki driver/akses untuk membukanya. Versi API ini menambahkan `code` dan diagnostik boolean aman pada respons 503 `health`/`me`; detail exception lengkap masuk log PHP dan hanya boleh ditampilkan jika `APP_DEBUG=true` di lingkungan privat.

| `code`/indikator | Langkah perbaikan |
| --- | --- |
| `missing_pdo_sqlite`, `diagnostics.pdo_sqlite=false` | Aktifkan **PDO_SQLITE pada PHP yang menjalankan situs** (PHP-FPM/Apache), bukan hanya PHP CLI; periksa versi/ekstensi di panel hosting. Kode aplikasi tidak bisa memasang ekstensi hosting. |
| `database_directory_missing` atau `directory_writable=false` | Cocokkan `DATA_DB_PATH` dengan lokasi DB lama yang benar. Beri user proses PHP izin menulis **dan traversal** ke direktori DB; WAL/SHM perlu dibuat di folder ini. Jangan gunakan `chmod 777`. |
| `database_permissions` / `database_writable=false` saat file ada | Pastikan file `.db` dapat dibaca/ditulis oleh user PHP-FPM dan direktori induknya juga writable. Periksa kepemilikan sesudah upload/deploy serta ruang disk. |
| `database_unavailable` padahal izin dan driver benar | Periksa log PHP untuk pesan SQLite spesifik, seed yang hilang, DB korup/terkunci, atau lokasi/path keliru. Cadangkan DB sebelum memperbaiki; **jangan menghapus DB pengguna untuk mengatasi 503**. |
| `health` sehat namun `auth_configured=false` | Isi `APP_ENCRYPTION_KEY` dengan nilai stabil di `api/config.php` privat; login memerlukan kunci ini. |

Jika Vite masih mem-proxy ke `https://rikisample.test` dan alamat tersebut 503, ubah `.env.development.local` agar proxy menuju **PHP yang benar**, lalu restart Vite. Jika 503 terjadi di hosting `.test` atau produksi, deploy kode/config baru dan perbaiki ekstensi/izin **di hosting tersebut**; perubahan pada repo lokal tidak otomatis memperbaiki server yang sedang aktif.

## Deploy produksi

1. `npm ci && npm run build`, salin **isi** `dist/` ke `/learnenglish/` web root. Salin `api/` (termasuk seed dan `.htaccess`) ke `/learnenglish/api/`. Pastikan SPA fallback tidak menangkap API. Buat `api/config.php` privat pada server **sebelum** mengakses API baru; jangan menyalin config development atau `.env` lama ke frontend.
2. Konfigurasikan `DATA_DB_PATH` ke SQLite yang **sudah berjalan** jika upgrade; pertahankan database/progres, jangan membuat DB baru tanpa sengaja. Proses PHP harus dapat membuat tabel `auth_sessions`, membaca/menulis DB dan menulis di direktori untuk SQLite WAL. Simpan `APP_ENCRYPTION_KEY` yang sama dengan konfigurasi sebelumnya agar API key terenkripsi tetap dapat dibaca. Backup SQLite yang konsisten (termasuk WAL aktif) dan audio bersama.
3. Di Apache, `.htaccess` melarang akses file privat; di **Nginx** tambahkan aturan setara (sesuaikan server block dan urutan rewrite):

   ```nginx
   location ^~ /learnenglish/api/db/      { return 404; }
   location ^~ /learnenglish/api/uploads/ { return 404; }
   location ^~ /learnenglish/api/seeds/   { return 404; }
   location ~* ^/learnenglish/api/(?:config(?:\.example)?|bootstrap|catalog|auth|router)\.php$ { return 404; }
   location ~* ^/learnenglish/(?:\.env.*|.*\.(?:db|sqlite|sqlite3|log)(?:-wal|-shm)?)$ { return 404; }
   ```

4. Gunakan HTTPS. Untuk frontend/API pada origin yang sama biarkan `SESSION_SAMESITE=Lax` dan `VITE_API_BASE_URL` kosong; untuk beda origin HTTPS, konfigurasi `CORS_ALLOWED_ORIGINS` (daftar origin frontend), `SESSION_SAMESITE=None`, dan URL API frontend `VITE_API_BASE_URL` saat build. Header `Authorization` diizinkan untuk CORS origin terdaftar.
5. Atur PHP `upload_max_filesize=16M`, `post_max_size=16M`, `max_execution_time=90` untuk evaluasi WAV ber-consent (batas aplikasi 12 MB). API key provider dienkripsi dengan AES-256-GCM menggunakan `APP_ENCRYPTION_KEY`; backup kunci itu secara privat.
6. Uji `health`, pendaftaran/login, reload/refresh, logout, progres Regular, perubahan password admin, Studio, batas Premium, dan akses audio berdasarkan kepemilikan. Respons health yang sehat tidak sendiri membuktikan semua fitur/konfigurasi provider telah diuji.

## Endpoint penting (`/learnenglish/api/`)

- `GET health`, `GET me`, `POST register/login/logout`, `POST auth/refresh`, `POST account/password`
- `GET catalog` (tanpa kunci untuk peserta), `POST listening/check` (koreksi oleh server)
- `GET/PUT/DELETE progress`; `GET admin/catalog`, `POST/PUT/DELETE admin/units` dan `admin/listening`, `PUT admin/levels/{id}`
- `GET/POST/PUT admin/settings`, `GET/POST/PUT/DELETE admin/users`, `GET app-config`; `POST/GET/DELETE audio`, `POST assess-audio`, `POST chat`, `POST live-token`, `POST live-assessment`, `GET models`

## Pengujian tanpa menyentuh database pengguna

```bash
npm run build
npm audit --omit=dev --audit-level=high
python3 tests/prepare_smoke_api.py
# start PHP dari path .../.arena/smoke-api-*/api yang baru dicetak di atas:
# php -S 0.0.0.0:8788 /path/tercetak/router.php
SMOKE_ADMIN_EMAIL=smoke-admin@example.invalid \
SMOKE_ADMIN_PASSWORD=smoke-bootstrap-password \
SMOKE_API_BASE=http://127.0.0.1:8788/learnenglish/api python3 tests/smoke_api.py
```

Script membuat **salinan API dengan config.php, password, key, dan DB tes yang terpisah**, tidak membaca config/SQLite live. `smoke_api.py` memeriksa login, refresh/rotasi, revokasi saat logout/ganti password, hak akses, seed 6/48/18/36, CRUD user/katalog, koreksi jawaban server, progres, konfigurasi mode/provider global, no-fallback IchanLabs, CORS, lockdown, dan pendaftaran. `node tests/speech_similarity.mjs` menguji tanda baca dan ambang 90%. Jangan arahkan tes destruktif ini ke server produksi. Tes browser manual: reload setelah login tidak keluar; buka modul saat loading; selesaikan listening dan pastikan XP persisten; admin wajib ganti password awal dan dapat menyunting katalog.
