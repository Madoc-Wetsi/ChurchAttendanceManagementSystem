/* Dashboard — stats, turnout and recent services (Sunday + Midweek) */
(function () {
  const S = window.ChurchStore;
  const $ = (id) => document.getElementById(id);

  function rateMarkup(stats, label) {
    if (!stats.total) {
      return (
        '<div class="rate-block"><div class="rate-head">' +
        '<div class="label" style="margin:0">' +
        label +
        '</div><div class="pct">—</div></div>' +
        '<div class="progress"><span style="width:0%"></span></div>' +
        '<div class="rate-note">Add members to see turnout.</div></div>'
      );
    }
    if (!stats.present && !stats.absent) {
      return (
        '<div class="rate-block"><div class="rate-head">' +
        '<div class="label" style="margin:0">' +
        label +
        '</div><div class="pct">—</div></div>' +
        '<div class="progress"><span style="width:0%"></span></div>' +
        '<div class="rate-note">' +
        label +
        " not taken for today yet.</div></div>"
      );
    }
    return (
      '<div class="rate-block"><div class="rate-head">' +
      '<div class="label" style="margin:0">' +
      label +
      '</div><div class="pct">' +
      stats.rate +
      "%</div></div>" +
      '<div class="progress"><span style="width:' +
      stats.rate +
      '%"></span></div>' +
      '<div class="rate-note">' +
      stats.present +
      " of " +
      stats.total +
      " present · " +
      stats.absent +
      " absent · " +
      stats.unmarked +
      " unmarked</div></div>"
    );
  }

  function render() {
    const stats = S.overallStats();

    const user = S.getUser();
    $("side-user").textContent = user ? user.name : "Church Admin";
    $("welcome-name").textContent = user
      ? "Welcome back, " + user.name.split(" ")[0]
      : "Welcome back";
    $("welcome-date").textContent = stats.todayLabel;

    $("stat-total").textContent = stats.totalMembers;
    $("stat-sunday").textContent = stats.sundayServices;
    $("stat-midweek").textContent = stats.midweekServices;
    $("stat-services").textContent = stats.services;

    // Today's turnout, split by service type
    $("today-rates").innerHTML =
      rateMarkup(stats.today.sunday, "Sunday Service") +
      rateMarkup(stats.today.midweek, "Midweek Service");

    // Recent services (both types, most recent first)
    const services = S.listServices().slice(0, 8);
    const list = $("recent-list");

    if (!services.length) {
      list.innerHTML =
        '<div class="empty"><strong>No services recorded yet</strong>Take attendance and your history will appear here.</div>';
      return;
    }

    list.innerHTML = services
      .map(function (svc) {
        const r = S.statsFor(svc.date, svc.type);
        const label = S.prettyDate(svc.date);
        const parts = label.split(",");
        return (
          '<div class="svc-row"><div class="when">' +
          '<span class="badge badge-svc">' +
          S.esc(S.typeShort(svc.type)) +
          "</span> " +
          S.esc(parts[0]) +
          "<small>" +
          S.esc(parts.slice(1).join(",").trim()) +
          "</small></div>" +
          '<div class="badge ' +
          (r.rate >= 70 ? "badge-present" : "badge-unmarked") +
          '">' +
          r.present +
          "/" +
          r.total +
          " · " +
          r.rate +
          "%</div></div>"
        );
      })
      .join("");
  }

  render();
})();
