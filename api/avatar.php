<?php
require_once __DIR__ . '/../includes/base.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'POST required'], 405);
$pdo = db();
$sessionId = resolve_session_id($pdo, $_POST['session_id'] ?? '');
$p = auth_participant($pdo, $sessionId, $_POST['join_token'] ?? '');

if (empty($_FILES['avatar']['tmp_name']) || !is_uploaded_file($_FILES['avatar']['tmp_name'])) {
    json_out(['error' => 'Avatar image required'], 400);
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($_FILES['avatar']['tmp_name']) ?: '';
$allowed = ['image/gif' => 'gif', 'image/webp' => 'webp'];
$maxBytes = app_setting_bytes($pdo, 'avatar_max_size_mb', 5);
$dims = @getimagesize($_FILES['avatar']['tmp_name']);
if (!isset($allowed[$mime]) || (int)$_FILES['avatar']['size'] > $maxBytes || !$dims || $dims[0] < 42 || $dims[1] < 42 || $dims[0] > 250 || $dims[1] > 250) {
    json_out(['error' => 'Use an optimized GIF or WebP under ' . app_setting($pdo, 'avatar_max_size_mb', '5') . ' MB and between 42x42 and 250x250.'], 400);
}

$file = bin2hex(random_bytes(12)) . '.' . $allowed[$mime];
$dest = __DIR__ . '/../assets/uploads/avatars/' . $file;
move_uploaded_file($_FILES['avatar']['tmp_name'], $dest);
$public = '/assets/uploads/avatars/' . $file;

$pdo->prepare('UPDATE users SET avatar_path = ? WHERE id = ?')->execute([$public, (int)$p['user_id']]);
$pdo->prepare('UPDATE participants SET avatar_path = ?, webcam_path = NULL WHERE user_id = ?')->execute([$public, (int)$p['user_id']]);

emit_event($pdo, $sessionId, 'avatar', [
    'participant_id' => (int)$p['id'],
    'avatar_path' => $public,
    'avatar_url' => $public,
    'webcam_path' => null,
]);

json_out(['ok' => true, 'avatar_path' => $public, 'avatar_url' => $public]);
