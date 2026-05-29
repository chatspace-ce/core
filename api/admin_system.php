<?php
require_once __DIR__ . '/../includes/base.php';

$me = require_staff();
$pdo = db();

function admin_settings(PDO $pdo): array {
    $rows = $pdo->query('SELECT setting_key, value FROM app_settings ORDER BY setting_key ASC')->fetchAll();
    $settings = [];
    foreach ($rows as $row) $settings[$row['setting_key']] = $row['value'];
    return $settings;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $action = (string)($_GET['action'] ?? 'overview');

    if ($action === 'settings') {
        json_out(['settings' => admin_settings($pdo)]);
    }

    if ($action === 'logs') {
        $rows = $pdo->query(
            'SELECT tl.*, actor.display_name AS actor_name, target.display_name AS target_name, r.name AS room_name
               FROM tool_logs tl
               LEFT JOIN users actor ON actor.id = tl.actor_user_id
               LEFT JOIN users target ON target.id = tl.target_user_id
               LEFT JOIN rooms r ON r.id = tl.room_id
              ORDER BY tl.id DESC'
        )->fetchAll();
        json_out(['logs' => array_map(fn(array $row): array => [
            'id' => (int)$row['id'],
            'action' => $row['action'],
            'actor_name' => $row['actor_name'] ?: 'System',
            'target_name' => $row['target_name'] ?: '',
            'room_name' => $row['room_name'] ?: '',
            'detail' => $row['detail'] ?: '',
            'created_at' => $row['created_at'],
        ], $rows)]);
    }

    if ($action === 'blocks') {
        $blocks = $pdo->query(
            'SELECT ub.blocker_user_id, ub.blocked_user_id, ub.created_at,
                    blocker.display_name AS blocker_name, blocked.display_name AS blocked_name
               FROM user_blocks ub
               JOIN users blocker ON blocker.id = ub.blocker_user_id
               JOIN users blocked ON blocked.id = ub.blocked_user_id
              ORDER BY ub.created_at DESC'
        )->fetchAll();
        json_out(['blocks' => array_map(fn(array $row): array => [
            'blocker_user_id' => (int)$row['blocker_user_id'],
            'blocked_user_id' => (int)$row['blocked_user_id'],
            'blocker_name' => $row['blocker_name'],
            'blocked_name' => $row['blocked_name'],
            'created_at' => $row['created_at'],
        ], $blocks)]);
    }

    if ($action === 'community_ejections') {
        $rows = $pdo->query(
            'SELECT ce.*, u.display_name, by_user.display_name AS ejected_by_name
               FROM community_ejections ce
               JOIN users u ON u.id = ce.user_id
               JOIN users by_user ON by_user.id = ce.ejected_by_user_id
              WHERE ' . active_ejection_sql('ce') . '
              ORDER BY ce.created_at DESC'
        )->fetchAll();
        json_out(['ejections' => array_map(fn(array $row): array => [
            'id' => (int)$row['id'],
            'user_id' => (int)$row['user_id'],
            'display_name' => $row['display_name'],
            'ejected_by_name' => $row['ejected_by_name'],
            'duration_minutes' => $row['duration_minutes'] !== null ? (int)$row['duration_minutes'] : null,
            'permanent' => (bool)$row['permanent'],
            'reason' => $row['reason'] ?: '',
            'created_at' => $row['created_at'],
            'expires_at' => $row['expires_at'],
        ], $rows)]);
    }

    if ($action === 'room_ejections') {
        $rows = $pdo->query(
            'SELECT re.*, u.display_name, by_user.display_name AS ejected_by_name, r.name AS room_name
               FROM room_ejections re
               JOIN users u ON u.id = re.user_id
               JOIN users by_user ON by_user.id = re.ejected_by_user_id
               JOIN rooms r ON r.id = re.room_id
              WHERE ' . active_ejection_sql('re') . '
              ORDER BY re.created_at DESC'
        )->fetchAll();
        json_out(['ejections' => array_map(fn(array $row): array => [
            'id' => (int)$row['id'],
            'room_id' => (int)$row['room_id'],
            'user_id' => (int)$row['user_id'],
            'display_name' => $row['display_name'],
            'room_name' => $row['room_name'],
            'ejected_by_name' => $row['ejected_by_name'],
            'duration_minutes' => $row['duration_minutes'] !== null ? (int)$row['duration_minutes'] : null,
            'permanent' => (bool)$row['permanent'],
            'created_at' => $row['created_at'],
            'expires_at' => $row['expires_at'],
        ], $rows)]);
    }

    json_out(['error' => 'Unknown action'], 400);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'Unsupported method'], 405);

$body = input_json();
$action = (string)($body['action'] ?? '');

if ($action === 'save_settings') {
    $allowed = [
        'chat_posts_per_second' => [0.2, 30],
        'room_chat_history_limit' => [1, 1000],
        'avatar_movements_per_second' => [1, 60],
        'avatar_max_size_mb' => [0.5, 50],
        'gesture_upload_limit' => [0, 1000],
        'room_image_max_size_mb' => [1, 100],
        'room_video_max_size_mb' => [5, 1000],
        'participant_idle_timeout_minutes' => [0.5, 120],
        'auth_login_max_attempts' => [1, 50],
        'auth_recovery_max_attempts' => [1, 50],
        'auth_ip_max_attempts' => [5, 500],
        'auth_attempt_window_minutes' => [1, 1440],
        'auth_lockout_minutes' => [1, 1440],
        'age_gate_min_age' => [1, 120],
    ];
    foreach ($allowed as $key => [$min, $max]) {
        $value = (float)($body[$key] ?? app_setting($pdo, $key, (string)$min));
        $value = max($min, min($max, $value));
        set_app_setting($pdo, $key, (string)$value);
    }
    $giphyKey = trim((string)($body['gif_giphy_api_key'] ?? ''));
    $tenorKey = trim((string)($body['gif_tenor_api_key'] ?? ''));
    $provider = (string)($body['gif_default_provider'] ?? 'giphy');
    if (!in_array($provider, ['giphy', 'tenor'], true)) $provider = 'giphy';
    set_app_setting($pdo, 'gif_giphy_api_key', $giphyKey);
    set_app_setting($pdo, 'gif_tenor_api_key', $tenorKey);
    set_app_setting($pdo, 'gif_default_provider', $provider);
    set_app_setting($pdo, 'age_gate_enabled', !empty($body['age_gate_enabled']) ? '1' : '0');
    log_tool($pdo, (int)$me['id'], 'admin_settings_update', null, null, 'Updated community settings');
    json_out(['ok' => true, 'settings' => admin_settings($pdo)]);
}

if ($action === 'remove_block') {
    $blockerId = (int)($body['blocker_user_id'] ?? 0);
    $blockedId = (int)($body['blocked_user_id'] ?? 0);
    if (!$blockerId || !$blockedId) json_out(['error' => 'Block required'], 400);
    $pdo->prepare('DELETE FROM user_blocks WHERE blocker_user_id = ? AND blocked_user_id = ?')->execute([$blockerId, $blockedId]);
    log_tool($pdo, (int)$me['id'], 'admin_remove_block', $blockedId, null, 'Removed user block');
    json_out(['ok' => true]);
}

if ($action === 'undo_community_ejection') {
    $id = (int)($body['id'] ?? 0);
    if (!$id) json_out(['error' => 'Ejection required'], 400);
    $stmt = $pdo->prepare('SELECT user_id FROM community_ejections WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $targetId = (int)($stmt->fetchColumn() ?: 0);
    $pdo->prepare('DELETE FROM community_ejections WHERE id = ?')->execute([$id]);
    log_tool($pdo, (int)$me['id'], 'admin_undo_community_ejection', $targetId ?: null, null, 'Undid community ejection');
    json_out(['ok' => true]);
}

if ($action === 'undo_room_ejection') {
    $id = (int)($body['id'] ?? 0);
    if (!$id) json_out(['error' => 'Ejection required'], 400);
    $stmt = $pdo->prepare('SELECT user_id, room_id FROM room_ejections WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    $pdo->prepare('DELETE FROM room_ejections WHERE id = ?')->execute([$id]);
    log_tool($pdo, (int)$me['id'], 'admin_undo_room_kick', $row ? (int)$row['user_id'] : null, $row ? (int)$row['room_id'] : null, 'Undid room kick');
    json_out(['ok' => true]);
}

json_out(['error' => 'Unknown action'], 400);
