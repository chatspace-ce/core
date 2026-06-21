<?php
require_once __DIR__ . '/../includes/room_importer.php';

$user = require_user();
$pdo = db();
$communityEjection = active_community_ejection($pdo, (int)$user['id']);
if ($communityEjection) {
    json_out(['error' => 'community_ejected', 'redirect_url' => app_url('/community_ejected.php')], 403);
}

function import_lobby_room_payload(array $room, array $user): array {
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
        'online_count' => (int)($room['online_count'] ?? 0),
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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(['error' => 'POST required'], 405);
}

$body = input_json();
$action = (string)($body['action'] ?? '');
$url = trim((string)($body['url'] ?? ''));

try {
    if ($action === 'preview') {
        $preview = room_import_preview_from_url($url);
        json_out(['ok' => true, 'preview' => $preview]);
    }

    if ($action === 'create') {
        $preview = room_import_preview_from_url($url);
        $localized = room_import_localize($preview);
        $sourceName = trim((string)($body['name'] ?? ''));
        if ($sourceName === '') $sourceName = trim((string)($preview['title'] ?? ''));
        if ($sourceName === '') {
            $host = parse_url((string)$preview['source_url'], PHP_URL_HOST);
            $sourceName = $host ? preg_replace('/^www\./', '', $host) : 'Imported Room';
        }
        if (function_exists('mb_substr')) $sourceName = mb_substr($sourceName, 0, 90, 'UTF-8');
        else $sourceName = substr($sourceName, 0, 90);

        $publicId = uuid_v4();
        $backgroundPath = $localized['background_path'] ?: null;
        $backgroundMime = null;
        if ($backgroundPath) {
            $full = __DIR__ . '/..' . $backgroundPath;
            if (is_file($full)) {
                $finfo = new finfo(FILEINFO_MIME_TYPE);
                $backgroundMime = $finfo->file($full) ?: null;
            }
        }
        $stmt = $pdo->prepare(
            'INSERT INTO rooms (public_id, owner_id, name, background_path, background_mime, background_thumb_path, import_url, import_layout_json, music_playlist_json)
             VALUES (?,?,?,?,?,?,?,?,?)'
        );
        $stmt->execute([
            $publicId,
            (int)$user['id'],
            $sourceName,
            $backgroundPath,
            $backgroundMime,
            null,
            $preview['source_url'] ?? $url,
            json_encode($localized['layout'], JSON_UNESCAPED_SLASHES),
            json_encode($localized['music'], JSON_UNESCAPED_SLASHES),
        ]);
        $roomId = (int)$pdo->lastInsertId();
        active_session_for_room($pdo, $roomId);
        $roomStmt = $pdo->prepare('SELECT r.*, u.display_name AS owner_name, 0 AS online_count FROM rooms r JOIN users u ON u.id = r.owner_id WHERE r.id = ? LIMIT 1');
        $roomStmt->execute([$roomId]);
        json_out(['ok' => true, 'room' => import_lobby_room_payload($roomStmt->fetch(), $user)]);
    }
} catch (RuntimeException $e) {
    json_out(['error' => $e->getMessage()], 400);
}

json_out(['error' => 'Unknown action'], 400);
