<?php
require_once __DIR__ . '/includes/base.php';
$user = require_user();
$pdo = db();
$communityEjection = active_community_ejection($pdo, (int)$user['id']);
if ($communityEjection) {
    redirect_to('/community_ejected.php');
}
$roomKey = trim((string)($_GET['id'] ?? ''));
$stmt = $pdo->prepare('SELECT r.*, u.display_name AS owner_name FROM rooms r JOIN users u ON u.id = r.owner_id WHERE r.id = ? LIMIT 1');
$stmt->execute([ctype_digit($roomKey) ? (int)$roomKey : 0]);
$room = $stmt->fetch();
if (!$room && $roomKey !== '') {
    $stmt = $pdo->prepare('SELECT r.*, u.display_name AS owner_name FROM rooms r JOIN users u ON u.id = r.owner_id WHERE r.public_id = ? LIMIT 1');
    $stmt->execute([$roomKey]);
    $room = $stmt->fetch();
}
if (!$room) {
    redirect_to('/lobby.php');
}
$roomId = (int)$room['id'];
$activeEjection = active_room_ejection($pdo, $roomId, (int)$user['id']);
if ($activeEjection) {
    $_SESSION['room_ejection_notice'] = [
        'permanent' => (bool)$activeEjection['permanent'],
        'duration_minutes' => $activeEjection['duration_minutes'] !== null ? (int)$activeEjection['duration_minutes'] : null,
    ];
    redirect_to('/lobby.php');
}
$session = active_session_for_room($pdo, $roomId);
cleanup_stale_participants($pdo, (int)$session['id']);
$participant = participant_for_user($pdo, (int)$session['id'], $user);
$pdo->prepare('UPDATE users SET current_room_id = ?, last_seen_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([$roomId, (int)$user['id']]);
$pdo->prepare('UPDATE participants SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([(int)$participant['id']]);

emit_event($pdo, (int)$session['id'], 'participant_join', [
    'id' => (int)$participant['id'],
    'user_id' => (int)$user['id'],
    'display_name' => $participant['display_name'],
    'role' => $user['role'] ?? 'user',
    'is_owner' => (int)$room['owner_id'] === (int)$user['id'],
    'avatar_path' => $participant['avatar_path'],
    'avatar_url' => resolve_avatar($participant['avatar_path']),
    'position_x' => (float)$participant['position_x'],
    'position_y' => (float)$participant['position_y'],
    'webcam_path' => $participant['webcam_path'],
    'linked_to' => $participant['linked_to_participant_id'] ? (int)$participant['linked_to_participant_id'] : null,
    'joined_at' => gmdate('Y-m-d H:i:s'),
]);
$lastEventId = (int)$pdo->query('SELECT COALESCE(MAX(id), 0) FROM events WHERE session_id = ' . (int)$session['id'])->fetchColumn();
$linkIconCatalog = link_icon_catalog($pdo);

?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= e($room['name']) ?> - ChatSpace CE</title>
  <link rel="stylesheet" href="<?= e(app_url('/assets/css/styles.css')) ?>">
</head>
<body data-room-id="<?= e($room['public_id']) ?>" data-app-base="<?= e(app_base_path()) ?>">
<div class="room-layout">
  <div class="version-banner" id="version-banner" hidden>
    <span id="version-banner-text">A new ChatSpace version is available.</span>
    <button class="btn btn-aqua" id="version-refresh" type="button">Refresh</button>
  </div>
  <main class="main">
    <section class="room-stage" id="room-stage">
      <div class="room-bg" <?php if ($room['background_path'] && !str_starts_with((string)$room['background_mime'], 'video/')): ?>style="background-image:url('<?= e(media_url($room['background_path'])) ?>')"<?php endif; ?>>
        <?php if ($room['background_path'] && str_starts_with((string)$room['background_mime'], 'video/')): ?>
        <video autoplay loop muted playsinline><source src="<?= e(media_url($room['background_path'])) ?>" type="<?= e($room['background_mime']) ?>"></video>
        <?php endif; ?>
      </div>
      <div class="game-stage-layer" id="game-stage" hidden>
        <div class="game-stage-head">
          <div>
            <div class="side-title">Game</div>
            <strong class="game-stage-title"><img id="game-stage-icon" src="" alt="" hidden><span id="game-stage-title">Game</span></strong>
          </div>
          <div class="game-stage-actions">
            <button class="btn" id="game-rematch" type="button">Play Again</button>
            <button class="btn btn-danger" id="game-resign" type="button">Resign</button>
            <button class="window-close" id="game-close" type="button" aria-label="Close game">×</button>
          </div>
        </div>
        <div class="game-stage-body">
          <aside class="game-player-card" id="game-player-one">
            <img src="<?= e(app_url('/assets/images/baghead.png')) ?>" alt="">
            <strong>Waiting</strong>
            <span class="minor">Player 1</span>
            <span class="game-typing-pill">typing...</span>
          </aside>
          <div class="game-frame-wrap">
            <iframe id="game-frame" title="Game"></iframe>
          </div>
          <aside class="game-player-card" id="game-player-two">
            <img src="<?= e(app_url('/assets/images/baghead.png')) ?>" alt="">
            <strong>Waiting</strong>
            <span class="minor">Player 2</span>
            <span class="game-typing-pill">typing...</span>
          </aside>
        </div>
      </div>
    </section>
    <div class="divider" id="horizontal-divider"></div>
    <section class="chat-pane">
      <div class="messages" id="messages"></div>
      <form class="composer" id="composer">
        <button class="composer-icon-btn" id="attach-btn" type="button" aria-label="Add attachment"><img src="<?= e(app_url('/assets/images/input-add.png')) ?>" alt=""></button>
        <div class="attach-menu" id="attach-menu" hidden>
          <button type="button" id="attach-file-btn">Attach File</button>
          <button type="button" id="attach-voice-btn">Attach Voice Note</button>
        </div>
        <input class="hidden-file-input" id="chat-file-input" type="file" accept="image/*,.pdf,.doc,.docx,.rtf,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/rtf">
        <textarea id="chat-input" maxlength="1000" rows="1" autocomplete="off" placeholder="Message <?= e($room['name']) ?>"></textarea>
        <div class="composer-actions">
          <span class="char-counter" id="char-counter">0/1000</span>
          <button class="composer-icon-btn emoji-btn" id="emoji-btn" type="button" aria-label="Media palette"><img src="<?= e(app_url('/assets/images/input-emoji.png')) ?>" alt=""></button>
          <button class="send-btn" type="submit" aria-label="Send message"><img src="<?= e(app_url('/assets/images/input-send.png')) ?>" alt=""></button>
        </div>
      </form>
      <div class="chat-tabs" id="chat-tabs">
        <button class="chat-tab active" type="button" data-chat-tab="room"><img src="<?= e(app_url('/assets/images/chat-pane-bubble.png')) ?>" alt=""> <span>Chat Room</span><span class="tab-badge" hidden>0</span></button>
        <button class="chat-tab" type="button" data-chat-tab="community"><img src="<?= e(app_url('/assets/images/chat-pane-community.png')) ?>" alt=""> <span>Community Chat</span><span class="tab-badge" hidden>0</span></button>
        <span id="link-tabs"></span>
      </div>
    </section>
  </main>
  <div class="vertical-divider" id="vertical-divider"></div>
  <aside class="sidebar">
    <section class="side-section">
      <button class="gear-btn" id="room-menu-btn" type="button" aria-label="Room menu">⚙</button>
      <div class="side-title">Room</div>
      <div class="room-title-row">
        <strong id="room-title-text"><?= e($room['name']) ?></strong>
        <button class="room-action-btn" id="room-action-btn" type="button" aria-label="Room actions"<?= can_use_host_tools($user, $room) ? '' : ' hidden' ?>>•••</button>
      </div>
      <div class="minor">Created by <?= e($room['owner_name']) ?></div>
    </section>
    <section class="side-section games-side-section">
      <div class="side-title">Games</div>
      <div class="game-start-wrap">
        <button class="btn icon-label game-start-btn" id="game-start-btn" type="button"><img src="<?= e(app_url('/assets/images/games-icon.png')) ?>" alt="">Start a Game</button>
        <div class="game-start-menu" id="game-start-menu" hidden>
          <button data-game="chess" type="button"><img src="<?= e(app_url('/assets/images/chess-icon.png')) ?>" alt="">Chess</button>
          <button data-game="checkers" type="button"><img src="<?= e(app_url('/assets/images/checkers-icon.png')) ?>" alt="">Checkers</button>
          <button data-game="backgammon" type="button"><img src="<?= e(app_url('/assets/images/backgammon-icon.png')) ?>" alt="">Backgammon</button>
          <button data-game="spaceinvasion" type="button"><img src="<?= e(app_url('/assets/images/spaceinvasion-icon.png')) ?>" alt="">Space Invasion</button>
          <button data-game="tetris" type="button"><img src="<?= e(app_url('/assets/images/tetris-icon.png')) ?>" alt="">Tetris Versus</button>
        </div>
      </div>
      <div class="game-list" id="active-games"></div>
    </section>
    <section class="side-section">
      <div class="side-title">Chatting <span id="participant-count-label">(0)</span></div>
      <div class="user-list" id="user-list"></div>
    </section>
    <div class="sidebar-bottom-tools">
      <section class="side-section">
        <div class="side-title">Voice Chat</div>
        <div class="voice-list" id="voice-list"></div>
        <button class="btn btn-voice" id="voice-toggle" style="width:100%;margin-top:8px;">Join Voice</button>
      </section>
      <section class="side-section">
        <button class="btn icon-label" id="locate-btn" style="width:100%;"><img src="<?= e(app_url('/assets/images/locate.png')) ?>" alt="">Locate Friends</button>
        <div class="app-version" id="app-version">Checking version...</div>
      </section>
    </div>
  </aside>
</div>
<div class="modal" id="voice-note-modal">
  <div class="modal-box voice-note-box">
    <div class="modal-head">
      <strong>Voice Note</strong>
      <button class="btn" id="voice-note-cancel" type="button">Cancel</button>
    </div>
    <div class="voice-note-status" id="voice-note-status">Recording...</div>
    <button class="btn btn-aqua" id="voice-note-stop" type="button">Stop and Send</button>
  </div>
</div>
<div class="modal" id="room-edit-modal">
  <form class="modal-box" id="room-edit-form" enctype="multipart/form-data">
    <div class="modal-head">
      <strong>Edit Room</strong>
      <button class="window-close" id="room-edit-close" type="button" aria-label="Close">×</button>
    </div>
    <div class="room-edit-preview" id="room-edit-preview">
      <?php if ($room['background_path'] && str_starts_with((string)$room['background_mime'], 'video/') && !empty($room['background_thumb_path'])): ?>
      <img src="<?= e(media_url($room['background_thumb_path'])) ?>" alt="Current room background thumbnail">
      <?php elseif ($room['background_path'] && str_starts_with((string)$room['background_mime'], 'video/')): ?>
      <video muted loop playsinline preload="metadata"><source src="<?= e(media_url($room['background_path'])) ?>" type="<?= e($room['background_mime']) ?>"></video>
      <?php elseif ($room['background_path']): ?>
      <img src="<?= e(media_url($room['background_path'])) ?>" alt="Current room background">
      <?php else: ?>
      <div class="room-edit-preview-empty">No background selected</div>
      <?php endif; ?>
    </div>
    <label>Room name<input id="room-edit-name" name="name" value="<?= e($room['name']) ?>" required></label>
    <label>Background image or video
      <span class="file-picker">
        <input id="room-edit-background" type="file" name="background" accept="image/*,video/mp4,video/webm">
        <span class="file-picker-btn">Choose Background</span>
        <span class="file-picker-name" id="room-edit-background-name">No file selected</span>
      </span>
      <span class="upload-progress" id="room-edit-upload-progress" aria-live="polite">
        <span class="upload-progress-track"><span class="upload-progress-bar"></span></span>
        <span class="upload-progress-meta"><span class="upload-progress-msg">Waiting...</span><span class="upload-progress-pct">0%</span></span>
      </span>
    </label>
    <div class="ejection-list-wrap">
      <div class="side-title">Kicked Users</div>
      <div class="ejection-list" id="room-ejection-list">Loading...</div>
    </div>
    <div class="room-edit-actions">
      <button class="btn btn-primary" type="submit">Save Room</button>
      <button class="btn btn-danger" id="room-delete-open" type="button">Delete Room</button>
    </div>
  </form>
</div>
<div class="modal" id="room-delete-modal">
  <div class="modal-box warning-box">
    <div class="modal-head">
      <strong>Delete Room</strong>
      <button class="window-close" id="room-delete-close" type="button" aria-label="Close">×</button>
    </div>
    <p>This will delete the room and eject everyone currently inside it.</p>
    <div class="password-actions">
      <button class="btn btn-danger" id="room-delete-confirm" type="button">Delete Room</button>
      <button class="btn" id="room-delete-cancel" type="button">Cancel</button>
    </div>
  </div>
</div>
<div class="modal" id="room-effects-modal">
  <form class="modal-box room-effects-box" id="room-effects-form">
    <div class="modal-head">
      <strong>Room Effects</strong>
      <button class="window-close" id="room-effects-close" type="button" aria-label="Close">×</button>
    </div>
    <div class="room-effect-current" id="room-effect-current"></div>
    <label>Effect
      <select id="room-effect-select" name="effect_key"></select>
    </label>
    <label>Duration
      <select id="room-effect-duration" name="duration_minutes">
        <option value="">Until disabled</option>
        <option value="1">1 minute</option>
        <option value="5">5 minutes</option>
        <option value="10">10 minutes</option>
        <option value="30">30 minutes</option>
        <option value="60">1 hour</option>
      </select>
    </label>
    <div class="room-effects-actions">
      <button class="btn btn-primary" type="submit">Start Effect</button>
      <button class="btn btn-danger" id="room-effect-stop" type="button">Stop Current</button>
    </div>
  </form>
</div>
<div class="modal" id="host-warn-modal">
  <form class="modal-box host-action-box" id="host-warn-form">
    <div class="modal-head">
      <strong>Warn User</strong>
      <button class="window-close" id="host-warn-close" type="button" aria-label="Close">×</button>
    </div>
    <div class="host-target-line" id="host-warn-target"></div>
    <label class="host-field">Warning message<textarea id="host-warn-message" maxlength="1000" rows="5" placeholder="Type the warning this user will see..." required></textarea></label>
    <div class="host-action-footer">
      <span class="minor">They must acknowledge it before continuing.</span>
      <button class="btn btn-danger" type="submit">Send Warning</button>
    </div>
  </form>
</div>
<div class="modal" id="host-kick-modal">
  <form class="modal-box host-action-box" id="host-kick-form">
    <div class="modal-head">
      <strong>Kick from Room</strong>
      <button class="window-close" id="host-kick-close" type="button" aria-label="Close">×</button>
    </div>
    <div class="host-target-line" id="host-kick-target"></div>
    <label class="host-field host-duration-field">Duration
      <select id="host-kick-duration">
        <option value="5">5 minutes</option>
        <option value="15">15 minutes</option>
        <option value="30">30 minutes</option>
        <option value="60">60 minutes</option>
        <option value="1440">1440 minutes</option>
        <option value="permanent">Permanent</option>
      </select>
    </label>
    <button class="btn btn-danger host-kick-submit" type="submit">Kick from Room</button>
  </form>
</div>
<div class="modal" id="community-eject-modal">
  <form class="modal-box host-action-box" id="community-eject-form">
    <div class="modal-head">
      <strong>Community Eject</strong>
      <button class="window-close" id="community-eject-close" type="button" aria-label="Close">×</button>
    </div>
    <div class="host-target-line" id="community-eject-target"></div>
    <label class="host-field host-duration-field">Duration
      <select id="community-eject-duration">
        <option value="5">5 minutes</option>
        <option value="15">15 minutes</option>
        <option value="30">30 minutes</option>
        <option value="60">60 minutes</option>
        <option value="1440">1440 minutes</option>
        <option value="permanent">Forever</option>
      </select>
    </label>
    <label class="host-field">Reason
      <textarea id="community-eject-reason" maxlength="1000"></textarea>
    </label>
    <button class="btn btn-danger host-kick-submit" type="submit">Community Eject</button>
  </form>
</div>
<div class="modal" id="host-notice-modal">
  <div class="modal-box warning-box">
    <div class="modal-head">
      <strong id="host-notice-title">Notice</strong>
    </div>
    <div id="host-notice-message"></div>
    <button class="btn btn-aqua" id="host-notice-understand" type="button" style="width:100%;margin-top:14px;">I understand</button>
  </div>
</div>
<div class="modal" id="link-icon-modal">
  <div class="modal-box link-icon-box">
    <div class="modal-head">
      <strong>Link Icon</strong>
      <button class="window-close" id="link-icon-close" type="button" aria-label="Close">×</button>
    </div>
    <div class="link-icon-grid" id="link-icon-grid">
      <button class="link-icon-none" type="button" data-link-icon="none"><span aria-hidden="true"></span><strong>None</strong></button>
      <?php foreach ($linkIconCatalog as $icon): ?>
      <button type="button" data-link-icon="<?= e($icon['icon_name']) ?>"><img src="<?= e(app_url($icon['file_path'])) ?>" alt=""><span><?= e($icon['label']) ?></span></button>
      <?php endforeach; ?>
    </div>
  </div>
</div>
<div class="modal" id="warning-modal">
  <div class="modal-box warning-box">
    <div class="modal-head">
      <strong>Warning</strong>
      <button class="window-close" id="warning-close" type="button" aria-label="Close">×</button>
    </div>
    <div id="warning-message">You cannot link with this user.</div>
  </div>
</div>
<div class="modal" id="delete-message-modal">
  <div class="modal-box warning-box">
    <div class="modal-head">
      <strong>Delete Message</strong>
      <button class="window-close" id="delete-message-close" type="button" aria-label="Close">×</button>
    </div>
    <div>Are you sure you want to delete this message?</div>
    <div class="delete-message-actions">
      <button class="btn" id="delete-message-cancel" type="button">Cancel</button>
      <button class="btn btn-danger" id="delete-message-confirm" type="button">Delete Message</button>
    </div>
  </div>
</div>
<div class="modal" id="clear-room-history-modal">
  <div class="modal-box warning-box">
    <div class="modal-head">
      <strong>Clear Room History</strong>
      <button class="window-close" id="clear-room-history-close" type="button" aria-label="Close">×</button>
    </div>
    <div>This will remove the room chat history for everyone in the room.</div>
    <div class="delete-message-actions">
      <button class="btn" id="clear-room-history-cancel" type="button">Cancel</button>
      <button class="btn btn-danger" id="clear-room-history-confirm" type="button">Clear History</button>
    </div>
  </div>
</div>
<div id="ctx-menu">
  <button id="ctx-change-avatar" type="button">Change Avatar</button>
  <button id="ctx-toggle-webcam" type="button">Enable Webcam</button>
  <button id="ctx-dm" type="button">Send DM</button>
  <button id="ctx-block" class="danger" type="button">Block</button>
  <button id="ctx-unblock" type="button">Unblock</button>
  <button id="ctx-unlink" class="danger" type="button">Unlink</button>
  <div class="ctx-divider" id="ctx-tools-divider"></div>
  <div class="ctx-submenu-wrap" id="ctx-tools-wrap">
    <button id="ctx-tools" type="button">Tools <span>›</span></button>
    <div class="ctx-submenu" id="ctx-tools-submenu">
      <button id="ctx-host-warn" type="button">Warn</button>
      <button id="ctx-host-kick" class="danger" type="button">Kick from Room</button>
      <button id="ctx-community-eject" class="danger" type="button">Community Eject</button>
    </div>
  </div>
</div>
<div id="text-ctx-menu">
  <button id="text-copy" type="button">Copy</button>
  <button id="text-cut" type="button">Cut</button>
  <button id="text-paste" type="button">Paste</button>
</div>
<div id="msg-action-menu">
  <div class="msg-react-row">
    <button type="button" data-msg-reaction="❤️">❤️</button>
    <button type="button" data-msg-reaction="👍">👍</button>
    <button type="button" data-msg-reaction="👎">👎</button>
    <button type="button" data-msg-reaction="😂">😂</button>
    <button type="button" data-msg-reaction="😌">😌</button>
    <button type="button" data-msg-reaction="✅">✅</button>
  </div>
  <button id="msg-edit-action" type="button">Edit</button>
  <button id="msg-delete-action" class="danger" type="button">Delete</button>
</div>
<div id="tab-ctx-menu">
  <button id="tab-clear-history" type="button">Clear History</button>
  <button id="tab-close-dm" type="button">Close DM</button>
  <button id="tab-unlink" class="danger" type="button">Unlink</button>
</div>
<div id="room-action-menu">
  <button id="room-action-edit" type="button">Edit Room</button>
  <button id="room-action-effects" type="button">Room Effects</button>
  <button id="room-action-clear-history" class="danger" type="button">Clear Room History</button>
</div>
<div id="room-menu">
  <button id="lock-session-btn" type="button"><img src="<?= e(app_url('/assets/images/secure.png')) ?>" alt="">Lock Session</button>
  <a id="rooms-link" href="<?= e(app_url('/lobby.php?leave=1')) ?>"><img src="<?= e(app_url('/assets/images/lobby.png')) ?>" alt="">Lobby</a>
  <a id="logout-link" href="<?= e(app_url('/logout.php')) ?>"><img src="<?= e(app_url('/assets/images/logout.png')) ?>" alt="">Log Out</a>
</div>
<div class="session-lock" id="session-lock" aria-hidden="true">
  <form class="session-lock-box" id="session-lock-form">
    <div class="session-lock-brand">
      <img src="<?= e(app_url('/assets/images/chatspace-ce-logo.png')) ?>" alt="">
      <div>
        <strong>Session Locked</strong>
        <span><?= e($user['display_name']) ?></span>
      </div>
    </div>
    <label>Account password
      <input id="session-lock-password" type="password" autocomplete="current-password">
    </label>
    <div class="session-lock-error" id="session-lock-error" role="alert"></div>
    <button class="btn btn-primary" type="submit">Unlock Session</button>
  </form>
</div>
<div id="media-picker" hidden>
  <div class="media-picker-tabs">
    <button class="active" type="button" data-media-tab="gifs">GIFs</button>
    <button type="button" data-media-tab="gestures">Gestures</button>
    <button type="button" data-media-tab="emojis">Emojis</button>
  </div>
  <div class="media-search-row">
    <input id="media-search-input" type="search" placeholder="Search GIFs" autocomplete="off">
  </div>
  <div class="media-panel active" id="media-panel-gifs">
    <div class="gif-results" id="gif-results">
      <div class="minor">Search for a GIF.</div>
    </div>
  </div>
  <div class="media-panel" id="media-panel-gestures">
    <input class="hidden-file-input" id="gesture-file-input" type="file" accept=".agst,application/zip">
    <div class="gesture-grid" id="gesture-grid"></div>
    <div class="gesture-pager">
      <button class="btn" id="gesture-prev" type="button">Previous</button>
      <span id="gesture-page-label">Page 1</span>
      <button class="btn" id="gesture-next" type="button">Next</button>
    </div>
    <div class="gesture-tray" id="gesture-tray"></div>
  </div>
  <div class="media-panel" id="media-panel-emojis">
    <div class="emoji-grid" id="emoji-grid"></div>
  </div>
</div>
<input type="file" id="avatar-file-input" accept="image/jpeg,image/png,image/gif,image/webp" style="display:none">
<div class="modal" id="locate-modal">
  <div class="modal-box locate-box">
    <div class="modal-head">
      <strong>Locate Friends</strong>
      <button class="window-close" id="locate-close" type="button" aria-label="Close">×</button>
    </div>
    <label>Friend name
      <input id="friend-search" autocomplete="off" placeholder="Type part of a name">
    </label>
    <div id="friend-loading" class="locate-loading" style="display:none;">
      <span class="spinner"></span>
      <span>Searching...</span>
    </div>
    <div class="friend-list" id="friend-results" style="margin-top:12px;"></div>
  </div>
</div>
<script src="<?= e(app_url('/assets/js/avatar-processing.js')) ?>"></script>
<script src="<?= e(app_url('/assets/js/room.js')) ?>"></script>
</body>
</html>
