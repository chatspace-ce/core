<?php
require_once __DIR__ . '/../includes/base.php';
$user = require_user();
$pdo = db();
$roomKey = trim((string)($_GET['id'] ?? ''));

$stmt = $pdo->prepare('SELECT * FROM rooms WHERE public_id = ? LIMIT 1');
$stmt->execute([$roomKey]);
$room = $stmt->fetch();
if (!$room && ctype_digit($roomKey)) {
    $stmt = $pdo->prepare('SELECT * FROM rooms WHERE id = ? LIMIT 1');
    $stmt->execute([(int)$roomKey]);
    $room = $stmt->fetch();
}
if (!$room) json_out(['error' => 'Room not found'], 404);

$session = active_session_for_room($pdo, (int)$room['id']);
cleanup_stale_participants($pdo, (int)$session['id']);
cleanup_room_effects($pdo, (int)$session['id']);
$participant = participant_for_user($pdo, (int)$session['id'], $user);
$canModerateMessages = can_use_host_tools($user, $room);
$historyLimit = max(1, min(1000, (int)app_setting($pdo, 'room_chat_history_limit', '100')));
$roomLimitSql = 'LIMIT ' . $historyLimit;

function community_reactions_for(PDO $pdo, array $messageIds): array {
    if (!$messageIds) return [];
    $placeholders = implode(',', array_fill(0, count($messageIds), '?'));
    $reactionStmt = $pdo->prepare(
        "SELECT cmr.message_id, cmr.participant_id, cmr.user_id, cmr.emoji, p.display_name, p.avatar_path, p.webcam_path
           FROM community_message_reactions cmr
           LEFT JOIN participants p ON p.id = cmr.participant_id
          WHERE cmr.message_id IN ($placeholders)
          ORDER BY cmr.created_at ASC"
    );
    $reactionStmt->execute($messageIds);
    $map = [];
    foreach ($reactionStmt->fetchAll() as $r) {
        $map[(int)$r['message_id']][] = [
            'participant_id' => (int)$r['participant_id'],
            'user_id' => (int)$r['user_id'],
            'emoji' => $r['emoji'],
            'display_name' => $r['display_name'] ?: 'Someone',
            'avatar_url' => $r['webcam_path'] ?: resolve_avatar($r['avatar_path'] ?? 'preset:Default'),
        ];
    }
    return $map;
}

function community_message_payload(array $m, string $channel, array $reactionsMap, ?int $partnerUserId = null): array {
    $row = [
        'id' => (int)$m['id'],
        'channel' => $channel,
        'participant_id' => (int)$m['participant_id'],
        'user_id' => (int)$m['user_id'],
        'display_name' => $m['display_name'],
        'avatar_url' => $m['avatar_url'] ?: resolve_avatar($m['avatar_path'] ?? 'preset:Default'),
        'role' => $m['author_role'] ?? 'user',
        'is_owner' => !empty($m['author_is_owner']),
        'content' => $m['content'],
        'url_preview' => message_url_preview($m['url_preview_json'] ?? null),
        'message_type' => $m['message_type'] ?? 'text',
        'file_size' => $m['file_size'] !== null ? (int)$m['file_size'] : null,
        'mime_type' => $m['mime_type'] ?? null,
        'original_name' => $m['original_name'] ?? null,
        'edited_at' => $m['edited_at'] ?? null,
        'sent_at' => $m['sent_at'],
        'reactions' => $reactionsMap[(int)$m['id']] ?? [],
    ];
    if (($row['message_type'] ?? 'text') === 'gesture') {
        $row['gesture'] = message_gesture((string)$m['content']);
    }
    if (isset($m['link_key'])) {
        $row[$channel === 'dm' ? 'dm_key' : 'link_key'] = $m['link_key'];
    }
    if ($partnerUserId !== null) {
        $row['partner_user_id'] = $partnerUserId;
        $row['target_user_id'] = $partnerUserId;
    }
    return $row;
}

$pdo->prepare('UPDATE users SET current_room_id = ?, last_seen_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([(int)$room['id'], (int)$user['id']]);
$pdo->prepare('UPDATE participants SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([(int)$participant['id']]);

$stmt = $pdo->prepare('SELECT COALESCE(MAX(id), 0) FROM events WHERE session_id = ?');
$stmt->execute([(int)$session['id']]);
$lastEventId = (int)$stmt->fetchColumn();

$stmt = $pdo->prepare('SELECT p.*, u.role FROM participants p JOIN users u ON u.id = p.user_id WHERE p.session_id = ? AND p.last_seen_at >= ? ORDER BY p.joined_at ASC');
$stmt->execute([(int)$session['id'], stale_cutoff($pdo)]);
$roomOwnerId = (int)$room['owner_id'];
$participants = array_map(function(array $p) use ($roomOwnerId): array {
    return [
        'id' => (int)$p['id'],
        'user_id' => (int)$p['user_id'],
        'display_name' => $p['display_name'],
        'role' => $p['role'] ?: 'user',
        'is_owner' => (int)$p['user_id'] === $roomOwnerId,
        'avatar_path' => $p['avatar_path'],
        'avatar_url' => $p['webcam_path'] ?: resolve_avatar($p['avatar_path']),
        'position_x' => (float)$p['position_x'],
        'position_y' => (float)$p['position_y'],
        'webcam_path' => $p['webcam_path'],
        'linked_to' => $p['linked_to_participant_id'] ? (int)$p['linked_to_participant_id'] : null,
        'online' => $p['last_seen_at'] && strtotime($p['last_seen_at']) >= time() - 35,
    ];
}, $stmt->fetchAll());

$stmt = $pdo->prepare(
    'SELECT *
       FROM (
        SELECT m.*,
            COALESCE(p.display_name, m.display_name, u.display_name) AS author_display_name,
            COALESCE(p.avatar_path, m.avatar_path, u.avatar_path) AS author_avatar_path,
            COALESCE(p.webcam_path, m.avatar_url) AS author_avatar_url,
            COALESCE(p.user_id, m.user_id) AS author_user_id,
            u.role AS author_role,
            CASE WHEN COALESCE(p.user_id, m.user_id) = ? THEN 1 ELSE 0 END AS author_is_owner
     FROM messages m
     LEFT JOIN participants p ON p.id = m.participant_id
     LEFT JOIN users u ON u.id = COALESCE(p.user_id, m.user_id)
     WHERE m.session_id = ?
       AND (? = 1 OR COALESCE(m.is_deleted, 0) = 0)
     ORDER BY m.sent_at DESC, m.id DESC ' . $roomLimitSql . '
       ) room_history
      ORDER BY sent_at ASC, id ASC'
);
$stmt->execute([$roomOwnerId, (int)$session['id'], $canModerateMessages ? 1 : 0]);
$rawMessages = $stmt->fetchAll();
$messageIds = array_map(fn(array $m): int => (int)$m['id'], $rawMessages);
$reactionsMap = [];
if ($messageIds) {
    $placeholders = implode(',', array_fill(0, count($messageIds), '?'));
    $reactionStmt = $pdo->prepare(
        "SELECT mr.message_id, mr.participant_id, mr.user_id, mr.emoji, p.display_name, p.avatar_path, p.webcam_path
           FROM message_reactions mr
           LEFT JOIN participants p ON p.id = mr.participant_id
          WHERE mr.message_id IN ($placeholders)
          ORDER BY mr.created_at ASC"
    );
    $reactionStmt->execute($messageIds);
    foreach ($reactionStmt->fetchAll() as $r) {
        $reactionsMap[(int)$r['message_id']][] = [
            'participant_id' => (int)$r['participant_id'],
            'user_id' => (int)$r['user_id'],
            'emoji' => $r['emoji'],
            'display_name' => $r['display_name'] ?: 'Someone',
            'avatar_url' => $r['webcam_path'] ?: resolve_avatar($r['avatar_path'] ?? 'preset:Default'),
        ];
    }
}
$messages = array_map(function(array $m) use ($canModerateMessages, $reactionsMap): array {
    $row = [
        'id' => (int)$m['id'],
        'participant_id' => $m['participant_id'] ? (int)$m['participant_id'] : null,
        'user_id' => $m['author_user_id'] ? (int)$m['author_user_id'] : null,
        'display_name' => $m['author_display_name'] ?: 'Someone',
        'avatar_path' => $m['author_avatar_path'] ?? null,
        'avatar_url' => ($m['author_avatar_url'] ?: resolve_avatar($m['author_avatar_path'] ?? 'preset:Default')),
        'role' => $m['author_role'] ?: 'user',
        'is_owner' => !empty($m['author_is_owner']),
        'content' => $m['content'],
        'url_preview' => message_url_preview($m['url_preview_json'] ?? null),
        'message_type' => $m['message_type'] ?? 'text',
        'file_size' => $m['file_size'] !== null ? (int)$m['file_size'] : null,
        'mime_type' => $m['mime_type'] ?? null,
        'original_name' => $m['original_name'] ?? null,
        'edited_at' => $m['edited_at'] ?? null,
        'deleted_at' => $m['deleted_at'] ?? null,
        'is_deleted' => !empty($m['is_deleted']),
        'sent_at' => $m['sent_at'],
        'reactions' => $reactionsMap[(int)$m['id']] ?? [],
    ];
    if (($row['message_type'] ?? 'text') === 'gesture') {
        $row['gesture'] = message_gesture((string)$m['content']);
    }
    if ($canModerateMessages) {
        $row['original_content'] = $m['original_content'] ?? null;
    }
    return $row;
}, $rawMessages);

$stmt = $pdo->query(
    "SELECT cm.id, cm.participant_id, cm.user_id, cm.display_name, cm.avatar_path, cm.avatar_url, cm.content, cm.url_preview_json,
            cm.message_type, cm.file_size, cm.mime_type, cm.original_name, cm.edited_at, cm.sent_at,
            u.role AS author_role,
            0 AS author_is_owner
     FROM community_messages cm
     LEFT JOIN users u ON u.id = cm.user_id
     WHERE cm.scope = 'community' AND COALESCE(cm.is_deleted, 0) = 0
     ORDER BY cm.sent_at ASC LIMIT 120"
);
$rawCommunityMessages = $stmt->fetchAll();
$communityReactions = community_reactions_for($pdo, array_map(fn(array $m): int => (int)$m['id'], $rawCommunityMessages));
$communityMessages = array_map(fn(array $m): array => community_message_payload($m, 'community', $communityReactions), $rawCommunityMessages);

$linkMessages = [];
$linkedTo = $participant['linked_to_participant_id'] ? (int)$participant['linked_to_participant_id'] : null;
if (!$linkedTo) {
    $stmt = $pdo->prepare('SELECT id FROM participants WHERE session_id = ? AND linked_to_participant_id = ? LIMIT 1');
    $stmt->execute([(int)$session['id'], (int)$participant['id']]);
    $linkedTo = (int)($stmt->fetchColumn() ?: 0);
}
if ($linkedTo) {
    $linkKey = link_key_for((int)$participant['id'], $linkedTo);
    $stmt = $pdo->prepare(
        "SELECT cm.id, cm.participant_id, cm.user_id, cm.display_name, cm.avatar_path, cm.avatar_url, cm.content, cm.url_preview_json,
                cm.message_type, cm.file_size, cm.mime_type, cm.original_name, cm.edited_at, cm.sent_at, cm.link_key,
                u.role AS author_role,
                CASE WHEN cm.user_id = ? THEN 1 ELSE 0 END AS author_is_owner
         FROM community_messages cm
         LEFT JOIN users u ON u.id = cm.user_id
         WHERE cm.scope = 'link' AND cm.session_id = ? AND cm.link_key = ? AND COALESCE(cm.is_deleted, 0) = 0
           AND sent_at > COALESCE((
             SELECT cleared_at FROM private_message_clears
              WHERE user_id = ? AND scope = 'link' AND session_id = ? AND link_key = ?
              LIMIT 1
           ), '0000-01-01 00:00:00')
         ORDER BY cm.sent_at ASC LIMIT 120"
    );
    $stmt->execute([$roomOwnerId, (int)$session['id'], $linkKey, (int)$user['id'], (int)$session['id'], $linkKey]);
    $rawLinkMessages = $stmt->fetchAll();
    $linkReactions = community_reactions_for($pdo, array_map(fn(array $m): int => (int)$m['id'], $rawLinkMessages));
    $linkMessages = array_map(fn(array $m): array => community_message_payload($m, 'link', $linkReactions), $rawLinkMessages);
}

$stmt = $pdo->prepare('SELECT link_key, icon_name FROM link_icons WHERE session_id = ?');
$stmt->execute([(int)$session['id']]);
$linkIcons = [];
foreach ($stmt->fetchAll() as $row) {
    $linkIcons[$row['link_key']] = $row['icon_name'] ?: 'plus';
}

$dmLeft = 'dm:' . (int)$user['id'] . ':%';
$dmRight = 'dm:%:' . (int)$user['id'];
$stmt = $pdo->prepare(
    "SELECT cm.id, cm.participant_id, cm.user_id, cm.display_name, cm.avatar_path, cm.avatar_url, cm.content, cm.url_preview_json,
            cm.message_type, cm.file_size, cm.mime_type, cm.original_name, cm.edited_at, cm.sent_at, cm.link_key,
            u.role AS author_role,
            0 AS author_is_owner
     FROM community_messages cm
     LEFT JOIN users u ON u.id = cm.user_id
     WHERE cm.scope = 'dm' AND COALESCE(cm.is_deleted, 0) = 0 AND (cm.link_key LIKE ? OR cm.link_key LIKE ?)
       AND cm.sent_at > COALESCE((
         SELECT cleared_at FROM private_message_clears
          WHERE user_id = ? AND scope = 'dm' AND session_id = 0 AND link_key = cm.link_key
          LIMIT 1
       ), '0000-01-01 00:00:00')
     ORDER BY cm.sent_at ASC LIMIT 160"
);
$stmt->execute([$dmLeft, $dmRight, (int)$user['id']]);
$rawDmMessages = $stmt->fetchAll();
$dmReactions = community_reactions_for($pdo, array_map(fn(array $m): int => (int)$m['id'], $rawDmMessages));
$dmMessages = array_map(function(array $m) use ($user, $dmReactions): array {
    $ids = explode(':', (string)$m['link_key']);
    $a = (int)($ids[1] ?? 0);
    $b = (int)($ids[2] ?? 0);
    $partnerId = $a === (int)$user['id'] ? $b : $a;
    return community_message_payload($m, 'dm', $dmReactions, $partnerId);
}, $rawDmMessages);

$dmPartnerIds = array_values(array_unique(array_filter(array_map(fn(array $m): int => (int)$m['partner_user_id'], $dmMessages))));
$dmUsers = [];
if ($dmPartnerIds) {
    $placeholders = implode(',', array_fill(0, count($dmPartnerIds), '?'));
    $stmt = $pdo->prepare("SELECT id, display_name, avatar_path FROM users WHERE id IN ($placeholders)");
    $stmt->execute($dmPartnerIds);
    $dmUsers = array_map(fn(array $u): array => [
        'id' => (int)$u['id'],
        'display_name' => $u['display_name'],
        'avatar_url' => resolve_avatar($u['avatar_path']),
    ], $stmt->fetchAll());
}

$lastCommunityEventId = (int)$pdo->query('SELECT COALESCE(MAX(id), 0) FROM community_events')->fetchColumn();
$stmt = $pdo->prepare('SELECT blocked_user_id FROM user_blocks WHERE blocker_user_id = ?');
$stmt->execute([(int)$user['id']]);
$blockedUserIds = array_map(fn(array $row): int => (int)$row['blocked_user_id'], $stmt->fetchAll());
$roomEffects = array_values(room_effect_catalog());
$activeRoomEffect = active_room_effect($pdo, (int)$session['id']);

json_out([
    'roomId' => (int)$room['id'],
    'roomPublicId' => $room['public_id'],
    'roomName' => $room['name'],
    'backgroundThumbPath' => $room['background_thumb_path'] ?? null,
    'isRoomOwner' => (int)$room['owner_id'] === (int)$user['id'],
    'canEditRoom' => (int)$room['owner_id'] === (int)$user['id'] || in_array($user['role'] ?? 'user', ['admin', 'developer'], true),
    'canUseHostTools' => $canModerateMessages,
    'canModerateMessages' => $canModerateMessages,
    'canCommunityEject' => can_community_eject($user),
    'roomEffects' => $roomEffects,
    'activeRoomEffect' => $activeRoomEffect,
    'gifPicker' => [
        'enabled' => app_setting($pdo, 'gif_giphy_api_key') !== '' || app_setting($pdo, 'gif_tenor_api_key') !== '',
        'defaultProvider' => in_array(app_setting($pdo, 'gif_default_provider', 'giphy'), ['giphy', 'tenor'], true) ? app_setting($pdo, 'gif_default_provider', 'giphy') : 'giphy',
        'providers' => [
            'giphy' => app_setting($pdo, 'gif_giphy_api_key') !== '',
            'tenor' => app_setting($pdo, 'gif_tenor_api_key') !== '',
        ],
    ],
    'myRole' => $user['role'] ?? 'user',
    'blockedUserIds' => $blockedUserIds,
    'sessionId' => $session['public_id'],
    'myParticipantId' => (int)$participant['id'],
    'myUserId' => (int)$user['id'],
    'myJoinToken' => $participant['join_token'],
    'lastEventId' => $lastEventId,
    'participants' => $participants,
    'messages' => $messages,
    'communityMessages' => $communityMessages,
    'linkMessages' => $linkMessages,
    'linkIcons' => $linkIcons,
    'linkIconCatalog' => link_icon_catalog($pdo),
    'dmMessages' => $dmMessages,
    'dmUsers' => $dmUsers,
    'lastCommunityEventId' => $lastCommunityEventId,
    'avatarPresets' => avatar_presets(),
    'backgroundPath' => $room['background_path'],
    'backgroundMime' => $room['background_mime'],
]);
