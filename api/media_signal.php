<?php
require_once __DIR__ . '/../includes/base.php';

$pdo = db();

function media_auth(PDO $pdo, int $sessionId, int $participantId, ?string $token): array {
    $participant = auth_participant($pdo, $sessionId, $token ?: '');
    if ($participantId > 0 && (int)$participant['id'] !== $participantId) json_out(['error' => 'Unauthorized'], 403);
    return $participant;
}

function media_voice_participants(PDO $pdo, int $sessionId): array {
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
    return array_map(fn(array $row): array => [
        'id' => (int)$row['participant_id'],
        'user_id' => (int)$row['user_id'],
        'display_name' => $row['display_name'],
        'role' => $row['role'] ?: 'user',
        'is_owner' => (int)$row['user_id'] === (int)$row['owner_id'],
        'avatar_path' => $row['avatar_path'],
        'avatar_url' => resolve_avatar($row['avatar_path']),
        'webcam_path' => $row['webcam_path'],
        'muted' => (bool)$row['muted'],
        'deafened' => (bool)$row['deafened'],
        'speaking' => (bool)$row['speaking'],
    ], $stmt->fetchAll());
}

function media_signal_insert(PDO $pdo, int $sessionId, string $media, int $from, int $to, string $type, mixed $data): void {
    $pdo->prepare('INSERT INTO media_signals (session_id, media, from_participant_id, to_participant_id, type, data) VALUES (?,?,?,?,?,?)')
        ->execute([$sessionId, $media, $from, $to, $type, json_encode($data, JSON_UNESCAPED_SLASHES)]);
}

function media_from_signal_data(array $body): string {
    $media = (string)($body['media'] ?? '');
    if (in_array($media, ['voice', 'webcam'], true)) return $media;
    $data = $body['data'] ?? null;
    if (is_array($data) && ($data['chatspace_media'] ?? '') === 'video') return 'webcam';
    return 'voice';
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $sessionId = resolve_session_id($pdo, $_GET['session_id'] ?? '');
    $participantId = (int)($_GET['participant_id'] ?? 0);
    $after = (int)($_GET['after'] ?? 0);
    media_auth($pdo, $sessionId, $participantId, $_GET['join_token'] ?? '');
    $media = (string)($_GET['media'] ?? 'all');

    if (in_array($media, ['voice', 'webcam'], true)) {
        $stmt = $pdo->prepare('SELECT id, media, from_participant_id, type, data FROM media_signals WHERE session_id = ? AND media = ? AND (to_participant_id = ? OR to_participant_id = 0) AND id > ? ORDER BY id ASC LIMIT 80');
        $stmt->execute([$sessionId, $media, $participantId, $after]);
    } else {
        $stmt = $pdo->prepare('SELECT id, media, from_participant_id, type, data FROM media_signals WHERE session_id = ? AND (to_participant_id = ? OR to_participant_id = 0) AND id > ? ORDER BY id ASC LIMIT 80');
        $stmt->execute([$sessionId, $participantId, $after]);
    }
    $signals = array_map(fn(array $row): array => [
        'id' => (int)$row['id'],
        'media' => $row['media'],
        'from_participant_id' => (int)$row['from_participant_id'],
        'type' => $row['type'],
        'data' => json_decode($row['data'], true),
    ], $stmt->fetchAll());
    json_out(['signals' => $signals, 'voice_participants' => media_voice_participants($pdo, $sessionId)]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'POST required'], 405);

$body = input_json();
$action = (string)($body['action'] ?? '');
$sessionId = resolve_session_id($pdo, $body['session_id'] ?? '');
$participantId = (int)($body['participant_id'] ?? 0);
$participant = media_auth($pdo, $sessionId, $participantId, $body['join_token'] ?? '');

if ($action === 'webcam_on' || $action === 'webcam_off') {
    $enabled = $action === 'webcam_on';
    $pdo->prepare('UPDATE participants SET webcam_path = NULL, webcam_enabled = ? WHERE id = ?')
        ->execute([$enabled ? 1 : 0, (int)$participant['id']]);
    $payload = [
        'participant_id' => (int)$participant['id'],
        'webcam_path' => null,
        'webcam_enabled' => $enabled,
        'avatar_path' => $participant['avatar_path'],
        'avatar_url' => resolve_avatar($participant['avatar_path']),
    ];
    emit_event($pdo, $sessionId, 'webcam', $payload);
    json_out(['ok' => true] + $payload);
}

if ($action === 'join' || $action === 'leave') {
    if ($action === 'join') {
        $pdo->prepare(db_uses_mysql_syntax($pdo)
            ? 'INSERT INTO voice_sessions (participant_id, session_id, muted, deafened, speaking, joined_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE session_id = VALUES(session_id), muted = VALUES(muted), deafened = VALUES(deafened), speaking = VALUES(speaking), joined_at = CURRENT_TIMESTAMP'
            : 'INSERT OR REPLACE INTO voice_sessions (participant_id, session_id, muted, deafened, speaking, joined_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)'
        )->execute([(int)$participant['id'], $sessionId, 0, 0, 0]);
    } else {
        $pdo->prepare('DELETE FROM voice_sessions WHERE participant_id = ?')->execute([(int)$participant['id']]);
    }
    media_signal_insert($pdo, $sessionId, 'voice', (int)$participant['id'], 0, $action, ['participant_id' => (int)$participant['id']]);
    json_out(['ok' => true]);
}

if ($action === 'status') {
    $pdo->prepare('UPDATE voice_sessions SET muted = ?, deafened = ?, speaking = ? WHERE participant_id = ? AND session_id = ?')
        ->execute([
            !empty($body['muted']) ? 1 : 0,
            !empty($body['deafened']) ? 1 : 0,
            !empty($body['speaking']) ? 1 : 0,
            (int)$participant['id'],
            $sessionId,
        ]);
    json_out(['ok' => true]);
}

if ($action === 'signal') {
    $to = (int)($body['to_id'] ?? 0);
    $type = (string)($body['type'] ?? '');
    if ($to <= 0 || $type === '') json_out(['error' => 'Missing signal fields'], 400);
    media_signal_insert($pdo, $sessionId, media_from_signal_data($body), (int)$participant['id'], $to, $type, $body['data'] ?? null);
    json_out(['ok' => true]);
}

json_out(['error' => 'Bad request'], 400);
