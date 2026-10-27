/* Bacentas — create, view, edit and remove fellowship groups */
(function () {
  const S = window.ChurchStore;
  const $ = (id) => document.getElementById(id);

  let term = "";
  let editingId = null; // null = adding

  const user = S.getUser();
  if (user) $("side-user").textContent = user.name;

  /* ---------------- stats ---------------- */
  function renderStats() {
    const bacentas = S.getBacentas();
    const members = S.getMembers();

    const locations = {};
    bacentas.forEach(function (b) {
      const v = (b.location || "").trim();
      if (v) locations[v.toLowerCase()] = 1;
    });

    const assigned = members.filter(function (m) {
      return String(m.bacenta || "").trim();
    }).length;

    $("b-total").textContent = bacentas.length;
    $("b-locations").textContent = Object.keys(locations).length;
    $("b-assigned").textContent = assigned;
    $("b-unassigned").textContent = members.length - assigned;
  }

  /* ---------------- list ---------------- */
  function renderList() {
    const list = $("bac-list");
    const counts = S.bacentaCounts();
    const bacentas = S.searchBacentas(term);

    if (!bacentas.length) {
      const anyAtAll = S.getBacentas().length;
      list.innerHTML =
        '<div class="empty"><strong>' +
        (anyAtAll ? "No bacentas match your search" : "No bacentas yet") +
        "</strong>" +
        (anyAtAll
          ? "Try a different name or location."
          : "Create your first bacenta using the form beside this list.") +
        "</div>";
      return;
    }

    list.innerHTML = bacentas
      .map(function (b) {
        const membersIn = counts[(b.name || "").toLowerCase()] || 0;
        return (
          '<div class="bac-row" data-id="' +
          S.esc(b.id) +
          '">' +
          '<div class="bac-who">' +
          '<span class="bac-mark">' +
          S.esc((b.name || "?").charAt(0).toUpperCase()) +
          "</span>" +
          "<div>" +
          '<div class="bac-name">' +
          S.esc(b.name) +
          "</div>" +
          '<div class="bac-meta">' +
          (b.location ? S.esc(b.location) : "No location set") +
          (b.created ? " · since " + S.esc(S.shortDate(b.created)) : "") +
          "</div>" +
          "</div></div>" +
          '<div class="bac-size ' +
          (membersIn ? "" : "none") +
          '">' +
          membersIn +
          " " +
          (membersIn === 1 ? "member" : "members") +
          "</div>" +
          '<div class="row-actions">' +
          '<a class="btn btn-ghost btn-sm" href="members.html?bacenta=' +
          encodeURIComponent(b.name) +
          '">View members</a>' +
          '<button class="btn btn-white btn-sm" type="button" data-edit="' +
          S.esc(b.id) +
          '">Edit</button>' +
          '<button class="btn btn-danger btn-sm" type="button" data-del="' +
          S.esc(b.id) +
          '">Delete</button>' +
          "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  function render() {
    renderStats();
    renderList();
  }

  /* ---------------- form ---------------- */
  function showErr(msg) {
    $("bac-err").textContent = msg || "";
  }

  function resetForm() {
    editingId = null;
    $("bac-name").value = "";
    $("bac-location").value = "";
    $("form-title").textContent = "Add a bacenta";
    $("form-sub").textContent =
      "Give the bacenta a name and, if you like, the area it covers.";
    $("btn-save-bac").textContent = "Add Bacenta";
    $("btn-cancel-edit").hidden = true;
    showErr("");
  }

  function startEdit(id) {
    const b = S.getBacenta(id);
    if (!b) return;
    editingId = id;
    $("bac-name").value = b.name || "";
    $("bac-location").value = b.location || "";
    $("form-title").textContent = "Edit bacenta";
    $("form-sub").textContent = "Update the details for " + b.name + ".";
    $("btn-save-bac").textContent = "Save changes";
    $("btn-cancel-edit").hidden = false;
    showErr("");
    $("bac-name").focus();
    $("new-bacenta").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  $("bacenta-form").addEventListener("submit", function (e) {
    e.preventDefault();

    const name = $("bac-name").value.trim();
    const location = $("bac-location").value.trim();

    if (!name) return showErr("Bacenta name is required.");

    if (editingId) {
      const updated = S.updateBacenta(editingId, { name: name, location: location });
      if (!updated)
        return showErr("Another bacenta already uses that name.");
      const wasEditing = S.getBacenta(editingId);
      resetForm();
      render();
      toast((wasEditing ? wasEditing.name : "Bacenta") + " updated", true);
      return;
    }

    const res = S.addBacenta({ name: name, location: location });
    if (!res.ok) return showErr(res.error);

    resetForm();
    render();
    fillLocationSuggestions();
    toast(res.bacenta.name + " added", true);
  });

  $("btn-cancel-edit").addEventListener("click", resetForm);

  // "+ Add Bacenta" in the header jumps to and focuses the form
  $("btn-focus-add").addEventListener("click", function () {
    resetForm();
    setTimeout(function () {
      $("bac-name").focus();
    }, 60);
  });

  /* ---------------- list interactions ---------------- */
  $("bac-list").addEventListener("click", function (e) {
    const editBtn = e.target.closest("button[data-edit]");
    if (editBtn) {
      startEdit(editBtn.getAttribute("data-edit"));
      return;
    }

    const delBtn = e.target.closest("button[data-del]");
    if (!delBtn) return;
    const id = delBtn.getAttribute("data-del");
    const b = S.getBacenta(id);
    if (!b) return;

    const size = S.bacentaCounts()[(b.name || "").toLowerCase()] || 0;
    const msg = size
      ? "Delete " + b.name + "? Its " + size + " member(s) will be left without a bacenta."
      : "Delete " + b.name + "?";
    if (!confirm(msg)) return;

    if (editingId === id) resetForm();
    S.deleteBacenta(id);
    render();
    fillLocationSuggestions();
    toast("Bacenta deleted");
  });

  $("bac-search").addEventListener("input", function (e) {
    term = e.target.value.trim();
    renderList();
  });

  /* ---------------- suggestions ---------------- */
  function fillLocationSuggestions() {
    $("bac-location-list").innerHTML = S.listLocations()
      .map(function (v) {
        return '<option value="' + S.esc(v) + '">';
      })
      .join("");
  }

  /* ---------------- toast ---------------- */
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

  /* ---------------- init ---------------- */
  fillLocationSuggestions();
  render();
})();
