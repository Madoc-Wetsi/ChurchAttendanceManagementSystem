/* History — the attendance log, both by service and by member */
(function () {
  const S = window.ChurchStore;
  const $ = (id) => document.getElementById(id);

  let view = "services";
  let typeFilter = "";
  let dateTerm = "";
  let memberTerm = "";

  const user = S.getUser();
  if (user) $("side-user").textContent = user.name;

  /* ---------------- headline stats ---------------- */
  function renderStats() {
    const services = S.serviceHistory();
    const all = S.listServices();

    let marks = 0;
    let rateSum = 0;
    let best = null;

    services.forEach(function (svc) {
      marks += svc.stats.present + svc.stats.absent;
      rateSum += svc.stats.rate;
      if (svc.stats.total && (!best || svc.stats.rate > best.rate)) {
        best = { rate: svc.stats.rate, date: svc.date, type: svc.type, present: svc.stats.present, total: svc.stats.total };
      }
    });

    $("h-total").textContent = all.length;
    $("h-breakdown").textContent =
      S.countServices("sunday") + " Sunday · " + S.countServices("midweek") + " Midweek";
    $("h-marks").textContent = marks;
    $("h-avg").textContent = services.length
      ? Math.round(rateSum / services.length) + "%"
      : "—";

    if (best) {
      $("h-best").textContent = best.rate + "%";
      $("h-best-sub").textContent =
        best.present + " of " + best.total + " · " + S.shortDate(best.date);
    } else {
      $("h-best").textContent = "—";
      $("h-best-sub").textContent = "No services yet";
    }
  }

  /* ---------------- by service ---------------- */
  function initials(m) {
    return ((m.first || "").charAt(0) + (m.last || "").charAt(0)).toUpperCase() || "?";
  }

  function matchesDate(svc) {
    if (!dateTerm) return true;
    const q = dateTerm.toLowerCase();
    return (
      svc.date.indexOf(q) > -1 ||
      S.prettyDate(svc.date).toLowerCase().indexOf(q) > -1 ||
      svc.label.toLowerCase().indexOf(q) > -1
    );
  }

  function renderServices() {
    const list = $("hist-services");
    const services = S.serviceHistory(typeFilter).filter(matchesDate);

    $("h-count").textContent =
      services.length + (services.length === 1 ? " service" : " services");

    if (!services.length) {
      list.innerHTML =
        '<div class="empty"><strong>' +
        (S.listServices().length ? "No services match your filters" : "No history yet") +
        "</strong>" +
        (S.listServices().length
          ? "Try a different type or search term."
          : "Take attendance and your history will build up here.") +
        "</div>";
      return;
    }

    list.innerHTML = services
      .map(function (svc, i) {
        const rate = svc.stats.rate;
        return (
          '<div class="hist-item" data-key="' + S.esc(svc.date + "|" + svc.type) + '">' +
          '<button type="button" class="hist-row" data-toggle="' + i + '" aria-expanded="false">' +
          '<span class="when">' +
          '<span class="badge badge-svc">' + S.esc(S.typeShort(svc.type)) + "</span>" +
          '<span class="d">' + S.esc(S.prettyDate(svc.date)) + "</span>" +
          "</span>" +
          '<span class="figs">' +
          '<span class="fig ok"><b>' + svc.stats.present + "</b>present</span>" +
          '<span class="fig no"><b>' + svc.stats.absent + "</b>absent</span>" +
          '<span class="fig um"><b>' + svc.stats.unmarked + "</b>unmarked</span>" +
          "</span>" +
          '<span class="rate ' + (rate >= 70 ? "good" : rate > 0 ? "mid" : "") + '">' +
          rate +
          "%</span>" +
          '<span class="chev">›</span>' +
          "</button>" +
          '<div class="hist-detail" data-detail="' + i + '" hidden>' +
          detailHTML(svc) +
          "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  function detailHTML(svc) {
    function group(title, people, cls) {
      if (!people.length) {
        return (
          '<div class="grp"><div class="grp-head ' + cls + '">' + title +
          " <span>0</span></div><div class='none'>None</div></div>"
        );
      }
      return (
        '<div class="grp"><div class="grp-head ' + cls + '">' + title +
        " <span>" + people.length + "</span></div><ul>" +
        people
          .map(function (m) {
            return (
              '<li><span class="avatar mini">' + S.esc(initials(m)) + "</span>" +
              S.esc(m.first + " " + m.last) +
              (m.ministry && m.ministry !== "None"
                ? '<em>' + S.esc(m.ministry) + "</em>"
                : "") +
              "</li>"
            );
          })
          .join("") +
        "</ul></div>"
      );
    }

    return (
      '<div class="hist-detail-inner">' +
      group("Present", svc.present, "ok") +
      group("Absent", svc.absent, "no") +
      group("Unmarked", svc.unmarked, "um") +
      '<div class="hist-detail-foot">' +
      '<a class="btn btn-ghost btn-sm" href="export.html">Open in Export</a>' +
      '<a class="btn btn-ghost btn-sm" href="attendance.html?type=' +
      S.esc(svc.type) +
      '&date=' +
      S.esc(svc.date) +
      '">Reopen sheet</a>' +
      "</div></div>"
    );
  }

  /* ---------------- by member ---------------- */
  function renderMembers() {
    const body = $("hist-members");
    const q = memberTerm.toLowerCase();
    const board = S.attendanceLeaderboard().filter(function (row) {
      if (!q) return true;
      const m = row.member;
      return (
        (m.first + " " + m.last).toLowerCase().indexOf(q) > -1 ||
        (m.email || "").toLowerCase().indexOf(q) > -1 ||
        (m.ministry || "").toLowerCase().indexOf(q) > -1
      );
    });

    $("h-mcount").textContent =
      board.length + (board.length === 1 ? " member" : " members");

    if (!board.length) {
      body.innerHTML =
        '<tr><td colspan="7"><div class="empty"><strong>' +
        (S.getMembers().length ? "No members match your search" : "No members yet") +
        "</strong>" +
        (S.getMembers().length
          ? "Try a different name."
          : "Add members, then take attendance to build history.") +
        "</div></td></tr>";
      return;
    }

    body.innerHTML = board
      .map(function (row) {
        const m = row.member;
        const noHistory = row.total === 0;
        return (
          '<tr data-mid="' + S.esc(m.id) + '">' +
          '<td><div class="name-cell"><span class="avatar">' + S.esc(initials(m)) +
          '</span><div><div class="nm">' + S.esc(m.first + " " + m.last) + "</div>" +
          '<div class="joined">' + S.esc(m.ministry && m.ministry !== "None" ? m.ministry : "No ministry") +
          "</div></div></div></td>" +
          '<td><b class="num">' + row.attended + "</b></td>" +
          '<td class="muted-cell">' + row.missed + "</td>" +
          "<td>" +
          (noHistory
            ? '<span class="badge badge-unmarked">—</span>'
            : '<div class="rate-cell"><span class="rate-bar"><span style="width:' +
              row.rate + '%;background:' + rateColor(row.rate) + '"></span></span>' +
              '<b>' + row.rate + "%</b></div>") +
          "</td>" +
          "<td>" +
          (row.streak > 0
            ? '<span class="badge badge-present">' + row.streak + " in a row</span>"
            : '<span class="muted-cell">—</span>') +
          "</td>" +
          '<td class="muted-cell">' + (row.last ? S.esc(S.shortDate(row.last)) : "—") + "</td>" +
          '<td><div class="row-actions"><button class="btn btn-white btn-sm" type="button" data-open="' +
          S.esc(m.id) + '">View history</button></div></td></tr>'
        );
      })
      .join("");
  }

  function rateColor(rate) {
    if (rate >= 70) return "var(--green-600)";
    if (rate >= 40) return "var(--red-500)";
    return "var(--red-700)";
  }

  /* ---------------- member drill-down ---------------- */
  function openMember(id) {
    const m = S.getMember(id);
    if (!m) return;

    const h = S.memberHistory(id);

    $("mp-avatar").textContent = initials(m);
    $("mp-name").textContent = m.first + " " + m.last;
    $("mp-meta").textContent = [
      m.ministry && m.ministry !== "None" ? m.ministry : "No ministry",
      m.email,
    ]
      .filter(Boolean)
      .join(" · ");

    $("mp-attended").textContent = h.attended;
    $("mp-missed").textContent = h.missed;
    $("mp-rate").textContent = h.rate + "%";
    $("mp-streak").textContent = h.streak;

    const tl = $("mp-timeline");
    if (!h.rows.length) {
      tl.innerHTML =
        '<div class="empty"><strong>No attendance recorded</strong>' +
        "This member hasn't been marked in any service yet.</div>";
    } else {
      tl.innerHTML = h.rows
        .map(function (r) {
          return (
            '<div class="tl-row ' + r.status + '">' +
            '<span class="dot"></span>' +
            '<span class="d">' + S.esc(S.prettyDate(r.date)) + "</span>" +
            '<span class="badge badge-svc">' + S.esc(S.typeShort(r.type)) + "</span>" +
            '<span class="st ' +
            (r.status === "present" ? "ok" : "no") + '">' +
            (r.status === "present" ? "Present" : "Absent") +
            "</span></div>"
          );
        })
        .join("");
    }

    $("member-panel").hidden = false;
    $("member-panel").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  /* ---------------- events ---------------- */
  $("hist-tabs").addEventListener("click", function (e) {
    const btn = e.target.closest("button[data-view]");
    if (!btn) return;
    view = btn.getAttribute("data-view");
    Array.prototype.forEach.call($("hist-tabs").querySelectorAll("button"), function (b) {
      b.classList.toggle("on", b === btn);
    });
    $("view-services").hidden = view !== "services";
    $("view-members").hidden = view !== "members";
    if (view === "members") renderMembers();
  });

  $("h-type").addEventListener("change", function (e) {
    typeFilter = e.target.value;
    renderServices();
  });

  $("h-search").addEventListener("input", function (e) {
    dateTerm = e.target.value.trim();
    renderServices();
  });

  $("hist-services").addEventListener("click", function (e) {
    const btn = e.target.closest("button[data-toggle]");
    if (!btn) return;
    const item = btn.closest(".hist-item");
    const detail = item.querySelector(".hist-detail");
    const open = !detail.hidden;
    detail.hidden = open;
    btn.setAttribute("aria-expanded", String(!open));
    item.classList.toggle("open", !open);
  });

  $("h-msearch").addEventListener("input", function (e) {
    memberTerm = e.target.value.trim();
    renderMembers();
  });

  $("hist-members").addEventListener("click", function (e) {
    const btn = e.target.closest("button[data-open]");
    if (!btn) return;
    openMember(btn.getAttribute("data-open"));
  });

  $("mp-close").addEventListener("click", function () {
    $("member-panel").hidden = true;
  });

  /* ---------------- init ---------------- */
  renderStats();
  renderServices();
  renderMembers();

  /* history.html?member=<id> arrives from the profile card —
     jump straight to that member's timeline. */
  (function () {
    const id = new URLSearchParams(window.location.search).get("member");
    if (!id || !S.getMember(id)) return;

    const btn = document.querySelector('#hist-tabs button[data-view="members"]');
    if (btn) btn.click();
    openMember(id);
  })();
})();
