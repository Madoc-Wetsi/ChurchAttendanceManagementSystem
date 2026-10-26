/* Export — pick a recorded service, preview it, CSV or print */
(function () {
  const S = window.ChurchStore;
  const $ = (id) => document.getElementById(id);

  const dates = S.listServiceDates();
  const sel = $("exp-date");

  function initials(m) {
    return ((m.first || "").charAt(0) + (m.last || "").charAt(0)).toUpperCase() || "?";
  }

  if (!dates.length) {
    sel.innerHTML = '<option value="">No services recorded yet</option>';
    sel.disabled = true;
    $("btn-csv").disabled = true;
    $("btn-print").disabled = true;
    $("exp-title").textContent = "Nothing to export yet";
    $("exp-count").textContent = "—";
    $("exp-body").innerHTML =
      '<tr><td colspan="4"><div class="empty"><strong>No attendance records yet</strong>' +
      '<a href="attendance.html">Take attendance</a> first, then come back to export it.' +
      "</div></td></tr>";
    return;
  }

  sel.innerHTML = dates
    .map(function (d) {
      return '<option value="' + S.esc(d) + '">' + S.esc(S.prettyDate(d)) + "</option>";
    })
    .join("");

  function renderPreview() {
    const date = sel.value;
    const rec = S.getRecord(date);
    const members = S.getMembers();

    let present = 0;
    let absent = 0;
    members.forEach(function (m) {
      if (rec[m.id] === "present") present++;
      else if (rec[m.id] === "absent") absent++;
    });

    $("exp-title").textContent = S.prettyDate(date);
    $("exp-count").textContent =
      present + " present · " + absent + " absent · " + members.length + " on register";

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

  $("btn-csv").addEventListener("click", function () {
    const date = sel.value;
    if (!date) return;
    S.download("attendance-" + date + ".csv", S.toCSV(date));
  });

  $("btn-print").addEventListener("click", function () {
    window.print();
  });

  sel.addEventListener("change", renderPreview);
  renderPreview();
})();
