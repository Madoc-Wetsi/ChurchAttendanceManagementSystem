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

/* ---------- safety ---------- */
/* Optional shared secret. Leave '' to disable. If set, the front
   end must send it as the X-Church-Key header (see js/backend.js)
   and any request without it is refused. Use this if you put the
   app on a public server. */
define('API_SECRET', '');

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

/* ---------- shared secret check ---------- */
function check_secret() {
    if (API_SECRET === '') {
        return;
    }
    $sent = isset($_SERVER['HTTP_X_CHURCH_KEY'])
        ? $_SERVER['HTTP_X_CHURCH_KEY']
        : '';
    if (!hash_equals(API_SECRET, $sent)) {
        json_fail('Not authorised.', 401);
    }
}
