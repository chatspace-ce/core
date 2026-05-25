<?php
require_once __DIR__ . '/../includes/base.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'POST required'], 405);
$body = input_json();
$pdo = db();
$sessionId = resolve_session_id($pdo, $body['session_id'] ?? '');
$p = auth_participant($pdo, $sessionId, $body['join_token'] ?? '');
$action = $body['action'] ?? 'position';
$allowedLinkIcons = ['none', 'plus', 'wedding-rings', 'heart', 'wedding-rings-lesbian', 'help', 'wedding-rings-gay', 'archer', 'cross-swords', 'lips', 'lotus', 'handcuffs'];

if ($action === 'position' || $action === 'update_position') {
    $maxMoves = app_setting_float($pdo, 'avatar_movements_per_second', 12);
    $recent = $pdo->prepare("SELECT COUNT(*) FROM events WHERE session_id = ? AND type = 'position' AND payload LIKE ? AND created_at >= ?");
    $recent->execute([$sessionId, '%"participant_id":' . (int)$p['id'] . '%', gmdate('Y-m-d H:i:s', time() - 1)]);
    if ((int)$recent->fetchColumn() >= $maxMoves) json_out(['ok' => true, 'throttled' => true]);
    $x = max(0, min(1, (float)($body['x'] ?? 0)));
    $y = max(0, min(1, (float)($body['y'] ?? 0)));
    $pdo->prepare('UPDATE participants SET position_x = ?, position_y = ? WHERE id = ?')->execute([$x, $y, (int)$p['id']]);
    emit_event($pdo, $sessionId, 'position', ['participant_id' => (int)$p['id'], 'position_x' => $x, 'position_y' => $y]);
    json_out(['ok' => true]);
}

if ($action === 'position_pair') {
    $positions = $body['positions'] ?? [];
    if (!is_array($positions)) json_out(['error' => 'positions required'], 400);

    $allowed = [(int)$p['id'] => true];
    if (!empty($p['linked_to_participant_id'])) $allowed[(int)$p['linked_to_participant_id']] = true;
    $stmt = $pdo->prepare('SELECT id FROM participants WHERE session_id = ? AND linked_to_participant_id = ?');
    $stmt->execute([$sessionId, (int)$p['id']]);
    foreach ($stmt->fetchAll() as $row) $allowed[(int)$row['id']] = true;

    $update = $pdo->prepare('UPDATE participants SET position_x = ?, position_y = ? WHERE id = ? AND session_id = ?');
    $maxMoves = app_setting_float($pdo, 'avatar_movements_per_second', 12);
    $recent = $pdo->prepare("SELECT COUNT(*) FROM events WHERE session_id = ? AND type = 'position' AND created_at >= ?");
    $recent->execute([$sessionId, gmdate('Y-m-d H:i:s', time() - 1)]);
    if ((int)$recent->fetchColumn() >= $maxMoves * 2) json_out(['ok' => true, 'throttled' => true]);
    foreach ($positions as $pos) {
        $id = (int)($pos['participant_id'] ?? 0);
        if (!$id || empty($allowed[$id])) continue;
        $x = max(0, min(1, (float)($pos['x'] ?? 0)));
        $y = max(0, min(1, (float)($pos['y'] ?? 0)));
        $update->execute([$x, $y, $id, $sessionId]);
        emit_event($pdo, $sessionId, 'position', ['participant_id' => $id, 'position_x' => $x, 'position_y' => $y]);
    }
    json_out(['ok' => true]);
}

if ($action === 'link') {
    $targetId = (int)($body['target_participant_id'] ?? 0);
    if (!$targetId || $targetId === (int)$p['id']) json_out(['error' => 'Target participant required'], 400);

    $stmt = $pdo->prepare('SELECT id, user_id FROM participants WHERE id = ? AND session_id = ? LIMIT 1');
    $stmt->execute([$targetId, $sessionId]);
    $targetParticipant = $stmt->fetch();
    if (!$targetParticipant) json_out(['error' => 'Target not in room'], 403);
    $stmt = $pdo->prepare(
        'SELECT 1 FROM user_blocks
         WHERE (blocker_user_id = ? AND blocked_user_id = ?)
            OR (blocker_user_id = ? AND blocked_user_id = ?)
         LIMIT 1'
    );
    $stmt->execute([(int)$p['user_id'], (int)$targetParticipant['user_id'], (int)$targetParticipant['user_id'], (int)$p['user_id']]);
    if ($stmt->fetch()) json_out(['error' => 'You cannot link with this user.'], 403);

    $pdo->prepare('UPDATE participants SET linked_to_participant_id = NULL WHERE id = ? OR linked_to_participant_id = ?')
        ->execute([(int)$p['id'], (int)$p['id']]);
    $pdo->prepare('UPDATE participants SET linked_to_participant_id = NULL WHERE id = ? OR linked_to_participant_id = ?')
        ->execute([$targetId, $targetId]);
    $pdo->prepare('UPDATE participants SET linked_to_participant_id = ? WHERE id = ?')->execute([$targetId, (int)$p['id']]);

    if (isset($body['initiator_x'], $body['initiator_y'], $body['target_x'], $body['target_y'])) {
        $pdo->prepare('UPDATE participants SET position_x = ?, position_y = ? WHERE id = ? AND session_id = ?')
            ->execute([
                max(0, min(1, (float)$body['initiator_x'])),
                max(0, min(1, (float)$body['initiator_y'])),
                (int)$p['id'],
                $sessionId,
            ]);
        $pdo->prepare('UPDATE participants SET position_x = ?, position_y = ? WHERE id = ? AND session_id = ?')
            ->execute([
                max(0, min(1, (float)$body['target_x'])),
                max(0, min(1, (float)$body['target_y'])),
                $targetId,
                $sessionId,
            ]);
    }

    $payload = [
        'participant_id' => (int)$p['id'],
        'linked_to' => $targetId,
    ];
    if (isset($body['initiator_x'], $body['initiator_y'], $body['target_x'], $body['target_y'])) {
        $payload['initiator_position'] = [
            'x' => max(0, min(1, (float)$body['initiator_x'])),
            'y' => max(0, min(1, (float)$body['initiator_y'])),
        ];
        $payload['target_position'] = [
            'x' => max(0, min(1, (float)$body['target_x'])),
            'y' => max(0, min(1, (float)$body['target_y'])),
        ];
    }
    emit_event($pdo, $sessionId, 'link', $payload);
    json_out(['ok' => true, 'link_key' => link_key_for((int)$p['id'], $targetId)]);
}

if ($action === 'unlink') {
    $stmt = $pdo->prepare('SELECT id FROM participants WHERE session_id = ? AND linked_to_participant_id = ?');
    $stmt->execute([$sessionId, (int)$p['id']]);
    $reverse = $stmt->fetchAll();

    $pdo->prepare('UPDATE participants SET linked_to_participant_id = NULL WHERE id = ? OR linked_to_participant_id = ?')
        ->execute([(int)$p['id'], (int)$p['id']]);
    emit_event($pdo, $sessionId, 'link', [
        'participant_id' => (int)$p['id'],
        'linked_to' => null,
    ]);
    foreach ($reverse as $row) {
        emit_event($pdo, $sessionId, 'link', [
            'participant_id' => (int)$row['id'],
            'linked_to' => null,
        ]);
    }
    json_out(['ok' => true]);
}

if ($action === 'block_user' || $action === 'unblock_user') {
    $targetUserId = (int)($body['target_user_id'] ?? 0);
    $targetParticipantId = (int)($body['target_participant_id'] ?? 0);
    if (!$targetUserId && $targetParticipantId) {
        $stmt = $pdo->prepare('SELECT user_id FROM participants WHERE id = ? AND session_id = ? LIMIT 1');
        $stmt->execute([$targetParticipantId, $sessionId]);
        $targetUserId = (int)($stmt->fetchColumn() ?: 0);
    }
    if (!$targetUserId || $targetUserId === (int)$p['user_id']) json_out(['error' => 'User required'], 400);
    if ($action === 'block_user') {
        $pdo->prepare(db_uses_mysql_syntax($pdo) ? 'INSERT IGNORE INTO user_blocks (blocker_user_id, blocked_user_id) VALUES (?,?)' : 'INSERT OR IGNORE INTO user_blocks (blocker_user_id, blocked_user_id) VALUES (?,?)')
            ->execute([(int)$p['user_id'], $targetUserId]);
        $pdo->prepare('UPDATE participants SET linked_to_participant_id = NULL WHERE (user_id = ? OR user_id = ?) AND session_id = ?')
            ->execute([(int)$p['user_id'], $targetUserId, $sessionId]);
        emit_event($pdo, $sessionId, 'block', ['blocker_user_id' => (int)$p['user_id'], 'blocked_user_id' => $targetUserId]);
        log_tool($pdo, (int)$p['user_id'], 'block_user', $targetUserId, null, 'User block');
    } else {
        $pdo->prepare('DELETE FROM user_blocks WHERE blocker_user_id = ? AND blocked_user_id = ?')
            ->execute([(int)$p['user_id'], $targetUserId]);
        emit_event($pdo, $sessionId, 'unblock', ['blocker_user_id' => (int)$p['user_id'], 'blocked_user_id' => $targetUserId]);
        log_tool($pdo, (int)$p['user_id'], 'unblock_user', $targetUserId, null, 'User unblock');
    }
    json_out(['ok' => true, 'target_user_id' => $targetUserId]);
}

if ($action === 'link_icon') {
    $targetId = (int)($body['target_participant_id'] ?? 0);
    $iconName = preg_replace('/[^a-z0-9-]/', '', (string)($body['icon_name'] ?? 'plus')) ?: 'plus';
    if (!in_array($iconName, $allowedLinkIcons, true)) json_out(['error' => 'Unknown icon'], 400);
    if (!$targetId || $targetId === (int)$p['id']) json_out(['error' => 'Linked participant required'], 400);

    $stmt = $pdo->prepare(
        'SELECT id FROM participants
         WHERE session_id = ? AND id = ?
           AND (linked_to_participant_id = ? OR id = (SELECT linked_to_participant_id FROM participants WHERE id = ?))
         LIMIT 1'
    );
    $stmt->execute([$sessionId, $targetId, (int)$p['id'], (int)$p['id']]);
    if (!$stmt->fetch()) json_out(['error' => 'You are not linked to that participant'], 403);

    $linkKey = link_key_for((int)$p['id'], $targetId);
    $stmt = $pdo->prepare(db_uses_mysql_syntax($pdo)
        ? 'INSERT INTO link_icons (session_id, link_key, icon_name, updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE icon_name = VALUES(icon_name), updated_at = CURRENT_TIMESTAMP'
        : 'INSERT INTO link_icons (session_id, link_key, icon_name, updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(session_id, link_key) DO UPDATE SET icon_name = excluded.icon_name, updated_at = CURRENT_TIMESTAMP'
    );
    $stmt->execute([$sessionId, $linkKey, $iconName]);
    $payload = [
        'link_key' => $linkKey,
        'participant_id' => (int)$p['id'],
        'target_participant_id' => $targetId,
        'icon_name' => $iconName,
    ];
    emit_event($pdo, $sessionId, 'link_icon', $payload);
    json_out(['ok' => true] + $payload);
}

json_out(['error' => 'Unknown action'], 400);
