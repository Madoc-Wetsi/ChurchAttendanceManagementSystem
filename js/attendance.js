/* Take Attendance — the core screen */
(function () {
  const S = window.ChurchStore;
  const $ = (id) => document.getElementById(id);

  let date = S.key();
  let term = "";
  let record = {};

  $("att-date").value = date;

  function loadRecord() {
    record = S.getRecord(date);
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
          S.esc(m.email || m.phone || "No contact on file") +
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

  function setStatus(id, status) {
    const next = record[id] === status ? null : status; // click again to unmark
    if (next) record[id] = next;
    else delete record[id];

    S.setStatus(date, id, next);
    renderList();
  }

  /* ---- events ---- */
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
    renderList();
  });

  $("btn-all-present").addEventListener("click", function () {
    S.markAll(date, "present");
    loadRecord();
    renderList();
    toast("Everyone marked present", true);
  });

  $("btn-clear").addEventListener("click", function () {
    if (!Object.keys(record).length) return;
    if (!confirm("Clear all marks for " + S.prettyDate(date) + "?")) return;
    S.clearRecord(date);
    loadRecord();
    renderList();
    toast("Attendance cleared");
  });

  $("btn-save").addEventListener("click", function () {
    // Every toggle already persists — this just confirms and reports.
    const r = S.statsFor(date);
    if (!Object.keys(S.getRecord(date)).length) {
      toast("Nothing marked yet");
      return;
    }
    toast(
      "Saved · " + r.present + " present, " + r.absent + " absent, " + r.unmarked + " unmarked",
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

  loadRecord();
  renderList();
})();
