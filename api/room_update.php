<?php
require_once __DIR__ . '/../includes/base.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'POST required'], 405);
$user = require_user();
$pdo = db();
$sessionId = null;
$roomPublicId = trim((string)($_POST['room_public_id'] ?? ''));
if (!empty($_POST['session_id'])) {
    $sessionId = resolve_session_id($pdo, $_POST['session_id'] ?? '');
    $participant = auth_participant($pdo, $sessionId, $_POST['join_token'] ?? '');
    if ((int)$participant['user_id'] !== (int)$user['id']) {
        json_out(['error' => 'Unauthorized'], 403);
    }
    $stmt = $pdo->prepare('SELECT r.*, rs.public_id AS session_public_id FROM rooms r JOIN room_sessions rs ON rs.room_id = r.id WHERE rs.id = ? LIMIT 1');
    $stmt->execute([$sessionId]);
} else {
    if ($roomPublicId === '') json_out(['error' => 'Room required'], 400);
    $stmt = $pdo->prepare('SELECT r.*, rs.id AS session_id, rs.public_id AS session_public_id FROM rooms r LEFT JOIN room_sessions rs ON rs.room_id = r.id WHERE r.public_id = ? LIMIT 1');
    $stmt->execute([$roomPublicId]);
}
$room = $stmt->fetch();
if (!$room) json_out(['error' => 'Room not found'], 404);
$canEditRoom = (int)$room['owner_id'] === (int)$user['id'] || in_array($user['role'] ?? 'user', ['admin', 'developer'], true);
if (!$canEditRoom) {
    json_out(['error' => 'Only the room owner, admins, or developers can edit this room'], 403);
}

$name = trim((string)($_POST['name'] ?? ''));
if ($name === '') json_out(['error' => 'Room name required'], 400);

$bgPath = $room['background_path'];
$bgMime = $room['background_mime'];
$bgThumbPath = $room['background_thumb_path'] ?? null;
if (!empty($_FILES['background']['tmp_name']) && is_uploaded_file($_FILES['background']['tmp_name'])) {
    try {
        $saved = save_room_background_upload($_FILES['background'], $_FILES['background_thumb'] ?? null);
        $bgPath = $saved['path'];
        $bgMime = $saved['mime'];
        $bgThumbPath = $saved['thumb_path'];
    } catch (RuntimeException $e) {
        json_out(['error' => $e->getMessage()], 400);
    }
}

$pdo->prepare('UPDATE rooms SET name = ?, background_path = ?, background_mime = ?, background_thumb_path = ? WHERE id = ?')
    ->execute([$name, $bgPath, $bgMime, $bgThumbPath, (int)$room['id']]);

$payload = [
    'room_name' => $name,
    'background_path' => $bgPath,
    'background_mime' => $bgMime,
    'background_thumb_path' => $bgThumbPath,
];
if ($sessionId) {
    emit_event($pdo, $sessionId, 'room_update', $payload);
} elseif (!empty($room['session_id'])) {
    emit_event($pdo, (int)$room['session_id'], 'room_update', $payload);
}
json_out($payload);
