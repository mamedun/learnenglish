<?php
declare(strict_types=1);

// Copy this file to config.php and edit it on the SERVER. config.php is ignored
// by Git. Never put real passwords, encryption keys or provider keys here.
// Prefer absolute paths OUTSIDE the public document root in production.
return [
    'DATA_DB_PATH' => __DIR__ . '/db/data.db',
    'UPLOADS_DIR' => __DIR__ . '/uploads',
    'ADMIN_EMAIL' => 'admin@rikikurnia.my.id',
    'ADMIN_NAME' => 'SpeakUp Administrator',
    'ADMIN_PASSWORD' => '', // Only for first-time bootstrap. Remove after rotation.
    'APP_ENCRYPTION_KEY' => '', // >=32 random characters; needed for JWT and provider key encryption.
    'APP_DEBUG' => false, // true ONLY in a private/local environment.
    'CORS_ALLOWED_ORIGINS' => ['http://localhost:5173'],
    'SESSION_SAMESITE' => 'Lax', // None + HTTPS only when frontend and API are cross-site.
    'TRUST_HTTPS_PROXY' => false, // Enable only behind a trusted HTTPS reverse proxy.
    'CLARIO_BASE_URL' => 'https://clariohub.id/v1',
    'CLARIO_FALLBACK_BASE_URL' => 'https://api-direct.clariohub.id/v1',
    'CLARIO_MODEL' => 'clario/gemini-3.7-flash',
    'GEMINI_LIVE_MODEL' => 'gemini-3.8-live',
    'CLARIO_API_KEY' => '',
    'GEMINI_API_KEY' => '',
];
