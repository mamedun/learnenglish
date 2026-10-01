<?php
declare(strict_types=1);

function commerce_install(PDO $pdo): void
{
    $columns = $pdo->query('PRAGMA table_info(users)')->fetchAll();
    if (!in_array('diamonds', array_column($columns, 'name'), true)) {
        $pdo->exec('ALTER TABLE users ADD COLUMN diamonds INTEGER NOT NULL DEFAULT 0 CHECK(diamonds >= 0)');
    }
    $pdo->exec("CREATE TABLE IF NOT EXISTS diamond_transactions(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        delta INTEGER NOT NULL,
        kind TEXT NOT NULL,
        reference_id TEXT,
        note TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'posted' CHECK(status IN ('reserved','posted','refunded')),
        actor_id INTEGER,
        created_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )");
    $pdo->exec('CREATE INDEX IF NOT EXISTS diamond_transactions_user_time ON diamond_transactions(user_id, created_at DESC)');
    $pdo->exec("CREATE TABLE IF NOT EXISTS diamond_purchases(
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        base_amount INTEGER NOT NULL,
        diamond_amount INTEGER NOT NULL,
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
        approved_by INTEGER,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )");
    $pdo->exec('CREATE INDEX IF NOT EXISTS diamond_purchases_user_time ON diamond_purchases(user_id, created_at DESC)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS diamond_purchases_status_time ON diamond_purchases(status, created_at DESC)');
    $pdo->exec("CREATE UNIQUE INDEX IF NOT EXISTS diamond_purchases_active_code ON diamond_purchases(unique_code) WHERE status='pending'");
    $pdo->exec("CREATE TABLE IF NOT EXISTS live_billing_sessions(
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        started_at INTEGER,
        reserved_blocks INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','active','ended')),
        charged_diamonds INTEGER NOT NULL DEFAULT 0,
        refunded_diamonds INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        settled_at TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )");
    $pdo->exec('CREATE INDEX IF NOT EXISTS live_billing_user_time ON live_billing_sessions(user_id, created_at DESC)');
}

function wallet_balance(int $userId): int
{
    $query = db()->prepare('SELECT diamonds FROM users WHERE id=?');
    $query->execute([$userId]);
    $value = $query->fetchColumn();
    return $value === false ? 0 : max(0, (int)$value);
}

function wallet_is_admin(int $userId): bool
{
    $query = db()->prepare("SELECT 1 FROM users WHERE id=? AND role='admin'");
    $query->execute([$userId]);
    return (bool)$query->fetchColumn();
}

function wallet_record(PDO $pdo, int $userId, int $delta, string $kind, ?string $referenceId, string $note, int $actorId = 0, string $status = 'posted'): void
{
    $query = $pdo->prepare('INSERT INTO diamond_transactions(user_id,delta,kind,reference_id,note,status,actor_id,created_at) VALUES(?,?,?,?,?,?,?,?)');
    $query->execute([$userId, $delta, substr($kind, 0, 48), $referenceId, substr($note, 0, 500), $status, $actorId ?: null, gmdate('c')]);
}

/** Reserve wallet units before external AI work; PHP shutdown refunds unless committed. */
function wallet_reserve(int $userId, int $amount, string $kind, string $note): int
{
    if ($amount < 1) throw new InvalidArgumentException('Diamond reservation must be positive.');
    // The negative user id is a no-charge reservation token. The authoritative
    // role check stays server-side and wallet_commit resolves it to the balance.
    if (wallet_is_admin($userId)) return -$userId;
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $update = $pdo->prepare('UPDATE users SET diamonds=diamonds-? WHERE id=? AND diamonds>=?');
        $update->execute([$amount, $userId, $amount]);
        if ($update->rowCount() !== 1) {
            $balance = wallet_balance($userId);
            $pdo->rollBack();
            respond(['error'=>'Diamond tidak cukup untuk fitur ini.','code'=>'insufficient_diamonds','required'=>$amount,'diamonds'=>$balance],402);
        }
        wallet_record($pdo, $userId, -$amount, $kind, bin2hex(random_bytes(12)), $note, 0, 'reserved');
        $transactionId = (int)$pdo->lastInsertId();
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    register_shutdown_function(static function () use ($transactionId): void {
        try {
            wallet_refund_reservation($transactionId, 'Request AI tidak berhasil diselesaikan.');
        } catch (Throwable $error) {
            error_log('SpeakUp wallet reservation refund failed: ' . $error->getMessage());
        }
    });
    return $transactionId;
}

function wallet_commit(int $transactionId): int
{
    if ($transactionId < 0) return wallet_balance(-$transactionId);
    $pdo = db();
    $query = $pdo->prepare("UPDATE diamond_transactions SET status='posted' WHERE id=? AND status='reserved'");
    $query->execute([$transactionId]);
    if ($query->rowCount() !== 1) throw new RuntimeException('Diamond reservation is no longer active.');
    $query = $pdo->prepare('SELECT user_id FROM diamond_transactions WHERE id=?');
    $query->execute([$transactionId]);
    return wallet_balance((int)$query->fetchColumn());
}

function wallet_refund_reservation(int $transactionId, string $reason): void
{
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $query = $pdo->prepare("SELECT user_id,delta,reference_id FROM diamond_transactions WHERE id=? AND status='reserved'");
        $query->execute([$transactionId]);
        $row = $query->fetch();
        if (!$row) {
            $pdo->rollBack();
            return;
        }
        $amount = abs((int)$row['delta']);
        $pdo->prepare('UPDATE users SET diamonds=diamonds+? WHERE id=?')->execute([$amount, (int)$row['user_id']]);
        $pdo->prepare("UPDATE diamond_transactions SET status='refunded',note=? WHERE id=? AND status='reserved'")->execute([substr($reason, 0, 500), $transactionId]);
        wallet_record($pdo, (int)$row['user_id'], $amount, 'refund', $row['reference_id'], $reason);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function wallet_admin_update(int $userId, string $mode, int $value, int $adminId): int
{
    if (!in_array($mode, ['set','adjust'], true) || abs($value) > 1_000_000_000 || ($mode === 'set' && $value < 0)) {
        respond(['error'=>'Perubahan saldo diamond tidak valid.'],422);
    }
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $query = $pdo->prepare('SELECT diamonds FROM users WHERE id=?');
        $query->execute([$userId]);
        $current = $query->fetchColumn();
        if ($current === false) {
            $pdo->rollBack();
            respond(['error'=>'User tidak ditemukan.'],404);
        }
        $current = (int)$current;
        $next = $mode === 'set' ? $value : $current + $value;
        if ($next < 0 || $next > 1_000_000_000) {
            $pdo->rollBack();
            respond(['error'=>'Saldo diamond harus berada antara 0 dan 1.000.000.000.'],422);
        }
        $pdo->prepare('UPDATE users SET diamonds=? WHERE id=?')->execute([$next, $userId]);
        $delta = $next - $current;
        wallet_record($pdo, $userId, $delta, $mode === 'set' ? 'admin_set' : 'admin_adjust', null, $mode === 'set' ? 'Admin menetapkan saldo diamond.' : 'Admin menyesuaikan saldo diamond.', $adminId);
        $pdo->commit();
        return $next;
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function qris_parse_tlv(string $payload): array
{
    $items = [];
    $offset = 0;
    $length = strlen($payload);
    while ($offset < $length) {
        if ($length - $offset < 4) throw new InvalidArgumentException('QRIS TLV terpotong atau tidak valid.');
        $tag = substr($payload, $offset, 2);
        $sizeText = substr($payload, $offset + 2, 2);
        if (!ctype_digit($tag) || !ctype_digit($sizeText)) throw new InvalidArgumentException('Format QRIS bukan data EMVCo TLV yang valid.');
        $size = (int)$sizeText;
        $offset += 4;
        if ($offset + $size > $length) throw new InvalidArgumentException('Panjang field QRIS tidak cocok.');
        $items[] = ['tag'=>$tag,'value'=>substr($payload, $offset, $size)];
        $offset += $size;
    }
    return $items;
}

function qris_build_tlv(array $items): string
{
    $payload = '';
    foreach ($items as $item) {
        $tag = (string)$item['tag'];
        $value = (string)$item['value'];
        $size = strlen($value);
        if (!preg_match('/^\d{2}$/', $tag) || $size > 99) throw new InvalidArgumentException('Field QRIS tidak dapat dikodekan.');
        $payload .= $tag . str_pad((string)$size, 2, '0', STR_PAD_LEFT) . $value;
    }
    return $payload;
}

function qris_crc16(string $payload): string
{
    $crc = 0xFFFF;
    $length = strlen($payload);
    for ($i = 0; $i < $length; $i++) {
        $crc ^= ord($payload[$i]) << 8;
        for ($bit = 0; $bit < 8; $bit++) {
            $crc = ($crc & 0x8000) ? (($crc << 1) ^ 0x1021) : ($crc << 1);
            $crc &= 0xFFFF;
        }
    }
    return strtoupper(str_pad(dechex($crc), 4, '0', STR_PAD_LEFT));
}

function qris_dynamic_payload(string $staticPayload, int $amount): string
{
    $payload = preg_replace('/\s+/', '', trim($staticPayload)) ?? '';
    if ($amount < 1 || !str_starts_with($payload, '000201')) throw new InvalidArgumentException('QRIS harus diawali 000201 dan nominal lebih dari nol.');
    $items = qris_parse_tlv($payload);
    if (!$items || end($items)['tag'] !== '63' || end($items)['value'] === '' || strlen(end($items)['value']) !== 4) {
        throw new InvalidArgumentException('QRIS statis harus memiliki field CRC 6304 yang valid di bagian akhir.');
    }
    $crcField = array_pop($items);
    $withoutCrc = substr($payload, 0, -8);
    if (substr($payload, -8, 4) !== '6304' || qris_crc16($withoutCrc . '6304') !== strtoupper($crcField['value'])) {
        throw new InvalidArgumentException('CRC QRIS tidak valid. Salin ulang teks hasil scan QRIS merchant.');
    }
    $hasPoi = false;
    $hasAmount = false;
    foreach ($items as &$item) {
        if ($item['tag'] === '01') {
            $item['value'] = '12';
            $hasPoi = true;
        } elseif ($item['tag'] === '54') {
            $item['value'] = number_format($amount, 2, '.', '');
            $hasAmount = true;
        }
    }
    unset($item);
    if (!$hasPoi) throw new InvalidArgumentException('QRIS tidak memiliki field Point of Initiation Method (01).');
    if (!$hasAmount) {
        $insertAt = count($items);
        foreach ($items as $index => $item) {
            if ($item['tag'] === '53') $insertAt = $index + 1;
            if ($item['tag'] === '58' && $insertAt === count($items)) {
                $insertAt = $index;
                break;
            }
        }
        array_splice($items, $insertAt, 0, [[
            'tag'=>'54',
            'value'=>number_format($amount, 2, '.', ''),
        ]]);
    }
    $body = qris_build_tlv($items);
    $crcInput = $body . '6304';
    return $crcInput . qris_crc16($crcInput);
}

function payment_settings(): array
{
    return [
        'qris_payload'=>app_setting('payment_qris_payload',''),
        'tax_percent'=>(float)app_setting('payment_tax_percent','0'),
        'admin_fee'=>(int)app_setting('payment_admin_fee','0'),
        'whatsapp'=>app_setting('payment_whatsapp',''),
        'static_qr_path'=>app_setting('payment_static_qr_path',''),
    ];
}

function payment_static_qr_url(array $settings): ?string
{
    return !empty($settings['static_qr_path']) && is_file($settings['static_qr_path']) ? 'shop/static-qr' : null;
}

function payment_public_settings(): array
{
    $settings = payment_settings();
    return [
        'tax_percent'=>$settings['tax_percent'],
        'admin_fee'=>$settings['admin_fee'],
        'whatsapp'=>$settings['whatsapp'],
        'dynamic_qris_available'=>$settings['qris_payload'] !== '',
        'static_qr_available'=>payment_static_qr_url($settings)!==null,
        'static_qr_url'=>payment_static_qr_url($settings),
        'diamond_rate'=>max(1,(int)app_setting('diamond_price_idr','100')),
        'minimum_purchase'=>5000,
        'purchase_step'=>5000,
        'purchase_validity_hours'=>24,
    ];
}

function ensure_payment_upload_dir(): string
{
    $directory = __DIR__ . '/uploads/payment';
    if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) throw new RuntimeException('Folder QR pembayaran tidak dapat dibuat.');
    @chmod($directory, 0700);
    $deny = $directory . '/.htaccess';
    if (!is_file($deny)) @file_put_contents($deny, "Options -Indexes\nRequire all denied\n");
    return $directory;
}

function save_payment_static_qr(array $upload): string
{
    if (($upload['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_OK || empty($upload['tmp_name'])) respond(['error'=>'Pilih file QR pembayaran terlebih dahulu.'],422);
    if ((int)($upload['size']??0)<1 || (int)$upload['size']>5*1024*1024) respond(['error'=>'Gambar QR harus berukuran maksimal 5 MB.'],413);
    $mime=(new finfo(FILEINFO_MIME_TYPE))->file($upload['tmp_name'])?:'';
    $extension=['image/png'=>'png','image/jpeg'=>'jpg','image/webp'=>'webp'][$mime]??null;
    if(!$extension)respond(['error'=>'QR statis harus berupa PNG, JPEG, atau WebP.'],415);
    $directory=ensure_payment_upload_dir();
    $path=$directory.'/static-'.bin2hex(random_bytes(12)).'.'.$extension;
    if(!move_uploaded_file($upload['tmp_name'],$path))respond(['error'=>'Gambar QR tidak dapat disimpan.'],500);
    @chmod($path,0600);
    $old=(string)app_setting('payment_static_qr_path','');
    put_setting('payment_static_qr_path',$path);
    if($old!==''&&$old!==$path&&str_starts_with($old,$directory.'/')&&is_file($old))@unlink($old);
    return $path;
}

function remove_payment_static_qr(): void
{
    $old=(string)app_setting('payment_static_qr_path','');
    put_setting('payment_static_qr_path','');
    $directory=__DIR__.'/uploads/payment/';
    if($old!==''&&str_starts_with($old,$directory)&&is_file($old))@unlink($old);
}

function purchase_public(array $row, bool $includeQris = true): array
{
    $result = [
        'id'=>(string)$row['id'],
        'user_id'=>(int)$row['user_id'],
        'name'=>(string)($row['name'] ?? ''),
        'email'=>(string)($row['email'] ?? ''),
        'base_amount'=>(int)$row['base_amount'],
        'diamond_amount'=>(int)$row['diamond_amount'],
        'tax_amount'=>(int)$row['tax_amount'],
        'admin_fee'=>(int)$row['admin_fee'],
        'unique_code'=>(int)$row['unique_code'],
        'total_amount'=>(int)$row['total_amount'],
        'status'=>(string)$row['status'],
        'contacted_at'=>$row['contacted_at'] ?? null,
        'created_at'=>(string)$row['created_at'],
        'expires_at'=>(string)$row['expires_at'],
        'approved_at'=>$row['approved_at'] ?? null,
    ];
    if ($includeQris) $result['qris_payload']=$row['qris_payload'] ?? null;
    return $result;
}

function expire_diamond_purchases(): void
{
    db()->prepare("UPDATE diamond_purchases SET status='expired' WHERE status='pending' AND expires_at<=?")->execute([gmdate('c')]);
}

function create_diamond_purchase(int $userId, int $baseAmount): array
{
    if ($baseAmount < 5000 || $baseAmount > 500_000_000 || $baseAmount % 5000 !== 0) {
        respond(['error'=>'Nominal pembelian harus kelipatan Rp5.000, minimal Rp5.000.'],422);
    }
    expire_diamond_purchases();
    $settings = payment_settings();
    $staticText = trim((string)$settings['qris_payload']);
    $staticPath = (string)$settings['static_qr_path'];
    if ($staticText === '' && ($staticPath === '' || !is_file($staticPath))) {
        respond(['error'=>'Admin belum menyiapkan QRIS pembayaran.'],503);
    }
    $tax = (int)round($baseAmount * max(0, min(100, (float)$settings['tax_percent'])) / 100);
    $adminFee = max(0, (int)$settings['admin_fee']);
    $diamondRate = max(1, (int)app_setting("diamond_price_idr", "100"));
    $diamonds = intdiv($baseAmount, $diamondRate);
    if ($diamonds < 1) respond(["error"=>"Nominal pembelian tidak cukup untuk membeli satu diamond dengan harga saat ini."],422);
    $createdAt = gmdate('c');
    $expiresAt = gmdate('c', time() + 86400);
    $pdo = db();
    for ($attempt = 0; $attempt < 30; $attempt++) {
        $code = random_int(1, 999);
        $total = $baseAmount + $tax + $adminFee + $code;
        $qris = null;
        if ($staticText !== '') {
            try {
                $qris = qris_dynamic_payload($staticText, $total);
            } catch (InvalidArgumentException $error) {
                respond(['error'=>'QRIS merchant tidak dapat dibuat dinamis: '.$error->getMessage()],422);
            }
        }
        $id = bin2hex(random_bytes(16));
        try {
            $query = $pdo->prepare("INSERT INTO diamond_purchases(id,user_id,base_amount,diamond_amount,tax_amount,admin_fee,unique_code,total_amount,qris_payload,status,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,'pending',?,?)");
            $query->execute([$id,$userId,$baseAmount,$diamonds,$tax,$adminFee,$code,$total,$qris,$createdAt,$expiresAt]);
            $row = $pdo->prepare('SELECT * FROM diamond_purchases WHERE id=?');
            $row->execute([$id]);
            return purchase_public($row->fetch());
        } catch (PDOException $error) {
            if (str_contains(strtolower($error->getMessage()), 'unique')) continue;
            throw $error;
        }
    }
    respond(['error'=>'Kode pembayaran unik sedang penuh. Coba buat pesanan lagi sebentar.'],503);
}

function list_user_diamond_purchases(int $userId): array
{
    expire_diamond_purchases();
    $query = db()->prepare("SELECT * FROM diamond_purchases WHERE user_id=? AND status<>'deleted' ORDER BY created_at DESC LIMIT 100");
    $query->execute([$userId]);
    return array_map(fn($row)=>purchase_public($row), $query->fetchAll());
}

function list_admin_diamond_purchases(string $search, string $status, int $page, int $pageSize = 10): array
{
    expire_diamond_purchases();
    $where = [];
    $args = [];
    if ($status !== '' && in_array($status,['pending','paid','expired','deleted'],true)) {
        $where[] = 'p.status=?';
        $args[] = $status;
    } elseif ($status === '') {
        $where[] = "p.status<>'deleted'";
    }
    $search = trim($search);
    if ($search !== '') {
        $where[] = '(p.id LIKE ? OR u.name LIKE ? OR u.email LIKE ?)';
        $needle = '%' . str_replace(['%','_'], ['\\%','\\_'], $search) . '%';
        array_push($args, $needle, $needle, $needle);
    }
    $clause = $where ? 'WHERE ' . implode(' AND ', $where) : '';
    $pdo = db();
    $count = $pdo->prepare("SELECT COUNT(*) FROM diamond_purchases p JOIN users u ON u.id=p.user_id $clause");
    $count->execute($args);
    $total = (int)$count->fetchColumn();
    $pageSize = max(1, min(50, $pageSize));
    $pages = max(1, (int)ceil($total / $pageSize));
    $page = max(1, min($pages, $page));
    $query = $pdo->prepare("SELECT p.*,u.name,u.email FROM diamond_purchases p JOIN users u ON u.id=p.user_id $clause ORDER BY p.created_at DESC LIMIT ? OFFSET ?");
    foreach ($args as $index=>$value) $query->bindValue($index+1, $value, PDO::PARAM_STR);
    $query->bindValue(count($args)+1, $pageSize, PDO::PARAM_INT);
    $query->bindValue(count($args)+2, ($page-1)*$pageSize, PDO::PARAM_INT);
    $query->execute();
    return ['items'=>array_map(fn($row)=>purchase_public($row,false),$query->fetchAll()),'page'=>$page,'pages'=>$pages,'total'=>$total,'page_size'=>$pageSize];
}

function approve_diamond_purchase(string $purchaseId, int $adminId): array
{
    expire_diamond_purchases();
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $query = $pdo->prepare('SELECT * FROM diamond_purchases WHERE id=?');
        $query->execute([$purchaseId]);
        $purchase = $query->fetch();
        if (!$purchase) {
            $pdo->rollBack();
            respond(['error'=>'Pembelian tidak ditemukan.'],404);
        }
        if ($purchase['status'] !== 'pending') {
            $pdo->rollBack();
            respond(['error'=>'Hanya pembelian pending yang dapat disetujui. Status saat ini: '.$purchase['status']],409);
        }
        $markPaid = $pdo->prepare("UPDATE diamond_purchases SET status='paid',approved_at=?,approved_by=? WHERE id=? AND status='pending'");
        $markPaid->execute([gmdate('c'),$adminId,$purchaseId]);
        if ($markPaid->rowCount() !== 1) {
            $pdo->rollBack();
            respond(['error'=>'Pembelian telah berubah dan tidak dapat disetujui. Muat ulang daftar pesanan.'],409);
        }
        $pdo->prepare('UPDATE users SET diamonds=diamonds+? WHERE id=?')->execute([(int)$purchase['diamond_amount'],(int)$purchase['user_id']]);
        wallet_record($pdo,(int)$purchase['user_id'],(int)$purchase['diamond_amount'],'purchase',$purchaseId,'Pembelian diamond disetujui Admin.',$adminId);
        $balance = wallet_balance((int)$purchase['user_id']);
        $pdo->commit();
        $query = $pdo->prepare('SELECT p.*,u.name,u.email FROM diamond_purchases p JOIN users u ON u.id=p.user_id WHERE p.id=?');
        $query->execute([$purchaseId]);
        return ['purchase'=>purchase_public($query->fetch(),false),'diamonds'=>$balance];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function delete_diamond_purchase(string $purchaseId): bool
{
    $query = db()->prepare("UPDATE diamond_purchases SET status='deleted' WHERE id=? AND status IN ('pending','expired')");
    $query->execute([$purchaseId]);
    return $query->rowCount() === 1;
}

function live_billing_recover_stale(int $userId): void
{
    $policy = function_exists('courseware_policy') ? courseware_policy() : ['max_live_seconds'=>600];
    $maxSeconds = max(60, (int)($policy['max_live_seconds'] ?? 600));
    $query = db()->prepare("SELECT id,status,started_at,created_at,max_seconds FROM live_billing_sessions WHERE user_id=? AND status IN ('reserved','active')");
    $query->execute([$userId]);
    $now = time();
    foreach ($query->fetchAll() as $session) {
        if ($session['status'] === 'reserved') {
            $created = strtotime((string)$session['created_at']);
            if ($created !== false && $now - $created >= 180)
                live_billing_settle((string)$session['id'], $userId, true);
        } elseif (!empty($session['started_at'])) {
            $sessionLimit = max(60, (int)($session['max_seconds'] ?? $maxSeconds));
            if ($now - (int)$session['started_at'] >= $sessionLimit)
                live_billing_settle((string)$session['id'], $userId, false);
        }
    }
}

function live_billing_start(int $userId, string $courseId = 'ielts', ?string $unitId = null): array
{
    live_billing_recover_stale($userId);
    $unlimited = wallet_is_admin($userId);
    $policy = function_exists('courseware_policy') ? courseware_policy() : [];
    $maxSeconds = max(60, (int)($policy['max_live_seconds'] ?? 600));
    $blockMinutes = max(1, min(10, (int)($policy['live_block_minutes'] ?? 5)));
    $rate = max(0, (int)($policy['cost_live_per_minute'] ?? 2));
    $firstMinutes = min($blockMinutes, max(1, (int)ceil($maxSeconds / 60)));
    $reserveCost = $firstMinutes * $rate;
    $pdo = db();
    $pdo->beginTransaction();
    try {
        if (!$unlimited && $reserveCost > 0) {
            // The default policy preserves the original 10-diamond first-block reserve.
            if ($reserveCost === 10) {
                $debit = $pdo->prepare('UPDATE users SET diamonds=diamonds-10 WHERE id=? AND diamonds>=10');
                $debit->execute([$userId]);
            } else {
                $debit = $pdo->prepare('UPDATE users SET diamonds=diamonds-? WHERE id=? AND diamonds>=?');
                $debit->execute([$reserveCost,$userId,$reserveCost]);
            }
            if ($debit->rowCount() !== 1) {
                $balance = wallet_balance($userId);
                $pdo->rollBack();
                respond(['error'=>"Live Lesson memerlukan minimal $reserveCost diamond untuk membuka blok pertama.",'code'=>'insufficient_diamonds','required'=>$reserveCost,'diamonds'=>$balance],402);
            }
        }
        $id = bin2hex(random_bytes(16));
        $pdo->prepare("INSERT INTO live_billing_sessions(id,user_id,reserved_blocks,status,created_at,course_id,unit_id,reserved_minutes,rate_per_minute,block_minutes,max_seconds) VALUES(?,?,1,'reserved',?,?,?,?,?,?,?)")
            ->execute([$id,$userId,gmdate('c'),$courseId,$unitId,$firstMinutes,$rate,$blockMinutes,$maxSeconds]);
        if (!$unlimited && $reserveCost > 0) wallet_record($pdo,$userId,-$reserveCost,'live_reserve',$id,"Cadangan blok pertama Live Lesson ($firstMinutes menit).");
        $balance = wallet_balance($userId);
        $pdo->commit();
        return ['session_id'=>$id,'diamonds'=>$balance,'reserved_blocks'=>1,'reserved_minutes'=>$firstMinutes,'cost_per_minute'=>$rate,'block_minutes'=>$blockMinutes,'max_seconds'=>$maxSeconds,'unlimited_access'=>$unlimited];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function live_billing_authorized(string $sessionId, int $userId): bool
{
    $query = db()->prepare("SELECT 1 FROM live_billing_sessions WHERE id=? AND user_id=? AND status IN ('reserved','active') AND reserved_blocks>=1");
    $query->execute([$sessionId,$userId]);
    return (bool)$query->fetchColumn();
}

function live_billing_mark_started(string $sessionId, int $userId): array
{
    $pdo = db();
    $query = $pdo->prepare("UPDATE live_billing_sessions SET status='active',started_at=COALESCE(started_at,?) WHERE id=? AND user_id=? AND status IN ('reserved','active')");
    $query->execute([time(),$sessionId,$userId]);
    if ($query->rowCount() !== 1) respond(['error'=>'Sesi billing Live tidak valid atau sudah ditutup.'],409);
    return ['ok'=>true,'started_at'=>time()];
}

function live_billing_reserve_next(string $sessionId, int $userId): array
{
    $unlimited = wallet_is_admin($userId);
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $query = $pdo->prepare("SELECT started_at,reserved_blocks,reserved_minutes,rate_per_minute,block_minutes,max_seconds,status FROM live_billing_sessions WHERE id=? AND user_id=?");
        $query->execute([$sessionId,$userId]);
        $session = $query->fetch();
        if (!$session || $session['status'] !== 'active' || (int)$session['reserved_blocks'] < 1 || !$session['started_at']) {
            $pdo->rollBack();
            respond(['error'=>'Blok Live berikutnya tidak tersedia.'],409);
        }
        $elapsed = time() - (int)$session['started_at'];
        $reservedMinutes = max(1,(int)$session['reserved_minutes']);
        $rate = max(0,(int)$session['rate_per_minute']);
        $blockMinutes = max(1,(int)$session['block_minutes']);
        $maxMinutes = max(1,(int)ceil((int)$session['max_seconds']/60));
        $reserveAt = max(0,$reservedMinutes*60-60);
        if ($blockMinutes === 5 && $reservedMinutes === 5 && $elapsed < 240) {
            $pdo->rollBack();
            respond(['error'=>'Blok Live berikutnya belum waktunya.'],409);
        }
        if ($elapsed < $reserveAt) {
            $pdo->rollBack();
            respond(['error'=>'Blok Live berikutnya belum waktunya.'],409);
        }
        if ($elapsed >= (int)$session['max_seconds']) {
            $pdo->rollBack();
            respond(['error'=>'Sesi Live sudah mencapai batas waktu yang ditetapkan.'],409);
        }
        $nextMinutes = min($blockMinutes,max(0,$maxMinutes-$reservedMinutes));
        if ($nextMinutes < 1) {
            $pdo->rollBack();
            respond(['error'=>'Sesi Live sudah memiliki cadangan sampai batas maksimal.'],409);
        }
        $reserveCost = $nextMinutes * $rate;
        if (!$unlimited && $reserveCost > 0) {
            if ($reserveCost === 10) {
                $debit = $pdo->prepare('UPDATE users SET diamonds=diamonds-10 WHERE id=? AND diamonds>=10');
                $debit->execute([$userId]);
            } else {
                $debit = $pdo->prepare('UPDATE users SET diamonds=diamonds-? WHERE id=? AND diamonds>=?');
                $debit->execute([$reserveCost,$userId,$reserveCost]);
            }
            if ($debit->rowCount() !== 1) {
                $balance = wallet_balance($userId);
                $pdo->rollBack();
                respond(['error'=>'Saldo tidak cukup untuk blok Live berikutnya. Sesi akan dihentikan.','code'=>'insufficient_diamonds','required'=>$reserveCost,'diamonds'=>$balance],402);
            }
        }
        $blocks = (int)$session['reserved_blocks'] + 1;
        $newReservedMinutes = $reservedMinutes + $nextMinutes;
        $pdo->prepare('UPDATE live_billing_sessions SET reserved_blocks=?,reserved_minutes=? WHERE id=? AND user_id=?')->execute([$blocks,$newReservedMinutes,$sessionId,$userId]);
        if (!$unlimited && $reserveCost > 0) wallet_record($pdo,$userId,-$reserveCost,'live_reserve',$sessionId.':'.$blocks,"Cadangan blok Live berikutnya ($nextMinutes menit).");
        $balance = wallet_balance($userId);
        $pdo->commit();
        return ['ok'=>true,'diamonds'=>$balance,'reserved_blocks'=>$blocks,'reserved_minutes'=>$newReservedMinutes,'block_minutes'=>$blockMinutes,'unlimited_access'=>$unlimited];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function live_billing_settle(string $sessionId, int $userId, bool $cancel = false): array
{
    $unlimited = wallet_is_admin($userId);
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $query = $pdo->prepare('SELECT * FROM live_billing_sessions WHERE id=? AND user_id=?');
        $query->execute([$sessionId,$userId]);
        $session = $query->fetch();
        if (!$session) {
            $pdo->rollBack();
            respond(['error'=>'Sesi billing Live tidak ditemukan.'],404);
        }
        if ($session['status'] === 'ended') {
            $balance = wallet_balance($userId);
            $pdo->rollBack();
            return ['ok'=>true,'charged_diamonds'=>(int)$session['charged_diamonds'],'refunded_diamonds'=>(int)$session['refunded_diamonds'],'diamonds'=>$balance,'unlimited_access'=>$unlimited];
        }
        $maxSeconds = max(60,(int)($session['max_seconds'] ?? 600));
        $rate = max(0,(int)($session['rate_per_minute'] ?? 2));
        $reservedMinutes = max(0,(int)($session['reserved_minutes'] ?? ((int)$session['reserved_blocks']*5)));
        $reserved = $unlimited ? 0 : $reservedMinutes*$rate;
        // Preserve the original default cap expression while using each session's Admin-configured limit.
        $seconds = $session['started_at']
            ? ($maxSeconds === 600 ? max(0,min(600,time()-(int)$session['started_at'])) : max(0,min($maxSeconds,time()-(int)$session['started_at'])))
            : 0;
        $minutesUsed = (int)ceil($seconds/60);
        $charged = $unlimited ? 0 : (($cancel && !$session['started_at']) ? 0 : min($reserved,$rate===2 ? (int)ceil($seconds/60)*2 : $minutesUsed*$rate));
        $refund = $unlimited ? 0 : max(0,$reserved-$charged);
        if ($refund > 0) {
            $pdo->prepare('UPDATE users SET diamonds=diamonds+? WHERE id=?')->execute([$refund,$userId]);
            wallet_record($pdo,$userId,$refund,'live_refund',$sessionId,'Pengembalian diamond untuk durasi Live yang tidak terpakai.');
        }
        $pdo->prepare("UPDATE live_billing_sessions SET status='ended',charged_diamonds=?,refunded_diamonds=?,settled_at=? WHERE id=? AND user_id=?")->execute([$charged,$refund,gmdate('c'),$sessionId,$userId]);
        if (function_exists('courseware_log_usage') && !empty($session['course_id'])) {
            courseware_log_usage($pdo,$userId,(string)$session['course_id'],'live_lesson',!empty($session['unit_id'])?(string)$session['unit_id']:null,'live_session','gemini_live',$charged,0,0,$seconds,$seconds>0?'completed':'cancelled');
        }
        $balance = wallet_balance($userId);
        $pdo->commit();
        return ['ok'=>true,'charged_diamonds'=>$charged,'refunded_diamonds'=>$refund,'diamonds'=>$balance,'duration_seconds'=>$seconds,'unlimited_access'=>$unlimited];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}
