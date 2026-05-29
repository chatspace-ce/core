<?php
require_once __DIR__ . '/includes/base.php';
$error = '';
$pdo = db();
$branding = install_branding($pdo);
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $login = trim($_POST['login'] ?? '');
    $password = (string)($_POST['password'] ?? '');
    $stmt = $pdo->prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(display_name) = LOWER(?) LIMIT 1');
    $stmt->execute([$login, $login]);
    $user = $stmt->fetch();
    if ($user && password_verify($password, $user['password_hash'])) {
        $_SESSION['user_id'] = (int)$user['id'];
        redirect_to('/lobby.php');
    }
    $error = 'Login or password was not right.';
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= e(branded_page_title('Login', $pdo)) ?></title>
  <link rel="stylesheet" href="<?= e(app_url('/assets/css/styles.css')) ?>">
</head>
<body data-app-base="<?= e(app_base_path()) ?>" data-csrf="<?= e(csrf_token()) ?>">
<main class="auth-shell">
  <section class="auth-card">
    <a class="auth-logo-link" href="<?= e(app_url('/about.html')) ?>" aria-label="About ChatSpace Community Edition">
      <img class="auth-logo-full <?= $branding['has_custom_logo'] ? 'custom-brand-logo' : '' ?>" src="<?= e(app_url($branding['logo_path'])) ?>" alt="<?= e($branding['community_name'] ?: 'ChatSpace Community Edition') ?>">
    </a>
    <?php if ($error): ?><div class="error"><?= e($error) ?></div><?php endif; ?>
    <form class="form-grid" method="post">
      <?= csrf_input() ?>
      <label>Email or username<input name="login" required autocomplete="username"></label>
      <label>Password<input type="password" name="password" required autocomplete="current-password"></label>
      <button class="btn btn-primary" type="submit">Log In</button>
      <div class="auth-action-panel">
        <span>New here?</span>
        <a class="btn btn-primary auth-main-link" href="<?= e(app_url('/register.php')) ?>">Create an Account</a>
      </div>
      <div class="auth-utility-actions">
        <a class="auth-utility-btn" href="<?= e(app_url('/recover.php')) ?>">Recover Account</a>
        <a class="auth-utility-btn auth-about-btn" href="<?= e(app_url('/about.html')) ?>">About ChatSpace CE</a>
      </div>
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
