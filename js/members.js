/* Members directory */
(function () {
  const S = window.ChurchStore;
  const $ = (id) => document.getElementById(id);

  let term = "";

  function initials(m) {
    return ((m.first || "").charAt(0) + (m.last || "").charAt(0)).toUpperCase() || "?";
  }

  function render() {
    const members = S.searchMembers(term);
    const total = S.getMembers().length;
    const body = $("mem-body");

    $("mem-count").textContent =
      term && members.length !== total
        ? members.length + " of " + total + " members"
        : total + (total === 1 ? " member" : " members");

    if (!members.length) {
      body.innerHTML =
        '<tr><td colspan="7"><div class="empty"><strong>' +
        (total ? "No members match your search" : "No members yet") +
        "</strong>" +
        (total
          ? "Try a different name, email or phone."
          : "Add your first member to get started.") +
        "</div></td></tr>";
      return;
    }

    body.innerHTML = members
      .map(function (m) {
        const dob = m.dob ? S.shortDate(m.dob) : "";
        const contact = [m.email, m.phone].filter(Boolean);

        return (
          '<tr data-id="' +
          S.esc(m.id) +
          '">' +
          '<td><div class="name-cell">' +
          (m.photo
            ? '<img class="avatar" src="' + S.esc(m.photo) + '" alt="">'
            : '<span class="avatar">' + S.esc(initials(m)) + "</span>") +
          "<div>" +
          '<div class="nm">' +
          S.esc(m.first + " " + m.last) +
          "</div>" +
          '<div class="joined">Joined ' +
          S.esc(S.shortDate(m.joined) || "—") +
          "</div>" +
          "</div></div></td>" +
          '<td class="muted-cell">' +
          (dob ? S.esc(dob) : "—") +
          "</td>" +
          '<td class="muted-cell">' +
          (contact.length
            ? contact.map(function (c) {
                return "<div>" + S.esc(c) + "</div>";
              }).join("")
            : "—") +
          "</td>" +
          '<td class="muted-cell">' +
          (m.location ? S.esc(m.location) : "—") +
          "</td>" +
          '<td class="muted-cell">' +
          (m.bacenta ? S.esc(m.bacenta) : "—") +
          "</td>" +
          "<td>" +
          (m.ministry && m.ministry !== "None"
            ? '<span class="badge badge-ministry">' + S.esc(m.ministry) + "</span>"
            : '<span class="muted-cell">—</span>') +
          "</td>" +
          '<td><div class="row-actions">' +
          '<a class="btn btn-ghost btn-sm" href="attendance.html">Attendance</a>' +
          '<a class="btn btn-white btn-sm" href="../auth/edit-member.html?id=' +
          S.esc(m.id) +
          '">Edit</a>' +
          '<button class="btn btn-danger btn-sm" type="button" data-del="' +
          S.esc(m.id) +
          '">Delete</button>' +
          "</div></td></tr>"
        );
      })
      .join("");
  }

  $("mem-search").addEventListener("input", function (e) {
    term = e.target.value;
    render();
  });

  // members.html?bacenta=Bacent%203 arrives from the Bacentas tab —
  // pre-fill the search so only that bacenta's members show.
  (function () {
    const wanted = new URLSearchParams(window.location.search).get("bacenta");
    if (!wanted) return;
    term = wanted;
    $("mem-search").value = wanted;
  })();

  // "?added=Jane Doe" / "?updated=Jane Doe" arrive from the member forms
  (function () {
    const params = new URLSearchParams(window.location.search);
    const added = params.get("added");
    const updated = params.get("updated");
    const msg = added
      ? added + " added to the register"
      : updated
      ? "Changes saved for " + updated
      : "";
    if (!msg) return;

    const el = document.createElement("div");
    el.className = "toast show ok";
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () {
      el.classList.remove("show");
    }, 3200);
  })();

  $("mem-body").addEventListener("click", function (e) {
    const btn = e.target.closest("button[data-del]");
    if (!btn) return;
    const id = btn.getAttribute("data-del");
    const m = S.getMember(id);
    const name = m ? m.first + " " + m.last : "this member";

    if (!confirm("Delete " + name + "? Their attendance history will be removed too.")) return;

    S.deleteMember(id);
    render();
  });

  render();
})();
