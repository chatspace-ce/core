<?php
require_once __DIR__ . '/../includes/base.php';

$me = require_user();
if (!in_array($me['role'] ?? 'user', ['admin', 'developer'], true)) {
    json_out(['error' => 'Admin required'], 403);
}
$pdo = db();
$roles = ['admin', 'developer', 'guide', 'user'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $rows = $pdo->query('SELECT id, email, display_name, role, created_at FROM users ORDER BY display_name ASC')->fetchAll();
    json_out(['users' => array_map(fn(array $u): array => [
        'id' => (int)$u['id'],
        'email' => $u['email'],
        'display_name' => $u['display_name'],
        'role' => $u['role'] ?: 'user',
        'created_at' => $u['created_at'],
    ], $rows)]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'Unsupported method'], 405);
$body = input_json();
$action = (string)($body['action'] ?? '');

if ($action === 'create') {
    $email = trim((string)($body['email'] ?? ''));
    $name = trim((string)($body['display_name'] ?? ''));
    $password = (string)($body['password'] ?? '');
    $role = (string)($body['role'] ?? 'user');
    if ($email === '' || $name === '' || $password === '') json_out(['error' => 'Email, name, and password required'], 400);
    if (!in_array($role, $roles, true)) json_out(['error' => 'Invalid role'], 400);
    $stmt = $pdo->prepare('INSERT INTO users (email, password_hash, display_name, role, avatar_path) VALUES (?,?,?,?,?)');
    $stmt->execute([$email, password_hash($password, PASSWORD_DEFAULT), $name, $role, 'preset:Default']);
    log_tool($pdo, (int)$me['id'], 'admin_create_user', (int)$pdo->lastInsertId(), null, $name . ' (' . $role . ')');
    json_out(['ok' => true]);
}

$userId = (int)($body['id'] ?? 0);
if (!$userId) json_out(['error' => 'User required'], 400);
if ($userId === (int)$me['id'] && $action === 'delete') json_out(['error' => 'You cannot delete yourself'], 400);

if ($action === 'update') {
    $role = (string)($body['role'] ?? 'user');
    $password = (string)($body['password'] ?? '');
    if (!in_array($role, $roles, true)) json_out(['error' => 'Invalid role'], 400);
    $pdo->prepare('UPDATE users SET role = ? WHERE id = ?')->execute([$role, $userId]);
    if ($password !== '') {
        $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($password, PASSWORD_DEFAULT), $userId]);
    }
    log_tool($pdo, (int)$me['id'], 'admin_update_user', $userId, null, 'Role: ' . $role . ($password !== '' ? '; password reset' : ''));
    json_out(['ok' => true]);
}

if ($action === 'delete') {
    $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$userId]);
    log_tool($pdo, (int)$me['id'], 'admin_delete_user', $userId, null, 'Deleted user');
    json_out(['ok' => true]);
}

json_out(['error' => 'Unknown action'], 400);
