/* Dashboard — stats, turnout meter and recent services */
(function () {
  const S = window.ChurchStore;
  const $ = (id) => document.getElementById(id);

  function render() {
    const stats = S.overallStats();

    const user = S.getUser();
    $("side-user").textContent = user ? user.name : "Church Admin";
    $("welcome-name").textContent = user ? "Welcome back, " + user.name.split(" ")[0] : "Welcome back";
    $("welcome-date").textContent = stats.todayLabel;

    $("stat-total").textContent = stats.totalMembers;
    $("stat-present").textContent = stats.presentToday;
    $("stat-absent").textContent = stats.absentToday;
    $("stat-services").textContent = stats.services;

    // Turnout for today only
    const hasToday = S.getRecord(stats.todayKey);
    const taken = Object.keys(hasToday).length > 0;

    if (taken) {
      const rate = stats.totalMembers
        ? Math.round((stats.presentToday / stats.totalMembers) * 100)
        : 0;
      $("rate-pct").textContent = rate + "%";
      $("rate-bar").style.width = rate + "%";
      $("rate-note").textContent =
        stats.presentToday +
        " of " +
        stats.totalMembers +
        " members present. " +
        stats.unmarkedToday +
        " not yet marked.";
      $("stat-present-sub").textContent = stats.presentToday + " of " + stats.totalMembers + " members";
    } else {
      $("rate-pct").textContent = "—";
      $("rate-bar").style.width = "0%";
      $("rate-note").textContent = "Attendance has not been taken for today yet.";
      $("stat-present-sub").textContent = "No service taken yet";
    }

    // Recent services (most recent first)
    const dates = S.listServiceDates().slice(0, 6);
    const list = $("recent-list");

    if (!dates.length) {
      list.innerHTML =
        '<div class="empty"><strong>No services recorded yet</strong>Take attendance and your history will appear here.</div>';
      return;
    }

    list.innerHTML = dates
      .map(function (date) {
        const r = S.statsFor(date);
        const label = S.prettyDate(date);
        return (
          '<div class="svc-row"><div class="when">' +
          S.esc(label.split(",")[0]) +
          "<small>" +
          S.esc(label.split(",").slice(1).join(",").trim()) +
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
