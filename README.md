# SpeakUp — IELTS-inspired English learning

SpeakUp is a React + TypeScript + Vite application with a PHP/SQLite API. The frontend base is `/learnenglish/`; the API is nested at `/learnenglish/api/`. The app is an independent IELTS-inspired practice product, not an official IELTS service.

## Product modes and account access

- **Listening (Regular, Premium, Admin):** 18 original fixed-script lessons across A1–C2, each with deterministic multiple-choice answer checks. Lessons do not call AI. Browser speech synthesis reads the fixed scripts; voice availability/offline behavior depends on the browser and operating system. No cloud/browser speech recognition is activated. No listening IELTS band score is generated.
- **AI Lesson (Premium, Admin):** existing speaking practice and tutor feedback. Transcript-only assessments do not claim to score pronunciation or produce an overall official IELTS score. A learner may explicitly consent to send a recording once to Gemini for audio-based practice feedback. This evaluation upload is temporary and separate from the optional archive consent; archived audio is never silently re-sent later.
- **Live Lesson (Premium, Admin):** the browser streams microphone audio directly to Gemini Live over WebSocket using a single-use, short-lived token minted by PHP. The long-lived Gemini API key remains encrypted on the server. A session is capped at 20 minutes. Session audio is not stored by SpeakUp; with a learner's consent, the captured transcript is sent after the session for feedback.
- **Premium plan:** manually assigned by an administrator in v1. There is no payment gateway.
- **Admin controls:** app lockdown, close/open registration, change users between Regular and Premium, manage provider settings. Lockdown blocks non-admin API access, including existing sessions; admins can still manage the app. Closing registration blocks new signups but does not block existing logins.

## Data and security

- SQLite default: `api/db/data.db`, which deploys to `/learnenglish/api/db/data.db`.
- Audio archive default: `api/uploads/{user_id}/`, which deploys to `/learnenglish/api/uploads/{user_id}/`. Audio binaries are not stored in SQLite; DB records contain metadata and file references.
- API audio endpoints enforce authenticated ownership. The archive is separately consented to; deleting account audio removes server files.
- Database and upload folders include Apache access-deny rules. On Nginx, `.htaccess` is ignored: use the deny rules below or store these directories outside the public web root.
- Provider API keys are encrypted at rest with AES-256-GCM using `APP_ENCRYPTION_KEY`. Never put Clario/Gemini long-lived secrets in the frontend or Vite env files.
- Cross-origin API access uses an exact CORS origin allowlist with credentials. Same-origin deployments and the Vite proxy are preferred.
- Export/import ZIP remains available; archived audio inclusion is optional.

## URL layouts

### Development (preferred: Vite proxy)

- Frontend: `http://localhost:5173/learnenglish/`
- PHP API host: `https://rikisample.test/learnenglish/`
- API: `https://rikisample.test/learnenglish/api/`
- Vite proxies `/learnenglish/api/*` to the PHP host. The browser makes same-origin requests to Vite, avoiding direct dev CORS/cookie setup.

Copy `.env.development.example` to `.env.development.local` and set:

```env
VITE_API_PROXY_TARGET=https://rikisample.test
VITE_API_PROXY_PATH_PREFIX=/learnenglish
```

If instead using PHP's local development server at `http://localhost:8787/api/`, set `VITE_API_PROXY_TARGET=http://localhost:8787` and `VITE_API_PROXY_PATH_PREFIX=`.

### Production

- Frontend: `https://rikikurnia.my.id/learnenglish/`
- API: `https://rikikurnia.my.id/learnenglish/api/`
- Leave `VITE_API_BASE_URL` unset for same-origin API requests.

For a truly cross-origin deployment only, set the build-time frontend variable `VITE_API_BASE_URL=https://api.example.com/learnenglish/api`. Configure the PHP `CORS_ALLOWED_ORIGINS` to the exact frontend origin(s), and use HTTPS plus `SESSION_SAMESITE=None` so credentialed session cookies can be sent cross-site. Do not use `*` with credentialed CORS.

## Local development

Requirements: Node.js 20+, PHP 8.1+ with `pdo_sqlite`, `openssl`, `fileinfo`, sessions, and preferably `curl`.

```bash
npm ci
cp .env.example .env
cp .env.development.example .env.development.local
```

Configure server-side `.env` (keep it outside the public root where possible):

```env
APP_ENCRYPTION_KEY=<at-least-32-random-characters>
ADMIN_EMAIL=you@example.com
ADMIN_NAME=SpeakUp Admin
ADMIN_PASSWORD=<unique-password-at-least-12-characters>
CORS_ALLOWED_ORIGINS=http://localhost:5173,https://rikisample.test,https://rikikurnia.my.id
SESSION_SAMESITE=Lax
```

For Vite proxy to a local PHP server (instead of the user's `.test` virtual host), run:

```bash
php -S 0.0.0.0:8787 api/router.php
```

and change the proxy target/prefix as described above. Then run `npm run dev` and open `http://localhost:5173/learnenglish/`.

The admin account is seeded once when SQLite is first initialized. It is not recreated or elevated if its email already belongs to a user. Remove `ADMIN_PASSWORD` from the server environment after initial provisioning and rotate any API key that may have been shared previously.

## Production deployment

1. Build: `npm ci && npm run build`.
2. Copy the **contents** of `dist/` into the web root's `/learnenglish/` subfolder.
3. Copy `api/` to the site's `/learnenglish/api/` directory so `https://rikikurnia.my.id/learnenglish/api/health` reaches `api/index.php` through the included rewrite rules.
4. Configure PHP server environment or a private env file. `api/bootstrap.php` looks for the project `.env` by default; use `ENV_FILE=/secure/path/speakup.env` when supported by the host.
5. Set PHP `upload_max_filesize=16M` and `post_max_size=16M` for the consent-based temporary WAV assessment (app-level cap remains 12 MB) and `max_execution_time=90` for provider requests. Set strong `APP_ENCRYPTION_KEY`, `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD`, and a strict `CORS_ALLOWED_ORIGINS` list. Set `DATA_DB_PATH` and `UPLOADS_DIR` to absolute writable paths if you do not want storage under the API directory.
6. Ensure PHP can write to `/learnenglish/api/db/` and `/learnenglish/api/uploads/`, but the web server cannot serve those folders directly. Keep DB/WAL files and uploaded audio out of public static paths where possible.
7. Verify PHP modules, HTTPS, API health, user registration/login, admin plan changes, and a user-owned audio download before launch. Configure encrypted Gemini/Clario keys in Admin.
8. The user-supplied Flow images are already in `public/images/listening/` and `public/images/speaking/`, integrated into the Listening and Speaking lessons. See [IMAGE_PROMPTS.md](./IMAGE_PROMPTS.md) for the asset map and prompts for future variations.

### Nginx deny example

If data folders are under the public API directory, add equivalent rules to the Nginx server block (adjust root/paths):

```nginx
location ^~ /learnenglish/api/db/      { deny all; return 404; }
location ^~ /learnenglish/api/uploads/ { deny all; return 404; }
location ~* ^/learnenglish/(?:\.env.*|.*\.(?:db|sqlite|sqlite3|log)(?:-wal|-shm)?)$ { deny all; return 404; }
```

Also ensure PHP route rewriting and the SPA fallback are ordered so `/learnenglish/api/*` goes to PHP, not to `index.html`. Apache `.htaccess` rules are provided in the API and its `db/` and `uploads/` folders; do not blindly overwrite existing production rewrite rules.

Back up SQLite and audio uploads together. Do not include secrets or live data in a public frontend build or ZIP shared externally.

## API routes (prefix `/learnenglish/api/`)

- `GET health`, `GET me`, `POST register`, `POST login`, `POST logout`
- `GET/PUT/DELETE progress` — authenticated account progress
- `POST audio`, `GET audio`, `GET audio/{id}` — Premium/Admin archive operations, user-owned audio
- `POST assess-audio` — Premium/Admin; requires multipart consent field and WAV audio, sends once to Gemini without persisting in the SpeakUp archive
- `POST chat` — Premium/Admin transcript-based AI Lesson
- `POST live-token` — Premium/Admin; backend-minted, single-use Gemini ephemeral token
- `POST live-assessment` — Premium/Admin post-session transcript feedback
- `GET/PUT admin/settings`, `GET/PUT admin/users` — admin only
- `GET models` — Premium/Admin provider catalog request

## Course and content boundaries

- The speaking course contains 48 original A1–C2 IELTS-inspired units. CEFR/IELTS labels are rough learning guides, not exact equivalencies; IELTS does not publish an exact CEFR-to-band conversion.
- IELTS Speaking format references and scoring caveats are in [IELTS_COURSE_DESIGN.md](./IELTS_COURSE_DESIGN.md).
- Picture-description practice is supplementary, not an official IELTS Speaking test part.
- The video question bank remains empty until a specific short video is human-verified for source, rights, transcript/subtitles, level and answer key. No video activities are fabricated.
- Local/offline speech recognition is not included. Browser SpeechRecognition is not presented as local because browser implementations may use remote processing.
