<?php
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/config.php';

if ($argc !== 2) {
    fwrite(STDERR, "Usage: php set-user-password.php \"email@example.com\"\n");
    exit(1);
}

$email = strtolower(trim($argv[1]));
$password = preg_replace('/[\r\n]+$/', '', stream_get_contents(STDIN));

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 190) {
    fwrite(STDERR, "Enter the account's valid email address.\n");
    exit(1);
}
if (strlen($password) < 12) {
    fwrite(STDERR, "Password must be at least 12 characters.\n");
    exit(1);
}

$stmt = db()->prepare(
    'UPDATE users SET password_hash = ? WHERE email = ?'
);
$stmt->execute(array(password_hash($password, PASSWORD_DEFAULT), $email));

if ($stmt->rowCount() === 0) {
    $check = db()->prepare('SELECT 1 FROM users WHERE email = ? LIMIT 1');
    $check->execute(array($email));
    if (!$check->fetchColumn()) {
        fwrite(STDERR, "No account exists with that email address.\n");
        exit(1);
    }
}

fwrite(STDOUT, "Password updated. Sign in with the new password.\n");
