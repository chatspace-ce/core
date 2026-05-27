<?php
require_once __DIR__ . '/../includes/base.php';
header('Cache-Control: no-cache, no-store, must-revalidate');

$pdo = db();
$sessionKey = trim((string)($_GET['session_id'] ?? ''));
$joinToken = trim((string)($_GET['join_token'] ?? ''));
$sessionId = resolve_session_id($pdo, $sessionKey);
auth_participant($pdo, $sessionId, $joinToken);
session_write_close();

json_out([
    'ok' => true,
    'server_time' => gmdate('c'),
]);
