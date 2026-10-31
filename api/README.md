# Database setup — Firstlove Church, Godokpe Governorship

The app runs two ways. Nothing in the interface changes between
them — only where the records are kept. It is currently configured
for the local PHP/MySQL API.

| Mode      | Where data lives        | Needs PHP/MySQL |
| --------- | ----------------------- | --------------- |
| **Demo**  | This browser only       | No              |
| **API**   | MySQL, through `api/`   | Yes             |

To use browser-only demo mode instead, set `apiBase` to `""` in
`js/config.js`. The local API mode requires Apache and MySQL to be
running in XAMPP.

---

## 1. API mode setting

`js/config.js`:

```js
window.CHURCH_CONFIG = {
  apiBase: "api",
};
```

The project is already set to this value. The path is resolved from
the project root, so it works from `/pages/` and `/auth/`.

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

## 4. Check it answered

Visit:

```
http://localhost/ChurchAttendanceManagementSystem/api/index.php?action=bootstrap
```

You should see `{"ok":true,"data":{...}}` with your bacentas in it.
If you see a database error, it is almost always the credentials.

Then open the app and **hard-refresh (Ctrl+F5)**.

---

## How the two sides talk

`js/backend.js` sits between the pages and your PHP. On start-up it
downloads everything once, then pushes each collection back up
whenever a page saves. If the API is unreachable it says so in the
browser console and quietly keeps running on the browser's own
storage — the app never blanks out because the server is down.

The contract is two endpoints, both JSON:

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

`api/uploads/photos/` should stay writable by Apache. A blank
`.htaccess` is not required, but if you later host this publicly,
restrict that folder to image files only.

---

## Replacing this PHP with your own

You only have to honour the two endpoints above. The pages never
call PHP directly — they go through `js/store.js`, which is the
single place that reads and writes. So you can rewrite `api/`
entirely, or point `apiBase` at a completely different server.

If you need row-by-row endpoints, or several people editing at
once, swap `saveCollection()` in `api/index.php` and change
`push()` in `js/backend.js`. Nothing else needs to know.

## Going live

Set `API_SECRET` in `api/config.php` to a long random string, then
send it from `js/backend.js` as an `X-Church-Key` header on both
the bootstrap fetch and the POST. Any request without it is refused.
Leave it as `''` while developing.

`api/schema.sql` also creates a `users` table ready for real
sign-in. The app ships with demo auth kept in the browser, so that
is yours to wire up when you want password login.

## Troubleshooting

**Everything still shows old browser data** — you are in demo
mode. Confirm `apiBase` is `"api"`, then Ctrl+F5.

**A red 404 in the console for `.../pages/api/index.php`** — an
older copy of `js/backend.js` is cached. Ctrl+F5.

**"Database connection failed"** — credentials in `api/config.php`,
or the database was never imported.

**"Could not reach ... running on this browser's storage instead"**
— the API did not answer. The app keeps working locally; fix the
server and refresh.
