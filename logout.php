<?php
require_once __DIR__ . '/includes/base.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    redirect_to('/login.php');
}

$user = current_user();
if ($user) {
    $pdo = db();
    $stmt = $pdo->prepare('SELECT id, session_id FROM participants WHERE user_id = ? AND last_seen_at IS NOT NULL');
    $stmt->execute([(int)$user['id']]);
    $participants = $stmt->fetchAll();
    foreach ($participants as $participant) {
        $pdo->prepare('DELETE FROM voice_sessions WHERE participant_id = ?')->execute([(int)$participant['id']]);
        $pdo->prepare('INSERT INTO media_signals (session_id, media, from_participant_id, to_participant_id, type, data) VALUES (?,?,?,?,?,?)')
            ->execute([(int)$participant['session_id'], 'voice', (int)$participant['id'], 0, 'leave', json_encode(['participant_id' => (int)$participant['id']])]);
    }
    db()->prepare('UPDATE participants SET last_seen_at = NULL, webcam_path = NULL, webcam_enabled = 0 WHERE user_id = ?')->execute([(int)$user['id']]);
    db()->prepare('UPDATE users SET current_room_id = NULL, last_seen_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([(int)$user['id']]);
}
session_destroy();
redirect_to('/login.php');
