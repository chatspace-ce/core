<?php
require_once __DIR__ . '/includes/base.php';
$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = strtolower(trim($_POST['email'] ?? ''));
    $password = (string)($_POST['password'] ?? '');
    $stmt = db()->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if ($user && password_verify($password, $user['password_hash'])) {
        $_SESSION['user_id'] = (int)$user['id'];
        redirect_to('/lobby.php');
    }
    $error = 'Email or password was not right.';
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Login - ChatSpace CE</title>
  <link rel="stylesheet" href="<?= e(app_url('/assets/css/styles.css')) ?>">
</head>
<body data-app-base="<?= e(app_base_path()) ?>">
<main class="auth-shell">
  <section class="auth-card">
    <a class="auth-logo-link" href="<?= e(app_url('/about.html')) ?>" aria-label="About ChatSpace Community Edition">
      <img class="auth-logo-full" src="<?= e(app_url('/assets/images/logos/chatspace-ce-full-logo.png')) ?>" alt="ChatSpace Community Edition">
    </a>
    <?php if ($error): ?><div class="error"><?= e($error) ?></div><?php endif; ?>
    <form class="form-grid" method="post">
      <label>Email<input type="email" name="email" required autocomplete="email"></label>
      <label>Password<input type="password" name="password" required autocomplete="current-password"></label>
      <button class="btn btn-primary" type="submit">Log In</button>
      <p class="minor">New here? <a href="<?= e(app_url('/register.php')) ?>">Create an account</a></p>
      <p class="minor auth-about-link"><a href="<?= e(app_url('/about.html')) ?>">About ChatSpace Community Edition</a></p>
    </form>
  </section>
</main>
</body>
</html>
