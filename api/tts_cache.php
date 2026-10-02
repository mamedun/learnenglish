<?php
declare(strict_types=1);

// Shared authored-content audio only. User-generated tutor replies never enter
// this table. WAV files are served through the authenticated API, not as assets.
function tts_cache_limit_bytes(): int
{
    return 1024 * 1024 * 1024;
}

function tts_cache_directory(): string
{
    $path = (string) cfg('TTS_CACHE_DIR', '');
    if ($path === '') {
        $uploads = (string) cfg('UPLOADS_DIR', __DIR__ . '/uploads');
        $path = rtrim($uploads, '/\\') . '/tts-cache';
    }
    if (!str_starts_with($path, '/') && !preg_match('/^[a-zA-Z]:/', $path)) {
        $path = __DIR__ . '/' . $path;
    }
    if (!is_dir($path) && !@mkdir($path, 0700, true) && !is_dir($path)) {
        respond(['error' => 'Folder shared TTS cache tidak dapat dibuat.'], 500);
    }
    @chmod($path, 0700);
    $deny = rtrim($path, '/\\') . '/.htaccess';
    if (!is_file($deny)) @file_put_contents($deny, "Options -Indexes\nRequire all denied\n");
    return rtrim($path, '/\\');
}

function tts_cache_key(string $type, string $id, string $revision, string $voice): string
{
    return hash('sha256', "speakup-tts-cache-v1\n$type\n$id\n$revision\n$voice");
}

function tts_cache_remove_file(string $path): void
{
    $root = realpath(tts_cache_directory());
    $file = realpath($path);
    if ($root && $file && str_starts_with($file, $root . DIRECTORY_SEPARATOR) && is_file($file)) {
        @unlink($file);
    }
}

function tts_cache_delete_content(string $type, string $id): int
{
    $pdo = db();
    $query = $pdo->prepare('SELECT file_path FROM shared_tts_cache WHERE content_type=? AND content_id=?');
    $query->execute([$type, $id]);
    $rows = $query->fetchAll();
    foreach ($rows as $row) tts_cache_remove_file((string) $row['file_path']);
    $pdo->prepare('DELETE FROM shared_tts_cache WHERE content_type=? AND content_id=?')->execute([$type, $id]);
    return count($rows);
}

function tts_cache_delete_course(PDO $pdo, string $courseId): int
{
    $rows = $pdo->query('SELECT content_type,content_id,file_path FROM shared_tts_cache')->fetchAll();
    $delete = $pdo->prepare('DELETE FROM shared_tts_cache WHERE content_type=? AND content_id=?');
    $deleted = 0;
    foreach ($rows as $row) {
        $type = (string) $row['content_type'];
        $contentId = (string) $row['content_id'];
        if (!in_array($type, ['speaking', 'listening'], true) || !str_starts_with($contentId, $courseId . ':')) continue;
        tts_cache_remove_file((string) $row['file_path']);
        $delete->execute([$type, $contentId]);
        $deleted++;
    }
    return $deleted;
}

function tts_cache_clear_all(): int
{
    $pdo = db();
    $rows = $pdo->query('SELECT file_path FROM shared_tts_cache')->fetchAll();
    foreach ($rows as $row) tts_cache_remove_file((string) $row['file_path']);
    $pdo->exec('DELETE FROM shared_tts_cache');
    foreach (glob(tts_cache_directory() . '/*') ?: [] as $path) {
        if (is_file($path) && (str_ends_with($path, '.wav') || str_ends_with($path, '.tmp'))) @unlink($path);
    }
    return count($rows);
}

function tts_cache_summary(): array
{
    $row = db()->query('SELECT COUNT(*) AS items, COALESCE(SUM(file_size),0) AS bytes FROM shared_tts_cache')->fetch();
    return [
        'items' => (int) ($row['items'] ?? 0),
        'bytes' => (int) ($row['bytes'] ?? 0),
        'limit_bytes' => tts_cache_limit_bytes(),
        'policy' => 'least-recently-used',
    ];
}

function tts_cache_course_status(PDO $pdo, string $courseId): array
{
    if (!preg_match('/^[A-Za-z0-9_-]{1,80}$/', $courseId))
        respond(['error' => 'ID course tidak valid.'], 422);
    if (!courseware_course_row($pdo, $courseId)) respond(['error' => 'Course tidak ditemukan.'], 404);

    $prefix = $courseId . ':';
    $cacheQuery = $pdo->prepare('SELECT cache_key,file_path,file_size FROM shared_tts_cache WHERE substr(content_id,1,?)=?');
    $cacheQuery->execute([strlen($prefix), $prefix]);
    $cacheByKey = [];
    foreach ($cacheQuery->fetchAll() as $row) $cacheByKey[(string) $row['cache_key']] = $row;

    $result = [];
    foreach (['ai_lesson' => 'speaking', 'listening' => 'listening'] as $modality => $type) {
        $modalityStatus = [];
        foreach (courseware_units_for_modality($pdo, $courseId, $modality, true) as $unit) {
            $unitId = (string) $unit['id'];
            $content = is_array($unit['content'] ?? null) ? $unit['content'] : [];
            $revision = (string) ($unit['ttsRevision'] ?? '');
            $segments = is_array($content['ttsSegments'] ?? null) ? $content['ttsSegments'] : [];
            $voice = tts_cache_expected_voice($pdo, $type, $unitId, $content, $segments);
            $key = tts_cache_key($type, $prefix . $unitId, $revision, $voice);
            $row = $cacheByKey[$key] ?? null;
            $available = is_array($row) && is_file((string) $row['file_path']);
            if (is_array($row) && !$available) {
                $pdo->prepare('DELETE FROM shared_tts_cache WHERE cache_key=?')->execute([$key]);
                unset($cacheByKey[$key]);
            }
            $modalityStatus[$unitId] = [
                'available' => $available,
                'voice' => $voice,
                'size' => $available ? (int) $row['file_size'] : 0,
            ];
        }
        $result[$modality] = (object) $modalityStatus;
    }
    return $result;
}

function tts_cache_content_segments(PDO $pdo, string $type, string $id): array
{
    if ($type === 'speaking') {
        $query = $pdo->prepare('SELECT tts_segments_json FROM speaking_units WHERE id=?');
    } else {
        $query = $pdo->prepare('SELECT tts_segments_json FROM listening_lessons WHERE id=?');
    }
    $query->execute([$id]);
    $value = $query->fetchColumn();
    $segments = is_string($value) ? json_decode($value, true) : null;
    return is_array($segments) && array_is_list($segments) ? $segments : [];
}

function tts_cache_default_voice(PDO $pdo, string $type, string $id, ?array $courseContent = null): string
{
    $voice = $courseContent['defaultVoice'] ?? null;
    if ($courseContent === null) {
        if ($type === 'speaking') {
            $query = $pdo->prepare('SELECT default_voice FROM speaking_units WHERE id=?');
        } else {
            $query = $pdo->prepare('SELECT default_voice FROM listening_lessons WHERE id=?');
        }
        $query->execute([$id]);
        $voice = $query->fetchColumn();
    }
    return is_string($voice) && in_array($voice, catalog_tts_voice_ids(), true)
        ? $voice
        : 'af_heart';
}

function tts_cache_expected_voice(PDO $pdo, string $type, string $id, ?array $courseContent, array $segments): string
{
    return count($segments) >= 2
        ? 'multi'
        : tts_cache_default_voice($pdo, $type, $id, $courseContent);
}

function tts_cache_remove_other_entries(PDO $pdo, string $type, string $id, string $keepKey): array
{
    $query = $pdo->prepare('SELECT cache_key,file_path,file_size FROM shared_tts_cache WHERE content_type=? AND content_id=? AND cache_key<>?');
    $query->execute([$type, $id, $keepKey]);
    $rows = $query->fetchAll();
    $delete = $pdo->prepare('DELETE FROM shared_tts_cache WHERE cache_key=?');
    foreach ($rows as $row) $delete->execute([$row['cache_key']]);
    return $rows;
}

function tts_cache_content_is_published(PDO $pdo, string $type, string $id): bool
{
    if ($type === 'speaking') {
        $query = $pdo->prepare('SELECT published FROM speaking_units WHERE id=?');
    } else {
        $query = $pdo->prepare('SELECT published FROM listening_lessons WHERE id=?');
    }
    $query->execute([$id]);
    $published = $query->fetchColumn();
    return $published !== false && (int) $published === 1;
}

function tts_cache_get_audio(array $user): never
{
    $type = trim((string) ($_GET['type'] ?? ''));
    $id = trim((string) ($_GET['id'] ?? ''));
    $revision = trim((string) ($_GET['revision'] ?? ''));
    $voice = trim((string) ($_GET['voice'] ?? ''));
    $courseId = trim((string) ($_GET['course_id'] ?? ''));
    if (!in_array($type, ['speaking', 'listening'], true) || !preg_match('/^[A-Za-z0-9_-]{1,80}$/', $id)) {
        respond(['error' => 'Referensi materi audio tidak valid.'], 422);
    }
    if ($courseId !== '' && !preg_match('/^[A-Za-z0-9_-]{1,80}$/', $courseId)) respond(['error'=>'ID course tidak valid.'],422);
    if (!preg_match('/^[a-f0-9]{64}$/', $revision)) respond(['error' => 'Versi materi audio tidak valid.'], 422);
    if ($voice !== 'auto' && $voice !== 'multi' && !in_array($voice, catalog_tts_voice_ids(), true)) {
        respond(['error' => 'Model suara audio tidak didukung.'], 422);
    }

    $pdo = db();
    $cacheId = $id;
    $courseContent = null;
    if ($courseId !== '') {
        $modality = $type === 'speaking' ? 'ai_lesson' : 'listening';
        $context = courseware_request_context($pdo,$user,['course_id'=>$courseId,'unit_id'=>$id],$modality,false);
        $courseContent = (array) ($context['unit']['content'] ?? []);
        $currentRevision = courseware_tts_revision($pdo,$courseId,$type,$id);
        $segments = (array)($courseContent['ttsSegments'] ?? []);
        $cacheId = $courseId . ':' . $id;
    } else {
        $currentRevision = catalog_tts_revision($pdo, $type, $id);
        if (($user['role'] ?? '') !== 'admin' && !tts_cache_content_is_published($pdo, $type, $id))
            respond(['error' => 'Materi audio tidak tersedia.'], 404);
        $segments = tts_cache_content_segments($pdo,$type,$id);
    }
    if ($currentRevision === null)
        respond(['error' => 'Materi audio tidak ditemukan.'], 404);
    if (!hash_equals($currentRevision, $revision))
        respond(['error' => 'Cache materi sudah usang.'], 404);
    $expectedVoice = tts_cache_expected_voice($pdo, $type, $id, $courseContent, $segments);
    if ($voice !== 'auto' && $voice !== $expectedVoice)
        respond(['error' => 'Materi hanya menyediakan cache untuk voice prioritas atau dialog gabungan yang sesuai.'], 404);

    $key = tts_cache_key($type, $cacheId, $revision, $expectedVoice);
    $pdo->exec('BEGIN IMMEDIATE');
    try {
        $staleRows = tts_cache_remove_other_entries($pdo, $type, $cacheId, $key);
        $pdo->exec('COMMIT');
    } catch (Throwable $error) {
        try { $pdo->exec('ROLLBACK'); } catch (Throwable $ignored) {}
        throw $error;
    }
    foreach ($staleRows as $staleRow) tts_cache_remove_file((string) $staleRow['file_path']);

    $query = $pdo->prepare('SELECT file_path,file_size FROM shared_tts_cache WHERE cache_key=?');
    $query->execute([$key]);
    $asset = $query->fetch();
    if (!$asset) respond(['error' => 'Audio belum tersedia di shared cache.'], 404);
    if (!is_file((string) $asset['file_path'])) {
        $pdo->prepare('DELETE FROM shared_tts_cache WHERE cache_key=?')->execute([$key]);
        respond(['error' => 'Audio belum tersedia di shared cache.'], 404);
    }
    $selectedVoice = $expectedVoice;
    $pdo->prepare('UPDATE shared_tts_cache SET last_accessed_at=? WHERE cache_key=?')->execute([gmdate('c'), $key]);
    header('Content-Type: audio/wav');
    header('Content-Length: ' . (string) filesize((string) $asset['file_path']));
    header('Content-Disposition: inline; filename="lesson-audio.wav"');
    header('X-Content-Type-Options: nosniff');
    header('X-Speakup-TTS-Voice: ' . $selectedVoice);
    readfile((string) $asset['file_path']);
    exit;
}

function tts_cache_upload(array $user): never
{
    origin_check();
    $admin = ($user['role'] ?? '') === 'admin';
    rate_limit($admin ? 'tts-cache-admin-upload' : 'tts-cache-user-upload', $admin ? 600 : 40, 3600);

    $type = trim((string) ($_POST['type'] ?? ''));
    $id = trim((string) ($_POST['id'] ?? ''));
    $revision = trim((string) ($_POST['revision'] ?? ''));
    $voice = trim((string) ($_POST['voice'] ?? ''));
    $courseId = trim((string) ($_POST['course_id'] ?? ''));
    if (!in_array($type, ['speaking', 'listening'], true) || !preg_match('/^[A-Za-z0-9_-]{1,80}$/', $id)) {
        respond(['error' => 'Referensi materi audio tidak valid.'], 422);
    }
    if ($courseId !== '' && !preg_match('/^[A-Za-z0-9_-]{1,80}$/', $courseId)) respond(['error'=>'ID course tidak valid.'],422);
    if (!preg_match('/^[a-f0-9]{64}$/', $revision)) respond(['error' => 'Versi materi audio tidak valid.'], 422);
    if ($voice !== 'multi' && !in_array($voice, catalog_tts_voice_ids(), true)) {
        respond(['error' => 'Model suara audio tidak didukung.'], 422);
    }
    if ($voice === 'multi' && !$admin) respond(['error' => 'Dialog bersama hanya dapat disiapkan admin.'], 403);

    $pdo = db();
    $cacheId = $id;
    $courseContent = null;
    if ($courseId !== '') {
        $modality = $type === 'speaking' ? 'ai_lesson' : 'listening';
        $context = courseware_request_context($pdo,$user,['course_id'=>$courseId,'unit_id'=>$id],$modality,false);
        $courseContent = (array) ($context['unit']['content'] ?? []);
        $currentRevision = courseware_tts_revision($pdo,$courseId,$type,$id);
        $segments = (array)($courseContent['ttsSegments'] ?? []);
        $cacheId = $courseId . ':' . $id;
    } else {
        $currentRevision = catalog_tts_revision($pdo, $type, $id);
        if (!$admin && !tts_cache_content_is_published($pdo, $type, $id))
            respond(['error' => 'Materi audio tidak tersedia.'], 404);
        $segments = tts_cache_content_segments($pdo,$type,$id);
    }
    if ($currentRevision === null) respond(['error' => 'Materi audio tidak ditemukan.'], 404);
    if (!hash_equals($currentRevision, $revision))
        respond(['error' => 'Materi berubah saat audio dibuat. Muat ulang materi lalu coba lagi.'], 409);
    $expectedVoice = tts_cache_expected_voice($pdo, $type, $id, $courseContent, $segments);
    if ($voice !== $expectedVoice)
        respond(['error' => 'Cache hanya menerima voice prioritas untuk materi tunggal atau satu audio gabungan untuk dialog.'], 422);

    if (!isset($_FILES['audio']) || (int) ($_FILES['audio']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        respond(['error' => 'File audio tidak diterima. Periksa batas unggah server.'], 422);
    }
    $file = $_FILES['audio'];
    $size = (int) ($file['size'] ?? 0);
    if ($size < 44 || $size > 25 * 1024 * 1024)
        respond(['error' => 'Audio WAV harus berukuran maksimal 25 MB.'], 413);
    $tmpPath = (string) ($file['tmp_name'] ?? '');
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($tmpPath) ?: '';
    if (!in_array($mime, ['audio/wav', 'audio/x-wav', 'audio/vnd.wave'], true))
        respond(['error' => 'Cache hanya menerima WAV hasil Kokoro.'], 415);
    $header = @file_get_contents($tmpPath, false, null, 0, 12);
    if (!is_string($header) || strlen($header) < 12 || substr($header, 0, 4) !== 'RIFF' || substr($header, 8, 4) !== 'WAVE')
        respond(['error' => 'Isi file bukan WAV yang valid.'], 415);

    $key = tts_cache_key($type, $cacheId, $revision, $voice);
    $directory = tts_cache_directory();
    $targetPath = $directory . '/' . $key . '.wav';
    $stagedPath = $directory . '/' . $key . '.' . bin2hex(random_bytes(8)) . '.tmp';
    if (!move_uploaded_file($tmpPath, $stagedPath))
        respond(['error' => 'Gagal menyiapkan file cache.'], 500);
    @chmod($stagedPath, 0600);

    $backupPath = null;
    $targetInstalled = false;
    $evictedPaths = [];
    $pdo->exec('BEGIN IMMEDIATE');
    try {
        $existingQuery = $pdo->prepare('SELECT file_size FROM shared_tts_cache WHERE cache_key=?');
        $existingQuery->execute([$key]);
        $existingSize = (int) ($existingQuery->fetchColumn() ?: 0);
        $total = (int) $pdo->query('SELECT COALESCE(SUM(file_size),0) FROM shared_tts_cache')->fetchColumn();
        $total -= $existingSize;
        $staleRows = tts_cache_remove_other_entries($pdo, $type, $cacheId, $key);
        foreach ($staleRows as $staleRow) {
            $evictedPaths[] = (string) $staleRow['file_path'];
            $total -= (int) $staleRow['file_size'];
        }
        $remaining = $total + $size - tts_cache_limit_bytes();
        if ($remaining > 0) {
            $lru = $pdo->prepare('SELECT cache_key,file_path,file_size FROM shared_tts_cache WHERE cache_key<>? ORDER BY last_accessed_at ASC,created_at ASC');
            $lru->execute([$key]);
            foreach ($lru->fetchAll() as $candidate) {
                if ($remaining <= 0) break;
                $pdo->prepare('DELETE FROM shared_tts_cache WHERE cache_key=?')->execute([$candidate['cache_key']]);
                $evictedPaths[] = (string) $candidate['file_path'];
                $freed = (int) $candidate['file_size'];
                $total -= $freed;
                $remaining -= $freed;
            }
        }
        if ($total + $size > tts_cache_limit_bytes()) {
            $pdo->exec('ROLLBACK');
            @unlink($stagedPath);
            respond(['error' => 'Shared cache penuh dan audio tidak dapat disimpan.'], 413);
        }
        if (is_file($targetPath)) {
            $backupPath = $targetPath . '.' . bin2hex(random_bytes(6)) . '.tmp';
            if (!@rename($targetPath, $backupPath))
                throw new RuntimeException('File cache lama tidak dapat diamankan.');
        }
        if (!@rename($stagedPath, $targetPath))
            throw new RuntimeException('Gagal memindahkan WAV ke shared cache.');
        $targetInstalled = true;

        $now = gmdate('c');
        $save = $pdo->prepare('INSERT INTO shared_tts_cache(cache_key,content_type,content_id,source_revision,voice_id,mime,file_path,file_size,created_at,last_accessed_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(cache_key) DO UPDATE SET content_type=excluded.content_type,content_id=excluded.content_id,source_revision=excluded.source_revision,voice_id=excluded.voice_id,mime=excluded.mime,file_path=excluded.file_path,file_size=excluded.file_size,created_at=excluded.created_at,last_accessed_at=excluded.last_accessed_at');
        $save->execute([$key, $type, $cacheId, $revision, $voice, 'audio/wav', $targetPath, $size, $now, $now]);
        $summary = tts_cache_summary();
        $pdo->exec('COMMIT');
        if ($backupPath && is_file($backupPath)) @unlink($backupPath);
        foreach ($evictedPaths as $evictedPath) tts_cache_remove_file($evictedPath);
        respond(['ok' => true, 'voice' => $voice, 'size' => $size, 'cache' => $summary], 201);
    } catch (Throwable $error) {
        try { $pdo->exec('ROLLBACK'); } catch (Throwable $ignored) {}
        if ($targetInstalled && is_file($targetPath)) @unlink($targetPath);
        if ($backupPath && is_file($backupPath)) @rename($backupPath, $targetPath);
        if (is_file($stagedPath)) @unlink($stagedPath);
        error_log('SpeakUp TTS cache upload: ' . $error->getMessage());
        respond(['error' => 'Gagal menyimpan audio bersama.'], 500);
    }
}
