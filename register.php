<?php
require_once __DIR__ . '/includes/base.php';
$error = '';
$pdo = db();
$branding = install_branding($pdo);
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = strtolower(trim($_POST['email'] ?? ''));
    $name = trim($_POST['display_name'] ?? '');
    $password = (string)($_POST['password'] ?? '');
    $avatarPath = null;
    if (!empty($_FILES['avatar']['tmp_name']) && is_uploaded_file($_FILES['avatar']['tmp_name'])) {
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($_FILES['avatar']['tmp_name']) ?: '';
        $allowed = ['image/gif' => 'gif', 'image/webp' => 'webp'];
        $dims = @getimagesize($_FILES['avatar']['tmp_name']);
        $validDims = $dims && $dims[0] >= 42 && $dims[1] >= 42 && $dims[0] <= 250 && $dims[1] <= 250;
        if (isset($allowed[$mime]) && (int)$_FILES['avatar']['size'] <= 5 * 1024 * 1024 && $validDims) {
            $file = bin2hex(random_bytes(12)) . '.' . $allowed[$mime];
            $dest = __DIR__ . '/assets/uploads/avatars/' . $file;
            move_uploaded_file($_FILES['avatar']['tmp_name'], $dest);
            $avatarPath = '/assets/uploads/avatars/' . $file;
        }
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $name === '' || strlen($password) < 8 || !$avatarPath) {
        $error = 'Use a valid email, display name, password of at least 8 characters, and an avatar image between 42x42 and 250x250.';
    } else {
        try {
            $nameCheck = $pdo->prepare('SELECT 1 FROM users WHERE LOWER(display_name) = LOWER(?) LIMIT 1');
            $nameCheck->execute([$name]);
            if ($nameCheck->fetchColumn()) {
                throw new RuntimeException('That display name is already taken.');
            }
            $stmt = $pdo->prepare('INSERT INTO users (email, password_hash, display_name, avatar_path) VALUES (?,?,?,?)');
            $stmt->execute([$email, password_hash($password, PASSWORD_DEFAULT), $name, $avatarPath]);
            $_SESSION['user_id'] = (int)$pdo->lastInsertId();
            redirect_to('/lobby.php');
        } catch (RuntimeException $e) {
            $error = $e->getMessage();
        } catch (PDOException $e) {
            $error = 'That email is already registered.';
        }
    }
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= e(branded_page_title('Sign Up', $pdo)) ?></title>
  <link rel="stylesheet" href="<?= e(app_url('/assets/css/styles.css')) ?>">
</head>
<body data-app-base="<?= e(app_base_path()) ?>">
<main class="auth-shell">
  <section class="auth-card">
    <a class="auth-logo-link" href="<?= e(app_url('/about.html')) ?>" aria-label="About ChatSpace Community Edition">
      <img class="auth-logo-full <?= $branding['has_custom_logo'] ? 'custom-brand-logo' : '' ?>" src="<?= e(app_url($branding['logo_path'])) ?>" alt="<?= e($branding['community_name'] ?: 'ChatSpace Community Edition') ?>">
    </a>
    <?php if ($error): ?><div class="error"><?= e($error) ?></div><?php endif; ?>
    <form class="form-grid" method="post" enctype="multipart/form-data">
      <label>Email<input type="email" name="email" required autocomplete="email"></label>
      <label>Display name<input name="display_name" required autocomplete="nickname"></label>
      <label>Avatar<input type="file" name="avatar" accept="image/jpeg,image/png,image/gif,image/webp" required></label>
      <label>Password<input type="password" name="password" required minlength="8" autocomplete="new-password"></label>
      <button class="btn btn-primary" type="submit">Sign Up</button>
      <p class="minor">Already have an account? <a href="<?= e(app_url('/login.php')) ?>">Log in</a></p>
      <p class="minor auth-about-link"><a href="<?= e(app_url('/about.html')) ?>">About ChatSpace Community Edition</a></p>
    </form>
    <?php if ($branding['has_custom_logo']): ?>
      <div class="powered-by auth-powered-by">
        <span>Powered by</span>
        <img src="<?= e(app_url($branding['powered_logo_path'])) ?>" alt="ChatSpace Community Edition">
      </div>
    <?php endif; ?>
  </section>
</main>
<script src="<?= e(app_url('/assets/js/avatar-processing.js')) ?>"></script>
<script src="<?= e(app_url('/assets/js/register.js')) ?>"></script>
</body>
</html>
