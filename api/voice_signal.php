<?php
require_once __DIR__ . '/../includes/base.php';
$pdo = db();

function voice_auth(PDO $pdo, int $sessionId, int $participantId, ?string $token): void {
    $p = auth_participant($pdo, $sessionId, $token ?: '');
    if ((int)$p['id'] !== $participantId) json_out(['error' => 'Unauthorized'], 403);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $sessionId = resolve_session_id($pdo, $_GET['session_id'] ?? '');
    $participantId = (int)($_GET['participant_id'] ?? 0);
    $after = (int)($_GET['after'] ?? 0);
    voice_auth($pdo, $sessionId, $participantId, $_GET['join_token'] ?? '');

    $stmt = $pdo->prepare(
        'SELECT v.participant_id, v.muted, v.deafened, v.speaking,
                p.user_id, p.display_name, p.avatar_path, p.webcam_path,
                u.role, r.owner_id
           FROM voice_sessions v
           JOIN participants p ON p.id = v.participant_id
           JOIN users u ON u.id = p.user_id
           JOIN room_sessions rs ON rs.id = v.session_id
           JOIN rooms r ON r.id = rs.room_id
          WHERE v.session_id = ?
          ORDER BY v.joined_at ASC'
    );
    $stmt->execute([$sessionId]);
    $voice = array_map(fn($r) => [
        'id' => (int)$r['participant_id'],
        'user_id' => (int)$r['user_id'],
        'display_name' => $r['display_name'],
        'role' => $r['role'] ?: 'user',
        'is_owner' => (int)$r['user_id'] === (int)$r['owner_id'],
        'avatar_path' => $r['avatar_path'],
        'avatar_url' => $r['webcam_path'] ?: resolve_avatar($r['avatar_path']),
        'webcam_path' => $r['webcam_path'],
        'muted' => (bool)$r['muted'],
        'deafened' => (bool)$r['deafened'],
        'speaking' => (bool)$r['speaking'],
    ], $stmt->fetchAll());

    $stmt = $pdo->prepare('SELECT id, from_participant_id, type, data FROM voice_signals WHERE session_id = ? AND (to_participant_id = ? OR to_participant_id = 0) AND id > ? ORDER BY id ASC LIMIT 80');
    $stmt->execute([$sessionId, $participantId, $after]);
    $signals = array_map(fn($s) => [
        'id' => (int)$s['id'],
        'from_participant_id' => (int)$s['from_participant_id'],
        'type' => $s['type'],
        'data' => json_decode($s['data'], true),
    ], $stmt->fetchAll());
    json_out(['signals' => $signals, 'voice_participants' => $voice]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = input_json();
    $action = $body['action'] ?? '';
    if ($action === 'join' || $action === 'leave') {
        $sessionId = resolve_session_id($pdo, $body['session_id'] ?? '');
        $participantId = (int)($body['participant_id'] ?? 0);
        voice_auth($pdo, $sessionId, $participantId, $body['join_token'] ?? '');
        if ($action === 'join') {
            $pdo->prepare(db_uses_mysql_syntax($pdo)
                ? 'INSERT INTO voice_sessions (participant_id, session_id, muted, deafened, speaking, joined_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE session_id = VALUES(session_id), muted = VALUES(muted), deafened = VALUES(deafened), speaking = VALUES(speaking), joined_at = CURRENT_TIMESTAMP'
                : 'INSERT OR REPLACE INTO voice_sessions (participant_id, session_id, muted, deafened, speaking, joined_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)'
            )->execute([$participantId, $sessionId, 0, 0, 0]);
        } else {
            $pdo->prepare('DELETE FROM voice_sessions WHERE participant_id = ?')->execute([$participantId]);
        }
        $pdo->prepare('INSERT INTO voice_signals (session_id, from_participant_id, to_participant_id, type, data) VALUES (?,?,?,?,?)')
            ->execute([$sessionId, $participantId, 0, $action, json_encode(['participant_id' => $participantId])]);
        json_out(['ok' => true]);
    }
    if ($action === 'status') {
        $sessionId = resolve_session_id($pdo, $body['session_id'] ?? '');
        $participantId = (int)($body['participant_id'] ?? 0);
        voice_auth($pdo, $sessionId, $participantId, $body['join_token'] ?? '');
        $pdo->prepare('UPDATE voice_sessions SET muted = ?, deafened = ?, speaking = ? WHERE participant_id = ? AND session_id = ?')
            ->execute([
                !empty($body['muted']) ? 1 : 0,
                !empty($body['deafened']) ? 1 : 0,
                !empty($body['speaking']) ? 1 : 0,
                $participantId,
                $sessionId,
            ]);
        json_out(['ok' => true]);
    }
    if ($action === 'signal') {
        $sessionId = resolve_session_id($pdo, $body['session_id'] ?? '');
        $from = (int)($body['from_id'] ?? 0);
        $to = (int)($body['to_id'] ?? 0);
        $type = (string)($body['type'] ?? '');
        voice_auth($pdo, $sessionId, $from, $body['join_token'] ?? '');
        if ($to <= 0 || $type === '') json_out(['error' => 'Missing signal fields'], 400);
        $pdo->prepare('INSERT INTO voice_signals (session_id, from_participant_id, to_participant_id, type, data) VALUES (?,?,?,?,?)')
            ->execute([$sessionId, $from, $to, $type, json_encode($body['data'] ?? null)]);
        json_out(['ok' => true]);
    }
}

json_out(['error' => 'Bad request'], 400);
