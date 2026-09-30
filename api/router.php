<?php
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
// The PHP development router must never expose private PHP configuration or
// implementation files as directly routable static assets.
if (preg_match('#(?:^|/)(?:config(?:\.example)?|bootstrap|catalog|auth|router)\.php$#i', $uri) || str_contains($uri, '..')) {
    http_response_code(404);
    return true;
}
$file = __DIR__ . $uri;
if ($uri !== '/' && is_file($file) && str_ends_with($uri, '.php')) return false;
require __DIR__ . '/index.php';
