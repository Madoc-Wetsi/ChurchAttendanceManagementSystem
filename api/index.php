<?php
/* ============================================================
   Firstlove Church — API
   ------------------------------------------------------------
   The front end (js/backend.js) uses this authenticated API for
   the database and for private member-photo delivery:

     GET  index.php?action=bootstrap
          -> { ok: true, data: { members: [...],
                                 attendance: { "2026-10-25": { sunday: { id: "present" } } },
                                 bacentas:  [...] } }

     POST index.php          body: { collection: "members"|"attendance"|"bacentas",
                                     data: <the whole collection> }
          -> { ok: true }

   Why whole-collection writes? Because that is exactly how the
   browser store works — every change rewrites one list. It keeps
   the two sides in step with no bookkeeping. If you later need
   several people editing at once, swap saveCollection() for
   row-by-row endpoints; the front end only touches read/write.

   The tables live in schema.sql. Photos are pulled out of the
   JSON and saved to uploads/photos/ so the database stays lean.
   ============================================================ */

require __DIR__ . '/config.php';

$user = require_authenticated_user();

$action = isset($_GET['action']) ? $_GET['action'] : '';

if ($action === 'photo') {
    $name = isset($_GET['name']) ? $_GET['name'] : '';
    if (!is_string($name)
        || !preg_match('/^[A-Za-z0-9_-]+\.(jpg|png|gif|webp)$/i', $name)) {
        json_fail('Photo not found.', 404);
    }

    $path = UPLOAD_DIR . '/' . $name;
    $image = is_file($path) ? getimagesize($path) : false;
    $allowedTypes = array('image/jpeg', 'image/png', 'image/gif', 'image/webp');
    if (!$image || !in_array($image['mime'], $allowedTypes, true)) {
        json_fail('Photo not found.', 404);
    }

    header('Content-Type: ' . $image['mime']);
    header('Content-Length: ' . filesize($path));
    header('Cache-Control: private, no-store');
    header('X-Content-Type-Options: nosniff');
    readfile($path);
    exit;
}

/* ---------------------------------------------------------
   Bootstrap — hand the whole database over in one go.
   --------------------------------------------------------- */
if ($action === 'bootstrap') {
    json_out(array(
        'ok'        => true,
        'user'      => $user,
        'csrfToken' => ensure_csrf_token(),
        'data'      => array(
            'members'    => loadMembers(),
            'attendance' => loadAttendance(),
            'bacentas'   => loadBacentas(),
        ),
    ));
}

/* ---------------------------------------------------------
   Save — one collection, sent whole from the browser.
   --------------------------------------------------------- */
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_fail('Use ?action=bootstrap to read, or POST to save.', 405);
}

require_csrf_token();

$body = request_body();

$collection = isset($body['collection']) ? $body['collection'] : '';
if (!is_string($collection)
    || !array_key_exists($collection, array('members' => 1, 'attendance' => 1, 'bacentas' => 1))) {
    json_fail('Unknown collection.');
}

$data = isset($body['data']) ? $body['data'] : null;
if (!is_array($data)) {
    json_fail('Expected "data" to be an array for collection ' . $collection . '.');
}

try {
    switch ($collection) {
        case 'members':
            saveMembers($data);
            break;
        case 'attendance':
            saveAttendance($data);
            break;
        case 'bacentas':
            saveBacentas($data);
            break;
    }
} catch (PDOException $e) {
    json_fail(
        API_DEBUG ? $e->getMessage() : 'Database error while saving.',
        500
    );
}

json_out(array('ok' => true));


/* ============================================================
   Read
   ============================================================ */

function loadMembers() {
    $rows = db()->query(
        'SELECT id, first, last, email, phone, location, bacenta,
                ministry, dob, photo, joined
           FROM members
          ORDER BY last, first'
    )->fetchAll();

    return array_map(function ($r) {
        return array(
            'id'       => $r['id'],
            'first'    => $r['first'],
            'last'     => $r['last'],
            'email'    => $r['email'],
            'phone'    => $r['phone'],
            'location' => $r['location'],
            'bacenta'  => $r['bacenta'],
            'ministry' => $r['ministry'],
            // DATE comes back as "Y-m-d"; the front end wants the
            // same shape, and "" for "not set".
            'dob'      => $r['dob'] ?: '',
            'photo'    => photoToUrl($r['photo']),
            'joined'   => $r['joined'] ?: '',
        );
    }, $rows);
}

function loadAttendance() {
    $rows = db()->query(
        'SELECT service_date, service_type, member_id, status
           FROM attendance
          ORDER BY service_date, service_type'
    )->fetchAll();

    $out = array();
    foreach ($rows as $r) {
        $date = $r['service_date'];
        $type = $r['service_type'];
        if (!isset($out[$date]))      $out[$date] = array();
        if (!isset($out[$date][$type])) $out[$date][$type] = array();
        $out[$date][$type][$r['member_id']] = $r['status'];
    }
    // The browser expects an object here. An empty PHP array would
    // arrive as [] and every "no services yet" check would miss.
    return empty($out) ? new stdClass() : $out;
}

function loadBacentas() {
    $rows = db()->query(
        'SELECT id, name, location, created
           FROM bacentas
          ORDER BY name'
    )->fetchAll();

    return array_map(function ($r) {
        return array(
            'id'      => $r['id'],
            'name'    => $r['name'],
            'location'=> $r['location'],
            'created' => $r['created'] ? date('Y-m-d', strtotime($r['created'])) : '',
        );
    }, $rows);
}


/* ============================================================
   Write
   ------------------------------------------------------------
   Each saver writes inside a transaction and treats the payload
   as the complete truth for that collection: rows that are no
   longer present are deleted. That way removing a member in the
   app really removes them from the database.
   ============================================================ */

function saveMembers(array $members) {
    $pdo = db();
    $pdo->beginTransaction();

    try {
        $keep = array();
        $sql  = 'INSERT INTO members
                     (id, first, last, email, phone, location, bacenta,
                      ministry, dob, photo, joined)
                 VALUES
                     (:id, :first, :last, :email, :phone, :location, :bacenta,
                      :ministry, :dob, :photo, :joined)
                 ON DUPLICATE KEY UPDATE
                     first     = VALUES(first),
                     last      = VALUES(last),
                     email     = VALUES(email),
                     phone     = VALUES(phone),
                     location  = VALUES(location),
                     bacenta   = VALUES(bacenta),
                     ministry  = VALUES(ministry),
                     dob       = VALUES(dob),
                     photo     = VALUES(photo),
                     joined    = VALUES(joined)';

        $stmt = $pdo->prepare($sql);

        foreach ($members as $m) {
            $id = isset($m['id']) ? trim((string) $m['id']) : '';
            if ($id === '') {
                continue; // no id, no way to update it later
            }
            $keep[] = $id;

            $stmt->execute(array(
                ':id'       => $id,
                ':first'    => strval(isset($m['first'])  ? $m['first']  : ''),
                ':last'     => strval(isset($m['last'])   ? $m['last']   : ''),
                ':email'    => strval(isset($m['email'])  ? $m['email']  : ''),
                ':phone'    => strval(isset($m['phone'])  ? $m['phone']  : ''),
                ':location' => strval(isset($m['location'])? $m['location']: ''),
                ':bacenta'  => strval(isset($m['bacenta']) ? $m['bacenta'] : ''),
                ':ministry' => strval(isset($m['ministry'])? $m['ministry']: ''),
                ':dob'      => sqlDate(isset($m['dob']) ? $m['dob'] : ''),
                ':photo'    => photoFromInput(
                                    isset($m['photo']) ? $m['photo'] : '',
                                    $id
                               ),
                ':joined'   => sqlDate(isset($m['joined']) ? $m['joined'] : ''),
            ));
        }

        deleteMissing('members', 'id', $keep);
        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function saveAttendance(array $attendance) {
    $pdo = db();
    $pdo->beginTransaction();

    try {
        $stmt = $pdo->prepare(
            'INSERT INTO attendance (service_date, service_type, member_id, status)
             VALUES (:d, :t, :m, :s)
             ON DUPLICATE KEY UPDATE status = VALUES(status)'
        );
        $exists = $pdo->prepare(
            'SELECT 1 FROM members WHERE id = :m LIMIT 1'
        );

        // The front end only sends attendance for members it knows,
        // but a record could linger after a member was removed. Skip
        // rather than fail the whole save on the foreign key.
        $keep = array();

        foreach ($attendance as $date => $byType) {
            if (!is_array($byType)) {
                continue;
            }
            foreach ($byType as $type => $byMember) {
                if (!is_array($byMember)) {
                    continue;
                }
                foreach ($byMember as $memberId => $status) {
                    if ($status !== 'present' && $status !== 'absent') {
                        continue;
                    }
                    $exists->execute(array(':m' => $memberId));
                    if (!$exists->fetchColumn()) {
                        continue;
                    }
                    $stmt->execute(array(
                        ':d' => sqlDate($date),
                        ':t' => (string) $type,
                        ':m' => (string) $memberId,
                        ':s' => (string) $status,
                    ));
                    $keep[] = $date . '|' . $type . '|' . $memberId;
                }
            }
        }

        // Anything the browser no longer holds goes.
        $rows = $pdo->query(
            'SELECT service_date, service_type, member_id FROM attendance'
        )->fetchAll();

        $del = $pdo->prepare(
            'DELETE FROM attendance
              WHERE service_date = :d
                AND service_type = :t
                AND member_id = :m'
        );
        foreach ($rows as $r) {
            $composite = $r['service_date'] . '|' . $r['service_type'] . '|' . $r['member_id'];
            if (!in_array($composite, $keep, true)) {
                $del->execute(array(
                    ':d' => $r['service_date'],
                    ':t' => $r['service_type'],
                    ':m' => $r['member_id'],
                ));
            }
        }

        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function saveBacentas(array $bacentas) {
    $pdo = db();
    $pdo->beginTransaction();

    try {
        $stmt = $pdo->prepare(
            'INSERT INTO bacentas (id, name, location, created)
             VALUES (:id, :name, :location, :created)
             ON DUPLICATE KEY UPDATE
                 name     = VALUES(name),
                 location = VALUES(location)'
        );

        $keep = array();
        foreach ($bacentas as $b) {
            $id = isset($b['id']) ? trim((string) $b['id']) : '';
            $name = isset($b['name']) ? trim((string) $b['name']) : '';
            if ($id === '' || $name === '') {
                continue;
            }
            $keep[] = $id;

            $created = null;
            if (!empty($b['created'])) {
                $ts = strtotime($b['created']);
                if ($ts !== false) {
                    $created = date('Y-m-d H:i:s', $ts);
                }
            }

            $stmt->execute(array(
                ':id'       => $id,
                ':name'     => $name,
                ':location' => strval(isset($b['location']) ? $b['location'] : ''),
                ':created'  => $created,
            ));
        }

        deleteMissing('bacentas', 'id', $keep);
        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}


/* ============================================================
   Helpers
   ============================================================ */

/* Remove every row whose id isn't in $keep. */
function deleteMissing($table, $column, array $keep) {
    $pdo = db();
    $rows = $pdo->query("SELECT $column FROM $table")->fetchAll(PDO::FETCH_COLUMN);

    if (!$keep) {
        // Nothing was sent, so the collection is genuinely empty.
        if ($rows) {
            $pdo->exec("DELETE FROM $table");
        }
        return;
    }

    $toDelete = array_diff($rows, $keep);
    if (!$toDelete) {
        return;
    }

    $in = implode(',', array_fill(0, count($toDelete), '?'));
    $stmt = $pdo->prepare("DELETE FROM $table WHERE $column IN ($in)");
    $stmt->execute(array_values($toDelete));
}

/* "2026-10-25" -> "2026-10-25"; anything unparseable -> NULL,
   which MySQL stores as an empty date rather than an error. */
function sqlDate($value) {
    $value = trim(strval($value));
    if ($value === '') {
        return null;
    }
    $ts = strtotime($value);
    return $ts === false ? null : date('Y-m-d', $ts);
}

/* The browser sends a photo as a data: URI. Save it to disk and
   keep only the file name in the database — a table full of
   base64 would be enormous and slow to read. */
function photoFromInput($photo, $memberId) {
    $photo = strval($photo);
    if ($photo === '' || strpos($photo, 'data:image/') !== 0) {
        // Either no photo, or a plain path/URL from an earlier save.
        return $photo === '' ? null : $photo;
    }

    if (!is_dir(UPLOAD_DIR)) {
        @mkdir(UPLOAD_DIR, 0775, true);
    }

    $comma = strpos($photo, ',');
    if ($comma === false) {
        return null;
    }

    $meta  = substr($photo, 5, $comma - 5);      // "jpeg;base64"
    $bin   = base64_decode(substr($photo, $comma + 1), true);
    if ($bin === false || strlen($bin) > MAX_PHOTO_BYTES) {
        return null;
    }

    $ext = 'jpg';
    if (stripos($meta, 'png')  !== false) $ext = 'png';
    if (stripos($meta, 'gif')  !== false) $ext = 'gif';
    if (stripos($meta, 'webp') !== false) $ext = 'webp';

    // The member id is generated by the app and is unique, so it
    // makes a safe, predictable file name.
    $safe = preg_replace('/[^a-zA-Z0-9_-]/', '', $memberId);
    if ($safe === '') {
        $safe = substr(md5($memberId . microtime()), 0, 16);
    }

    $file = $safe . '.' . $ext;
    if (@file_put_contents(UPLOAD_DIR . '/' . $file, $bin) === false) {
        return null;
    }

    return UPLOAD_URL . '/' . $file;
}

/* Turn a stored photo back into something an <img src> accepts.
   Data URIs and full URLs pass straight through; a saved file
   name is turned into a path starting at the site root, so it
   works from /pages/, /auth/ and the landing page alike.       */
function photoToUrl($photo) {
    $photo = strval($photo);
    if ($photo === '') {
        return '';
    }
    if (strpos($photo, 'data:') === 0 || strpos($photo, 'http') === 0) {
        return $photo;
    }

    // Serve uploaded photos through the authenticated API.
    $script = isset($_SERVER['SCRIPT_NAME']) ? $_SERVER['SCRIPT_NAME'] : '/api/index.php';
    $base   = rtrim(str_replace('\\', '/', dirname($script)), '/');   // e.g. /ChurchAttendanceManagementSystem/api
    $base   = preg_replace('#/api$#', '', $base);                    // drop the /api part
    $file   = preg_replace('#^.*?uploads/photos/#', '', $photo);      // keep just the file name

    return $base . '/api/index.php?action=photo&name=' . rawurlencode($file);
}
