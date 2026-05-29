<?php
require_once __DIR__ . '/../includes/base.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'POST required'], 405);

function recovery_code(): string {
    $alphabet = 'abcdefghijklmnopqrstuvwxyz';
    $parts = [];
    for ($i = 0; $i < 4; $i++) {
        $part = '';
        for ($j = 0; $j < 4; $j++) {
            $part .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }
        $parts[] = $part;
    }
    return implode('-', $parts);
}

function recovery_mask(?string $suffix): ?string {
    $suffix = trim((string)$suffix);
    return $suffix === '' ? null : '••••-••••-••••-' . $suffix;
}

$pdo = db();
$body = input_json();
$action = (string)($body['action'] ?? '');

if ($action === 'status' || $action === 'generate') {
    $user = require_user();
    if ($action === 'status') {
        json_out([
            'has_code' => !empty($user['recovery_code_hash']),
            'masked_code' => recovery_mask($user['recovery_code_suffix'] ?? null),
        ]);
    }

    $code = recovery_code();
    $suffix = substr($code, strrpos($code, '-') + 1);
    $stmt = $pdo->prepare('UPDATE users SET recovery_code_hash = ?, recovery_code_suffix = ? WHERE id = ?');
    $stmt->execute([password_hash($code, PASSWORD_DEFAULT), $suffix, (int)$user['id']]);
    json_out([
        'ok' => true,
        'has_code' => true,
        'recovery_code' => $code,
        'masked_code' => recovery_mask($suffix),
    ]);
}

if ($action === 'reset_password') {
    $login = trim((string)($body['login'] ?? ''));
    $code = strtolower(trim((string)($body['recovery_code'] ?? '')));
    $newPassword = (string)($body['new_password'] ?? '');
    $confirmPassword = (string)($body['confirm_password'] ?? '');

    if ($login === '' || $code === '' || $newPassword === '' || $confirmPassword === '') {
        json_out(['error' => 'All fields are required.'], 400);
    }
    if (!preg_match('/^[a-z]{4}-[a-z]{4}-[a-z]{4}-[a-z]{4}$/', $code)) {
        json_out(['error' => 'Recovery code format is not valid.'], 400);
    }
    if (strlen($newPassword) < 8) {
        json_out(['error' => 'New password must be at least 8 characters.'], 400);
    }
    if ($newPassword !== $confirmPassword) {
        json_out(['error' => 'New password and confirmation do not match.'], 400);
    }

    $limit = auth_rate_limit_status($pdo, 'recovery', $login);
    if (!$limit['allowed']) {
        json_out(['error' => $limit['message'], 'retry_after' => $limit['retry_after']], 429);
    }

    $stmt = $pdo->prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(display_name) = LOWER(?) LIMIT 1');
    $stmt->execute([$login, $login]);
    $user = $stmt->fetch();
    if (!$user || empty($user['recovery_code_hash']) || !password_verify($code, (string)$user['recovery_code_hash'])) {
        auth_rate_record_failure($pdo, 'recovery', $login);
        $afterFailure = auth_rate_limit_status($pdo, 'recovery', $login);
        if (!$afterFailure['allowed']) {
            json_out(['error' => $afterFailure['message'], 'retry_after' => $afterFailure['retry_after']], 429);
        }
        json_out(['error' => 'Recovery details were not right.'], 403);
    }
    if (password_verify($newPassword, (string)$user['password_hash'])) {
        json_out(['error' => 'New password must be different from the current password.'], 400);
    }

    $stmt = $pdo->prepare('UPDATE users SET password_hash = ?, recovery_code_hash = NULL, recovery_code_suffix = NULL WHERE id = ?');
    $stmt->execute([password_hash($newPassword, PASSWORD_DEFAULT), (int)$user['id']]);
    auth_rate_clear_identifier($pdo, 'recovery', $login);
    json_out(['ok' => true]);
}

json_out(['error' => 'Unknown action'], 400);
