<?php
require_once __DIR__ . '/../includes/base.php';

$pdo = db();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $sessionId = resolve_session_id($pdo, $_GET['session_id'] ?? '');
    auth_participant($pdo, $sessionId, $_GET['join_token'] ?? '');
    json_out(['auras' => aura_catalog()]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'Unsupported method'], 405);

$body = input_json();
$sessionId = resolve_session_id($pdo, $body['session_id'] ?? '');
$participant = auth_participant($pdo, $sessionId, $body['join_token'] ?? '');
$requested = array_key_exists('aura_key', $body) ? trim((string)$body['aura_key']) : '';
$auraKey = normalize_aura_key($requested);
if ($requested !== '' && strtolower($requested) !== 'none' && $auraKey === null) {
    json_out(['error' => 'Aura not found'], 404);
}

$pdo->prepare('UPDATE users SET aura_effect = ? WHERE id = ?')->execute([$auraKey, (int)$participant['user_id']]);
$pdo->prepare('UPDATE participants SET aura_effect = ? WHERE user_id = ?')->execute([$auraKey, (int)$participant['user_id']]);

emit_event($pdo, $sessionId, 'aura', [
    'participant_id' => (int)$participant['id'],
    'user_id' => (int)$participant['user_id'],
    'aura_effect' => $auraKey,
]);

json_out(['ok' => true, 'aura_effect' => $auraKey]);
