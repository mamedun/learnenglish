<?php
declare(strict_types=1);

// The catalog lives in SQLite. The JSON file is a one-time, original-content seed,
// not the runtime source of truth; existing editor changes are never overwritten.
function catalog_install(PDO $pdo): void
{
    $pdo->exec("CREATE TABLE IF NOT EXISTS course_levels (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, label TEXT NOT NULL,
        color TEXT NOT NULL, band_guide TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0
    )");
    $pdo->exec("CREATE TABLE IF NOT EXISTS speaking_units (
        id TEXT PRIMARY KEY, level_id TEXT NOT NULL REFERENCES course_levels(id),
        title TEXT NOT NULL, subtitle TEXT NOT NULL, emoji TEXT NOT NULL,
        duration TEXT NOT NULL, prompt TEXT NOT NULL, objective TEXT NOT NULL,
        part TEXT NOT NULL, question_type TEXT NOT NULL, band_target TEXT NOT NULL,
        prep_seconds INTEGER NOT NULL DEFAULT 0, response_seconds INTEGER NOT NULL DEFAULT 60,
        image TEXT, image_context TEXT, sort_order INTEGER NOT NULL DEFAULT 0,
        published INTEGER NOT NULL DEFAULT 1 CHECK(published IN (0,1)),
        updated_at TEXT NOT NULL
    )");
    $pdo->exec('CREATE INDEX IF NOT EXISTS speaking_order ON speaking_units(level_id, sort_order)');
    $pdo->exec("CREATE TABLE IF NOT EXISTS listening_lessons (
        id TEXT PRIMARY KEY, level_id TEXT NOT NULL REFERENCES course_levels(id),
        title TEXT NOT NULL, objective TEXT NOT NULL, script TEXT NOT NULL,
        image TEXT, sort_order INTEGER NOT NULL DEFAULT 0,
        published INTEGER NOT NULL DEFAULT 1 CHECK(published IN (0,1)),
        updated_at TEXT NOT NULL
    )");
    $pdo->exec('CREATE INDEX IF NOT EXISTS listening_order ON listening_lessons(level_id, sort_order)');
    $pdo->exec("CREATE TABLE IF NOT EXISTS listening_questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lesson_id TEXT NOT NULL REFERENCES listening_lessons(id) ON DELETE CASCADE,
        position INTEGER NOT NULL, prompt TEXT NOT NULL, options_json TEXT NOT NULL,
        answer_index INTEGER NOT NULL, explanation TEXT NOT NULL
    )");
    $pdo->exec('CREATE INDEX IF NOT EXISTS question_order ON listening_questions(lesson_id, position)');

    // BEGIN IMMEDIATE serializes concurrent first requests. A nonempty catalog is
    // never re-seeded (even after an admin archives every lesson).
    if ((int) $pdo->query('SELECT COUNT(*) FROM course_levels')->fetchColumn() > 0) return;
    $pdo->exec('BEGIN IMMEDIATE');
    try {
        if ((int) $pdo->query('SELECT COUNT(*) FROM course_levels')->fetchColumn() === 0) {
            $raw = file_get_contents(__DIR__ . '/seeds/catalog.json');
            $seed = json_decode($raw ?: '', true, 512, JSON_THROW_ON_ERROR);
            $level = $pdo->prepare('INSERT INTO course_levels(id,name,label,color,band_guide,sort_order) VALUES(?,?,?,?,?,?)');
            $unit = $pdo->prepare('INSERT INTO speaking_units(id,level_id,title,subtitle,emoji,duration,prompt,objective,part,question_type,band_target,prep_seconds,response_seconds,image,image_context,sort_order,published,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
            $lesson = $pdo->prepare('INSERT INTO listening_lessons(id,level_id,title,objective,script,image,sort_order,published,updated_at) VALUES(?,?,?,?,?,?,?,?,?)');
            $question = $pdo->prepare('INSERT INTO listening_questions(lesson_id,position,prompt,options_json,answer_index,explanation) VALUES(?,?,?,?,?,?)');
            $now = gmdate('c');
            foreach ($seed['levels'] as $index => $l) {
                $level->execute([$l['id'], $l['name'], $l['label'], $l['color'], $l['bandGuide'], $index]);
                foreach ($l['units'] as $i => $u) {
                    $unit->execute([$u['id'], $l['id'], $u['title'], $u['subtitle'], $u['emoji'], $u['duration'], $u['prompt'], $u['objective'], $u['part'], $u['questionType'], $u['bandTarget'], $u['prepSeconds'] ?? 0, $u['responseSeconds'] ?? 60, $u['image'] ?? null, $u['imageContext'] ?? null, $i, 1, $now]);
                }
            }
            $positions = [];
            foreach ($seed['listening'] as $l) {
                $position = $positions[$l['level']] ?? 0;
                $positions[$l['level']] = $position + 1;
                $lesson->execute([$l['id'], $l['level'], $l['title'], $l['objective'], $l['script'], $l['image'] ?? null, $position, 1, $now]);
                foreach ($l['questions'] as $i => $q) {
                    $question->execute([$l['id'], $i, $q['prompt'], json_encode($q['options'], JSON_UNESCAPED_UNICODE), $q['answer'], $q['explain']]);
                }
            }
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function catalog_data(PDO $pdo, bool $admin = false): array
{
    $levels = [];
    foreach ($pdo->query('SELECT * FROM course_levels ORDER BY sort_order, id')->fetchAll() as $l) {
        $levels[$l['id']] = [
            'id' => $l['id'], 'name' => $l['name'], 'label' => $l['label'],
            'color' => $l['color'], 'bandGuide' => $l['band_guide'],
            'sortOrder' => (int) $l['sort_order'], 'units' => [],
        ];
    }
    $visibility = $admin ? '' : 'WHERE published=1';
    $units = $pdo->query("SELECT * FROM speaking_units $visibility ORDER BY level_id, sort_order, id")->fetchAll();
    foreach ($units as $u) {
        if (!isset($levels[$u['level_id']])) continue;
        $item = [
            'id' => $u['id'], 'level' => $u['level_id'], 'title' => $u['title'],
            'subtitle' => $u['subtitle'], 'emoji' => $u['emoji'],
            'duration' => $u['duration'], 'prompt' => $u['prompt'],
            'objective' => $u['objective'], 'part' => $u['part'],
            'questionType' => $u['question_type'], 'bandTarget' => $u['band_target'],
            'prepSeconds' => (int) $u['prep_seconds'], 'responseSeconds' => (int) $u['response_seconds'],
            'image' => $u['image'], 'imageContext' => $u['image_context'],
            'sortOrder' => (int) $u['sort_order'],
        ];
        if ($admin) $item['published'] = (bool) $u['published'];
        $levels[$u['level_id']]['units'][] = $item;
    }
    $listening = [];
    $lessonRows = $pdo->query("SELECT * FROM listening_lessons $visibility ORDER BY level_id, sort_order, id")->fetchAll();
    foreach ($lessonRows as $l) {
        $listening[$l['id']] = [
            'id' => $l['id'], 'level' => $l['level_id'], 'title' => $l['title'],
            'objective' => $l['objective'], 'script' => $l['script'], 'image' => $l['image'],
            'sortOrder' => (int) $l['sort_order'], 'questions' => [],
        ];
        if ($admin) $listening[$l['id']]['published'] = (bool) $l['published'];
    }
    foreach ($pdo->query('SELECT * FROM listening_questions ORDER BY lesson_id, position, id')->fetchAll() as $q) {
        if (!isset($listening[$q['lesson_id']])) continue;
        $item = ['id' => (int) $q['id'], 'prompt' => $q['prompt'], 'options' => json_decode($q['options_json'], true)];
        // Answers are checked by the server; do not send answer keys to learners.
        if ($admin) {
            $item['answer'] = (int) $q['answer_index'];
            $item['explain'] = $q['explanation'];
        }
        $listening[$q['lesson_id']]['questions'][] = $item;
    }
    return ['levels' => array_values($levels), 'listening' => array_values($listening)];
}

function catalog_text(array $input, string $key, int $max, bool $required = true): string
{
    $value = $input[$key] ?? '';
    if (!is_string($value)) respond(['error' => "Kolom $key tidak valid."], 422);
    $value = trim($value);
    if (($required && $value === '') || (function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value)) > $max) {
        respond(['error' => "Kolom $key harus diisi (maksimal $max karakter)."], 422);
    }
    return $value;
}
function catalog_order(array $input): int
{
    $n = $input['sortOrder'] ?? 0;
    if (!is_int($n) || $n < 0 || $n > 10000) respond(['error' => 'Urutan harus angka 0–10000.'], 422);
    return $n;
}
function catalog_level_id(PDO $pdo, array $input): string
{
    $id = catalog_text($input, 'level', 4);
    $q = $pdo->prepare('SELECT 1 FROM course_levels WHERE id=?');
    $q->execute([$id]);
    if (!$q->fetchColumn()) respond(['error' => 'Level tidak dikenal.'], 422);
    return $id;
}
function catalog_image(array $input): ?string
{
    $image = catalog_text($input, 'image', 220, false);
    if ($image !== '' && !preg_match('#^/learnenglish/images/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|webp)$#', $image)) {
        respond(['error' => 'Gunakan path gambar lokal /learnenglish/images/... (jpg/png/webp).'], 422);
    }
    return $image === '' ? null : $image;
}
function catalog_save_level(PDO $pdo, string $id, array $d): void
{
    $color = catalog_text($d, 'color', 7);
    if (!preg_match('/^#[0-9a-fA-F]{6}$/', $color)) respond(['error' => 'Warna harus hex seperti #AABBCC.'], 422);
    $q = $pdo->prepare('UPDATE course_levels SET name=?, label=?, band_guide=?, color=?, sort_order=? WHERE id=?');
    $q->execute([catalog_text($d, 'name', 80), catalog_text($d, 'label', 100), catalog_text($d, 'bandGuide', 500), $color, catalog_order($d), $id]);
    if (!$q->rowCount()) respond(['error' => 'Level tidak ditemukan.'], 404);
}
function catalog_save_unit(PDO $pdo, array $d, ?string $id): string
{
    $level = catalog_level_id($pdo, $d);
    $prep = $d['prepSeconds'] ?? 0;
    $response = $d['responseSeconds'] ?? 60;
    if (!is_int($prep) || $prep < 0 || $prep > 120 || !is_int($response) || $response < 15 || $response > 840) {
        respond(['error' => 'Durasi persiapan/respons tidak valid.'], 422);
    }
    $fields = [
        $level, catalog_text($d, 'title', 120), catalog_text($d, 'subtitle', 300),
        catalog_text($d, 'emoji', 12), catalog_text($d, 'duration', 50),
        catalog_text($d, 'prompt', 3000), catalog_text($d, 'objective', 300),
        catalog_text($d, 'part', 160), catalog_text($d, 'questionType', 160),
        catalog_text($d, 'bandTarget', 250), $prep, $response, catalog_image($d),
        catalog_text($d, 'imageContext', 1000, false) ?: null, catalog_order($d),
        !empty($d['published']) ? 1 : 0, gmdate('c'),
    ];
    if ($id === null) {
        $id = 'S-' . strtoupper(bin2hex(random_bytes(5)));
        $q = $pdo->prepare('INSERT INTO speaking_units(id,level_id,title,subtitle,emoji,duration,prompt,objective,part,question_type,band_target,prep_seconds,response_seconds,image,image_context,sort_order,published,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
        $q->execute(array_merge([$id], $fields));
    } else {
        $q = $pdo->prepare('UPDATE speaking_units SET level_id=?, title=?, subtitle=?, emoji=?, duration=?, prompt=?, objective=?, part=?, question_type=?, band_target=?, prep_seconds=?, response_seconds=?, image=?, image_context=?, sort_order=?, published=?, updated_at=? WHERE id=?');
        $q->execute(array_merge($fields, [$id]));
        if (!$q->rowCount()) respond(['error' => 'Unit tidak ditemukan.'], 404);
    }
    return $id;
}
function catalog_save_listening(PDO $pdo, array $d, ?string $id): string
{
    $level = catalog_level_id($pdo, $d);
    $rawQuestions = $d['questions'] ?? null;
    if (!is_array($rawQuestions) || count($rawQuestions) < 1 || count($rawQuestions) > 12 || !array_is_list($rawQuestions)) {
        respond(['error' => 'Buat 1–12 pertanyaan untuk lesson listening.'], 422);
    }
    $questions = [];
    foreach ($rawQuestions as $q) {
        if (!is_array($q) || !isset($q['options']) || !is_array($q['options']) || !array_is_list($q['options']) || count($q['options']) < 2 || count($q['options']) > 5) {
            respond(['error' => 'Setiap soal perlu 2–5 pilihan.'], 422);
        }
        $options = [];
        foreach ($q['options'] as $o) {
            if (!is_string($o) || trim($o) === '' || (function_exists('mb_strlen') ? mb_strlen($o, 'UTF-8') : strlen($o)) > 200) respond(['error' => 'Pilihan jawaban tidak valid.'], 422);
            $options[] = trim($o);
        }
        $answer = $q['answer'] ?? null;
        if (!is_int($answer) || $answer < 0 || $answer >= count($options)) respond(['error' => 'Kunci jawaban di luar pilihan.'], 422);
        $questions[] = [catalog_text($q, 'prompt', 500), json_encode($options, JSON_UNESCAPED_UNICODE), $answer, catalog_text($q, 'explain', 1000)];
    }
    $fields = [$level, catalog_text($d, 'title', 120), catalog_text($d, 'objective', 300), catalog_text($d, 'script', 6000), catalog_image($d), catalog_order($d), !empty($d['published']) ? 1 : 0, gmdate('c')];
    $pdo->beginTransaction();
    try {
        if ($id === null) {
            $id = 'L-' . strtoupper(bin2hex(random_bytes(5)));
            $q = $pdo->prepare('INSERT INTO listening_lessons(id,level_id,title,objective,script,image,sort_order,published,updated_at) VALUES(?,?,?,?,?,?,?,?,?)');
            $q->execute(array_merge([$id], $fields));
        } else {
            $q = $pdo->prepare('UPDATE listening_lessons SET level_id=?,title=?,objective=?,script=?,image=?,sort_order=?,published=?,updated_at=? WHERE id=?');
            $q->execute(array_merge($fields, [$id]));
            if (!$q->rowCount()) respond(['error' => 'Lesson tidak ditemukan.'], 404);
            $pdo->prepare('DELETE FROM listening_questions WHERE lesson_id=?')->execute([$id]);
        }
        $q = $pdo->prepare('INSERT INTO listening_questions(lesson_id,position,prompt,options_json,answer_index,explanation) VALUES(?,?,?,?,?,?)');
        foreach ($questions as $i => $question) $q->execute(array_merge([$id, $i], $question));
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    return $id;
}
function catalog_archive(PDO $pdo, string $table, string $id): void
{
    $table = $table === 'unit' ? 'speaking_units' : 'listening_lessons';
    $q = $pdo->prepare("UPDATE $table SET published=0, updated_at=? WHERE id=?");
    $q->execute([gmdate('c'), $id]);
    if (!$q->rowCount()) respond(['error' => 'Materi tidak ditemukan.'], 404);
}
function catalog_check_answer(PDO $pdo, array $d): array
{
    $lessonId = $d['lesson_id'] ?? null;
    $questionId = $d['question_id'] ?? null;
    $answer = $d['answer'] ?? null;
    if (!is_string($lessonId) || !is_int($questionId) || !is_int($answer) || $answer < 0 || $answer > 4) {
        respond(['error' => 'Pilihan jawaban tidak valid.'], 422);
    }
    $q = $pdo->prepare('SELECT q.answer_index, q.explanation FROM listening_questions q JOIN listening_lessons l ON l.id=q.lesson_id WHERE q.id=? AND q.lesson_id=? AND l.published=1');
    $q->execute([$questionId, $lessonId]);
    $row = $q->fetch();
    if (!$row) respond(['error' => 'Pertanyaan tidak tersedia. Muat ulang katalog.'], 404);
    return ['correct' => $answer === (int) $row['answer_index'], 'correct_index' => (int) $row['answer_index'], 'explain' => $row['explanation']];
}
