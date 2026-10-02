<?php
declare(strict_types=1);

/**
 * Course catalog, enrollments, course purchases, advertisements and AI usage.
 * Existing IELTS catalog tables remain intact as a migration source; their
 * content is copied into these course-scoped tables only once.
 */
function courseware_strlen(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
}

function courseware_policy_defaults(): array
{
    return [
        'max_record_seconds' => 180,
        'max_transcript_chars' => 3000,
        'max_live_seconds' => 600,
        'max_ai_audio_bytes' => 12 * 1024 * 1024,
        'cost_ai_lesson_text' => 2,
        'cost_ai_lesson_audio' => 5,
        'cost_listening_transcribe' => 1,
        'cost_listening_ai_score' => 1,
        'cost_listening_direct_audio' => 3,
        'cost_live_assessment' => 0,
        'cost_live_per_minute' => 2,
        'live_block_minutes' => 5,
        'diamond_price_idr' => 100,
        'learning_progression_mode' => 'parallel',
    ];
}

function courseware_policy(): array
{
    $defaults = courseware_policy_defaults();
    $bounds = [
        'max_record_seconds' => [10, 900],
        'max_transcript_chars' => [100, 48000],
        'max_live_seconds' => [60, 3600],
        'max_ai_audio_bytes' => [1024 * 1024, 24 * 1024 * 1024],
        'cost_ai_lesson_text' => [0, 10000],
        'cost_ai_lesson_audio' => [0, 10000],
        'cost_listening_transcribe' => [0, 10000],
        'cost_listening_ai_score' => [0, 10000],
        'cost_listening_direct_audio' => [0, 10000],
        'cost_live_assessment' => [0, 10000],
        'cost_live_per_minute' => [0, 10000],
        'live_block_minutes' => [1, 10],
        'diamond_price_idr' => [1, 5000],
    ];
    $values = [];
    foreach ($bounds as $key => [$minimum, $maximum]) {
        $raw = (int) app_setting($key, (string) $defaults[$key]);
        $values[$key] = max($minimum, min($maximum, $raw));
    }
    $progression = (string) app_setting('learning_progression_mode', 'parallel');
    $values['learning_progression_mode'] = in_array($progression, ['parallel', 'linear'], true) ? $progression : 'parallel';
    return $values;
}

function courseware_save_policy(array $input): array
{
    $defaults = courseware_policy_defaults();
    $current = courseware_policy();
    $bounds = [
        'max_record_seconds' => [10, 900],
        'max_transcript_chars' => [100, 48000],
        'max_live_seconds' => [60, 3600],
        'max_ai_audio_bytes' => [1024 * 1024, 24 * 1024 * 1024],
        'cost_ai_lesson_text' => [0, 10000],
        'cost_ai_lesson_audio' => [0, 10000],
        'cost_listening_transcribe' => [0, 10000],
        'cost_listening_ai_score' => [0, 10000],
        'cost_listening_direct_audio' => [0, 10000],
        'cost_live_assessment' => [0, 10000],
        'cost_live_per_minute' => [0, 10000],
        'live_block_minutes' => [1, 10],
        'diamond_price_idr' => [1, 5000],
    ];
    $values = [];
    foreach ($bounds as $key => [$minimum, $maximum]) {
        $value = $input[$key] ?? $current[$key] ?? $defaults[$key];
        if (!is_numeric($value) || floor((float) $value) !== (float) $value) {
            respond(['error' => "Nilai kebijakan $key harus berupa bilangan bulat."], 422);
        }
        $value = (int) $value;
        if ($value < $minimum || $value > $maximum) {
            respond(['error' => "Nilai $key harus berada di antara $minimum dan $maximum."], 422);
        }
        $values[$key] = $value;
    }
    foreach ($values as $key => $value) put_setting($key, (string) $value);
    $progression = (string) ($input['learning_progression_mode'] ?? $current['learning_progression_mode'] ?? 'parallel');
    if (!in_array($progression, ['parallel', 'linear'], true)) {
        $progression = 'parallel';
    }
    put_setting('learning_progression_mode', $progression);
    $values['learning_progression_mode'] = $progression;
    return $values;
}

function courseware_install(PDO $pdo): void
{
    $pdo->exec("CREATE TABLE IF NOT EXISTS courses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        poster_url TEXT NOT NULL DEFAULT '',
        banner_url TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('published','draft','closed')),
        price INTEGER NOT NULL DEFAULT 0 CHECK(price>=0),
        color TEXT NOT NULL DEFAULT '#315C45',
        label TEXT NOT NULL DEFAULT '',
        level TEXT NOT NULL DEFAULT '',
        enable_listening INTEGER NOT NULL DEFAULT 1 CHECK(enable_listening IN (0,1)),
        enable_ai_lesson INTEGER NOT NULL DEFAULT 1 CHECK(enable_ai_lesson IN (0,1)),
        enable_live_lesson INTEGER NOT NULL DEFAULT 1 CHECK(enable_live_lesson IN (0,1)),
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )");
    $pdo->exec("CREATE TABLE IF NOT EXISTS course_categories (
        course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        modality TEXT NOT NULL CHECK(modality IN ('listening','ai_lesson','live_lesson')),
        id TEXT NOT NULL,
        name TEXT NOT NULL,
        label TEXT NOT NULL DEFAULT '',
        guide TEXT NOT NULL DEFAULT '',
        color TEXT NOT NULL DEFAULT '#315C45',
        sort_order INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(course_id, modality, id)
    )");
    $pdo->exec("CREATE TABLE IF NOT EXISTS course_units (
        course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        modality TEXT NOT NULL CHECK(modality IN ('listening','ai_lesson','live_lesson')),
        id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        title TEXT NOT NULL,
        subtitle TEXT NOT NULL DEFAULT '',
        master_prompt TEXT NOT NULL DEFAULT '',
        media_url TEXT NOT NULL DEFAULT '',
        content_json TEXT NOT NULL DEFAULT '{}',
        sort_order INTEGER NOT NULL DEFAULT 0,
        published INTEGER NOT NULL DEFAULT 1 CHECK(published IN (0,1)),
        updated_at TEXT NOT NULL,
        PRIMARY KEY(course_id, modality, id),
        FOREIGN KEY(course_id, modality, category_id)
            REFERENCES course_categories(course_id, modality, id) ON DELETE CASCADE
    )");
    $pdo->exec('CREATE INDEX IF NOT EXISTS course_unit_order ON course_units(course_id, modality, category_id, sort_order)');
    $pdo->exec("CREATE TABLE IF NOT EXISTS course_enrollments (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        source TEXT NOT NULL DEFAULT 'free',
        enrolled_at TEXT NOT NULL,
        last_modality TEXT,
        last_unit_id TEXT,
        last_activity_at TEXT,
        PRIMARY KEY(user_id, course_id)
    )");
    $pdo->exec("CREATE TABLE IF NOT EXISTS course_purchases (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_id TEXT NOT NULL REFERENCES courses(id),
        course_name TEXT NOT NULL,
        base_amount INTEGER NOT NULL,
        tax_amount INTEGER NOT NULL DEFAULT 0,
        admin_fee INTEGER NOT NULL DEFAULT 0,
        unique_code INTEGER NOT NULL,
        total_amount INTEGER NOT NULL,
        qris_payload TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','expired','deleted')),
        contacted_at TEXT,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        approved_at TEXT,
        approved_by INTEGER REFERENCES users(id)
    )");
    $pdo->exec("CREATE UNIQUE INDEX IF NOT EXISTS course_purchases_active_code ON course_purchases(unique_code) WHERE status='pending'");
    $pdo->exec('CREATE INDEX IF NOT EXISTS course_purchase_user_time ON course_purchases(user_id, created_at DESC)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS course_purchase_status_time ON course_purchases(status, created_at DESC)');
    $pdo->exec("CREATE TABLE IF NOT EXISTS course_ads (
        id TEXT PRIMARY KEY,
        poster_url TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        link TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )");
    $pdo->exec("CREATE TABLE IF NOT EXISTS course_usage_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
        modality TEXT NOT NULL,
        unit_id TEXT,
        operation TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT '',
        diamond_cost INTEGER NOT NULL DEFAULT 0,
        transcript_chars INTEGER NOT NULL DEFAULT 0,
        audio_bytes INTEGER NOT NULL DEFAULT 0,
        duration_seconds INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'completed',
        created_at TEXT NOT NULL
    )");
    $pdo->exec('CREATE INDEX IF NOT EXISTS course_usage_user_time ON course_usage_events(user_id, created_at DESC)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS course_usage_course_time ON course_usage_events(course_id, modality, created_at DESC)');

    $billingColumns = array_column($pdo->query('PRAGMA table_info(live_billing_sessions)')->fetchAll(), 'name');
    foreach (['course_id' => 'TEXT', 'unit_id' => 'TEXT', 'reserved_minutes' => 'INTEGER NOT NULL DEFAULT 5', 'rate_per_minute' => 'INTEGER NOT NULL DEFAULT 2', 'block_minutes' => 'INTEGER NOT NULL DEFAULT 5', 'max_seconds' => 'INTEGER NOT NULL DEFAULT 600'] as $column => $type) {
        if (!in_array($column, $billingColumns, true))
            $pdo->exec("ALTER TABLE live_billing_sessions ADD COLUMN $column $type");
    }

    courseware_seed_ielts($pdo);
    courseware_seed_samples($pdo);
    $now = gmdate('c');
    $pdo->prepare("INSERT OR IGNORE INTO course_enrollments(user_id,course_id,source,enrolled_at)
        SELECT id,'ielts','automatic',? FROM users")->execute([$now]);
}

function courseware_seed_ielts(PDO $pdo): void
{
    $now = gmdate('c');
    $pdo->prepare("INSERT OR IGNORE INTO courses(id,name,description,poster_url,banner_url,status,price,color,label,level,enable_listening,enable_ai_lesson,enable_live_lesson,sort_order,created_at,updated_at)
        VALUES('ielts','IELTS English Adventure','Modul bahasa Inggris bergaya IELTS untuk berlatih listening, speaking, dan percakapan live. Ini latihan, bukan tes atau sertifikasi IELTS resmi.',?,?,'published',0,'#315C45','IELTS','A1–C2',1,1,1,0,?,?)")->execute([
            app_public_path('images/speaking-cue-card-practice.jpg'), app_public_path('images/speakup-adventure.png'), $now, $now,
        ]);

    $categoryInsert = $pdo->prepare('INSERT OR IGNORE INTO course_categories(course_id,modality,id,name,label,guide,color,sort_order,updated_at) VALUES(?,?,?,?,?,?,?,?,?)');
    $levels = $pdo->query('SELECT * FROM course_levels ORDER BY sort_order,id')->fetchAll();
    foreach ($levels as $level) {
        foreach (['listening', 'ai_lesson'] as $modality) {
            $categoryInsert->execute([
                'ielts', $modality, (string) $level['id'], (string) $level['name'],
                (string) $level['label'], (string) $level['band_guide'], (string) $level['color'],
                (int) $level['sort_order'], $now,
            ]);
        }
    }
    $categoryInsert->execute([
        'ielts', 'live_lesson', 'role-play', 'Role-play topics', 'Conversation practice',
        'Pilih situasi dan berbicara spontan bersama tutor AI.', '#315C45', 0, $now,
    ]);

    $unitInsert = $pdo->prepare('INSERT OR IGNORE INTO course_units(course_id,modality,id,category_id,title,subtitle,master_prompt,media_url,content_json,sort_order,published,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
    $speakingRows = $pdo->query('SELECT * FROM speaking_units ORDER BY level_id,sort_order,id')->fetchAll();
    foreach ($speakingRows as $unit) {
        $content = [
            'emoji' => (string) $unit['emoji'], 'duration' => (string) $unit['duration'],
            'prompt' => (string) $unit['prompt'], 'objective' => (string) $unit['objective'],
            'part' => (string) $unit['part'], 'questionType' => (string) $unit['question_type'],
            'bandTarget' => (string) $unit['band_target'], 'prepSeconds' => (int) $unit['prep_seconds'],
            'responseSeconds' => (int) $unit['response_seconds'], 'imageContext' => (string) ($unit['image_context'] ?? ''),
            'defaultVoice' => (string) ($unit['default_voice'] ?? 'af_heart'),
            'ttsSegments' => json_decode((string) ($unit['tts_segments_json'] ?? '[]'), true) ?: [],
            'published' => (bool) $unit['published'],
        ];
        $unitInsert->execute([
            'ielts', 'ai_lesson', (string) $unit['id'], (string) $unit['level_id'],
            (string) $unit['title'], (string) $unit['subtitle'], '', (string) ($unit['image'] ?? ''),
            json_encode($content, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            (int) $unit['sort_order'], (int) $unit['published'], $now,
        ]);
    }

    $questionQuery = $pdo->prepare('SELECT * FROM listening_questions WHERE lesson_id=? ORDER BY position,id');
    $lessonRows = $pdo->query('SELECT * FROM listening_lessons ORDER BY level_id,sort_order,id')->fetchAll();
    foreach ($lessonRows as $lesson) {
        $questionQuery->execute([(string) $lesson['id']]);
        $questions = [];
        foreach ($questionQuery->fetchAll() as $question) {
            $questions[] = [
                'prompt' => (string) $question['prompt'],
                'options' => json_decode((string) $question['options_json'], true) ?: [],
                'answer' => (int) $question['answer_index'],
                'explain' => (string) $question['explanation'],
            ];
        }
        $content = [
            'objective' => (string) $lesson['objective'], 'script' => (string) $lesson['script'],
            'questions' => $questions, 'defaultVoice' => (string) ($lesson['default_voice'] ?? 'af_heart'),
            'ttsSegments' => json_decode((string) ($lesson['tts_segments_json'] ?? '[]'), true) ?: [],
            'published' => (bool) $lesson['published'],
        ];
        $unitInsert->execute([
            'ielts', 'listening', (string) $lesson['id'], (string) $lesson['level_id'],
            (string) $lesson['title'], (string) $lesson['objective'], '', (string) ($lesson['image'] ?? ''),
            json_encode($content, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            (int) $lesson['sort_order'], (int) $lesson['published'], $now,
        ]);
    }

    $topicFile = __DIR__ . '/seeds/ielts_live_topics.json';
    if (is_file($topicFile)) {
        $topics = json_decode((string) file_get_contents($topicFile), true);
        if (is_array($topics)) foreach ($topics as $index => $topic) {
            if (!is_array($topic) || !is_string($topic['id'] ?? null)) continue;
            $content = $topic;
            unset($content['id'], $content['label'], $content['description']);
            $unitInsert->execute([
                'ielts', 'live_lesson', (string) $topic['id'], 'role-play',
                (string) ($topic['label'] ?? $topic['id']), (string) ($topic['description'] ?? ''),
                (string) ($topic['masterPrompt'] ?? ''), (string) ($topic['image'] ?? ''),
                json_encode($content, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                (int) $index, 1, $now,
            ]);
        }
    }
}

function courseware_seed_samples(PDO $pdo): void
{
    $file = __DIR__ . '/seeds/course_modules.json';
    if (!is_file($file)) return;
    $seed = json_decode((string) file_get_contents($file), true);
    if (!is_array($seed['courses'] ?? null)) return;
    $courseInsert = $pdo->prepare('INSERT OR IGNORE INTO courses(id,name,description,poster_url,banner_url,status,price,color,label,level,enable_listening,enable_ai_lesson,enable_live_lesson,sort_order,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    $categoryInsert = $pdo->prepare('INSERT OR IGNORE INTO course_categories(course_id,modality,id,name,label,guide,color,sort_order,updated_at) VALUES(?,?,?,?,?,?,?,?,?)');
    $unitInsert = $pdo->prepare('INSERT OR IGNORE INTO course_units(course_id,modality,id,category_id,title,subtitle,master_prompt,media_url,content_json,sort_order,published,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
    $now = gmdate('c');
    foreach ($seed['courses'] as $course) {
        if (!is_array($course) || !is_string($course['id'] ?? null)) continue;
        $courseInsert->execute([
            $course['id'], $course['name'] ?? '', $course['description'] ?? '', $course['posterUrl'] ?? '',
            $course['bannerUrl'] ?? '', $course['status'] ?? 'published', (int) ($course['price'] ?? 0),
            $course['color'] ?? '#315C45', $course['label'] ?? '', $course['level'] ?? '',
            !empty($course['enableListening']) ? 1 : 0, !empty($course['enableAiLesson']) ? 1 : 0,
            !empty($course['enableLiveLesson']) ? 1 : 0, (int) ($course['sortOrder'] ?? 50), $now, $now,
        ]);
        foreach ((array) ($course['modules'] ?? []) as $modality => $module) {
            if (!in_array($modality, ['listening', 'ai_lesson', 'live_lesson'], true)) continue;
            foreach ((array) ($module['categories'] ?? []) as $category) {
                if (!is_array($category)) continue;
                $categoryInsert->execute([
                    $course['id'], $modality, $category['id'] ?? '', $category['name'] ?? '',
                    $category['label'] ?? '', $category['guide'] ?? '', $category['color'] ?? ($course['color'] ?? '#315C45'),
                    (int) ($category['sortOrder'] ?? 0), $now,
                ]);
            }
            foreach ((array) ($module['units'] ?? []) as $unit) {
                if (!is_array($unit) || !isset($unit['categoryId'], $unit['id'])) continue;
                $content = is_array($unit['content'] ?? null) ? $unit['content'] : [];
                $unitInsert->execute([
                    $course['id'], $modality, $unit['id'], $unit['categoryId'], $unit['title'] ?? '',
                    $unit['subtitle'] ?? '', $unit['masterPrompt'] ?? '', $unit['mediaUrl'] ?? '',
                    json_encode($content, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    (int) ($unit['sortOrder'] ?? 0), array_key_exists('published', $unit) && !$unit['published'] ? 0 : 1, $now,
                ]);
            }
        }
    }

    $adsCount = (int) $pdo->query('SELECT COUNT(*) FROM course_ads')->fetchColumn();
    if ($adsCount === 0 && is_array($seed['ad'] ?? null)) {
        $ad = $seed['ad'];
        $pdo->prepare('INSERT INTO course_ads(id,poster_url,title,description,link,sort_order,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)')->execute([
            'demo-english-adventure', $ad['posterUrl'] ?? app_public_path('images/market-conversation-scene-flow.jpg'),
            $ad['title'] ?? 'English for your next adventure', $ad['description'] ?? '',
            $ad['link'] ?? 'https://example.com/english-speaking-workshop', (int) ($ad['sortOrder'] ?? 0),
            !empty($ad['active']) ? 1 : 0, $now, $now,
        ]);
    }
}

function courseware_safe_id(string $value, string $label = 'ID'): string
{
    $value = trim($value);
    if ($value === '' || strlen($value) > 80 || !preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]*$/', $value))
        respond(['error' => "$label harus berupa huruf/angka, tanda hubung, atau garis bawah (maksimal 80 karakter)."], 422);
    return $value;
}

function courseware_safe_media_url($value, string $label = 'Media'): string
{
    if (!is_string($value)) respond(['error' => "$label tidak valid."], 422);
    $value = trim($value);
    if ($value === '') return '';
    $localImage = app_rebase_local_image_path($value);
    if ($localImage !== null) return $localImage;
    $parts = parse_url($value);
    if (!is_array($parts) || strtolower((string) ($parts['scheme'] ?? '')) !== 'https' || empty($parts['host']) || isset($parts['user']) || isset($parts['pass']))
        respond(['error' => "$label harus memakai URL HTTPS atau gambar lokal dari public/images/."], 422);
    return $value;
}

function courseware_public_course(array $row, bool $enrolled = false, array $activity = [], array $progress = []): array
{
    return [
        'id' => (string) $row['id'], 'name' => (string) $row['name'],
        'description' => (string) $row['description'], 'posterUrl' => app_public_asset_url($row['poster_url']),
        'bannerUrl' => app_public_asset_url($row['banner_url']), 'status' => (string) $row['status'],
        'price' => (int) $row['price'], 'color' => (string) $row['color'],
        'label' => (string) $row['label'], 'level' => (string) $row['level'],
        'enableListening' => (bool) $row['enable_listening'],
        'enableAiLesson' => (bool) $row['enable_ai_lesson'],
        'enableLiveLesson' => (bool) $row['enable_live_lesson'],
        'sortOrder' => (int) $row['sort_order'], 'enrolled' => $enrolled,
        'enrollmentSource' => $activity['source'] ?? null,
        'lastModality' => $activity['last_modality'] ?? null,
        'lastUnitId' => $activity['last_unit_id'] ?? null,
        'lastActivityAt' => $activity['last_activity_at'] ?? null,
        'progress' => $progress,
    ];
}

function courseware_course_row(PDO $pdo, string $courseId): ?array
{
    $query = $pdo->prepare('SELECT * FROM courses WHERE id=?');
    $query->execute([$courseId]);
    $row = $query->fetch();
    return $row ?: null;
}

function courseware_progress_summary(PDO $pdo, int $userId, array $course, ?array $progressPayload = null): array
{
    if ($progressPayload === null) {
        $query = $pdo->prepare('SELECT payload FROM progress WHERE user_id=?');
        $query->execute([$userId]);
        $raw = $query->fetchColumn();
        $progressPayload = is_string($raw) ? (json_decode($raw, true) ?: []) : [];
    }
    $nested = is_array($progressPayload['courseProgress'][$course['id']] ?? null)
        ? $progressPayload['courseProgress'][$course['id']] : [];
    $completedAi = array_fill_keys(array_map('strval', (array) ($course['id'] === 'ielts' ? ($progressPayload['completed'] ?? []) : ($nested['completed'] ?? []))), true);
    $completedListen = array_fill_keys(array_map('strval', (array) ($course['id'] === 'ielts' ? ($progressPayload['listeningCompleted'] ?? []) : ($nested['listeningCompleted'] ?? []))), true);
    $completedLive = array_fill_keys(array_map('strval', (array) ($nested['liveCompleted'] ?? [])), true);
    $enabled = [
        'listening' => !empty($course['enable_listening']),
        'ai_lesson' => !empty($course['enable_ai_lesson']),
        'live_lesson' => !empty($course['enable_live_lesson']),
    ];
    $unitQuery = $pdo->prepare("SELECT id FROM course_units WHERE course_id=? AND modality=? AND published=1");
    $total = 0;
    $done = 0;
    foreach ($enabled as $modality => $isEnabled) {
        if (!$isEnabled) continue;
        $unitQuery->execute([(string) $course['id'], $modality]);
        $ids = array_map('strval', $unitQuery->fetchAll(PDO::FETCH_COLUMN));
        $total += count($ids);
        $set = match ($modality) {
            'ai_lesson' => $completedAi,
            'listening' => $completedListen,
            default => $completedLive,
        };
        foreach ($ids as $id) if (isset($set[$id])) $done++;
    }
    return ['completed' => $done, 'total' => $total, 'percent' => $total ? (int) round($done * 100 / $total) : 0];
}

function courseware_courses_for_user(PDO $pdo, array $user): array
{
    $userId = (int) $user['id'];
    $pdo->prepare("INSERT OR IGNORE INTO course_enrollments(user_id,course_id,source,enrolled_at) VALUES(?,'ielts','automatic',?)")->execute([$userId, gmdate('c')]);
    $query = $pdo->prepare('SELECT c.*,e.source,e.last_modality,e.last_unit_id,e.last_activity_at FROM courses c LEFT JOIN course_enrollments e ON e.course_id=c.id AND e.user_id=? WHERE c.status=\'published\' OR e.user_id IS NOT NULL ORDER BY c.sort_order,c.name');
    $query->execute([$userId]);
    $courses = [];
    foreach ($query->fetchAll() as $row) {
        $enrolled = !empty($row['source']);
        $courses[] = courseware_public_course(
            $row, $enrolled,
            ['source' => $row['source'] ?? null, 'last_modality' => $row['last_modality'] ?? null, 'last_unit_id' => $row['last_unit_id'] ?? null, 'last_activity_at' => $row['last_activity_at'] ?? null],
            $enrolled ? courseware_progress_summary($pdo, $userId, $row) : ['completed' => 0, 'total' => 0, 'percent' => 0]
        );
    }
    if (($user['role'] ?? '') === 'admin') {
        $all = $pdo->query("SELECT c.* FROM courses c WHERE c.status<>'published' ORDER BY c.sort_order,c.name")->fetchAll();
        foreach ($all as $row) $courses[] = courseware_public_course($row, false, [], ['completed' => 0, 'total' => 0, 'percent' => 0]);
    }
    return $courses;
}

function courseware_enrollment(PDO $pdo, int $userId, string $courseId): ?array
{
    $query = $pdo->prepare('SELECT * FROM course_enrollments WHERE user_id=? AND course_id=?');
    $query->execute([$userId, $courseId]);
    $row = $query->fetch();
    return $row ?: null;
}

function courseware_require_access(PDO $pdo, array $user, string $courseId): array
{
    $course = courseware_course_row($pdo, $courseId);
    if (!$course) respond(['error' => 'Course tidak ditemukan.'], 404);
    if (($user['role'] ?? '') === 'admin') return $course;
    $enrollment = courseware_enrollment($pdo, (int) $user['id'], $courseId);
    if (!$enrollment) respond(['error' => 'Enroll atau selesaikan pembayaran course ini terlebih dahulu.','code'=>'course_not_enrolled'], 403);
    if ($course['status'] === 'draft') respond(['error' => 'Course ini belum dipublikasikan.'], 404);
    return $course;
}

function courseware_unit_record(PDO $pdo, string $courseId, string $modality, string $unitId, bool $allowUnpublished = false): ?array
{
    $sql = 'SELECT * FROM course_units WHERE course_id=? AND modality=? AND id=?';
    if (!$allowUnpublished) $sql .= ' AND published=1';
    $query=$pdo->prepare($sql);$query->execute([$courseId,$modality,$unitId]);
    $row=$query->fetch();
    if(!$row)return null;
    $row['content']=json_decode((string)$row['content_json'],true)?:[];
    return $row;
}

function courseware_request_context(PDO $pdo, array $user, array $input, string $modality, bool $allowMissingUnit = true): array
{
    if(!in_array($modality,['listening','ai_lesson','live_lesson'],true))respond(['error'=>'Jenis aktivitas course tidak valid.'],422);
    $courseId=trim((string)($input['course_id']??'ielts'));
    if($courseId==='')$courseId='ielts';
    $course=courseware_require_access($pdo,$user,$courseId);
    if(($user['role']??'')!=='admin'&&!courseware_modality_enabled($course,$modality))respond(['error'=>'Mode ini sedang tidak tersedia pada course.'],403);
    $unitId=trim((string)($input['unit_id']??''));
    $unit=null;
    if($unitId!==''){
        $unit=courseware_unit_record($pdo,$courseId,$modality,$unitId,($user['role']??'')==='admin');
        if(!$unit)respond(['error'=>'Materi tidak ditemukan atau belum dipublikasikan.'],404);
    }elseif(!$allowMissingUnit){
        respond(['error'=>'unit_id wajib untuk aktivitas ini.'],422);
    }
    return ['course'=>$course,'course_id'=>$courseId,'unit'=>$unit,'unit_id'=>$unitId?:null,'modality'=>$modality];
}

function courseware_cost_for_user(array $user, string $policyKey): int
{
    $policy=courseware_policy();
    $cost=max(0,(int)($policy[$policyKey]??0));
    return ($user['role']??'')==='admin'?0:$cost;
}

function courseware_wallet_reserve(array $user, int $cost, string $kind, string $note): ?int
{
    if(($user['role']??'')==='admin'||$cost<=0)return null;
    return wallet_reserve((int)$user['id'],$cost,$kind,$note);
}

function courseware_wallet_commit(?int $reservation, int $userId): int
{
    return $reservation===null?wallet_balance($userId):wallet_commit($reservation);
}

function courseware_activity_prompt(array $context): string
{
    $course=(string)($context['course']['name']??'');
    $unit=$context['unit']??null;
    $parts=["Course: $course."];
    if(is_array($unit)){
        $parts[]='Activity: '.(string)($unit['title']??'').'.';
        $parts[]='Course master instructions: '.(string)($unit['master_prompt']??'').'.';
    }
    return implode("\n",array_filter($parts,static fn($part)=>trim($part)!==''));
}

function courseware_units_for_modality(PDO $pdo, string $courseId, string $modality, bool $admin = false): array
{
    if (!in_array($modality, ['listening','ai_lesson','live_lesson'], true)) return [];
    $sql = 'SELECT * FROM course_units WHERE course_id=? AND modality=?';
    if (!$admin) $sql .= ' AND published=1';
    $sql .= ' ORDER BY category_id,sort_order,id';
    $query = $pdo->prepare($sql);
    $query->execute([$courseId, $modality]);
    $units = [];
    foreach ($query->fetchAll() as $row) {
        $content = json_decode((string) $row['content_json'], true);
        $content = is_array($content) ? $content : [];
        if (isset($content['image'])) $content['image'] = app_public_asset_url($content['image']);
        if ($modality === 'listening' && is_array($content['questions'] ?? null)) {
            foreach ($content['questions'] as $index => &$question) {
                if (!is_array($question)) continue;
                $question['id'] = is_int($question['id'] ?? null) ? $question['id'] : $index + 1;
                if (!$admin) { unset($question['answer'], $question['explain']); }
            }
            unset($question);
        }
        $unit = [
            'id' => (string) $row['id'], 'courseId' => (string) $row['course_id'],
            'modality' => (string) $row['modality'], 'categoryId' => (string) $row['category_id'],
            'title' => (string) $row['title'], 'subtitle' => (string) $row['subtitle'],
            'masterPrompt' => (string) $row['master_prompt'], 'mediaUrl' => app_public_asset_url($row['media_url']),
            'sortOrder' => (int) $row['sort_order'], 'published' => (bool) $row['published'],
            'content' => is_array($content) ? $content : [],
        ];
        if ($modality === 'ai_lesson') {
            $unit['ttsRevision'] = courseware_tts_revision_value(
                $courseId,
                'speaking',
                (string) $row['id'],
                (string) ($content['prompt'] ?? ''),
                is_array($content['ttsSegments'] ?? null) ? $content['ttsSegments'] : [],
                is_string($content['defaultVoice'] ?? null) ? $content['defaultVoice'] : 'af_heart',
            );
        } elseif ($modality === 'listening') {
            $unit['ttsRevision'] = courseware_tts_revision_value(
                $courseId,
                'listening',
                (string) $row['id'],
                (string) ($content['script'] ?? ''),
                is_array($content['ttsSegments'] ?? null) ? $content['ttsSegments'] : [],
                is_string($content['defaultVoice'] ?? null) ? $content['defaultVoice'] : 'af_heart',
            );
        }
        $units[] = $unit;
    }
    return $units;
}

function courseware_categories_for_modality(PDO $pdo, string $courseId, string $modality): array
{
    $query = $pdo->prepare('SELECT id,name,label,guide,color,sort_order FROM course_categories WHERE course_id=? AND modality=? ORDER BY sort_order,name,id');
    $query->execute([$courseId, $modality]);
    return array_map(static fn($row) => [
        'id' => (string) $row['id'], 'name' => (string) $row['name'], 'label' => (string) $row['label'],
        'guide' => (string) $row['guide'], 'color' => (string) $row['color'], 'sortOrder' => (int) $row['sort_order'],
    ], $query->fetchAll());
}

function courseware_admin_course_data(PDO $pdo, string $courseId): array
{
    $course = courseware_course_row($pdo, $courseId);
    if (!$course) respond(['error' => 'Course tidak ditemukan.'], 404);
    $public = courseware_public_course($course);
    $modules = [];
    foreach (['listening','ai_lesson','live_lesson'] as $modality) {
        $modules[$modality] = [
            'categories' => courseware_categories_for_modality($pdo, $courseId, $modality),
            'units' => courseware_units_for_modality($pdo, $courseId, $modality, true),
        ];
    }
    return ['course' => $public, 'modules' => $modules];
}

function courseware_tts_revision_value(string $courseId, string $type, string $unitId, string $text, array $segments, string $defaultVoice = 'af_heart'): string
{
    $canonicalSegments = json_encode(array_is_list($segments) ? $segments : [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE) ?: '[]';
    if (!in_array($defaultVoice, catalog_tts_voice_ids(), true)) $defaultVoice = 'af_heart';
    return hash('sha256', "speakup-tts-v2\n$type\n$courseId:$unitId\n$text\n$defaultVoice\n$canonicalSegments");
}

function courseware_tts_revision(PDO $pdo, string $courseId, string $type, string $unitId): ?string
{
    $modality = $type === 'speaking' ? 'ai_lesson' : ($type === 'listening' ? 'listening' : '');
    if ($modality === '') return null;
    $row = courseware_unit_record($pdo,$courseId,$modality,$unitId,true);
    if (!$row) return null;
    $content = $row['content'] ?? [];
    $text = (string)($content[$type === 'speaking' ? 'prompt' : 'script'] ?? '');
    $segments = is_array($content['ttsSegments'] ?? null) ? $content['ttsSegments'] : [];
    $defaultVoice = is_string($content['defaultVoice'] ?? null) ? $content['defaultVoice'] : 'af_heart';
    return courseware_tts_revision_value($courseId,$type,$unitId,$text,$segments,$defaultVoice);
}

function courseware_legacy_catalog(array $course, array $modules): array
{
    $levels = [];
    $aiCategories = $modules['ai_lesson']['categories'] ?? [];
    foreach ($aiCategories as $category) {
        $levels[$category['id']] = [
            'id' => $category['id'], 'name' => $category['name'], 'label' => $category['label'],
            'color' => $category['color'] ?: $course['color'], 'bandGuide' => $category['guide'],
            'sortOrder' => $category['sortOrder'], 'units' => [],
        ];
    }
    foreach (($modules['ai_lesson']['units'] ?? []) as $unit) {
        if (!isset($levels[$unit['categoryId']])) continue;
        $content = $unit['content'];
        $levels[$unit['categoryId']]['units'][] = array_merge($content, [
            'id' => $unit['id'], 'courseId' => $unit['courseId'], 'level' => $unit['categoryId'],
            'title' => $unit['title'], 'subtitle' => $unit['subtitle'], 'masterPrompt' => $unit['masterPrompt'],
            'image' => app_public_asset_url($unit['mediaUrl'] ?: ($content['image'] ?? '')), 'sortOrder' => $unit['sortOrder'],
            'published' => $unit['published'],
            'ttsRevision' => courseware_tts_revision_value($unit['courseId'],'speaking',$unit['id'],(string)($content['prompt']??''),(array)($content['ttsSegments']??[]),is_string($content['defaultVoice']??null)?$content['defaultVoice']:'af_heart'),
        ]);
    }
    $listening = [];
    foreach (($modules['listening']['units'] ?? []) as $unit) {
        $content = $unit['content'];
        $listening[] = array_merge($content, [
            'id' => $unit['id'], 'courseId' => $unit['courseId'], 'level' => $unit['categoryId'],
            'title' => $unit['title'], 'objective' => (string) ($content['objective'] ?? $unit['subtitle']),
            'script' => (string) ($content['script'] ?? ''), 'image' => app_public_asset_url($unit['mediaUrl'] ?: ($content['image'] ?? '')),
            'sortOrder' => $unit['sortOrder'], 'published' => $unit['published'],
            'questions' => is_array($content['questions'] ?? null) ? $content['questions'] : [],
            'ttsRevision' => courseware_tts_revision_value($unit['courseId'],'listening',$unit['id'],(string)($content['script']??''),(array)($content['ttsSegments']??[]),is_string($content['defaultVoice']??null)?$content['defaultVoice']:'af_heart'),
        ]);
    }
    $liveTopics = [];
    foreach (($modules['live_lesson']['units'] ?? []) as $unit) {
        $liveTopics[] = array_merge($unit['content'], [
            'id' => $unit['id'], 'label' => $unit['title'], 'description' => $unit['subtitle'],
            'masterPrompt' => $unit['masterPrompt'], 'image' => app_public_asset_url($unit['mediaUrl']),
        ]);
    }
    return ['levels' => array_values($levels), 'listening' => $listening, 'liveTopics' => $liveTopics];
}

function courseware_course_payload(PDO $pdo, array $user, string $courseId): array
{
    $course = courseware_course_row($pdo, $courseId);
    if (!$course) respond(['error' => 'Course tidak ditemukan.'], 404);
    $enrollment = courseware_enrollment($pdo, (int) $user['id'], $courseId);
    $admin = ($user['role'] ?? '') === 'admin';
    if (!$admin && $course['status'] === 'draft') respond(['error' => 'Course tidak tersedia.'], 404);
    $canAccess = $admin || $enrollment !== null;
    $modules = [];
    foreach (['listening','ai_lesson','live_lesson'] as $modality) {
        $enabledColumn = match ($modality) {
            'listening' => 'enable_listening', 'ai_lesson' => 'enable_ai_lesson', default => 'enable_live_lesson',
        };
        $enabled = (bool) $course[$enabledColumn];
        $modules[$modality] = [
            'enabled' => $enabled,
            'categories' => $enabled && $canAccess ? courseware_categories_for_modality($pdo, $courseId, $modality) : [],
            'units' => $enabled && $canAccess ? courseware_units_for_modality($pdo, $courseId, $modality, $admin) : [],
        ];
    }
    $publicCourse = courseware_public_course($course, $enrollment !== null, $enrollment ?: []);
    $summary = $enrollment ? courseware_progress_summary($pdo, (int) $user['id'], $course) : ['completed' => 0, 'total' => 0, 'percent' => 0];
    $publicCourse['progress'] = $summary;
    return [
        'course' => $publicCourse, 'enrolled' => $enrollment !== null, 'canAccess' => $canAccess,
        'modules' => $modules, 'catalog' => $canAccess ? courseware_legacy_catalog($publicCourse, $modules) : null,
    ];
}

function courseware_check_answer(PDO $pdo, array $user, array $input): array
{
    $courseId=trim((string)($input['course_id']??'ielts'))?:'ielts';
    $unitId=trim((string)($input['unit_id']??$input['lesson_id']??''));
    $context=courseware_request_context($pdo,$user,['course_id'=>$courseId,'unit_id'=>$unitId],'listening',false);
    $questionId=$input['question_id']??null;$answer=$input['answer']??null;
    if(!is_int($questionId)||$questionId<1||!is_int($answer)||$answer<0||$answer>5)respond(['error'=>'Pilihan jawaban tidak valid.'],422);
    $questions=$context['unit']['content']['questions']??[];
    foreach((array)$questions as $index=>$question){
        if(!is_array($question))continue;
        $id=is_int($question['id']??null)?$question['id']:$index+1;
        if($id!==$questionId)continue;
        $correct=(int)($question['answer']??-1);
        if($correct<0||$correct>=count((array)($question['options']??[])))respond(['error'=>'Kunci jawaban materi belum dikonfigurasi.'],500);
        if(($user['role']??'')!=='admin')courseware_mark_activity($pdo,(int)$user['id'],$courseId,'listening',$unitId);
        return ['correct'=>$answer===$correct,'correct_index'=>$correct,'explain'=>(string)($question['explain']??'')];
    }
    respond(['error'=>'Pertanyaan tidak tersedia. Muat ulang materi.'],404);
}

function courseware_mark_activity(PDO $pdo, int $userId, string $courseId, string $modality, ?string $unitId): void
{
    if (!in_array($modality, ['listening','ai_lesson','live_lesson'], true)) respond(['error' => 'Jenis aktivitas course tidak valid.'], 422);
    $course = courseware_course_row($pdo, $courseId);
    if (!$course) respond(['error' => 'Course tidak ditemukan.'], 404);
    $unitId = $unitId === '' ? null : $unitId;
    if ($unitId !== null) {
        $q = $pdo->prepare('SELECT 1 FROM course_units WHERE course_id=? AND modality=? AND id=? AND published=1');
        $q->execute([$courseId, $modality, $unitId]);
        if (!$q->fetchColumn()) respond(['error' => 'Unit tidak ditemukan atau tidak dipublikasikan.'], 404);
    }
    $pdo->prepare('UPDATE course_enrollments SET last_modality=?,last_unit_id=?,last_activity_at=? WHERE user_id=? AND course_id=?')->execute([$modality, $unitId, gmdate('c'), $userId, $courseId]);
}

function courseware_enroll_free(PDO $pdo, int $userId, string $courseId): array
{
    $course = courseware_course_row($pdo, $courseId);
    if (!$course || $course['status'] !== 'published') respond(['error' => 'Course tidak tersedia untuk enrollment.'], 404);
    if ((int) $course['price'] !== 0) respond(['error' => 'Course ini memerlukan pembelian.'], 409);
    $pdo->prepare("INSERT OR IGNORE INTO course_enrollments(user_id,course_id,source,enrolled_at) VALUES(?,?,'free',?)")->execute([$userId, $courseId, gmdate('c')]);
    return ['ok' => true, 'course_id' => $courseId, 'enrolled' => true];
}

function courseware_safe_external_link($value): string
{
    if (!is_string($value)) respond(['error' => 'Tautan harus berupa URL HTTPS.'], 422);
    $value = trim($value);
    $parts = parse_url($value);
    if (!is_array($parts) || strtolower((string) ($parts['scheme'] ?? '')) !== 'https' || empty($parts['host']) || isset($parts['user']) || isset($parts['pass']))
        respond(['error' => 'Gunakan tautan HTTPS yang valid.'], 422);
    return $value;
}

function courseware_public_ad(array $row): array
{
    return [
        'id' => (string) $row['id'], 'posterUrl' => app_public_asset_url($row['poster_url']),
        'title' => (string) $row['title'], 'description' => (string) $row['description'],
        'link' => (string) $row['link'], 'sortOrder' => (int) $row['sort_order'],
        'active' => (bool) $row['active'],
    ];
}

function courseware_ads(PDO $pdo, bool $activeOnly = true): array
{
    $query = $pdo->query('SELECT * FROM course_ads ' . ($activeOnly ? 'WHERE active=1' : '') . ' ORDER BY sort_order,created_at,id');
    return array_map('courseware_public_ad', $query->fetchAll());
}

function courseware_save_course(PDO $pdo, array $input, ?string $id = null): string
{
    $name = trim((string) ($input['name'] ?? ''));
    $description = trim((string) ($input['description'] ?? ''));
    $status = (string) ($input['status'] ?? 'draft');
    $price = $input['price'] ?? 0;
    $color = trim((string) ($input['color'] ?? '#315C45'));
    $label = trim((string) ($input['label'] ?? ''));
    $level = trim((string) ($input['level'] ?? ''));
    $sortOrder = $input['sortOrder'] ?? 0;
    if ($name === '' || courseware_strlen($name) > 140 || courseware_strlen($description) > 5000 || courseware_strlen($label) > 100 || courseware_strlen($level) > 100)
        respond(['error' => 'Nama, deskripsi, label, atau level course tidak valid.'], 422);
    if (!in_array($status, ['published','draft','closed'], true)) respond(['error' => 'Status course tidak valid.'], 422);
    if (!is_numeric($price) || floor((float) $price) !== (float) $price || (int) $price < 0 || (int) $price > 1000000000)
        respond(['error' => 'Harga course harus rupiah bulat 0–1.000.000.000.'], 422);
    if (!preg_match('/^#[0-9a-fA-F]{6}$/', $color)) respond(['error' => 'Warna course harus hex, misalnya #315C45.'], 422);
    if (!is_int($sortOrder) || $sortOrder < 0 || $sortOrder > 100000) respond(['error' => 'Urutan course tidak valid.'], 422);
    $poster = courseware_safe_media_url($input['posterUrl'] ?? '', 'Poster');
    $banner = courseware_safe_media_url($input['bannerUrl'] ?? '', 'Banner');
    $flags = [
        !empty($input['enableListening']) ? 1 : 0,
        !empty($input['enableAiLesson']) ? 1 : 0,
        !empty($input['enableLiveLesson']) ? 1 : 0,
    ];
    if ($id === null) {
        $requested = (string) ($input['id'] ?? '');
        $id = $requested !== '' ? courseware_safe_id($requested, 'ID course') : strtolower((string) preg_replace('/[^a-zA-Z0-9]+/', '-', $name));
        $id = trim($id, '-');
        if ($id === '') $id = 'course-' . bin2hex(random_bytes(4));
        if (strlen($id) > 80) $id = substr($id, 0, 80);
        $now = gmdate('c');
        $query = $pdo->prepare('INSERT INTO courses(id,name,description,poster_url,banner_url,status,price,color,label,level,enable_listening,enable_ai_lesson,enable_live_lesson,sort_order,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
        try {
            $query->execute([$id,$name,$description,$poster,$banner,$status,(int)$price,$color,$label,$level,...$flags,$sortOrder,$now,$now]);
        } catch (PDOException $error) {
            if (str_contains(strtolower($error->getMessage()), 'unique')) respond(['error' => 'ID course sudah digunakan.'], 409);
            throw $error;
        }
    } else {
        if (!courseware_course_row($pdo, $id)) respond(['error' => 'Course tidak ditemukan.'], 404);
        $query = $pdo->prepare('UPDATE courses SET name=?,description=?,poster_url=?,banner_url=?,status=?,price=?,color=?,label=?,level=?,enable_listening=?,enable_ai_lesson=?,enable_live_lesson=?,sort_order=?,updated_at=? WHERE id=?');
        $query->execute([$name,$description,$poster,$banner,$status,(int)$price,$color,$label,$level,...$flags,$sortOrder,gmdate('c'),$id]);
    }
    return $id;
}

function courseware_delete_course(PDO $pdo, string $courseId): void
{
    if ($courseId === 'ielts') respond(['error' => 'Course IELTS default tidak dapat dihapus. Ubah status menjadi closed bila perlu.'], 409);
    $check = $pdo->prepare('SELECT (SELECT COUNT(*) FROM course_enrollments WHERE course_id=?)+(SELECT COUNT(*) FROM course_purchases WHERE course_id=?)+(SELECT COUNT(*) FROM course_usage_events WHERE course_id=?)');
    $check->execute([$courseId,$courseId,$courseId]);
    if ((int) $check->fetchColumn() > 0) respond(['error' => 'Course memiliki enrollment, pembelian, atau riwayat penggunaan. Ubah status menjadi closed agar riwayat tetap aman.'], 409);
    tts_cache_delete_course($pdo, $courseId);
    $pdo->prepare('DELETE FROM courses WHERE id=?')->execute([$courseId]);
}

function courseware_modality_enabled(array $course, string $modality): bool
{
    $column = match ($modality) {
        'listening' => 'enable_listening', 'ai_lesson' => 'enable_ai_lesson', 'live_lesson' => 'enable_live_lesson', default => null,
    };
    return $column !== null && !empty($course[$column]);
}

function courseware_normalize_content_payload(string $modality, array $input): array
{
    if (!in_array($modality, ['listening','ai_lesson','live_lesson'], true)) respond(['error' => 'Jenis modul course tidak valid.'], 404);
    $categories = $input['categories'] ?? null;
    $units = $input['units'] ?? null;
    if (!is_array($categories) || !array_is_list($categories) || count($categories) > 100 || !is_array($units) || !array_is_list($units) || count($units) > 1000)
        respond(['error' => 'JSON modul harus memuat daftar categories dan units yang valid.'], 422);
    $normalizedCategories = [];
    foreach ($categories as $index => $category) {
        if (!is_array($category)) respond(['error' => 'Kategori tidak valid.'], 422);
        $id = courseware_safe_id((string) ($category['id'] ?? ''), 'ID kategori');
        if (isset($normalizedCategories[$id])) respond(['error' => 'ID kategori harus unik.'], 422);
        $name = trim((string) ($category['name'] ?? ''));
        $label = trim((string) ($category['label'] ?? ''));
        $guide = trim((string) ($category['guide'] ?? ''));
        $color = trim((string) ($category['color'] ?? '#315C45'));
        $sortOrder = $category['sortOrder'] ?? $index;
        if ($name === '' || courseware_strlen($name) > 120 || courseware_strlen($label) > 160 || courseware_strlen($guide) > 3000)
            respond(['error' => 'Nama, label, atau panduan kategori tidak valid.'], 422);
        if (!preg_match('/^#[0-9a-fA-F]{6}$/', $color) || !is_int($sortOrder) || $sortOrder < 0 || $sortOrder > 100000)
            respond(['error' => 'Warna atau urutan kategori tidak valid.'], 422);
        $normalizedCategories[$id] = compact('id','name','label','guide','color','sortOrder');
    }
    if ($units && !$normalizedCategories) respond(['error' => 'Tambahkan kategori sebelum membuat materi.'], 422);
    $normalizedUnits = [];
    foreach ($units as $index => $unit) {
        if (!is_array($unit)) respond(['error' => 'Materi tidak valid.'], 422);
        $id = courseware_safe_id((string) ($unit['id'] ?? ''), 'ID materi');
        if (isset($normalizedUnits[$id])) respond(['error' => 'ID materi harus unik.'], 422);
        $categoryId = courseware_safe_id((string) ($unit['categoryId'] ?? ''), 'Kategori materi');
        if (!isset($normalizedCategories[$categoryId])) respond(['error' => 'Setiap materi harus terhubung ke kategori yang tersedia.'], 422);
        $title = trim((string) ($unit['title'] ?? ''));
        $subtitle = trim((string) ($unit['subtitle'] ?? ''));
        $masterPrompt = trim((string) ($unit['masterPrompt'] ?? ''));
        $mediaUrl = courseware_safe_media_url($unit['mediaUrl'] ?? '', 'Ilustrasi/video');
        $sortOrder = $unit['sortOrder'] ?? $index;
        $published = array_key_exists('published', $unit) ? (bool) $unit['published'] : true;
        $content = is_array($unit['content'] ?? null) ? $unit['content'] : [];
        if (isset($content['image'])) $content['image'] = app_public_asset_url($content['image']);
        if ($title === '' || courseware_strlen($title) > 180 || courseware_strlen($subtitle) > 500 || courseware_strlen($masterPrompt) > 12000 || !is_int($sortOrder) || $sortOrder < 0 || $sortOrder > 100000)
            respond(['error' => 'Judul, prompt master, atau urutan materi tidak valid.'], 422);
        if (strlen((string) json_encode($content, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) > 200000)
            respond(['error' => 'Konten satu materi maksimal 200 KB.'], 413);
        if ($modality === 'listening') {
            $script = trim((string) ($content['script'] ?? ''));
            $questions = $content['questions'] ?? null;
            if ($script === '' || courseware_strlen($script) > 30000 || !is_array($questions) || !array_is_list($questions) || count($questions) < 1 || count($questions) > 20)
                respond(['error' => 'Materi listening memerlukan naskah dan 1–20 soal.'], 422);
            foreach ($questions as $question) {
                if (!is_array($question) || trim((string) ($question['prompt'] ?? '')) === '' || !is_array($question['options'] ?? null) || count($question['options']) < 2 || count($question['options']) > 6 || !is_int($question['answer'] ?? null) || $question['answer'] < 0 || $question['answer'] >= count($question['options']))
                    respond(['error' => 'Setiap soal listening memerlukan pertanyaan, pilihan, kunci, dan penjelasan yang valid.'], 422);
            }
        } elseif ($modality === 'ai_lesson') {
            if (trim((string) ($content['prompt'] ?? '')) === '' || courseware_strlen((string) $content['prompt']) > 6000)
                respond(['error' => 'AI Lesson memerlukan prompt atau cue card (maksimal 6.000 karakter).'], 422);
        } else {
            foreach (['teacherRole','learnerRole','situation','opening'] as $key)
                if (courseware_strlen((string) ($content[$key] ?? '')) > 2000) respond(['error' => 'Instruksi Live terlalu panjang.'], 422);
        }
        if (in_array($modality, ['listening', 'ai_lesson'], true)) {
            $defaultVoice = $content['defaultVoice'] ?? 'af_heart';
            if (!is_string($defaultVoice)) respond(['error' => 'Model suara default tidak valid.'], 422);
            $defaultVoice = trim($defaultVoice) ?: 'af_heart';
            if (!in_array($defaultVoice, catalog_tts_voice_ids(), true))
                respond(['error' => 'Model suara default tidak didukung.'], 422);
            $content['defaultVoice'] = $defaultVoice;
            $content['ttsSegments'] = catalog_tts_segments($content);
        }
        $normalizedUnits[$id] = [
            'id' => $id, 'categoryId' => $categoryId, 'title' => $title, 'subtitle' => $subtitle,
            'masterPrompt' => $masterPrompt, 'mediaUrl' => $mediaUrl, 'sortOrder' => $sortOrder,
            'published' => $published, 'content' => $content,
        ];
    }
    return ['categories' => array_values($normalizedCategories), 'units' => array_values($normalizedUnits)];
}

function courseware_save_content(PDO $pdo, string $courseId, string $modality, array $input): void
{
    $course = courseware_course_row($pdo, $courseId);
    if (!$course) respond(['error' => 'Course tidak ditemukan.'], 404);
    $normalized = courseware_normalize_content_payload($modality, $input);

    $cacheType = match ($modality) {
        'ai_lesson' => 'speaking',
        'listening' => 'listening',
        default => null,
    };
    $cacheIdsToDelete = [];
    if ($cacheType !== null) {
        $textField = $cacheType === 'speaking' ? 'prompt' : 'script';
        $existingQuery = $pdo->prepare('SELECT id,content_json FROM course_units WHERE course_id=? AND modality=?');
        $existingQuery->execute([$courseId, $modality]);
        $oldRevisions = [];
        foreach ($existingQuery->fetchAll() as $row) {
            $unitId = (string) $row['id'];
            $oldContent = json_decode((string) ($row['content_json'] ?? '{}'), true);
            if (!is_array($oldContent)) $oldContent = [];
            $oldRevisions[$unitId] = courseware_tts_revision_value(
                $courseId,
                $cacheType,
                $unitId,
                (string) ($oldContent[$textField] ?? ''),
                is_array($oldContent['ttsSegments'] ?? null) ? $oldContent['ttsSegments'] : [],
                is_string($oldContent['defaultVoice'] ?? null) ? $oldContent['defaultVoice'] : 'af_heart',
            );
        }
        $newRevisions = [];
        foreach ($normalized['units'] as $unit) {
            $content = $unit['content'];
            $newRevisions[$unit['id']] = courseware_tts_revision_value(
                $courseId,
                $cacheType,
                $unit['id'],
                (string) ($content[$textField] ?? ''),
                is_array($content['ttsSegments'] ?? null) ? $content['ttsSegments'] : [],
                (string) ($content['defaultVoice'] ?? 'af_heart'),
            );
        }
        // Also sweep cache records orphaned by saves made before this invalidation
        // path existed, including entries whose old unit row has already vanished.
        $cachePrefix = $courseId . ':';
        $cacheQuery = $pdo->prepare('SELECT DISTINCT content_id,source_revision FROM shared_tts_cache WHERE content_type=? AND substr(content_id,1,?)=?');
        $cacheQuery->execute([$cacheType, strlen($cachePrefix), $cachePrefix]);
        foreach ($cacheQuery->fetchAll() as $cachedRow) {
            $cacheContentId = (string) $cachedRow['content_id'];
            $unitId = substr($cacheContentId, strlen($cachePrefix));
            if (!isset($newRevisions[$unitId]) || !hash_equals($newRevisions[$unitId], (string) $cachedRow['source_revision']))
                $cacheIdsToDelete[] = $cacheContentId;
        }
        foreach ($oldRevisions as $unitId => $oldRevision) {
            if (!isset($newRevisions[$unitId]) || $newRevisions[$unitId] !== $oldRevision)
                $cacheIdsToDelete[] = $courseId . ':' . $unitId;
        }
        // Clear an orphan from an earlier delete/re-create of the same unit ID.
        foreach ($newRevisions as $unitId => $_newRevision) {
            if (!array_key_exists($unitId, $oldRevisions))
                $cacheIdsToDelete[] = $courseId . ':' . $unitId;
        }
    }

    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM course_units WHERE course_id=? AND modality=?')->execute([$courseId,$modality]);
        $pdo->prepare('DELETE FROM course_categories WHERE course_id=? AND modality=?')->execute([$courseId,$modality]);
        $now = gmdate('c');
        $categoryInsert = $pdo->prepare('INSERT INTO course_categories(course_id,modality,id,name,label,guide,color,sort_order,updated_at) VALUES(?,?,?,?,?,?,?,?,?)');
        foreach ($normalized['categories'] as $category) $categoryInsert->execute([
            $courseId,$modality,$category['id'],$category['name'],$category['label'],$category['guide'],$category['color'],$category['sortOrder'],$now,
        ]);
        $unitInsert = $pdo->prepare('INSERT INTO course_units(course_id,modality,id,category_id,title,subtitle,master_prompt,media_url,content_json,sort_order,published,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
        foreach ($normalized['units'] as $unit) $unitInsert->execute([
            $courseId,$modality,$unit['id'],$unit['categoryId'],$unit['title'],$unit['subtitle'],$unit['masterPrompt'],$unit['mediaUrl'],
            json_encode($unit['content'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE),
            $unit['sortOrder'],$unit['published'] ? 1 : 0,$now,
        ]);
        $pdo->prepare('UPDATE courses SET updated_at=? WHERE id=?')->execute([$now,$courseId]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }

    if ($cacheType !== null) {
        foreach (array_unique($cacheIdsToDelete) as $cacheId)
            tts_cache_delete_content($cacheType, $cacheId);
    }
}

function courseware_export_modality(PDO $pdo, string $courseId, string $modality): array
{
    if (!in_array($modality, ['listening','ai_lesson','live_lesson'], true)) respond(['error' => 'Jenis modul course tidak valid.'], 404);
    $course = courseware_course_row($pdo, $courseId);
    if (!$course) respond(['error' => 'Course tidak ditemukan.'], 404);
    return [
        'schemaVersion' => 1, 'courseId' => $courseId, 'courseName' => (string) $course['name'],
        'modality' => $modality,
        'categories' => courseware_categories_for_modality($pdo,$courseId,$modality),
        'units' => courseware_units_for_modality($pdo,$courseId,$modality,true),
    ];
}

function courseware_log_usage(PDO $pdo, int $userId, ?string $courseId, string $modality, ?string $unitId, string $operation, string $provider, int $diamonds, int $transcriptChars = 0, int $audioBytes = 0, int $durationSeconds = 0, string $status = 'completed'): void
{
    try {
        $pdo->prepare('INSERT INTO course_usage_events(user_id,course_id,modality,unit_id,operation,provider,diamond_cost,transcript_chars,audio_bytes,duration_seconds,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')->execute([
            $userId,$courseId,$modality,$unitId,$operation,substr($provider,0,40),max(0,$diamonds),max(0,$transcriptChars),max(0,$audioBytes),max(0,$durationSeconds),substr($status,0,24),gmdate('c'),
        ]);
    } catch (Throwable $error) {
        // Usage telemetry must never discard an otherwise successful assessment.
        error_log('SpeakUp course usage telemetry write failed: ' . get_class($error));
    }
}

function courseware_list_admin_usage(PDO $pdo, array $filters): array
{
    $where = ['1=1'];
    $args = [];
    $search = trim((string) ($filters['search'] ?? ''));
    if ($search !== '') {
        $where[] = '(u.name LIKE ? OR u.email LIKE ? OR c.name LIKE ? OR e.unit_id LIKE ? OR e.operation LIKE ?)';
        $needle = '%' . $search . '%';
        array_push($args,$needle,$needle,$needle,$needle,$needle);
    }
    $courseId = trim((string) ($filters['course_id'] ?? ''));
    if ($courseId !== '') { $where[] = 'e.course_id=?'; $args[] = $courseId; }
    $modality = trim((string) ($filters['modality'] ?? ''));
    if (in_array($modality,['listening','ai_lesson','live_lesson'],true)) { $where[] = 'e.modality=?'; $args[] = $modality; }
    $status = trim((string) ($filters['status'] ?? ''));
    if ($status !== '') { $where[] = 'e.status=?'; $args[] = $status; }
    $from = trim((string) ($filters['from'] ?? ''));
    if ($from !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/',$from)) { $where[] = 'e.created_at>=?'; $args[] = $from . 'T00:00:00'; }
    $to = trim((string) ($filters['to'] ?? ''));
    if ($to !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/',$to)) { $where[] = 'e.created_at<=?'; $args[] = $to . 'T23:59:59'; }
    $allowedSort = ['created_at','diamond_cost','modality','course_name','user_name'];
    $sort = (string) ($filters['sort'] ?? 'created_at');
    if (!in_array($sort,$allowedSort,true)) $sort = 'created_at';
    $direction = strtolower((string) ($filters['direction'] ?? 'desc')) === 'asc' ? 'ASC' : 'DESC';
    $page = max(1,(int) ($filters['page'] ?? 1));
    $pageSize = max(1,min(100,(int) ($filters['page_size'] ?? 25)));
    $clause = implode(' AND ',$where);
    $count = $pdo->prepare("SELECT COUNT(*) FROM course_usage_events e JOIN users u ON u.id=e.user_id LEFT JOIN courses c ON c.id=e.course_id WHERE $clause");
    $count->execute($args);
    $total = (int) $count->fetchColumn();
    $aggregate = $pdo->prepare("SELECT COUNT(*) AS events,COALESCE(SUM(e.diamond_cost),0) AS diamonds,COALESCE(SUM(e.duration_seconds),0) AS duration_seconds FROM course_usage_events e JOIN users u ON u.id=e.user_id LEFT JOIN courses c ON c.id=e.course_id WHERE $clause");
    $aggregate->execute($args);
    $summary = $aggregate->fetch() ?: ['events'=>$total,'diamonds'=>0,'duration_seconds'=>0];
    $page = min($page,max(1,(int) ceil($total/$pageSize)));
    $query = $pdo->prepare("SELECT e.*,u.name AS user_name,u.email,c.name AS course_name,cu.title AS unit_title FROM course_usage_events e JOIN users u ON u.id=e.user_id LEFT JOIN courses c ON c.id=e.course_id LEFT JOIN course_units cu ON cu.course_id=e.course_id AND cu.modality=e.modality AND cu.id=e.unit_id WHERE $clause ORDER BY $sort $direction,e.id DESC LIMIT ? OFFSET ?");
    foreach ($args as $index=>$value) $query->bindValue($index+1,$value,PDO::PARAM_STR);
    $query->bindValue(count($args)+1,$pageSize,PDO::PARAM_INT);
    $query->bindValue(count($args)+2,($page-1)*$pageSize,PDO::PARAM_INT);
    $query->execute();
    return ['items'=>$query->fetchAll(),'page'=>$page,'pageSize'=>$pageSize,'total'=>$total,'pages'=>max(1,(int)ceil($total/$pageSize)),'summary'=>['events'=>(int)$summary['events'],'diamonds'=>(int)$summary['diamonds'],'duration_seconds'=>(int)$summary['duration_seconds']]];
}

function courseware_users_for_course(PDO $pdo, string $courseId, string $search = '', string $sort = 'name'): array
{
    if (!courseware_course_row($pdo,$courseId)) respond(['error'=>'Course tidak ditemukan.'],404);
    $where = "WHERE u.role='user'";
    $args = [];
    $search = trim($search);
    if ($search !== '') { $where .= ' AND (u.name LIKE ? OR u.email LIKE ?)'; $args = ['%'.$search.'%','%'.$search.'%']; }
    $order = match ($sort) { 'email' => 'u.email', 'enrolled' => 'e.enrolled_at DESC,u.name', default => 'u.name COLLATE NOCASE' };
    $query = $pdo->prepare("SELECT u.id,u.name,u.email,u.created_at,e.enrolled_at FROM users u LEFT JOIN course_enrollments e ON e.user_id=u.id AND e.course_id=? $where ORDER BY $order LIMIT 1000");
    $query->execute(array_merge([$courseId],$args));
    return array_map(static fn($row)=>[
        'id'=>(int)$row['id'],'name'=>(string)$row['name'],'email'=>(string)$row['email'],
        'createdAt'=>(string)$row['created_at'],'enrolled'=>!empty($row['enrolled_at']),'enrolledAt'=>$row['enrolled_at']?:null,
    ],$query->fetchAll());
}

function courseware_set_enrollment(PDO $pdo, string $courseId, int $userId, bool $enrolled): void
{
    if (!courseware_course_row($pdo,$courseId)) respond(['error'=>'Course tidak ditemukan.'],404);
    $query=$pdo->prepare('SELECT role FROM users WHERE id=?');$query->execute([$userId]);
    if($query->fetchColumn()!=='user')respond(['error'=>'Learner tidak ditemukan.'],404);
    if($enrolled){
        $pdo->prepare("INSERT OR IGNORE INTO course_enrollments(user_id,course_id,source,enrolled_at) VALUES(?,?,'admin',?)")->execute([$userId,$courseId,gmdate('c')]);
    }else{
        if($courseId==='ielts')respond(['error'=>'Enrollment IELTS default tidak dapat dihapus.'],409);
        $pdo->prepare('DELETE FROM course_enrollments WHERE user_id=? AND course_id=?')->execute([$userId,$courseId]);
    }
}

function courseware_create_purchase(PDO $pdo, int $userId, string $courseId): array
{
    courseware_expire_purchases($pdo);
    $course=courseware_course_row($pdo,$courseId);
    if(!$course||$course['status']!=='published')respond(['error'=>'Course ini tidak tersedia untuk pembelian.'],404);
    if((int)$course['price']<1)respond(['error'=>'Course gratis dapat langsung di-enroll.'],409);
    if(courseware_enrollment($pdo,$userId,$courseId))respond(['error'=>'Akun sudah terdaftar pada course ini.'],409);
    $existing=$pdo->prepare("SELECT * FROM course_purchases WHERE user_id=? AND course_id=? AND status='pending' AND expires_at>? ORDER BY created_at DESC LIMIT 1");
    $existing->execute([$userId,$courseId,gmdate('c')]);$row=$existing->fetch();
    if($row)return courseware_purchase_public($row);
    $settings=payment_settings();
    $staticText=trim((string)$settings['qris_payload']);
    $staticPath=(string)$settings['static_qr_path'];
    if($staticText===''&&($staticPath===''||!is_file($staticPath)))respond(['error'=>'Admin belum menyiapkan QRIS pembayaran.'],503);
    $base=(int)$course['price'];
    $tax=(int)round($base*max(0,min(100,(float)$settings['tax_percent']))/100);
    $fee=max(0,(int)$settings['admin_fee']);
    $created=gmdate('c');$expires=gmdate('c',time()+86400);
    for($attempt=0;$attempt<30;$attempt++){
        $code=random_int(1,999);$total=$base+$tax+$fee+$code;$qris=null;
        if($staticText!=='')try{$qris=qris_dynamic_payload($staticText,$total);}catch(InvalidArgumentException $error){respond(['error'=>'QRIS merchant tidak dapat dibuat dinamis: '.$error->getMessage()],422);}
        $id=bin2hex(random_bytes(16));
        try{
            $pdo->prepare("INSERT INTO course_purchases(id,user_id,course_id,course_name,base_amount,tax_amount,admin_fee,unique_code,total_amount,qris_payload,status,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,'pending',?,?)")->execute([$id,$userId,$courseId,$course['name'],$base,$tax,$fee,$code,$total,$qris,$created,$expires]);
            $query=$pdo->prepare('SELECT * FROM course_purchases WHERE id=?');$query->execute([$id]);return courseware_purchase_public($query->fetch());
        }catch(PDOException $error){if(str_contains(strtolower($error->getMessage()),'unique'))continue;throw $error;}
    }
    respond(['error'=>'Kode pembayaran unik sedang penuh. Coba lagi.'],503);
}

function courseware_expire_purchases(?PDO $pdo = null): void
{
    ($pdo??db())->prepare("UPDATE course_purchases SET status='expired' WHERE status='pending' AND expires_at<=?")->execute([gmdate('c')]);
}

function courseware_purchase_public(array $row, bool $withQr = true): array
{
    $result=[
        'id'=>(string)$row['id'],'course_id'=>(string)$row['course_id'],'course_name'=>(string)$row['course_name'],
        'base_amount'=>(int)$row['base_amount'],'tax_amount'=>(int)$row['tax_amount'],'admin_fee'=>(int)$row['admin_fee'],
        'unique_code'=>(int)$row['unique_code'],'total_amount'=>(int)$row['total_amount'],'status'=>(string)$row['status'],
        'contacted_at'=>$row['contacted_at']??null,'created_at'=>(string)$row['created_at'],'expires_at'=>(string)$row['expires_at'],
        'approved_at'=>$row['approved_at']??null,
    ];
    if(isset($row['name']))$result['name']=(string)$row['name'];
    if(isset($row['email']))$result['email']=(string)$row['email'];
    if($withQr)$result['qris_payload']=$row['qris_payload']??null;
    return $result;
}

function courseware_user_purchases(PDO $pdo,int $userId):array
{
    courseware_expire_purchases($pdo);
    $query=$pdo->prepare("SELECT * FROM course_purchases WHERE user_id=? AND status<>'deleted' ORDER BY created_at DESC LIMIT 100");
    $query->execute([$userId]);return array_map(static fn($row)=>courseware_purchase_public($row),$query->fetchAll());
}

function courseware_admin_purchases(PDO $pdo,string $search,string $status,int $page,int $pageSize=10):array
{
    courseware_expire_purchases($pdo);
    $where=[];$args=[];
    if($status!==''&&in_array($status,['pending','paid','expired','deleted'],true)){$where[]='p.status=?';$args[]=$status;}
    elseif($status==='')$where[]="p.status<>'deleted'";
    $search=trim($search);
    if($search!==''){$where[]='(p.id LIKE ? OR p.course_name LIKE ? OR u.name LIKE ? OR u.email LIKE ?)';$needle='%'.$search.'%';array_push($args,$needle,$needle,$needle,$needle);}
    $clause=$where?'WHERE '.implode(' AND ',$where):'';$count=$pdo->prepare("SELECT COUNT(*) FROM course_purchases p JOIN users u ON u.id=p.user_id $clause");$count->execute($args);$total=(int)$count->fetchColumn();
    $pageSize=max(1,min(50,$pageSize));$pages=max(1,(int)ceil($total/$pageSize));$page=max(1,min($pages,$page));
    $query=$pdo->prepare("SELECT p.*,u.name,u.email FROM course_purchases p JOIN users u ON u.id=p.user_id $clause ORDER BY p.created_at DESC LIMIT ? OFFSET ?");
    foreach($args as $index=>$value)$query->bindValue($index+1,$value,PDO::PARAM_STR);
    $query->bindValue(count($args)+1,$pageSize,PDO::PARAM_INT);$query->bindValue(count($args)+2,($page-1)*$pageSize,PDO::PARAM_INT);$query->execute();
    return ['items'=>array_map(static fn($row)=>courseware_purchase_public($row,false),$query->fetchAll()),'page'=>$page,'pages'=>$pages,'total'=>$total,'page_size'=>$pageSize];
}

function courseware_approve_purchase(PDO $pdo,string $purchaseId,int $adminId):array
{
    courseware_expire_purchases($pdo);
    $pdo->beginTransaction();
    try{
        $query=$pdo->prepare('SELECT * FROM course_purchases WHERE id=?');$query->execute([$purchaseId]);$purchase=$query->fetch();
        if(!$purchase){$pdo->rollBack();respond(['error'=>'Pembelian course tidak ditemukan.'],404);}
        if($purchase['status']!=='pending'){$pdo->rollBack();respond(['error'=>'Hanya pembayaran pending yang dapat disetujui.'],409);}
        $now=gmdate('c');
        $mark=$pdo->prepare("UPDATE course_purchases SET status='paid',approved_at=?,approved_by=? WHERE id=? AND status='pending'");$mark->execute([$now,$adminId,$purchaseId]);
        if($mark->rowCount()!==1){$pdo->rollBack();respond(['error'=>'Pembelian sudah berubah; muat ulang daftar.'],409);}
        $pdo->prepare("INSERT OR IGNORE INTO course_enrollments(user_id,course_id,source,enrolled_at) VALUES(?,?,'purchase',?)")->execute([(int)$purchase['user_id'],(string)$purchase['course_id'],$now]);
        $pdo->commit();
        $query=$pdo->prepare('SELECT p.*,u.name,u.email FROM course_purchases p JOIN users u ON u.id=p.user_id WHERE p.id=?');$query->execute([$purchaseId]);
        return ['purchase'=>courseware_purchase_public($query->fetch(),false),'enrolled'=>true];
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

function courseware_delete_purchase(PDO $pdo,string $purchaseId):bool
{
    $query=$pdo->prepare("UPDATE course_purchases SET status='deleted' WHERE id=? AND status IN ('pending','expired')");$query->execute([$purchaseId]);return $query->rowCount()===1;
}

function courseware_save_ad(PDO $pdo,array $input,?string $id=null):string
{
    $title=trim((string)($input['title']??''));$description=trim((string)($input['description']??''));
    if($title===''||courseware_strlen($title)>160||courseware_strlen($description)>1000)respond(['error'=>'Judul atau deskripsi iklan tidak valid.'],422);
    $poster=courseware_safe_media_url($input['posterUrl']??'','Poster iklan');
    if($poster==='')respond(['error'=>'Poster iklan wajib diisi.'],422);
    $link=courseware_safe_external_link($input['link']??'');
    $sort=$input['sortOrder']??0;if(!is_int($sort)||$sort<0||$sort>100000)respond(['error'=>'Urutan iklan tidak valid.'],422);
    $active=!empty($input['active'])?1:0;$now=gmdate('c');
    if($id===null){$id='ad-'.bin2hex(random_bytes(8));$pdo->prepare('INSERT INTO course_ads(id,poster_url,title,description,link,sort_order,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)')->execute([$id,$poster,$title,$description,$link,$sort,$active,$now,$now]);}
    else{$stmt=$pdo->prepare('UPDATE course_ads SET poster_url=?,title=?,description=?,link=?,sort_order=?,active=?,updated_at=? WHERE id=?');$stmt->execute([$poster,$title,$description,$link,$sort,$active,$now,$id]);if($stmt->rowCount()===0){$check=$pdo->prepare('SELECT 1 FROM course_ads WHERE id=?');$check->execute([$id]);if(!$check->fetchColumn())respond(['error'=>'Iklan tidak ditemukan.'],404);}}
    return $id;
}
