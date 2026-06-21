<?php
require_once __DIR__ . '/../includes/base.php';
require_once __DIR__ . '/../includes/database_backups.php';
require_once __DIR__ . '/../includes/room_importer.php';

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
    $users = $pdo->query('SELECT id, email, password_hash, display_name, role, avatar_path, aura_effect, created_at FROM users ORDER BY id ASC')->fetchAll();
    $rooms = $pdo->query(
        'SELECT r.id, r.public_id, r.owner_id, u.email AS owner_email, r.name, r.background_path, r.background_mime, r.background_thumb_path, r.import_url, r.import_layout_json, r.music_playlist_json, r.created_at
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
            foreach (room_import_file_paths($room['import_layout_json'] ?? null, $room['music_playlist_json'] ?? null) as $path) {
                add_portable_file($files, $path);
            }
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
                'aura_effect' => $row['aura_effect'] ?: null,
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
                'import_url' => $row['import_url'] ?? null,
                'import_layout_json' => $row['import_layout_json'] ?? null,
                'music_playlist_json' => $row['music_playlist_json'] ?? null,
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
    try {
        json_out(backup_import_core_bundle(db(), $decoded, (int)$me['id']));
    } catch (Throwable $e) {
        json_out(['error' => $e->getMessage()], 500);
    }
}

try {
    json_out(backup_restore_sqlite_upload($tmp, true, (int)$me['id']));
} catch (Throwable $e) {
    json_out(['error' => $e->getMessage()], 400);
}
