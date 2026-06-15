<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie', 'media/*'],
    'allowed_methods' => ['*'],
    'allowed_origins' => [
        env('FRONTEND_URL', 'http://localhost:5173'),
        'http://localhost:5174',
    ],
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => ['Content-Disposition', 'Content-Type'],
    'max_age' => 0,
    'supports_credentials' => false,
];
