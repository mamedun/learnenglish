<?php
declare(strict_types=1);

// Copy this file to config.php and edit it on the SERVER. config.php is ignored
// by Git. Never put real passwords, encryption keys or provider keys here.
// Prefer absolute paths OUTSIDE the public document root in production.
return [
    'DATA_DB_PATH' => __DIR__ . '/db/data.db',
    'UPLOADS_DIR' => __DIR__ . '/uploads',
    'TTS_CACHE_DIR' => __DIR__ . '/uploads/tts-cache', // Shared Kokoro cache, private to the API; LRU limit is fixed at 1 GB.
    'ADMIN_EMAIL' => 'admin@rikikurnia.my.id',
    'ADMIN_NAME' => 'SpeakUp Administrator',
    'ADMIN_PASSWORD' => '', // Only for first-time bootstrap. Remove after rotation.
    'APP_ENCRYPTION_KEY' => '', // >=32 random characters; needed for JWT and provider key encryption.
    'APP_BASE_PATH' => '/learnenglish', // Public URL prefix for the app; use '/' when deployed at the domain root.
    'APP_DEBUG' => false, // true ONLY in a private/local environment.
    'CORS_ALLOWED_ORIGINS' => ['http://localhost:5173'],
    'SESSION_SAMESITE' => 'Lax', // None + HTTPS only when frontend and API are cross-site.
    'TRUST_HTTPS_PROXY' => false, // Enable only behind a trusted HTTPS reverse proxy.
    'CLARIO_BASE_URL' => 'https://clariohub.id/v1',
    'CLARIO_FALLBACK_BASE_URL' => 'https://api-direct.clariohub.id/v1',
    'CLARIO_MODEL' => 'clario/gemini-3.7-flash',
    'GEMINI_LIVE_MODEL' => 'gemini-3.8-live',
    'CLARIO_API_KEY' => '',
    'GEMINI_AI_API_KEY' => '', // Separate server-side text/audio AI key; distinct from Gemini Live.
    'GEMINI_AI_MODEL' => 'gemini-2.5-flash',
    'OPENROUTER_API_KEY' => '',
    'OPENROUTER_MODEL' => 'google/gemini-2.5-flash',
    'FREE_API_KEY' => '',
    'FREE_JWT_SECRET' => '',
    'FREE_TTL_MIN' => 30,
    'FREE_SUB' => 'api-client',
    'FREE_TOKEN_MODE' => 'auto', // auto or manual
    'FREE_MANUAL_TOKEN' => '',
    'FREE_POOL' => [
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
