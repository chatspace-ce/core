<?php
require_once __DIR__ . '/includes/base.php';
$pdo = db();
$branding = install_branding($pdo);
$error = '';
$success = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $login = trim((string)($_POST['login'] ?? ''));
    $code = strtolower(trim((string)($_POST['recovery_code'] ?? '')));
    $newPassword = (string)($_POST['new_password'] ?? '');
    $confirmPassword = (string)($_POST['confirm_password'] ?? '');

    if ($login === '' || $code === '' || $newPassword === '' || $confirmPassword === '') {
        $error = 'All fields are required.';
    } elseif (!preg_match('/^[a-z]{4}-[a-z]{4}-[a-z]{4}-[a-z]{4}$/', $code)) {
        $error = 'Recovery code format is not valid.';
    } elseif (strlen($newPassword) < 8) {
        $error = 'New password must be at least 8 characters.';
    } elseif ($newPassword !== $confirmPassword) {
        $error = 'New password and confirmation do not match.';
    } else {
        $stmt = $pdo->prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(display_name) = LOWER(?) LIMIT 1');
        $stmt->execute([$login, $login]);
        $user = $stmt->fetch();
        if (!$user || empty($user['recovery_code_hash']) || !password_verify($code, (string)$user['recovery_code_hash'])) {
            $error = 'Recovery details were not right.';
        } elseif (password_verify($newPassword, (string)$user['password_hash'])) {
            $error = 'New password must be different from the current password.';
        } else {
            $stmt = $pdo->prepare('UPDATE users SET password_hash = ?, recovery_code_hash = NULL, recovery_code_suffix = NULL WHERE id = ?');
            $stmt->execute([password_hash($newPassword, PASSWORD_DEFAULT), (int)$user['id']]);
            $success = 'Password reset. Your old recovery code has been invalidated.';
        }
    }
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= e(branded_page_title('Recover Account', $pdo)) ?></title>
  <link rel="stylesheet" href="<?= e(app_url('/assets/css/styles.css')) ?>">
</head>
<body data-app-base="<?= e(app_base_path()) ?>" data-csrf="<?= e(csrf_token()) ?>">
<main class="auth-shell">
  <section class="auth-card">
    <a class="auth-logo-link" href="<?= e(app_url('/about.html')) ?>" aria-label="About ChatSpace Community Edition">
      <img class="auth-logo-full <?= $branding['has_custom_logo'] ? 'custom-brand-logo' : '' ?>" src="<?= e(app_url($branding['logo_path'])) ?>" alt="<?= e($branding['community_name'] ?: 'ChatSpace Community Edition') ?>">
    </a>
    <h1>Recover Account</h1>
    <?php if ($error): ?><div class="error"><?= e($error) ?></div><?php endif; ?>
    <?php if ($success): ?><div class="success"><?= e($success) ?></div><?php endif; ?>
    <form class="form-grid" method="post">
      <?= csrf_input() ?>
      <label>Email or username<input name="login" required autocomplete="username" value="<?= e($_POST['login'] ?? '') ?>"></label>
      <label>Recovery Code<input name="recovery_code" required autocomplete="off" placeholder="kmsf-jjvz-xsfl-revv" value="<?= e($_POST['recovery_code'] ?? '') ?>"></label>
      <label>New password<input type="password" name="new_password" required minlength="8" autocomplete="new-password"></label>
      <label>Confirm new password<input type="password" name="confirm_password" required minlength="8" autocomplete="new-password"></label>
      <button class="btn btn-primary" type="submit">Reset Password</button>
      <p class="minor"><a href="<?= e(app_url('/login.php')) ?>">Back to login</a></p>
    </form>
    <?php if ($branding['has_custom_logo']): ?>
      <div class="powered-by auth-powered-by">
        <span>Powered by</span>
        <img src="<?= e(app_url($branding['powered_logo_path'])) ?>" alt="ChatSpace Community Edition">
      </div>
    <?php endif; ?>
  </section>
</main>
</body>
</html>
