<?php
require_once __DIR__ . '/../includes/base.php';
$pdo = db();

function game_catalog(): array {
    return [
        'chess' => 2,
        'checkers' => 3,
        'backgammon' => 5,
        'spaceinvasion' => 6,
        'tetris' => 7,
    ];
}

function game_auth(PDO $pdo, int $sessionId, int $participantId, string $token): array {
    $p = auth_participant($pdo, $sessionId, $token);
    if ((int)$p['id'] !== $participantId) json_out(['error' => 'Unauthorized'], 403);
    return $p;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $sessionId = resolve_session_id($pdo, $_GET['session_id'] ?? '');
    game_auth($pdo, $sessionId, (int)($_GET['participant_id'] ?? 0), (string)($_GET['join_token'] ?? ''));
    $pdo->prepare(
        'UPDATE game_sessions
            SET ended_at = CURRENT_TIMESTAMP
          WHERE room_session_id = ?
            AND ended_at IS NULL
            AND lobby_code IN (SELECT lobby_code FROM game_lobbies WHERE status = "ended")'
    )->execute([$sessionId]);
    $stmt = $pdo->prepare(
        'SELECT a.lobby_code, a.game_type, a.started_by_participant_id, p.display_name AS started_by_name,
                gl.user1_id, gl.user2_id,
                p1.display_name AS user1_name, p1.avatar_path AS user1_avatar, p1.webcam_path AS user1_webcam,
                p2.display_name AS user2_name, p2.avatar_path AS user2_avatar, p2.webcam_path AS user2_webcam
         FROM game_sessions a
         JOIN game_lobbies gl ON gl.lobby_code = a.lobby_code
         LEFT JOIN participants p ON p.id = a.started_by_participant_id
         LEFT JOIN participants p1 ON p1.id = gl.user1_id
         LEFT JOIN participants p2 ON p2.id = gl.user2_id
         WHERE a.room_session_id = ? AND a.ended_at IS NULL AND gl.status <> "ended"
         ORDER BY a.started_at DESC'
    );
    $stmt->execute([$sessionId]);
    json_out(['games' => array_map(fn($r) => [
        'lobby_code' => $r['lobby_code'],
        'game_type' => $r['game_type'],
        'started_by_id' => (int)$r['started_by_participant_id'],
        'started_by_name' => $r['started_by_name'] ?: 'Someone',
        'players' => array_values(array_filter([
            $r['user1_id'] ? ['participant_id' => (int)$r['user1_id'], 'display_name' => $r['user1_name'] ?: 'Player 1', 'avatar_url' => $r['user1_webcam'] ?: resolve_avatar($r['user1_avatar'] ?? 'preset:Default'), 'seat' => 1] : null,
            $r['user2_id'] ? ['participant_id' => (int)$r['user2_id'], 'display_name' => $r['user2_name'] ?: 'Player 2', 'avatar_url' => $r['user2_webcam'] ?: resolve_avatar($r['user2_avatar'] ?? 'preset:Default'), 'seat' => 2] : null,
        ])),
    ], $stmt->fetchAll())]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = input_json();
    $action = $body['action'] ?? '';
    $sessionId = resolve_session_id($pdo, $body['session_id'] ?? '');
    $participantId = (int)($body['participant_id'] ?? 0);
    game_auth($pdo, $sessionId, $participantId, (string)($body['join_token'] ?? ''));
    if ($action === 'start') {
        $type = preg_replace('/[^a-z_]/', '', (string)($body['game_type'] ?? ''));
        $allowed = game_catalog();
        if (!isset($allowed[$type])) json_out(['error' => 'Unknown game'], 400);
        $lobby = uuid_v4();
        $pdo->prepare('INSERT INTO game_sessions (room_session_id, game_type, lobby_code, started_by_participant_id) VALUES (?,?,?,?)')->execute([$sessionId, $type, $lobby, $participantId]);
        $pdo->prepare('INSERT INTO game_lobbies (lobby_code, game_id, user1_id, status) VALUES (?,?,?,?)')->execute([$lobby, $allowed[$type], $participantId, 'waiting']);
        $name = $pdo->query('SELECT display_name FROM participants WHERE id = ' . $participantId)->fetchColumn() ?: 'Someone';
        emit_event($pdo, $sessionId, 'game_start', ['lobby_code' => $lobby, 'game_type' => $type, 'started_by_id' => $participantId, 'started_by_name' => $name]);
        json_out(['ok' => true, 'lobby_code' => $lobby]);
    }
    if ($action === 'join') {
        $lobby = (string)($body['lobby_code'] ?? $body['lobby_id'] ?? $body['lobby'] ?? '');
        if ($lobby === '') json_out(['error' => 'Lobby required'], 400);
        $stmt = $pdo->prepare('SELECT gl.* FROM game_lobbies gl JOIN game_sessions gs ON gs.lobby_code = gl.lobby_code WHERE gs.room_session_id = ? AND gl.lobby_code = ? AND gs.ended_at IS NULL LIMIT 1');
        $stmt->execute([$sessionId, $lobby]);
        $row = $stmt->fetch();
        if (!$row || $row['status'] === 'ended') json_out(['error' => 'Game not found'], 404);
        if (!$row['user1_id']) {
            $pdo->prepare('UPDATE game_lobbies SET user1_id = ?, status = "waiting", updated_at = CURRENT_TIMESTAMP WHERE lobby_code = ?')->execute([$participantId, $lobby]);
        } elseif (!$row['user2_id'] && (int)$row['user1_id'] !== $participantId) {
            $pdo->prepare('UPDATE game_lobbies SET user2_id = ?, status = "active", updated_at = CURRENT_TIMESTAMP WHERE lobby_code = ?')->execute([$participantId, $lobby]);
        }
        emit_event($pdo, $sessionId, 'game_update', ['lobby_code' => $lobby]);
        json_out(['ok' => true, 'lobby_code' => $lobby]);
    }
    if ($action === 'close') {
        $lobby = (string)($body['lobby_code'] ?? $body['lobby_id'] ?? $body['lobby'] ?? '');
        if ($lobby === '') json_out(['error' => 'Lobby required'], 400);
        $stmt = $pdo->prepare('SELECT lobby_code FROM game_sessions WHERE room_session_id = ? AND lobby_code = ? LIMIT 1');
        $stmt->execute([$sessionId, $lobby]);
        if (!$stmt->fetchColumn()) json_out(['error' => 'Game not found'], 404);
        $pdo->prepare('UPDATE game_lobbies SET status = "ended", updated_at = CURRENT_TIMESTAMP WHERE lobby_code = ?')->execute([$lobby]);
        $pdo->prepare('UPDATE game_sessions SET ended_at = CURRENT_TIMESTAMP WHERE room_session_id = ? AND lobby_code = ?')->execute([$sessionId, $lobby]);
        $pdo->prepare('DELETE FROM game_moves WHERE lobby_code = ?')->execute([$lobby]);
        $pdo->prepare('DELETE FROM game_state WHERE lobby_code = ?')->execute([$lobby]);
        $pdo->prepare('DELETE FROM game_chat_messages WHERE lobby_code = ?')->execute([$lobby]);
        emit_event($pdo, $sessionId, 'game_end', ['lobby_code' => $lobby]);
        json_out(['ok' => true]);
    }
}

json_out(['error' => 'Bad request'], 400);
