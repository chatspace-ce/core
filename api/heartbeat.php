<?php
require_once __DIR__ . '/../includes/base.php';

header('Cache-Control: no-cache, no-store, must-revalidate');

$pdo = db();
$sessionId = resolve_session_id($pdo, $_GET['session_id'] ?? '');
auth_participant($pdo, $sessionId, $_GET['join_token'] ?? '');
session_write_close();

$mode = (string)($_GET['mode'] ?? 'all');

function heartbeat_presence(PDO $pdo, int $sessionId): array {
    $stmt = $pdo->prepare('SELECT id, webcam_path, webcam_enabled, last_seen_at FROM participants WHERE session_id = ?');
    $stmt->execute([$sessionId]);
    return array_map(fn($p) => [
        'id' => (int)$p['id'],
        'webcam_path' => $p['webcam_path'],
        'webcam_enabled' => !empty($p['webcam_enabled']),
        'online' => $p['last_seen_at'] && strtotime($p['last_seen_at']) >= time() - 35,
    ], $stmt->fetchAll());
}

$response = [
    'ok' => true,
    'server_time' => gmdate('c'),
];

if ($mode === 'presence' || $mode === 'all') {
    $response['participants'] = heartbeat_presence($pdo, $sessionId);
}

json_out($response);
