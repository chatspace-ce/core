<?php
require_once __DIR__ . '/../includes/base.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'POST required'], 405);
$body = input_json();
$pdo = db();
$sessionId = resolve_session_id($pdo, $body['session_id'] ?? '');
$participant = auth_participant($pdo, $sessionId, $body['join_token'] ?? '');
$authorContext = author_context_for_participant($pdo, $sessionId, $participant);
$action = (string)($body['action'] ?? 'send');
$channel = (string)($body['channel'] ?? 'room');
if (str_starts_with($channel, 'link:')) $channel = 'link';
if (str_starts_with($channel, 'dm:')) $channel = 'dm';

function dm_target_from_key(string $key, int $currentUserId): int {
    $ids = explode(':', $key);
    $a = (int)($ids[1] ?? 0);
    $b = (int)($ids[2] ?? 0);
    return $a === $currentUserId ? $b : $a;
}

function community_message_accessible(array $message, string $channel, int $sessionId, array $participant): bool {
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

if ($action === 'edit') {
    $messageId = (int)($body['message_id'] ?? 0);
    $content = trim((string)($body['content'] ?? ''));
    if (!$messageId || $content === '') json_out(['error' => 'Message and content required'], 400);
    $contentLength = function_exists('mb_strlen') ? mb_strlen($content, 'UTF-8') : strlen($content);
    if ($contentLength > 1000) json_out(['error' => 'Message too long'], 400);

    if ($channel !== 'room') {
        if (!in_array($channel, ['community', 'link', 'dm'], true)) json_out(['error' => 'Unsupported channel'], 400);
        $stmt = $pdo->prepare('SELECT * FROM community_messages WHERE id = ? LIMIT 1');
        $stmt->execute([$messageId]);
        $message = $stmt->fetch();
        if (!$message || !community_message_accessible($message, $channel, $sessionId, $participant)) json_out(['error' => 'Message not found'], 404);
        if ((int)$message['participant_id'] !== (int)$participant['id'] || !empty($message['is_deleted'])) json_out(['error' => 'Cannot edit this message'], 403);
        if (($message['message_type'] ?? 'text') !== 'text') json_out(['error' => 'Cannot edit this message'], 403);

        $editedAt = gmdate('Y-m-d H:i:s');
        $original = $message['original_content'] ?? null;
        if ($original === null || $original === '') $original = (string)$message['content'];
        $pdo->prepare('UPDATE community_messages SET content = ?, original_content = ?, edited_at = ? WHERE id = ?')
            ->execute([$content, $original, $editedAt, $messageId]);
        $msg = [
            'id' => $messageId,
            'message_id' => $messageId,
            'channel' => $channel,
            'participant_id' => (int)$participant['id'],
            'user_id' => (int)$participant['user_id'],
            'content' => $content,
            'message_type' => 'text',
            'edited_at' => $editedAt,
        ];
        if ($channel === 'link') $msg['link_key'] = $message['link_key'];
        if ($channel === 'dm') {
            $msg['dm_key'] = $message['link_key'];
            $msg['target_user_id'] = dm_target_from_key((string)$message['link_key'], (int)$participant['user_id']);
            $msg['partner_user_id'] = $msg['target_user_id'];
        }
        emit_community_event(
            $pdo,
            $channel,
            $channel === 'link' ? $sessionId : null,
            $channel === 'community' ? null : (string)$message['link_key'],
            $channel . '_message_edit',
            $msg
        );
        json_out(['ok' => true] + $msg);
    }

    $stmt = $pdo->prepare('SELECT * FROM messages WHERE id = ? AND session_id = ? LIMIT 1');
    $stmt->execute([$messageId, $sessionId]);
    $message = $stmt->fetch();
    if (!$message || (int)$message['participant_id'] !== (int)$participant['id']) json_out(['error' => 'Cannot edit this message'], 403);
    if (($message['message_type'] ?? 'text') !== 'text' || !empty($message['is_deleted'])) json_out(['error' => 'Cannot edit this message'], 403);

    $editedAt = gmdate('Y-m-d H:i:s');
    $original = $message['original_content'] ?? null;
    if ($original === null || $original === '') $original = (string)$message['content'];
    $pdo->prepare('UPDATE messages SET content = ?, original_content = ?, edited_at = ? WHERE id = ?')
        ->execute([$content, $original, $editedAt, $messageId]);
    $msg = [
        'id' => $messageId,
        'message_id' => $messageId,
        'participant_id' => (int)$participant['id'],
        'user_id' => (int)$participant['user_id'],
        'content' => $content,
        'message_type' => 'text',
        'edited_at' => $editedAt,
    ];
    emit_event($pdo, $sessionId, 'message_edit', $msg);
    json_out(['ok' => true] + $msg);
}

if ($action === 'delete') {
    $messageId = (int)($body['message_id'] ?? 0);
    if (!$messageId) json_out(['error' => 'Message required'], 400);
    if ($channel !== 'room') {
        if (!in_array($channel, ['community', 'link', 'dm'], true)) json_out(['error' => 'Unsupported channel'], 400);
        $stmt = $pdo->prepare('SELECT * FROM community_messages WHERE id = ? LIMIT 1');
        $stmt->execute([$messageId]);
        $message = $stmt->fetch();
        if (!$message || !community_message_accessible($message, $channel, $sessionId, $participant)) json_out(['error' => 'Message not found'], 404);
        if ((int)$message['participant_id'] !== (int)$participant['id']) json_out(['error' => 'Cannot delete this message'], 403);
        if (!empty($message['is_deleted'])) json_out(['ok' => true]);

        $deletedAt = gmdate('Y-m-d H:i:s');
        $pdo->prepare('UPDATE community_messages SET is_deleted = 1, deleted_at = ?, deleted_by_user_id = ? WHERE id = ?')
            ->execute([$deletedAt, (int)$participant['user_id'], $messageId]);
        $msg = [
            'message_id' => $messageId,
            'channel' => $channel,
            'participant_id' => (int)$participant['id'],
            'user_id' => (int)$participant['user_id'],
            'deleted_at' => $deletedAt,
        ];
        if ($channel === 'link') $msg['link_key'] = $message['link_key'];
        if ($channel === 'dm') {
            $msg['dm_key'] = $message['link_key'];
            $msg['target_user_id'] = dm_target_from_key((string)$message['link_key'], (int)$participant['user_id']);
            $msg['partner_user_id'] = $msg['target_user_id'];
        }
        emit_community_event(
            $pdo,
            $channel,
            $channel === 'link' ? $sessionId : null,
            $channel === 'community' ? null : (string)$message['link_key'],
            $channel . '_message_delete',
            $msg
        );
        json_out(['ok' => true] + $msg);
    }

    $stmt = $pdo->prepare('SELECT * FROM messages WHERE id = ? AND session_id = ? LIMIT 1');
    $stmt->execute([$messageId, $sessionId]);
    $message = $stmt->fetch();
    if (!$message || (int)$message['participant_id'] !== (int)$participant['id']) json_out(['error' => 'Cannot delete this message'], 403);
    if (!empty($message['is_deleted'])) json_out(['ok' => true]);

    $deletedAt = gmdate('Y-m-d H:i:s');
    $pdo->prepare('UPDATE messages SET is_deleted = 1, deleted_at = ?, deleted_by_user_id = ? WHERE id = ?')
        ->execute([$deletedAt, (int)$participant['user_id'], $messageId]);
    emit_event($pdo, $sessionId, 'message_delete', [
        'message_id' => $messageId,
        'participant_id' => (int)$participant['id'],
        'user_id' => (int)$participant['user_id'],
        'deleted_at' => $deletedAt,
    ]);
    json_out(['ok' => true, 'message_id' => $messageId, 'deleted_at' => $deletedAt]);
}

$messageType = $action === 'gif' ? 'gif' : ($action === 'gesture' ? 'gesture' : 'text');
$mimeType = $messageType === 'gif' ? 'image/gif' : ($messageType === 'gesture' ? 'application/x-chatspace-gesture' : null);
$originalName = null;
$snapshot = null;
if ($messageType === 'gif') {
    $content = trim((string)($body['gif_url'] ?? ''));
    $originalName = trim((string)($body['title'] ?? 'GIF'));
    if ($originalName === '') $originalName = 'GIF';
    $parts = parse_url($content);
    if (($parts['scheme'] ?? '') !== 'https' || empty($parts['host'])) json_out(['error' => 'GIF URL required'], 400);
    $host = strtolower((string)$parts['host']);
    if (!str_contains($host, 'giphy.com') && !str_contains($host, 'tenor.com') && !str_contains($host, 'tenor.googleapis.com')) {
        json_out(['error' => 'Unsupported GIF provider'], 400);
    }
} elseif ($messageType === 'gesture') {
    $gestureId = (int)($body['gesture_id'] ?? 0);
    if (!$gestureId) json_out(['error' => 'Gesture required'], 400);
    $stmt = $pdo->prepare('SELECT * FROM gestures WHERE id = ? AND deleted_at IS NULL AND (owner_user_id = ? OR is_public = 1) LIMIT 1');
    $stmt->execute([$gestureId, (int)$participant['user_id']]);
    $gesture = $stmt->fetch();
    if (!$gesture) json_out(['error' => 'Gesture unavailable'], 404);
    $snapshot = gesture_snapshot($gesture);
    $content = json_encode($snapshot, JSON_UNESCAPED_SLASHES);
    $originalName = $snapshot['text'] ?: $snapshot['name'];
} else {
    $content = trim((string)($body['content'] ?? ''));
}
if ($content === '') json_out(['error' => 'Message required'], 400);
$contentLength = function_exists('mb_strlen') ? mb_strlen($content, 'UTF-8') : strlen($content);
if ($messageType === 'text' && $contentLength > 1000) json_out(['error' => 'Message too long'], 400);
$maxPerSecond = app_setting_float($pdo, 'chat_posts_per_second', 3);
$rateCutoff = gmdate('Y-m-d H:i:s', time() - 1);
$roomRecent = $pdo->prepare("SELECT COUNT(*) FROM messages WHERE participant_id = ? AND sent_at >= ?");
$roomRecent->execute([(int)$participant['id'], $rateCutoff]);
$communityRecent = $pdo->prepare("SELECT COUNT(*) FROM community_messages WHERE participant_id = ? AND sent_at >= ?");
$communityRecent->execute([(int)$participant['id'], $rateCutoff]);
if (((int)$roomRecent->fetchColumn() + (int)$communityRecent->fetchColumn()) >= $maxPerSecond) {
    json_out(['error' => 'You are sending messages too quickly.'], 429);
}

if ($channel === 'community') {
    $avatarUrl = $participant['webcam_path'] ?: resolve_avatar($participant['avatar_path']);
    $stmt = $pdo->prepare(
        "INSERT INTO community_messages (scope, participant_id, user_id, display_name, avatar_path, avatar_url, content, message_type, mime_type, original_name)
         VALUES ('community',?,?,?,?,?,?,?,?,?)"
    );
    $stmt->execute([(int)$participant['id'], (int)$participant['user_id'], $participant['display_name'], $participant['avatar_path'], $avatarUrl, $content, $messageType, $mimeType, $originalName]);
    $id = (int)$pdo->lastInsertId();
    $msg = [
        'id' => $id,
        'channel' => 'community',
        'participant_id' => (int)$participant['id'],
        'user_id' => (int)$participant['user_id'],
        'display_name' => $participant['display_name'],
        'avatar_url' => $avatarUrl,
        'role' => $authorContext['role'],
        'is_owner' => $authorContext['is_owner'],
        'content' => $content,
        'gesture' => $messageType === 'gesture' ? $snapshot : null,
        'message_type' => $messageType,
        'mime_type' => $mimeType,
        'original_name' => $originalName,
        'sent_at' => gmdate('Y-m-d H:i:s'),
    ];
    emit_community_event($pdo, 'community', null, null, 'community_message', $msg);
    json_out($msg);
}

if ($channel === 'link') {
    $targetId = (int)($body['target_participant_id'] ?? 0);
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
    $avatarUrl = $participant['webcam_path'] ?: resolve_avatar($participant['avatar_path']);
    $stmt = $pdo->prepare(
        "INSERT INTO community_messages (scope, session_id, link_key, participant_id, user_id, display_name, avatar_path, avatar_url, content, message_type, mime_type, original_name)
         VALUES ('link',?,?,?,?,?,?,?,?,?,?,?)"
    );
    $stmt->execute([$sessionId, $linkKey, (int)$participant['id'], (int)$participant['user_id'], $participant['display_name'], $participant['avatar_path'], $avatarUrl, $content, $messageType, $mimeType, $originalName]);
    $id = (int)$pdo->lastInsertId();
    $msg = [
        'id' => $id,
        'channel' => 'link',
        'link_key' => $linkKey,
        'participant_id' => (int)$participant['id'],
        'user_id' => (int)$participant['user_id'],
        'display_name' => $participant['display_name'],
        'avatar_url' => $avatarUrl,
        'role' => $authorContext['role'],
        'is_owner' => $authorContext['is_owner'],
        'content' => $content,
        'gesture' => $messageType === 'gesture' ? $snapshot : null,
        'message_type' => $messageType,
        'mime_type' => $mimeType,
        'original_name' => $originalName,
        'sent_at' => gmdate('Y-m-d H:i:s'),
    ];
    emit_community_event($pdo, 'link', $sessionId, $linkKey, 'link_message', $msg);
    json_out($msg);
}

if ($channel === 'dm') {
    $targetUserId = (int)($body['target_user_id'] ?? 0);
    if (!$targetUserId || $targetUserId === (int)$participant['user_id']) json_out(['error' => 'DM recipient required'], 400);
    $stmt = $pdo->prepare('SELECT id, display_name, avatar_path FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$targetUserId]);
    $targetUser = $stmt->fetch();
    if (!$targetUser) json_out(['error' => 'DM recipient not found'], 404);
    $stmt = $pdo->prepare(
        'SELECT 1 FROM user_blocks
         WHERE (blocker_user_id = ? AND blocked_user_id = ?)
            OR (blocker_user_id = ? AND blocked_user_id = ?)
         LIMIT 1'
    );
    $stmt->execute([(int)$participant['user_id'], $targetUserId, $targetUserId, (int)$participant['user_id']]);
    if ($stmt->fetch()) json_out(['error' => 'You cannot DM this user.'], 403);
    $dmKey = dm_key_for((int)$participant['user_id'], $targetUserId);
    $avatarUrl = $participant['webcam_path'] ?: resolve_avatar($participant['avatar_path']);
    $stmt = $pdo->prepare(
        "INSERT INTO community_messages (scope, link_key, participant_id, user_id, display_name, avatar_path, avatar_url, content, message_type, mime_type, original_name)
         VALUES ('dm',?,?,?,?,?,?,?,?,?,?)"
    );
    $stmt->execute([$dmKey, (int)$participant['id'], (int)$participant['user_id'], $participant['display_name'], $participant['avatar_path'], $avatarUrl, $content, $messageType, $mimeType, $originalName]);
    $id = (int)$pdo->lastInsertId();
    $msg = [
        'id' => $id,
        'channel' => 'dm',
        'dm_key' => $dmKey,
        'target_user_id' => $targetUserId,
        'partner_user_id' => $targetUserId,
        'participant_id' => (int)$participant['id'],
        'user_id' => (int)$participant['user_id'],
        'display_name' => $participant['display_name'],
        'avatar_url' => $avatarUrl,
        'role' => $authorContext['role'],
        'is_owner' => false,
        'content' => $content,
        'gesture' => $messageType === 'gesture' ? $snapshot : null,
        'message_type' => $messageType,
        'mime_type' => $mimeType,
        'original_name' => $originalName,
        'sent_at' => gmdate('Y-m-d H:i:s'),
    ];
    emit_community_event($pdo, 'dm', null, $dmKey, 'dm_message', $msg);
    json_out($msg);
}

$avatarUrl = $participant['webcam_path'] ?: resolve_avatar($participant['avatar_path']);
$stmt = $pdo->prepare('INSERT INTO messages (session_id, participant_id, user_id, display_name, avatar_path, avatar_url, content, message_type, mime_type, original_name) VALUES (?,?,?,?,?,?,?,?,?,?)');
$stmt->execute([$sessionId, (int)$participant['id'], (int)$participant['user_id'], $participant['display_name'], $participant['avatar_path'], $avatarUrl, $content, $messageType, $mimeType, $originalName]);
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
    'content' => $content,
    'gesture' => $messageType === 'gesture' ? $snapshot : null,
    'message_type' => $messageType,
    'mime_type' => $mimeType,
    'original_name' => $originalName,
    'sent_at' => gmdate('Y-m-d H:i:s'),
];
emit_event($pdo, $sessionId, 'message', $msg);
json_out($msg);
