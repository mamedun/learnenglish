<?php
declare(strict_types=1);

/** PHP-only configuration. Do not load dotenv or frontend VITE_* variables. */
function app_config(): array
{
    static $config = null;
    if ($config !== null) return $config;

    $defaults = require __DIR__ . '/config.example.php';
    $file = __DIR__ . '/config.php';
    $local = is_file($file) ? require $file : [];
    if (!is_array($defaults) || !is_array($local)) {
        throw new RuntimeException('SpeakUp config.php must return an array.');
    }
    return $config = array_replace($defaults, $local);
}

function cfg(string $key, mixed $default = ''): mixed
{
    return app_config()[$key] ?? $default;
}

function app_base_path(): string
{
    static $basePath = null;
    if ($basePath !== null) return $basePath;

    $configured = trim((string) cfg('APP_BASE_PATH', '/learnenglish'));
    if ($configured === '' || $configured === '/') return $basePath = '';
    $path = '/' . trim($configured, '/');
    $segments = explode('/', substr($path, 1));
    foreach ($segments as $segment) {
        if ($segment === '' || $segment === '.' || $segment === '..'
            || !preg_match('/^[A-Za-z0-9._~-]+$/D', $segment)) {
            throw new RuntimeException('APP_BASE_PATH must be /, empty, or a safe absolute URL path.');
        }
    }
    return $basePath = $path;
}

function app_public_path(string $relative = ''): string
{
    $base = app_base_path();
    $relative = trim($relative, '/');
    if ($relative === '') return $base === '' ? '/' : $base . '/';
    return ($base === '' ? '' : $base) . '/' . $relative;
}

function app_rebase_local_image_path(mixed $value): ?string
{
    if (!is_string($value) || trim($value) === '') return null;
    $parts = parse_url(trim($value));
    if (!is_array($parts) || isset($parts['scheme']) || isset($parts['host'])
        || isset($parts['user']) || isset($parts['pass'])) return null;
    $path = (string) ($parts['path'] ?? '');
    if ($path === '' || $path[0] !== '/') return null;

    $mediaOffset = strpos($path, '/uploads/media/');
    if ($mediaOffset !== false) {
        $relative = substr($path, $mediaOffset + strlen('/uploads/media/'));
        if ($relative === '' || !preg_match('#^[A-Za-z0-9._/-]+$#D', $relative)) return null;
        foreach (explode('/', $relative) as $segment) {
            if ($segment === '' || $segment === '.' || $segment === '..') return null;
        }
        return app_public_path('api/uploads/media/' . $relative);
    }

    $imageOffset = strpos($path, '/images/');
    if ($imageOffset === false) return null;
    $relative = substr($path, $imageOffset + strlen('/images/'));
    if ($relative === '' || !preg_match('#^[A-Za-z0-9._/-]+$#D', $relative)) return null;
    foreach (explode('/', $relative) as $segment) {
        if ($segment === '' || $segment === '.' || $segment === '..') return null;
    }
    return app_public_path('images/' . $relative);
}

function app_public_asset_url(mixed $value): string
{
    if (!is_string($value) || trim($value) === '') return '';
    $val = trim($value);
    if (filter_var($val, FILTER_VALIDATE_URL)) return $val;
    return app_rebase_local_image_path($val) ?? $val;
}
