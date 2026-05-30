<?php
require_once __DIR__ . '/base.php';

function create_message(PDO $pdo, string $channel, string $type, array $payload): array {
    $participant = $payload['participant'] ?? [];
    $authorContext = $payload['author_context'] ?? [];
    $participantId = (int)($payload['participant_id'] ?? $participant['id'] ?? 0);
    $userId = (int)($payload['user_id'] ?? $participant['user_id'] ?? 0);
    $displayName = (string)($payload['display_name'] ?? $participant['display_name'] ?? 'Someone');
    $avatarPath = $payload['avatar_path'] ?? $participant['avatar_path'] ?? null;
    $avatarUrl = $payload['avatar_url'] ?? (($participant['webcam_path'] ?? null) ?: resolve_avatar($avatarPath ?: 'preset:Default'));
    $urlPreview = $payload['url_preview'] ?? null;
    $urlPreviewJson = array_key_exists('url_preview_json', $payload)
        ? $payload['url_preview_json']
        : ($urlPreview ? json_encode($urlPreview, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : null);
    $replyTo = $payload['reply_to'] ?? null;
    $replyToJson = array_key_exists('reply_to_json', $payload)
        ? $payload['reply_to_json']
        : ($replyTo ? json_encode($replyTo, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : null);
    $baseMsg = [
        'participant_id' => $participantId,
        'user_id' => $userId,
        'display_name' => $displayName,
        'avatar_path' => $avatarPath,
        'avatar_url' => $avatarUrl,
        'role' => (string)($payload['role'] ?? $authorContext['role'] ?? 'user'),
        'is_owner' => (bool)($payload['is_owner'] ?? $authorContext['is_owner'] ?? false),
        'content' => (string)($payload['content'] ?? ''),
        'url_preview' => $urlPreview,
        'reply_to' => $replyTo,
        'gesture' => $payload['gesture'] ?? null,
        'message_type' => $type,
        'file_size' => isset($payload['file_size']) ? (int)$payload['file_size'] : null,
        'mime_type' => $payload['mime_type'] ?? null,
        'original_name' => $payload['original_name'] ?? null,
        'sent_at' => gmdate('Y-m-d H:i:s'),
    ];

    if (in_array($channel, ['community', 'link', 'dm'], true)) {
        $columns = ['scope'];
        $values = [$channel];
        if ($channel === 'link') {
            $columns[] = 'session_id';
            $values[] = (int)($payload['session_id'] ?? 0);
            $columns[] = 'link_key';
            $values[] = (string)($payload['link_key'] ?? '');
        } elseif ($channel === 'dm') {
            $columns[] = 'link_key';
            $values[] = (string)($payload['dm_key'] ?? $payload['link_key'] ?? '');
        }
        $columns = array_merge($columns, [
            'participant_id',
            'user_id',
            'display_name',
            'avatar_path',
            'avatar_url',
            'content',
            'url_preview_json',
            'reply_to_json',
            'message_type',
            'file_size',
            'mime_type',
            'original_name',
        ]);
        $values = array_merge($values, [
            $participantId,
            $userId,
            $displayName,
            $avatarPath,
            $avatarUrl,
            $baseMsg['content'],
            $urlPreviewJson,
            $replyToJson,
            $type,
            $baseMsg['file_size'],
            $baseMsg['mime_type'],
            $baseMsg['original_name'],
        ]);
        $stmt = $pdo->prepare('INSERT INTO community_messages (' . implode(', ', $columns) . ') VALUES (' . implode(',', array_fill(0, count($columns), '?')) . ')');
        $stmt->execute($values);
        $msg = ['id' => (int)$pdo->lastInsertId(), 'channel' => $channel] + $baseMsg;
        if ($channel === 'link') {
            $msg['link_key'] = (string)($payload['link_key'] ?? '');
            emit_community_event($pdo, 'link', (int)($payload['session_id'] ?? 0), $msg['link_key'], 'link_message', $msg);
            return $msg;
        }
        if ($channel === 'dm') {
            $msg['dm_key'] = (string)($payload['dm_key'] ?? $payload['link_key'] ?? '');
            $msg['target_user_id'] = (int)($payload['target_user_id'] ?? 0);
            $msg['partner_user_id'] = $msg['target_user_id'];
            $msg['is_owner'] = false;
            emit_community_event($pdo, 'dm', null, $msg['dm_key'], 'dm_message', $msg);
            return $msg;
        }
        emit_community_event($pdo, 'community', null, null, 'community_message', $msg);
        return $msg;
    }

    if ($channel === 'game') {
        $stmt = $pdo->prepare(
            'INSERT INTO game_chat_messages (lobby_code, participant_id, content, message_type, file_size, mime_type, original_name)
             VALUES (?,?,?,?,?,?,?)'
        );
        $stmt->execute([
            (string)($payload['lobby_code'] ?? ''),
            $participantId,
            $baseMsg['content'],
            $type,
            $baseMsg['file_size'],
            $baseMsg['mime_type'],
            $baseMsg['original_name'],
        ]);
        return ['id' => (int)$pdo->lastInsertId(), 'channel' => 'game', 'lobby_code' => (string)($payload['lobby_code'] ?? '')] + $baseMsg;
    }

    $sessionId = (int)($payload['session_id'] ?? 0);
    $stmt = $pdo->prepare(
        'INSERT INTO messages (session_id, participant_id, user_id, display_name, avatar_path, avatar_url, content, url_preview_json, reply_to_json, message_type, file_size, mime_type, original_name)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
    );
    $stmt->execute([
        $sessionId,
        $participantId,
        $userId,
        $displayName,
        $avatarPath,
        $avatarUrl,
        $baseMsg['content'],
        $urlPreviewJson,
        $replyToJson,
        $type,
        $baseMsg['file_size'],
        $baseMsg['mime_type'],
        $baseMsg['original_name'],
    ]);
    $msg = ['id' => (int)$pdo->lastInsertId(), 'channel' => 'room'] + $baseMsg;
    emit_event($pdo, $sessionId, 'message', $msg);
    return $msg;
}
