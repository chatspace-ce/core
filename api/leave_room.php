<?php
require_once __DIR__ . '/../includes/base.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'POST required'], 405);

$body = input_json();
$pdo = db();
$sessionId = resolve_session_id($pdo, $body['session_id'] ?? '');
$joinToken = (string)($body['join_token'] ?? '');
$p = auth_participant($pdo, $sessionId, $joinToken);

$pdo->prepare('UPDATE participants SET last_seen_at = NULL, webcam_path = NULL, linked_to_participant_id = NULL WHERE id = ? OR linked_to_participant_id = ?')
    ->execute([(int)$p['id'], (int)$p['id']]);
$pdo->prepare('DELETE FROM voice_sessions WHERE participant_id = ?')->execute([(int)$p['id']]);
$pdo->prepare('UPDATE users SET current_room_id = NULL, last_seen_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([(int)$p['user_id']]);
emit_event($pdo, $sessionId, 'voice', [
    'participant_id' => (int)$p['id'],
    'active' => false,
]);
$pdo->prepare('INSERT INTO voice_signals (session_id, from_participant_id, to_participant_id, type, data) VALUES (?,?,?,?,?)')
    ->execute([$sessionId, (int)$p['id'], 0, 'leave', json_encode(['participant_id' => (int)$p['id']])]);
emit_event($pdo, $sessionId, 'presence_leave', [
    'participant_id' => (int)$p['id'],
    'display_name' => $p['display_name'],
]);
emit_event($pdo, $sessionId, 'link', [
    'participant_id' => (int)$p['id'],
    'linked_to' => null,
]);

json_out(['ok' => true]);
