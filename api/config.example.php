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
    'ICHAN_API_KEY' => '',
    'ICHAN_JWT_SECRET' => '',
    'ICHAN_TTL_MIN' => 30,
    'ICHAN_SUB' => 'api-client',
    'ICHAN_TOKEN_MODE' => 'auto', // auto or manual
    'ICHAN_MANUAL_TOKEN' => '',
    'ICHAN_POOL' => [
        'https://sg1.ichsanlabs.com', 'https://sg2.ichsanlabs.com',
        'https://sg3.ichsanlabs.com', 'https://sg4.ichsanlabs.com',
        'https://sg5.ichsanlabs.com', 'https://sg6.ichsanlabs.com',
        'https://sg7.ichsanlabs.com', 'https://sg8.ichsanlabs.com',
        'https://sg9.ichsanlabs.com', 'https://sg10.ichsanlabs.com',
    ],
    'AI_PROVIDER_DEFAULT' => 'clario',
    'SPEECH_INPUT_MODE_DEFAULT' => 'live_transcribe',
    'GEMINI_API_KEY' => '',
];
