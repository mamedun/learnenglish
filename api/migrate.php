<?php
declare(strict_types=1);

/**
 * SpeakUp Database Migration & Initial Seeder
 *
 * Usage via CLI:
 *   php api/migrate.php
 *
 * Usage via browser / dev server:
 *   http://localhost:8787/migrate.php
 */

require_once __DIR__ . '/bootstrap.php';

$isCli = (PHP_SAPI === 'cli');

function log_msg(string $status, string $message): void
{
    global $isCli;
    if ($isCli) {
        $badge = match ($status) {
            'OK' => "\033[32m[OK]\033[0m",
            'INFO' => "\033[36m[INFO]\033[0m",
            'WARN' => "\033[33m[WARN]\033[0m",
            'ERROR' => "\033[31m[ERROR]\033[0m",
            default => "[$status]",
        };
        echo "{$badge} {$message}\n";
    } else {
        $color = match ($status) {
            'OK' => '#2e7d32',
            'INFO' => '#0288d1',
            'WARN' => '#ed6c02',
            'ERROR' => '#d32f2f',
            default => '#333',
        };
        echo "<div style='font-family:monospace;margin:4px 0;'><b style='color:{$color}'>[{$status}]</b> " . htmlspecialchars($message) . "</div>\n";
    }
}

if (!$isCli) {
    header('Content-Type: text/html; charset=utf-8');
    echo "<!DOCTYPE html><html><head><title>SpeakUp Migration</title><style>body{font-family:system-ui,sans-serif;max-width:800px;margin:30px auto;padding:20px;background:#fbfaff;color:#292450;}pre{background:#fff;border:1px solid #e0dcf5;padding:16px;border-radius:12px;overflow:auto;}b{color:#5846c8;}</style></head><body><h2>🚀 SpeakUp Database Migration & Seed</h2><pre>";
} else {
    echo "=================================================\n";
    echo "  SpeakUp Database Migration & Seed Utility      \n";
    echo "=================================================\n\n";
}

try {
    // 1. Check & prepare directories
    $dbPath = (string) cfg('DATA_DB_PATH', __DIR__ . '/db/data.db');
    if ($dbPath[0] !== '/' && !preg_match('/^[a-zA-Z]:[\\\\\/]/', $dbPath)) {
        $dbPath = __DIR__ . '/' . $dbPath;
    }
    $dbDir = dirname($dbPath);
    if (!is_dir($dbDir)) {
        mkdir($dbDir, 0700, true);
        log_msg('OK', "Membuat direktori database: {$dbDir}");
    }
    $uploadsDir = (string) cfg('UPLOADS_DIR', __DIR__ . '/uploads');
    if (!is_dir($uploadsDir)) {
        mkdir($uploadsDir, 0700, true);
        log_msg('OK', "Membuat direktori uploads: {$uploadsDir}");
    }
    $ttsCacheDir = (string) cfg('TTS_CACHE_DIR', __DIR__ . '/uploads/tts-cache');
    if (!is_dir($ttsCacheDir)) {
        mkdir($ttsCacheDir, 0700, true);
        log_msg('OK', "Membuat direktori TTS cache: {$ttsCacheDir}");
    }

    log_msg('INFO', "Koneksi ke database SQLite: {$dbPath}");
    $pdo = new PDO('sqlite:' . $dbPath, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    @chmod($dbPath, 0600);
    $pdo->exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');

    // 2. Base tables
    log_msg('INFO', 'Memverifikasi dan membuat tabel-tabel utama...');
    $pdo->exec("CREATE TABLE IF NOT EXISTS users(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user')),
        plan TEXT NOT NULL DEFAULT 'regular' CHECK(plan IN ('regular','premium')),
        created_at TEXT NOT NULL,
        must_change_password INTEGER NOT NULL DEFAULT 0
    );");

    $userCols = $pdo->query('PRAGMA table_info(users)')->fetchAll();
    $userColNames = array_column($userCols, 'name');
    if (!in_array('plan', $userColNames, true)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'regular'");
    }
    if (!in_array('must_change_password', $userColNames, true)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0");
    }
    if (!in_array('diamonds', $userColNames, true)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN diamonds INTEGER NOT NULL DEFAULT 0 CHECK(diamonds >= 0)");
    }

    $pdo->exec("CREATE TABLE IF NOT EXISTS progress(
        user_id INTEGER PRIMARY KEY,
        payload TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );");

    $pdo->exec("CREATE TABLE IF NOT EXISTS app_settings(
        setting_key TEXT PRIMARY KEY,
        setting_value TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );");

    $pdo->exec("CREATE TABLE IF NOT EXISTS audio_assets(
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        client_ref TEXT,
        mime TEXT NOT NULL,
        extension TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );");

    $pdo->exec("CREATE TABLE IF NOT EXISTS shared_tts_cache(
        cache_key TEXT PRIMARY KEY,
        content_type TEXT NOT NULL,
        content_id TEXT NOT NULL,
        source_revision TEXT NOT NULL,
        voice_id TEXT NOT NULL,
        mime TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        last_accessed_at TEXT NOT NULL
    );");
    $pdo->exec('CREATE INDEX IF NOT EXISTS shared_tts_lru ON shared_tts_cache(last_accessed_at, created_at);');

    // 3. Module installations
    require_once __DIR__ . '/auth.php';
    require_once __DIR__ . '/commerce.php';
    require_once __DIR__ . '/catalog.php';
    require_once __DIR__ . '/courseware.php';

    auth_install($pdo);
    log_msg('OK', 'Tabel autentikasi & sesi (auth_sessions) siap.');

    commerce_install($pdo);
    log_msg('OK', 'Tabel transaksi diamond & wallet siap.');

    catalog_install($pdo);
    log_msg('OK', 'Tabel katalog IELTS & listening siap.');

    courseware_install($pdo);
    log_msg('OK', 'Tabel courseware, unit materi, iklan & enrollments siap.');

    // 4. Seed Admin user
    $adminEmailRaw = trim((string) cfg('ADMIN_EMAIL', 'admin@speakup.id'));
    $adminEmail = strtolower($adminEmailRaw);
    if ($adminEmail === '' || $adminEmail === 'admin' || !str_contains($adminEmail, '@')) {
        $adminEmail = 'admin@speakup.id';
    }
    $adminName = (string) cfg('ADMIN_NAME', 'SpeakUp Administrator');
    $adminPassword = (string) cfg('ADMIN_PASSWORD', 'permenfox');
    if ($adminPassword === '' || strlen($adminPassword) < 6 || str_contains($adminPassword, 'replace_with')) {
        $adminPassword = 'permenfox';
    }

    $findAdmin = $pdo->prepare('SELECT id, role FROM users WHERE email=? OR email=?');
    $findAdmin->execute([$adminEmail, 'admin@speakup.id']);
    $existingAdmin = $findAdmin->fetch();

    if ($existingAdmin) {
        $pdo->prepare("UPDATE users SET role='admin', plan='premium', password_hash=?, must_change_password=0 WHERE id=?")
            ->execute([password_hash($adminPassword, PASSWORD_DEFAULT), (int)$existingAdmin['id']]);
        log_msg('OK', "Akun Administrator diperbarui: {$adminEmail} (password: {$adminPassword})");
    } else {
        $pdo->prepare("INSERT INTO users(email, name, password_hash, role, plan, created_at, must_change_password) VALUES(?,?,?,?,?,?,0)")
            ->execute([$adminEmail, $adminName, password_hash($adminPassword, PASSWORD_DEFAULT), 'admin', 'premium', gmdate('c')]);
        log_msg('OK', "Akun Administrator baru dibuat: {$adminEmail} (password: {$adminPassword})");
    }

    // 5. Seed Demo Learner user
    $demoEmail = 'demo@speakup.id';
    $demoPass = 'akundemospeakup';
    $findDemo = $pdo->prepare('SELECT id FROM users WHERE email=?');
    $findDemo->execute([$demoEmail]);
    $existingDemo = $findDemo->fetch();

    if ($existingDemo) {
        $pdo->prepare("UPDATE users SET password_hash=?, must_change_password=0 WHERE id=?")
            ->execute([password_hash($demoPass, PASSWORD_DEFAULT), (int)$existingDemo['id']]);
        log_msg('OK', "Akun Demo Learner diperbarui: {$demoEmail} (password: {$demoPass})");
    } else {
        $pdo->prepare("INSERT INTO users(email, name, password_hash, role, plan, created_at, must_change_password, diamonds) VALUES(?,?,?,?,'regular',?,0,100)")
            ->execute([$demoEmail, 'Demo Learner', password_hash($demoPass, PASSWORD_DEFAULT), 'user', gmdate('c')]);
        log_msg('OK', "Akun Demo Learner baru dibuat: {$demoEmail} (password: {$demoPass}, 100 diamond)");
    }

    // 6. Summary
    $userCount = (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
    $courseCount = (int) $pdo->query('SELECT COUNT(*) FROM courses')->fetchColumn();
    $unitCount = (int) $pdo->query('SELECT COUNT(*) FROM course_units')->fetchColumn();

    log_msg('INFO', "Total data: {$userCount} users, {$courseCount} courses, {$unitCount} course units.");
    log_msg('OK', 'Migrasi dan inisialisasi database selesai dengan sukses! 🎉');

    if ($isCli) {
        echo "\nKredensial untuk login:\n";
        echo "  - Admin : {$adminEmail} (atau 'admin') / {$adminPassword}\n";
        echo "  - Demo  : {$demoEmail} / {$demoPass}\n\n";
    } else {
        echo "\n<hr/><p><b>Kredensial Login:</b></p>";
        echo "<ul>";
        echo "<li><b>Admin:</b> " . htmlspecialchars($adminEmail) . " (atau ketik <code>admin</code>) &middot; Password: <code>" . htmlspecialchars($adminPassword) . "</code></li>";
        echo "<li><b>Demo Learner:</b> <code>{$demoEmail}</code> &middot; Password: <code>{$demoPass}</code></li>";
        echo "</ul>";
        echo "<p><a href='/learnenglish/' style='display:inline-block;padding:8px 16px;background:#5846c8;color:#fff;text-decoration:none;border-radius:8px;'>Kembali ke Aplikasi</a></p>";
        echo "</pre></body></html>";
    }
} catch (Throwable $e) {
    log_msg('ERROR', 'Gagal melakukan migrasi: ' . $e->getMessage());
    if ($isCli) {
        exit(1);
    } else {
        echo "</pre><p style='color:red;'><b>Error detail:</b> " . htmlspecialchars($e->getMessage()) . "</p></body></html>";
    }
}
