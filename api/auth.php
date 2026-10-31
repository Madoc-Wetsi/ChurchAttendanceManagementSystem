<?php
require __DIR__ . '/config.php';

start_app_session();
$action = isset($_GET['action']) ? $_GET['action'] : '';

if ($action === 'login') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_fail('Use POST to sign in.', 405);
    }

    $body = request_body();
    $email = isset($body['email']) && is_string($body['email'])
        ? strtolower(trim($body['email']))
        : '';
    $password = isset($body['password']) && is_string($body['password'])
        ? $body['password']
        : '';
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
        json_fail('Email or password is incorrect.', 401);
    }

    $stmt = db()->prepare(
        'SELECT id, name, email, password_hash, role
           FROM users
          WHERE email = ?
          LIMIT 1'
    );
    $stmt->execute(array($email));
    $record = $stmt->fetch();

    if (!$record || !password_verify($password, $record['password_hash'])) {
        json_fail('Email or password is incorrect.', 401);
    }

    if (password_needs_rehash($record['password_hash'], PASSWORD_DEFAULT)) {
        $update = db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        $update->execute(array(
            password_hash($password, PASSWORD_DEFAULT),
            (int) $record['id'],
        ));
    }

    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $record['id'];
    $_SESSION['last_activity'] = time();
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));

    json_out(array(
        'ok' => true,
        'user' => array(
            'id' => (int) $record['id'],
            'name' => $record['name'],
            'email' => $record['email'],
            'role' => $record['role'],
        ),
        'csrfToken' => $_SESSION['csrf_token'],
    ));
}

if ($action === 'logout') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_fail('Use POST to sign out.', 405);
    }
    require_authenticated_user();
    require_csrf_token();
    destroy_app_session();
    json_out(array('ok' => true));
}

if ($action === 'register') {
    json_fail('Accounts must be created by an administrator.', 403);
}

json_fail('Unknown authentication action.', 404);
