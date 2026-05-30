<?php
require_once __DIR__ . '/../includes/base.php';
require_once __DIR__ . '/../includes/message_centre.php';
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

function reply_preview_text(array $message): string {
    $type = (string)($message['message_type'] ?? 'text');
    if ($type === 'gif') return 'sent a GIF';
    if ($type === 'gesture') {
        $gesture = message_gesture((string)($message['content'] ?? ''));
        return trim((string)($gesture['text'] ?? $gesture['name'] ?? $message['original_name'] ?? 'sent a gesture'));
    }
    if ($type === 'file') return trim((string)($message['original_name'] ?? 'sent a file'));
    if ($type === 'voice_note') return 'sent a voice note';
    $text = trim(preg_replace('/\s+/', ' ', (string)($message['content'] ?? '')));
    if ($text === '') return 'Message';
    return function_exists('mb_substr') ? mb_substr($text, 0, 180, 'UTF-8') : substr($text, 0, 180);
}

function reply_snapshot(PDO $pdo, array $body, string $channel, int $sessionId, array $participant): ?array {
    $replyId = (int)($body['reply_to_id'] ?? 0);
    if ($replyId <= 0) return null;
    $replyChannel = (string)($body['reply_to_channel'] ?? $channel);
    if (str_starts_with($replyChannel, 'link:')) $replyChannel = 'link';
    if (str_starts_with($replyChannel, 'dm:')) $replyChannel = 'dm';
    if ($replyChannel !== $channel || !in_array($channel, ['room', 'community', 'link', 'dm'], true)) {
        json_out(['error' => 'Reply target unavailable'], 400);
    }

    if ($channel === 'room') {
        $stmt = $pdo->prepare('SELECT * FROM messages WHERE id = ? AND session_id = ? AND COALESCE(is_deleted, 0) = 0 LIMIT 1');
        $stmt->execute([$replyId, $sessionId]);
        $message = $stmt->fetch();
    } else {
        $stmt = $pdo->prepare('SELECT * FROM community_messages WHERE id = ? AND COALESCE(is_deleted, 0) = 0 LIMIT 1');
        $stmt->execute([$replyId]);
        $message = $stmt->fetch();
        if ($message && !community_message_accessible($message, $channel, $sessionId, $participant)) $message = false;
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
        'preview' => reply_preview_text($message),
    ];
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
        $urlPreview = url_preview_for_text($content);
        $urlPreviewJson = $urlPreview ? json_encode($urlPreview, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : null;
        $pdo->prepare('UPDATE community_messages SET content = ?, original_content = ?, url_preview_json = ?, edited_at = ? WHERE id = ?')
            ->execute([$content, $original, $urlPreviewJson, $editedAt, $messageId]);
        $msg = [
            'id' => $messageId,
            'message_id' => $messageId,
            'channel' => $channel,
            'participant_id' => (int)$participant['id'],
            'user_id' => (int)$participant['user_id'],
            'content' => $content,
            'url_preview' => $urlPreview,
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
    $urlPreview = url_preview_for_text($content);
    $urlPreviewJson = $urlPreview ? json_encode($urlPreview, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : null;
    $pdo->prepare('UPDATE messages SET content = ?, original_content = ?, url_preview_json = ?, edited_at = ? WHERE id = ?')
        ->execute([$content, $original, $urlPreviewJson, $editedAt, $messageId]);
    $msg = [
        'id' => $messageId,
        'message_id' => $messageId,
        'participant_id' => (int)$participant['id'],
        'user_id' => (int)$participant['user_id'],
        'content' => $content,
        'url_preview' => $urlPreview,
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
$urlPreview = $messageType === 'text' ? url_preview_for_text($content) : null;
$urlPreviewJson = $urlPreview ? json_encode($urlPreview, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : null;
$replyTo = reply_snapshot($pdo, $body, $channel, $sessionId, $participant);
$replyToJson = $replyTo ? json_encode($replyTo, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : null;
$maxPerSecond = app_setting_float($pdo, 'chat_posts_per_second', 3);
$rateCutoff = gmdate('Y-m-d H:i:s', time() - 1);
$roomRecent = $pdo->prepare("SELECT COUNT(*) FROM messages WHERE participant_id = ? AND sent_at >= ?");
$roomRecent->execute([(int)$participant['id'], $rateCutoff]);
$communityRecent = $pdo->prepare("SELECT COUNT(*) FROM community_messages WHERE participant_id = ? AND sent_at >= ?");
$communityRecent->execute([(int)$participant['id'], $rateCutoff]);
if (((int)$roomRecent->fetchColumn() + (int)$communityRecent->fetchColumn()) >= $maxPerSecond) {
    json_out(['error' => 'You are sending messages too quickly.'], 429);
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
} elseif ($channel === 'dm') {
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
}

$msg = create_message($pdo, $channel, $messageType, [
    'session_id' => $sessionId,
    'participant' => $participant,
    'author_context' => $authorContext,
    'content' => $content,
    'url_preview' => $urlPreview,
    'url_preview_json' => $urlPreviewJson,
    'reply_to' => $replyTo,
    'reply_to_json' => $replyToJson,
    'gesture' => $messageType === 'gesture' ? $snapshot : null,
    'mime_type' => $mimeType,
    'original_name' => $originalName,
    'link_key' => $linkKey ?? null,
    'dm_key' => $dmKey ?? null,
    'target_user_id' => $targetUserId ?? null,
]);
json_out($msg);
