<?php
require_once __DIR__ . '/../includes/base.php';
require_once __DIR__ . '/../includes/message_centre.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'POST required'], 405);

$pdo = db();
$sessionId = resolve_session_id($pdo, $_POST['session_id'] ?? '');
$participant = auth_participant($pdo, $sessionId, $_POST['join_token'] ?? '');
$authorContext = author_context_for_participant($pdo, $sessionId, $participant);

if (!empty($_FILES['file']) && is_array($_FILES['file'])) {
    $file = $_FILES['file'];
    $isVoiceNote = false;
} elseif (!empty($_FILES['audio']) && is_array($_FILES['audio'])) {
    $file = $_FILES['audio'];
    $isVoiceNote = true;
} else {
    json_out(['error' => 'File required'], 400);
}
if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    json_out(['error' => 'Upload failed'], 400);
}
$maxSize = $isVoiceNote ? 20 * 1024 * 1024 : 50 * 1024 * 1024;
if ((int)$file['size'] > $maxSize) {
    json_out(['error' => $isVoiceNote ? 'Voice note is too large' : 'File is too large'], 400);
}

$tmpName = (string)$file['tmp_name'];
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mimeType = $finfo->file($tmpName) ?: 'application/octet-stream';
if ($isVoiceNote && $mimeType === 'application/octet-stream' && !empty($file['type'])) {
    $mimeType = (string)$file['type'];
}
$originalName = trim((string)($file['name'] ?? 'attachment'));
if ($originalName === '') $originalName = 'attachment';
$originalExt = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
$allowedFiles = [
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
$allowedVoice = [
    'audio/webm' => 'webm',
    'video/webm' => 'webm',
    'audio/ogg' => 'ogg',
    'application/ogg' => 'ogg',
    'audio/mpeg' => 'mp3',
    'audio/mp4' => 'm4a',
    'audio/wav' => 'wav',
    'audio/x-wav' => 'wav',
];
$extMime = [
    'pdf' => 'application/pdf',
    'doc' => 'application/msword',
    'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'rtf' => 'application/rtf',
    'txt' => 'text/plain',
];

if (!$isVoiceNote && !isset($allowedFiles[$mimeType]) && isset($extMime[$originalExt]) && in_array($mimeType, ['application/zip', 'application/octet-stream', 'text/plain'], true)) {
    $mimeType = $extMime[$originalExt];
}

if ($isVoiceNote) {
    if (!isset($allowedVoice[$mimeType]) && !str_starts_with($mimeType, 'audio/')) {
        json_out(['error' => 'Unsupported voice note format'], 400);
    }
} elseif (!isset($allowedFiles[$mimeType])) {
    json_out(['error' => 'Only images, PDFs, and documents are supported'], 400);
}

$uploadDir = __DIR__ . '/../assets/uploads/' . ($isVoiceNote ? 'voice' : 'files');
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0775, true);
}

$extension = $isVoiceNote ? ($allowedVoice[$mimeType] ?? 'audio') : $allowedFiles[$mimeType];
$filename = ($isVoiceNote ? 'vn_' : 'f_') . bin2hex(random_bytes(16)) . '.' . $extension;
$target = $uploadDir . '/' . $filename;
if (!move_uploaded_file($tmpName, $target)) {
    json_out(['error' => 'Could not save file'], 500);
}

$publicPath = '/assets/uploads/' . ($isVoiceNote ? 'voice/' : 'files/') . $filename;
$channel = (string)($_POST['channel'] ?? 'room');
if (!in_array($channel, ['room', 'community', 'link', 'dm', 'game'], true)) $channel = 'room';

function file_reply_accessible(array $message, string $channel, int $sessionId, array $participant): bool {
    if (($message['scope'] ?? '') !== $channel) return false;
    if ($channel === 'community') return true;
    if ($channel === 'link') {
        if ((int)($message['session_id'] ?? 0) !== $sessionId) return false;
        $ids = array_map('intval', explode(':', (string)($message['link_key'] ?? '')));
        return in_array((int)$participant['id'], $ids, true);
    }
    if ($channel === 'dm') {
        $ids = explode(':', (string)($message['link_key'] ?? ''));
        $a = (int)($ids[1] ?? 0);
        $b = (int)($ids[2] ?? 0);
        return $a === (int)$participant['user_id'] || $b === (int)$participant['user_id'];
    }
    return false;
}

function file_reply_preview_text(array $message): string {
    $type = (string)($message['message_type'] ?? 'text');
    if ($type === 'gif') return 'sent a GIF';
    if ($type === 'gesture') {
        $gesture = message_gesture((string)($message['content'] ?? ''));
        return trim((string)($gesture['text'] ?? $gesture['name'] ?? $message['original_name'] ?? 'sent a gesture'));
    }
    if ($type === 'file') return trim((string)($message['original_name'] ?? 'sent a file'));
    if ($type === 'voice_note') return 'sent a voice note';
    $text = trim(preg_replace('/\s+/', ' ', (string)($message['content'] ?? '')));
    return $text === '' ? 'Message' : (function_exists('mb_substr') ? mb_substr($text, 0, 180, 'UTF-8') : substr($text, 0, 180));
}

function file_reply_snapshot(PDO $pdo, string $channel, int $sessionId, array $participant): ?array {
    $replyId = (int)($_POST['reply_to_id'] ?? 0);
    if ($replyId <= 0 || $channel === 'game') return null;
    $replyChannel = (string)($_POST['reply_to_channel'] ?? $channel);
    if (str_starts_with($replyChannel, 'link:')) $replyChannel = 'link';
    if (str_starts_with($replyChannel, 'dm:')) $replyChannel = 'dm';
    if ($replyChannel !== $channel) json_out(['error' => 'Reply target unavailable'], 400);
    if ($channel === 'room') {
        $stmt = $pdo->prepare('SELECT * FROM messages WHERE id = ? AND session_id = ? AND COALESCE(is_deleted, 0) = 0 LIMIT 1');
        $stmt->execute([$replyId, $sessionId]);
        $message = $stmt->fetch();
    } else {
        $stmt = $pdo->prepare('SELECT * FROM community_messages WHERE id = ? AND COALESCE(is_deleted, 0) = 0 LIMIT 1');
        $stmt->execute([$replyId]);
        $message = $stmt->fetch();
        if ($message && !file_reply_accessible($message, $channel, $sessionId, $participant)) $message = false;
    }
    if (!$message) json_out(['error' => 'Reply target unavailable'], 404);
    return [
        'id' => (int)$message['id'],
        'channel' => $channel,
        'participant_id' => isset($message['participant_id']) ? (int)$message['participant_id'] : null,
        'user_id' => isset($message['user_id']) ? (int)$message['user_id'] : null,
        'display_name' => $message['display_name'] ?? 'Someone',
        'message_type' => $message['message_type'] ?? 'text',
        'original_name' => $message['original_name'] ?? null,
        'preview' => file_reply_preview_text($message),
    ];
}

$replyTo = file_reply_snapshot($pdo, $channel, $sessionId, $participant);
$replyToJson = $replyTo ? json_encode($replyTo, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : null;

function uploaded_media_message(PDO $pdo, string $channel, string $messageType, array $participant, array $authorContext, string $content, array $file, string $mimeType, string $originalName, ?array $replyTo, ?string $replyToJson, array $route = []): array {
    return create_message($pdo, $channel, $messageType, [
        'session_id' => $route['session_id'] ?? null,
        'participant' => $participant,
        'author_context' => $authorContext,
        'content' => $content,
        'file_size' => (int)$file['size'],
        'mime_type' => $mimeType,
        'original_name' => $originalName,
        'reply_to' => $replyTo,
        'reply_to_json' => $replyToJson,
        'link_key' => $route['link_key'] ?? null,
        'dm_key' => $route['dm_key'] ?? null,
        'target_user_id' => $route['target_user_id'] ?? null,
        'lobby_code' => $route['lobby_code'] ?? null,
    ]);
}

if ($channel === 'community') {
    json_out(uploaded_media_message($pdo, 'community', $isVoiceNote ? 'voice_note' : 'file', $participant, $authorContext, $publicPath, $file, $mimeType, $isVoiceNote ? 'Voice Note' : $originalName, $replyTo, $replyToJson));
}

if ($channel === 'link') {
    $targetId = (int)($_POST['target_participant_id'] ?? 0);
    if (!$targetId) json_out(['error' => 'Linked participant required'], 400);
    $stmt = $pdo->prepare(
        'SELECT id FROM participants
         WHERE session_id = ? AND id = ?
           AND (linked_to_participant_id = ? OR id = (SELECT linked_to_participant_id FROM participants WHERE id = ?))
         LIMIT 1'
    );
    $stmt->execute([$sessionId, $targetId, (int)$participant['id'], (int)$participant['id']]);
    if (!$stmt->fetch()) json_out(['error' => 'You are not linked to that participant'], 403);
    $linkKey = link_key_for((int)$participant['id'], $targetId);
    json_out(uploaded_media_message($pdo, 'link', $isVoiceNote ? 'voice_note' : 'file', $participant, $authorContext, $publicPath, $file, $mimeType, $isVoiceNote ? 'Voice Note' : $originalName, $replyTo, $replyToJson, [
        'session_id' => $sessionId,
        'link_key' => $linkKey,
    ]));
}

if ($channel === 'dm') {
    $targetUserId = (int)($_POST['target_user_id'] ?? 0);
    if (!$targetUserId || $targetUserId === (int)$participant['user_id']) json_out(['error' => 'DM recipient required'], 400);
    $stmt = $pdo->prepare('SELECT id FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$targetUserId]);
    if (!$stmt->fetch()) json_out(['error' => 'DM recipient not found'], 404);
    $stmt = $pdo->prepare(
        'SELECT 1 FROM user_blocks
         WHERE (blocker_user_id = ? AND blocked_user_id = ?)
            OR (blocker_user_id = ? AND blocked_user_id = ?)
         LIMIT 1'
    );
    $stmt->execute([(int)$participant['user_id'], $targetUserId, $targetUserId, (int)$participant['user_id']]);
    if ($stmt->fetch()) json_out(['error' => 'You cannot DM this user.'], 403);
    $dmKey = dm_key_for((int)$participant['user_id'], $targetUserId);
    json_out(uploaded_media_message($pdo, 'dm', $isVoiceNote ? 'voice_note' : 'file', $participant, $authorContext, $publicPath, $file, $mimeType, $isVoiceNote ? 'Voice Note' : $originalName, $replyTo, $replyToJson, [
        'dm_key' => $dmKey,
        'target_user_id' => $targetUserId,
    ]));
}

if ($channel === 'game') {
    $lobby = (string)($_POST['lobby_code'] ?? '');
    if ($lobby === '') json_out(['error' => 'Game required'], 400);
    $stmt = $pdo->prepare(
        'SELECT gl.*
           FROM game_lobbies gl
           JOIN game_sessions gs ON gs.lobby_code = gl.lobby_code
          WHERE gs.room_session_id = ? AND gl.lobby_code = ? AND gs.ended_at IS NULL AND gl.status <> "ended"
          LIMIT 1'
    );
    $stmt->execute([$sessionId, $lobby]);
    $game = $stmt->fetch();
    if (!$game) json_out(['error' => 'Game not found'], 404);
    $playerIds = array_filter([(int)($game['user1_id'] ?? 0), (int)($game['user2_id'] ?? 0)]);
    if (!in_array((int)$participant['id'], $playerIds, true)) json_out(['error' => 'Join the game to use game chat'], 403);
    json_out(uploaded_media_message($pdo, 'game', $isVoiceNote ? 'voice_note' : 'file', $participant, $authorContext, $publicPath, $file, $mimeType, $isVoiceNote ? 'Voice Note' : $originalName, $replyTo, $replyToJson, ['lobby_code' => $lobby]));
}

json_out(uploaded_media_message($pdo, 'room', $isVoiceNote ? 'voice_note' : 'file', $participant, $authorContext, $publicPath, $file, $mimeType, $isVoiceNote ? 'Voice Note' : $originalName, $replyTo, $replyToJson, [
    'session_id' => $sessionId,
]));
