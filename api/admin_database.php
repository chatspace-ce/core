<?php
require_once __DIR__ . '/../includes/base.php';

$me = require_staff();

function portable_file_allowed(string $path): bool {
    return $path !== ''
        && str_starts_with($path, '/assets/')
        && !str_contains($path, '..')
        && !str_starts_with($path, '/assets/js/')
        && !str_starts_with($path, '/assets/css/');
}

function portable_file_path(string $path): string {
    return __DIR__ . '/..' . $path;
}

function add_portable_file(array &$files, ?string $path): void {
    $path = (string)($path ?? '');
    if ($path === '' || str_starts_with($path, 'preset:') || str_starts_with($path, 'data:') || !portable_file_allowed($path)) return;
    $full = portable_file_path($path);
    if (!is_file($full)) return;
    $mime = function_exists('mime_content_type') ? (mime_content_type($full) ?: 'application/octet-stream') : 'application/octet-stream';
    $files[$path] = [
        'path' => $path,
        'mime' => $mime,
        'bytes' => filesize($full),
        'data' => base64_encode((string)file_get_contents($full)),
    ];
}

function export_core_bundle(PDO $pdo, int $actorId, array $options = []): void {
    $includeUsers = array_key_exists('users', $options) ? (bool)$options['users'] : true;
    $includeGestures = array_key_exists('gestures', $options) ? (bool)$options['gestures'] : false;
    $includeRooms = array_key_exists('rooms', $options) ? (bool)$options['rooms'] : true;
    $includeSettings = array_key_exists('settings', $options) ? (bool)$options['settings'] : true;
    $users = $pdo->query('SELECT id, email, password_hash, display_name, role, avatar_path, created_at FROM users ORDER BY id ASC')->fetchAll();
    $rooms = $pdo->query(
        'SELECT r.id, r.public_id, r.owner_id, u.email AS owner_email, r.name, r.background_path, r.background_mime, r.background_thumb_path, r.created_at
           FROM rooms r
           JOIN users u ON u.id = r.owner_id
          ORDER BY r.id ASC'
    )->fetchAll();
    $settings = $pdo->query('SELECT setting_key, value FROM app_settings ORDER BY setting_key ASC')->fetchAll();
    $gestures = $pdo->query(
        'SELECT g.*, u.email AS owner_email
           FROM gestures g
           JOIN users u ON u.id = g.owner_user_id
          WHERE g.deleted_at IS NULL
          ORDER BY g.id ASC'
    )->fetchAll();
    $linkIcons = link_icon_catalog($pdo);
    $files = [];
    if ($includeUsers) {
        foreach ($users as $user) add_portable_file($files, $user['avatar_path'] ?? null);
    }
    if ($includeRooms) {
        foreach ($rooms as $room) {
            add_portable_file($files, $room['background_path'] ?? null);
            add_portable_file($files, $room['background_thumb_path'] ?? null);
        }
    }
    if ($includeGestures) {
        foreach ($gestures as $gesture) {
            add_portable_file($files, $gesture['gif_path'] ?? null);
            add_portable_file($files, $gesture['audio_path'] ?? null);
        }
    }
    if ($includeSettings) {
        foreach ($linkIcons as $icon) add_portable_file($files, $icon['file_path'] ?? null);
    }

    $bundle = [
        'format' => 'chatspace-ce-portable-bundle',
        'version' => 1,
        'exported_at' => gmdate('c'),
        'includes' => [
            'users' => $includeUsers,
            'gestures' => $includeGestures,
            'rooms' => $includeRooms,
            'settings' => $includeSettings,
        ],
        'sections' => [],
        'files' => array_values($files),
    ];

    if ($includeUsers) {
        $bundle['sections']['users'] = array_map(fn(array $row): array => [
                'source_id' => (int)$row['id'],
                'email' => $row['email'],
                'password_hash' => $row['password_hash'],
                'display_name' => $row['display_name'],
                'role' => $row['role'] ?: 'user',
                'avatar_path' => $row['avatar_path'] ?: 'preset:Default',
                'created_at' => $row['created_at'],
        ], $users);
    }

    if ($includeGestures) {
        $bundle['sections']['gestures'] = array_map(fn(array $row): array => [
            'source_id' => (int)$row['id'],
            'public_id' => $row['public_id'] ?: uuid_v4(),
            'owner_source_id' => (int)$row['owner_user_id'],
            'owner_email' => $row['owner_email'],
            'name' => $row['name'],
            'gesture_text' => $row['gesture_text'],
            'gif_path' => $row['gif_path'],
            'audio_path' => $row['audio_path'],
            'audio_is_silent' => !empty($row['audio_is_silent']),
            'is_public' => !empty($row['is_public']),
            'file_size' => $row['file_size'] !== null ? (int)$row['file_size'] : null,
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ], $gestures);
    }

    if ($includeRooms) {
        $bundle['sections']['rooms'] = array_map(fn(array $row): array => [
                'source_id' => (int)$row['id'],
                'public_id' => $row['public_id'] ?: uuid_v4(),
                'owner_source_id' => (int)$row['owner_id'],
                'owner_email' => $row['owner_email'],
                'name' => $row['name'],
                'background_path' => $row['background_path'],
                'background_mime' => $row['background_mime'],
                'background_thumb_path' => $row['background_thumb_path'],
                'created_at' => $row['created_at'],
        ], $rooms);
    }

    if ($includeSettings) {
        $bundle['sections']['settings'] = array_map(fn(array $row): array => [
                'key' => $row['setting_key'],
                'value' => $row['value'],
        ], $settings);
        $bundle['sections']['link_icons'] = $linkIcons;
    }

    $labels = [];
    if ($includeUsers) $labels[] = $includeGestures ? 'users and gestures' : 'users';
    if ($includeRooms) $labels[] = 'rooms';
    if ($includeSettings) $labels[] = 'settings';
    log_tool($pdo, $actorId, 'admin_portable_export', null, null, 'Exported ' . ($labels ? implode(', ', $labels) : 'empty portable bundle') . ' and files');
    header('Content-Type: application/json');
    header('Content-Disposition: attachment; filename="chatspace-core-' . gmdate('Ymd-His') . '.json"');
    echo json_encode($bundle, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

function write_portable_files(array $files): void {
    foreach ($files as $file) {
        if (!is_array($file)) continue;
        $path = (string)($file['path'] ?? '');
        if (!portable_file_allowed($path)) continue;
        $data = base64_decode((string)($file['data'] ?? ''), true);
        if ($data === false) continue;
        $full = portable_file_path($path);
        $dir = dirname($full);
        if (!is_dir($dir)) mkdir($dir, 0775, true);
        file_put_contents($full, $data);
    }
}

function import_core_bundle(PDO $pdo, array $bundle, int $actorId): array {
    if (($bundle['format'] ?? '') !== 'chatspace-ce-portable-bundle') {
        json_out(['error' => 'Uploaded file is not a ChatSpace portable bundle'], 400);
    }
    $sections = is_array($bundle['sections'] ?? null) ? $bundle['sections'] : [];
    write_portable_files(is_array($bundle['files'] ?? null) ? $bundle['files'] : []);

    $userMap = [];
    $pdo->beginTransaction();
    try {
        foreach (($sections['settings'] ?? []) as $setting) {
            if (!is_array($setting)) continue;
            $key = trim((string)($setting['key'] ?? ''));
            if ($key !== '') set_app_setting($pdo, $key, (string)($setting['value'] ?? ''));
        }

        foreach (($sections['link_icons'] ?? []) as $icon) {
            if (!is_array($icon)) continue;
            $iconName = preg_replace('/[^a-z0-9-]/', '', (string)($icon['icon_name'] ?? '')) ?: '';
            $label = trim((string)($icon['label'] ?? ''));
            $filePath = (string)($icon['file_path'] ?? '');
            if ($iconName !== '' && $label !== '' && portable_file_allowed($filePath)) {
                upsert_link_icon_catalog($pdo, $iconName, $label, $filePath, !empty($icon['built_in']));
            }
        }

        foreach (($sections['users'] ?? []) as $user) {
            if (!is_array($user)) continue;
            $email = strtolower(trim((string)($user['email'] ?? '')));
            $displayName = trim((string)($user['display_name'] ?? ''));
            $hash = (string)($user['password_hash'] ?? '');
            if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $displayName === '' || $hash === '') continue;
            $role = in_array(($user['role'] ?? 'user'), ['user', 'guide', 'developer', 'admin'], true) ? (string)$user['role'] : 'user';
            $avatarPath = (string)($user['avatar_path'] ?? 'preset:Default');
            $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
            $stmt->execute([$email]);
            $id = (int)($stmt->fetchColumn() ?: 0);
            if ($id) {
                $pdo->prepare('UPDATE users SET password_hash = ?, display_name = ?, role = ?, avatar_path = ? WHERE id = ?')
                    ->execute([$hash, $displayName, $role, $avatarPath, $id]);
            } else {
                $pdo->prepare('INSERT INTO users (email, password_hash, display_name, role, avatar_path) VALUES (?,?,?,?,?)')
                    ->execute([$email, $hash, $displayName, $role, $avatarPath]);
                $id = (int)$pdo->lastInsertId();
            }
            $userMap[(int)($user['source_id'] ?? 0)] = $id;
            $userMap[$email] = $id;
        }

        foreach (($sections['gestures'] ?? []) as $gesture) {
            if (!is_array($gesture)) continue;
            $ownerEmail = strtolower(trim((string)($gesture['owner_email'] ?? '')));
            $ownerId = $userMap[(int)($gesture['owner_source_id'] ?? 0)] ?? $userMap[$ownerEmail] ?? 0;
            if (!$ownerId && $ownerEmail !== '') {
                $ownerStmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
                $ownerStmt->execute([$ownerEmail]);
                $ownerId = (int)($ownerStmt->fetchColumn() ?: 0);
            }
            $publicId = trim((string)($gesture['public_id'] ?? '')) ?: uuid_v4();
            $name = trim((string)($gesture['name'] ?? ''));
            $gestureText = trim((string)($gesture['gesture_text'] ?? $gesture['text'] ?? ''));
            $gifPath = (string)($gesture['gif_path'] ?? '');
            if (!$ownerId || $name === '' || $gestureText === '' || !portable_file_allowed($gifPath)) continue;
            $audioPath = (string)($gesture['audio_path'] ?? '');
            if ($audioPath !== '' && !portable_file_allowed($audioPath)) $audioPath = '';
            $values = [
                $ownerId,
                $name,
                $gestureText,
                $gifPath,
                $audioPath !== '' ? $audioPath : null,
                !empty($gesture['audio_is_silent']) ? 1 : 0,
                !empty($gesture['is_public']) ? 1 : 0,
                $gesture['file_size'] !== null ? (int)$gesture['file_size'] : null,
            ];
            $stmt = $pdo->prepare('SELECT id FROM gestures WHERE public_id = ? LIMIT 1');
            $stmt->execute([$publicId]);
            $gestureId = (int)($stmt->fetchColumn() ?: 0);
            if ($gestureId) {
                $pdo->prepare('UPDATE gestures SET owner_user_id = ?, name = ?, gesture_text = ?, gif_path = ?, audio_path = ?, audio_is_silent = ?, is_public = ?, file_size = ?, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                    ->execute([...$values, $gestureId]);
            } else {
                $pdo->prepare('INSERT INTO gestures (public_id, owner_user_id, name, gesture_text, gif_path, audio_path, audio_is_silent, is_public, file_size) VALUES (?,?,?,?,?,?,?,?,?)')
                    ->execute([$publicId, ...$values]);
            }
        }

        foreach (($sections['rooms'] ?? []) as $room) {
            if (!is_array($room)) continue;
            $ownerId = $userMap[(int)($room['owner_source_id'] ?? 0)] ?? $userMap[strtolower((string)($room['owner_email'] ?? ''))] ?? 0;
            if (!$ownerId && !empty($room['owner_email'])) {
                $ownerStmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
                $ownerStmt->execute([strtolower((string)$room['owner_email'])]);
                $ownerId = (int)($ownerStmt->fetchColumn() ?: 0);
            }
            $name = trim((string)($room['name'] ?? ''));
            if (!$ownerId || $name === '') continue;
            $publicId = trim((string)($room['public_id'] ?? '')) ?: uuid_v4();
            $stmt = $pdo->prepare('SELECT id FROM rooms WHERE public_id = ? LIMIT 1');
            $stmt->execute([$publicId]);
            $roomId = (int)($stmt->fetchColumn() ?: 0);
            $values = [
                $ownerId,
                $name,
                $room['background_path'] ?? null,
                $room['background_mime'] ?? null,
                $room['background_thumb_path'] ?? null,
            ];
            if ($roomId) {
                $pdo->prepare('UPDATE rooms SET owner_id = ?, name = ?, background_path = ?, background_mime = ?, background_thumb_path = ? WHERE id = ?')
                    ->execute([...$values, $roomId]);
            } else {
                $pdo->prepare('INSERT INTO rooms (public_id, owner_id, name, background_path, background_mime, background_thumb_path) VALUES (?,?,?,?,?,?)')
                    ->execute([$publicId, ...$values]);
                $roomId = (int)$pdo->lastInsertId();
            }
            active_session_for_room($pdo, $roomId);
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        json_out(['error' => 'Portable import failed: ' . $e->getMessage()], 500);
    }
    $imported = [];
    foreach (['users', 'gestures', 'rooms', 'settings', 'link_icons'] as $sectionName) {
        if (!empty($sections[$sectionName])) $imported[] = $sectionName;
    }
    log_tool($pdo, $actorId, 'admin_portable_import', null, null, 'Imported ' . ($imported ? implode(', ', $imported) : 'portable bundle') . ' and files');
    return ['ok' => true];
}

function request_bool(string $key, bool $default = false): bool {
    if (!array_key_exists($key, $_GET)) return $default;
    return in_array(strtolower((string)$_GET[$key]), ['1', 'true', 'yes', 'on'], true);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && ($_GET['action'] ?? '') === 'download') {
    if (db_driver() !== 'sqlite') json_out(['error' => 'Database download is available for SQLite installs. Use your MySQL/MariaDB backup tool for server databases.'], 400);
    $dbPath = sqlite_path();
    if (!is_file($dbPath)) json_out(['error' => 'Database not found'], 404);
    log_tool(db(), (int)$me['id'], 'admin_database_download', null, null, 'Downloaded database backup');
    header('Content-Type: application/vnd.sqlite3');
    header('Content-Disposition: attachment; filename="chatspace-' . gmdate('Ymd-His') . '.sqlite"');
    header('Content-Length: ' . filesize($dbPath));
    readfile($dbPath);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && in_array(($_GET['action'] ?? ''), ['export_core', 'export_bundle'], true)) {
    export_core_bundle(db(), (int)$me['id'], [
        'users' => request_bool('users', true),
        'gestures' => request_bool('gestures', false),
        'rooms' => request_bool('rooms', true),
        'settings' => request_bool('settings', true),
    ]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'Unsupported method'], 405);

if (empty($_FILES['database']['tmp_name']) || !is_uploaded_file($_FILES['database']['tmp_name'])) {
    json_out(['error' => 'Import file required'], 400);
}

$tmp = $_FILES['database']['tmp_name'];
$decoded = json_decode((string)file_get_contents($tmp), true);
if (is_array($decoded) && ($decoded['format'] ?? '') === 'chatspace-ce-portable-bundle') {
    json_out(import_core_bundle(db(), $decoded, (int)$me['id']));
}

if (db_driver() !== 'sqlite') json_out(['error' => 'Full database restore is available for SQLite installs. Use portable import or your MySQL/MariaDB restore process.'], 400);

$checkPath = sys_get_temp_dir() . '/chatspace-restore-' . bin2hex(random_bytes(8)) . '.sqlite';
if (!move_uploaded_file($tmp, $checkPath)) json_out(['error' => 'Could not read uploaded database'], 500);

try {
    $check = new PDO('sqlite:' . $checkPath);
    $check->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $result = (string)$check->query('PRAGMA integrity_check')->fetchColumn();
    $hasUsers = (int)$check->query("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='users'")->fetchColumn();
    $hasRooms = (int)$check->query("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='rooms'")->fetchColumn();
    $check = null;
    if ($result !== 'ok' || !$hasUsers || !$hasRooms) {
        @unlink($checkPath);
        json_out(['error' => 'Uploaded file is not a valid ChatSpace database'], 400);
    }
} catch (Throwable $e) {
    @unlink($checkPath);
    json_out(['error' => 'Uploaded file is not a valid SQLite database'], 400);
}

$dbPath = sqlite_path();
$backup = $dbPath . '.pre-restore-' . gmdate('Ymd-His') . '.bak';
if (is_file($dbPath)) copy($dbPath, $backup);
if (!copy($checkPath, $dbPath)) {
    @unlink($checkPath);
    json_out(['error' => 'Could not restore database'], 500);
}
@unlink($checkPath);
log_tool(db(), (int)$me['id'], 'admin_database_restore', null, null, 'Restored database; prior copy: ' . basename($backup));
json_out(['ok' => true]);
