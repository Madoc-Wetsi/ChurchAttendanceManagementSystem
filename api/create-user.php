<?php
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/config.php';

if ($argc !== 3) {
    fwrite(STDERR, "Usage: php create-user.php \"Full name\" \"email@example.com\"\n");
    exit(1);
}

$name = trim($argv[1]);
$email = strtolower(trim($argv[2]));
$password = preg_replace('/[\r\n]+$/', '', stream_get_contents(STDIN));

if ($name === '' || strlen($name) > 190) {
    fwrite(STDERR, "Name must be between 1 and 190 characters.\n");
    exit(1);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 190) {
    fwrite(STDERR, "Enter a valid email address (maximum 190 characters).\n");
    exit(1);
}
if (strlen($password) < 12) {
    fwrite(STDERR, "Password must be at least 12 characters.\n");
    exit(1);
}

try {
    $stmt = db()->prepare(
        'INSERT INTO users (name, email, password_hash, role)
         VALUES (?, ?, ?, ?)'
    );
    $stmt->execute(array(
        $name,
        $email,
        password_hash($password, PASSWORD_DEFAULT),
        'admin',
    ));
    fwrite(STDOUT, "Account created for " . $email . ".\n");
} catch (PDOException $e) {
    if ($e->getCode() === '23000') {
        fwrite(STDERR, "An account with that email already exists.\n");
        exit(1);
    }
    throw $e;
}
