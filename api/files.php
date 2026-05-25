<?php
require_once __DIR__ . '/../includes/base.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'POST required'], 405);

$pdo = db();
$sessionId = resolve_session_id($pdo, $_POST['session_id'] ?? '');
$participant = auth_participant($pdo, $sessionId, $_POST['join_token'] ?? '');
$authorContext = author_context_for_participant($pdo, $sessionId, $participant);

if (empty($_FILES['file']) || !is_array($_FILES['file'])) {
    json_out(['error' => 'File required'], 400);
}

$file = $_FILES['file'];
if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    json_out(['error' => 'Upload failed'], 400);
}
if ((int)$file['size'] > 50 * 1024 * 1024) {
    json_out(['error' => 'File is too large'], 400);
}

$tmpName = (string)$file['tmp_name'];
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mimeType = $finfo->file($tmpName) ?: 'application/octet-stream';
$originalName = trim((string)($file['name'] ?? 'attachment'));
if ($originalName === '') $originalName = 'attachment';
$originalExt = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
$allowed = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/gif' => 'gif',
    'image/webp' => 'webp',
    'application/pdf' => 'pdf',
    'application/msword' => 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
    'application/rtf' => 'rtf',
    'text/rtf' => 'rtf',
    'text/plain' => 'txt',
];
$extMime = [
    'pdf' => 'application/pdf',
    'doc' => 'application/msword',
    'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'rtf' => 'application/rtf',
    'txt' => 'text/plain',
];

if (!isset($allowed[$mimeType]) && isset($extMime[$originalExt]) && in_array($mimeType, ['application/zip', 'application/octet-stream', 'text/plain'], true)) {
    $mimeType = $extMime[$originalExt];
}

if (!isset($allowed[$mimeType])) {
    json_out(['error' => 'Only images, PDFs, and documents are supported'], 400);
}

$uploadDir = __DIR__ . '/../assets/uploads/files';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0775, true);
}

$filename = 'f_' . bin2hex(random_bytes(16)) . '.' . $allowed[$mimeType];
$target = $uploadDir . '/' . $filename;
if (!move_uploaded_file($tmpName, $target)) {
    json_out(['error' => 'Could not save file'], 500);
}

$publicPath = '/assets/uploads/files/' . $filename;
$avatarUrl = $participant['webcam_path'] ?: resolve_avatar($participant['avatar_path']);

$stmt = $pdo->prepare(
    "INSERT INTO messages (session_id, participant_id, user_id, display_name, avatar_path, avatar_url, content, message_type, file_size, mime_type, original_name)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)"
);
$stmt->execute([$sessionId, (int)$participant['id'], (int)$participant['user_id'], $participant['display_name'], $participant['avatar_path'], $avatarUrl, $publicPath, 'file', (int)$file['size'], $mimeType, $originalName]);
$id = (int)$pdo->lastInsertId();

$msg = [
    'id' => $id,
    'participant_id' => (int)$participant['id'],
    'user_id' => (int)$participant['user_id'],
    'display_name' => $participant['display_name'],
    'avatar_path' => $participant['avatar_path'],
    'avatar_url' => $avatarUrl,
    'role' => $authorContext['role'],
    'is_owner' => $authorContext['is_owner'],
    'content' => $publicPath,
    'message_type' => 'file',
    'file_size' => (int)$file['size'],
    'mime_type' => $mimeType,
    'original_name' => $originalName,
    'sent_at' => gmdate('Y-m-d H:i:s'),
];

emit_event($pdo, $sessionId, 'message', $msg);
json_out($msg);
