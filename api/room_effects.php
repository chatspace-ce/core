<?php
require_once __DIR__ . '/../includes/base.php';

$user = require_user();
$pdo = db();
$body = $_SERVER['REQUEST_METHOD'] === 'POST' ? input_json() : [];
$request = array_merge($_REQUEST, is_array($body) ? $body : []);
$sessionId = resolve_session_id($pdo, $request['session_id'] ?? '');
$participant = auth_participant($pdo, $sessionId, $request['join_token'] ?? '');
if ((int)$participant['user_id'] !== (int)$user['id']) {
    json_out(['error' => 'Unauthorized'], 403);
}

$stmt = $pdo->prepare(
    'SELECT r.*
       FROM rooms r
       JOIN room_sessions rs ON rs.room_id = r.id
      WHERE rs.id = ?
      LIMIT 1'
);
$stmt->execute([$sessionId]);
$room = $stmt->fetch();
if (!$room) json_out(['error' => 'Room not found'], 404);
if (!can_use_host_tools($user, $room)) {
    json_out(['error' => 'Room effects are available to the room owner, guides, developers, and admins.'], 403);
}

cleanup_room_effects($pdo, $sessionId);
$catalog = room_effect_catalog();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    json_out([
        'effects' => array_values($catalog),
        'current' => active_room_effect($pdo, $sessionId),
    ]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'POST required'], 405);
$action = (string)($body['action'] ?? 'start');

if ($action === 'stop') {
    $current = active_room_effect($pdo, $sessionId);
    $pdo->prepare('DELETE FROM room_effects WHERE session_id = ?')->execute([$sessionId]);
    $payload = [
        'active' => false,
        'effect_key' => $current['effect_key'] ?? null,
        'label' => $current['label'] ?? 'Room Effect',
        'stopped_by_participant_id' => (int)$participant['id'],
        'stopped_by_user_id' => (int)$user['id'],
        'stopped_by_name' => $user['display_name'] ?? $participant['display_name'],
    ];
    emit_event($pdo, $sessionId, 'room_effect', $payload);
    json_out(['current' => null, 'event' => $payload]);
}

$effectKey = (string)($body['effect_key'] ?? '');
if (!isset($catalog[$effectKey])) {
    json_out(['error' => 'Unknown room effect'], 400);
}

$durationRaw = trim((string)($body['duration_minutes'] ?? ''));
$duration = null;
$expiresAt = null;
if ($durationRaw !== '') {
    $duration = max(1, min(1440, (int)$durationRaw));
    $expiresAt = gmdate('Y-m-d H:i:s', time() + $duration * 60);
}

$pdo->prepare('DELETE FROM room_effects WHERE session_id = ?')->execute([$sessionId]);
$pdo->prepare(
    'INSERT INTO room_effects (session_id, effect_key, started_by_participant_id, started_by_user_id, duration_minutes, started_at, expires_at)
     VALUES (?,?,?,?,?,CURRENT_TIMESTAMP,?)'
)->execute([$sessionId, $effectKey, (int)$participant['id'], (int)$user['id'], $duration, $expiresAt]);

$current = active_room_effect($pdo, $sessionId);
$payload = $current ?: [
    'active' => true,
    'effect_key' => $effectKey,
    'label' => $catalog[$effectKey]['label'],
    'script' => $catalog[$effectKey]['script'],
];
$payload['changed_by_participant_id'] = (int)$participant['id'];
$payload['changed_by_user_id'] = (int)$user['id'];
$payload['changed_by_name'] = $user['display_name'] ?? $participant['display_name'];
emit_event($pdo, $sessionId, 'room_effect', $payload);

json_out(['current' => $payload]);
