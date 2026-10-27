/* Take Attendance — the core screen.
   Handles two service types: Sunday and Midweek. */
(function () {
  const S = window.ChurchStore;
  const $ = (id) => document.getElementById(id);

  let type = "sunday";
  let date = S.defaultDateFor(type);
  let term = "";
  let record = {};

  $("att-date").value = date;

  function loadRecord() {
    record = S.getRecord(date, type);
  }

  function initials(m) {
    return ((m.first || "").charAt(0) + (m.last || "").charAt(0)).toUpperCase() || "?";
  }

  function avatarHTML(m) {
    return m.photo
      ? '<span class="avatar"><img class="avatar" src="' + S.esc(m.photo) + '" alt=""></span>'
      : '<span class="avatar">' + S.esc(initials(m)) + "</span>";
  }

  function statusBadge(status) {
    if (status === "present") return '<span class="badge badge-present">Present</span>';
    if (status === "absent") return '<span class="badge badge-absent">Absent</span>';
    return '<span class="badge badge-unmarked">Unmarked</span>';
  }

  function renderHead() {
    $("svc-tag").textContent = S.typeLabel(type);
    $("svc-date").textContent = S.prettyDate(date);

    Array.prototype.forEach.call(
      $("svc-switch").querySelectorAll("button[data-type]"),
      function (b) {
        b.classList.toggle("on", b.getAttribute("data-type") === type);
      }
    );

    // Title reflects which sheet you're on
    document.title = S.typeShort(type) + " Attendance — First Love Church";
  }

  function renderCounts() {
    const all = S.getMembers();
    let present = 0;
    let absent = 0;

    all.forEach(function (m) {
      if (record[m.id] === "present") present++;
      else if (record[m.id] === "absent") absent++;
    });

    $("c-present").textContent = present;
    $("c-absent").textContent = absent;
    $("c-unmarked").textContent = all.length - present - absent;
    $("c-total").textContent = all.length;
  }

  function renderList() {
    const members = S.searchMembers(term);
    const list = $("att-list");

    if (!members.length) {
      const emptyRegister = !S.getMembers().length;
      list.innerHTML =
        '<div class="empty"><strong>' +
        (emptyRegister ? "No members yet" : "No members found") +
        "</strong>" +
        (emptyRegister
          ? "Add your first member, then come back to take attendance."
          : "Try a different search.") +
        "</div>";
      renderCounts();
      return;
    }

    list.innerHTML = members
      .map(function (m) {
        const status = record[m.id];
        return (
          '<div class="att-row" data-id="' +
          S.esc(m.id) +
          '">' +
          '<div class="att-who">' +
          avatarHTML(m) +
          "<div>" +
          '<div class="att-name">' +
          S.esc(m.first + " " + m.last) +
          "</div>" +
          '<div class="att-meta">' +
          S.esc(m.ministry || m.email || m.phone || "No details on file") +
          "</div>" +
          "</div></div>" +
          '<div class="seg">' +
          '<button type="button" data-status="present" class="' +
          (status === "present" ? "on-present" : "") +
          '">Present</button>' +
          '<button type="button" data-status="absent" class="' +
          (status === "absent" ? "on-absent" : "") +
          '">Absent</button>' +
          "</div>" +
          '<div class="hide-mobile">' +
          statusBadge(status) +
          "</div>" +
          "</div>"
        );
      })
      .join("");

    renderCounts();
  }

  function render() {
    renderHead();
    renderList();
  }

  function setStatus(id, status) {
    const next = record[id] === status ? null : status; // click again to unmark
    if (next) record[id] = next;
    else delete record[id];

    S.setStatus(date, type, id, next);
    renderList();
  }

  /* ---- service switch ---- */
  $("svc-switch").addEventListener("click", function (e) {
    const btn = e.target.closest("button[data-type]");
    if (!btn) return;
    const next = btn.getAttribute("data-type");
    if (next === type) return;

    type = next;
    date = S.defaultDateFor(type);
    $("att-date").value = date;
    loadRecord();
    render();
  });

  /* ---- attendance list ---- */
  $("att-list").addEventListener("click", function (e) {
    const btn = e.target.closest("button[data-status]");
    if (!btn) return;
    const row = btn.closest(".att-row");
    if (!row) return;
    setStatus(row.getAttribute("data-id"), btn.getAttribute("data-status"));
  });

  $("att-search").addEventListener("input", function (e) {
    term = e.target.value;
    renderList();
  });

  $("att-date").addEventListener("change", function (e) {
    if (!e.target.value) return;
    date = e.target.value;
    loadRecord();
    render();
  });

  $("btn-all-present").addEventListener("click", function () {
    if (!S.getMembers().length) {
      toast("Add members first");
      return;
    }
    S.markAll(date, type, "present");
    loadRecord();
    renderList();
    toast("Everyone marked present for " + S.typeShort(type), true);
  });

  $("btn-clear").addEventListener("click", function () {
    if (!Object.keys(record).length) return;
    if (!confirm("Clear all marks for " + S.typeLabel(type) + " on " + S.prettyDate(date) + "?"))
      return;
    S.clearRecord(date, type);
    loadRecord();
    renderList();
    toast("Attendance cleared");
  });

  $("btn-save").addEventListener("click", function () {
    // Every toggle already persists — this confirms and reports.
    if (!Object.keys(S.getRecord(date, type)).length) {
      toast("Nothing marked yet");
      return;
    }
    const r = S.statsFor(date, type);
    toast(
      S.typeShort(type) +
        " saved · " +
        r.present +
        " present, " +
        r.absent +
        " absent, " +
        r.unmarked +
        " unmarked",
      true
    );
  });

  function toast(msg, ok) {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.toggle("ok", !!ok);
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(function () {
      el.classList.remove("show");
    }, 2600);
  }

  // Deep-link a specific sheet: attendance.html?type=midweek&date=2026-10-25
  // ?date= comes from History's "Reopen sheet" link, so both must be read
  // before the initial loadRecord().
  const params = new URLSearchParams(window.location.search);
  const wanted = params.get("type");
  if (wanted && S.SERVICE_TYPES[wanted]) {
    type = wanted;
    date = S.defaultDateFor(type);
  }
  const wantedDate = params.get("date");
  if (wantedDate && /^\d{4}-\d{2}-\d{2}$/.test(wantedDate)) {
    date = wantedDate;
  }
  $("att-date").value = date;

  loadRecord();
  render();
})();
