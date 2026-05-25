<?php
require_once __DIR__ . '/../includes/base.php';

$user = require_user();
$pdo = db();
$source = $_SERVER['REQUEST_METHOD'] === 'POST' ? input_json() : $_GET;
$sessionId = resolve_session_id($pdo, $source['session_id'] ?? '');
$participant = auth_participant($pdo, $sessionId, $source['join_token'] ?? '');
if ((int)$participant['user_id'] !== (int)$user['id']) json_out(['error' => 'Unauthorized'], 403);

$lobby = (string)($source['lobby_code'] ?? $source['lobby_id'] ?? $source['lobby'] ?? '');
if ($lobby === '') json_out(['error' => 'Lobby required'], 400);

$stmt = $pdo->prepare(
    'SELECT gl.*
       FROM game_lobbies gl
       JOIN game_sessions gs ON gs.lobby_code = gl.lobby_code
      WHERE gs.room_session_id = ? AND gl.lobby_code = ? AND gs.ended_at IS NULL AND gl.status <> "ended"
      LIMIT 1'
);
$stmt->execute([$sessionId, $lobby]);
$game = $stmt->fetch();
if (!$game) json_out(['error' => 'Game not found'], 404);
$playerIds = array_filter([(int)($game['user1_id'] ?? 0), (int)($game['user2_id'] ?? 0)]);
if (!in_array((int)$participant['id'], $playerIds, true)) json_out(['error' => 'Join the game to use game chat'], 403);

$messagePayload = function(array $row): array {
    return [
        'id' => (int)$row['id'],
        'channel' => 'game',
        'lobby_code' => $row['lobby_code'],
        'participant_id' => (int)$row['participant_id'],
        'user_id' => (int)$row['user_id'],
        'display_name' => $row['display_name'] ?: 'Player',
        'avatar_url' => $row['webcam_path'] ?: resolve_avatar($row['avatar_path'] ?? 'preset:Default'),
        'role' => $row['role'] ?? 'user',
        'is_owner' => (bool)($row['is_owner'] ?? false),
        'content' => $row['content'],
        'message_type' => 'text',
        'sent_at' => $row['sent_at'],
    ];
};

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $since = (int)($source['since_id'] ?? 0);
    $stmt = $pdo->prepare(
        'SELECT gcm.*, p.user_id, p.display_name, p.avatar_path, p.webcam_path, u.role, 0 AS is_owner
           FROM game_chat_messages gcm
           JOIN participants p ON p.id = gcm.participant_id
           JOIN users u ON u.id = p.user_id
          WHERE gcm.lobby_code = ? AND gcm.id > ?
          ORDER BY gcm.id ASC LIMIT 100'
    );
    $stmt->execute([$lobby, $since]);
    $typingCutoff = gmdate('Y-m-d H:i:s', time() - 2);
    $typing = $pdo->prepare(
        'SELECT participant_id FROM game_chat_typing
          WHERE lobby_code = ? AND active = 1 AND updated_at >= ? AND participant_id <> ?'
    );
    $typing->execute([$lobby, $typingCutoff, (int)$participant['id']]);
    json_out([
        'messages' => array_map($messagePayload, $stmt->fetchAll()),
        'typing' => array_map(fn(array $row): int => (int)$row['participant_id'], $typing->fetchAll()),
    ]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'POST required'], 405);
$action = (string)($source['action'] ?? 'message');

if ($action === 'typing') {
    $sql = db_uses_mysql_syntax($pdo)
        ? 'INSERT INTO game_chat_typing (lobby_code, participant_id, active, updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE active = VALUES(active), updated_at = CURRENT_TIMESTAMP'
        : 'INSERT INTO game_chat_typing (lobby_code, participant_id, active, updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(lobby_code, participant_id) DO UPDATE SET active = excluded.active, updated_at = CURRENT_TIMESTAMP';
    $pdo->prepare($sql)->execute([$lobby, (int)$participant['id'], !empty($source['active']) ? 1 : 0]);
    json_out(['ok' => true]);
}

$content = trim((string)($source['content'] ?? ''));
if ($content === '') json_out(['error' => 'Message required'], 400);
$content = function_exists('mb_substr') ? mb_substr($content, 0, 1000) : substr($content, 0, 1000);
$pdo->prepare('INSERT INTO game_chat_messages (lobby_code, participant_id, content) VALUES (?,?,?)')
    ->execute([$lobby, (int)$participant['id'], $content]);
$id = (int)$pdo->lastInsertId();
$stmt = $pdo->prepare(
    'SELECT gcm.*, p.user_id, p.display_name, p.avatar_path, p.webcam_path, u.role, 0 AS is_owner
       FROM game_chat_messages gcm
       JOIN participants p ON p.id = gcm.participant_id
       JOIN users u ON u.id = p.user_id
      WHERE gcm.id = ? LIMIT 1'
);
$stmt->execute([$id]);
json_out($messagePayload($stmt->fetch()));
