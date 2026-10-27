/* Export — pick a recorded service (Sunday or Midweek), preview it,
   then download CSV or print. */
(function () {
  const S = window.ChurchStore;
  const $ = (id) => document.getElementById(id);

  const services = S.listServices();
  const sel = $("exp-date");
  const typeFilter = $("exp-type");

  function initials(m) {
    return ((m.first || "").charAt(0) + (m.last || "").charAt(0)).toUpperCase() || "?";
  }

  /* Which services match the current filter? */
  function filtered() {
    const wanted = typeFilter.value;
    return services.filter(function (s) {
      return !wanted || s.type === wanted;
    });
  }

  function fillSelect() {
    const list = filtered();

    if (!list.length) {
      sel.innerHTML = '<option value="">No matching services</option>';
      sel.disabled = true;
      $("btn-csv").disabled = true;
      $("btn-print").disabled = true;
      $("exp-title").textContent = "Nothing to export";
      $("exp-count").textContent = "—";
      $("exp-body").innerHTML =
        '<tr><td colspan="5"><div class="empty"><strong>No records here yet</strong>' +
        (services.length
          ? "Try a different service type."
          : '<a href="attendance.html">Take attendance</a> first, then come back to export it.') +
        "</div></td></tr>";
      return false;
    }

    sel.disabled = false;
    $("btn-csv").disabled = false;
    $("btn-print").disabled = false;

    sel.innerHTML = list
      .map(function (s) {
        const label = S.typeShort(s.type) + " · " + S.prettyDate(s.date);
        return '<option value="' + S.esc(s.date + "|" + s.type) + '">' + S.esc(label) + "</option>";
      })
      .join("");

    return true;
  }

  function current() {
    const parts = String(sel.value || "").split("|");
    return { date: parts[0], type: parts[1] || "sunday" };
  }

  function renderPreview() {
    const cur = current();
    if (!cur.date) return;

    const rec = S.getRecord(cur.date, cur.type);
    const members = S.getMembers();
    const stats = S.statsFor(cur.date, cur.type);

    $("exp-title").textContent = S.typeLabel(cur.type) + " — " + S.prettyDate(cur.date);
    $("exp-count").textContent =
      stats.present +
      " present · " +
      stats.absent +
      " absent · " +
      stats.unmarked +
      " unmarked · " +
      members.length +
      " on register";

    $("exp-body").innerHTML = members
      .map(function (m) {
        const status = rec[m.id];
        const badge =
          status === "present"
            ? '<span class="badge badge-present">Present</span>'
            : status === "absent"
            ? '<span class="badge badge-absent">Absent</span>'
            : '<span class="badge badge-unmarked">Unmarked</span>';

        return (
          "<tr>" +
          '<td><div class="name-cell"><span class="avatar">' +
          S.esc(initials(m)) +
          '</span><div><div class="nm">' +
          S.esc(m.first + " " + m.last) +
          "</div></div></div></td>" +
          "<td>" +
          (m.ministry && m.ministry !== "None"
            ? '<span class="badge badge-ministry">' + S.esc(m.ministry) + "</span>"
            : '<span class="muted-cell">—</span>') +
          "</td>" +
          '<td class="muted-cell">' +
          S.esc(m.email || "—") +
          "</td>" +
          '<td class="muted-cell">' +
          S.esc(m.phone || "—") +
          "</td>" +
          "<td>" +
          badge +
          "</td></tr>"
        );
      })
      .join("");
  }

  /* ---- events ---- */
  typeFilter.addEventListener("change", function () {
    if (fillSelect()) renderPreview();
  });

  sel.addEventListener("change", renderPreview);

  $("btn-csv").addEventListener("click", function () {
    const cur = current();
    if (!cur.date) return;
    S.download(
      "attendance-" + cur.type + "-" + cur.date + ".csv",
      S.toCSV(cur.date, cur.type)
    );
  });

  $("btn-print").addEventListener("click", function () {
    window.print();
  });

  /* ---- init ---- */
  if (!services.length) {
    typeFilter.disabled = true;
  }
  if (fillSelect()) renderPreview();
})();
