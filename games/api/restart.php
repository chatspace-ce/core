<?php
require_once __DIR__ . '/../../includes/base.php';

$pdo = db();
$body = input_json();
$lobby = (string)($body['lobby_id'] ?? $body['lobby'] ?? '');
$user = (int)($body['user_id'] ?? 0);
$clientRound = max(0, (int)($body['round_number'] ?? 0));
if ($lobby === '' || $user <= 0) json_out(['error' => 'missing fields'], 400);

$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare(
        'SELECT gl.*, gs.room_session_id
           FROM game_lobbies gl
           LEFT JOIN game_sessions gs ON gs.lobby_code = gl.lobby_code AND gs.ended_at IS NULL
          WHERE gl.lobby_code = ?
          LIMIT 1'
    );
    $stmt->execute([$lobby]);
    $row = $stmt->fetch();
    if (!$row) {
        $pdo->rollBack();
        json_out(['error' => 'not found'], 404);
    }

    $round = max(1, (int)($row['round_number'] ?? 1));
    $user1 = $row['user1_id'] ? (int)$row['user1_id'] : null;
    $user2 = $row['user2_id'] ? (int)$row['user2_id'] : null;
    $changed = false;

    if ($row['status'] !== 'ended' && (!$clientRound || $clientRound === $round)) {
        $nextRound = $round + 1;
        if (in_array((int)$row['game_id'], [2, 3], true) && $user1 && $user2) {
            [$user1, $user2] = [$user2, $user1];
        }
        $pdo->prepare(
            'UPDATE game_lobbies
                SET user1_id = ?, user2_id = ?, round_number = ?, status = ?, updated_at = CURRENT_TIMESTAMP
              WHERE lobby_code = ?'
        )->execute([$user1, $user2, $nextRound, ($user1 && $user2) ? 'active' : 'waiting', $lobby]);
        $pdo->prepare('DELETE FROM game_state WHERE lobby_code = ?')->execute([$lobby]);
        $round = $nextRound;
        $changed = true;
    }

    $payload = [
        'ok' => true,
        'changed' => $changed,
        'lobby_code' => $lobby,
        'lobby_id' => $lobby,
        'game_id' => (int)$row['game_id'],
        'user1_id' => $user1,
        'user2_id' => $user2,
        'round_number' => $round,
        'status' => ($user1 && $user2) ? 'active' : (string)$row['status'],
    ];
    if ((int)($row['room_session_id'] ?? 0) > 0) {
        emit_event($pdo, (int)$row['room_session_id'], 'game_update', ['lobby_code' => $lobby]);
    }
    $pdo->commit();
    json_out($payload);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $e;
}
