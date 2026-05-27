<?php
require_once __DIR__ . '/../includes/base.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'POST required'], 405);

$user = require_user();
$pdo = db();
$body = input_json();
$sessionId = resolve_session_id($pdo, $body['session_id'] ?? '');
$actor = auth_participant($pdo, $sessionId, $body['join_token'] ?? '');

$stmt = $pdo->prepare('SELECT r.*, rs.public_id AS session_public_id FROM rooms r JOIN room_sessions rs ON rs.room_id = r.id WHERE rs.id = ? LIMIT 1');
$stmt->execute([$sessionId]);
$room = $stmt->fetch();
if (!$room) json_out(['error' => 'Room not found'], 404);
if (!can_use_host_tools($user, $room)) json_out(['error' => 'Host tools unavailable'], 403);

$action = (string)($body['action'] ?? '');

if ($action === 'clear_room_history') {
    $clearId = uuid_v4();
    $pdo->prepare('DELETE FROM message_reactions WHERE message_id IN (SELECT id FROM messages WHERE session_id = ?)')
        ->execute([$sessionId]);
    $pdo->prepare('DELETE FROM messages WHERE session_id = ?')->execute([$sessionId]);
    $payload = [
        'clear_id' => $clearId,
        'cleared_by_user_id' => (int)$user['id'],
        'cleared_by_name' => $user['display_name'],
        'cleared_at' => gmdate('Y-m-d H:i:s'),
    ];
    emit_event($pdo, $sessionId, 'room_history_clear', $payload);
    log_tool($pdo, (int)$user['id'], 'clear_room_history', null, (int)$room['id'], 'Cleared room chat history');
    json_out(['ok' => true] + $payload);
}

$targetParticipantId = (int)($body['target_participant_id'] ?? 0);
$stmt = $pdo->prepare('SELECT p.*, u.display_name AS user_display_name FROM participants p JOIN users u ON u.id = p.user_id WHERE p.id = ? AND p.session_id = ? LIMIT 1');
$stmt->execute([$targetParticipantId, $sessionId]);
$target = $stmt->fetch();
if (!$target) json_out(['error' => 'Target user is not in this room'], 404);
if ((int)$target['user_id'] === (int)$user['id']) json_out(['error' => 'You cannot use host tools on yourself'], 400);

if ($action === 'warn') {
    $message = trim((string)($body['message'] ?? ''));
    if ($message === '') json_out(['error' => 'Warning message required'], 400);
    if ((function_exists('mb_strlen') ? mb_strlen($message, 'UTF-8') : strlen($message)) > 1000) {
        json_out(['error' => 'Warning message is too long'], 400);
    }
    emit_event($pdo, $sessionId, 'host_warning', [
        'target_user_id' => (int)$target['user_id'],
        'target_participant_id' => (int)$target['id'],
        'from_user_id' => (int)$user['id'],
        'from_name' => $user['display_name'],
        'message' => $message,
    ]);
    log_tool($pdo, (int)$user['id'], 'warn', (int)$target['user_id'], (int)$room['id'], $message);
    json_out(['ok' => true]);
}

if ($action === 'kick') {
    $permanent = !empty($body['permanent']);
    $minutes = $permanent ? null : max(1, (int)($body['duration_minutes'] ?? 0));
    if (!$permanent && !$minutes) json_out(['error' => 'Kick duration required'], 400);
    $expiresAt = $permanent ? null : gmdate('Y-m-d H:i:s', time() + ($minutes * 60));

    $pdo->prepare(
        'INSERT INTO room_ejections (room_id, user_id, ejected_by_user_id, duration_minutes, permanent, expires_at)
         VALUES (?,?,?,?,?,?)'
    )->execute([(int)$room['id'], (int)$target['user_id'], (int)$user['id'], $minutes, $permanent ? 1 : 0, $expiresAt]);
    $ejectionId = (int)$pdo->lastInsertId();

    $pdo->prepare('UPDATE participants SET last_seen_at = NULL, webcam_path = NULL, linked_to_participant_id = NULL WHERE session_id = ? AND user_id = ?')
        ->execute([$sessionId, (int)$target['user_id']]);
    $pdo->prepare('UPDATE users SET current_room_id = NULL, last_seen_at = CURRENT_TIMESTAMP WHERE id = ?')
        ->execute([(int)$target['user_id']]);

    emit_event($pdo, $sessionId, 'host_ejection', [
        'ejection_id' => $ejectionId,
        'target_user_id' => (int)$target['user_id'],
        'target_participant_id' => (int)$target['id'],
        'duration_minutes' => $minutes,
        'permanent' => $permanent,
        'expires_at' => $expiresAt,
    ]);
    emit_event($pdo, $sessionId, 'presence_leave', [
        'participant_id' => (int)$target['id'],
        'user_id' => (int)$target['user_id'],
        'display_name' => $target['display_name'],
    ]);
    log_tool($pdo, (int)$user['id'], 'kick_from_room', (int)$target['user_id'], (int)$room['id'], $permanent ? 'Permanent' : ($minutes . ' minutes'));
    json_out(['ok' => true, 'ejection_id' => $ejectionId]);
}

if ($action === 'community_eject') {
    if (!can_community_eject($user)) json_out(['error' => 'Developer or admin required'], 403);
    $permanent = !empty($body['permanent']);
    $minutes = $permanent ? null : max(1, (int)($body['duration_minutes'] ?? 0));
    if (!$permanent && !$minutes) json_out(['error' => 'Ejection duration required'], 400);
    $reason = trim((string)($body['reason'] ?? ''));
    if ((function_exists('mb_strlen') ? mb_strlen($reason, 'UTF-8') : strlen($reason)) > 1000) {
        json_out(['error' => 'Reason is too long'], 400);
    }
    $expiresAt = $permanent ? null : gmdate('Y-m-d H:i:s', time() + ($minutes * 60));

    $pdo->prepare(
        'INSERT INTO community_ejections (user_id, ejected_by_user_id, duration_minutes, permanent, reason, expires_at)
         VALUES (?,?,?,?,?,?)'
    )->execute([(int)$target['user_id'], (int)$user['id'], $minutes, $permanent ? 1 : 0, $reason, $expiresAt]);
    $ejectionId = (int)$pdo->lastInsertId();

    $pdo->prepare('UPDATE participants SET last_seen_at = NULL, webcam_path = NULL, linked_to_participant_id = NULL WHERE user_id = ?')
        ->execute([(int)$target['user_id']]);
    $pdo->prepare('UPDATE users SET current_room_id = NULL, last_seen_at = CURRENT_TIMESTAMP WHERE id = ?')
        ->execute([(int)$target['user_id']]);

    emit_event($pdo, $sessionId, 'community_ejection', [
        'ejection_id' => $ejectionId,
        'target_user_id' => (int)$target['user_id'],
        'target_participant_id' => (int)$target['id'],
        'duration_minutes' => $minutes,
        'permanent' => $permanent,
        'expires_at' => $expiresAt,
        'reason' => $reason,
    ]);
    emit_event($pdo, $sessionId, 'presence_leave', [
        'participant_id' => (int)$target['id'],
        'user_id' => (int)$target['user_id'],
        'display_name' => $target['display_name'],
    ]);
    log_tool($pdo, (int)$user['id'], 'community_eject', (int)$target['user_id'], (int)$room['id'], $permanent ? 'Forever' : ($minutes . ' minutes'));
    json_out(['ok' => true, 'ejection_id' => $ejectionId]);
}

json_out(['error' => 'Unknown action'], 400);
