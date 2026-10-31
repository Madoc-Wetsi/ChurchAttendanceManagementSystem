# Database setup — Firstlove Church, Godokpe Governorship

The app runs two ways. Nothing in the interface changes between
them — only where the records are kept. It is currently configured
for API/database mode by default.

| Mode      | Where data lives        | Needs PHP/MySQL |
| --------- | ----------------------- | --------------- |
| **Demo**  | This browser only       | No              |
| **API**   | MySQL, through `api/`   | Yes             |

To use browser-only demo mode instead, set `apiBase` to `""` in
`js/config.js`. API mode requires the MySQL setup below.

---

## 1. API mode setting

`js/config.js`:

```js
window.CHURCH_CONFIG = {
  apiBase: "api",
};
```

The project is already set to this value. The path is resolved from
the project root, so it works from `/pages/`, `/auth/` and any
install folder. Set it to `""` to use browser-only demo mode.

## 2. Create the database

Open **http://localhost/phpmyadmin** → *New* → database name
`church_attendance` → *Create*, then *Import* → choose
`api/schema.sql` → *Go*.

Or from a terminal:

```
C:\xampp\mysql\bin\mysql -u root < api\schema.sql
```

This creates four tables (`members`, `bacentas`, `attendance`,
`users`) and seeds Godokpe 1–5.

## 3. Check your credentials

`api/config.php` ships set up for stock XAMPP — host `127.0.0.1`,
user `root`, empty password. Change `DB_NAME`, `DB_USER` and
`DB_PASS` if yours differ.

## 4. Create sign-in accounts

API mode does not allow public registration. An administrator
creates each account from the project root using the PHP CLI script.
It reads the password from standard input and stores only a PHP
`password_hash()` hash in the existing `users` table.

In PowerShell, run:

```powershell
$secure = Read-Host "New account password" -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) |
    & 'C:\xampp\php\php.exe' 'api\create-user.php' 'Jane Doe' 'jane@example.com'
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}
```

Replace the sample name and email with the account details. Passwords
must be at least 12 characters. Accounts are assigned the existing
`admin` role. The script runs only from PHP CLI, not through Apache.

To set or replace the password for an existing account, use:

```powershell
$secure = Read-Host "New account password" -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) |
    & 'C:\xampp\php\php.exe' 'api\set-user-password.php' 'jane@example.com'
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}
```

Replace the sample email with the existing account's email.

If PHP is not at `C:\xampp\php\php.exe`, replace that path with the
PHP CLI path on your machine.

## 5. Check the app

Open the app and **hard-refresh (Ctrl+F5)**, then sign in using the
account created above. An unauthenticated request to
`api/index.php?action=bootstrap` should return HTTP 401.

---

## How the two sides talk

`js/backend.js` sits between the pages and your PHP. On start-up it
downloads the database after the server verifies the session, then
pushes each collection back up whenever a page saves. Login is
handled by `api/auth.php`; the server verifies password hashes and
issues an HttpOnly session cookie. The data API rejects requests
without a valid session, and save requests also require a CSRF token.
If the API is unavailable, the app displays an error instead of
silently switching to browser storage.

The data contract uses two JSON endpoints:

**Read everything**

```
GET api/index.php?action=bootstrap
-> { ok: true, data: { members: [], attendance: {}, bacentas: [] } }
```

**Write one collection** (sent whole, which is how the browser
store already works — every change rewrites one list)

```
POST api/index.php
{ "collection": "members", "data": [ ... ] }
-> { ok: true }
```

`collection` is one of `members`, `attendance` or `bacentas`.
A save treats the payload as the full truth for that collection:
rows missing from it are deleted. Removing a member in the app
therefore removes them from MySQL, and their attendance goes with
them (foreign key `ON DELETE CASCADE`).

**Authentication**

```
POST api/auth.php?action=login
{ "email": "jane@example.com", "password": "..." }
-> { "ok": true, "user": { ... }, "csrfToken": "..." }

POST api/auth.php?action=logout
-> { "ok": true }
```

The session is stored server-side; the browser receives only an
HttpOnly session cookie. Registration requests are rejected in API
mode. Every data request checks the session, and save/logout requests
also check the CSRF token.

---

## Photos

The front end reads a photo into memory as a data URI. Saving sends
it to PHP, which writes it to `api/uploads/photos/` and keeps only
the file name in the database — a table full of base64 would be
enormous and slow. On the way back out it is turned into a URL again.

Two settings in `api/config.php`:

* `UPLOAD_DIR` / `UPLOAD_URL` — where photos land
* `MAX_PHOTO_BYTES` — default 4 MB

Also check `upload_max_filesize` and `post_max_size` in
`C:\xampp\php\php.ini` if large photos ever go missing. Restart
Apache after changing them.

`api/uploads/photos/` should stay writable by Apache. Direct web
access to this folder is denied; images are returned through the
authenticated API.

---

## Replacing this PHP with your own

You only have to honour the two endpoints above. The pages never
call PHP directly — they go through `js/store.js`, which is the
single place that reads and writes. So you can rewrite `api/`
entirely, or point `apiBase` at a completely different server.

If you need row-by-row endpoints, or several people editing at
once, swap `saveCollection()` in `api/index.php` and change
`push()` in `js/backend.js`. Nothing else needs to know.

## Before hosting publicly

Use HTTPS, set a strong non-root database account in
`api/config.php`, and set `API_DEBUG` to `false`. HTTPS is required
for the session cookie to use its `Secure` flag. Keep the API and app
on the same origin unless you also configure and test a strict CORS
policy. Demo mode (`apiBase: ""`) is not server authentication and
must not be used to protect real data.

## Troubleshooting

**Everything still shows old browser data** — you are in demo
mode. Confirm `apiBase` is `"api"`, then Ctrl+F5.

**A red 404 in the console for `.../pages/api/index.php`** — an
older copy of `js/backend.js` is cached. Ctrl+F5.

**"Database connection failed"** — credentials in `api/config.php`,
or the database was never imported.

**HTTP 401 / redirected to sign in** — no valid server session is
present. Sign in with an account already in the `users` table.

**"Could not load the database"** — the API did not answer. Check
Apache, MySQL, and the database credentials, then reload.
