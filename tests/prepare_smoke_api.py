"""Prepare an isolated local PHP API tree with throwaway credentials and SQLite.

Never points at a production DB: copy only versioned source/seed files, then start
`php -S ... api/router.php` from the printed directory on localhost.
"""
from pathlib import Path
import shutil
import tempfile

ROOT = Path(__file__).resolve().parents[1]
(ROOT / '.arena').mkdir(exist_ok=True)
TARGET = Path(tempfile.mkdtemp(prefix='smoke-api-', dir=ROOT / '.arena')) / 'api'
TARGET.mkdir()
for name in ('index.php', 'auth.php', 'bootstrap.php', 'catalog.php', 'router.php', 'tts_cache.php',
             'config.example.php', '.htaccess'):
    shutil.copy2(ROOT / 'api' / name, TARGET / name)
shutil.copytree(ROOT / 'api' / 'seeds', TARGET / 'seeds')
(TARGET / 'db').mkdir()
(TARGET / 'config.php').write_text('''<?php
return [
  'ADMIN_EMAIL' => 'smoke-admin@example.invalid',
  'ADMIN_NAME' => 'Smoke Administrator',
  'ADMIN_PASSWORD' => 'smoke-bootstrap-password',
  'APP_ENCRYPTION_KEY' => 'test-only-secret-not-for-real-users-0123456789abcdef',
  'DATA_DB_PATH' => __DIR__ . '/db/smoke.db',
  'CORS_ALLOWED_ORIGINS' => ['http://localhost:5174'],
];
''')
(TARGET / 'config.php').chmod(0o600)
print(TARGET)
