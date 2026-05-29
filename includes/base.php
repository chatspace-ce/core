<?php
declare(strict_types=1);

const CHATSPACE_CONFIG = __DIR__ . '/config.php';
const CHATSPACE_DEFAULT_SQLITE = __DIR__ . '/../db/chatspace.sqlite';

session_set_cookie_params([
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

if (is_file(CHATSPACE_CONFIG)) {
    require_once CHATSPACE_CONFIG;
}

function app_base_path(): string {
    static $base = null;
    if ($base !== null) return $base;

    $script = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '');
    if ($script === '' || $script === '/') {
        $base = '';
        return $base;
    }

    foreach (['/api/', '/games/'] as $marker) {
        $pos = strpos($script, $marker);
        if ($pos !== false) {
            $base = substr($script, 0, $pos);
            return $base === '/' ? '' : rtrim($base, '/');
        }
    }

    $dir = rtrim(str_replace('\\', '/', dirname($script)), '/');
    $base = $dir === '/' || $dir === '.' ? '' : $dir;
    return $base;
}

function app_url(string $path = ''): string {
    if ($path === '') return app_base_path() ?: '/';
    if (preg_match('#^(?:https?:)?//#', $path) || str_starts_with($path, 'data:') || str_starts_with($path, 'blob:')) return $path;
    $base = app_base_path();
    if ($base !== '' && str_starts_with($path, $base . '/')) return $path;
    return $base . '/' . ltrim($path, '/');
}

function media_url(?string $path): string {
    if (!$path) return '';
    return app_url($path);
}

function redirect_to(string $path): never {
    header('Location: ' . app_url($path));
    exit;
}

function chatspace_is_setup_request(): bool {
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '';
    return str_ends_with($path, '/setup.php')
        || str_contains($path, '/assets/')
        || (PHP_SAPI === 'cli');
}

function chatspace_configured(): bool {
    return defined('CHATSPACE_DB_DRIVER');
}

if (!chatspace_configured() && !chatspace_is_setup_request()) {
    redirect_to('/setup.php');
}

function db_driver(?PDO $pdo = null): string {
    if ($pdo instanceof PDO) return (string)$pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    return strtolower((string)(defined('CHATSPACE_DB_DRIVER') ? CHATSPACE_DB_DRIVER : 'sqlite'));
}

function db_uses_mysql_syntax(PDO $pdo): bool {
    if (db_driver($pdo) !== 'mysql') return false;
    try {
        return stripos((string)$pdo->getAttribute(PDO::ATTR_SERVER_VERSION), 'fakesql') === false;
    } catch (Throwable) {
        return true;
    }
}

function db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;

    $driver = db_driver();
    if ($driver === 'mysql') {
        $host = defined('CHATSPACE_DB_HOST') ? CHATSPACE_DB_HOST : '127.0.0.1';
        $port = (int)(defined('CHATSPACE_DB_PORT') ? CHATSPACE_DB_PORT : 3306);
        $name = defined('CHATSPACE_DB_NAME') ? CHATSPACE_DB_NAME : 'chatspace_ce';
        $user = defined('CHATSPACE_DB_USER') ? CHATSPACE_DB_USER : 'root';
        $pass = defined('CHATSPACE_DB_PASS') ? CHATSPACE_DB_PASS : '';
        $pdo = new PDO(
            "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4",
            $user,
            $pass,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
        );
    } else {
        $sqlitePath = defined('CHATSPACE_SQLITE_PATH') ? CHATSPACE_SQLITE_PATH : CHATSPACE_DEFAULT_SQLITE;
        if (!is_dir(dirname($sqlitePath))) {
            mkdir(dirname($sqlitePath), 0775, true);
        }
        $pdo = new PDO('sqlite:' . $sqlitePath);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $pdo->exec('PRAGMA foreign_keys = ON');
    }

    migrate($pdo);
    return $pdo;
}

function sqlite_path(): string {
    return defined('CHATSPACE_SQLITE_PATH') ? CHATSPACE_SQLITE_PATH : CHATSPACE_DEFAULT_SQLITE;
}

function db_concat(PDO $pdo, array $parts): string {
    if (db_driver($pdo) === 'mysql') {
        return 'CONCAT(' . implode(', ', $parts) . ')';
    }
    return implode(' || ', $parts);
}

function split_sql_statements(string $sql): array {
    $sql = preg_replace('/--[^\n]*/', '', $sql) ?? $sql;
    $sql = preg_replace('/\/\*.*?\*\//s', '', $sql) ?? $sql;
    return array_values(array_filter(array_map('trim', preg_split("/;(?=(?:[^']*'[^']*')*[^']*$)/", $sql) ?: [])));
}

function mysqlize_schema(string $schema): string {
    $schema = str_replace('INTEGER PRIMARY KEY AUTOINCREMENT', 'INT AUTO_INCREMENT PRIMARY KEY', $schema);
    $schema = str_replace('INTEGER', 'INT', $schema);
    $schema = str_replace('REAL', 'DOUBLE', $schema);
    $schema = preg_replace('/\bTEXT\b/', 'VARCHAR(1024)', $schema) ?? $schema;
    $longTextColumns = ['payload', 'content', 'original_content', 'url_preview_json', 'reply_to_json', 'state_json', 'data', 'reason'];
    foreach ($longTextColumns as $column) {
        $schema = preg_replace('/\b' . $column . '\s+VARCHAR\(1024\)/', $column . ' LONGTEXT', $schema) ?? $schema;
    }
    $shortColumns = [
        'email' => 'VARCHAR(191)',
        'public_id' => 'VARCHAR(64)',
        'session_public_id' => 'VARCHAR(64)',
        'password_hash' => 'VARCHAR(255)',
        'recovery_code_hash' => 'VARCHAR(255)',
        'recovery_code_suffix' => 'VARCHAR(16)',
        'display_name' => 'VARCHAR(191)',
        'role' => 'VARCHAR(32)',
        'avatar_path' => 'VARCHAR(512)',
        'avatar_url' => 'VARCHAR(512)',
        'background_path' => 'VARCHAR(512)',
        'background_mime' => 'VARCHAR(128)',
        'background_thumb_path' => 'VARCHAR(512)',
        'room_name' => 'VARCHAR(191)',
        'webcam_path' => 'VARCHAR(512)',
        'join_token' => 'VARCHAR(96)',
        'message_type' => 'VARCHAR(32)',
        'mime_type' => 'VARCHAR(128)',
        'original_name' => 'VARCHAR(255)',
        'game_type' => 'VARCHAR(32)',
        'lobby_code' => 'VARCHAR(191)',
        'status' => 'VARCHAR(32)',
        'type' => 'VARCHAR(64)',
        'icon_name' => 'VARCHAR(64)',
        'label' => 'VARCHAR(191)',
        'file_path' => 'VARCHAR(512)',
        'link_key' => 'VARCHAR(191)',
        'scope' => 'VARCHAR(32)',
        'action' => 'VARCHAR(64)',
        'setting_key' => 'VARCHAR(191)',
        'key_hash' => 'VARCHAR(64)',
        'dimension' => 'VARCHAR(32)',
        'value' => 'VARCHAR(1024)',
    ];
    foreach ($shortColumns as $column => $type) {
        $schema = preg_replace('/\b' . $column . '\s+VARCHAR\(1024\)/', $column . ' ' . $type, $schema) ?? $schema;
    }
    foreach (['current_room_id'] as $intColumn) {
        $schema = preg_replace('/\b' . $intColumn . '\s+INT/', $intColumn . ' INT', $schema) ?? $schema;
    }
    foreach (['last_seen_at', 'created_at', 'started_at', 'joined_at', 'updated_at', 'sent_at', 'edited_at', 'deleted_at', 'expires_at', 'cleared_at', 'last_attempt_at', 'locked_until'] as $dateColumn) {
        $schema = preg_replace('/\b' . $dateColumn . '\s+VARCHAR\(1024\)/', $dateColumn . ' DATETIME', $schema) ?? $schema;
    }
    $schema = preg_replace('/CREATE TABLE IF NOT EXISTS ([^(]+)\s*\((.*?)\);/s', 'CREATE TABLE IF NOT EXISTS $1 ($2) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;', $schema) ?? $schema;
    return $schema;
}

function migrate(PDO $pdo): void {
    $schema = "
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            recovery_code_hash TEXT DEFAULT NULL,
            recovery_code_suffix TEXT DEFAULT NULL,
            display_name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            avatar_path TEXT DEFAULT 'preset:Default',
            current_room_id INTEGER DEFAULT NULL,
            last_seen_at TEXT DEFAULT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            public_id TEXT DEFAULT NULL UNIQUE,
            owner_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            background_path TEXT DEFAULT NULL,
            background_mime TEXT DEFAULT NULL,
            background_thumb_path TEXT DEFAULT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS room_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            public_id TEXT DEFAULT NULL UNIQUE,
            room_id INTEGER NOT NULL UNIQUE,
            started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS room_deletion_notices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_public_id TEXT NOT NULL,
            join_token TEXT NOT NULL,
            user_id INTEGER DEFAULT NULL,
            room_name TEXT DEFAULT NULL,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS participants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            display_name TEXT NOT NULL,
            avatar_path TEXT DEFAULT 'preset:Default',
            join_token TEXT NOT NULL UNIQUE,
            position_x REAL NOT NULL DEFAULT 0.15,
            position_y REAL NOT NULL DEFAULT 0.25,
            webcam_path TEXT DEFAULT NULL,
            webcam_enabled INTEGER NOT NULL DEFAULT 0,
            linked_to_participant_id INTEGER DEFAULT NULL,
            last_seen_at TEXT DEFAULT NULL,
            joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(session_id, user_id),
            FOREIGN KEY(session_id) REFERENCES room_sessions(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(linked_to_participant_id) REFERENCES participants(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            participant_id INTEGER,
            user_id INTEGER DEFAULT NULL,
            display_name TEXT DEFAULT NULL,
            avatar_path TEXT DEFAULT NULL,
            avatar_url TEXT DEFAULT NULL,
            content TEXT NOT NULL,
            original_content TEXT DEFAULT NULL,
            url_preview_json TEXT DEFAULT NULL,
            reply_to_json TEXT DEFAULT NULL,
            message_type TEXT NOT NULL DEFAULT 'text',
            file_size INTEGER DEFAULT NULL,
            mime_type TEXT DEFAULT NULL,
            original_name TEXT DEFAULT NULL,
            edited_at TEXT DEFAULT NULL,
            deleted_at TEXT DEFAULT NULL,
            deleted_by_user_id INTEGER DEFAULT NULL,
            is_deleted INTEGER NOT NULL DEFAULT 0,
            sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(session_id) REFERENCES room_sessions(id) ON DELETE CASCADE,
            FOREIGN KEY(participant_id) REFERENCES participants(id) ON DELETE SET NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS message_reactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id INTEGER NOT NULL,
            participant_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            emoji TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(message_id, participant_id),
            FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE,
            FOREIGN KEY(participant_id) REFERENCES participants(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(session_id) REFERENCES room_sessions(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS room_effects (
            session_id INTEGER PRIMARY KEY,
            effect_key TEXT NOT NULL,
            started_by_participant_id INTEGER DEFAULT NULL,
            started_by_user_id INTEGER DEFAULT NULL,
            duration_minutes INTEGER DEFAULT NULL,
            started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at TEXT DEFAULT NULL,
            FOREIGN KEY(session_id) REFERENCES room_sessions(id) ON DELETE CASCADE,
            FOREIGN KEY(started_by_participant_id) REFERENCES participants(id) ON DELETE SET NULL,
            FOREIGN KEY(started_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS game_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_session_id INTEGER NOT NULL,
            game_type TEXT NOT NULL,
            lobby_code TEXT NOT NULL UNIQUE,
            started_by_participant_id INTEGER NOT NULL,
            started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            ended_at TEXT DEFAULT NULL
        );

        CREATE TABLE IF NOT EXISTS game_moves (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lobby_code TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            payload TEXT NOT NULL,
            sequence INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS game_state (
            lobby_code TEXT PRIMARY KEY,
            state_json TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS game_lobbies (
            lobby_code TEXT PRIMARY KEY,
            game_id INTEGER NOT NULL DEFAULT 0,
            user1_id INTEGER DEFAULT NULL,
            user2_id INTEGER DEFAULT NULL,
            status TEXT NOT NULL DEFAULT 'waiting',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS game_chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lobby_code TEXT NOT NULL,
            participant_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            message_type TEXT NOT NULL DEFAULT 'text',
            file_size INTEGER DEFAULT NULL,
            mime_type TEXT DEFAULT NULL,
            original_name TEXT DEFAULT NULL,
            sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS voice_sessions (
            participant_id INTEGER PRIMARY KEY,
            session_id INTEGER NOT NULL,
            muted INTEGER NOT NULL DEFAULT 0,
            deafened INTEGER NOT NULL DEFAULT 0,
            speaking INTEGER NOT NULL DEFAULT 0,
            joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS voice_signals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            from_participant_id INTEGER NOT NULL,
            to_participant_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            data TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS link_icons (
            session_id INTEGER NOT NULL,
            link_key TEXT NOT NULL,
            icon_name TEXT NOT NULL DEFAULT 'plus',
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY(session_id, link_key),
            FOREIGN KEY(session_id) REFERENCES room_sessions(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS link_icon_catalog (
            icon_name TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            file_path TEXT NOT NULL,
            built_in INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS user_blocks (
            blocker_user_id INTEGER NOT NULL,
            blocked_user_id INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY(blocker_user_id, blocked_user_id),
            FOREIGN KEY(blocker_user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(blocked_user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS room_ejections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            ejected_by_user_id INTEGER NOT NULL,
            duration_minutes INTEGER DEFAULT NULL,
            permanent INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at TEXT DEFAULT NULL,
            FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(ejected_by_user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS community_ejections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            ejected_by_user_id INTEGER NOT NULL,
            duration_minutes INTEGER DEFAULT NULL,
            permanent INTEGER NOT NULL DEFAULT 0,
            reason TEXT DEFAULT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at TEXT DEFAULT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(ejected_by_user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS app_settings (
            setting_key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS auth_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scope TEXT NOT NULL,
            dimension TEXT NOT NULL,
            key_hash TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            last_attempt_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            locked_until TEXT DEFAULT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(scope, dimension, key_hash)
        );

        CREATE TABLE IF NOT EXISTS gestures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            public_id TEXT NOT NULL UNIQUE,
            owner_user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            gesture_text TEXT NOT NULL,
            gif_path TEXT NOT NULL,
            audio_path TEXT DEFAULT NULL,
            audio_is_silent INTEGER NOT NULL DEFAULT 1,
            is_public INTEGER NOT NULL DEFAULT 0,
            file_size INTEGER DEFAULT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            deleted_at TEXT DEFAULT NULL,
            FOREIGN KEY(owner_user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS tool_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            actor_user_id INTEGER DEFAULT NULL,
            target_user_id INTEGER DEFAULT NULL,
            room_id INTEGER DEFAULT NULL,
            action TEXT NOT NULL,
            detail TEXT DEFAULT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(target_user_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS community_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scope TEXT NOT NULL,
            session_id INTEGER DEFAULT NULL,
            link_key TEXT DEFAULT NULL,
            participant_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            display_name TEXT NOT NULL,
            avatar_path TEXT DEFAULT NULL,
            avatar_url TEXT DEFAULT NULL,
            content TEXT NOT NULL,
            original_content TEXT DEFAULT NULL,
            url_preview_json TEXT DEFAULT NULL,
            reply_to_json TEXT DEFAULT NULL,
            message_type TEXT NOT NULL DEFAULT 'text',
            file_size INTEGER DEFAULT NULL,
            mime_type TEXT DEFAULT NULL,
            original_name TEXT DEFAULT NULL,
            edited_at TEXT DEFAULT NULL,
            deleted_at TEXT DEFAULT NULL,
            deleted_by_user_id INTEGER DEFAULT NULL,
            is_deleted INTEGER NOT NULL DEFAULT 0,
            sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS community_message_reactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id INTEGER NOT NULL,
            participant_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            emoji TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(message_id, participant_id),
            FOREIGN KEY(message_id) REFERENCES community_messages(id) ON DELETE CASCADE,
            FOREIGN KEY(participant_id) REFERENCES participants(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS private_message_clears (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            scope TEXT NOT NULL,
            session_id INTEGER NOT NULL DEFAULT 0,
            link_key TEXT NOT NULL,
            cleared_at TEXT NOT NULL,
            UNIQUE(user_id, scope, session_id, link_key),
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS community_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scope TEXT NOT NULL,
            session_id INTEGER DEFAULT NULL,
            link_key TEXT DEFAULT NULL,
            type TEXT NOT NULL,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    ";

    if (db_driver($pdo) === 'mysql') {
        $driverSchema = db_uses_mysql_syntax($pdo) ? mysqlize_schema($schema) : $schema;
        foreach (split_sql_statements($driverSchema) as $statement) {
            if ($statement !== '') $pdo->exec($statement);
        }
        try {
            $pdo->exec('ALTER TABLE rooms ADD COLUMN background_thumb_path VARCHAR(512) DEFAULT NULL');
        } catch (Throwable $e) {
            // Existing installs already have this column.
        }
        foreach ([
            'user_id INTEGER DEFAULT NULL',
            'display_name VARCHAR(191) DEFAULT NULL',
            'avatar_path VARCHAR(512) DEFAULT NULL',
            'avatar_url VARCHAR(512) DEFAULT NULL',
            'url_preview_json LONGTEXT DEFAULT NULL',
            'reply_to_json LONGTEXT DEFAULT NULL',
        ] as $definition) {
            try {
                $pdo->exec('ALTER TABLE messages ADD COLUMN ' . $definition);
            } catch (Throwable $e) {
                // Existing installs already have this column.
            }
        }
    } else {
        $pdo->exec($schema);
    }

    if (db_driver($pdo) !== 'sqlite') {
        $mysqlUserCols = $pdo->query('SHOW COLUMNS FROM users')->fetchAll();
        $mysqlUserColNames = array_map(fn(array $col): string => (string)($col['Field'] ?? ''), $mysqlUserCols);
        if (!in_array('recovery_code_hash', $mysqlUserColNames, true)) {
            $pdo->exec('ALTER TABLE users ADD COLUMN recovery_code_hash VARCHAR(255) DEFAULT NULL');
        }
        if (!in_array('recovery_code_suffix', $mysqlUserColNames, true)) {
            $pdo->exec('ALTER TABLE users ADD COLUMN recovery_code_suffix VARCHAR(16) DEFAULT NULL');
        }
        $mysqlParticipantCols = $pdo->query('SHOW COLUMNS FROM participants')->fetchAll();
        $mysqlParticipantColNames = array_map(fn(array $col): string => (string)($col['Field'] ?? ''), $mysqlParticipantCols);
        if (!in_array('webcam_enabled', $mysqlParticipantColNames, true)) {
            $pdo->exec('ALTER TABLE participants ADD COLUMN webcam_enabled INTEGER NOT NULL DEFAULT 0');
        }
        $mysqlVoiceCols = $pdo->query('SHOW COLUMNS FROM voice_sessions')->fetchAll();
        $mysqlVoiceColNames = array_map(fn(array $col): string => (string)($col['Field'] ?? ''), $mysqlVoiceCols);
        foreach (['muted', 'deafened', 'speaking'] as $voiceCol) {
            if (!in_array($voiceCol, $mysqlVoiceColNames, true)) {
                $pdo->exec("ALTER TABLE voice_sessions ADD COLUMN {$voiceCol} INTEGER NOT NULL DEFAULT 0");
            }
        }
        foreach (['messages', 'community_messages'] as $previewTable) {
            $previewCols = $pdo->query('SHOW COLUMNS FROM ' . $previewTable)->fetchAll();
            $previewColNames = array_map(fn(array $col): string => (string)($col['Field'] ?? ''), $previewCols);
            if (!in_array('url_preview_json', $previewColNames, true)) {
                $pdo->exec('ALTER TABLE ' . $previewTable . ' ADD COLUMN url_preview_json LONGTEXT DEFAULT NULL');
            }
            if (!in_array('reply_to_json', $previewColNames, true)) {
                $pdo->exec('ALTER TABLE ' . $previewTable . ' ADD COLUMN reply_to_json LONGTEXT DEFAULT NULL');
            }
        }
        seed_app_settings($pdo);
        seed_link_icon_catalog($pdo);
        return;
    }

    $userCols = $pdo->query('PRAGMA table_info(users)')->fetchAll();
    $userColNames = array_map(fn(array $col): string => (string)$col['name'], $userCols);
    if (!in_array('role', $userColNames, true)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
    }
    if (!in_array('recovery_code_hash', $userColNames, true)) {
        $pdo->exec('ALTER TABLE users ADD COLUMN recovery_code_hash TEXT DEFAULT NULL');
    }
    if (!in_array('recovery_code_suffix', $userColNames, true)) {
        $pdo->exec('ALTER TABLE users ADD COLUMN recovery_code_suffix TEXT DEFAULT NULL');
    }
    $settingsCols = $pdo->query('PRAGMA table_info(app_settings)')->fetchAll();
    $settingsColNames = array_map(fn(array $col): string => (string)$col['name'], $settingsCols);
    if (in_array('key', $settingsColNames, true) && !in_array('setting_key', $settingsColNames, true)) {
        $pdo->exec('ALTER TABLE app_settings RENAME COLUMN key TO setting_key');
    }
    seed_app_settings($pdo);
    seed_link_icon_catalog($pdo);

    $cols = $pdo->query('PRAGMA table_info(rooms)')->fetchAll();
    $hasPublicId = false;
    foreach ($cols as $col) {
        if (($col['name'] ?? '') === 'public_id') $hasPublicId = true;
    }
    if (!$hasPublicId) {
        $pdo->exec('ALTER TABLE rooms ADD COLUMN public_id TEXT DEFAULT NULL');
        $pdo->exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_public_id ON rooms(public_id)');
    }
    $roomColNames = array_map(fn(array $col): string => (string)$col['name'], $cols);
    if (!in_array('background_thumb_path', $roomColNames, true)) {
        $pdo->exec('ALTER TABLE rooms ADD COLUMN background_thumb_path TEXT DEFAULT NULL');
    }
    $sessionCols = $pdo->query('PRAGMA table_info(room_sessions)')->fetchAll();
    $hasSessionPublicId = false;
    foreach ($sessionCols as $col) {
        if (($col['name'] ?? '') === 'public_id') $hasSessionPublicId = true;
    }
    if (!$hasSessionPublicId) {
        $pdo->exec('ALTER TABLE room_sessions ADD COLUMN public_id TEXT DEFAULT NULL');
        $pdo->exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_room_sessions_public_id ON room_sessions(public_id)');
    }
    $participantCols = $pdo->query('PRAGMA table_info(participants)')->fetchAll();
    $participantColNames = array_map(fn(array $col): string => (string)$col['name'], $participantCols);
    $hasLinkedTo = false;
    foreach ($participantCols as $col) {
        if (($col['name'] ?? '') === 'linked_to_participant_id') $hasLinkedTo = true;
    }
    if (!in_array('webcam_enabled', $participantColNames, true)) {
        $pdo->exec('ALTER TABLE participants ADD COLUMN webcam_enabled INTEGER NOT NULL DEFAULT 0');
    }
    if (!$hasLinkedTo) {
        $pdo->exec('ALTER TABLE participants ADD COLUMN linked_to_participant_id INTEGER DEFAULT NULL');
    }
    $voiceCols = $pdo->query('PRAGMA table_info(voice_sessions)')->fetchAll();
    $voiceColNames = array_map(fn(array $col): string => (string)$col['name'], $voiceCols);
    foreach (['muted', 'deafened', 'speaking'] as $voiceCol) {
        if (!in_array($voiceCol, $voiceColNames, true)) {
            $pdo->exec("ALTER TABLE voice_sessions ADD COLUMN {$voiceCol} INTEGER NOT NULL DEFAULT 0");
        }
    }
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS room_effects (
            session_id INTEGER PRIMARY KEY,
            effect_key TEXT NOT NULL,
            started_by_participant_id INTEGER DEFAULT NULL,
            started_by_user_id INTEGER DEFAULT NULL,
            duration_minutes INTEGER DEFAULT NULL,
            started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at TEXT DEFAULT NULL,
            FOREIGN KEY(session_id) REFERENCES room_sessions(id) ON DELETE CASCADE,
            FOREIGN KEY(started_by_participant_id) REFERENCES participants(id) ON DELETE SET NULL,
            FOREIGN KEY(started_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        )"
    );
    $messageCols = $pdo->query('PRAGMA table_info(messages)')->fetchAll();
    $messageColNames = array_map(fn(array $col): string => (string)$col['name'], $messageCols);
    if (!in_array('message_type', $messageColNames, true)) {
        $pdo->exec("ALTER TABLE messages ADD COLUMN message_type TEXT NOT NULL DEFAULT 'text'");
    }
    if (!in_array('user_id', $messageColNames, true)) {
        $pdo->exec('ALTER TABLE messages ADD COLUMN user_id INTEGER DEFAULT NULL');
    }
    if (!in_array('display_name', $messageColNames, true)) {
        $pdo->exec('ALTER TABLE messages ADD COLUMN display_name TEXT DEFAULT NULL');
    }
    if (!in_array('avatar_path', $messageColNames, true)) {
        $pdo->exec('ALTER TABLE messages ADD COLUMN avatar_path TEXT DEFAULT NULL');
    }
    if (!in_array('avatar_url', $messageColNames, true)) {
        $pdo->exec('ALTER TABLE messages ADD COLUMN avatar_url TEXT DEFAULT NULL');
    }
    if (!in_array('original_content', $messageColNames, true)) {
        $pdo->exec('ALTER TABLE messages ADD COLUMN original_content TEXT DEFAULT NULL');
    }
    if (!in_array('url_preview_json', $messageColNames, true)) {
        $pdo->exec('ALTER TABLE messages ADD COLUMN url_preview_json TEXT DEFAULT NULL');
    }
    if (!in_array('reply_to_json', $messageColNames, true)) {
        $pdo->exec('ALTER TABLE messages ADD COLUMN reply_to_json TEXT DEFAULT NULL');
    }
    if (!in_array('file_size', $messageColNames, true)) {
        $pdo->exec('ALTER TABLE messages ADD COLUMN file_size INTEGER DEFAULT NULL');
    }
    if (!in_array('mime_type', $messageColNames, true)) {
        $pdo->exec('ALTER TABLE messages ADD COLUMN mime_type TEXT DEFAULT NULL');
    }
    if (!in_array('original_name', $messageColNames, true)) {
        $pdo->exec('ALTER TABLE messages ADD COLUMN original_name TEXT DEFAULT NULL');
    }
    if (!in_array('edited_at', $messageColNames, true)) {
        $pdo->exec('ALTER TABLE messages ADD COLUMN edited_at TEXT DEFAULT NULL');
    }
    if (!in_array('deleted_at', $messageColNames, true)) {
        $pdo->exec('ALTER TABLE messages ADD COLUMN deleted_at TEXT DEFAULT NULL');
    }
    if (!in_array('deleted_by_user_id', $messageColNames, true)) {
        $pdo->exec('ALTER TABLE messages ADD COLUMN deleted_by_user_id INTEGER DEFAULT NULL');
    }
    if (!in_array('is_deleted', $messageColNames, true)) {
        $pdo->exec('ALTER TABLE messages ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0');
    }
    $communityMessageCols = $pdo->query('PRAGMA table_info(community_messages)')->fetchAll();
    $communityMessageColNames = array_map(fn(array $col): string => (string)$col['name'], $communityMessageCols);
    if (!in_array('original_content', $communityMessageColNames, true)) {
        $pdo->exec('ALTER TABLE community_messages ADD COLUMN original_content TEXT DEFAULT NULL');
    }
    if (!in_array('url_preview_json', $communityMessageColNames, true)) {
        $pdo->exec('ALTER TABLE community_messages ADD COLUMN url_preview_json TEXT DEFAULT NULL');
    }
    if (!in_array('reply_to_json', $communityMessageColNames, true)) {
        $pdo->exec('ALTER TABLE community_messages ADD COLUMN reply_to_json TEXT DEFAULT NULL');
    }
    if (!in_array('message_type', $communityMessageColNames, true)) {
        $pdo->exec("ALTER TABLE community_messages ADD COLUMN message_type TEXT NOT NULL DEFAULT 'text'");
    }
    if (!in_array('file_size', $communityMessageColNames, true)) {
        $pdo->exec('ALTER TABLE community_messages ADD COLUMN file_size INTEGER DEFAULT NULL');
    }
    if (!in_array('mime_type', $communityMessageColNames, true)) {
        $pdo->exec('ALTER TABLE community_messages ADD COLUMN mime_type TEXT DEFAULT NULL');
    }
    if (!in_array('original_name', $communityMessageColNames, true)) {
        $pdo->exec('ALTER TABLE community_messages ADD COLUMN original_name TEXT DEFAULT NULL');
    }
    if (!in_array('edited_at', $communityMessageColNames, true)) {
        $pdo->exec('ALTER TABLE community_messages ADD COLUMN edited_at TEXT DEFAULT NULL');
    }
    if (!in_array('deleted_at', $communityMessageColNames, true)) {
        $pdo->exec('ALTER TABLE community_messages ADD COLUMN deleted_at TEXT DEFAULT NULL');
    }
    if (!in_array('deleted_by_user_id', $communityMessageColNames, true)) {
        $pdo->exec('ALTER TABLE community_messages ADD COLUMN deleted_by_user_id INTEGER DEFAULT NULL');
    }
    if (!in_array('is_deleted', $communityMessageColNames, true)) {
        $pdo->exec('ALTER TABLE community_messages ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0');
    }
    $gameChatCols = $pdo->query('PRAGMA table_info(game_chat_messages)')->fetchAll();
    $gameChatColNames = array_map(fn(array $col): string => (string)$col['name'], $gameChatCols);
    if (!in_array('message_type', $gameChatColNames, true)) {
        $pdo->exec("ALTER TABLE game_chat_messages ADD COLUMN message_type TEXT NOT NULL DEFAULT 'text'");
    }
    if (!in_array('file_size', $gameChatColNames, true)) {
        $pdo->exec('ALTER TABLE game_chat_messages ADD COLUMN file_size INTEGER DEFAULT NULL');
    }
    if (!in_array('mime_type', $gameChatColNames, true)) {
        $pdo->exec('ALTER TABLE game_chat_messages ADD COLUMN mime_type TEXT DEFAULT NULL');
    }
    if (!in_array('original_name', $gameChatColNames, true)) {
        $pdo->exec('ALTER TABLE game_chat_messages ADD COLUMN original_name TEXT DEFAULT NULL');
    }
    $stmt = $pdo->query('SELECT id FROM rooms WHERE public_id IS NULL OR public_id = ""');
    foreach ($stmt->fetchAll() as $row) {
        $update = $pdo->prepare('UPDATE rooms SET public_id = ? WHERE id = ?');
        $update->execute([uuid_v4(), (int)$row['id']]);
    }
    $stmt = $pdo->query('SELECT id FROM room_sessions WHERE public_id IS NULL OR public_id = ""');
    foreach ($stmt->fetchAll() as $row) {
        $update = $pdo->prepare('UPDATE room_sessions SET public_id = ? WHERE id = ?');
        $update->execute([uuid_v4(), (int)$row['id']]);
    }
}

function default_link_icons(): array {
    return [
        'plus' => 'Plus',
        'heart' => 'Heart',
        'wedding-rings' => 'Wedding Rings',
        'wedding-rings-lesbian' => 'Wedding Rings Lesbian',
        'wedding-rings-gay' => 'Wedding Rings Gay',
        'help' => 'Help',
        'archer' => 'Archer',
        'cross-swords' => 'Cross Swords',
        'lips' => 'Lips',
        'lotus' => 'Lotus',
        'handcuffs' => 'Handcuffs',
    ];
}

function seed_link_icon_catalog(PDO $pdo): void {
    $stmt = $pdo->prepare(db_uses_mysql_syntax($pdo)
        ? 'INSERT IGNORE INTO link_icon_catalog (icon_name, label, file_path, built_in) VALUES (?,?,?,1)'
        : 'INSERT OR IGNORE INTO link_icon_catalog (icon_name, label, file_path, built_in) VALUES (?,?,?,1)'
    );
    foreach (default_link_icons() as $name => $label) {
        $stmt->execute([$name, $label, '/assets/images/cs-icons/' . $name . '.png']);
    }
}

function link_icon_catalog(PDO $pdo): array {
    seed_link_icon_catalog($pdo);
    $rows = $pdo->query('SELECT icon_name, label, file_path, built_in, created_at, updated_at FROM link_icon_catalog ORDER BY built_in DESC, label ASC')->fetchAll();
    return array_map(fn(array $row): array => [
        'icon_name' => $row['icon_name'],
        'label' => $row['label'],
        'file_path' => $row['file_path'],
        'built_in' => !empty($row['built_in']),
        'created_at' => $row['created_at'] ?? null,
        'updated_at' => $row['updated_at'] ?? null,
    ], $rows);
}

function allowed_link_icon_names(PDO $pdo): array {
    return array_merge(['none'], array_map(fn(array $row): string => (string)$row['icon_name'], link_icon_catalog($pdo)));
}

function upsert_link_icon_catalog(PDO $pdo, string $iconName, string $label, string $filePath, bool $builtIn = false): void {
    $stmt = $pdo->prepare(db_uses_mysql_syntax($pdo)
        ? 'INSERT INTO link_icon_catalog (icon_name, label, file_path, built_in, updated_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE label = VALUES(label), file_path = VALUES(file_path), built_in = VALUES(built_in), updated_at = CURRENT_TIMESTAMP'
        : 'INSERT INTO link_icon_catalog (icon_name, label, file_path, built_in, updated_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(icon_name) DO UPDATE SET label = excluded.label, file_path = excluded.file_path, built_in = excluded.built_in, updated_at = CURRENT_TIMESTAMP'
    );
    $stmt->execute([$iconName, $label, $filePath, $builtIn ? 1 : 0]);
}

function seed_app_settings(PDO $pdo): void {
    $defaults = [
        'chat_posts_per_second' => '3',
        'room_chat_history_limit' => '100',
        'avatar_movements_per_second' => '12',
        'avatar_max_size_mb' => '5',
        'gesture_upload_limit' => '50',
        'room_image_max_size_mb' => '10',
        'room_video_max_size_mb' => '200',
        'participant_idle_timeout_minutes' => '2',
        'auth_login_max_attempts' => '5',
        'auth_recovery_max_attempts' => '5',
        'auth_ip_max_attempts' => '30',
        'auth_attempt_window_minutes' => '15',
        'auth_lockout_minutes' => '15',
        'gif_giphy_api_key' => '',
        'gif_tenor_api_key' => '',
        'gif_default_provider' => 'giphy',
        'age_gate_enabled' => '0',
        'age_gate_min_age' => '13',
        'community_name' => '',
        'community_logo_path' => '',
    ];
    $stmt = $pdo->prepare(db_uses_mysql_syntax($pdo)
        ? 'INSERT IGNORE INTO app_settings (setting_key, value) VALUES (?,?)'
        : 'INSERT OR IGNORE INTO app_settings (setting_key, value) VALUES (?,?)'
    );
    foreach ($defaults as $key => $value) {
        $stmt->execute([$key, $value]);
    }
}

function app_setting(PDO $pdo, string $key, string $default = ''): string {
    $stmt = $pdo->prepare('SELECT value FROM app_settings WHERE setting_key = ? LIMIT 1');
    $stmt->execute([$key]);
    $value = $stmt->fetchColumn();
    return $value === false ? $default : (string)$value;
}

function app_setting_float(PDO $pdo, string $key, float $default): float {
    $value = (float)app_setting($pdo, $key, (string)$default);
    return $value > 0 ? $value : $default;
}

function app_setting_bytes(PDO $pdo, string $key, float $defaultMb): int {
    return (int)round(app_setting_float($pdo, $key, $defaultMb) * 1024 * 1024);
}

function set_app_setting(PDO $pdo, string $key, string $value): void {
    $stmt = $pdo->prepare(db_uses_mysql_syntax($pdo)
        ? 'INSERT INTO app_settings (setting_key, value) VALUES (?,?) ON DUPLICATE KEY UPDATE value = VALUES(value)'
        : 'INSERT INTO app_settings (setting_key, value) VALUES (?,?) ON CONFLICT(setting_key) DO UPDATE SET value = excluded.value'
    );
    $stmt->execute([$key, $value]);
}

function client_ip_address(): string {
    return trim((string)($_SERVER['REMOTE_ADDR'] ?? 'unknown')) ?: 'unknown';
}

function auth_rate_seconds(int $seconds): string {
    $seconds = max(1, $seconds);
    if ($seconds < 60) return $seconds . ' second' . ($seconds === 1 ? '' : 's');
    $minutes = (int)ceil($seconds / 60);
    if ($minutes < 60) return $minutes . ' minute' . ($minutes === 1 ? '' : 's');
    $hours = (int)ceil($minutes / 60);
    return $hours . ' hour' . ($hours === 1 ? '' : 's');
}

function auth_rate_scope_max(PDO $pdo, string $scope): int {
    $key = $scope === 'recovery' ? 'auth_recovery_max_attempts' : 'auth_login_max_attempts';
    return max(1, (int)app_setting_float($pdo, $key, $scope === 'recovery' ? 5 : 5));
}

function auth_rate_ip_max(PDO $pdo): int {
    return max(1, (int)app_setting_float($pdo, 'auth_ip_max_attempts', 30));
}

function auth_rate_window_minutes(PDO $pdo): float {
    return max(1.0, app_setting_float($pdo, 'auth_attempt_window_minutes', 15));
}

function auth_rate_lockout_minutes(PDO $pdo): float {
    return max(1.0, app_setting_float($pdo, 'auth_lockout_minutes', 15));
}

function auth_rate_key_hash(string $scope, string $dimension, string $value): string {
    $normalized = strtolower(trim($scope)) . "\n" . strtolower(trim($dimension)) . "\n" . strtolower(trim($value));
    return hash('sha256', $normalized);
}

function auth_rate_keys(string $scope, string $identifier): array {
    $identifier = trim($identifier) !== '' ? trim($identifier) : '(blank)';
    return [
        ['dimension' => 'identifier', 'hash' => auth_rate_key_hash($scope, 'identifier', $identifier)],
        ['dimension' => 'ip', 'hash' => auth_rate_key_hash($scope, 'ip', client_ip_address())],
    ];
}

function auth_rate_cleanup(PDO $pdo): void {
    $windowMinutes = auth_rate_window_minutes($pdo);
    $cutoff = gmdate('Y-m-d H:i:s', time() - (int)ceil($windowMinutes * 60));
    $now = gmdate('Y-m-d H:i:s');
    $stmt = $pdo->prepare('DELETE FROM auth_attempts WHERE last_attempt_at < ? AND (locked_until IS NULL OR locked_until < ?)');
    $stmt->execute([$cutoff, $now]);
}

function auth_rate_limit_status(PDO $pdo, string $scope, string $identifier): array {
    auth_rate_cleanup($pdo);
    $now = time();
    $blockedUntil = 0;
    $stmt = $pdo->prepare('SELECT dimension, locked_until FROM auth_attempts WHERE scope = ? AND dimension = ? AND key_hash = ? LIMIT 1');
    foreach (auth_rate_keys($scope, $identifier) as $key) {
        $stmt->execute([$scope, $key['dimension'], $key['hash']]);
        $row = $stmt->fetch();
        if (!$row || empty($row['locked_until'])) continue;
        $until = strtotime((string)$row['locked_until']) ?: 0;
        if ($until > $blockedUntil) $blockedUntil = $until;
    }
    if ($blockedUntil > $now) {
        return [
            'allowed' => false,
            'retry_after' => $blockedUntil - $now,
            'message' => 'Too many attempts. Try again in ' . auth_rate_seconds($blockedUntil - $now) . '.',
        ];
    }
    return ['allowed' => true, 'retry_after' => 0, 'message' => ''];
}

function auth_rate_record_failure(PDO $pdo, string $scope, string $identifier): void {
    $now = gmdate('Y-m-d H:i:s');
    $windowCutoff = gmdate('Y-m-d H:i:s', time() - (int)ceil(auth_rate_window_minutes($pdo) * 60));
    $lockedUntil = gmdate('Y-m-d H:i:s', time() + (int)ceil(auth_rate_lockout_minutes($pdo) * 60));
    $select = $pdo->prepare('SELECT attempts, last_attempt_at FROM auth_attempts WHERE scope = ? AND dimension = ? AND key_hash = ? LIMIT 1');
    $write = $pdo->prepare(db_uses_mysql_syntax($pdo)
        ? 'INSERT INTO auth_attempts (scope, dimension, key_hash, attempts, last_attempt_at, locked_until) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE attempts = VALUES(attempts), last_attempt_at = VALUES(last_attempt_at), locked_until = VALUES(locked_until)'
        : 'INSERT INTO auth_attempts (scope, dimension, key_hash, attempts, last_attempt_at, locked_until) VALUES (?,?,?,?,?,?) ON CONFLICT(scope, dimension, key_hash) DO UPDATE SET attempts = excluded.attempts, last_attempt_at = excluded.last_attempt_at, locked_until = excluded.locked_until'
    );
    foreach (auth_rate_keys($scope, $identifier) as $key) {
        $select->execute([$scope, $key['dimension'], $key['hash']]);
        $row = $select->fetch();
        $attempts = 1;
        if ($row && (string)($row['last_attempt_at'] ?? '') >= $windowCutoff) {
            $attempts = ((int)$row['attempts']) + 1;
        }
        $max = $key['dimension'] === 'ip' ? auth_rate_ip_max($pdo) : auth_rate_scope_max($pdo, $scope);
        $lock = $attempts >= $max ? $lockedUntil : null;
        $write->execute([$scope, $key['dimension'], $key['hash'], $attempts, $now, $lock]);
    }
}

function auth_rate_clear_identifier(PDO $pdo, string $scope, string $identifier): void {
    $hash = auth_rate_key_hash($scope, 'identifier', trim($identifier) !== '' ? trim($identifier) : '(blank)');
    $stmt = $pdo->prepare("DELETE FROM auth_attempts WHERE scope = ? AND dimension = 'identifier' AND key_hash = ?");
    $stmt->execute([$scope, $hash]);
}

function install_branding(?PDO $pdo = null): array {
    $defaults = [
        'community_name' => '',
        'logo_path' => '/assets/images/logos/chatspace-ce-full-logo.png',
        'powered_logo_path' => '/assets/images/logos/chatspace-ce-full-logo.png',
        'has_custom_logo' => false,
    ];
    if (!chatspace_configured()) return $defaults;
    try {
        $pdo = $pdo ?: db();
        $name = trim(app_setting($pdo, 'community_name', ''));
        $logo = trim(app_setting($pdo, 'community_logo_path', ''));
        return [
            'community_name' => $name,
            'logo_path' => $logo !== '' ? $logo : $defaults['logo_path'],
            'powered_logo_path' => $defaults['powered_logo_path'],
            'has_custom_logo' => $logo !== '',
        ];
    } catch (Throwable) {
        return $defaults;
    }
}

function branded_page_title(string $page, ?PDO $pdo = null): string {
    $brand = install_branding($pdo);
    $prefix = $brand['community_name'] !== '' ? $brand['community_name'] . ' - ' : '';
    return $prefix . $page . ' - ChatSpace CE';
}

function gesture_snapshot(array $gesture): array {
    return [
        'id' => (int)$gesture['id'],
        'public_id' => $gesture['public_id'],
        'name' => $gesture['name'],
        'text' => $gesture['gesture_text'],
        'gif_path' => $gesture['gif_path'],
        'audio_path' => $gesture['audio_path'] ?? null,
        'audio_is_silent' => !empty($gesture['audio_is_silent']),
        'is_public' => !empty($gesture['is_public']),
        'owner_user_id' => (int)$gesture['owner_user_id'],
    ];
}

function message_gesture(?string $content): ?array {
    if (!$content) return null;
    $decoded = json_decode($content, true);
    return is_array($decoded) ? $decoded : null;
}

function message_url_preview(?string $content): ?array {
    if (!$content) return null;
    $decoded = json_decode($content, true);
    return is_array($decoded) ? $decoded : null;
}

function first_url_in_text(string $text): ?string {
    if (!preg_match('~https?://[^\s<>"\']+~i', $text, $m)) return null;
    return rtrim($m[0], ".,!?)]}");
}

function preview_host_is_safe(string $host): bool {
    $host = strtolower(trim($host, "[] \t\r\n"));
    if ($host === '' || $host === 'localhost' || str_ends_with($host, '.localhost') || str_ends_with($host, '.local')) {
        return false;
    }
    $ips = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : (gethostbynamel($host) ?: []);
    if (!$ips) return false;
    foreach ($ips as $ip) {
        if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            return false;
        }
    }
    return true;
}

function host_matches_domain(string $host, string $domain): bool {
    $host = strtolower($host);
    $domain = strtolower($domain);
    return $host === $domain || str_ends_with($host, '.' . $domain);
}

function youtube_embed_url(array $parts): ?string {
    $host = strtolower((string)($parts['host'] ?? ''));
    $path = trim((string)($parts['path'] ?? ''), '/');
    parse_str((string)($parts['query'] ?? ''), $query);
    $id = '';
    if (host_matches_domain($host, 'youtu.be')) {
        $id = explode('/', $path)[0] ?? '';
    } elseif (($query['v'] ?? '') !== '') {
        $id = (string)$query['v'];
    } elseif (preg_match('~(?:embed|shorts)/([A-Za-z0-9_-]{6,})~', $path, $m)) {
        $id = $m[1];
    }
    return preg_match('/^[A-Za-z0-9_-]{6,}$/', $id) ? 'https://www.youtube-nocookie.com/embed/' . rawurlencode($id) : null;
}

function spotify_embed_url(array $parts): ?string {
    $host = strtolower((string)($parts['host'] ?? ''));
    if (!host_matches_domain($host, 'spotify.com')) return null;
    $segments = array_values(array_filter(explode('/', trim((string)($parts['path'] ?? ''), '/'))));
    $allowed = ['album', 'artist', 'episode', 'playlist', 'show', 'track'];
    $type = $segments[0] ?? '';
    $id = $segments[1] ?? '';
    if (!in_array($type, $allowed, true) || !preg_match('/^[A-Za-z0-9]+$/', $id)) return null;
    return 'https://open.spotify.com/embed/' . rawurlencode($type) . '/' . rawurlencode($id);
}

function soundcloud_embed_url(string $url, array $parts): ?string {
    $host = strtolower((string)($parts['host'] ?? ''));
    if (!host_matches_domain($host, 'soundcloud.com')) return null;
    return 'https://w.soundcloud.com/player/?url=' . rawurlencode($url) . '&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&visual=false';
}

function html_meta_value(string $html, string $name): ?string {
    $quoted = preg_quote($name, '~');
    $patterns = [
        '~<meta[^>]+(?:property|name)=["\']' . $quoted . '["\'][^>]+content=["\']([^"\']+)["\'][^>]*>~i',
        '~<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']' . $quoted . '["\'][^>]*>~i',
    ];
    foreach ($patterns as $pattern) {
        if (preg_match($pattern, $html, $m)) {
            return trim(html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        }
    }
    return null;
}

function absolutize_preview_url(string $assetUrl, string $pageUrl): string {
    if ($assetUrl === '' || preg_match('#^https?://#i', $assetUrl)) return $assetUrl;
    $parts = parse_url($pageUrl);
    if (!$parts || empty($parts['scheme']) || empty($parts['host'])) return '';
    $base = $parts['scheme'] . '://' . $parts['host'] . (!empty($parts['port']) ? ':' . $parts['port'] : '');
    if (str_starts_with($assetUrl, '//')) return $parts['scheme'] . ':' . $assetUrl;
    if (str_starts_with($assetUrl, '/')) return $base . $assetUrl;
    $dir = rtrim(dirname((string)($parts['path'] ?? '/')), '/');
    return $base . ($dir ? $dir . '/' : '/') . $assetUrl;
}

function fetch_url_metadata(string $url): array {
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 2.5,
            'follow_location' => 1,
            'max_redirects' => 3,
            'ignore_errors' => true,
            'header' => "User-Agent: ChatSpaceCE-LinkPreview/1.0\r\nAccept: text/html,application/xhtml+xml\r\n",
        ],
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
        ],
    ]);
    $handle = @fopen($url, 'rb', false, $context);
    if (!$handle) return [];
    $html = stream_get_contents($handle, 131072);
    fclose($handle);
    if (!is_string($html) || $html === '') return [];
    $title = html_meta_value($html, 'og:title') ?: html_meta_value($html, 'twitter:title');
    if (!$title && preg_match('~<title[^>]*>(.*?)</title>~is', $html, $m)) {
        $title = trim(html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    }
    $description = html_meta_value($html, 'og:description') ?: html_meta_value($html, 'description') ?: html_meta_value($html, 'twitter:description');
    $image = html_meta_value($html, 'og:image') ?: html_meta_value($html, 'twitter:image');
    if ($image) $image = absolutize_preview_url($image, $url);
    return [
        'title' => $title ? (function_exists('mb_substr') ? mb_substr($title, 0, 140, 'UTF-8') : substr($title, 0, 140)) : '',
        'description' => $description ? (function_exists('mb_substr') ? mb_substr($description, 0, 220, 'UTF-8') : substr($description, 0, 220)) : '',
        'image_url' => $image ?: '',
    ];
}

function url_preview_for_text(string $text): ?array {
    $url = first_url_in_text($text);
    if (!$url) return null;
    $parts = parse_url($url);
    if (!$parts || !in_array(strtolower((string)($parts['scheme'] ?? '')), ['http', 'https'], true) || empty($parts['host'])) {
        return null;
    }
    $host = strtolower((string)$parts['host']);
    $provider = '';
    $embedUrl = null;
    if (host_matches_domain($host, 'youtube.com') || host_matches_domain($host, 'youtu.be')) {
        $provider = 'YouTube';
        $embedUrl = youtube_embed_url($parts);
    } elseif (host_matches_domain($host, 'spotify.com')) {
        $provider = 'Spotify';
        $embedUrl = spotify_embed_url($parts);
    } elseif (host_matches_domain($host, 'soundcloud.com')) {
        $provider = 'SoundCloud';
        $embedUrl = soundcloud_embed_url($url, $parts);
    }
    if ($embedUrl === null && !preview_host_is_safe($host)) return null;

    $meta = preview_host_is_safe($host) ? fetch_url_metadata($url) : [];
    $preview = [
        'url' => $url,
        'host' => preg_replace('/^www\./', '', $host),
        'provider' => $provider,
        'type' => $embedUrl ? 'player' : 'summary',
        'embed_url' => $embedUrl ?: '',
        'title' => $meta['title'] ?? '',
        'description' => $meta['description'] ?? '',
        'image_url' => $meta['image_url'] ?? '',
    ];
    if ($preview['type'] === 'summary' && $preview['title'] === '' && $preview['description'] === '' && $preview['image_url'] === '') {
        return null;
    }
    return $preview;
}

function save_room_background_upload(array $upload, ?array $thumbUpload = null): array {
    if (empty($upload['tmp_name']) || !is_uploaded_file($upload['tmp_name'])) {
        return ['path' => null, 'mime' => null, 'thumb_path' => null];
    }
    $pdo = db();
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($upload['tmp_name']) ?: '';
    $allowed = ['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'];
    if (!in_array($mime, $allowed, true)) {
        throw new RuntimeException('Unsupported background type');
    }
    $isVideo = str_starts_with($mime, 'video/');
    $maxBytes = $isVideo ? app_setting_bytes($pdo, 'room_video_max_size_mb', 200) : app_setting_bytes($pdo, 'room_image_max_size_mb', 10);
    if ((int)($upload['size'] ?? 0) > $maxBytes) {
        throw new RuntimeException('Background file is too large');
    }
    $ext = match ($mime) {
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
        'video/mp4' => 'mp4',
        'video/webm' => 'webm',
        default => 'jpg',
    };
    $dir = __DIR__ . '/../assets/uploads/backgrounds';
    if (!is_dir($dir)) mkdir($dir, 0775, true);
    $base = bin2hex(random_bytes(12));
    $file = $base . '.' . $ext;
    $dest = $dir . '/' . $file;
    if (!move_uploaded_file($upload['tmp_name'], $dest)) {
        throw new RuntimeException('Could not save background');
    }
    $path = '/assets/uploads/backgrounds/' . $file;
    $thumbPath = null;
    if ($isVideo && $thumbUpload && !empty($thumbUpload['tmp_name']) && is_uploaded_file($thumbUpload['tmp_name'])) {
        $thumbInfo = new finfo(FILEINFO_MIME_TYPE);
        $thumbMime = $thumbInfo->file($thumbUpload['tmp_name']) ?: '';
        if (in_array($thumbMime, ['image/jpeg', 'image/png', 'image/webp'], true) && (int)($thumbUpload['size'] ?? 0) <= 2 * 1024 * 1024) {
            $thumbFile = $base . '-thumb.jpg';
            $thumbDest = $dir . '/' . $thumbFile;
            if (move_uploaded_file($thumbUpload['tmp_name'], $thumbDest)) {
                $thumbPath = '/assets/uploads/backgrounds/' . $thumbFile;
            }
        }
    }
    if ($isVideo && !$thumbPath && function_exists('shell_exec')) {
        $thumbFile = $base . '-thumb.jpg';
        $thumbDest = $dir . '/' . $thumbFile;
        $cmd = 'ffmpeg -y -i ' . escapeshellarg($dest) . ' -ss 00:00:01 -frames:v 1 -vf ' . escapeshellarg('scale=720:-1') . ' ' . escapeshellarg($thumbDest) . ' 2>/dev/null';
        @shell_exec($cmd);
        if (is_file($thumbDest) && filesize($thumbDest) > 0) {
            $thumbPath = '/assets/uploads/backgrounds/' . $thumbFile;
        }
    }
    return ['path' => $path, 'mime' => $mime, 'thumb_path' => $thumbPath];
}

function log_tool(PDO $pdo, ?int $actorUserId, string $action, ?int $targetUserId = null, ?int $roomId = null, ?string $detail = null): void {
    $stmt = $pdo->prepare('INSERT INTO tool_logs (actor_user_id, target_user_id, room_id, action, detail) VALUES (?,?,?,?,?)');
    $stmt->execute([$actorUserId, $targetUserId, $roomId, $action, $detail]);
}

function uuid_v4(): string {
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function current_user(): ?array {
    if (empty($_SESSION['user_id'])) return null;
    $stmt = db()->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([(int)$_SESSION['user_id']]);
    return $stmt->fetch() ?: null;
}

function authenticate_user(int $userId): void {
    session_regenerate_id(true);
    $_SESSION['user_id'] = $userId;
    unset($_SESSION['_csrf_token']);
}

function require_user(): array {
    $user = current_user();
    if (!$user) {
        redirect_to('/login.php');
    }
    return $user;
}

function json_out(array $data, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data, JSON_UNESCAPED_SLASHES);
    exit;
}

function request_raw_body(): string {
    static $raw = null;
    if ($raw !== null) return $raw;
    $body = file_get_contents('php://input');
    $raw = is_string($body) ? $body : '';
    return $raw;
}

function input_json(): array {
    $raw = request_raw_body();
    if ($raw !== false && trim($raw) !== '') {
        $data = json_decode($raw, true);
        if (is_array($data)) return $data;
    }
    return $_POST;
}

function csrf_token(): string {
    if (empty($_SESSION['_csrf_token']) || !is_string($_SESSION['_csrf_token'])) {
        $_SESSION['_csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['_csrf_token'];
}

function csrf_request_token(?array $jsonBody = null): string {
    $header = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if ($header !== '') return $header;
    $posted = (string)($_POST['_csrf'] ?? '');
    if ($posted !== '') return $posted;
    if ($jsonBody === null) {
        $raw = request_raw_body();
        $decoded = trim($raw) !== '' ? json_decode($raw, true) : null;
        $jsonBody = is_array($decoded) ? $decoded : [];
    }
    return (string)($jsonBody['_csrf'] ?? '');
}

function csrf_verify(?array $jsonBody = null): bool {
    $token = csrf_request_token($jsonBody);
    return $token !== '' && hash_equals(csrf_token(), $token);
}

function csrf_failure_response(): never {
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '';
    $accept = strtolower((string)($_SERVER['HTTP_ACCEPT'] ?? ''));
    $contentType = strtolower((string)($_SERVER['CONTENT_TYPE'] ?? ''));
    if (str_contains($path, '/api/') || str_contains($path, '/games/api/') || str_contains($accept, 'application/json') || str_contains($contentType, 'application/json')) {
        json_out(['error' => 'Invalid or missing CSRF token. Refresh and try again.'], 419);
    }
    http_response_code(419);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Invalid or missing CSRF token. Refresh and try again.';
    exit;
}

function csrf_protect_post(): void {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') return;
    if (PHP_SAPI === 'cli') return;
    if (!csrf_verify()) csrf_failure_response();
}

function csrf_input(): string {
    return '<input type="hidden" name="_csrf" value="' . e(csrf_token()) . '">';
}

csrf_protect_post();

function emit_event(PDO $pdo, int $sessionId, string $type, array $payload): void {
    $stmt = $pdo->prepare('INSERT INTO events (session_id, type, payload) VALUES (?,?,?)');
    $stmt->execute([$sessionId, $type, json_encode($payload, JSON_UNESCAPED_SLASHES)]);
}

function emit_community_event(PDO $pdo, string $scope, ?int $sessionId, ?string $linkKey, string $type, array $payload): void {
    $stmt = $pdo->prepare('INSERT INTO community_events (scope, session_id, link_key, type, payload) VALUES (?,?,?,?,?)');
    $stmt->execute([$scope, $sessionId, $linkKey, $type, json_encode($payload, JSON_UNESCAPED_SLASHES)]);
}

function room_effect_catalog(): array {
    $dir = __DIR__ . '/../assets/room-effects';
    $catalog = [];
    if (!is_dir($dir)) return $catalog;
    foreach (glob($dir . '/*.js') ?: [] as $path) {
        $file = basename($path);
        $source = (string)file_get_contents($path, false, null, 0, 4096);
        $key = preg_match('/^\s*\/\/\s*@effect-key\s+([a-z0-9_-]+)/mi', $source, $m)
            ? $m[1]
            : preg_replace('/[^a-z0-9_-]+/', '_', strtolower(pathinfo($file, PATHINFO_FILENAME)));
        if (!$key || !preg_match('/^[a-z0-9_-]+$/', $key)) continue;
        $label = preg_match('/^\s*\/\/\s*@effect-label\s+(.+)$/mi', $source, $m)
            ? trim($m[1])
            : ucwords(str_replace(['-', '_'], ' ', $key));
        $description = preg_match('/^\s*\/\/\s*@effect-description\s+(.+)$/mi', $source, $m)
            ? trim($m[1])
            : '';
        $catalog[$key] = [
            'key' => $key,
            'label' => $label,
            'description' => $description,
            'script' => app_url('/assets/room-effects/' . $file . '?v=' . filemtime($path)),
        ];
    }
    uasort($catalog, fn(array $a, array $b): int => strcasecmp($a['label'], $b['label']));
    return $catalog;
}

function room_effect_label(?string $key): string {
    $catalog = room_effect_catalog();
    return $key && isset($catalog[$key]) ? $catalog[$key]['label'] : 'Room Effect';
}

function room_effect_payload(array $row): array {
    $catalog = room_effect_catalog();
    $effect = $catalog[$row['effect_key']] ?? null;
    return [
        'active' => true,
        'effect_key' => $row['effect_key'],
        'label' => $effect['label'] ?? room_effect_label($row['effect_key'] ?? null),
        'description' => $effect['description'] ?? '',
        'script' => $effect['script'] ?? null,
        'started_by_participant_id' => isset($row['started_by_participant_id']) ? (int)$row['started_by_participant_id'] : null,
        'started_by_user_id' => isset($row['started_by_user_id']) ? (int)$row['started_by_user_id'] : null,
        'started_by_name' => $row['started_by_name'] ?? 'Someone',
        'duration_minutes' => $row['duration_minutes'] !== null ? (int)$row['duration_minutes'] : null,
        'started_at' => $row['started_at'] ?? null,
        'expires_at' => $row['expires_at'] ?? null,
    ];
}

function cleanup_room_effects(PDO $pdo, ?int $sessionId = null): void {
    $sql = 'SELECT re.*, COALESCE(u.display_name, p.display_name, "Someone") AS started_by_name
              FROM room_effects re
              LEFT JOIN users u ON u.id = re.started_by_user_id
              LEFT JOIN participants p ON p.id = re.started_by_participant_id
             WHERE re.expires_at IS NOT NULL AND re.expires_at <= CURRENT_TIMESTAMP';
    $params = [];
    if ($sessionId !== null) {
        $sql .= ' AND re.session_id = ?';
        $params[] = $sessionId;
    }
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $expired = $stmt->fetchAll();
    if (!$expired) return;

    $delete = $pdo->prepare('DELETE FROM room_effects WHERE session_id = ?');
    foreach ($expired as $row) {
        $sid = (int)$row['session_id'];
        $delete->execute([$sid]);
        emit_event($pdo, $sid, 'room_effect', [
            'active' => false,
            'effect_key' => $row['effect_key'],
            'label' => room_effect_label($row['effect_key'] ?? null),
            'expired' => true,
            'stopped_by_name' => 'ChatSpace',
        ]);
    }
}

function active_room_effect(PDO $pdo, int $sessionId): ?array {
    cleanup_room_effects($pdo, $sessionId);
    $stmt = $pdo->prepare(
        'SELECT re.*, COALESCE(u.display_name, p.display_name, "Someone") AS started_by_name
           FROM room_effects re
           LEFT JOIN users u ON u.id = re.started_by_user_id
           LEFT JOIN participants p ON p.id = re.started_by_participant_id
          WHERE re.session_id = ?
          LIMIT 1'
    );
    $stmt->execute([$sessionId]);
    $row = $stmt->fetch();
    return $row ? room_effect_payload($row) : null;
}

function active_ejection_sql(string $alias = 're'): string {
    return "($alias.permanent = 1 OR $alias.expires_at IS NULL OR $alias.expires_at > CURRENT_TIMESTAMP)";
}

function stale_cutoff(PDO $pdo, ?float $minutes = null): string {
    $minutes = $minutes ?? app_setting_float($pdo, 'participant_idle_timeout_minutes', 2);
    $minutes = max(0.5, min(120, $minutes));
    return gmdate('Y-m-d H:i:s', time() - (int)round($minutes * 60));
}

function cleanup_stale_participants(PDO $pdo, ?int $sessionId = null): void {
    $cutoff = stale_cutoff($pdo);
    $sql = 'SELECT p.id, p.session_id, p.user_id, u.current_room_id
              FROM participants p
              JOIN room_sessions rs ON rs.id = p.session_id
              JOIN users u ON u.id = p.user_id
             WHERE p.last_seen_at IS NOT NULL
               AND p.last_seen_at < ?';
    $params = [$cutoff];
    if ($sessionId !== null) {
        $sql .= ' AND p.session_id = ?';
        $params[] = $sessionId;
    }
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $stale = $stmt->fetchAll();
    if (!$stale) return;

    $clearParticipant = $pdo->prepare('UPDATE participants SET last_seen_at = NULL, webcam_path = NULL, webcam_enabled = 0, linked_to_participant_id = NULL WHERE id = ? OR linked_to_participant_id = ?');
    $clearUser = $pdo->prepare('UPDATE users SET current_room_id = NULL, last_seen_at = CURRENT_TIMESTAMP WHERE id = ?');
    $clearVoice = $pdo->prepare('DELETE FROM voice_sessions WHERE participant_id = ?');
    foreach ($stale as $row) {
        $participantId = (int)$row['id'];
        $clearParticipant->execute([$participantId, $participantId]);
        $clearVoice->execute([$participantId]);
        $clearUser->execute([(int)$row['user_id']]);
        emit_event($pdo, (int)$row['session_id'], 'participant_leave', ['id' => $participantId, 'participant_id' => $participantId]);
    }
}

function active_room_ejection(PDO $pdo, int $roomId, int $userId): ?array {
    $stmt = $pdo->prepare(
        'SELECT * FROM room_ejections re
         WHERE re.room_id = ? AND re.user_id = ? AND ' . active_ejection_sql('re') . '
         ORDER BY re.created_at DESC LIMIT 1'
    );
    $stmt->execute([$roomId, $userId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function active_community_ejection(PDO $pdo, int $userId): ?array {
    $stmt = $pdo->prepare(
        'SELECT ce.*, by_user.display_name AS ejected_by_name
           FROM community_ejections ce
           LEFT JOIN users by_user ON by_user.id = ce.ejected_by_user_id
          WHERE ce.user_id = ? AND ' . active_ejection_sql('ce') . '
          ORDER BY ce.created_at DESC LIMIT 1'
    );
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function can_use_host_tools(array $user, array $room): bool {
    $role = $user['role'] ?? 'user';
    return (int)$room['owner_id'] === (int)$user['id'] || in_array($role, ['guide', 'developer', 'admin'], true);
}

function can_community_eject(array $user): bool {
    return in_array($user['role'] ?? 'user', ['developer', 'admin'], true);
}

function author_context_for_participant(PDO $pdo, int $sessionId, array $participant): array {
    $stmt = $pdo->prepare(
        'SELECT u.role, r.owner_id
           FROM users u
           JOIN room_sessions rs ON rs.id = ?
           JOIN rooms r ON r.id = rs.room_id
          WHERE u.id = ?
          LIMIT 1'
    );
    $stmt->execute([$sessionId, (int)($participant['user_id'] ?? 0)]);
    $row = $stmt->fetch() ?: [];
    return [
        'role' => $row['role'] ?? 'user',
        'is_owner' => !empty($row['owner_id']) && (int)$row['owner_id'] === (int)($participant['user_id'] ?? 0),
    ];
}

function link_key_for(int $a, int $b): string {
    $ids = [$a, $b];
    sort($ids, SORT_NUMERIC);
    return $ids[0] . ':' . $ids[1];
}

function dm_key_for(int $a, int $b): string {
    $ids = [$a, $b];
    sort($ids, SORT_NUMERIC);
    return 'dm:' . $ids[0] . ':' . $ids[1];
}

function avatar_presets(): array {
    return [
        'Default' => 'data:image/svg+xml;utf8,' . rawurlencode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#7c6af7"/><stop offset="1" stop-color="#27d3c3"/></linearGradient></defs><rect width="120" height="120" rx="60" fill="url(#g)"/><circle cx="60" cy="46" r="22" fill="#f7f2ff"/><path d="M24 105c8-25 28-36 36-36s28 11 36 36" fill="#f7f2ff"/></svg>'),
        'Nova' => 'data:image/svg+xml;utf8,' . rawurlencode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="60" fill="#111827"/><path d="M60 17l9 28 29-1-24 17 10 28-24-17-24 17 10-28-24-17 29 1z" fill="#f6d365"/></svg>'),
        'Comet' => 'data:image/svg+xml;utf8,' . rawurlencode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="60" fill="#12201d"/><circle cx="68" cy="50" r="24" fill="#27d3c3"/><path d="M18 82c30-3 52-14 74-50-8 34-25 58-74 50z" fill="#f7f2ff" opacity=".8"/></svg>'),
        'Velvet' => 'data:image/svg+xml;utf8,' . rawurlencode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="60" fill="#251326"/><circle cx="60" cy="60" r="34" fill="#d946ef"/><circle cx="48" cy="54" r="6" fill="#fff"/><circle cx="72" cy="54" r="6" fill="#fff"/><path d="M44 76c10 8 22 8 32 0" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round"/></svg>'),
    ];
}

function resolve_avatar(?string $path): string {
    $path = $path ?: 'preset:Default';
    if (str_starts_with($path, 'preset:')) {
        $key = substr($path, 7);
        $presets = avatar_presets();
        return $presets[$key] ?? $presets['Default'];
    }
    return $path;
}

function active_session_for_room(PDO $pdo, int $roomId): array {
    $stmt = $pdo->prepare('SELECT * FROM room_sessions WHERE room_id = ? LIMIT 1');
    $stmt->execute([$roomId]);
    $session = $stmt->fetch();
    if ($session) return $session;

    $pdo->prepare('INSERT INTO room_sessions (public_id, room_id) VALUES (?,?)')->execute([uuid_v4(), $roomId]);
    $stmt->execute([$roomId]);
    return $stmt->fetch();
}

function resolve_session_id(PDO $pdo, mixed $sessionKey): int {
    $key = trim((string)$sessionKey);
    if ($key === '') json_out(['error' => 'Session required'], 400);
    if (ctype_digit($key)) json_out(['error' => 'Session UUID required'], 400);
    $stmt = $pdo->prepare('SELECT id FROM room_sessions WHERE public_id = ? LIMIT 1');
    $stmt->execute([$key]);
    $id = (int)($stmt->fetchColumn() ?: 0);
    if (!$id) json_out(['error' => 'Session not found'], 404);
    return $id;
}

function participant_for_user(PDO $pdo, int $sessionId, array $user): array {
    $stmt = $pdo->prepare('SELECT * FROM participants WHERE session_id = ? AND user_id = ? ORDER BY id ASC');
    $stmt->execute([$sessionId, (int)$user['id']]);
    $matches = $stmt->fetchAll();
    if ($matches) {
        $participant = $matches[0];
        if (count($matches) > 1) {
            $extraIds = array_map(fn($row) => (int)$row['id'], array_slice($matches, 1));
            $placeholders = implode(',', array_fill(0, count($extraIds), '?'));
            $pdo->prepare("DELETE FROM participants WHERE id IN ($placeholders)")->execute($extraIds);
        }
        return $participant;
    }

    $token = bin2hex(random_bytes(24));
    $x = random_int(12, 68) / 100;
    $y = random_int(18, 58) / 100;
    $pdo->prepare(
        'INSERT INTO participants (session_id, user_id, display_name, avatar_path, join_token, position_x, position_y, last_seen_at)
         VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP)'
    )->execute([$sessionId, (int)$user['id'], $user['display_name'], $user['avatar_path'] ?: 'preset:Default', $token, $x, $y]);
    $stmt->execute([$sessionId, (int)$user['id']]);
    return $stmt->fetch();
}

function auth_participant(PDO $pdo, int|string $sessionId, ?string $joinToken = null): array {
    $sessionId = is_int($sessionId) ? $sessionId : resolve_session_id($pdo, $sessionId);
    $joinToken = $joinToken ?: ($_GET['join_token'] ?? '');
    $stmt = $pdo->prepare('SELECT * FROM participants WHERE session_id = ? AND join_token = ? LIMIT 1');
    $stmt->execute([$sessionId, $joinToken]);
    $p = $stmt->fetch();
    if (!$p) json_out(['error' => 'Unauthorized'], 403);
    $pdo->prepare('UPDATE participants SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([(int)$p['id']]);
    $pdo->prepare('UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([(int)$p['user_id']]);
    return $p;
}

function e(string $value): string {
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}
