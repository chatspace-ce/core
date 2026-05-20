<?php
require_once __DIR__ . '/../includes/base.php';
header('Cache-Control: no-cache, no-store, must-revalidate');
$pdo = db();
$sessionId = resolve_session_id($pdo, $_GET['session_id'] ?? '');
$last = (int)($_GET['last_event_id'] ?? 0);
$lastCommunity = (int)($_GET['last_community_event_id'] ?? 0);
$me = auth_participant($pdo, $sessionId, $_GET['join_token'] ?? '');
cleanup_stale_participants($pdo, $sessionId);
cleanup_room_effects($pdo, $sessionId);
$dmLeft = 'dm:' . (int)$me['user_id'] . ':%';
$dmRight = 'dm:%:' . (int)$me['user_id'];
$linkKeyExprA = db_concat($pdo, ['p.id', "':'", 'p.linked_to_participant_id']);
$linkKeyExprB = db_concat($pdo, ['p.linked_to_participant_id', "':'", 'p.id']);
session_write_close();

$stmt = $pdo->prepare('SELECT id, type, payload FROM events WHERE session_id = ? AND id > ? ORDER BY id ASC LIMIT 200');
$communityStmt = $pdo->prepare(
    "SELECT id, type, payload FROM community_events
     WHERE id > ?
       AND (
         scope = 'community'
         OR (
           scope = 'link'
           AND session_id = ?
           AND link_key IN (
             SELECT CASE
               WHEN p.id < p.linked_to_participant_id THEN {$linkKeyExprA}
               ELSE {$linkKeyExprB}
             END
             FROM participants p
             WHERE p.session_id = ?
               AND p.linked_to_participant_id IS NOT NULL
               AND (p.id = ? OR p.linked_to_participant_id = ?)
           )
         )
         OR (
           scope = 'dm'
           AND (link_key LIKE ? OR link_key LIKE ?)
         )
       )
     ORDER BY id ASC LIMIT 200"
);
$pollAttempts = 20;
$pollSleepMicroseconds = 100000;
for ($i = 0; $i < $pollAttempts; $i++) {
    $stmt->execute([$sessionId, $last]);
    $rows = $stmt->fetchAll();
    $communityStmt->execute([$lastCommunity, $sessionId, $sessionId, (int)$me['id'], (int)$me['id'], $dmLeft, $dmRight]);
    $communityRows = $communityStmt->fetchAll();
    if ($rows || $communityRows) {
        json_out([
        'events' => array_map(fn($e) => [
            'id' => (int)$e['id'],
            'type' => $e['type'],
            'payload' => json_decode($e['payload'], true) ?: [],
        ], $rows),
        'community_events' => array_map(fn($e) => [
            'id' => (int)$e['id'],
            'type' => $e['type'],
            'payload' => json_decode($e['payload'], true) ?: [],
        ], $communityRows),
        ]);
    }
    usleep($pollSleepMicroseconds);
}
json_out(['events' => [], 'community_events' => []]);
