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
