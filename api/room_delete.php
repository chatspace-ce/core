<?php
require_once __DIR__ . '/../includes/base.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'POST required'], 405);

$user = require_user();
$pdo = db();
$source = input_json();
$sessionId = null;
$roomPublicId = trim((string)($source['room_public_id'] ?? ''));

if (!empty($source['session_id'])) {
    $sessionId = resolve_session_id($pdo, $source['session_id'] ?? '');
    $participant = auth_participant($pdo, $sessionId, $source['join_token'] ?? '');
    if ((int)$participant['user_id'] !== (int)$user['id']) {
        json_out(['error' => 'Unauthorized'], 403);
    }
    $stmt = $pdo->prepare('SELECT r.*, rs.id AS session_id, rs.public_id AS session_public_id FROM rooms r JOIN room_sessions rs ON rs.room_id = r.id WHERE rs.id = ? LIMIT 1');
    $stmt->execute([$sessionId]);
} else {
    if ($roomPublicId === '') json_out(['error' => 'Room required'], 400);
    $stmt = $pdo->prepare('SELECT r.*, rs.id AS session_id, rs.public_id AS session_public_id FROM rooms r LEFT JOIN room_sessions rs ON rs.room_id = r.id WHERE r.public_id = ? LIMIT 1');
    $stmt->execute([$roomPublicId]);
}

$room = $stmt->fetch();
if (!$room) json_out(['error' => 'Room not found'], 404);

$canDeleteRoom = (int)$room['owner_id'] === (int)$user['id'] || in_array($user['role'] ?? 'user', ['admin', 'developer'], true);
if (!$canDeleteRoom) {
    json_out(['error' => 'Only the room owner, admins, or developers can delete this room'], 403);
}

$sessionId = (int)($room['session_id'] ?? 0);
$sessionPublicId = (string)($room['session_public_id'] ?? '');
$payload = [
    'room_id' => (int)$room['id'],
    'room_public_id' => $room['public_id'],
    'room_name' => $room['name'],
    'deleted_by_user_id' => (int)$user['id'],
    'deleted_by_name' => $user['display_name'],
];
$roomFiles = array_filter([
    $room['background_path'] ?? null,
    $room['background_thumb_path'] ?? null,
]);

$pdo->beginTransaction();
try {
    if ($sessionId > 0 && $sessionPublicId !== '') {
        $participants = $pdo->prepare('SELECT user_id, join_token FROM participants WHERE session_id = ?');
        $participants->execute([$sessionId]);
        $notice = $pdo->prepare(
            'INSERT INTO room_deletion_notices (session_public_id, join_token, user_id, room_name, payload)
             VALUES (?,?,?,?,?)'
        );
        foreach ($participants->fetchAll() as $p) {
            $notice->execute([
                $sessionPublicId,
                $p['join_token'],
                (int)$p['user_id'],
                $room['name'],
                json_encode($payload, JSON_UNESCAPED_SLASHES),
            ]);
        }
        emit_event($pdo, $sessionId, 'room_deleted', $payload);
    }
    $pdo->prepare('UPDATE users SET current_room_id = NULL WHERE current_room_id = ?')->execute([(int)$room['id']]);
    $pdo->prepare('DELETE FROM rooms WHERE id = ?')->execute([(int)$room['id']]);
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    json_out(['error' => 'Room delete failed'], 500);
}

foreach ($roomFiles as $path) {
    $path = (string)$path;
    $relative = ltrim($path, '/');
    if (!str_starts_with($relative, 'assets/uploads/backgrounds/')) continue;
    $full = dirname(__DIR__) . '/' . $relative;
    if (is_file($full)) @unlink($full);
}

json_out(['ok' => true, 'room_deleted' => $payload]);
