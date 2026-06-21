<?php
require_once __DIR__ . '/../includes/room_importer.php';

$user = current_user();
if (!$user) {
    json_out(['error' => 'login_required', 'login_url' => app_url('/login.php')], 401);
}

$pdo = db();
$communityEjection = active_community_ejection($pdo, (int)$user['id']);
if ($communityEjection) {
    json_out(['error' => 'community_ejected', 'redirect_url' => app_url('/community_ejected.php')], 403);
}

function lobby_room_rows(PDO $pdo, array $user): array {
    cleanup_stale_participants($pdo);
    $onlineCutoff = stale_cutoff($pdo);
    $stmt = $pdo->prepare(
        'SELECT r.*, u.display_name AS owner_name,
            (
              SELECT COUNT(DISTINCT p.user_id)
                FROM participants p
                JOIN room_sessions rs ON rs.id = p.session_id
               WHERE rs.room_id = r.id
                 AND p.last_seen_at >= ?
            ) AS online_count
         FROM rooms r JOIN users u ON u.id = r.owner_id
         WHERE NOT EXISTS (
            SELECT 1 FROM room_ejections re
             WHERE re.room_id = r.id
               AND re.user_id = ' . (int)$user['id'] . '
               AND ' . active_ejection_sql('re') . '
         )
         ORDER BY r.created_at DESC'
    );
    $stmt->execute([$onlineCutoff]);
    return array_map(fn(array $room): array => lobby_room_payload($room, $user), $stmt->fetchAll());
}

function lobby_room_payload(array $room, array $user): array {
    $backgroundPath = (string)($room['background_path'] ?? '');
    $backgroundMime = (string)($room['background_mime'] ?? '');
    $thumbPath = (string)($room['background_thumb_path'] ?? '');
    $tileBg = $backgroundPath;
    if ($backgroundPath !== '' && str_starts_with($backgroundMime, 'video/')) {
        $tileBg = $thumbPath;
    }
    if ($tileBg === '') {
        $tileBg = room_import_tile_image_from_layout($room['import_layout_json'] ?? null);
    }
    return [
        'id' => (int)$room['id'],
        'public_id' => (string)$room['public_id'],
        'name' => (string)$room['name'],
        'owner_id' => (int)$room['owner_id'],
        'owner_name' => (string)$room['owner_name'],
        'online_count' => (int)$room['online_count'],
        'background_path' => $backgroundPath,
        'background_mime' => $backgroundMime,
        'background_thumb_path' => $thumbPath,
        'tile_background' => $tileBg,
        'tile_background_url' => $tileBg !== '' ? media_url($tileBg) : '',
        'background_url' => $backgroundPath !== '' ? media_url($backgroundPath) : '',
        'thumb_url' => $thumbPath !== '' ? media_url($thumbPath) : '',
        'video_without_thumb' => $backgroundPath !== '' && str_starts_with($backgroundMime, 'video/') && $thumbPath === '',
        'can_edit' => (int)$room['owner_id'] === (int)$user['id'] || in_array($user['role'] ?? 'user', ['admin', 'developer'], true),
        'enter_url' => app_url('/chatroom.php?id=' . rawurlencode((string)$room['public_id'])),
    ];
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    json_out(['rooms' => lobby_room_rows($pdo, $user)]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $name = trim((string)($_POST['name'] ?? ''));
    if ($name === '') json_out(['error' => 'Room name required'], 400);

    try {
        $bgPath = null;
        $bgMime = null;
        $bgThumbPath = null;
        if (!empty($_FILES['background']['tmp_name']) && is_uploaded_file($_FILES['background']['tmp_name'])) {
            $saved = save_room_background_upload($_FILES['background'], $_FILES['background_thumb'] ?? null);
            $bgPath = $saved['path'];
            $bgMime = $saved['mime'];
            $bgThumbPath = $saved['thumb_path'];
        }
        $publicId = uuid_v4();
        $stmt = $pdo->prepare('INSERT INTO rooms (public_id, owner_id, name, background_path, background_mime, background_thumb_path) VALUES (?,?,?,?,?,?)');
        $stmt->execute([$publicId, (int)$user['id'], $name, $bgPath, $bgMime, $bgThumbPath]);
        $roomId = (int)$pdo->lastInsertId();
        active_session_for_room($pdo, $roomId);
        $roomStmt = $pdo->prepare('SELECT r.*, u.display_name AS owner_name, 0 AS online_count FROM rooms r JOIN users u ON u.id = r.owner_id WHERE r.id = ? LIMIT 1');
        $roomStmt->execute([$roomId]);
        json_out(['ok' => true, 'room' => lobby_room_payload($roomStmt->fetch(), $user), 'rooms' => lobby_room_rows($pdo, $user)]);
    } catch (RuntimeException $e) {
        json_out(['error' => $e->getMessage()], 400);
    }
}

json_out(['error' => 'Unsupported method'], 405);
