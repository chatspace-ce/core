<?php
require_once __DIR__ . '/../includes/base.php';

$me = require_staff();

$pdo = db();

function link_icon_slug(string $label): string {
    $slug = strtolower(trim($label));
    $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?? '';
    $slug = trim($slug, '-');
    return $slug !== '' ? substr($slug, 0, 48) : 'icon';
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    json_out(['icons' => link_icon_catalog($pdo)]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'Unsupported method'], 405);

$action = (string)($_POST['action'] ?? 'create');

if ($action === 'create') {
    $label = trim((string)($_POST['label'] ?? ''));
    if ($label === '') json_out(['error' => 'Icon label is required'], 400);
    if (empty($_FILES['icon']['tmp_name']) || !is_uploaded_file($_FILES['icon']['tmp_name'])) {
        json_out(['error' => 'Icon image is required'], 400);
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($_FILES['icon']['tmp_name']) ?: '';
    $allowed = ['image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif', 'image/jpeg' => 'jpg'];
    if (!isset($allowed[$mime]) || (int)$_FILES['icon']['size'] > 2 * 1024 * 1024) {
        json_out(['error' => 'Use a PNG, WEBP, GIF, or JPG icon under 2 MB.'], 400);
    }

    $base = link_icon_slug($label);
    $iconName = $base;
    $attempt = 0;
    $check = $pdo->prepare('SELECT 1 FROM link_icon_catalog WHERE icon_name = ? LIMIT 1');
    while (true) {
        $check->execute([$iconName]);
        if (!$check->fetchColumn()) break;
        $attempt++;
        $iconName = $base . '-' . bin2hex(random_bytes(3));
        if ($attempt > 8) json_out(['error' => 'Could not create a unique icon name'], 500);
    }

    $dir = __DIR__ . '/../assets/uploads/link-icons';
    if (!is_dir($dir)) mkdir($dir, 0775, true);
    $file = $iconName . '.' . $allowed[$mime];
    $dest = $dir . '/' . $file;
    if (!move_uploaded_file($_FILES['icon']['tmp_name'], $dest)) {
        json_out(['error' => 'Could not save icon image'], 500);
    }
    $public = '/assets/uploads/link-icons/' . $file;
    upsert_link_icon_catalog($pdo, $iconName, $label, $public, false);
    log_tool($pdo, (int)$me['id'], 'link_icon_create', null, null, 'Created link icon: ' . $label);
    json_out(['ok' => true, 'icon' => ['icon_name' => $iconName, 'label' => $label, 'file_path' => $public, 'built_in' => false]]);
}

if ($action === 'update') {
    $iconName = preg_replace('/[^a-z0-9-]/', '', (string)($_POST['icon_name'] ?? '')) ?: '';
    $label = trim((string)($_POST['label'] ?? ''));
    if ($iconName === '' || $label === '') json_out(['error' => 'Icon and label are required'], 400);
    $stmt = $pdo->prepare('SELECT * FROM link_icon_catalog WHERE icon_name = ? LIMIT 1');
    $stmt->execute([$iconName]);
    $icon = $stmt->fetch();
    if (!$icon) json_out(['error' => 'Icon not found'], 404);
    upsert_link_icon_catalog($pdo, $iconName, $label, (string)$icon['file_path'], !empty($icon['built_in']));
    log_tool($pdo, (int)$me['id'], 'link_icon_update', null, null, 'Updated link icon: ' . $label);
    json_out(['ok' => true]);
}

if ($action === 'delete') {
    $iconName = preg_replace('/[^a-z0-9-]/', '', (string)($_POST['icon_name'] ?? '')) ?: '';
    if ($iconName === '' || $iconName === 'plus') json_out(['error' => 'That icon cannot be deleted'], 400);
    $stmt = $pdo->prepare('SELECT * FROM link_icon_catalog WHERE icon_name = ? LIMIT 1');
    $stmt->execute([$iconName]);
    $icon = $stmt->fetch();
    if (!$icon) json_out(['error' => 'Icon not found'], 404);
    if (!empty($icon['built_in'])) json_out(['error' => 'Built-in icons cannot be deleted'], 400);

    $pdo->beginTransaction();
    try {
        $pdo->prepare("UPDATE link_icons SET icon_name = 'plus', updated_at = CURRENT_TIMESTAMP WHERE icon_name = ?")->execute([$iconName]);
        $pdo->prepare('DELETE FROM link_icon_catalog WHERE icon_name = ?')->execute([$iconName]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        json_out(['error' => 'Could not delete icon'], 500);
    }

    $path = (string)$icon['file_path'];
    if (str_starts_with($path, '/assets/uploads/link-icons/')) {
        @unlink(__DIR__ . '/..' . $path);
    }
    log_tool($pdo, (int)$me['id'], 'link_icon_delete', null, null, 'Deleted link icon: ' . $icon['label']);
    json_out(['ok' => true]);
}

json_out(['error' => 'Unknown action'], 400);
