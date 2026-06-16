<?php
declare(strict_types=1);

function backup_portable_file_allowed(string $path): bool {
    return $path !== ''
        && str_starts_with($path, '/assets/')
        && !str_contains($path, '..')
        && !str_starts_with($path, '/assets/js/')
        && !str_starts_with($path, '/assets/css/');
}

function backup_portable_file_path(string $path): string {
    return __DIR__ . '/..' . $path;
}

function backup_write_portable_files(array $files): void {
    foreach ($files as $file) {
        if (!is_array($file)) continue;
        $path = (string)($file['path'] ?? '');
        if (!backup_portable_file_allowed($path)) continue;
        $data = base64_decode((string)($file['data'] ?? ''), true);
        if ($data === false) continue;
        $full = backup_portable_file_path($path);
        $dir = dirname($full);
        if (!is_dir($dir)) mkdir($dir, 0775, true);
        file_put_contents($full, $data);
    }
}

function backup_import_core_bundle(PDO $pdo, array $bundle, int $actorId = 0): array {
    if (($bundle['format'] ?? '') !== 'chatspace-ce-portable-bundle') {
        throw new RuntimeException('Uploaded file is not a ChatSpace portable bundle.');
    }
    $sections = is_array($bundle['sections'] ?? null) ? $bundle['sections'] : [];
    backup_write_portable_files(is_array($bundle['files'] ?? null) ? $bundle['files'] : []);

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
            if ($iconName !== '' && $label !== '' && backup_portable_file_allowed($filePath)) {
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
            $requestedAura = trim((string)($user['aura_effect'] ?? ''));
            $auraEffect = $requestedAura !== '' ? normalize_aura_key($requestedAura) : null;
            $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
            $stmt->execute([$email]);
            $id = (int)($stmt->fetchColumn() ?: 0);
            if ($id) {
                $pdo->prepare('UPDATE users SET password_hash = ?, display_name = ?, role = ?, avatar_path = ?, aura_effect = ? WHERE id = ?')
                    ->execute([$hash, $displayName, $role, $avatarPath, $auraEffect, $id]);
            } else {
                $pdo->prepare('INSERT INTO users (email, password_hash, display_name, role, avatar_path, aura_effect) VALUES (?,?,?,?,?,?)')
                    ->execute([$email, $hash, $displayName, $role, $avatarPath, $auraEffect]);
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
            if (!$ownerId || $name === '' || $gestureText === '' || !backup_portable_file_allowed($gifPath)) continue;
            $audioPath = (string)($gesture['audio_path'] ?? '');
            if ($audioPath !== '' && !backup_portable_file_allowed($audioPath)) $audioPath = '';
            $values = [
                $ownerId,
                $name,
                $gestureText,
                $gifPath,
                $audioPath !== '' ? $audioPath : null,
                !empty($gesture['audio_is_silent']) ? 1 : 0,
                !empty($gesture['is_public']) ? 1 : 0,
                array_key_exists('file_size', $gesture) && $gesture['file_size'] !== null ? (int)$gesture['file_size'] : null,
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
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw new RuntimeException('Portable import failed: ' . $e->getMessage(), 0, $e);
    }

    $imported = [];
    foreach (['users', 'gestures', 'rooms', 'settings', 'link_icons'] as $sectionName) {
        if (!empty($sections[$sectionName])) $imported[] = $sectionName;
    }
    if ($actorId > 0) {
        log_tool($pdo, $actorId, 'admin_portable_import', null, null, 'Imported ' . ($imported ? implode(', ', $imported) : 'portable bundle') . ' and files');
    }
    return ['ok' => true, 'type' => 'portable', 'imported' => $imported];
}

function backup_restore_sqlite_upload(string $tmpPath, bool $uploadedFile, int $actorId = 0): array {
    if (db_driver() !== 'sqlite') {
        throw new RuntimeException('Full database restore is available for SQLite installs. Use portable import or your MySQL/MariaDB restore process.');
    }
    $checkPath = sys_get_temp_dir() . '/chatspace-restore-' . bin2hex(random_bytes(8)) . '.sqlite';
    $moved = $uploadedFile ? move_uploaded_file($tmpPath, $checkPath) : copy($tmpPath, $checkPath);
    if (!$moved) throw new RuntimeException('Could not read uploaded database.');

    try {
        $check = new PDO('sqlite:' . $checkPath);
        $check->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $result = (string)$check->query('PRAGMA integrity_check')->fetchColumn();
        $hasUsers = (int)$check->query("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='users'")->fetchColumn();
        $hasRooms = (int)$check->query("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='rooms'")->fetchColumn();
        $check = null;
        if ($result !== 'ok' || !$hasUsers || !$hasRooms) {
            throw new RuntimeException('Uploaded file is not a valid ChatSpace database.');
        }
    } catch (Throwable $e) {
        @unlink($checkPath);
        throw new RuntimeException($e instanceof RuntimeException ? $e->getMessage() : 'Uploaded file is not a valid SQLite database.', 0, $e);
    }

    $dbPath = sqlite_path();
    $backup = $dbPath . '.pre-restore-' . gmdate('Ymd-His') . '.bak';
    if (is_file($dbPath)) copy($dbPath, $backup);
    if (!copy($checkPath, $dbPath)) {
        @unlink($checkPath);
        throw new RuntimeException('Could not restore database.');
    }
    @unlink($checkPath);
    if ($actorId > 0) {
        log_tool(db(), $actorId, 'admin_database_restore', null, null, 'Restored database; prior copy: ' . basename($backup));
    }
    return ['ok' => true, 'type' => 'sqlite', 'backup' => basename($backup)];
}

function backup_import_uploaded_file(PDO $pdo, array $upload, int $actorId = 0): array {
    if (empty($upload['tmp_name']) || !is_uploaded_file($upload['tmp_name'])) {
        throw new RuntimeException('Import file required.');
    }
    $tmp = $upload['tmp_name'];
    $decoded = json_decode((string)file_get_contents($tmp), true);
    if (is_array($decoded) && ($decoded['format'] ?? '') === 'chatspace-ce-portable-bundle') {
        return backup_import_core_bundle($pdo, $decoded, $actorId);
    }
    return backup_restore_sqlite_upload($tmp, true, $actorId);
}
