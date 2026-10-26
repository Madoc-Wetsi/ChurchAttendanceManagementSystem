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
        '<tr><td colspan="4"><div class="empty"><strong>' +
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
          S.esc(S.prettyDate(m.joined).split(",").slice(1).join(",").trim() || "—") +
          "</div>" +
          "</div></div></td>" +
          '<td class="muted-cell">' +
          S.esc(m.email || "—") +
          "</td>" +
          '<td class="muted-cell">' +
          S.esc(m.phone || "—") +
          "</td>" +
          '<td><div class="row-actions">' +
          '<a class="btn btn-ghost btn-sm" href="attendance.html">Attendance</a>' +
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

  // "?added=Jane Doe" arrives from the add-member redirect
  (function () {
    const added = new URLSearchParams(window.location.search).get("added");
    if (!added) return;
    const el = document.createElement("div");
    el.className = "toast show ok";
    el.textContent = added + " added to the register";
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
