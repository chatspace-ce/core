<?php
require_once __DIR__ . '/../includes/room_admin.php';
require_once __DIR__ . '/../includes/room_importer.php';

$user = require_user();
$pdo = db();
$body = $_SERVER['REQUEST_METHOD'] === 'POST' ? input_json() : [];
$source = array_merge($_GET, $_POST, is_array($body) ? $body : []);
$action = (string)($source['action'] ?? '');

function room_admin_ejections(PDO $pdo, array $room): array {
    $stmt = $pdo->prepare(
        'SELECT re.id, re.user_id, re.duration_minutes, re.permanent, re.created_at, re.expires_at,
                u.display_name, by_user.display_name AS ejected_by_name
           FROM room_ejections re
           JOIN users u ON u.id = re.user_id
           JOIN users by_user ON by_user.id = re.ejected_by_user_id
          WHERE re.room_id = ? AND ' . active_ejection_sql('re') . '
          ORDER BY re.created_at DESC'
    );
    $stmt->execute([(int)$room['id']]);
    return array_map(fn(array $row): array => [
        'id' => (int)$row['id'],
        'user_id' => (int)$row['user_id'],
        'display_name' => $row['display_name'],
        'ejected_by_name' => $row['ejected_by_name'],
        'duration_minutes' => $row['duration_minutes'] !== null ? (int)$row['duration_minutes'] : null,
        'permanent' => (bool)$row['permanent'],
        'created_at' => $row['created_at'],
        'expires_at' => $row['expires_at'],
    ], $stmt->fetchAll());
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($action === 'effects') {
        $ctx = room_admin_load_context($pdo, $user, $source, 'host_tools', true);
        cleanup_room_effects($pdo, (int)$ctx['session_id']);
        json_out([
            'effects' => array_values(room_effect_catalog()),
            'current' => active_room_effect($pdo, (int)$ctx['session_id']),
        ]);
    }
    if ($action === 'ejections') {
        $ctx = room_admin_load_context($pdo, $user, $source, 'host_tools');
        json_out(['ejections' => room_admin_ejections($pdo, $ctx['room'])]);
    }
    json_out(['error' => 'Unknown action'], 400);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'POST required'], 405);

if ($action === 'update') {
    $ctx = room_admin_load_context($pdo, $user, $source, 'manage', !empty($source['session_id']));
    $room = $ctx['room'];
    $name = trim((string)($source['name'] ?? ''));
    if ($name === '') json_out(['error' => 'Room name required'], 400);

    $bgPath = $room['background_path'];
    $bgMime = $room['background_mime'];
    $bgThumbPath = $room['background_thumb_path'] ?? null;
    if (!empty($_FILES['background']['tmp_name']) && is_uploaded_file($_FILES['background']['tmp_name'])) {
        try {
            $saved = save_room_background_upload($_FILES['background'], $_FILES['background_thumb'] ?? null);
            $bgPath = $saved['path'];
            $bgMime = $saved['mime'];
            $bgThumbPath = $saved['thumb_path'];
        } catch (RuntimeException $e) {
            json_out(['error' => $e->getMessage()], 400);
        }
    }

    $pdo->prepare('UPDATE rooms SET name = ?, background_path = ?, background_mime = ?, background_thumb_path = ? WHERE id = ?')
        ->execute([$name, $bgPath, $bgMime, $bgThumbPath, (int)$room['id']]);

    $payload = [
        'room_name' => $name,
        'background_path' => $bgPath,
        'background_mime' => $bgMime,
        'background_thumb_path' => $bgThumbPath,
    ];
    if ((int)$ctx['session_id'] > 0) emit_event($pdo, (int)$ctx['session_id'], 'room_update', $payload);
    json_out($payload);
}

if ($action === 'delete') {
    $ctx = room_admin_load_context($pdo, $user, $source, 'manage', !empty($source['session_id']));
    $room = $ctx['room'];
    $sessionId = (int)$ctx['session_id'];
    $sessionPublicId = (string)$ctx['session_public_id'];
    $payload = [
        'room_id' => (int)$room['id'],
        'room_public_id' => $room['public_id'],
        'room_name' => $room['name'],
        'deleted_by_user_id' => (int)$user['id'],
        'deleted_by_name' => $user['display_name'],
    ];
    $roomFiles = array_filter([
        $room['background_path'] ?? null,
        $room['background_thumb_path'] ?? null,
    ]);
    $roomFiles = array_merge($roomFiles, room_import_file_paths($room['import_layout_json'] ?? null, $room['music_playlist_json'] ?? null));

    $pdo->beginTransaction();
    try {
        if ($sessionId > 0 && $sessionPublicId !== '') {
            $participants = $pdo->prepare('SELECT user_id, join_token FROM participants WHERE session_id = ?');
            $participants->execute([$sessionId]);
            $notice = $pdo->prepare(
                'INSERT INTO room_deletion_notices (session_public_id, join_token, user_id, room_name, payload)
                 VALUES (?,?,?,?,?)'
            );
            foreach ($participants->fetchAll() as $p) {
                $notice->execute([
                    $sessionPublicId,
                    $p['join_token'],
                    (int)$p['user_id'],
                    $room['name'],
                    json_encode($payload, JSON_UNESCAPED_SLASHES),
                ]);
            }
            emit_event($pdo, $sessionId, 'room_deleted', $payload);
        }
        $pdo->prepare('UPDATE users SET current_room_id = NULL WHERE current_room_id = ?')->execute([(int)$room['id']]);
        $pdo->prepare('DELETE FROM rooms WHERE id = ?')->execute([(int)$room['id']]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        json_out(['error' => 'Room delete failed'], 500);
    }

    foreach ($roomFiles as $path) {
        $relative = ltrim((string)$path, '/');
        if (!str_starts_with($relative, 'assets/uploads/backgrounds/') && !str_starts_with($relative, 'assets/uploads/imported-rooms/')) continue;
        $full = dirname(__DIR__) . '/' . $relative;
        if (is_file($full)) @unlink($full);
    }

    json_out(['ok' => true, 'room_deleted' => $payload]);
}

if ($action === 'effect_start' || $action === 'effect_stop') {
    $ctx = room_admin_load_context($pdo, $user, $source, 'host_tools', true);
    $sessionId = (int)$ctx['session_id'];
    $participant = $ctx['participant'];
    cleanup_room_effects($pdo, $sessionId);
    $catalog = room_effect_catalog();

    if ($action === 'effect_stop') {
        $stmt = $pdo->prepare('SELECT * FROM room_effects WHERE session_id = ? LIMIT 1');
        $stmt->execute([$sessionId]);
        $currentRow = $stmt->fetch();
        $current = $currentRow ? room_effect_payload($currentRow) : null;
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

    $effectKey = (string)($source['effect_key'] ?? '');
    if (!isset($catalog[$effectKey])) json_out(['error' => 'Unknown room effect'], 400);
    $durationRaw = trim((string)($source['duration_minutes'] ?? ''));
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

    $payload = active_room_effect($pdo, $sessionId) ?: [
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
}

if ($action === 'ejection_delete') {
    $ctx = room_admin_load_context($pdo, $user, $source, 'host_tools');
    $room = $ctx['room'];
    $id = (int)($source['id'] ?? 0);
    if (!$id) json_out(['error' => 'Ejection required'], 400);
    $stmt = $pdo->prepare('SELECT user_id FROM room_ejections WHERE id = ? AND room_id = ? LIMIT 1');
    $stmt->execute([$id, (int)$room['id']]);
    $targetUserId = (int)($stmt->fetchColumn() ?: 0);
    $pdo->prepare('DELETE FROM room_ejections WHERE id = ? AND room_id = ?')->execute([$id, (int)$room['id']]);
    log_tool($pdo, (int)$user['id'], 'undo_room_kick', $targetUserId ?: null, (int)$room['id'], 'Deleted room ejection');
    json_out(['ok' => true]);
}

json_out(['error' => 'Unknown action'], 400);
