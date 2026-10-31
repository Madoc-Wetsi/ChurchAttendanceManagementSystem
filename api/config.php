<?php
/* ============================================================
   Firstlove Church, Godokpe Governorship — API configuration
   ------------------------------------------------------------
   EDIT THIS FILE to match your machine / hosting.

   Everything the rest of the API needs (connection, helpers,
   the JSON contract) lives here so index.php stays readable.
   ============================================================ */

/* ---------- database ---------- */
define('DB_HOST', '127.0.0.1');   // XAMPP default. Use 'localhost' if preferred.
define('DB_NAME', 'church_attendance');
define('DB_USER', 'root');
define('DB_PASS', '');            // XAMPP ships with an empty root password.
define('DB_PORT', '3306');

/* ---------- uploads ---------- */
/* Member photos are written to disk and only the path is stored
   in MySQL. Base64 blobs inside the members table would bloat it
   badly and slow every query down. */
define('UPLOAD_DIR', __DIR__ . '/uploads/photos');
define('UPLOAD_URL', 'api/uploads/photos');

/* Uploaded photos larger than this are rejected (bytes). */
define('MAX_PHOTO_BYTES', 4 * 1024 * 1024);

/* Set to false once you are happy, to silence warnings. */
define('API_DEBUG', true);

/* ============================================================
   Nothing below needs editing.
   ============================================================ */

if (API_DEBUG) {
    ini_set('display_errors', '1');
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', '0');
}

/* ---------- JSON helpers ---------- */
function json_out($payload, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_fail($message, $status = 400) {
    json_out(array('ok' => false, 'error' => $message), $status);
}

/* The whole request body as an array, whether it arrived as JSON
   (what js/backend.js sends) or as form fields. */
function request_body() {
    $raw = file_get_contents('php://input');
    if ($raw !== '' && $raw !== false) {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            return $decoded;
        }
    }
    return $_POST;
}

/* ---------- database ---------- */
function db() {
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
        DB_HOST,
        DB_PORT,
        DB_NAME
    );

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, array(
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ));
    } catch (PDOException $e) {
        /* Tell the developer exactly what went wrong; never leak it
           to the public when debug is off. */
        $detail = API_DEBUG
            ? $e->getMessage()
            : 'Could not connect to the database.';
        json_fail('Database connection failed: ' . $detail, 500);
    }

    return $pdo;
}

/* ---------- authenticated sessions ---------- */
function start_app_session() {
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.gc_maxlifetime', '28800');
    session_name('CHURCHSESSID');
    session_set_cookie_params(array(
        'lifetime' => 0,
        'path' => '/',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Lax',
    ));
    session_start();

    if (isset($_SESSION['user_id'], $_SESSION['last_activity'])
        && time() - (int) $_SESSION['last_activity'] > 28800) {
        $_SESSION = array();
        session_regenerate_id(true);
    }

    $_SESSION['last_activity'] = time();
}

function current_user() {
    if (!isset($_SESSION['user_id'])) {
        return null;
    }

    $stmt = db()->prepare(
        'SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1'
    );
    $stmt->execute(array((int) $_SESSION['user_id']));
    $user = $stmt->fetch();
    if (!$user) {
        $_SESSION = array();
        session_regenerate_id(true);
        return null;
    }

    return array(
        'id' => (int) $user['id'],
        'name' => $user['name'],
        'email' => $user['email'],
        'role' => $user['role'],
    );
}

function require_authenticated_user() {
    start_app_session();
    $user = current_user();
    if (!$user) {
        json_fail('Please sign in to continue.', 401);
    }
    return $user;
}

function ensure_csrf_token() {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function require_csrf_token() {
    $sent = isset($_SERVER['HTTP_X_CSRF_TOKEN'])
        ? $_SERVER['HTTP_X_CSRF_TOKEN']
        : '';
    if (empty($_SESSION['csrf_token'])
        || !hash_equals($_SESSION['csrf_token'], $sent)) {
        json_fail('Your session expired. Please sign in again.', 403);
    }
}

function destroy_app_session() {
    $_SESSION = array();
    $params = session_get_cookie_params();
    setcookie(session_name(), '', array(
        'expires' => time() - 42000,
        'path' => $params['path'],
        'secure' => $params['secure'],
        'httponly' => $params['httponly'],
        'samesite' => 'Lax',
    ));
    session_destroy();
}
