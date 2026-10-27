/* ===============================================================
   Member profile view
   ---------------------------------------------------------------
   Click any member photo (or their initials avatar) anywhere in
   the app and this opens a card with their details and their
   attendance record.

   Include AFTER store.js on any page:
       <script src="../js/profile.js"></script>

   It binds itself — no per-page wiring needed.
   =============================================================== */
window.ProfileView = (function () {
  const S = window.ChurchStore;

  function initials(m) {
    return ((m.first || "").charAt(0) + (m.last || "").charAt(0)).toUpperCase() || "?";
  }

  function esc(v) {
    return S.esc(v);
  }

  function ageFrom(dob) {
    if (!dob) return null;
    const d = new Date(dob);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age >= 0 ? age : null;
  }

  function row(label, value) {
    const empty = !value;
    return (
      '<div class="pv-row"><span class="k">' +
      esc(label) +
      '</span><span class="v' +
      (empty ? " empty" : "") +
      '">' +
      esc(empty ? "—" : value) +
      "</span></div>"
    );
  }

  /* ---------- build & show ---------- */
  function open(memberId) {
    const m = S.getMember(memberId);
    if (!m) return;

    close(); // never stack two cards

    const h = S.memberHistory(memberId);
    const age = ageFrom(m.dob);
    const name = m.first + " " + m.last;

    const card = document.createElement("div");
    card.className = "pv-backdrop";
    card.innerHTML =
      '<div class="pv-card" role="dialog" aria-modal="true" aria-label="Profile of ' +
      esc(name) +
      '">' +
      '<div class="pv-hero">' +
      '<button class="pv-close" type="button" aria-label="Close">&times;</button>' +
      (m.photo
        ? '<img class="pv-photo" src="' + esc(m.photo) + '" alt="">'
        : '<div class="pv-photo">' + esc(initials(m)) + "</div>") +
      '<div class="pv-name">' +
      esc(name) +
      "</div>" +
      '<div class="pv-sub">' +
      (m.ministry && m.ministry !== "None"
        ? '<span class="pv-chip">' + esc(m.ministry) + "</span>"
        : '<span class="pv-chip plain">No ministry</span>') +
      "</div>" +
      "</div>" +

      '<div class="pv-stats">' +
      '<div class="pv-stat"><b>' + h.attended + "</b><span>Attended</span></div>" +
      '<div class="pv-stat"><b>' + h.missed + "</b><span>Missed</span></div>" +
      '<div class="pv-stat"><b>' + h.rate + "%</b><span>Rate</span></div>" +
      '<div class="pv-stat"><b>' + h.streak + "</b><span>Streak</span></div>" +
      "</div>" +

      '<div class="pv-details">' +
      row("Email", m.email) +
      row("Phone", m.phone) +
      row("Location", m.location) +
      row("Bacenta", m.bacenta) +
      row("Date of birth", (m.dob ? S.shortDate(m.dob) : "") + (age !== null ? "  ·  " + age + " yrs" : "")) +
      row("Member since", S.shortDate(m.joined)) +
      row("Services recorded", h.total ? String(h.total) : "") +
      "</div>" +

      '<div class="pv-actions">' +
      '<a class="btn btn-white" href="history.html?member=' + esc(m.id) + '">View history</a>' +
      '<a class="btn btn-primary" href="../auth/edit-member.html?id=' + esc(m.id) + '">Edit member</a>' +
      "</div>" +
      "</div>";

    document.body.appendChild(card);
    document.body.style.overflow = "hidden";

    // An in on the next frame so the transition runs
    requestAnimationFrame(function () {
      card.classList.add("show");
    });

    // Close on: X, backdrop click, Escape
    card.addEventListener("click", function (e) {
      if (e.target === card || e.target.closest(".pv-close")) close();
    });
  }

  function close() {
    // Remove every backdrop (defends against a double-loaded script)
    const all = document.querySelectorAll(".pv-backdrop");
    if (!all.length) return;
    Array.prototype.forEach.call(all, function (el) {
      el.classList.remove("show");
    });
    document.body.style.overflow = "";
    setTimeout(function () {
      Array.prototype.forEach.call(all, function (el) {
        if (el.parentNode) el.parentNode.removeChild(el);
      });
    }, 180);
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") close();
  });

  /* ---------- click binding ----------
     An avatar lives inside the row/container that carries the
     member id, so walk up to the nearest one. */
  document.addEventListener("click", function (e) {
    const avatar = e.target.closest(".avatar");
    if (!avatar) return;

    // Don't hijack clicks that are really on a link/button
    if (avatar.closest("a, button")) return;

    const holder = avatar.closest("[data-id], [data-member], [data-mid]");
    if (!holder) return;

    const id =
      holder.getAttribute("data-id") ||
      holder.getAttribute("data-member") ||
      holder.getAttribute("data-mid");
    if (!id) return;

    e.preventDefault();
    e.stopPropagation();
    open(id);
  });

  return { open: open, close: close };
})();
