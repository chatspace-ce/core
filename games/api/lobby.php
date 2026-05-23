<?php
require_once __DIR__ . '/../../includes/base.php';
$pdo = db();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $action = $_GET['action'] ?? 'status';
    $lobby = (string)($_GET['lobby_id'] ?? $_GET['lobby'] ?? '');
    $stmt = $pdo->prepare('SELECT * FROM game_lobbies WHERE lobby_code = ? LIMIT 1');
    $stmt->execute([$lobby]);
    $row = $stmt->fetch();
    if (!$row) json_out(['error' => 'not found'], 404);
    json_out([
        'lobby_id' => $row['lobby_code'],
        'lobby_code' => $row['lobby_code'],
        'game_id' => (int)$row['game_id'],
        'user1_id' => $row['user1_id'] ? (int)$row['user1_id'] : null,
        'user2_id' => $row['user2_id'] ? (int)$row['user2_id'] : null,
        'status' => $row['status'],
    ]);
}

$body = input_json();
$action = $body['action'] ?? '';
$lobby = (string)($body['lobby_id'] ?? $body['lobby'] ?? '');
$user = (int)($body['user_id'] ?? 0);
if ($lobby === '') json_out(['error' => 'missing lobby'], 400);

if ($action === 'join') {
    $stmt = $pdo->prepare('SELECT * FROM game_lobbies WHERE lobby_code = ? LIMIT 1');
    $stmt->execute([$lobby]);
    $row = $stmt->fetch();
    if (!$row) json_out(['error' => 'not found'], 404);
    if (!$row['user1_id']) {
        $pdo->prepare('UPDATE game_lobbies SET user1_id = ?, status = "waiting", updated_at = CURRENT_TIMESTAMP WHERE lobby_code = ?')->execute([$user, $lobby]);
    } elseif (!$row['user2_id'] && (int)$row['user1_id'] !== $user) {
        $pdo->prepare('UPDATE game_lobbies SET user2_id = ?, status = "active", updated_at = CURRENT_TIMESTAMP WHERE lobby_code = ?')->execute([$user, $lobby]);
    }
    $stmt = $pdo->prepare('SELECT * FROM game_lobbies WHERE lobby_code = ? LIMIT 1');
    $stmt->execute([$lobby]);
    $row = $stmt->fetch();
    json_out([
        'ok' => true,
        'lobby_id' => $row['lobby_code'],
        'lobby_code' => $row['lobby_code'],
        'game_id' => (int)$row['game_id'],
        'user1_id' => $row['user1_id'] ? (int)$row['user1_id'] : null,
        'user2_id' => $row['user2_id'] ? (int)$row['user2_id'] : null,
        'status' => $row['status'],
    ]);
}

if ($action === 'close') {
    $pdo->prepare('UPDATE game_lobbies SET status = "ended", updated_at = CURRENT_TIMESTAMP WHERE lobby_code = ?')->execute([$lobby]);
    $pdo->prepare('UPDATE game_sessions SET ended_at = CURRENT_TIMESTAMP WHERE lobby_code = ?')->execute([$lobby]);
    $stmt = $pdo->prepare('SELECT room_session_id FROM game_sessions WHERE lobby_code = ? LIMIT 1');
    $stmt->execute([$lobby]);
    $sessionId = (int)($stmt->fetchColumn() ?: 0);
    if ($sessionId) emit_event($pdo, $sessionId, 'game_end', ['lobby_code' => $lobby]);
    json_out(['ok' => true]);
}

json_out(['ok' => true]);
