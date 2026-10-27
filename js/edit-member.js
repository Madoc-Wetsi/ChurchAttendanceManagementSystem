/* Edit member — pre-fill from ?id=, save back to the store */
(function () {
  const S = window.ChurchStore;
  const form = document.getElementById("member-form");
  if (!form) return;

  const err = document.getElementById("member-err");
  const photoInput = document.getElementById("photo");
  const preview = document.getElementById("photo-preview");
  const ministrySel = document.getElementById("ministry");

  const MAX_PHOTO = 2 * 1024 * 1024; // 2 MB

  let photoData = null; // null = leave photo untouched; "" = removed
  let originalPhoto = "";

  function show(id, on) {
    document.getElementById(id).hidden = !on;
  }

  function showErr(msg) {
    err.textContent = msg || "";
  }

  function isEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  function initialsFrom(first, last) {
    return ((first || "").charAt(0) + (last || "").charAt(0)).toUpperCase() || "+";
  }

  function updatePreview() {
    if (photoData) return;
    preview.textContent =
      initialsFrom(form.first.value.trim(), form.last.value.trim()) || "+";
  }

  /* ---------- resolve the member ---------- */
  const id = new URLSearchParams(window.location.search).get("id");
  const member = id ? S.getMember(id) : null;

  if (!member) {
    show("loading-card", false);
    show("missing-card", true);
    return;
  }

  show("loading-card", false);
  show("edit-card", true);

  const fullName = member.first + " " + member.last;
  document.getElementById("edit-title").textContent = "Edit " + fullName;
  document.getElementById("edit-sub").textContent =
    "Member since " + (S.shortDate(member.joined) || "—");
  document.getElementById("btn-cancel").setAttribute(
    "href",
    "../pages/members.html"
  );
  document.title = "Edit " + fullName + " — Firstlove Church, Godokpe Governorship";

  /* ---------- ministries ---------- */
  const current = member.ministry || "None";
  ministrySel.innerHTML = S.MINISTRIES.map(function (m) {
    return (
      '<option value="' +
      S.esc(m) +
      '"' +
      (m === current ? " selected" : "") +
      ">" +
      S.esc(m) +
      "</option>"
    );
  }).join("");

  /* ---------- pre-fill ---------- */
  form.first.value = member.first || "";
  form.last.value = member.last || "";
  form.email.value = member.email || "";
  form.phone.value = member.phone || "";
  form.location.value = member.location || "";
  form.bacenta.value = member.bacenta || "";
  form.dob.value = member.dob || "";
  originalPhoto = member.photo || "";

  // Suggest locations (bacenta register + members), and fill the
  // bacenta dropdown from the Bacentas tab, pre-selecting this member's.
  fillSuggestions("location-list", S.listLocations());
  fillBacentaOptions(member.bacenta || "");

  function fillSuggestions(listId, values) {
    const list = document.getElementById(listId);
    if (!list) return;
    list.innerHTML = (values || [])
      .map(function (v) {
        return '<option value="' + S.esc(v) + '">';
      })
      .join("");
  }

  function fillBacentaOptions(selected) {
    const sel = document.getElementById("bacenta");
    if (!sel) return;
    const names = S.listBacentaNames();
    if (selected && names.indexOf(selected) === -1) names.push(selected);
    sel.innerHTML =
      '<option value="">No bacenta</option>' +
      names
        .sort()
        .map(function (v) {
          return (
            '<option value="' +
            S.esc(v) +
            '"' +
            (v === selected ? " selected" : "") +
            ">" +
            S.esc(v) +
            "</option>"
          );
        })
        .join("");
  }

  if (originalPhoto) preview.innerHTML = '<img class="avatar" src="' + originalPhoto + '" alt="">';
  else updatePreview();

  /* ---------- photo ---------- */
  form.first.addEventListener("input", updatePreview);
  form.last.addEventListener("input", updatePreview);

  photoInput.addEventListener("change", function () {
    const file = photoInput.files && photoInput.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showErr("Please choose an image file.");
      photoInput.value = "";
      return;
    }

    if (file.size > MAX_PHOTO) {
      showErr("Photo must be smaller than 2 MB.");
      photoInput.value = "";
      return;
    }

    showErr("");
    const reader = new FileReader();
    reader.onload = function (ev) {
      photoData = ev.target.result;
      preview.innerHTML = '<img class="avatar" src="' + photoData + '" alt="">';
    };
    reader.readAsDataURL(file);
  });

  document.getElementById("btn-clear-photo").addEventListener("click", function () {
    photoData = "";
    originalPhoto = "";
    photoInput.value = "";
    updatePreview();
    showErr("");
  });

  /* ---------- save ---------- */
  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const first = form.first.value.trim();
    const last = form.last.value.trim();
    const email = form.email.value.trim();
    const phone = form.phone.value.trim();
    const location = form.location.value.trim();
    const bacenta = form.bacenta.value.trim();
    const ministry = form.ministry.value;
    const dob = form.dob.value;

    if (!first) return showErr("First name is required.");
    if (!last) return showErr("Last name is required.");
    if (email && !isEmail(email)) return showErr("That email address doesn't look right.");

    if (dob) {
      const d = new Date(dob);
      if (isNaN(d.getTime())) return showErr("That date of birth isn't valid.");
      if (d > new Date()) return showErr("Date of birth can't be in the future.");
    }

    const dupe = S.getMembers().some(function (m) {
      return (
        m.id !== member.id &&
        email &&
        (m.email || "").toLowerCase() === email.toLowerCase()
      );
    });
    if (dupe) return showErr("Another member already uses that email.");

    showErr("");

    const patch = {
      first: first,
      last: last,
      email: email,
      phone: phone,
      location: location,
      bacenta: bacenta,
      ministry: ministry,
      dob: dob,
    };
    if (photoData !== null) patch.photo = photoData;

    S.updateMember(member.id, patch);

    window.location.href =
      "../pages/members.html?updated=" + encodeURIComponent(first + " " + last);
  });
})();
