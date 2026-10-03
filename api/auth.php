<?php
declare(strict_types=1);

// Access JWT: long-lived access token with rotating refresh token.
// Refresh token is stored as a SHA-256 hash in SQLite with a grace period
// for concurrent tab/network races, and persists for 365 days (like Netflix / Duolingo).
const ACCESS_TTL = 7 * 24 * 60 * 60;
const REFRESH_TTL = 365 * 24 * 60 * 60;
const ROTATION_GRACE_PERIOD = 120;

function auth_install(PDO $pdo): void
{
    $pdo->exec("CREATE TABLE IF NOT EXISTS auth_sessions (
        sid TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        refresh_hash TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        revoked_at INTEGER
    )");
    $pdo->exec('CREATE INDEX IF NOT EXISTS auth_sessions_user ON auth_sessions(user_id)');
    $cols = array_column($pdo->query('PRAGMA table_info(auth_sessions)')->fetchAll(), 'name');
    if (!in_array('previous_refresh_hash', $cols, true)) {
        $pdo->exec('ALTER TABLE auth_sessions ADD COLUMN previous_refresh_hash TEXT');
    }
    if (!in_array('rotated_at', $cols, true)) {
        $pdo->exec('ALTER TABLE auth_sessions ADD COLUMN rotated_at INTEGER');
    }
}

function auth_secure_request(): bool
{
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') return true;
    // Never trust arbitrary X-Forwarded-Proto sent by clients unless enabled
    // behind a trusted reverse proxy that OVERWRITES that request header.
    return (bool) cfg('TRUST_HTTPS_PROXY', false)
        && strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
}

function auth_cookie_options(int $expires): array
{
    $sameSite = (string) cfg('SESSION_SAMESITE', 'Lax');
    if (!in_array($sameSite, ['Lax', 'Strict', 'None'], true)) $sameSite = 'Lax';
    $secure = auth_secure_request();
    if ($sameSite === 'None' && !$secure) {
        respond(['error' => 'Cookie SameSite=None memerlukan HTTPS dan konfigurasi reverse proxy tepercaya.', 'code' => 'https_required'], 503);
    }
    return ['expires' => $expires, 'path' => app_public_path('api') . '/', 'secure' => $secure, 'httponly' => true, 'samesite' => $sameSite];
}

function auth_set_refresh_cookie(string $value): void
{
    setcookie('speakup_refresh', $value, auth_cookie_options(time() + REFRESH_TTL));
}
function auth_clear_refresh_cookie(): void
{
    setcookie('speakup_refresh', '', auth_cookie_options(time() - 3600));
}

function auth_b64(string $bytes): string
{
    return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
}
function auth_unb64(string $value): string|false
{
    if ($value === '' || !preg_match('/^[A-Za-z0-9_-]+$/D', $value)) return false;
    return base64_decode(strtr($value, '-_', '+/'), true);
}
function auth_key(): string
{
    $master = crypto_key();
    if ($master === '') respond(['error' => 'Isi APP_ENCRYPTION_KEY (minimal 32 karakter acak) di api/config.php sebelum login.', 'code' => 'auth_not_configured'], 503);
    return hash_hmac('sha256', 'SpeakUp access JWT v1', $master, true);
}
function auth_access_token(int $userId, string $sid): string
{
    $header = auth_b64(json_encode(['alg' => 'HS256', 'typ' => 'JWT'], JSON_THROW_ON_ERROR));
    $now = time();
    $payload = auth_b64(json_encode(['iss' => 'SpeakUp', 'sub' => (string) $userId, 'sid' => $sid, 'iat' => $now, 'exp' => $now + ACCESS_TTL], JSON_THROW_ON_ERROR));
    $content = $header . '.' . $payload;
    return $content . '.' . auth_b64(hash_hmac('sha256', $content, auth_key(), true));
}
function auth_claims(string $jwt): ?array
{
    if (strlen($jwt) > 3000) return null;
    $parts = explode('.', $jwt);
    if (count($parts) !== 3) return null;
    [$header, $payload, $signature] = $parts;
    $decodedHeader = auth_unb64($header);
    $decodedPayload = auth_unb64($payload);
    if ($decodedHeader === false || $decodedPayload === false || auth_unb64($signature) === false || crypto_key() === '') return null;
    $parsedHeader = json_decode($decodedHeader, true);
    $claims = json_decode($decodedPayload, true);
    if (!is_array($parsedHeader) || $parsedHeader !== ['alg' => 'HS256', 'typ' => 'JWT'] || !is_array($claims)) return null;
    $content = $header . '.' . $payload;
    if (!hash_equals(auth_b64(hash_hmac('sha256', $content, auth_key(), true)), $signature)) return null;
    $now = time();
    if (($claims['iss'] ?? null) !== 'SpeakUp'
        || !is_string($claims['sub'] ?? null) || !ctype_digit($claims['sub']) || (int) $claims['sub'] < 1
        || !is_string($claims['sid'] ?? null) || !preg_match('/^[a-f0-9]{32}$/D', $claims['sid'])
        || !is_int($claims['iat'] ?? null) || $claims['iat'] > $now + 60
        || !is_int($claims['exp'] ?? null) || $claims['exp'] <= $now || $claims['exp'] - $claims['iat'] > ACCESS_TTL
    ) return null;
    return $claims;
}

function auth_bearer_header(): string
{
    return trim((string) ($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? ''));
}
function auth_bearer_user(): ?array
{
    $header = auth_bearer_header();
    if (!preg_match('/^Bearer ([A-Za-z0-9._-]+)$/Di', $header, $match)) return null;
    $claims = auth_claims($match[1]);
    if (!$claims) return null;
    $q = db()->prepare('SELECT u.id,u.email,u.name,u.role,u.plan,u.created_at,u.must_change_password
        FROM users u JOIN auth_sessions s ON u.id=s.user_id
        WHERE s.sid=? AND s.user_id=? AND s.revoked_at IS NULL AND s.expires_at>?');
    $q->execute([$claims['sid'], (int) $claims['sub'], time()]);
    return $q->fetch() ?: null;
}

function auth_legacy_user(): ?array
{
    if (session_status() !== PHP_SESSION_ACTIVE || empty($_SESSION['user_id'])) return null;
    $q = db()->prepare('SELECT id,email,name,role,plan,created_at,must_change_password FROM users WHERE id=?');
    $q->execute([(int) $_SESSION['user_id']]);
    return $q->fetch() ?: null;
}

function auth_issue(array $user): array
{
    // Validate both signing key and cookie configuration BEFORE recording a new session.
    auth_key();
    auth_cookie_options(time() + REFRESH_TTL);
    $pdo = db();
    $sid = bin2hex(random_bytes(16));
    $refresh = auth_b64(random_bytes(32));
    $now = time();
    // A successful login in the same browser replaces its previous refresh session.
    $previous = (string) ($_COOKIE['speakup_refresh'] ?? '');
    if ($previous !== '') $pdo->prepare('UPDATE auth_sessions SET revoked_at=? WHERE refresh_hash=?')
        ->execute([$now, hash('sha256', $previous)]);
    $pdo->prepare('INSERT INTO auth_sessions(sid,user_id,refresh_hash,created_at,expires_at) VALUES(?,?,?,?,?)')
        ->execute([$sid, (int) $user['id'], hash('sha256', $refresh), $now, $now + REFRESH_TTL]);
    $pdo->prepare('DELETE FROM auth_sessions WHERE expires_at<? OR revoked_at<?')->execute([$now - 86400, $now - 86400]);
    auth_set_refresh_cookie($refresh);
    return ['user' => public_user($user), 'access_token' => auth_access_token((int) $user['id'], $sid), 'expires_in' => ACCESS_TTL];
}

function auth_refresh(): array
{
    $cookie = (string) ($_COOKIE['speakup_refresh'] ?? '');
    if ($cookie === '' && ($legacy = auth_legacy_user())) {
        // One-time migration of valid pre-JWT PHP sessions on upgrade.
        $_SESSION = [];
        session_destroy();
        setcookie('speakup_session', '', auth_cookie_options(time() - 3600));
        return auth_issue($legacy);
    }
    if (strlen($cookie) < 40 || strlen($cookie) > 128) respond(['error' => 'Sesi telah berakhir.', 'code' => 'refresh_expired'], 401);
    $pdo = db();
    // Use raw exec() for both BEGIN and COMMIT/ROLLBACK because on PHP 8.x +
    // Windows pdo_sqlite, $pdo->commit()/rollBack()/inTransaction() can
    // incorrectly report "no active transaction" right after exec('BEGIN ...').
    $pdo->exec('BEGIN IMMEDIATE'); // serialize rotation across simultaneous refresh requests
    try {
        $hash = hash('sha256', $cookie);
        $now = time();
        $q = $pdo->prepare('SELECT u.id,u.email,u.name,u.role,u.plan,u.created_at,u.must_change_password,s.sid,s.refresh_hash
            FROM auth_sessions s JOIN users u ON u.id=s.user_id
            WHERE (s.refresh_hash=? OR (s.previous_refresh_hash=? AND s.rotated_at>?))
              AND s.revoked_at IS NULL AND s.expires_at>?');
        $q->execute([$hash, $hash, $now - ROTATION_GRACE_PERIOD, $now]);
        $row = $q->fetch();
        if (!$row) {
            try { $pdo->exec('ROLLBACK'); } catch (Throwable $ignored) {}
            respond(['error' => 'Sesi telah berakhir. Silakan masuk kembali.', 'code' => 'refresh_expired'], 401);
        }
        if (lockdown_on() && $row['role'] !== 'admin') {
            try { $pdo->exec('ROLLBACK'); } catch (Throwable $ignored) {}
            respond(['error' => 'Aplikasi sedang dikunci sementara oleh admin.', 'locked' => true], 423);
        }
        // If matched within grace window by previous_refresh_hash, someone already rotated. Return fresh access token.
        if ($row['refresh_hash'] !== $hash) {
            $pdo->exec('COMMIT');
            return ['user' => public_user($row), 'access_token' => auth_access_token((int) $row['id'], $row['sid']), 'expires_in' => ACCESS_TTL];
        }
        $next = auth_b64(random_bytes(32));
        $pdo->prepare('UPDATE auth_sessions SET previous_refresh_hash=refresh_hash, rotated_at=?, refresh_hash=?, expires_at=? WHERE sid=?')
            ->execute([$now, hash('sha256', $next), $now + REFRESH_TTL, $row['sid']]);
        $pdo->exec('COMMIT');
        auth_set_refresh_cookie($next);
        return ['user' => public_user($row), 'access_token' => auth_access_token((int) $row['id'], $row['sid']), 'expires_in' => ACCESS_TTL];
    } catch (Throwable $e) {
        try { $pdo->exec('ROLLBACK'); } catch (Throwable $ignored) {}
        throw $e;
    }
}
function auth_revoke_user(int $userId): void
{
    db()->prepare('UPDATE auth_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL')->execute([time(), $userId]);
}
function auth_logout(): void
{
    $token = (string) ($_COOKIE['speakup_refresh'] ?? '');
    if ($token !== '') db()->prepare('UPDATE auth_sessions SET revoked_at=? WHERE refresh_hash=?')->execute([time(), hash('sha256', $token)]);
    $header = auth_bearer_header();
    if (preg_match('/^Bearer ([A-Za-z0-9._-]+)$/Di', $header, $match) && ($claims = auth_claims($match[1]))) {
        db()->prepare('UPDATE auth_sessions SET revoked_at=? WHERE sid=? AND user_id=?')->execute([time(), $claims['sid'], (int) $claims['sub']]);
    }
    auth_clear_refresh_cookie();
    if (session_status() === PHP_SESSION_ACTIVE) {
        $_SESSION = [];
        session_destroy();
        setcookie('speakup_session', '', auth_cookie_options(time() - 3600));
    }
}
