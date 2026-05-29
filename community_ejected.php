<?php
require_once __DIR__ . '/includes/base.php';
$user = require_user();
$ejection = active_community_ejection(db(), (int)$user['id']);
if (!$ejection) {
    redirect_to('/lobby.php');
}
$expires = $ejection['expires_at'] ?? null;
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Community Ejection - ChatSpace CE</title>
  <link rel="stylesheet" href="<?= e(app_url('/assets/css/styles.css')) ?>">
</head>
<body class="auth-shell" data-app-base="<?= e(app_base_path()) ?>">
  <main class="auth-card">
    <div class="brand">
      <div>
        <h1>Community Ejection</h1>
        <span>ChatSpace Community Edition</span>
      </div>
    </div>
    <?php if (!empty($ejection['permanent'])): ?>
      <p>You have been permanently ejected from the community.</p>
    <?php else: ?>
      <p>You have been ejected from the community until <strong id="community-ejection-local" data-utc="<?= e($expires ?: '') ?>"><?= e($expires ?: '') ?></strong>.</p>
    <?php endif; ?>
    <?php if (!empty($ejection['reason'])): ?>
      <p class="minor"><?= e($ejection['reason']) ?></p>
    <?php endif; ?>
    <form method="post" action="<?= e(app_url('/logout.php')) ?>">
      <?= csrf_input() ?>
      <button class="btn" type="submit" style="width:100%;margin-top:14px;">Log Out</button>
    </form>
  </main>
  <script src="<?= e(app_url('/assets/js/community_ejected.js')) ?>"></script>
</body>
</html>
